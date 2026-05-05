"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { CUSDT_ADDRESS } from "@/lib/constants";
import { ERC7984_ABI } from "@/lib/abi";
import { userDecryptU64 } from "@/lib/fhevm";

const ZERO = ("0x" + "0".repeat(64)) as `0x${string}`;

/**
 * cUSDT balance reveal flow.
 * - Reads `confidentialBalanceOf(user)` → encrypted handle (always available).
 * - `reveal()` runs an EIP-712 user-decrypt and exposes the cleartext bigint.
 * - The cleartext clears whenever the underlying handle changes (after a tx).
 */
export function useCUSDTBalance() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const { data: handle, refetch } = useReadContract({
    address: CUSDT_ADDRESS,
    abi: ERC7984_ABI,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    },
  });

  const handleHex = (handle as `0x${string}` | undefined) ?? ZERO;
  const [cleartext, setCleartext] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCleartext(null);
  }, [handleHex]);

  const reveal = useCallback(async () => {
    if (!address) return;
    if (handleHex === ZERO) {
      setCleartext(0n);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sign = (params: any) => signTypedDataAsync(params);
      const v = await userDecryptU64(handleHex, CUSDT_ADDRESS, address, sign);
      setCleartext(v);
    } catch (e: any) {
      setError(e?.message ?? "Decrypt failed");
    } finally {
      setLoading(false);
    }
  }, [address, handleHex, signTypedDataAsync]);

  return {
    handle: handleHex,
    cleartext,
    revealed: cleartext !== null,
    loading,
    error,
    reveal,
    refetch,
  };
}
