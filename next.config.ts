import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // FHEVM relayer SDK ships WASM + dynamic imports — keep it out of the
  // server bundle so SSR doesn't pull native deps that don't exist on Node.
  serverExternalPackages: ["@zama-fhe/relayer-sdk"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // The browser bundle uses fs/path indirection in dev tooling; stub them
      // so webpack doesn't try to bundle Node built-ins.
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
