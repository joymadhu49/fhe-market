// Deploy single-tx Faucet helper on Sepolia.
//
//   pnpm tsx scripts/deploy-faucet.ts
import { Wallet, JsonRpcProvider, ContractFactory } from "ethers";
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
const CUSDT = e("CUSDT_SEPOLIA");
const USDT = e("USDT_MOCK_SEPOLIA");

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  const me = await wallet.getAddress();
  console.log("deployer:", me);

  const artifact = JSON.parse(
    readFileSync(
      resolve(__dirname, "../artifacts/contracts/Faucet.sol/Faucet.json"),
      "utf8",
    ),
  );
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const faucet = await factory.deploy(USDT, CUSDT);
  await faucet.waitForDeployment();
  const addr = await faucet.getAddress();
  console.log("✅ Faucet:", addr);
  console.log(`\nNEXT_PUBLIC_FAUCET_ADDRESS=${addr}`);
  console.log(`Verify: pnpm hardhat verify --network sepolia ${addr} ${USDT} ${CUSDT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
