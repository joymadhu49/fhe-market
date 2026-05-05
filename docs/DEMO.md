# FHE Market — 3-minute demo script

Target length: **3:00** total. Read aloud at a steady pace. Each section header lists the on-screen action and approximate elapsed time.

Production tips:
- Record at 1920×1080. Browser zoom 100%, devtools closed.
- Pre-fund the demo wallet with ~10 cUSDT before recording so the bet flow doesn't stall on faucet.
- Use Sepolia, not local. Real signatures + live block explorer = real proof of work.
- Keep a second tab open on Sepolia Etherscan for the post-trade tx receipt screen.
- Cut the relayer wait (~30–60 s) with a hard scene cut, not a real-time pause. Add an "encrypted relayer wait — cut for time" caption.

---

## 0:00 — 0:15 · Cold open · The privacy hole

**On screen:** Polymarket leaderboard with wallet addresses + win/loss tallies visible.

> "Every prediction market today leaks who's betting what. Every wallet, every side, every dollar — searchable by anyone. That's a privacy hole, and it's a strategic one."

Cut to the FHE Market homepage hero (`/`).

> "FHE Market keeps the market public, but the positions private."

---

## 0:15 — 0:35 · The thesis · What stays public, what stays private

**On screen:** `/docs` page, scroll to the privacy table. Highlight rows.

> "Pool reserves, prices, market metadata — all public, because the bonding curve needs cleartext. But every per-user share balance is an `euint64` ciphertext under Zama FHEVM. Trade size is encrypted on input. Aggregate PnL stays encrypted on chain. Reveal is a local EIP-712 signature. Nothing leaves your device."

---

## 0:35 — 1:00 · The home screen · Live on Sepolia

**On screen:** `/` — markets grid, ticker, trending list.

> "Four live markets on Sepolia today. Settlement in cUSDT — confidential USDT, ERC-7984. The ticker pulls real CoinGecko prices. Click into a market…"

Click any market card.

---

## 1:00 — 1:50 · The 2-tx bet flow

**On screen:** `/market/<addr>` detail page. Wallet connected, ~$22 cUSDT.

> "Buy $1 of YES."

Type `1` in amount, click `BUY YES`. Wallet popup #1 = `setOperator` (only the first time per market).

> "First signature — give the market operator status on cUSDT. Cached after this."

Wallet popup #2 = `buyIntent`.

> "Second signature — submit the encrypted bet. The amount is wrapped in `euint64` before it leaves the browser."

**Step strip on the right** rotates: ENCRYPTING INPUT → SUBMITTING INTENT → WAITING FOR RELAYER. Hold here.

> "The Zama relayer publicly decrypts only the clamped transferred amount — never the user's running balance. Then…"

Wallet popup #3 = `executeBuy`. **Step strip:** EXECUTING SWAP → CONFIRMED.

> "Third signature applies the CPMM math. Pool reserves move; my YES share balance is incremented as a ciphertext."

---

## 1:50 — 2:15 · The encrypted position panel

**On screen:** Right column, `YOUR ENCRYPTED POSITION` block.

> "Here's my balance. Locked. The chain stores a ciphertext — there is no plaintext column anywhere."

Click `REVEAL`. Wallet shows EIP-712 typed data.

> "User-decrypt is gasless. I sign EIP-712 locally; the relayer hands me back the value; the page renders it."

Show the revealed YES share number.

> "RPC saw a ciphertext. The block explorer sees a ciphertext. Only this browser sees the cleartext."

---

## 2:15 — 2:40 · Portfolio + admin glance

**On screen:** `/portfolio`.

> "Portfolio aggregates positions across markets. Every row says `enc` until I sign to reveal."

Quick cut to `/admin` (already authed).

> "Operator surfaces: AI market creator wired to Claude Sonnet 4.5 via OpenRouter. Daily crypto markets — five coins, one button, auto-resolve from CoinGecko. Treasury collects the 1.5% protocol fee in cUSDT."

---

## 2:40 — 3:00 · Close · The submission ask

**On screen:** README on GitHub or Etherscan tab showing verified contracts.

> "Three contracts deployed and verified on Sepolia. Fifteen of fifteen FHEVM tests pass. Frontend live on Vercel. The whole stack is open source under MIT."

Cut to the homepage logo.

> "FHE Market — confidential prediction markets, on Zama. Built for Mainnet Season 2."

End card: GitHub URL + Vercel URL + wallet address for on-chain proof.

---

## On-screen captions (use these, sparingly)

- `0:35` — "Live on Sepolia · cUSDT (ERC-7984)"
- `1:05` — "1 / 3 · setOperator (cached after first bet)"
- `1:20` — "2 / 3 · buyIntent (encrypted input)"
- `1:35` — "Relayer publicDecrypt — cut for time"
- `1:45` — "3 / 3 · executeBuy (cleartext under FHE.checkSignatures)"
- `2:00` — "EIP-712 user-decrypt · gasless · local"

## Lower-third stack to show once

```
FHE Market
Confidential prediction markets · Zama FHEVM
Sepolia · cUSDT settlement · MIT
github.com/joymadhu49/fhe-market
fhe-market-lpei.vercel.app
```

## Voice-over tone

Calm, declarative. No hype words ("revolutionary", "next-gen"). Lead with what is true today on Sepolia, not what will exist on mainnet. Reviewers see hundreds of submissions; understatement plus on-chain proof reads as confidence.

## Cut list (if you go long)

- Drop the cold-open Polymarket reference (saves ~10 s).
- Skip the `/portfolio` cut, fold it into the admin shot.
- Trim the `/docs` privacy-table read to a single sentence.

## Hard fails to avoid

- Do not show `.env` or any private key on screen.
- Do not click `Connect Wallet` with a fresh wallet — pre-connect off-camera so the recording opens with the address visible.
- Do not narrate over wallet popups — the popup itself is the proof. Pause the voice-over while it's open.
