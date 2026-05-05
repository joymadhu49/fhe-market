"use client";
import { useMemo, useEffect, useState, useCallback } from "react";
import { useAllMarketAddresses, useMarketData } from "@/hooks/useMarkets";
import { TRACKED_COINS, formatUsd, type PriceMap, type CoinId } from "@/lib/coingecko";
import { usePrices } from "@/components/PriceProvider";
import { MarketData } from "@/types";

interface TickEntry {
  address: `0x${string}`;
  market: MarketData;
  yesOdds?: bigint;
  totalPool?: bigint;
}

function TickerLoader({
  address,
  onLoad,
}: {
  address: `0x${string}`;
  onLoad: (addr: `0x${string}`, entry: TickEntry | null) => void;
}) {
  const { market, yesOdds, totalPool, isLoading } = useMarketData(address);
  const fp = market
    ? [market.question, (yesOdds ?? 0n).toString(), (totalPool ?? 0n).toString()].join("|")
    : "";
  useEffect(() => {
    if (isLoading) return;
    onLoad(address, market ? { address, market, yesOdds, totalPool } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, fp, address]);
  return null;
}

function PixelSep() {
  return <span style={{ width: 6, height: 6, background: "var(--y)", display: "inline-block" }} />;
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase whitespace-nowrap"
      style={{ color: "var(--w)" }}
    >
      <PixelSep />
      {children}
    </span>
  );
}

function Row({ items, prices }: { items: TickEntry[]; prices: PriceMap | null }) {
  const nodes: React.ReactNode[] = [];

  // Top markets by pool
  const topMarkets = [...items]
    .filter((e) => !e.market.resolved)
    .sort((a, b) => Number((b.totalPool ?? 0n) - (a.totalPool ?? 0n)))
    .slice(0, 4);

  for (const e of topMarkets) {
    const yPct = e.yesOdds ? Number(e.yesOdds) / 1e16 : 50;
    const key = e.market.question.length > 24
      ? e.market.question.slice(0, 24) + "…"
      : e.market.question;
    nodes.push(
      <Item key={`m-${e.address}`}>
        <span style={{ color: "var(--g1)" }}>{key.toUpperCase()}</span>
        <span style={{ color: "var(--y)" }}>{yPct.toFixed(0)}%</span>
      </Item>,
    );
  }

  // Live prices
  for (const c of TRACKED_COINS) {
    const p = prices?.[c.id as CoinId]?.usd;
    if (p === undefined) continue;
    nodes.push(
      <Item key={`c-${c.id}`}>
        <span>{c.symbol}</span>
        <span>{formatUsd(p)}</span>
      </Item>,
    );
  }

  // Static brand strings
  const brand = [
    "READ FHE MARKET DOCS",
    "LIVE ON SEPOLIA",
    "cUSDT · ERC-7984",
    "POOL PUBLIC · POSITION PRIVATE",
  ];
  for (const b of brand) {
    nodes.push(<Item key={`b-${b}`}>{b}</Item>);
  }

  return <div className="flex gap-12 shrink-0 pr-12">{nodes}</div>;
}

export default function Ticker() {
  const { data: addresses } = useAllMarketAddresses();
  const { prices } = usePrices();
  const [entries, setEntries] = useState<Record<string, TickEntry | null>>({});

  const handleLoad = useCallback((addr: `0x${string}`, entry: TickEntry | null) => {
    setEntries((prev) => {
      const existing = prev[addr];
      if (!existing && !entry) return prev;
      if (!existing || !entry) return { ...prev, [addr]: entry };
      if (
        existing.totalPool === entry.totalPool &&
        existing.yesOdds === entry.yesOdds &&
        existing.market.question === entry.market.question
      ) {
        return prev;
      }
      return { ...prev, [addr]: entry };
    });
  }, []);

  const addrList = useMemo(() => addresses ?? [], [addresses]);
  const loaded = useMemo(
    () => addrList.map((a) => entries[a]).filter((e): e is TickEntry => !!e),
    [addrList, entries],
  );

  return (
    <>
      {addrList.map((a) => (
        <TickerLoader key={a} address={a} onLoad={handleLoad} />
      ))}
      <div
        className="sticky top-[56px] z-40 h-[32px] flex items-center overflow-hidden"
        style={{ background: "var(--k)", borderTop: "1px solid #222", borderBottom: "1px solid #222" }}
      >
        <div className="ticker-track flex">
          <Row items={loaded} prices={prices} />
          <Row items={loaded} prices={prices} />
        </div>
      </div>
    </>
  );
}
