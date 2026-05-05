// Deploys MarketFactory (+ Treasury via constructor) to Sepolia, points it at
// the canonical Sepolia cUSDT (ERC-7984), and prints the addresses to wire
// into .env / Vercel.
//
//   pnpm hardhat run scripts/deploy.ts --network sepolia
//
// Treasury seeding is a separate step because cUSDT transfers are encrypted —
// run scripts/seed-treasury.ts after this.
import { ethers } from "hardhat";

const CUSDT_SEPOLIA = process.env.CUSDT_SEPOLIA ?? "0x4E7B06D78965594eB5EF5414c357ca21E1554491";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deploying with:", deployer.address);
  console.log("Sepolia ETH:   ", ethers.formatEther(balance));
  console.log("cUSDT:         ", CUSDT_SEPOLIA);

  console.log("\nDeploying MarketFactory…");
  const MarketFactory = await ethers.getContractFactory("MarketFactory");
  const factory = await MarketFactory.deploy(CUSDT_SEPOLIA, deployer.address);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("✅ MarketFactory:", factoryAddr);

  const treasuryAddr = await factory.treasury();
  console.log("✅ Treasury:     ", treasuryAddr);

  const seed = await factory.defaultSeedLiquidity();
  console.log(`Default seed: ${(Number(seed) / 1e6).toFixed(2)} cUSDT per market`);

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Add to .env / NEXT_PUBLIC_*:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddr}`);
  console.log(`NEXT_PUBLIC_TREASURY_ADDRESS=${treasuryAddr}`);
  console.log("────────────────────────────────────────────────────────────");
  console.log("\nNext steps:");
  console.log(`  1) pnpm hardhat verify --network sepolia ${factoryAddr} ${CUSDT_SEPOLIA} ${deployer.address}`);
  console.log(`  2) Seed treasury with cUSDT (see scripts/seed-treasury.ts)`);
  console.log(`  3) Create sample markets via the /admin UI or scripts/bootstrap-markets.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
