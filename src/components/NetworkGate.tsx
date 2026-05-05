"use client";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wifi } from "lucide-react";
import { sepolia } from "@/lib/chains";

interface Props {
  children?: React.ReactNode;
  showWhenConnected?: boolean;
  compact?: boolean;
}

/**
 * Renders a banner when the user is on the wrong chain or not connected.
 * If everything is fine and `showWhenConnected` is false, renders `children`.
 */
export default function NetworkGate({ children, showWhenConnected = false, compact = false }: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const wrongChain = isConnected && chainId !== sepolia.id;

  if (!isConnected) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-[4px] border border-[#f59e0b]/40 bg-[#131820] ${
          compact ? "px-3 py-2 text-[12px]" : "px-4 py-[10px] text-[13px]"
        } text-[#fcd34d]`}
      >
        <span>Connect a wallet to continue.</span>
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="rounded-[3px] border border-[#f59e0b]/50 bg-[#f59e0b]/15 px-[10px] py-[4px] text-[11.5px] font-semibold text-[#fcd34d] hover:bg-[#f59e0b]/25 transition-colors"
            >
              Connect
            </button>
          )}
        </ConnectButton.Custom>
      </div>
    );
  }

  if (wrongChain) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-[4px] border border-[#ef4444]/40 bg-[#131820] ${
          compact ? "px-3 py-2 text-[12px]" : "px-4 py-[10px] text-[13px]"
        } text-[#fca5a5]`}
      >
        <span className="flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5" />
          Wrong network — switch to {sepolia.name}.
        </span>
        <button
          onClick={() => switchChain({ chainId: sepolia.id })}
          disabled={isPending}
          className="rounded-[3px] border border-[#ef4444]/50 bg-[#ef4444]/15 px-[10px] py-[4px] text-[11.5px] font-semibold text-[#fca5a5] hover:bg-[#ef4444]/25 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Switching…" : "Switch"}
        </button>
      </div>
    );
  }

  return showWhenConnected ? <>{children}</> : <>{children}</>;
}

/** Thin hook returning gating flags so callers can disable buttons. */
export function useChainGate() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== sepolia.id;
  return { isConnected, wrongChain, address, chainId };
}
