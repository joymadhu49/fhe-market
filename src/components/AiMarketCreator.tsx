"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle } from "lucide-react";

import { FACTORY_ADDRESS } from "@/lib/constants";
import { MARKET_FACTORY_ABI } from "@/lib/abi";
import type { PriceMap } from "@/lib/coingecko";
import { COIN_BY_ID, formatUsd } from "@/lib/coingecko";
import {
  buildCryptoDescription,
  type CryptoMarketMeta,
} from "@/lib/cryptoMarkets";
import type {
  AiMarketProposal,
  AiMarketRequest,
  AiMarketResponse,
} from "@/lib/ai";
import { txErrorMessage } from "@/lib/errors";

const QUICK_EXAMPLES = [
  "Will SOL close above $280 by end of week?",
  "Make a market on whether Bitcoin hits $150k this month",
  "Create a market for whether the Lakers win their next game in 3 days",
];

export function AiMarketCreator({
  prices,
  onCreated,
  disabled = false,
  onError,
}: {
  prices: PriceMap | null;
  onCreated: () => void;
  disabled?: boolean;
  onError?: (msg: string | null) => void;
}) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [instruction, setInstruction] = useState("");
  const [thinking, setThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AiMarketProposal | null>(null);

  const [editQuestion, setEditQuestion] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDays, setEditDays] = useState(7);
  const [editImageUrl, setEditImageUrl] = useState("");

  async function propose(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Type an instruction first.");
      return;
    }
    setError(null);
    setThinking(true);
    try {
      const payload: AiMarketRequest = { instruction: trimmed, coinPrices: prices };
      const res = await fetch("/api/ai-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as AiMarketResponse;
      if (!res.ok || !data.proposal) {
        throw new Error(data.error || `API ${res.status}`);
      }
      const p = data.proposal;
      setProposal(p);
      setEditQuestion(p.question);
      setEditDescription(p.description);
      setEditDays(p.resolutionDays);
      setEditImageUrl(p.imageUrl || (p.crypto ? coinImage(p.crypto.coin) : ""));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setProposal(null);
    } finally {
      setThinking(false);
    }
  }

  async function confirm() {
    if (!proposal) return;
    onError?.(null);
    setSubmitting(true);
    try {
      toast.loading("Creating market…", { id: "ai-create" });

      const nowSec = Math.floor(Date.now() / 1000);
      const resolutionTime = BigInt(nowSec + Math.round(editDays * 86_400));

      let description = editDescription;
      let imageUrl = editImageUrl.trim();

      if (proposal.crypto) {
        const coin = COIN_BY_ID[proposal.crypto.coin];
        const meta: CryptoMarketMeta = {
          type: "crypto_1d",
          coin: proposal.crypto.coin,
          startUsd: round2(proposal.crypto.startUsd),
          targetUsd: round2(proposal.crypto.targetUsd),
          createdAt: nowSec,
        };
        const encoded = buildCryptoDescription(meta);
        description = editDescription
          ? `${editDescription}\n\n${encoded}`
          : encoded;
        if (!imageUrl) imageUrl = coinImage(coin.id);
      }

      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: MARKET_FACTORY_ABI,
        functionName: "createMarket",
        args: [editQuestion, description, proposal.category, imageUrl, resolutionTime],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      toast.success("Market created", { id: "ai-create" });
      setProposal(null);
      setInstruction("");
      setEditQuestion("");
      setEditDescription("");
      setEditDays(7);
      setEditImageUrl("");
      onCreated();
    } catch (e: unknown) {
      const msg = txErrorMessage(e);
      setError(msg);
      onError?.(msg);
      toast.error(msg, { id: "ai-create" });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-none border-2 border-[var(--k)] bg-[var(--g0)] px-3 py-2.5 text-[13px] text-[var(--k)] placeholder-[var(--g2)] focus:bg-[var(--w)] focus:outline-none";

  return (
    <div className="p-5" style={{ background: "var(--w)", border: "2px solid var(--k)" }}>
      <div className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center"
          style={{ width: 22, height: 22, background: "var(--y)", border: "2px solid var(--k)" }}
        >
          <Sparkles className="h-3 w-3" style={{ color: "var(--k)" }} />
        </span>
        <h3 className="text-[14px] font-semibold" style={{ color: "var(--k)" }}>AI market creator</h3>
        <span
          className="mono ml-auto px-2 py-[2px] text-[10px] font-bold tracking-[0.14em]"
          style={{ background: "var(--k)", color: "var(--y)" }}
        >
          BETA
        </span>
      </div>

      {!proposal && (
        <>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            placeholder="Describe the market you want to create — e.g. 'Will SOL close above $280 by end of week?' or 'Make a market on whether Bitcoin hits $150k this month'."
            className={`${inputCls} resize-none`}
          />

          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstruction(ex)}
                disabled={thinking}
                className="rounded-none border-2 border-[var(--k)] bg-[var(--w)] px-[10px] py-[4px] text-[11px] font-medium text-[var(--k)] hover:bg-[var(--y)] disabled:opacity-50 transition-colors"
              >
                {truncate(ex, 50)}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="mt-3 flex items-start gap-2 px-3 py-2 text-[11.5px]"
              style={{ background: "var(--w)", border: "2px solid var(--red)", color: "var(--red)" }}
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--g2)" }}>
              AUTO-DETECT CATEGORY · SUGGEST SOURCE
            </span>
            <button
              onClick={() => propose(instruction)}
              disabled={thinking || !instruction.trim() || disabled}
              className="mono flex items-center justify-center gap-1.5 rounded-none px-4 py-[9px] text-[11px] font-bold tracking-[0.12em] disabled:opacity-50 transition-opacity"
              style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
            >
              {thinking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> THINKING…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> GENERATE WITH AI
                </>
              )}
            </button>
          </div>
        </>
      )}

      {proposal && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className="mono px-[8px] py-[3px] text-[10px] font-bold tracking-[0.14em]"
              style={{ background: "var(--k)", color: "var(--w)" }}
            >
              {proposal.category.toUpperCase()}
            </span>
            {proposal.crypto && (
              <span
                className="mono px-[8px] py-[3px] text-[10px] font-bold tracking-[0.1em]"
                style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
              >
                {COIN_BY_ID[proposal.crypto.coin].symbol} {formatUsd(proposal.crypto.startUsd)} → {formatUsd(proposal.crypto.targetUsd)}
              </span>
            )}
          </div>

          <div>
            <label className="mb-1 block mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--g2)" }}>QUESTION</label>
            <input
              value={editQuestion}
              onChange={(e) => setEditQuestion(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--g2)" }}>DESCRIPTION</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className="mb-1 block mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--g2)" }}>IMAGE URL</label>
            <div className="flex gap-2">
              {editImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editImageUrl}
                  alt=""
                  onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                  onLoad={(ev) => { (ev.currentTarget as HTMLImageElement).style.visibility = "visible"; }}
                  className="h-10 w-10 object-cover"
                  style={{ border: "2px solid var(--k)", background: "var(--g0)" }}
                />
              )}
              <input
                type="url"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://… (optional)"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--g2)" }}>RESOLVES IN (DAYS)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={editDays}
              onChange={(e) => setEditDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className={inputCls}
            />
          </div>

          {error && (
            <div
              className="flex items-start gap-2 px-3 py-2 text-[11.5px]"
              style={{ background: "var(--w)", border: "2px solid var(--red)", color: "var(--red)" }}
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={confirm}
              disabled={submitting || !editQuestion.trim() || !editDescription.trim() || disabled}
              className="mono flex flex-1 items-center justify-center gap-2 rounded-none py-[10px] text-[11px] font-bold tracking-[0.12em] disabled:opacity-50"
              style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> CREATING…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> CONFIRM &amp; CREATE
                </>
              )}
            </button>
            <button
              onClick={() => propose(instruction)}
              disabled={thinking || submitting}
              className="mono flex items-center gap-1.5 rounded-none px-3 py-[10px] text-[10px] font-bold tracking-[0.12em] disabled:opacity-50"
              style={{ background: "var(--w)", color: "var(--k)", border: "2px solid var(--k)" }}
            >
              {thinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              REGEN
            </button>
            <button
              onClick={() => {
                setProposal(null);
                setError(null);
              }}
              disabled={submitting}
              className="mono rounded-none px-3 py-[10px] text-[10px] font-bold tracking-[0.12em] disabled:opacity-50"
              style={{ background: "var(--w)", color: "var(--g2)", border: "2px solid var(--g1)" }}
            >
              DISCARD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function coinImage(id: import("@/lib/coingecko").CoinId): string {
  const map: Record<string, string> = {
    bitcoin: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    ethereum: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    solana: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    ripple: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
    binancecoin: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  };
  return map[id] ?? "";
}
