/**
 * POST /api/ai-market
 *
 * Takes a free-form admin instruction + the latest coin-price snapshot from
 * the client and asks OpenRouter for a JSON market proposal.
 *
 * Server-side ONLY: OPENROUTER_API_KEY must not ship to the browser.
 */

import { NextRequest } from "next/server";
import {
  buildSystemPrompt,
  validateProposal,
  type AiMarketProposal,
  type AiMarketRequest,
  type AiMarketResponse,
} from "@/lib/ai";

// Node runtime (not edge) — keeps things simple for fetch + env.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json<AiMarketResponse>(
      {
        error:
          "OPENROUTER_API_KEY is not configured on the server. Add it to .env.local (see https://openrouter.ai/keys) and restart the dev server.",
      },
      501,
    );
  }

  let body: AiMarketRequest;
  try {
    body = (await req.json()) as AiMarketRequest;
  } catch {
    return json<AiMarketResponse>({ error: "Invalid JSON body." }, 400);
  }

  const instruction = (body?.instruction ?? "").trim();
  if (!instruction) {
    return json<AiMarketResponse>({ error: "instruction is required" }, 400);
  }
  if (instruction.length > 2000) {
    return json<AiMarketResponse>({ error: "instruction too long (max 2000 chars)" }, 400);
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const nowIso = new Date().toISOString();
  const system = buildSystemPrompt(nowIso, body.coinPrices ?? null);

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
      "X-Title": "FHE Market",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: instruction },
      ],
      // Not every model honours response_format; strict system prompt is the fallback.
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
    cache: "no-store",
  }).catch((e: unknown) => {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502 });
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return json<AiMarketResponse>(
      { error: `OpenRouter ${upstream.status}: ${text.slice(0, 500) || "upstream error"}` },
      502,
    );
  }

  let content: string | undefined;
  try {
    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = data?.choices?.[0]?.message?.content;
  } catch {
    return json<AiMarketResponse>({ error: "OpenRouter returned non-JSON response" }, 502);
  }

  if (!content) {
    return json<AiMarketResponse>({ error: "OpenRouter returned empty completion" }, 502);
  }

  const parsed = safeParseJson(content);
  if (!parsed) {
    return json<AiMarketResponse>(
      { error: "AI response was not valid JSON. Try again with a simpler instruction." },
      502,
    );
  }

  let proposal: AiMarketProposal;
  try {
    proposal = validateProposal(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json<AiMarketResponse>({ error: `Schema validation failed: ${msg}` }, 502);
  }

  return json<AiMarketResponse>({ proposal }, 200);
}

// ──────────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────────
function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Tolerant JSON parser — models sometimes wrap output in ```json fences. */
function safeParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  // strip ```json ... ``` or ``` ... ``` fences
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // last-ditch: find first { ... last }
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
