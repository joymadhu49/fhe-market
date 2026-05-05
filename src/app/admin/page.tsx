"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock3,
  Copy,
  ExternalLink,
  Flame,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";

import AdminGate from "@/components/AdminGate";
import { AiMarketCreator } from "@/components/AiMarketCreator";
import NetworkGate, { useChainGate } from "@/components/NetworkGate";
import TxBanner from "@/components/TxBanner";
import TreasuryPanel from "@/components/TreasuryPanel";
import { usePrices } from "@/components/PriceProvider";
import { useAllMarketAddresses, useMarketData } from "@/hooks/useMarkets";
import { ERC20_ABI, MARKET_FACTORY_ABI } from "@/lib/abi";
import { sepolia } from "@/lib/chains";
import { TRACKED_COINS, formatUsd, type PriceMap } from "@/lib/coingecko";
import {
  FACTORY_ADDRESS,
  PLATFORM_FEE_BPS,
  TREASURY_ADDRESS,
  CUSDT_ADDRESS,
} from "@/lib/constants";
import {
  buildCryptoQuestion,
  buildDailyMarket,
  parseCryptoDescription,
} from "@/lib/cryptoMarkets";
import { txErrorMessage } from "@/lib/errors";
import { fmtUSDCCompact, shortenAddress } from "@/lib/utils";
import type { MarketData } from "@/types";

type LoadedMarketEntry = {
  address: `0x${string}`;
  market: MarketData;
  totalPool: bigint;
};

const CAT_COLOR: Record<string, string> = {
  Crypto: "#3b82f6",
  Sports: "#f59e0b",
  Tech: "#22c55e",
  Politics: "#a855f7",
  Economy: "#2d9cdb",
  Entertainment: "#ef4444",
};

function catColor(c: string) {
  return CAT_COLOR[c] ?? "#8b96a5";
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function windowLabel(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function timeLeftShort(sec: number): string {
  const diff = sec * 1000 - Date.now();
  if (diff <= 0) return "Overdue";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

// ──────────────────────────────────────────────────────────────────────────
// Market loader (unchanged infra; fingerprinted to avoid infinite loops)
// ──────────────────────────────────────────────────────────────────────────
function MarketSnapshotLoader({
  address,
  onLoad,
}: {
  address: `0x${string}`;
  onLoad: (address: `0x${string}`, entry: LoadedMarketEntry | null) => void;
}) {
  const { market, totalPool, isLoading } = useMarketData(address);

  const fingerprint = market
    ? [
        market.question,
        market.category,
        market.resolved ? 1 : 0,
        market.outcome,
        market.resolutionTime,
        market.yesReserve.toString(),
        market.noReserve.toString(),
        (totalPool ?? 0n).toString(),
      ].join("|")
    : "";

  useEffect(() => {
    if (isLoading) return;
    onLoad(
      address,
      market
        ? { address, market, totalPool: totalPool ?? market.yesReserve + market.noReserve }
        : null,
    );
  }, [address, fingerprint, isLoading, market, onLoad, totalPool]);

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Metric card
// ──────────────────────────────────────────────────────────────────────────
function Metric({
  icon: Icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div className="label mb-2">{label}</div>
      <div className="mono text-[24px] font-semibold tracking-[-0.5px] text-[var(--k)] leading-[1.1]">
        {value}
      </div>
      <div className="mono text-[11px] text-[var(--g2)] mt-[6px]">{sub}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Ledger row
// ──────────────────────────────────────────────────────────────────────────
function LedgerRow({ entry, nowSec }: { entry: LoadedMarketEntry; nowSec: number }) {
  const fee = (entry.totalPool * BigInt(PLATFORM_FEE_BPS)) / 10000n;
  const status = entry.market.resolved
    ? entry.market.outcome === "CANCELLED"
      ? "Cancelled"
      : "Resolved"
    : entry.market.resolutionTime <= nowSec
      ? "Pending"
      : "Open";
  const statusColor =
    status === "Open" ? "#22c55e" : status === "Pending" ? "#f59e0b" : "#6b7280";

  return (
    <div
      className="grid items-center gap-[10px] px-6 py-[14px] border-t border-[var(--k)]"
      style={{ gridTemplateColumns: "1fr 100px 90px 100px 100px" }}
    >
      <Link
        href={`/market/${entry.address}`}
        className="text-[13px] text-[var(--k)] leading-[1.4] pr-[10px] line-clamp-2 hover:underline transition-colors"
        style={{ textWrap: "balance" }}
      >
        {entry.market.question}
      </Link>
      <div className="flex items-center gap-[7px]">
        <div className="w-[6px] h-[6px] rounded-full" style={{ background: catColor(entry.market.category) }} />
        <span className="text-[12px] text-[var(--k)]">{entry.market.category}</span>
      </div>
      <div className="flex items-center gap-[6px]">
        <div className="w-[6px] h-[6px] rounded-full" style={{ background: statusColor }} />
        <span className="text-[12px] text-[var(--k)]">{status}</span>
      </div>
      <div className="mono text-[12px] text-[var(--k)] text-right">{fmtUSDCCompact(entry.totalPool)}</div>
      <div className="mono text-[12px] text-[var(--g2)] text-right">{fmtUSDCCompact(fee)}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Queue card (per market, with auto-resolve for crypto markets)
// ──────────────────────────────────────────────────────────────────────────
function QueueCard({
  address,
  prices,
  onDone,
  disabled,
  nowSec,
}: {
  address: `0x${string}`;
  prices: PriceMap | null;
  onDone: () => void;
  disabled: boolean;
  nowSec: number;
}) {
  const { market, refetch } = useMarketData(address);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState<"yes" | "no" | "cancel" | "auto" | null>(null);

  if (!market) return null;
  const meta = parseCryptoDescription(market.description);
  const due = market.resolutionTime <= nowSec;
  const livePrice = meta && prices?.[meta.coin]?.usd;
  const predictedYes = meta && livePrice ? livePrice > meta.targetUsd : undefined;
  const pool = market.yesReserve + market.noReserve;

  async function send(label: "yes" | "no" | "cancel" | "auto", run: () => Promise<`0x${string}`>) {
    setPending(label);
    const id = `q-${label}-${address}`;
    try {
      toast.loading("Sending…", { id });
      const hash = await run();
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Confirmed on-chain", { id });
      refetch();
      onDone();
    } catch (e) {
      toast.error(txErrorMessage(e), { id });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-[4px] border border-[var(--k)] bg-[var(--g0)] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link
          href={`/market/${address}`}
          className="text-[13px] font-medium text-[var(--k)] leading-[1.4] flex-1 line-clamp-2 hover:underline transition-colors"
          style={{ textWrap: "balance" }}
        >
          {market.question}
        </Link>
        {due && !market.resolved && (
          <span className="mono text-[9px] font-bold text-[#f59e0b] shrink-0" style={{ letterSpacing: "0.16em" }}>
            ● DUE
          </span>
        )}
        {market.resolved && (
          <span className="mono text-[9px] font-bold text-[var(--g2)] shrink-0" style={{ letterSpacing: "0.16em" }}>
            ● {market.outcome}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-[7px]">
          <div className="w-[6px] h-[6px] rounded-full" style={{ background: catColor(market.category) }} />
          <span className="text-[12px] text-[var(--k)]">{market.category}</span>
        </div>
        <div className="mono text-[11px] text-[var(--g2)] flex items-center gap-[5px]">
          <Clock3 className="h-[11px] w-[11px]" />
          {timeLeftShort(market.resolutionTime)}
        </div>
        <div className="mono text-[11px] text-[var(--g2)] ml-auto">{fmtUSDCCompact(pool)} pool</div>
      </div>

      {meta && !market.resolved && (
        <div className="flex items-center justify-between gap-3 py-[10px] px-3 mb-3 border-t border-b border-[var(--k)]">
          <div className="flex items-baseline gap-2">
            <span className="mono label">Live</span>
            <span className="mono text-[13px] font-semibold text-[var(--k)]">
              {livePrice ? formatUsd(livePrice) : "—"}
            </span>
            <ArrowRight className="h-[10px] w-[10px] text-[var(--g2)]" />
            <span
              className="mono text-[13px] font-semibold"
              style={{ color: predictedYes === undefined ? "#6b7280" : predictedYes ? "#22c55e" : "#ef4444" }}
            >
              {formatUsd(meta.targetUsd)}
            </span>
          </div>
          <button
            onClick={() =>
              send("auto", () =>
                writeContractAsync({
                  address: FACTORY_ADDRESS,
                  abi: MARKET_FACTORY_ABI,
                  functionName: "resolveMarket",
                  args: [address, !!predictedYes],
                }),
              )
            }
            disabled={!!pending || predictedYes === undefined || disabled}
            className="mono flex items-center gap-1 px-2 py-[4px] text-[10px] font-bold tracking-[0.12em] disabled:opacity-40"
            style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
          >
            {pending === "auto" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            AUTO-RESOLVE
          </button>
        </div>
      )}

      {!market.resolved && (
        <div className="grid grid-cols-3 gap-[6px]">
          <button
            onClick={() =>
              send("yes", () =>
                writeContractAsync({
                  address: FACTORY_ADDRESS,
                  abi: MARKET_FACTORY_ABI,
                  functionName: "resolveMarket",
                  args: [address, true],
                }),
              )
            }
            disabled={!!pending || disabled}
            className="flex items-center justify-center gap-1 rounded-[3px] border border-[#22c55e]/35 bg-transparent py-[8px] text-[11px] font-semibold text-[#22c55e] transition-colors hover:bg-[#22c55e]/10 disabled:opacity-40"
            style={{ letterSpacing: "0.08em" }}
          >
            {pending === "yes" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            YES won
          </button>
          <button
            onClick={() =>
              send("no", () =>
                writeContractAsync({
                  address: FACTORY_ADDRESS,
                  abi: MARKET_FACTORY_ABI,
                  functionName: "resolveMarket",
                  args: [address, false],
                }),
              )
            }
            disabled={!!pending || disabled}
            className="flex items-center justify-center gap-1 rounded-[3px] border border-[#ef4444]/35 bg-transparent py-[8px] text-[11px] font-semibold text-[#ef4444] transition-colors hover:bg-[#ef4444]/10 disabled:opacity-40"
            style={{ letterSpacing: "0.08em" }}
          >
            {pending === "no" ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            NO won
          </button>
          <button
            onClick={() =>
              send("cancel", () =>
                writeContractAsync({
                  address: FACTORY_ADDRESS,
                  abi: MARKET_FACTORY_ABI,
                  functionName: "cancelMarket",
                  args: [address],
                }),
              )
            }
            disabled={!!pending || disabled}
            className="flex items-center justify-center gap-1 rounded-[3px] border border-[var(--k)] bg-transparent py-[8px] text-[11px] font-semibold text-[var(--g2)] transition-colors hover:text-[var(--k)] hover:border-[var(--k)] disabled:opacity-40"
            style={{ letterSpacing: "0.08em" }}
          >
            {pending === "cancel" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Daily crypto markets creator
// ──────────────────────────────────────────────────────────────────────────
function DailyCreator({
  prices,
  onCreated,
  disabled,
  onError,
  treasuryBalance,
  seedPerMarket,
  onTreasuryRefetch,
}: {
  prices: PriceMap | null;
  onCreated: () => void;
  disabled: boolean;
  onError: (msg: string | null) => void;
  treasuryBalance: bigint | undefined;
  seedPerMarket: bigint | undefined;
  onTreasuryRefetch: () => void;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);

  // Pre-flight: how many daily markets can the treasury currently seed?
  const affordable =
    treasuryBalance !== undefined && seedPerMarket !== undefined && seedPerMarket > 0n
      ? Number(treasuryBalance / seedPerMarket)
      : undefined;

  async function createOne(coinId: (typeof TRACKED_COINS)[number]["id"]) {
    onError(null);
    const coin = TRACKED_COINS.find((c) => c.id === coinId)!;
    const price = prices?.[coinId]?.usd;
    if (!price) {
      const msg = "Price unavailable — refresh prices first.";
      onError(msg);
      toast.error(msg);
      return;
    }
    if (seedPerMarket !== undefined && treasuryBalance !== undefined && treasuryBalance < seedPerMarket) {
      const msg = `Treasury has ${(Number(treasuryBalance) / 1e6).toFixed(2)} cUSDT but this market needs ${(Number(seedPerMarket) / 1e6).toFixed(2)} cUSDT seed. Top up the treasury first.`;
      onError(msg);
      toast.error(msg);
      return;
    }
    setBusy(coinId);
    try {
      const m = buildDailyMarket(coin, price);
      toast.loading(`Creating ${coin.symbol} 24h market…`, { id: `m-${coinId}` });
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: MARKET_FACTORY_ABI,
        functionName: "createMarket",
        args: [m.question, m.description, m.category, m.imageUrl, m.resolutionTime],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`${coin.symbol} market created`, { id: `m-${coinId}` });
      onTreasuryRefetch();
      onCreated();
    } catch (e) {
      const msg = txErrorMessage(e);
      onError(msg);
      toast.error(msg, { id: `m-${coinId}` });
    } finally {
      setBusy(null);
    }
  }

  async function createAll() {
    onError(null);

    // Filter coins that have prices (ready to launch)
    const launchable = TRACKED_COINS.filter((c) => prices?.[c.id]?.usd !== undefined);
    if (launchable.length === 0) {
      const msg = "No coin prices available — refresh prices first.";
      onError(msg);
      toast.error(msg);
      return;
    }

    // Pre-flight treasury balance check — fail loudly BEFORE any tx if underfunded.
    if (seedPerMarket !== undefined && treasuryBalance !== undefined) {
      const need = BigInt(launchable.length) * seedPerMarket;
      if (treasuryBalance < need) {
        const haveNum = Number(treasuryBalance) / 1e6;
        const needNum = Number(need) / 1e6;
        const canDo = Number(treasuryBalance / seedPerMarket);
        const msg =
          `Treasury has ${haveNum.toFixed(2)} cUSDT but ${launchable.length} markets need ${needNum.toFixed(2)} cUSDT. ` +
          `Can only launch ${canDo} — top up the treasury or reduce the seed via factory.setDefaultSeedLiquidity.`;
        onError(msg);
        toast.error(msg);
        return;
      }
    }

    setBusy("all");
    const results: { sym: string; ok: boolean; err?: string }[] = [];

    for (const c of launchable) {
      const price = prices?.[c.id]?.usd;
      if (!price) continue;
      const m = buildDailyMarket(c, price);
      toast.loading(`Creating ${c.symbol}… (${results.length + 1}/${launchable.length})`, { id: "m-all" });
      try {
        const hash = await writeContractAsync({
          address: FACTORY_ADDRESS,
          abi: MARKET_FACTORY_ABI,
          functionName: "createMarket",
          args: [m.question, m.description, m.category, m.imageUrl, m.resolutionTime],
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        results.push({ sym: c.symbol, ok: true });
      } catch (e) {
        // Don't abort on a single failure — keep going so remaining coins still get a chance.
        results.push({ sym: c.symbol, ok: false, err: txErrorMessage(e) });
      }
    }

    const ok = results.filter((r) => r.ok).map((r) => r.sym);
    const fail = results.filter((r) => !r.ok);

    if (fail.length === 0) {
      toast.success(`All ${ok.length} daily markets created`, { id: "m-all" });
    } else if (ok.length === 0) {
      const msg = `Failed all ${fail.length} markets. First error: ${fail[0].err}`;
      onError(msg);
      toast.error(msg, { id: "m-all" });
    } else {
      const msg = `Created ${ok.join(", ")}. Failed: ${fail.map((f) => f.sym).join(", ")}. First error: ${fail[0].err}`;
      onError(msg);
      toast.error(msg, { id: "m-all" });
    }

    onTreasuryRefetch();
    onCreated();
    setBusy(null);
  }

  return (
    <div className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--k)]">
            <Flame className="h-4 w-4 text-[#f59e0b]" /> Daily crypto markets
          </h3>
          <div className="mono text-[11px] text-[var(--g2)] mt-[3px]">
            {TRACKED_COINS.length} above-target prompts · 24h resolve
            {affordable !== undefined && seedPerMarket !== undefined && (
              <>
                {" · "}
                <span style={{ color: affordable >= TRACKED_COINS.length ? "#22c55e" : affordable === 0 ? "#ef4444" : "#f59e0b" }}>
                  treasury can seed {affordable}/{TRACKED_COINS.length} @ {(Number(seedPerMarket) / 1e6).toFixed(0)} cUSDT
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={createAll}
          disabled={!!busy || !prices || disabled}
          className="mono flex items-center gap-1.5 rounded-none px-3 py-[8px] text-[11px] font-bold tracking-[0.12em] disabled:opacity-50"
          style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
        >
          {busy === "all" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          LAUNCH ALL {TRACKED_COINS.length}
        </button>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${TRACKED_COINS.length}, minmax(0, 1fr))` }}
      >
        {TRACKED_COINS.map((coin) => {
          const price = prices?.[coin.id]?.usd;
          const target = price ? price * 1.02 : null;
          return (
            <button
              key={coin.id}
              onClick={() => createOne(coin.id)}
              disabled={!!busy || !price || disabled}
              className="rounded-[4px] border border-[var(--k)] bg-[var(--g0)] px-3 py-[14px] text-left transition-colors hover:border-[var(--k)] disabled:opacity-40"
            >
              <div className="text-[12px] font-semibold text-[var(--k)] mb-[10px]">{coin.symbol}</div>
              <div className="mono text-[13px] font-medium text-[var(--k)]">
                {price ? formatUsd(price) : "—"}
              </div>
              <div className="flex items-center gap-[5px] mt-[4px]">
                <ArrowRight className="h-[10px] w-[10px] text-[var(--g2)]" />
                <span className="mono text-[11px] font-bold" style={{ color: coin.color ?? "var(--k)" }}>
                  {target ? formatUsd(target) : "—"}
                </span>
                {busy === coin.id && <Loader2 className="h-3 w-3 animate-spin ml-auto" style={{ color: "var(--k)" }} />}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 mono label">
        Targets set +2% above CoinGecko spot · auto-resolvable 24h after creation
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Custom market form
// ──────────────────────────────────────────────────────────────────────────
function CustomCreator({
  onCreated,
  disabled,
  onError,
}: {
  onCreated: () => void;
  disabled: boolean;
  onError: (msg: string | null) => void;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [form, setForm] = useState({
    question: "",
    description: "",
    category: "Crypto",
    imageUrl: "",
    resolutionDays: "7",
  });
  const [creating, setCreating] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setCreating(true);
    try {
      toast.loading("Creating market…", { id: "create" });
      const days = Number(form.resolutionDays);
      if (!Number.isFinite(days) || days < 1) {
        throw new Error("Resolution must be at least 1 day in the future.");
      }
      const resolutionTime = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: MARKET_FACTORY_ABI,
        functionName: "createMarket",
        args: [form.question, form.description, form.category, form.imageUrl, resolutionTime],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Market created", { id: "create" });
      setForm({ question: "", description: "", category: "Crypto", imageUrl: "", resolutionDays: "7" });
      onCreated();
    } catch (e) {
      const msg = txErrorMessage(e);
      onError(msg);
      toast.error(msg, { id: "create" });
    } finally {
      setCreating(false);
    }
  }

  const inputCls =
    "w-full rounded-none border-2 border-[var(--k)] bg-[var(--g0)] px-3 py-[10px] text-[13px] text-[var(--k)] placeholder-[var(--g2)] focus:bg-[var(--w)] focus:outline-none";

  return (
    <form onSubmit={submit} className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-5">
      <h3 className="text-[14px] font-semibold text-[var(--k)] mb-4">Custom market</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mono label block mb-[6px]">Question</label>
          <input
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            required
            placeholder="Will BTC close above $200,000 on Dec 31, 2026?"
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className="mono label block mb-[6px]">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
            placeholder="Resolution criteria…"
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <label className="mono label block mb-[6px]">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputCls}
          >
            {["Crypto", "Sports", "Politics", "Tech", "Entertainment", "Economy"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mono label block mb-[6px]">Resolves in (days)</label>
          <input
            type="number"
            min="1"
            value={form.resolutionDays}
            onChange={(e) => setForm({ ...form, resolutionDays: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className="mono label block mb-[6px]">Image URL</label>
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://…"
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button
          type="submit"
          disabled={creating || disabled}
          className="mono flex items-center gap-1.5 rounded-none px-4 py-[10px] text-[11px] font-bold tracking-[0.12em] disabled:opacity-50"
          style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
        >
          {creating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> CREATING…
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> CREATE MARKET
            </>
          )}
        </button>
      </div>
    </form>
  );
}


// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const { address } = useAccount();
  const { wrongChain, isConnected } = useChainGate();
  const { data: addresses, isLoading, refetch } = useAllMarketAddresses();
  const { prices, loading: loadingPrices, error: pricesError, refresh: loadPrices } = usePrices();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, LoadedMarketEntry | null>>({});
  const [nowSec, setNowSec] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "treasury" | "settlement" | "create">("overview");

  const { data: onChainOwner } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: MARKET_FACTORY_ABI,
    functionName: "owner",
    query: {
      enabled: !!FACTORY_ADDRESS && FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const { data: onChainTreasury } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: MARKET_FACTORY_ABI,
    functionName: "treasury",
    query: {
      enabled: !!FACTORY_ADDRESS && FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const treasuryAddress = ((onChainTreasury as `0x${string}` | undefined) ?? TREASURY_ADDRESS) as `0x${string}`;

  // Treasury cUSDT balance is encrypted (ERC-7984). The admin can user-decrypt
  // their own treasury holding off-chain via the cUSDT contract; the in-page
  // balance display is intentionally left blank.
  const treasuryBalance: bigint | undefined = undefined;
  const refetchTreasuryBalance = async () => {};

  const { data: defaultSeedLiquidity } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: MARKET_FACTORY_ABI,
    functionName: "defaultSeedLiquidity",
    query: {
      enabled: !!FACTORY_ADDRESS && FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const ownerMismatch = useMemo(() => {
    if (!isConnected || !address || !onChainOwner) return false;
    return (onChainOwner as string).toLowerCase() !== address.toLowerCase();
  }, [address, isConnected, onChainOwner]);

  useEffect(() => {
    if (pricesError && !prices) {
      toast.error(`CoinGecko: ${pricesError.message}`, { id: "cg-err" });
    }
  }, [pricesError, prices]);

  useEffect(() => {
    const syncNow = () => setNowSec(Math.floor(Date.now() / 1000));
    syncNow();
    const timer = window.setInterval(syncNow, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLoad = useCallback((marketAddress: `0x${string}`, entry: LoadedMarketEntry | null) => {
    setEntries((prev) => {
      const existing = prev[marketAddress];
      if (!existing && !entry) return prev;
      if (!existing || !entry) return { ...prev, [marketAddress]: entry };
      if (
        existing.totalPool === entry.totalPool &&
        existing.market.question === entry.market.question &&
        existing.market.category === entry.market.category &&
        existing.market.resolved === entry.market.resolved &&
        existing.market.outcome === entry.market.outcome &&
        existing.market.resolutionTime === entry.market.resolutionTime &&
        existing.market.yesReserve === entry.market.yesReserve &&
        existing.market.noReserve  === entry.market.noReserve
      ) {
        return prev;
      }
      return { ...prev, [marketAddress]: entry };
    });
  }, []);

  const sortedAddrs = useMemo(() => (addresses ? [...addresses].reverse() : []), [addresses]);

  const loadedEntries = useMemo(
    () =>
      sortedAddrs
        .map((a) => entries[a])
        .filter((item): item is LoadedMarketEntry => !!item),
    [entries, sortedAddrs],
  );

  const totalVolume = useMemo(
    () => loadedEntries.reduce((acc, e) => acc + e.totalPool, 0n),
    [loadedEntries],
  );
  const openEntries = useMemo(() => loadedEntries.filter((e) => !e.market.resolved), [loadedEntries]);
  const resolvedEntries = useMemo(() => loadedEntries.filter((e) => e.market.resolved), [loadedEntries]);
  const dueEntries = useMemo(
    () => loadedEntries.filter((e) => !e.market.resolved && e.market.resolutionTime <= nowSec + 86400),
    [loadedEntries, nowSec],
  );
  const overdueCount = useMemo(
    () => loadedEntries.filter((e) => !e.market.resolved && e.market.resolutionTime <= nowSec).length,
    [loadedEntries, nowSec],
  );
  const openVolume = useMemo(() => openEntries.reduce((acc, e) => acc + e.totalPool, 0n), [openEntries]);
  const estimatedFees = useMemo(() => (totalVolume * BigInt(PLATFORM_FEE_BPS)) / 10000n, [totalVolume]);
  const largestMarket = useMemo(() => {
    if (loadedEntries.length === 0) return null;
    return [...loadedEntries].sort((a, b) => Number(b.totalPool - a.totalPool))[0];
  }, [loadedEntries]);

  const categoryMix = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const entry of loadedEntries) {
      totals.set(entry.market.category, (totals.get(entry.market.category) ?? 0n) + entry.totalPool);
    }
    return [...totals.entries()].sort((a, b) => Number(b[1] - a[1])).slice(0, 4);
  }, [loadedEntries]);

  const cycleStart = new Date();
  cycleStart.setDate(1);
  cycleStart.setHours(0, 0, 0, 0);
  const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 0);
  const daysInCycle = cycleEnd.getDate();
  const cycleDay = new Date().getDate();
  const cycleProgress = (cycleDay / daysInCycle) * 100;

  const writesDisabled = !isConnected || wrongChain || ownerMismatch;
  const resolvedShare = loadedEntries.length === 0 ? 0 : (resolvedEntries.length / loadedEntries.length) * 100;
  const feeCaptureShare = totalVolume === 0n ? 0 : (Number(estimatedFees) / Number(totalVolume)) * 100;
  const settlementsShare = loadedEntries.length === 0 ? 0 : (dueEntries.length / loadedEntries.length) * 100;

  const copyAddress = (addr: string, label: string) => {
    navigator.clipboard.writeText(addr);
    toast.success(`${label} copied`);
  };
  const explorerUrl = (addr: string) => `${sepolia.blockExplorers.default.url}/address/${addr}`;

  const tabs: Array<typeof activeTab> = ["overview", "treasury", "settlement", "create"];
  const onTabClick = (t: typeof activeTab) => {
    setActiveTab(t);
    const el = document.getElementById(`admin-${t}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {sortedAddrs.map((a) => (
        <MarketSnapshotLoader key={a} address={a} onLoad={handleLoad} />
      ))}

      {/* Hero */}
      <div className="px-4 sm:px-6 lg:px-8 pt-9 pb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-[10px] mb-3">
              <Shield className="h-[18px] w-[18px] text-[var(--g2)]" />
              <span className="mono label">Admin · Operator only</span>
            </div>
            <h1 className="m-0 text-[28px] font-semibold tracking-[-0.8px] text-[var(--k)] mb-2">
              Protocol operations
            </h1>
            <p className="m-0 text-[13.5px] leading-[1.55] text-[var(--g2)] max-w-[560px]">
              Live treasury metrics, market exposure, pending resolutions, and creation tools.
            </p>
          </div>
          <div className="flex gap-[2px] p-[3px] rounded-[4px] border border-[var(--k)] bg-[var(--w)]">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => onTabClick(t)}
                className="px-[14px] py-[7px] rounded-[3px] text-[12px] font-medium capitalize cursor-pointer transition-colors"
                style={{
                  background: activeTab === t ? "var(--k)" : "transparent",
                  color: activeTab === t ? "var(--y)" : "var(--g2)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-8 pt-[18px] border-t border-[var(--k)] flex-wrap">
          {[
            { k: "Fee model", v: `${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`, sub: "Flat · per pool" },
            { k: "Settlement rail", v: "cUSDT", sub: "Sepolia" },
            { k: "Current cycle", v: `${windowLabel(cycleStart)} – ${windowLabel(cycleEnd)}`, sub: `Day ${cycleDay} of ${daysInCycle}` },
          ].map((i) => (
            <div key={i.k} className="flex flex-col gap-[3px]">
              <span className="mono label">{i.k}</span>
              <div className="mono text-[14px] text-[var(--k)] font-medium mt-[2px]">{i.v}</div>
              <div className="mono text-[11px] text-[var(--g2)]">{i.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 space-y-[14px] pb-10">
        <div className="space-y-2">
          <NetworkGate />
          {isConnected && !wrongChain && ownerMismatch && (
            <TxBanner
              tone="warning"
              message="This wallet is not the on-chain factory owner."
              hint={`Factory owner: ${shortenAddress(onChainOwner as string)} · Connected: ${shortenAddress(
                address ?? "",
              )}. createMarket / resolve / cancel will revert.`}
            />
          )}
          {bannerError && <TxBanner message={bannerError} onDismiss={() => setBannerError(null)} />}
        </div>

        {/* Metrics */}
        <div id="admin-overview" className="grid gap-[12px] grid-cols-1 md:grid-cols-2 xl:grid-cols-4 scroll-mt-[72px]">
          <Metric
            icon={Wallet}
            accent="#22c55e"
            label="Treasury balance"
            value={treasuryBalance ? fmtUSDCCompact(treasuryBalance as bigint) : "—"}
            sub={`cUSDT · ${shortenAddress(treasuryAddress)}`}
          />
          <Metric
            icon={Landmark}
            accent="#3b82f6"
            label="Est. protocol fees"
            value={fmtUSDCCompact(estimatedFees)}
            sub="Cycle-to-date capture"
          />
          <Metric
            icon={BarChart3}
            accent="#f59e0b"
            label="Open notional"
            value={fmtUSDCCompact(openVolume)}
            sub={`${openEntries.length} unresolved markets`}
          />
          <Metric
            icon={Clock3}
            accent="#a855f7"
            label="Settlement queue"
            value={String(dueEntries.length)}
            sub={`${overdueCount} overdue · due ≤24h`}
          />
        </div>

        {/* Protocol overview + treasury */}
        <div id="admin-treasury" className="grid gap-[14px] xl:grid-cols-[1.35fr_1fr] scroll-mt-[72px]">
          <section className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--k)]">Protocol overview</h3>
              <button
                onClick={loadPrices}
                disabled={loadingPrices}
                className="mono text-[11px] text-[var(--g2)] hover:text-[var(--k)] transition-colors flex items-center gap-[5px]"
              >
                <RefreshCw className={`h-3 w-3 ${loadingPrices ? "animate-spin" : ""}`} />
                Refresh prices
              </button>
            </div>
            <div className="flex flex-col gap-4 mb-5">
              {[
                {
                  label: "Cycle usage",
                  value: cycleProgress,
                  color: "#3b82f6",
                  right: `${cycleDay} / ${daysInCycle} days`,
                },
                {
                  label: "Resolved market coverage",
                  value: resolvedShare,
                  color: "#22c55e",
                  right: `${resolvedEntries.length} / ${loadedEntries.length}`,
                },
                {
                  label: "Protocol fee capture",
                  value: feeCaptureShare,
                  color: "#2d9cdb",
                  right: `${fmtUSDCCompact(estimatedFees)} on ${fmtUSDCCompact(totalVolume)}`,
                },
                {
                  label: "Settlements due",
                  value: settlementsShare,
                  color: "#f59e0b",
                  right: `${dueEntries.length} live · ${overdueCount} overdue`,
                },
              ].map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[12px] text-[var(--k)]">{b.label}</span>
                    <div className="flex gap-3 items-baseline">
                      <span className="mono text-[11px] text-[var(--g2)]">{b.right}</span>
                      <span className="mono text-[12px] text-[var(--k)] font-medium min-w-[36px] text-right">
                        {pct(clamp(b.value))}
                      </span>
                    </div>
                  </div>
                  <div className="h-[4px] rounded-full overflow-hidden bg-[var(--g1)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${clamp(b.value)}%`, background: b.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 pt-[18px] border-t border-[var(--k)]">
              {[
                { label: "Fee rule", v: `${(PLATFORM_FEE_BPS / 100).toFixed(2)}% flat`, sub: "Per market pool" },
                { label: "Payout path", v: "cUSDT · instant", sub: "Sepolia settlement" },
                { label: "Market-maker readiness", v: "UI ready", sub: "Rebates module pending" },
              ].map((t, i) => (
                <div
                  key={t.label}
                  className="px-4"
                  style={{
                    paddingLeft: i === 0 ? 0 : 16,
                    borderLeft: i === 0 ? "none" : "1px solid var(--g1)",
                  }}
                >
                  <div className="mono label mb-[5px]">{t.label}</div>
                  <div className="mono text-[13px] text-[var(--k)] font-medium">{t.v}</div>
                  <div className="mono text-[10px] text-[var(--g2)] mt-[2px]">{t.sub}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-6">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--k)] mb-5">Treasury & risk</h3>

            <div className="flex flex-col gap-[14px] mb-5">
              <div className="flex justify-between items-center">
                <div>
                  <div className="mono label mb-[4px]">Treasury address</div>
                  <div className="mono text-[13px] text-[var(--k)]">{shortenAddress(treasuryAddress)}</div>
                </div>
                <div className="flex gap-[4px]">
                  <button
                    onClick={() => copyAddress(treasuryAddress, "Treasury")}
                    className="w-[28px] h-[28px] rounded-[3px] border border-[var(--k)] text-[var(--g2)] flex items-center justify-center hover:text-[var(--k)] hover:border-[var(--k)] transition-colors"
                    aria-label="Copy treasury"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <a
                    href={explorerUrl(treasuryAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-[28px] h-[28px] rounded-[3px] border border-[var(--k)] text-[var(--g2)] flex items-center justify-center hover:text-[var(--k)] hover:border-[var(--k)] transition-colors"
                    aria-label="Open in explorer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex justify-between items-center pt-[14px] border-t border-[var(--k)]">
                <div>
                  <div className="mono label mb-[4px]">Admin authority</div>
                  <div className="mono text-[13px] text-[var(--k)]">
                    {onChainOwner ? shortenAddress(onChainOwner as string) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-[6px]">
                  <div
                    className="w-[6px] h-[6px] rounded-full"
                    style={{ background: ownerMismatch ? "#ef4444" : "#22c55e" }}
                  />
                  <span className="mono text-[11px] text-[var(--g2)]">
                    {ownerMismatch ? "Mismatch" : isConnected ? "Active" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>

            <div className="py-[16px] border-t border-[var(--k)]">
              <TreasuryPanel treasuryAddress={treasuryAddress} />
            </div>

            <div className="py-[16px] border-t border-[var(--k)]">
              <div className="mono label mb-2">Largest market</div>
              {largestMarket ? (
                <>
                  <Link
                    href={`/market/${largestMarket.address}`}
                    className="text-[13px] text-[var(--k)] leading-[1.4] mb-[6px] block hover:underline transition-colors line-clamp-2"
                  >
                    {largestMarket.market.question}
                  </Link>
                  <div className="flex items-baseline gap-2">
                    <span className="mono text-[16px] font-semibold text-[var(--k)]">
                      {fmtUSDCCompact(largestMarket.totalPool)}
                    </span>
                    <span className="mono text-[11px] text-[var(--g2)]">
                      pool · est. {fmtUSDCCompact((largestMarket.totalPool * BigInt(PLATFORM_FEE_BPS)) / 10000n)} fees
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-[12px] text-[var(--g2)]">No market data yet.</div>
              )}
            </div>

            <div className="pt-[16px] border-t border-[var(--k)]">
              <div className="mono label mb-[10px]">Category mix</div>
              {categoryMix.length === 0 ? (
                <div className="text-[12px] text-[var(--g2)]">No category data yet.</div>
              ) : (
                <>
                  <div className="flex h-[4px] rounded-full overflow-hidden mb-3 bg-[var(--g1)]">
                    {categoryMix.map(([cat, total]) => {
                      const share = totalVolume === 0n ? 0 : Number((total * 10000n) / totalVolume) / 100;
                      return (
                        <div
                          key={cat}
                          style={{ width: `${share}%`, background: catColor(cat) }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    {categoryMix.map(([cat, total]) => {
                      const share = totalVolume === 0n ? 0 : (Number(total) / Number(totalVolume)) * 100;
                      return (
                        <div key={cat} className="flex items-center gap-[10px] text-[12px]">
                          <div
                            className="w-[6px] h-[6px] rounded-full"
                            style={{ background: catColor(cat) }}
                          />
                          <span className="text-[var(--k)]">{cat}</span>
                          <span className="mono text-[var(--g2)] ml-auto">{pct(share)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Ledger + notes */}
        <div id="admin-settlement" className="grid gap-[14px] xl:grid-cols-[1.5fr_1fr] scroll-mt-[72px]">
          <section className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] overflow-hidden">
            <div className="flex items-baseline justify-between px-6 pt-5 pb-4">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--k)]">Market ledger</h3>
              <span className="mono label">Top 6 by pool</span>
            </div>
            <div
              className="mono text-[10px] uppercase text-[var(--g2)] grid gap-[10px] px-6 pb-[10px]"
              style={{ gridTemplateColumns: "1fr 100px 90px 100px 100px", letterSpacing: "0.14em" }}
            >
              <span>Question</span>
              <span>Category</span>
              <span>Status</span>
              <span className="text-right">Volume</span>
              <span className="text-right">Est. fee</span>
            </div>
            {isLoading && loadedEntries.length === 0 ? (
              <div className="flex items-center justify-center py-14 border-t border-[var(--k)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--k)]" />
              </div>
            ) : loadedEntries.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[var(--g2)] border-t border-[var(--k)]">
                No markets yet — launch the first batch below.
              </div>
            ) : (
              loadedEntries
                .slice()
                .sort((a, b) => Number(b.totalPool - a.totalPool))
                .slice(0, 6)
                .map((entry) => <LedgerRow key={entry.address} entry={entry} nowSec={nowSec} />)
            )}
          </section>

          <section className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-6">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--k)] mb-5">Operator notes</h3>
            <div className="flex flex-col gap-4">
              {[
                {
                  title: "Market-first layout",
                  body: "Operator surfaces mirror the trader view so context switches stay cheap. Ledger rows share density with the public feed.",
                },
                {
                  title: "Treasury mapping",
                  body: "Protocol fees accrue to the treasury address pulled live from the factory. cUSDT settles in the same unit users trade.",
                },
                {
                  title: "Same surface language",
                  body: "Admin uses the same palette and type as the public app — gradient CTAs flag protocol-control paths only.",
                },
              ].map((n, i) => (
                <div
                  key={n.title}
                  style={{ paddingTop: i === 0 ? 0 : 16, borderTop: i === 0 ? "none" : "1px solid var(--g1)" }}
                >
                  <div className="text-[13px] font-semibold text-[var(--k)] mb-[6px]">{n.title}</div>
                  <div className="text-[12px] text-[var(--g2)] leading-[1.55]">{n.body}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Operator actions */}
        <div id="admin-create" className="scroll-mt-[72px]">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="m-0 text-[16px] font-semibold text-[var(--k)] tracking-[-0.3px]">Operator actions</h2>
            <span className="mono text-[11px] text-[var(--g2)]">
              Writes {writesDisabled ? "disabled" : "enabled"} · signature required
            </span>
          </div>
          <div className="grid gap-[14px] xl:grid-cols-[1.1fr_1fr] items-stretch">
            <div className="flex flex-col gap-[14px]">
              <AiMarketCreator
                prices={prices}
                onCreated={refetch}
                disabled={writesDisabled}
                onError={setBannerError}
              />
              <DailyCreator
                prices={prices}
                onCreated={refetch}
                disabled={writesDisabled}
                onError={setBannerError}
                treasuryBalance={treasuryBalance as bigint | undefined}
                seedPerMarket={defaultSeedLiquidity as bigint | undefined}
                onTreasuryRefetch={refetchTreasuryBalance}
              />
              <CustomCreator
                onCreated={refetch}
                disabled={writesDisabled}
                onError={setBannerError}
              />
            </div>
            <div className="rounded-[4px] border border-[var(--k)] bg-[var(--w)] p-6 h-full">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="m-0 text-[14px] font-semibold text-[var(--k)]">Settlement queue</h3>
                  <div className="mono text-[11px] text-[var(--g2)] mt-[3px]">
                    {sortedAddrs.length} markets · {overdueCount} overdue · {dueEntries.length} due ≤24h
                  </div>
                </div>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--k)]" />
                </div>
              ) : sortedAddrs.length === 0 ? (
                <div className="rounded-[4px] border border-dashed border-[var(--k)] py-10 text-center text-[13px] text-[var(--g2)]">
                  No markets yet — launch your first daily batch on the left.
                </div>
              ) : (
                <div className="flex flex-col gap-[10px] max-h-[900px] overflow-y-auto pr-[2px]">
                  {sortedAddrs.map((a) => (
                    <QueueCard
                      key={a}
                      address={a}
                      prices={prices}
                      onDone={refetch}
                      disabled={writesDisabled}
                      nowSec={nowSec}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

void buildCryptoQuestion;

// Default export wraps the dashboard in AdminGate. AdminGate hides every
// admin metric + control until the server has verified a signed-message
// session from the configured admin wallet.
export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}
