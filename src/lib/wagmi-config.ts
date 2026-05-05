"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, http } from "viem";
import { SEPOLIA_RPC_URLS, sepolia } from "./chains";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "bc3ba3e43e0cf5ad3749cbaf0fb29fb9";

const sepoliaTransport = fallback(
  SEPOLIA_RPC_URLS.map((url) => http(url, { timeout: 10_000 })),
  { rank: { interval: 60_000, sampleCount: 3 } },
);

export const wagmiConfig = getDefaultConfig({
  appName: "FHE Market",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: sepoliaTransport,
  },
  ssr: true,
});
