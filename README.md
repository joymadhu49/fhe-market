# FHE Market

> Confidential prediction markets on **Zama FHEVM** (Sepolia). Per-user share balances are end-to-end encrypted as `euint64` ciphertexts; settlement uses **cUSDT** (ERC-7984). Public liquidity, private positions.

Submission: **Zama Mainnet Season 2** — Builder track + OpenBuild APAC track.

---

## Why

Polymarket-style markets leak everything: every wallet's side, size, and PnL is on a public dashboard. That's a privacy hole and a strategic one — copy-trading whales is trivial, and wallets are forever linked to political/financial bets.

FHE Market keeps the same UX (binary YES/NO, CPMM odds, instant settle) but hides the parts that should be private. Pool reserves and prices stay public so the market still functions; per-user balances and trade sizes live as ciphertexts inside the contract.

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │  PredictionMarket  (per market)          │
                         │                                          │
   user wallet           │   yesReserve, noReserve   (uint64, pub)  │
       │                 │   yesShares[user]         (euint64, enc) │
       │ encrypt(amount) │   noShares[user]          (euint64, enc) │
       ├────────────────▶│                                          │
       │   buyIntent     │   makePubliclyDecryptable(intent)        │
       │                 └──────────────┬───────────────────────────┘
       │                                │
       │                                ▼
       │                  ┌──────────────────────────┐
       │                  │  Zama Relayer (10–60s)   │
       │                  │  publicDecrypt(handle)   │
       │                  └──────────────┬───────────┘
       │                                 │ cleartext + signatures
       │                                 ▼
       │                 ┌──────────────────────────────────────┐
       │ executeBuy(...) │  PredictionMarket.executeBuy         │
       ├────────────────▶│  FHE.checkSignatures + apply CPMM    │
                         └──────────────────────────────────────┘
```

**Why the 2-tx split:** FHE arithmetic is asymmetric — encrypted compares are cheap, but executing CPMM math on ciphertext bonding curves is not. Splitting into `intent` (encrypt + commit) and `execute` (apply cleartext under signature check) keeps trade size private up to the decryption oracle while letting the pool math run on cleartext reserves. The relayer is trustless: the contract verifies KMS signatures via `FHE.checkSignatures` before mutating state.

| Surface | Visibility |
|---|---|
| Pool reserves (yesReserve, noReserve) | Public — CPMM needs cleartext |
| Market metadata, YES/NO price | Public |
| Per-user share balances | **Encrypted** (`euint64`) |
| Per-user trade size | **Encrypted** (ciphertext input) |
| Aggregate PnL | **Encrypted** (client-decrypts via EIP-712) |

## Stack

| Layer | Tech |
|---|---|
| FHE primitives | [`@fhevm/solidity@0.11.1`](https://github.com/zama-ai/fhevm) |
| Hardhat plugin | [`@fhevm/hardhat-plugin@0.4.2`](https://github.com/zama-ai/fhevm-hardhat) |
| Relayer SDK | [`@zama-fhe/relayer-sdk@0.4.1`](https://github.com/zama-ai/relayer-sdk-js) (browser bundle) |
| Settlement | [cUSDT](https://sepolia.etherscan.io/address/0x4E7B06D78965594eB5EF5414c357ca21E1554491) — ERC-7984 confidential USDT |
| Contracts | Solidity 0.8.24 · viaIR enabled |
| Frontend | Next.js 16 (Turbopack) · React 19 · wagmi 2 · viem 2 · RainbowKit 2 |
| Network | Ethereum Sepolia (chainId 11155111) |

## Live (Sepolia)

| Contract | Address |
|---|---|
| MarketFactory | [`0x7b6e05731F77baD524cecd212663800B5e623D2B`](https://sepolia.etherscan.io/address/0x7b6e05731F77baD524cecd212663800B5e623D2B) |
| Treasury | [`0x8FDaD517892080D81B3A01d1e1873C63b0C7e819`](https://sepolia.etherscan.io/address/0x8FDaD517892080D81B3A01d1e1873C63b0C7e819) |
| Faucet | [`0x83D2B20D96e443f3fd7c248582d8Fd4A0Ab1124B`](https://sepolia.etherscan.io/address/0x83D2B20D96e443f3fd7c248582d8Fd4A0Ab1124B) |
| cUSDT (ERC-7984) | [`0x4E7B06D78965594eB5EF5414c357ca21E1554491`](https://sepolia.etherscan.io/address/0x4E7B06D78965594eB5EF5414c357ca21E1554491) |
| USDT mock | [`0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0`](https://sepolia.etherscan.io/address/0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0) |

All contracts are Etherscan-verified.

## Local development

Requires Node 20+, pnpm, and a Sepolia RPC + WalletConnect project.

```bash
pnpm install
cp .env.example .env                           # then fill in keys
pnpm compile                                   # hardhat compile (viaIR)
pnpm test                                      # 15 mocha tests, FHEVM mock runtime
pnpm dev                                       # Next.js on :3000
```

### Environment variables

```
PRIVATE_KEY=                                   # deployer (Sepolia)
ETHERSCAN_API_KEY=                             # contract verification
OPENROUTER_API_KEY=                            # /api/ai-market (admin AI creator)

NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_TREASURY_ADDRESS=
NEXT_PUBLIC_FAUCET_ADDRESS=
NEXT_PUBLIC_CUSDT_ADDRESS=
NEXT_PUBLIC_USDT_MOCK_ADDRESS=
NEXT_PUBLIC_ADMIN_ADDRESS=                     # operator wallet (gates /admin)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

### Deploy

```bash
pnpm deploy:sepolia                            # MarketFactory + Treasury + Faucet
pnpm verify:sepolia                            # Etherscan
```

`scripts/bootstrap-markets.ts` seeds three sample markets after deploy.

## Repo layout

```
contracts/
  MarketFactory.sol          create / resolve / cancel · owner = operator
  PredictionMarket.sol       per-market CPMM, encrypted share balances
  Treasury.sol               1.5% protocol fees, owner-only withdraw
  Faucet.sol                 single-tx mint+approve+wrap for demo UX
  interfaces/                ERC-7984 confidential token
scripts/
  deploy.ts                  factory + treasury + faucet
  deploy-faucet.ts           faucet only (idempotent)
  bootstrap-markets.ts       three seed markets
  seed-treasury.ts           top up treasury cUSDT
src/
  app/
    page.tsx                 home — market grid
    market/[address]/page.tsx
    portfolio/page.tsx       encrypted positions, EIP-712 user-decrypt
    leaderboard/page.tsx
    admin/page.tsx           gated metrics + creator + settlement queue
    docs/page.tsx
    api/ai-market/route.ts   OpenRouter proxy (server only)
  components/                Logo, Navbar, Ticker, FaucetButton, TreasuryPanel, …
  hooks/
    useBet.ts                buy/sell/claim 2-tx orchestration
    useEncryptedShares.ts    EIP-712 user-decrypt for YES/NO balances
    useCUSDTBalance.ts       reveal-on-demand cUSDT balance
    useFaucet.ts
    useMarkets.ts
  lib/
    fhevm.ts                 encryptU64, publicDecrypt, userDecryptU64
    chains.ts                Sepolia chain def
    wagmi-config.ts
    abi.ts                   factory + market + ERC-7984 ABIs
    cryptoMarkets.ts         daily-market builder + on-chain meta tag
    ai.ts                    AI proposal types + system prompt
```

## Tests

```
contracts/test/PredictionMarket.test.ts        15 tests · all pass
```

Coverage:

- intent → publicDecrypt → execute round-trip for buy and sell
- branchless oversell clamp (`FHE.le` + `FHE.select`)
- market resolution, claim, double-claim revert
- treasury fee accrual + owner-only withdraw
- factory access control
- cancellation refund path

## Threat model

- The relayer cannot lie: every public-decrypted handle ships with KMS signatures the contract verifies via `FHE.checkSignatures`.
- The operator cannot frontrun encrypted intent — the cleartext is only revealed after the relayer attests, and `executeBuy/executeSell` re-checks invariants before mutating reserves.
- Per-user share balances never leave the contract in cleartext. Reveal happens client-side via `userDecrypt` + EIP-712 signature; the RPC sees only ciphertexts.

## License

MIT
