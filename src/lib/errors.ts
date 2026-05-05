/** Extract a human-readable message from a wagmi/viem error. */
export function txErrorMessage(e: unknown): string {
  if (!e) return "Transaction failed";
  const err = e as {
    shortMessage?: string;
    details?: string;
    cause?: { shortMessage?: string; reason?: string; message?: string };
    message?: string;
    name?: string;
  };

  // RPC / contract revert is usually nested in `cause`
  const reason =
    err?.cause?.reason ||
    err?.cause?.shortMessage ||
    err?.cause?.message ||
    err?.shortMessage ||
    err?.details ||
    err?.message ||
    String(e);

  if (/User rejected/i.test(reason) || /User denied/i.test(reason)) {
    return "Transaction rejected in wallet";
  }
  if (/insufficient funds/i.test(reason)) {
    return "Insufficient ETH for gas on Sepolia — get test ETH at https://sepoliafaucet.com.";
  }
  if (/OwnableUnauthorized|caller is not the owner/i.test(reason)) {
    return "Connected wallet is not the factory owner — only the deployer wallet can create or resolve markets.";
  }
  if (/chain.*mismatch|Chain.*not.*configured/i.test(reason)) {
    return "Wrong network — switch your wallet to Sepolia.";
  }
  if (/Resolution must be in future/i.test(reason)) {
    return "Resolution time must be in the future.";
  }
  return reason.length > 220 ? reason.slice(0, 217) + "…" : reason;
}
