"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Loader2, Droplet } from "lucide-react";
import { useFaucet } from "@/hooks/useFaucet";

const STEP_LABEL: Record<string, string> = {
  idle: "Faucet · 5 cUSDT",
  dripping: "Dripping…",
  done: "Done",
};

/**
 * Single wallet-pop: calls `Faucet.drip(user, count)` on Sepolia. The Faucet
 * contract bundles `mint × count` + `approve` + `wrap` internally, so the
 * user only ever signs one transaction.
 */
export default function FaucetButton({
  count = 5,
  variant = "default",
}: {
  count?: number;
  variant?: "default" | "compact";
}) {
  const { address } = useAccount();
  const { mintAndWrap, step, isLoading } = useFaucet();
  const [working, setWorking] = useState(false);

  const onClick = async () => {
    if (!address || working) return;
    setWorking(true);
    try {
      await mintAndWrap(count);
    } finally {
      setWorking(false);
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!address || isLoading || working}
        title={address ? `Get ${count} test cUSDT into ${address}` : "Connect wallet first"}
        className="mono text-[10px] tracking-[0.1em] uppercase text-[#2d9cdb] border border-[#2d9cdb] rounded-[2px] px-[8px] py-[3px] hover:bg-[#2d9cdb] hover:text-[#0b0e12] transition-colors disabled:opacity-40 cursor-pointer"
      >
        {isLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : "Faucet"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!address || isLoading || working}
      className="inline-flex items-center gap-2 mono text-[12px] font-bold tracking-[0.08em] uppercase text-[#0b0e12] bg-[#2d9cdb] hover:bg-[#5eb8ed] disabled:bg-[#1f2630] disabled:text-[#6b7280] rounded-[3px] px-4 py-[10px] transition-colors disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Droplet className="h-3.5 w-3.5" />
      )}
      {STEP_LABEL[step] ?? "Faucet"}
    </button>
  );
}
