#!/usr/bin/env tsx
// Lower the factory's default seed (treasury holds ~5 cUSDT) and create sample
// markets so the demo has live cards.
//
//   pnpm tsx scripts/bootstrap-markets.ts
import { Wallet, JsonRpcProvider, Contract } from "ethers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV = readFileSync(resolve(__dirname, "../.env"), "utf8");
function e(k: string) {
  const m = ENV.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`missing env ${k}`);
  return m[1];
}

const RPC = e("SEPOLIA_RPC_URL");
const PK = e("PRIVATE_KEY");
const FACTORY = e("NEXT_PUBLIC_FACTORY_ADDRESS");

const ONE_CUSDT = 1_000_000n;
const SEED_PER_MARKET = ONE_CUSDT; // 1 cUSDT
const FACTORY_ABI = [
  "function setDefaultSeedLiquidity(uint64) external",
  "function defaultSeedLiquidity() view returns (uint64)",
  "function createMarketWithSeed(string,string,string,string,uint256,uint64) returns (address)",
  "function getAllMarkets() view returns (address[])",
];

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  const factory = new Contract(FACTORY, FACTORY_ABI, wallet);

  const current: bigint = await factory.defaultSeedLiquidity();
  if (current !== SEED_PER_MARKET) {
    console.log(`setDefaultSeedLiquidity ${current} → ${SEED_PER_MARKET}`);
    await (await factory.setDefaultSeedLiquidity(SEED_PER_MARKET)).wait();
  }

  const oneWeek = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const oneMonth = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const markets = [
    {
      q: "Will ETH close above $4,000 on 2026-12-31?",
      d: "Resolves YES if ETH/USD spot > $4,000 at the 2026-12-31 23:59 UTC daily close on a major exchange.",
      c: "Crypto",
      i: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
      t: oneMonth,
    },
    {
      q: "Will BTC reach a new ATH by end of 2026?",
      d: "Resolves YES if BTC sets a new all-time high at any point through 2026-12-31.",
      c: "Crypto",
      i: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
      t: oneMonth,
    },
    {
      q: "Will Zama Mainnet Season 2 ship before mid-2026?",
      d: "Resolves YES if Zama publishes mainnet support before 2026-07-01.",
      c: "Tech",
      i: "",
      t: oneWeek,
    },
  ];

  for (const m of markets) {
    try {
      console.log(`creating: ${m.q.slice(0, 60)}…`);
      const tx = await factory.createMarketWithSeed(m.q, m.d, m.c, m.i, m.t, SEED_PER_MARKET);
      const r = await tx.wait();
      console.log(`  ✔ tx ${r?.hash}`);
    } catch (err: any) {
      console.error(`  ✘ ${err?.message ?? err}`);
    }
  }

  const all: string[] = await factory.getAllMarkets();
  console.log(`\nFactory now hosts ${all.length} market(s):`);
  for (const a of all) console.log(`  ${a}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
