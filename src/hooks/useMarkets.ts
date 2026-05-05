"use client";
import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS } from "@/lib/constants";
import { MARKET_FACTORY_ABI, PREDICTION_MARKET_ABI } from "@/lib/abi";
import { MarketData, Outcome } from "@/types";

type RawMarket = {
  question: string;
  description: string;
  category: string;
  imageUrl: string;
  resolutionTime: bigint;
  seedLiquidity: bigint; // uint64 in the FHEVM contract
  outcome: number;
  resolved: boolean;
};

const OUTCOME_MAP: Record<number, Outcome> = {
  0: "UNRESOLVED",
  1: "YES",
  2: "NO",
  3: "CANCELLED",
};

export function useAllMarketAddresses() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: MARKET_FACTORY_ABI,
    functionName: "getAllMarkets",
    // Refetch periodically so newly-created markets show up without a full page reload.
    query: {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });
}

export function useMarketData(address: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address, abi: PREDICTION_MARKET_ABI, functionName: "getMarket" },
      { address, abi: PREDICTION_MARKET_ABI, functionName: "yesOdds" },
      { address, abi: PREDICTION_MARKET_ABI, functionName: "noOdds" },
      { address, abi: PREDICTION_MARKET_ABI, functionName: "totalPool" },
      { address, abi: PREDICTION_MARKET_ABI, functionName: "yesReserve" },
      { address, abi: PREDICTION_MARKET_ABI, functionName: "noReserve" },
    ],
    query: {
      // Refresh on tab focus so positions update after a round-trip through
      // the market page (buy/sell) without a manual reload.
      refetchOnWindowFocus: true,
      refetchInterval: false,
    },
  });

  const raw = data?.[0]?.result as RawMarket | undefined;
  const yesReserve = data?.[4]?.result as bigint | undefined;
  const noReserve  = data?.[5]?.result as bigint | undefined;

  const market: MarketData | undefined = raw
    ? {
        address,
        question:       raw.question,
        description:    raw.description,
        category:       raw.category,
        imageUrl:       raw.imageUrl,
        resolutionTime: Number(raw.resolutionTime),
        seedLiquidity:  BigInt(raw.seedLiquidity),
        yesReserve:     yesReserve ?? 0n,
        noReserve:      noReserve  ?? 0n,
        outcome:        OUTCOME_MAP[raw.outcome] ?? "UNRESOLVED",
        resolved:       raw.resolved,
      }
    : undefined;

  return {
    market,
    yesOdds:    data?.[1]?.result as bigint | undefined,
    noOdds:     data?.[2]?.result as bigint | undefined,
    totalPool:  data?.[3]?.result as bigint | undefined,
    yesReserve,
    noReserve,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Per-user shares are now `euint64` ciphertext handles. Use `useEncryptedShares`
 * for the on-demand user-decrypt flow. This thin wrapper just exposes the
 * raw handles for places that previously read getUserShares() and only need
 * to know "does the user have any encrypted position?" (handle != 0).
 */
export function useUserShares(marketAddress: `0x${string}`, userAddress?: `0x${string}`) {
  return useReadContract({
    address: marketAddress,
    abi: PREDICTION_MARKET_ABI,
    functionName: "yesSharesHandle",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    },
  });
}

/**
 * Previewing a payout pre-claim now requires user-decryption (the winning
 * share count is encrypted). Returning `undefined` makes the legacy callers
 * fall back to "claim to reveal" UI; once the user reveals, the encrypted
 * shares hook surfaces the cleartext.
 */
export function usePreviewPayout(_marketAddress: `0x${string}`, _userAddress?: `0x${string}`) {
  return { data: undefined, isLoading: false, refetch: async () => {} };
}

export function usePreviewBuy(
  marketAddress: `0x${string}`,
  isYes: boolean,
  amountIn: bigint | undefined,
) {
  return useReadContract({
    address: marketAddress,
    abi: PREDICTION_MARKET_ABI,
    functionName: "previewBuy",
    args: amountIn ? [isYes, amountIn] : undefined,
    query: { enabled: amountIn !== undefined && amountIn > 0n },
  });
}

export function usePreviewSell(
  marketAddress: `0x${string}`,
  isYes: boolean,
  sharesIn: bigint | undefined,
) {
  return useReadContract({
    address: marketAddress,
    abi: PREDICTION_MARKET_ABI,
    functionName: "previewSell",
    args: sharesIn ? [isYes, sharesIn] : undefined,
    query: { enabled: sharesIn !== undefined && sharesIn > 0n },
  });
}

/** Public on-chain bookkeeping of cUSDT held by the market. */
export function useCUSDTHeld(marketAddress: `0x${string}`) {
  return useReadContract({
    address: marketAddress,
    abi: PREDICTION_MARKET_ABI,
    functionName: "cUSDTHeld",
  });
}
