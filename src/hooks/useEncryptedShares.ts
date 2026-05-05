"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useReadContracts, useSignTypedData } from "wagmi";
import { PREDICTION_MARKET_ABI } from "@/lib/abi";
import { userDecryptU64 } from "@/lib/fhevm";

const ZERO_HANDLE = ("0x" + "0".repeat(64)) as `0x${string}`;

/**
 * Read the user's encrypted YES/NO share handles for a market and (lazily, on
 * user gesture) user-decrypt them via EIP-712. The cleartext only exists in
 * memory — never on-chain, never broadcast.
 */
export function useEncryptedShares(marketAddress: `0x${string}`) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const { data: handles, refetch } = useReadContracts({
    contracts: address
      ? [
          {
            address: marketAddress,
            abi: PREDICTION_MARKET_ABI,
            functionName: "yesSharesHandle",
            args: [address],
          },
          {
            address: marketAddress,
            abi: PREDICTION_MARKET_ABI,
            functionName: "noSharesHandle",
            args: [address],
          },
        ]
      : [],
    query: { enabled: !!address, refetchOnWindowFocus: true },
  });

  const yesHandle = (handles?.[0]?.result as `0x${string}` | undefined) ?? ZERO_HANDLE;
  const noHandle  = (handles?.[1]?.result as `0x${string}` | undefined) ?? ZERO_HANDLE;

  const [yesShares, setYesShares] = useState<bigint | null>(null);
  const [noShares, setNoShares]   = useState<bigint | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Reset cleartext when handles change (after a buy/sell/claim).
  useEffect(() => {
    setYesShares(null);
    setNoShares(null);
  }, [yesHandle, noHandle]);

  const reveal = useCallback(async () => {
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      const sign = (params: any) => signTypedDataAsync(params);
      const yes = yesHandle === ZERO_HANDLE
        ? 0n
        : await userDecryptU64(yesHandle, marketAddress, address, sign);
      const no = noHandle === ZERO_HANDLE
        ? 0n
        : await userDecryptU64(noHandle, marketAddress, address, sign);
      setYesShares(yes);
      setNoShares(no);
    } catch (e: any) {
      setError(e?.message ?? "Decryption failed");
    } finally {
      setLoading(false);
    }
  }, [address, marketAddress, yesHandle, noHandle, signTypedDataAsync]);

  return {
    yesHandle,
    noHandle,
    yesShares,
    noShares,
    loading,
    error,
    reveal,
    refetchHandles: refetch,
    revealed: yesShares !== null && noShares !== null,
  };
}
