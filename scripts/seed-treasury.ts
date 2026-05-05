#!/usr/bin/env tsx
// Seed the deployed arcbet-fhe Treasury with cUSDT so MarketFactory can fund
// new markets. Steps:
//   1. mint USDTMock to deployer N times (cap = 1 USDT/call)
//   2. approve the cUSDT wrapper for the minted underlying
//   3. wrap into cUSDT (deployer balance grows)
//   4. cUSDT.confidentialTransfer(treasury, encAmount) — encrypted at the
//      relayer; treasury balance stays encrypted
//
//   pnpm tsx scripts/seed-treasury.ts
import { Wallet, JsonRpcProvider, Contract, parseUnits } from "ethers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const ENV = readFileSync(resolve(__dirname, "../.env"), "utf8");
function e(k: string) {
  const m = ENV.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`missing env ${k}`);
  return m[1];
}

const RPC = e("SEPOLIA_RPC_URL");
const PK = e("PRIVATE_KEY");
const CUSDT = e("CUSDT_SEPOLIA");
const USDT_MOCK = e("USDT_MOCK_SEPOLIA");
const TREASURY = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS as string) || e("NEXT_PUBLIC_TREASURY_ADDRESS");

const TARGET_USDT = parseUnits("5", 6); // 5 USDT → 5 cUSDT
const MINT_PER_CALL = parseUnits("1", 6);

const ERC20_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];
const WRAPPER_ABI = [
  "function wrap(address to, uint256 amount)",
  "function confidentialTransfer(address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
];

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  const me = await wallet.getAddress();
  console.log("deployer :", me);
  console.log("treasury :", TREASURY);

  // ── Mint USDTMock ──
  const usdt = new Contract(USDT_MOCK, ERC20_ABI, wallet);
  let bal: bigint = await usdt.balanceOf(me);
  console.log(`USDT balance: ${bal} (target ${TARGET_USDT})`);
  while (bal < TARGET_USDT) {
    const tx = await usdt.mint(me, MINT_PER_CALL);
    await tx.wait();
    bal += MINT_PER_CALL;
    console.log(`  minted, now ${bal}`);
  }

  // ── Wrap into cUSDT ──
  const wrapper = new Contract(CUSDT, [...ERC20_ABI, ...WRAPPER_ABI], wallet);
  console.log("approving wrapper…");
  await (await usdt.approve(CUSDT, bal)).wait();
  console.log("wrapping…");
  await (await wrapper.wrap(me, bal)).wait();

  // ── Encrypted transfer to treasury ──
  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });

  const buf = fhe.createEncryptedInput(CUSDT, me);
  buf.add64(BigInt(TARGET_USDT));
  const { handles, inputProof } = await buf.encrypt();

  console.log(`confidentialTransfer ${TARGET_USDT} to treasury…`);
  const tx = await wrapper.confidentialTransfer(TREASURY, handles[0], inputProof);
  const r = await tx.wait();
  console.log(`✅ tx ${r?.hash}`);
  console.log("Treasury cUSDT seeded. Encrypted balance only visible to treasury contract.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
