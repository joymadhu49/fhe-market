"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSignTypedData, useWriteContract } from "wagmi";
import { Loader2, Lock, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CUSDT_ADDRESS, CUSDT_DECIMALS } from "@/lib/constants";
import { ERC7984_ABI } from "@/lib/abi";
import { encryptU64, userDecryptU64 } from "@/lib/fhevm";
import { txErrorMessage } from "@/lib/errors";

const ZERO_HANDLE = `0x${"0".repeat(64)}` as `0x${string}`;
const OPERATOR_WINDOW_SECS = 24 * 3600;

/**
 * Admin-only treasury panel:
 *  - Reveal encrypted treasury cUSDT balance via EIP-712 user-decrypt.
 *  - Top up treasury by sending cUSDT.confidentialTransfer(treasury, encAmount).
 *
 * The reveal only works if the connected wallet is the treasury (or has been
 * granted FHE.allow on the balance handle). For the deployed factory the
 * treasury contract holds the only ACL grant — so revealing the live balance
 * from the admin wallet returns 0 / not-authorized. We surface the encrypted
 * handle either way and let the admin user-decrypt their own cUSDT balance for
 * comparison.
 */
export default function TreasuryPanel({
  treasuryAddress,
}: {
  treasuryAddress: `0x${string}`;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  // Encrypted handle for the treasury's cUSDT balance.
  const { data: treasuryHandle, refetch: refetchHandle } = useReadContract({
    address: CUSDT_ADDRESS,
    abi: ERC7984_ABI,
    functionName: "confidentialBalanceOf",
    args: [treasuryAddress],
    query: { refetchOnWindowFocus: true, staleTime: 5_000 },
  });

  // Connected admin's cUSDT handle (for top-up "Bal" reveal).
  const { data: meHandle } = useReadContract({
    address: CUSDT_ADDRESS,
    abi: ERC7984_ABI,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchOnWindowFocus: true, staleTime: 5_000 },
  });

  const { data: isOperatorSet, refetch: refetchOperator } = useReadContract({
    address: CUSDT_ADDRESS,
    abi: ERC7984_ABI,
    functionName: "isOperator",
    args: address ? [address, CUSDT_ADDRESS] : undefined,
    query: { enabled: false }, // confidentialTransfer doesn't need operator (self-send)
  });
  void isOperatorSet; // retained for future per-market operator checks

  const [meCleartext, setMeCleartext] = useState<bigint | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Reset cleartext when handle changes after a tx.
  useEffect(() => {
    setMeCleartext(null);
  }, [meHandle]);

  const revealMyBalance = useCallback(async () => {
    if (!address) return;
    setRevealing(true);
    setRevealError(null);
    try {
      const handle = (meHandle as `0x${string}` | undefined) ?? ZERO_HANDLE;
      if (handle === ZERO_HANDLE) {
        setMeCleartext(0n);
        return;
      }
      const sign = (params: any) => signTypedDataAsync(params);
      const v = await userDecryptU64(handle, CUSDT_ADDRESS, address, sign);
      setMeCleartext(v);
    } catch (e: any) {
      setRevealError(e?.message ?? "Decrypt failed");
    } finally {
      setRevealing(false);
    }
  }, [address, meHandle, signTypedDataAsync]);

  // ── Top-up form ────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const handleHasGrant = !!treasuryHandle && treasuryHandle !== ZERO_HANDLE;

  const sendTopUp = useCallback(async () => {
    if (!address) {
      toast.error("Connect admin wallet");
      return;
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    const units = BigInt(Math.floor(num * 10 ** CUSDT_DECIMALS));
    if (units <= 0n) {
      toast.error("Amount too small");
      return;
    }
    setSending(true);
    try {
      toast.loading("Encrypting amount…", { id: "topup" });
      const enc = await encryptU64(CUSDT_ADDRESS, address, units);

      toast.loading(`Sending ${num} cUSDT to treasury…`, { id: "topup" });
      const hash = await writeContractAsync({
        address: CUSDT_ADDRESS,
        abi: ERC7984_ABI,
        functionName: "confidentialTransfer",
        args: [treasuryAddress, enc.handle, enc.inputProof],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      toast.success(`Treasury topped up · ${num} cUSDT`, { id: "topup" });
      setAmount("");
      // Re-read treasury + admin handles so the UI reflects the new ciphertexts.
      await Promise.all([refetchHandle(), refetchOperator()]);
    } catch (e: unknown) {
      toast.error(txErrorMessage(e), { id: "topup" });
    } finally {
      setSending(false);
    }
  }, [address, amount, writeContractAsync, treasuryAddress, publicClient, refetchHandle, refetchOperator]);

  return (
    <div
      className="p-5"
      style={{ background: "var(--w)", border: "2px solid var(--k)" }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
            TREASURY
          </div>
          <div className="display mt-1" style={{ fontSize: 22, color: "var(--k)" }}>
            Top up & reveal
          </div>
        </div>
        <button
          onClick={() => refetchHandle()}
          className="mono text-[10px] tracking-[0.14em] inline-flex items-center gap-1.5 cursor-pointer"
          style={{ color: "var(--g2)" }}
        >
          <RefreshCw className="h-3 w-3" /> REFRESH
        </button>
      </div>

      {/* Treasury handle */}
      <div
        className="p-3 mb-4 grid gap-2"
        style={{ background: "#F8F8F5", border: "2px solid var(--k)" }}
      >
        <div className="mono flex justify-between text-[10px] tracking-[0.12em]" style={{ color: "var(--g2)" }}>
          <span>TREASURY BALANCE (ENCRYPTED)</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> euint64 ciphertext
          </span>
        </div>
        <div className="mono text-[11px] truncate" style={{ color: "var(--k)" }}>
          {handleHasGrant ? (treasuryHandle as string) : "—"}
        </div>
        <div className="mono text-[10px]" style={{ color: "var(--g2)" }}>
          ACL on this handle is granted to the Treasury contract only — no wallet
          can EIP-712 user-decrypt it. The total is provable on-chain via{" "}
          <code style={{ color: "var(--k)" }}>cUSDT.confidentialBalanceOf(treasury)</code>.
        </div>
      </div>

      {/* Admin's own cUSDT — admin can reveal */}
      <div
        className="p-3 mb-4"
        style={{ background: "#F8F8F5", border: "2px solid var(--k)" }}
      >
        <div className="mono flex justify-between items-center text-[10px] tracking-[0.12em]" style={{ color: "var(--g2)" }}>
          <span>YOUR cUSDT BALANCE</span>
          {meCleartext === null ? (
            <button
              onClick={revealMyBalance}
              disabled={revealing}
              className="mono inline-flex items-center gap-1.5 px-2 py-1 cursor-pointer disabled:opacity-50"
              style={{ background: "var(--w)", border: "2px solid var(--k)", color: "var(--k)" }}
            >
              {revealing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
              REVEAL · EIP-712
            </button>
          ) : (
            <span className="mono text-[12px]" style={{ color: "var(--k)", fontWeight: 700 }}>
              {(Number(meCleartext) / 10 ** CUSDT_DECIMALS).toFixed(2)} cUSDT
            </span>
          )}
        </div>
        {revealError && (
          <div className="mono text-[10px] mt-1.5" style={{ color: "var(--red)" }}>
            {revealError}
          </div>
        )}
      </div>

      {/* Top-up form */}
      <div className="mono text-[10px] tracking-[0.14em] mb-2" style={{ color: "var(--g2)" }}>
        SEND ENCRYPTED cUSDT TO TREASURY
      </div>
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center px-3 py-2.5"
          style={{ background: "var(--w)", border: "2px solid var(--k)" }}
        >
          <span className="mono text-[16px] font-bold mr-2">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={sending}
            className="mono flex-1 bg-transparent border-none outline-none text-[16px] font-bold"
            style={{ color: "var(--k)" }}
          />
          <span
            className="mono text-[10px] tracking-[0.1em] px-2 py-1"
            style={{ background: "var(--y)", color: "var(--k)" }}
          >
            cUSDT
          </span>
        </div>
        <button
          onClick={sendTopUp}
          disabled={!address || sending || !amount}
          className="mono inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer disabled:opacity-40"
          style={{ background: "var(--k)", color: "var(--w)", border: "2px solid var(--k)" }}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          DEPOSIT
        </button>
      </div>
      <div className="mono text-[10px] tracking-[0.06em] mt-2" style={{ color: "var(--g2)" }}>
        Encrypts in-browser via @zama-fhe/relayer-sdk →
        cUSDT.confidentialTransfer(treasury, encAmount, proof). One wallet pop.
      </div>
    </div>
  );
}

/** Approx ETA for the operator window — kept here in case the admin section needs it. */
export const TREASURY_OPERATOR_WINDOW = OPERATOR_WINDOW_SECS;
