/**
 * Daily (24h) crypto price markets.
 *
 * A market's on-chain `description` field holds human-readable copy plus a
 * machine-readable tag appended on the last line:
 *
 *   FHE MARKET:{"type":"crypto_1d","coin":"bitcoin","startUsd":60000,"targetUsd":61200,"createdAt":1730000000}
 *
 * The admin resolve-bot parses this tag, fetches the live CoinGecko price at
 * resolutionTime (24h after creation), and resolves YES (above target) or
 * NO (at-or-below target).
 */

import { COIN_BY_ID, CoinId, CoinMeta, formatUsd, TRACKED_COINS } from "./coingecko";

export const CRYPTO_MARKET_TAG = "FHE MARKET:";

/** One day in seconds. */
export const ONE_DAY_SECONDS = 86_400;

/** Default "will price go up by X% in 24 hours?" target bump. */
export const DEFAULT_TARGET_BUMP_PCT = 2; // +2% from start

export interface CryptoMarketMeta {
  type:       "crypto_1d";
  coin:       CoinId;
  startUsd:   number;
  targetUsd:  number;
  createdAt:  number;   // unix seconds
}

/** Build the full `description` string that gets stored on-chain. */
export function buildCryptoDescription(meta: CryptoMarketMeta): string {
  const coin = COIN_BY_ID[meta.coin];
  const human =
    `Resolves YES if ${coin.name} (${coin.symbol}) trades above ` +
    `${formatUsd(meta.targetUsd)} on CoinGecko at market resolution time ` +
    `(24 hours after creation). Spot price at creation: ${formatUsd(meta.startUsd)}. ` +
    `Auto-resolved by the FHE Market admin at end of day using the CoinGecko spot price.`;
  return `${human}\n\n${CRYPTO_MARKET_TAG}${JSON.stringify(meta)}`;
}

/** Return the encoded meta if the description has a valid FHE MARKET tag, else null. */
export function parseCryptoDescription(description: string): CryptoMarketMeta | null {
  if (!description) return null;
  const idx = description.lastIndexOf(CRYPTO_MARKET_TAG);
  if (idx < 0) return null;
  const json = description.slice(idx + CRYPTO_MARKET_TAG.length).trim();
  try {
    const parsed = JSON.parse(json);
    if (parsed?.type !== "crypto_1d") return null;
    if (typeof parsed.coin !== "string" || !(parsed.coin in COIN_BY_ID)) return null;
    if (typeof parsed.startUsd  !== "number") return null;
    if (typeof parsed.targetUsd !== "number") return null;
    return parsed as CryptoMarketMeta;
  } catch {
    return null;
  }
}

/** Build the question string shown on the card / modal. */
export function buildCryptoQuestion(meta: CryptoMarketMeta): string {
  const coin = COIN_BY_ID[meta.coin];
  return `Will ${coin.symbol} close above ${formatUsd(meta.targetUsd)} in 24 hours?`;
}

/** Pre-filled market payload for one coin, using a live price snapshot. */
export function buildDailyMarket(coin: CoinMeta, currentUsd: number, bumpPct = DEFAULT_TARGET_BUMP_PCT) {
  const now = Math.floor(Date.now() / 1000);
  const targetUsd = round2(currentUsd * (1 + bumpPct / 100));
  const meta: CryptoMarketMeta = {
    type:      "crypto_1d",
    coin:      coin.id,
    startUsd:  round2(currentUsd),
    targetUsd,
    createdAt: now,
  };
  return {
    question:       buildCryptoQuestion(meta),
    description:    buildCryptoDescription(meta),
    category:       "Crypto",
    imageUrl:       coinImage(coin.id),
    resolutionTime: BigInt(now + ONE_DAY_SECONDS),
    meta,
  };
}

/** CoinGecko-hosted logo — stable, no hot-linking concerns. */
function coinImage(id: CoinId): string {
  const map: Record<CoinId, string> = {
    bitcoin:     "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    ethereum:    "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    solana:      "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    ripple:      "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
    binancecoin: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  };
  return map[id];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { TRACKED_COINS };
