import { sepolia } from "viem/chains";

export const SEPOLIA_RPC_URLS: readonly string[] = (() => {
  const single = process.env.NEXT_PUBLIC_RPC_URL;
  return [
    ...(single ? [single] : []),
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://sepolia.drpc.org",
    "https://eth-sepolia.public.blastapi.io",
  ].filter((v, i, a) => a.indexOf(v) === i);
})();

export { sepolia };
export const SUPPORTED_CHAINS = [sepolia] as const;
