"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAllMarketAddresses, useMarketData } from "@/hooks/useMarkets";
import MarketCard from "@/components/MarketCard";
import { CATEGORIES, Category } from "@/lib/constants";
import { usePrices } from "@/components/PriceProvider";
import { parseCryptoDescription } from "@/lib/cryptoMarkets";
import { fmtUSDCCompact } from "@/lib/utils";
import { MarketData } from "@/types";
import PixelDebris from "@/components/ui/PixelDebris";
import Btn from "@/components/ui/Btn";
import Chip from "@/components/ui/Chip";
import SqDot from "@/components/ui/SqDot";
import SectionHead from "@/components/ui/SectionHead";

type SortKey = "trending" | "new" | "closing";

interface MarketEntry {
  address: `0x${string}`;
  market: MarketData;
  totalPool?: bigint;
  yesOdds?: bigint;
  noOdds?: bigint;
}

function MarketLoader({
  address,
  onLoad,
}: {
  address: `0x${string}`;
  onLoad: (addr: `0x${string}`, entry: MarketEntry | null) => void;
}) {
  const { market, yesOdds, noOdds, totalPool, isLoading } = useMarketData(address);
  const fingerprint = market
    ? [
        market.question,
        market.resolved ? 1 : 0,
        market.outcome ?? "",
        market.resolutionTime,
        (yesOdds ?? 0n).toString(),
        (noOdds ?? 0n).toString(),
        (totalPool ?? 0n).toString(),
      ].join("|")
    : "";

  useEffect(() => {
    if (isLoading) return;
    onLoad(address, market ? { address, market, yesOdds, noOdds, totalPool } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, address, fingerprint, onLoad]);

  return null;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [sort, setSort] = useState<SortKey>("trending");
  const [search, setSearch] = useState("");
  const { prices } = usePrices();
  const { data: addresses, isLoading } = useAllMarketAddresses();

  const [entries, setEntries] = useState<Record<string, MarketEntry | null>>({});

  const handleLoad = useCallback((addr: `0x${string}`, entry: MarketEntry | null) => {
    setEntries((prev) => {
      const existing = prev[addr];
      if (!existing && !entry) return prev;
      if (!existing || !entry) return { ...prev, [addr]: entry };
      if (
        existing.totalPool === entry.totalPool &&
        existing.yesOdds === entry.yesOdds &&
        existing.noOdds === entry.noOdds &&
        existing.market.resolved === entry.market.resolved &&
        existing.market.outcome === entry.market.outcome &&
        existing.market.resolutionTime === entry.market.resolutionTime &&
        existing.market.question === entry.market.question
      ) {
        return prev;
      }
      return { ...prev, [addr]: entry };
    });
  }, []);

  const addrList = useMemo(() => (addresses ? [...addresses].reverse() : []), [addresses]);

  const loadedEntries = useMemo(
    () => addrList.map((a) => entries[a]).filter((e): e is MarketEntry => !!e),
    [entries, addrList],
  );

  const visible = useMemo(() => {
    let list = loadedEntries.filter((e) => !e.market.resolved);
    if (activeCategory !== "All") list = list.filter((e) => e.market.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.market.question.toLowerCase().includes(q) ||
          e.market.category.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === "trending") {
      sorted.sort((a, b) => Number((b.totalPool ?? 0n) - (a.totalPool ?? 0n)));
    } else if (sort === "new") {
      const idx = new Map(addrList.map((a, i) => [a, i]));
      sorted.sort((a, b) => (idx.get(a.address)! - idx.get(b.address)!));
    } else if (sort === "closing") {
      sorted.sort((a, b) => a.market.resolutionTime - b.market.resolutionTime);
    }
    return sorted;
  }, [loadedEntries, activeCategory, search, sort, addrList]);

  const totalVolume = useMemo(
    () => loadedEntries.reduce((acc, e) => acc + (e.totalPool ?? 0n), 0n),
    [loadedEntries],
  );
  const openMarkets = useMemo(
    () => loadedEntries.filter((e) => !e.market.resolved).length,
    [loadedEntries],
  );

  return (
    <>
      {addrList.map((a) => (
        <MarketLoader key={a} address={a} onLoad={handleLoad} />
      ))}

      {/* HERO BAND — compact, brutalist. Carries headline + live stats. */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--y)", borderBottom: "2px solid var(--k)" }}
      >
        <PixelDebris count={10} seed={11} />
        <div className="relative z-[3] mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="eyebrow" style={{ color: "var(--k)" }}>
                  ▮ CONFIDENTIAL MARKETS
                </div>
                <h1
                  className="display m-0"
                  style={{
                    fontSize: "clamp(20px, 2.4vw, 28px)",
                    lineHeight: 1.1,
                    color: "var(--k)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Bet without leaking your position.
                </h1>
              </div>
              <div
                className="mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tracking-[0.1em]"
                style={{ color: "var(--k)" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <SqDot kind="open" size={6} /> LIVE ON SEPOLIA
                </span>
                <span>cUSDT · ERC-7984</span>
                <span>
                  <span style={{ background: "var(--k)", color: "var(--y)", padding: "1px 5px" }}>
                    euint64
                  </span>{" "}
                  CPMM · 2-TX
                </span>
              </div>
            </div>

            {/* Inline stats */}
            <div
              className="flex items-center gap-5 shrink-0"
              style={{ color: "var(--k)" }}
            >
              <Stat n={openMarkets ? `${openMarkets}` : "—"} l="OPEN MARKETS" />
              <Stat n={fmtUSDCCompact(totalVolume)} l="TOTAL POOL" />
              <Stat n="100%" l="ENCRYPTED HOLDERS" last />
            </div>

            <div className="flex gap-2 shrink-0">
              <a href="#markets">
                <Btn kind="primary" size="sm">OPEN MARKETS →</Btn>
              </a>
              <a href="/docs">
                <Btn kind="secondary" size="sm">DOCS</Btn>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* MARKETS */}
      <section
        id="markets"
        className="px-4 sm:px-6 lg:px-8 py-10"
        style={{ background: "var(--g0)" }}
      >
       <div className="mx-auto max-w-[1400px]">
        <SectionHead
          eyebrow="01 · MARKETS"
          title="Trending markets"
          right={
            <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
              {openMarkets} ACTIVE · {fmtUSDCCompact(totalVolume).toUpperCase()} VOLUME
            </div>
          }
        />

        {/* Search + filter row */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div
            className="flex-1 flex items-center gap-2.5 px-3 py-2"
            style={{ background: "var(--w)", border: "2px solid var(--k)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--g2)" strokeWidth="1.6" aria-hidden>
              <circle cx="6" cy="6" r="4.5" />
              <path d="M9.5 9.5 L13 13" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets, categories, addresses…"
              className="flex-1 bg-transparent border-none outline-none text-[13px]"
              style={{ color: "var(--k)" }}
            />
            <span
              className="mono text-[10px] tracking-[0.04em] px-1.5 py-[1px]"
              style={{ color: "var(--g2)", border: "1px solid var(--k)" }}
            >
              ⌘K
            </span>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="mono px-3 py-2 text-[12px] outline-none"
            style={{ background: "var(--w)", border: "2px solid var(--k)", color: "var(--k)" }}
          >
            <option value="trending">SORT · 24H VOLUME</option>
            <option value="new">SORT · NEW</option>
            <option value="closing">SORT · CLOSING SOON</option>
          </select>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 mb-7 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((c) => {
            const active = activeCategory === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className="shrink-0 cursor-pointer"
              >
                <Chip color={active ? "k" : "w"}>{c.toUpperCase()}</Chip>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 skeleton"
                style={{ border: "2px solid var(--k)" }}
              />
            ))}
          </div>
        ) : !addresses || addresses.length === 0 ? (
          <div
            className="py-20 text-center"
            style={{ border: "2px dashed var(--k)" }}
          >
            <div className="display" style={{ fontSize: 22, color: "var(--k)" }}>
              No markets yet
            </div>
            <p
              className="mono mt-2 text-[11px] tracking-[0.06em]"
              style={{ color: "var(--g2)" }}
            >
              DEPLOY CONTRACTS AND LAUNCH FROM THE ADMIN PANEL.
            </p>
          </div>
        ) : visible.length === 0 && loadedEntries.length === addrList.length ? (
          <div
            className="py-16 text-center mono text-[12px] tracking-[0.06em]"
            style={{ border: "2px dashed var(--k)", color: "var(--g2)" }}
          >
            NO MARKETS MATCH YOUR FILTERS.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((e) => {
              const cryptoMeta = parseCryptoDescription(e.market.description);
              const livePrice = cryptoMeta ? prices?.[cryptoMeta.coin]?.usd : undefined;
              return (
                <MarketCard
                  key={e.address}
                  market={e.market}
                  yesOdds={e.yesOdds}
                  noOdds={e.noOdds}
                  totalPool={e.totalPool}
                  livePrice={livePrice}
                />
              );
            })}
            {addrList.length > loadedEntries.length &&
              Array.from({ length: Math.min(3, addrList.length - loadedEntries.length) }).map(
                (_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="h-64 skeleton"
                    style={{ border: "2px solid var(--k)" }}
                  />
                ),
              )}
          </div>
        )}
       </div>
      </section>

    </>
  );
}

function Stat({ n, l, last }: { n: string; l: string; last?: boolean }) {
  return (
    <div
      className="hidden md:block pr-5"
      style={{ borderRight: last ? "none" : "2px solid var(--k)" }}
    >
      <div className="display" style={{ fontSize: 22, lineHeight: 1, color: "var(--k)" }}>
        {n}
      </div>
      <div className="mono mt-0.5 text-[9px] tracking-[0.14em]" style={{ color: "var(--k)" }}>
        {l}
      </div>
    </div>
  );
}
