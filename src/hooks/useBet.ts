"use client";
import { useCallback, useState } from "react";
import {
  useWriteContract,
  useReadContract,
  useAccount,
  usePublicClient,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseUSDC } from "@/lib/utils";
import { CUSDT_ADDRESS, OPERATOR_WINDOW_SECONDS } from "@/lib/constants";
import { PREDICTION_MARKET_ABI, ERC7984_ABI } from "@/lib/abi";
import { BetSide } from "@/types";
import { txErrorMessage } from "@/lib/errors";
import { encryptU64, publicDecrypt } from "@/lib/fhevm";

const SLIPPAGE_BPS = 100n;

function withSlippage(expected: bigint, bps: bigint = SLIPPAGE_BPS): bigint {
  const slack = (expected * bps) / 10_000n;
  return expected > slack ? expected - slack : 0n;
}

/** Poll a tx-completion view: waits until predicate returns true or `timeoutMs` elapses. */
async function pollUntil<T>(read: () => Promise<T>, ok: (v: T) => boolean, intervalMs = 3_000, timeoutMs = 90_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Relayer timeout — try executing manually from the panel below");
}

type Step =
  | "idle"
  | "operator"
  | "encrypting"
  | "buyIntent"
  | "buyDecrypting"
  | "buyExecute"
  | "sellIntent"
  | "sellDecrypting"
  | "sellExecute"
  | "claimIntent"
  | "claimDecrypting"
  | "claimExecute"
  | "done";

export function useBet(marketAddress: `0x${string}`) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const invalidateAllReads = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey?.[0];
        return typeof key === "string" && key.startsWith("readContract");
      },
    });
  }, [queryClient]);

  const { data: isOperatorSet, refetch: refetchOperator } = useReadContract({
    address: CUSDT_ADDRESS,
    abi: ERC7984_ABI,
    functionName: "isOperator",
    args: address ? [address, marketAddress] : undefined,
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useWriteContract();

  /** Ensure the market has cUSDT operator status from the user. Idempotent. */
  async function ensureOperator() {
    if (isOperatorSet) return;
    setStep("operator");
    toast.loading("Approving market as cUSDT operator…", { id: "bet" });
    const until = Math.floor(Date.now() / 1000) + OPERATOR_WINDOW_SECONDS;
    const hash = await writeContractAsync({
      address: CUSDT_ADDRESS,
      abi: ERC7984_ABI,
      functionName: "setOperator",
      args: [marketAddress, until],
    });
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
    await refetchOperator();
  }

  /**
   * Buy: 2-tx flow. Encrypts the bet amount, submits `buyIntent`, waits for the
   * relayer to public-decrypt the (clamped) transferred ciphertext, then calls
   * `executeBuy(user, cleartext, proof)` which runs the CPMM math and mints
   * encrypted shares to the user.
   */
  async function buy(side: BetSide, amountStr: string, previewShares?: bigint) {
    setError(null);
    if (!address) {
      const msg = "Connect wallet first";
      setError(msg);
      toast.error(msg);
      return;
    }
    const amount = parseUSDC(amountStr);
    const minSharesOut = previewShares ? withSlippage(previewShares) : 0n;

    try {
      await ensureOperator();

      setStep("encrypting");
      toast.loading("Encrypting bet…", { id: "bet" });
      const { handle, inputProof } = await encryptU64(marketAddress, address, amount);

      setStep("buyIntent");
      toast.loading("Submitting encrypted bet…", { id: "bet" });
      const intentHash = await writeContractAsync({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "buyIntent",
        args: [side === "YES", handle, inputProof, minSharesOut],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: intentHash });

      setStep("buyDecrypting");
      toast.loading("Waiting for relayer to publicly decrypt amount…", { id: "bet" });
      const pendingHandle = (await publicClient!.readContract({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "pendingBuyHandle",
        args: [address],
      })) as `0x${string}`;
      const { value, proof } = await publicDecrypt(pendingHandle);

      setStep("buyExecute");
      toast.loading("Executing CPMM swap…", { id: "bet" });
      const execHash = await writeContractAsync({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "executeBuy",
        args: [address, value, proof],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: execHash });

      setStep("done");
      toast.success(`${side} shares bought (encrypted)`, { id: "bet" });
      invalidateAllReads();
      setTimeout(() => setStep("idle"), 1500);
    } catch (e: unknown) {
      const msg = txErrorMessage(e);
      setError(msg);
      toast.error(msg, { id: "bet" });
      setStep("idle");
    }
  }

  /**
   * Sell: 2-tx flow. The intent encrypts the desired share count and clamps it
   * branchlessly to the user's encrypted balance. The relayer then reveals the
   * clamped value, and `executeSell` runs the CPMM and pays cUSDT.
   */
  async function sell(side: BetSide, sharesIn: bigint, previewGross?: bigint) {
    setError(null);
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }
    if (sharesIn <= 0n) {
      toast.error("Sell amount must be positive");
      return;
    }
    const minAmountOut = previewGross ? withSlippage((previewGross * 9_850n) / 10_000n) : 0n;

    try {
      setStep("encrypting");
      toast.loading("Encrypting sell amount…", { id: "bet" });
      const { handle, inputProof } = await encryptU64(marketAddress, address, sharesIn);

      setStep("sellIntent");
      toast.loading("Submitting sell intent…", { id: "bet" });
      const intentHash = await writeContractAsync({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "sellIntent",
        args: [side === "YES", handle, inputProof, minAmountOut],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: intentHash });

      setStep("sellDecrypting");
      toast.loading("Decrypting clamped share count…", { id: "bet" });
      const pendingHandle = (await publicClient!.readContract({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "pendingSellHandle",
        args: [address],
      })) as `0x${string}`;
      const { value, proof } = await publicDecrypt(pendingHandle);

      setStep("sellExecute");
      toast.loading("Settling sell…", { id: "bet" });
      const execHash = await writeContractAsync({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "executeSell",
        args: [address, value, proof],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: execHash });

      setStep("done");
      toast.success(`${side} shares sold`, { id: "bet" });
      invalidateAllReads();
      setTimeout(() => setStep("idle"), 1500);
    } catch (e: unknown) {
      const msg = txErrorMessage(e);
      setError(msg);
      toast.error(msg, { id: "bet" });
      setStep("idle");
    }
  }

  /**
   * Claim winnings: 2-tx flow. The intent snapshots the user's encrypted
   * winning balance and zeroes it; the relayer reveals the cleartext amount;
   * `executeClaim` pays cUSDT.
   */
  async function claimWinnings() {
    setError(null);
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }
    try {
      setStep("claimIntent");
      toast.loading("Snapshotting winnings…", { id: "claim" });
      const intentHash = await writeContractAsync({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "claimIntent",
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: intentHash });

      setStep("claimDecrypting");
      toast.loading("Decrypting winning balance…", { id: "claim" });
      const pendingHandle = (await publicClient!.readContract({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "pendingClaimHandle",
        args: [address],
      })) as `0x${string}`;
      const { value, proof } = await publicDecrypt(pendingHandle);

      setStep("claimExecute");
      toast.loading("Paying out cUSDT…", { id: "claim" });
      const execHash = await writeContractAsync({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "executeClaim",
        args: [address, value, proof],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: execHash });

      setStep("done");
      toast.success("Winnings claimed", { id: "claim" });
      invalidateAllReads();
      setTimeout(() => setStep("idle"), 1500);
    } catch (e: unknown) {
      const msg = txErrorMessage(e);
      setError(msg);
      toast.error(msg, { id: "claim" });
      setStep("idle");
    }
  }

  return {
    buy,
    sell,
    claimWinnings,
    ensureOperator,
    isOperatorSet: !!isOperatorSet,
    step,
    isLoading: step !== "idle" && step !== "done",
    error,
    clearError: () => setError(null),
    // Legacy compat: cUSDT balance is now confidential — the betting UI hides it.
    usdcBalance: undefined as bigint | undefined,
    balanceLoading: false,
    pollUntil,
  };
}
