"use client";
import { memo } from "react";
import Link from "next/link";
import { MarketData } from "@/types";
import { formatUSDC, timeLeft } from "@/lib/utils";
import { parseCryptoDescription } from "@/lib/cryptoMarkets";
import { formatUsd } from "@/lib/coingecko";
import OddsBar from "@/components/ui/OddsBar";
import Chip from "@/components/ui/Chip";
import Btn from "@/components/ui/Btn";
import CoinIcon from "@/components/ui/CoinIcon";

interface Props {
  market: MarketData;
  yesOdds?: bigint;
  noOdds?: bigint;
  totalPool?: bigint;
  livePrice?: number;
}

function MarketCard({ market, yesOdds, totalPool, livePrice }: Props) {
  const yPct = yesOdds ? Number(yesOdds) / 1e16 : 50;
  const cryptoMeta = parseCryptoDescription(market.description);
  const cat = market.category || "Markets";
  const shortId = market.address.slice(2, 6).toUpperCase();
  const trackingYes =
    cryptoMeta && livePrice !== undefined ? livePrice > cryptoMeta.targetUsd : null;

  return (
    <Link href={`/market/${market.address}`} className="block group">
      <div
        className="flex flex-col gap-3 p-3.5 transition-transform group-hover:-translate-y-[2px]"
        style={{ background: "var(--w)", border: "2px solid var(--k)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CoinIcon market={market} size={36} />
            <Chip color="w">{cat.toUpperCase()}</Chip>
          </div>
          <span
            className="mono text-[10px] tracking-[0.08em] shrink-0"
            style={{ color: "var(--g2)" }}
          >
            ID {shortId}
          </span>
        </div>

        <div
          className="font-bold text-[15px] leading-[1.3] line-clamp-3"
          style={{ minHeight: 58, color: "var(--k)", textWrap: "pretty" }}
        >
          {market.question}
        </div>

        <OddsBar yes={yPct} height={32} />

        {cryptoMeta && livePrice !== undefined && (
          <div
            className="mono flex items-center justify-between text-[10px] tracking-[0.06em] pt-2"
            style={{ borderTop: "1px dashed var(--g1)", color: "var(--g2)" }}
          >
            <span>LIVE {formatUsd(livePrice)}</span>
            <span style={{ color: trackingYes ? "var(--green)" : "var(--red)" }}>
              TARGET {formatUsd(cryptoMeta.targetUsd)}
            </span>
          </div>
        )}

        <div
          className="mono flex items-center justify-between text-[10px] tracking-[0.06em]"
          style={{ color: "var(--g2)" }}
        >
          <span>POOL {totalPool ? formatUSDC(totalPool) : "$0.00"}</span>
          <span>·</span>
          <span>
            {market.resolved
              ? market.outcome === "CANCELLED"
                ? "CANCELLED"
                : `RES · ${market.outcome}`
              : `${timeLeft(market.resolutionTime).toUpperCase()}`}
          </span>
        </div>

        <Btn kind="primary" full size="md">TRADE →</Btn>
      </div>
    </Link>
  );
}

export default memo(
  MarketCard,
  (prev, next) =>
    prev.market.address === next.market.address &&
    prev.market.resolved === next.market.resolved &&
    prev.market.outcome === next.market.outcome &&
    prev.market.resolutionTime === next.market.resolutionTime &&
    prev.market.question === next.market.question &&
    prev.market.imageUrl === next.market.imageUrl &&
    prev.yesOdds === next.yesOdds &&
    prev.noOdds === next.noOdds &&
    prev.totalPool === next.totalPool &&
    prev.livePrice === next.livePrice,
);
