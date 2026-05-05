import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

const fhevm = (hre as any).fhevm;

const SEED = 1_000_000n; // 1 cUSDT (6 decimals)
const ALICE_FUND = 100_000_000n; // 100 cUSDT
const HOUR = 3600;

async function encrypt64(contract: string, user: string, amount: bigint) {
  const input = fhevm.createEncryptedInput(contract, user);
  input.add64(amount);
  return input.encrypt();
}

async function userDecryptShares(market: any, user: any, isYes: boolean): Promise<bigint> {
  const handle = isYes
    ? await market.yesSharesHandle(user.address)
    : await market.noSharesHandle(user.address);
  if (handle === ethers.ZeroHash) return 0n;
  return await fhevm.userDecryptEuint(
    FhevmType.euint64,
    handle,
    await market.getAddress(),
    user,
  );
}

async function publicDecryptHandle(handle: string): Promise<{ value: bigint; proof: string }> {
  const result = await fhevm.publicDecrypt([handle]);
  return {
    value: BigInt(result.clearValues[handle]),
    proof: result.decryptionProof,
  };
}

async function deployFixture() {
  const [deployer, alice, bob, charlie] = await ethers.getSigners();

  const Mock = await ethers.getContractFactory("MockConfidentialUSDT");
  const cUSDT = await Mock.deploy();
  await cUSDT.waitForDeployment();

  const Factory = await ethers.getContractFactory("MarketFactory");
  const factory = await Factory.deploy(await cUSDT.getAddress(), deployer.address);
  await factory.waitForDeployment();

  const treasuryAddr = await factory.treasury();

  // Mint cUSDT to treasury (so it can seed markets) + to participants.
  await cUSDT.mint(treasuryAddr, 1_000_000_000n); // 1000 cUSDT
  await cUSDT.mint(alice.address, ALICE_FUND);
  await cUSDT.mint(bob.address, ALICE_FUND);
  await cUSDT.mint(charlie.address, ALICE_FUND);

  return { cUSDT, factory, treasuryAddr, deployer, alice, bob, charlie };
}

async function createMarket(factory: any, deployer: any, resolutionOffset = HOUR * 24) {
  const resolutionTime = (await ethers.provider.getBlock("latest"))!.timestamp + resolutionOffset;
  const tx = await factory
    .connect(deployer)
    .createMarketWithSeed(
      "Will ETH > $5000 by year end?",
      "Resolves yes if ETH/USD > 5000 on the closing price 2026-12-31.",
      "crypto",
      "https://example.com/eth.png",
      resolutionTime,
      SEED,
    );
  const receipt = await tx.wait();
  const log = receipt!.logs.find((l: any) => {
    try {
      return factory.interface.parseLog(l)?.name === "MarketCreated";
    } catch {
      return false;
    }
  });
  const parsed = factory.interface.parseLog(log!);
  const marketAddr: string = parsed!.args[0];
  const market = await ethers.getContractAt("PredictionMarket", marketAddr);
  return { market, marketAddr, resolutionTime };
}

async function setOperator(cUSDT: any, user: any, target: string) {
  const future = (await ethers.provider.getBlock("latest"))!.timestamp + HOUR * 48;
  await cUSDT.connect(user).setOperator(target, future);
}

async function fullBuy(market: any, cUSDT: any, user: any, isYes: boolean, amount: bigint, minOut: bigint = 0n) {
  await setOperator(cUSDT, user, await market.getAddress());
  const enc = await encrypt64(await market.getAddress(), user.address, amount);
  await market.connect(user).buyIntent(isYes, enc.handles[0], enc.inputProof, minOut);
  const handle = await market.pendingBuyHandle(user.address);
  const { value, proof } = await publicDecryptHandle(handle);
  await market.connect(user).executeBuy(user.address, value, proof);
  return value;
}

async function fullSell(market: any, user: any, isYes: boolean, shares: bigint, minOut: bigint = 0n) {
  const enc = await encrypt64(await market.getAddress(), user.address, shares);
  await market.connect(user).sellIntent(isYes, enc.handles[0], enc.inputProof, minOut);
  const handle = await market.pendingSellHandle(user.address);
  const { value, proof } = await publicDecryptHandle(handle);
  await market.connect(user).executeSell(user.address, value, proof);
  return value;
}

async function fullClaim(market: any, user: any) {
  await market.connect(user).claimIntent();
  const handle = await market.pendingClaimHandle(user.address);
  const { value, proof } = await publicDecryptHandle(handle);
  await market.connect(user).executeClaim(user.address, value, proof);
  return value;
}

describe("PredictionMarket (FHEVM)", () => {
  it("creates a market with correct seeded reserves", async () => {
    const { factory, deployer } = await deployFixture();
    const { market } = await createMarket(factory, deployer);
    expect(await market.yesReserve()).to.equal(SEED);
    expect(await market.noReserve()).to.equal(SEED);
    expect(await market.cUSDTHeld()).to.equal(SEED);
    expect(await market.totalPool()).to.equal(SEED * 2n);
  });

  it("buy YES preserves CPMM invariant k (within ceiling-rounding tolerance)", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    const yOld = await market.yesReserve();
    const nOld = await market.noReserve();
    const kOld = yOld * nOld;

    await fullBuy(market, cUSDT, alice, true, 100_000n);

    const yNew = await market.yesReserve();
    const nNew = await market.noReserve();
    const kNew = yNew * nNew;
    // ceilDiv on the new YES reserve guarantees kNew >= kOld (no LP value loss).
    expect(kNew).to.be.gte(kOld);
  });

  it("user-decrypts their YES share balance after buy", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    const amount = 200_000n;
    await fullBuy(market, cUSDT, alice, true, amount);

    const sharesAlice = await userDecryptShares(market, alice, true);
    expect(sharesAlice).to.be.gt(0n);
    // Net amount > sharesOut > net (since YES side gets net + Δy where Δy > 0).
    const fee = (amount * 150n) / 10_000n;
    const net = amount - fee;
    expect(sharesAlice).to.be.gte(net);
  });

  it("YES odds shift toward YES after a buy YES", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    const oddsBefore = await market.yesOdds(); // 0.5e18
    await fullBuy(market, cUSDT, alice, true, 200_000n);
    const oddsAfter = await market.yesOdds();
    expect(oddsAfter).to.be.gt(oddsBefore);
  });

  it("sell intent then execute: shares burned, cUSDT received", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 500_000n);
    const sharesBefore = await userDecryptShares(market, alice, true);
    expect(sharesBefore).to.be.gt(0n);

    // Sell half.
    const sellShares = sharesBefore / 2n;
    await fullSell(market, alice, true, sellShares);

    const sharesAfter = await userDecryptShares(market, alice, true);
    expect(sharesAfter).to.equal(sharesBefore - sellShares);
  });

  it("sell more shares than balance: branchlessly clamped to 0, no payout", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 100_000n);
    const sharesBefore = await userDecryptShares(market, alice, true);

    // Try to sell 100x the balance.
    const cleartextSold = await fullSell(market, alice, true, sharesBefore * 100n);
    expect(cleartextSold).to.equal(0n);

    const sharesAfter = await userDecryptShares(market, alice, true);
    expect(sharesAfter).to.equal(sharesBefore); // unchanged
  });

  it("claim YES-winner pays cUSDT equal to encrypted YES balance", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 1_000_000n);
    const yesShares = await userDecryptShares(market, alice, true);

    await factory.connect(deployer).resolveMarket(await market.getAddress(), true);

    const balBefore = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await cUSDT.confidentialBalanceOf(alice.address),
      await cUSDT.getAddress(),
      alice,
    );

    const claimAmount = await fullClaim(market, alice);
    expect(claimAmount).to.equal(yesShares);

    const balAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await cUSDT.confidentialBalanceOf(alice.address),
      await cUSDT.getAddress(),
      alice,
    );
    expect(balAfter - balBefore).to.equal(yesShares);

    // Cannot double-claim.
    await expect(market.connect(alice).claimIntent()).to.be.revertedWithCustomError(
      market,
      "AlreadyClaimed",
    );
  });

  it("claim NO-loser receives 0 (no winning shares)", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    // Alice bets NO. Market resolves YES → her NO is worthless.
    await fullBuy(market, cUSDT, alice, false, 500_000n);
    await factory.connect(deployer).resolveMarket(await market.getAddress(), true);

    const claimAmount = await fullClaim(market, alice);
    expect(claimAmount).to.equal(0n);
  });

  it("cancelled market refunds total YES + NO position", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 200_000n);
    await fullBuy(market, cUSDT, alice, false, 300_000n);

    const yShares = await userDecryptShares(market, alice, true);
    const nShares = await userDecryptShares(market, alice, false);
    const expectedRefund = yShares + nShares;

    await factory.connect(deployer).cancelMarket(await market.getAddress());

    const claimAmount = await fullClaim(market, alice);
    expect(claimAmount).to.equal(expectedRefund);
  });

  it("buy reverts after market resolves", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await factory.connect(deployer).resolveMarket(await market.getAddress(), true);

    await setOperator(cUSDT, alice, await market.getAddress());
    const enc = await encrypt64(await market.getAddress(), alice.address, 100_000n);
    await expect(
      market.connect(alice).buyIntent(true, enc.handles[0], enc.inputProof, 0n),
    ).to.be.revertedWithCustomError(market, "MarketClosed");
  });

  it("claim before resolution reverts", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 100_000n);
    await expect(market.connect(alice).claimIntent()).to.be.revertedWithCustomError(
      market,
      "NotResolved",
    );
  });

  it("two pending buys at once are blocked (PendingActive)", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await setOperator(cUSDT, alice, await market.getAddress());
    const e1 = await encrypt64(await market.getAddress(), alice.address, 100_000n);
    await market.connect(alice).buyIntent(true, e1.handles[0], e1.inputProof, 0n);

    const e2 = await encrypt64(await market.getAddress(), alice.address, 100_000n);
    await expect(
      market.connect(alice).buyIntent(true, e2.handles[0], e2.inputProof, 0n),
    ).to.be.revertedWithCustomError(market, "PendingActive");
  });

  it("multi-user buys: independent encrypted balances", async () => {
    const { factory, cUSDT, deployer, alice, bob } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 300_000n);
    await fullBuy(market, cUSDT, bob, false, 400_000n);

    const aliceY = await userDecryptShares(market, alice, true);
    const aliceN = await userDecryptShares(market, alice, false);
    const bobY   = await userDecryptShares(market, bob, true);
    const bobN   = await userDecryptShares(market, bob, false);

    expect(aliceY).to.be.gt(0n);
    expect(aliceN).to.equal(0n);
    expect(bobN).to.be.gt(0n);
    expect(bobY).to.equal(0n);
  });

  it("treasury fee accounting: market cUSDTHeld grows by net (amountIn - fee)", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    const heldBefore: bigint = await market.cUSDTHeld();
    const amount = 1_000_000n;
    await fullBuy(market, cUSDT, alice, true, amount);

    const heldAfter: bigint = await market.cUSDTHeld();
    const expectedFee = (amount * 150n) / 10_000n;
    // Market received `amount` then forwarded `fee` to treasury → net = amount - fee.
    expect(heldAfter - heldBefore).to.equal(amount - expectedFee);
  });

  it("withdrawResidual sweeps cUSDTHeld to zero post-resolve", async () => {
    const { factory, cUSDT, deployer, alice } = await deployFixture();
    const { market } = await createMarket(factory, deployer);

    await fullBuy(market, cUSDT, alice, true, 500_000n);
    await factory.connect(deployer).resolveMarket(await market.getAddress(), true);

    const heldBefore: bigint = await market.cUSDTHeld();
    expect(heldBefore).to.be.gt(0n);

    await factory.connect(deployer).reclaimResidual(await market.getAddress());
    expect(await market.cUSDTHeld()).to.equal(0n);
  });
});
