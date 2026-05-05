/**
 * Shared types + prompt helpers for the AI market creator.
 *
 * Imported by both the server route (`/api/ai-market`) and the client
 * component (`AiMarketCreator`) so the schema lives in one place.
 */

import type { CoinId, PriceMap } from "./coingecko";

/** Categories the AI is allowed to pick from (strip "All"). */
export const AI_CATEGORIES = [
  "Crypto",
  "Sports",
  "Politics",
  "Tech",
  "Entertainment",
] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];

/** The strict JSON shape we expect back from the AI. */
export interface AiMarketProposal {
  question: string;           // <=140 chars, ends with "?"
  description: string;        // 2-4 sentences, resolution criteria
  category: AiCategory;
  imageUrl: string;           // CoinGecko asset URL for crypto, else ""
  resolutionDays: number;     // 1-30
  crypto?: {
    coin: CoinId;
    startUsd: number;
    targetUsd: number;
  };
}

/** Request body the client POSTs to /api/ai-market. */
export interface AiMarketRequest {
  instruction: string;
  coinPrices: PriceMap | null;
}

/** Response body from /api/ai-market. */
export interface AiMarketResponse {
  proposal?: AiMarketProposal;
  error?: string;
}

/** Build the system prompt. `nowIso` is injected server-side each call. */
export function buildSystemPrompt(nowIso: string, coinPrices: PriceMap | null): string {
  const priceLines = coinPrices
    ? Object.entries(coinPrices)
        .map(([id, p]) => `- ${id}: $${p?.usd ?? "?"}`)
        .join("\n")
    : "- (no live prices available)";

  return `You are FHE Market's market-proposal engine. Given a free-form admin instruction,
you produce a JSON object describing a binary (YES/NO) prediction market.

CURRENT DATE (UTC): ${nowIso}

TRACKED CRYPTO COINS (id -> live USD spot):
${priceLines}

Valid category values: "Crypto" | "Sports" | "Politics" | "Tech" | "Entertainment".

JSON SCHEMA (return EXACTLY this shape, no extra keys, no markdown, no prose):
{
  "question": string,            // <=140 chars, MUST end with "?"
  "description": string,         // 2-4 sentences explaining objective resolution criteria
  "category": "Crypto"|"Sports"|"Politics"|"Tech"|"Entertainment",
  "imageUrl": string,            // CoinGecko asset URL for crypto markets, else ""
  "resolutionDays": number,      // integer 1..30 (days from now until resolution)
  "crypto": {                    // ONLY if category === "Crypto" AND instruction references a tracked coin above
    "coin": "bitcoin"|"ethereum"|"solana"|"ripple"|"binancecoin",
    "startUsd": number,          // MUST equal the live spot from the table above
    "targetUsd": number          // sensible target relative to startUsd (up-bet or down-bet)
  }
}

QUESTION-PHRASING (CRITICAL):
- DO NOT START EVERY QUESTION WITH "Will". Vary the opening across calls.
- Use diverse interrogative patterns. Acceptable openings include:
  "Can ...", "Does ...", "Has ...", "Is ...", "How likely ...", "By <date>, will ...",
  "Before <date>, ...?", "By the close of ...?", "Over/under ...?",
  declarative-then-question ("ETH closes above $4k by Dec 31?"),
  conditional ("If <X> happens, will ...?"), "Which ... first?", or strong noun-led
  framing ("Mainnet ship date before <Q>?", "BTC new ATH this cycle?").
- Mix sentence rhythm: short punchy headlines, journalistic phrasings, market-style
  "over/under" framings, and conditional bets. Aim for variety like a Polymarket /
  Kalshi front page rather than 50 identical "Will X happen by Y?" lines.
- Keep the question concrete and binary-resolvable; the source of truth still lives
  in "description".

RULES:
- Output PURE JSON. No backticks, no markdown, no commentary.
- If the instruction is vague, still return a valid proposal but MAKE the resolution criteria tight and objective (e.g. "according to CoinGecko spot price on <ISO date>").
- If the instruction mentions a coin not in the tracked list, still pick category="Crypto" but omit the "crypto" key and write the resolution source explicitly into "description".
- resolutionDays: map phrases like "today"->1, "this week"->7, "this month"->30. Default to 7 if unclear.
- For crypto targets, infer direction from the instruction ("hits", "above", "over" -> target > start; "below", "under", "drops to" -> target < start). If no direction given, assume +2% above start.
- Never invent dates in the past. Resolution is always in the future.
- imageUrl for crypto should be the CoinGecko logo: https://assets.coingecko.com/coins/images/<n>/large/<name>.png — use "" if you are not certain of the exact URL; the server will populate it.
`;
}

/** The 5 CoinGecko coin IDs we support in the `crypto` block. */
export const TRACKED_COIN_IDS: readonly CoinId[] = [
  "bitcoin",
  "ethereum",
  "solana",
  "ripple",
  "binancecoin",
] as const;

/** Narrow/validate an arbitrary parsed object into an `AiMarketProposal`. */
export function validateProposal(raw: unknown): AiMarketProposal {
  if (!raw || typeof raw !== "object") throw new Error("Not an object");
  const r = raw as Record<string, unknown>;

  const question = asStr(r.question, "question");
  if (question.length > 140) throw new Error("question > 140 chars");
  if (!question.trim().endsWith("?")) throw new Error("question must end with ?");

  const description = asStr(r.description, "description");
  const category = asStr(r.category, "category");
  if (!AI_CATEGORIES.includes(category as AiCategory)) {
    throw new Error(`category must be one of ${AI_CATEGORIES.join(",")}`);
  }

  const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl : "";
  const resolutionDays = Math.max(1, Math.min(30, Math.round(Number(r.resolutionDays ?? 7))));

  const out: AiMarketProposal = {
    question: question.trim(),
    description: description.trim(),
    category: category as AiCategory,
    imageUrl,
    resolutionDays,
  };

  if (r.crypto && typeof r.crypto === "object") {
    const c = r.crypto as Record<string, unknown>;
    const coin = asStr(c.coin, "crypto.coin");
    if (!TRACKED_COIN_IDS.includes(coin as CoinId)) {
      // ignore crypto block for untracked coins
      return out;
    }
    const startUsd = Number(c.startUsd);
    const targetUsd = Number(c.targetUsd);
    if (!Number.isFinite(startUsd) || !Number.isFinite(targetUsd)) {
      return out;
    }
    out.crypto = {
      coin: coin as CoinId,
      startUsd,
      targetUsd,
    };
  }

  return out;
}

function asStr(v: unknown, label: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${label} missing or not string`);
  return v;
}
