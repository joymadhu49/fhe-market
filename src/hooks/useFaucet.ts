"use client";
import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { FAUCET_ADDRESS } from "@/lib/constants";
import { FAUCET_ABI } from "@/lib/abi";
import { txErrorMessage } from "@/lib/errors";

type Step = "idle" | "dripping" | "done";

/**
 * Single-tx in-app faucet. Calls `Faucet.drip(user, units)` on Sepolia which
 * internally loops `mint × units` + (one-time) `approve` + `wrap` so the user
 * signs exactly **one** transaction.
 */
export function useFaucet() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const mintAndWrap = useCallback(
    async (units: number = 5) => {
      if (!address) {
        toast.error("Connect wallet first");
        return;
      }
      if (units < 1 || units > 50) return;
      setError(null);
      setStep("dripping");
      try {
        toast.loading(`Dripping ${units} cUSDT…`, { id: "faucet" });
        const hash = await writeContractAsync({
          address: FAUCET_ADDRESS,
          abi: FAUCET_ABI,
          functionName: "drip",
          args: [address, units],
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

        setStep("done");
        toast.success(`Got ${units} cUSDT (encrypted) — reveal in your bet panel`, { id: "faucet" });
        setTimeout(() => setStep("idle"), 1500);
      } catch (e: unknown) {
        const msg = txErrorMessage(e);
        setError(msg);
        toast.error(msg, { id: "faucet" });
        setStep("idle");
      }
    },
    [address, publicClient, writeContractAsync],
  );

  return {
    mintAndWrap,
    step,
    isLoading: step !== "idle" && step !== "done",
    error,
    clearError: () => setError(null),
  };
}
