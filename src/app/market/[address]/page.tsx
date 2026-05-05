"use client";
import { useMemo, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import {
  useMarketData,
  usePreviewBuy,
  usePreviewSell,
} from "@/hooks/useMarkets";
import { useBet } from "@/hooks/useBet";
import { useCUSDTBalance } from "@/hooks/useCUSDTBalance";
import { useEncryptedShares } from "@/hooks/useEncryptedShares";
import FaucetButton from "@/components/FaucetButton";
import {
  formatUSDC,
  parseUSDC,
  timeLeft,
  shortenAddress,
} from "@/lib/utils";
import { PLATFORM_FEE_BPS, CUSDT_DECIMALS } from "@/lib/constants";
import { BetSide } from "@/types";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { parseCryptoDescription, CRYPTO_MARKET_TAG } from "@/lib/cryptoMarkets";
import { COIN_BY_ID, formatUsd } from "@/lib/coingecko";
import { usePrices } from "@/components/PriceProvider";
import NetworkGate, { useChainGate } from "@/components/NetworkGate";
import TxBanner from "@/components/TxBanner";
import OddsBar from "@/components/ui/OddsBar";
import StatCard from "@/components/ui/StatCard";
import Btn from "@/components/ui/Btn";
import Chip from "@/components/ui/Chip";
import SqDot from "@/components/ui/SqDot";
import CoinIcon from "@/components/ui/CoinIcon";
import EncBadge from "@/components/ui/EncBadge";
import LockGlyph from "@/components/ui/LockGlyph";
import { seededSparkline } from "@/lib/utils";
import { sepolia } from "@/lib/chains";

interface Props {
  params: Promise<{ address: string }>;
}

type Tab = "about" | "rules" | "activity" | "holders";
type Mode = "buy" | "sell";

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="mono flex justify-between text-[11px]" style={{ color: "var(--g3)" }}>
      <span style={{ color: "var(--g2)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? "var(--k)" }}>{value}</span>
    </div>
  );
}

export default function MarketPage({ params }: Props) {
  const { address: marketAddress } = use(params);
  const { address: userAddress } = useAccount();

  const addr = marketAddress as `0x${string}`;
  const { market, yesOdds, noOdds, totalPool, isLoading, refetch } = useMarketData(addr);
  const {
    buy,
    sell,
    claimWinnings,
    isLoading: isActing,
    stepLabel,
    error: txError,
    clearError,
  } = useBet(addr);
  const cusdtBal = useCUSDTBalance();
  const encShares = useEncryptedShares(addr);
  const { wrongChain, isConnected } = useChainGate();
  const writesDisabled = !isConnected || wrongChain;

  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "sell" ? "sell" : "buy";
  const [tab, setTab] = useState<Tab>("about");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [side, setSide] = useState<BetSide>("YES");
  const [amount, setAmount] = useState("");
  const [sharesAmt, setSharesAmt] = useState("");

  const { prices } = usePrices();

  const yPct = useMemo(() => (yesOdds ? Number(yesOdds) / 1e16 : 50), [yesOdds]);
  const nPct = useMemo(() => (noOdds ? Number(noOdds) / 1e16 : 50), [noOdds]);

  const buyAmountBig = useMemo(() => {
    try {
      if (!amount || parseFloat(amount) <= 0) return undefined;
      return parseUSDC(amount);
    } catch {
      return undefined;
    }
  }, [amount]);
  const sellSharesBig = useMemo(() => {
    try {
      if (!sharesAmt || parseFloat(sharesAmt) <= 0) return undefined;
      return parseUSDC(sharesAmt);
    } catch {
      return undefined;
    }
  }, [sharesAmt]);

  const { data: previewBuyShares } = usePreviewBuy(addr, side === "YES", buyAmountBig);
  const { data: previewSellGross } = usePreviewSell(addr, side === "YES", sellSharesBig);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--g2)" }} />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-[13px]" style={{ color: "var(--red)" }}>Market not found.</p>
        <Link href="/" className="mono mt-3 inline-flex items-center gap-1 text-[11px] underline">
          ← BACK TO MARKETS
        </Link>
      </div>
    );
  }

  const ZERO_HANDLE = `0x${"0".repeat(64)}`;
  const hasYesHandle = encShares.yesHandle && encShares.yesHandle !== ZERO_HANDLE;
  const hasNoHandle = encShares.noHandle && encShares.noHandle !== ZERO_HANDLE;
  const hasPosition = !!(hasYesHandle || hasNoHandle);
  const userYes = encShares.revealed ? (encShares.yesShares ?? 0n) : 0n;
  const userNo = encShares.revealed ? (encShares.noShares ?? 0n) : 0n;
  const userSideShares = side === "YES" ? userYes : userNo;

  const cryptoMeta = parseCryptoDescription(market.description);
  const coin = cryptoMeta ? COIN_BY_ID[cryptoMeta.coin] : null;
  const livePrice = cryptoMeta ? prices?.[cryptoMeta.coin]?.usd : undefined;

  const humanDescription = (() => {
    const idx = market.description.lastIndexOf(CRYPTO_MARKET_TAG);
    return idx >= 0 ? market.description.slice(0, idx).trim() : market.description;
  })();

  const amountNum = parseFloat(amount) || 0;
  const feeAmount = (amountNum * PLATFORM_FEE_BPS) / 10000;
  const previewSharesNum = previewBuyShares ? Number(previewBuyShares as bigint) / 1e6 : 0;
  const avgPriceBuy = previewSharesNum > 0 ? (amountNum - feeAmount) / previewSharesNum : 0;
  const potentialPayoutBuy = previewSharesNum;
  const potentialProfitBuy = potentialPayoutBuy - amountNum;

  const sharesNum = parseFloat(sharesAmt) || 0;
  const grossSell = previewSellGross ? Number(previewSellGross as bigint) / 1e6 : 0;
  const sellFee = grossSell * (PLATFORM_FEE_BPS / 10000);
  const netSell = grossSell - sellFee;
  const sellAvgPrice = sharesNum > 0 ? netSell / sharesNum : 0;

  const balanceFormatted = cusdtBal.cleartext !== null
    ? (Number(cusdtBal.cleartext) / 10 ** CUSDT_DECIMALS).toFixed(2)
    : null;
  const balanceLoading = cusdtBal.loading;

  const sideColor = side === "YES" ? "var(--green)" : "var(--red)";
  const explorerBase = sepolia.blockExplorers?.default.url;
  const shortId = addr.slice(2, 6).toUpperCase();
  const cat = market.category || "MARKET";
  const sparkline = seededSparkline(addr, 64, yPct);

  async function handleBuySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountNum || amountNum <= 0) return;
    await buy(side, amount, previewBuyShares as bigint | undefined);
    setAmount("");
    refetch();
  }

  async function handleSellSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sellSharesBig) return;
    if (sellSharesBig > userSideShares) return;
    await sell(side, sellSharesBig, previewSellGross as bigint | undefined);
    setSharesAmt("");
    refetch();
  }

  return (
    <div style={{ background: "var(--g0)" }}>
      {/* Breadcrumb */}
      <div
        className="mono mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 text-[10px] tracking-[0.12em]"
        style={{ color: "var(--g2)" }}
      >
        <Link href="/" className="hover:text-[var(--k)] transition-colors">MARKETS</Link>
        <span> / </span>
        <span>{cat.toUpperCase()}</span>
        <span> / </span>
        <span style={{ color: "var(--k)" }}>{shortenAddress(addr)}</span>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-10 grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        {/* LEFT */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Title block */}
          <div className="flex gap-4 items-start">
            <div className="shrink-0" style={{ border: "2px solid var(--k)", padding: 4, background: "var(--w)" }}>
              <CoinIcon market={market} size={56} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <Chip color="k">{cat.toUpperCase()}</Chip>
                <span className="mono label">ID · {shortId}</span>
                <span className="mono label">· {shortenAddress(addr)}</span>
              </div>
              <h1
                className="display m-0"
                style={{
                  fontSize: 28,
                  lineHeight: 1.18,
                  color: "var(--k)",
                  letterSpacing: "-0.02em",
                  textWrap: "balance",
                }}
              >
                {market.question}
              </h1>
            </div>
          </div>

          {/* StatStrip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="CHANCE" value={`${yPct.toFixed(0)}%`} sub="IMPLIED YES" />
            <StatCard
              label="POOL"
              value={totalPool ? formatUSDC(totalPool) : "$0.00"}
              sub="cUSDT"
            />
            <StatCard
              label="RESERVES"
              value={`${formatUSDC(market.yesReserve).replace("$", "")} / ${formatUSDC(market.noReserve).replace("$", "")}`}
              sub="YES / NO"
            />
            <StatCard
              label="STATUS"
              value={market.resolved ? market.outcome : "OPEN"}
              dot={market.resolved ? (market.outcome === "YES" ? "win" : market.outcome === "NO" ? "loss" : "off") : "open"}
              sub={market.resolved ? "RESOLVED" : `ENDS ${timeLeft(market.resolutionTime).toUpperCase()}`}
            />
          </div>

          {/* Odds card — yellow tint backdrop + stepped chart */}
          <div
            className="p-4"
            style={{ background: "rgba(255,210,8,0.08)", border: "2px solid var(--k)" }}
          >
            <div className="flex justify-between items-baseline mb-3">
              <div>
                <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
                  YES PRICE · 30D
                </div>
                <div className="mono text-[10px] tracking-[0.1em] mt-0.5" style={{ color: "var(--g2)" }}>
                  FPMM SPOT · RE-PRICED PER TRADE
                </div>
              </div>
              <div className="flex gap-1.5">
                {["1D", "7D", "30D", "ALL"].map((t, i) => (
                  <Chip key={t} color={i === 2 ? "k" : "w"}>{t}</Chip>
                ))}
              </div>
            </div>
            <OddsBar yes={yPct} height={44} />
            <div className="mt-4">
              <SteppedChart data={sparkline} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: "2px solid var(--k)" }} className="flex gap-7 mt-3">
            {(
              [
                { k: "about" as Tab, label: "ABOUT" },
                { k: "rules" as Tab, label: "RULES" },
                { k: "activity" as Tab, label: "ACTIVITY" },
                { k: "holders" as Tab, label: "HOLDERS" },
              ]
            ).map((t) => {
              const active = tab === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className="mono pb-2.5 text-[12px] tracking-[0.14em] font-bold cursor-pointer"
                  style={{
                    color: active ? "var(--k)" : "var(--g2)",
                    borderBottom: active ? "3px solid var(--k)" : "3px solid transparent",
                    marginBottom: -2,
                    background: "transparent",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="text-[14px] leading-[1.65]" style={{ color: "var(--g3)" }}>
            {tab === "about" && (
              <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
                <div>
                  <p className="m-0 whitespace-pre-wrap">{humanDescription || "No description."}</p>
                  <div
                    className="grid grid-cols-2 gap-4 mt-5 pt-4"
                    style={{ borderTop: "1px solid var(--g1)" }}
                  >
                    <div>
                      <div className="label">MARKET ADDRESS</div>
                      <a
                        href={explorerBase ? `${explorerBase}/address/${addr}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mono text-[12px] underline mt-1 block"
                        style={{ color: "var(--blue)" }}
                      >
                        {shortenAddress(addr)} ↗
                      </a>
                    </div>
                    <div>
                      <div className="label">RESOLVES</div>
                      <div className="mono text-[12px] mt-1" style={{ color: "var(--k)" }}>
                        {new Date(market.resolutionTime * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="label">CATEGORY</div>
                      <div className="mono text-[12px] mt-1" style={{ color: "var(--k)" }}>
                        {market.category}
                      </div>
                    </div>
                    <div>
                      <div className="label">LP SEED</div>
                      <div className="mono text-[12px] mt-1" style={{ color: "var(--k)" }}>
                        {formatUSDC(market.seedLiquidity)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resolution sidebar */}
                <div className="p-4" style={{ background: "var(--w)", border: "2px solid var(--k)" }}>
                  <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
                    RESOLUTION
                  </div>
                  <div className="grid gap-2 mt-3">
                    {[
                      ["Source", cryptoMeta ? "CoinGecko spot" : "Admin oracle"],
                      ["Outcome window", "Spot at resolution time"],
                      ["Fee", `${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`],
                      ["LP seed", formatUSDC(market.seedLiquidity)],
                    ].map(([k, v]) => (
                      <div key={k} className="mono flex justify-between text-[11px]">
                        <span style={{ color: "var(--g2)" }}>{k}</span>
                        <span style={{ color: "var(--k)", fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab === "rules" && (
              <div className="space-y-3">
                <p className="m-0 font-semibold" style={{ color: "var(--k)" }}>Market mechanics</p>
                <p className="m-0">
                  Polymarket-style FPMM. Buy/sell YES or NO shares against the pool. Each winning
                  share redeems for <span className="mono">1 cUSDT</span> at resolution.
                </p>
                <p className="m-0 font-semibold" style={{ color: "var(--k)" }}>Resolution source</p>
                <p className="m-0">
                  {cryptoMeta
                    ? `Resolves YES if ${coin?.name} (${coin?.symbol}) trades above ${formatUsd(cryptoMeta.targetUsd)} on CoinGecko at resolution time.`
                    : "Resolves based on the configured source of truth at the scheduled end time."}
                </p>
                <p className="m-0 font-semibold" style={{ color: "var(--k)" }}>Fees</p>
                <p className="m-0">
                  <span className="mono">{(PLATFORM_FEE_BPS / 100).toFixed(2)}%</span> protocol fee
                  on both buys and sells, routed on-chain to the treasury.
                </p>
              </div>
            )}
            {tab === "activity" && (
              <div className="py-10 text-center">
                <div className="mono text-[12px]" style={{ color: "var(--g2)" }}>
                  ACTIVITY INDEXED OFF-CHAIN
                </div>
                <div className="mono label mt-2">COMING SOON</div>
              </div>
            )}
            {tab === "holders" && (
              <div className="py-10 text-center">
                <div className="mono text-[12px]" style={{ color: "var(--g2)" }}>
                  HOLDERS VIEW
                </div>
                <div className="mono label mt-2">COMING SOON</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — sticky bet panel + encrypted position */}
        <div className="lg:sticky lg:top-[120px] flex flex-col gap-4">
          {/* Bet panel */}
          <div style={{ background: "var(--w)", border: "2px solid var(--k)" }}>
            {/* BUY/SELL tabs */}
            <div className="flex" style={{ borderBottom: "2px solid var(--k)" }}>
              {(["buy", "sell"] as Mode[]).map((m, i) => {
                const active = mode === m;
                const disabled = m === "sell" && !hasPosition;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setMode(m)}
                    className="mono flex-1 text-center py-3.5 text-[12px] font-bold tracking-[0.14em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: active ? "var(--k)" : "var(--w)",
                      color: active ? "var(--w)" : disabled ? "var(--g2)" : "var(--g2)",
                      borderRight: i === 0 ? "2px solid var(--k)" : "none",
                    }}
                  >
                    {m.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div className="p-4 grid gap-3.5">
              {(!isConnected || wrongChain) && (
                <div className="-mt-1">
                  <NetworkGate compact />
                </div>
              )}

              {/* YES/NO selector */}
              <div className="grid grid-cols-2 gap-2">
                {(["YES", "NO"] as BetSide[]).map((s) => {
                  const active = side === s;
                  const p = s === "YES" ? yPct : nPct;
                  const userSideHolding = s === "YES" ? userYes : userNo;
                  const sellDisabled = mode === "sell" && userSideHolding === 0n;
                  const bg = active
                    ? s === "YES"
                      ? "var(--green)"
                      : "var(--red)"
                    : "var(--w)";
                  const fg = active ? (s === "YES" ? "var(--k)" : "var(--w)") : "var(--g2)";
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={sellDisabled}
                      onClick={() => !sellDisabled && setSide(s)}
                      className="text-left px-3 py-3.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: bg, border: "2px solid var(--k)", color: fg }}
                    >
                      <div className="mono text-[10px] tracking-[0.14em] font-bold">{s}</div>
                      <div className="display mt-1" style={{ fontSize: 22 }}>
                        {p.toFixed(0)}¢
                      </div>
                      {mode === "sell" && (
                        <div className="mono text-[10px] mt-1" style={{ color: "var(--g2)" }}>
                          You hold {formatUSDC(userSideHolding)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {mode === "buy" ? (
                <form onSubmit={handleBuySubmit} className="grid gap-3.5">
                  <div>
                    <div className="mono text-[10px] tracking-[0.14em] mb-1.5" style={{ color: "var(--g2)" }}>
                      AMOUNT
                    </div>
                    <div
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ border: "2px solid var(--k)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="mono text-[18px] font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={writesDisabled}
                          className="mono bg-transparent border-none outline-none w-24 text-[18px] font-bold"
                          style={{ color: "var(--k)" }}
                        />
                      </div>
                      <Chip color="w">cUSDT</Chip>
                    </div>
                    <div className="mono mt-1.5 flex items-center justify-between text-[10px]" style={{ color: "var(--g2)" }}>
                      <span>
                        BAL ·{" "}
                        {balanceLoading ? (
                          <span className="skeleton inline-block h-3 w-12" />
                        ) : balanceFormatted !== null ? (
                          <span style={{ color: "var(--k)" }}>{balanceFormatted} cUSDT</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => cusdtBal.reveal()}
                            className="inline-flex items-center gap-1.5 underline"
                            style={{ color: "var(--blue)" }}
                          >
                            <LockGlyph size={11} color="var(--blue)" holeColor="var(--w)" /> reveal
                          </button>
                        )}
                      </span>
                      <FaucetButton count={5} variant="compact" />
                    </div>
                  </div>

                  {/* Quick chips */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {["10", "50", "100", "MAX"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(v === "MAX" ? (balanceFormatted ?? "") : v)}
                        disabled={v === "MAX" && !balanceFormatted}
                        className="mono py-2 text-[11px] font-bold tracking-[0.06em] cursor-pointer disabled:opacity-40"
                        style={{ background: "var(--w)", border: "2px solid var(--k)", color: "var(--k)" }}
                      >
                        {v === "MAX" ? "MAX" : `$${v}`}
                      </button>
                    ))}
                  </div>

                  {txError && (
                    <TxBanner message={txError} onDismiss={clearError} />
                  )}

                  {/* Breakdown */}
                  <div className="pt-3 grid gap-1.5" style={{ borderTop: "1px dashed var(--g1)" }}>
                    <Row label="AVG PRICE" value={avgPriceBuy > 0 ? `${(avgPriceBuy * 100).toFixed(1)}¢` : "—"} />
                    <Row label="SHARES" value={previewSharesNum > 0 ? previewSharesNum.toFixed(2) : "—"} />
                    <Row
                      label="MAX PAYOUT"
                      value={potentialPayoutBuy > 0 ? `$${potentialPayoutBuy.toFixed(2)}` : "—"}
                      color={sideColor}
                    />
                    <Row
                      label="MAX PROFIT"
                      value={amountNum > 0 ? `${potentialProfitBuy >= 0 ? "+" : ""}$${potentialProfitBuy.toFixed(2)}` : "—"}
                      color={potentialProfitBuy >= 0 ? "var(--green)" : "var(--red)"}
                    />
                    <Row label={`FEE · ${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`} value={`$${feeAmount.toFixed(2)}`} />
                  </div>

                  <button
                    type="submit"
                    disabled={!userAddress || isActing || !amountNum || writesDisabled || market.resolved}
                    data-loading={isActing ? "true" : undefined}
                    className="btn"
                    style={{
                      background: market.resolved
                        ? "var(--g1)"
                        : side === "YES"
                          ? "var(--green)"
                          : "var(--red)",
                      color: side === "YES" ? "var(--k)" : "var(--w)",
                      border: "2px solid var(--k)",
                      padding: "16px 0",
                      fontSize: 13,
                      letterSpacing: "0.12em",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    {isActing ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {stepLabel ?? "WORKING…"}
                      </span>
                    ) : (
                      `BUY ${side} · $${amountNum.toFixed(2)}`
                    )}
                  </button>

                  <div className="mono text-[9px] tracking-[0.1em] text-center" style={{ color: "var(--g2)" }}>
                    SETTLED ON SEPOLIA · cUSDT · FPMM · 2-TX FLOW
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSellSubmit} className="grid gap-3.5">
                  <div>
                    <div className="mono text-[10px] tracking-[0.14em] mb-1.5" style={{ color: "var(--g2)" }}>
                      SHARES
                    </div>
                    <div
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ border: "2px solid var(--k)" }}
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sharesAmt}
                        onChange={(e) => setSharesAmt(e.target.value)}
                        placeholder="0.00"
                        disabled={writesDisabled}
                        className="mono bg-transparent border-none outline-none flex-1 text-[18px] font-bold"
                        style={{ color: "var(--k)" }}
                      />
                      <Chip color="w">{side}</Chip>
                    </div>
                    {!encShares.revealed && (
                      <button
                        type="button"
                        onClick={() => encShares.reveal()}
                        className="mono mt-1.5 inline-flex items-center gap-1.5 text-[10px] underline"
                        style={{ color: "var(--blue)" }}
                      >
                        <LockGlyph size={11} color="var(--blue)" holeColor="var(--w)" />
                        REVEAL POSITION TO SET MAX
                      </button>
                    )}
                  </div>

                  <div className="pt-3 grid gap-1.5" style={{ borderTop: "1px dashed var(--g1)" }}>
                    <Row
                      label="AVG PRICE"
                      value={sellAvgPrice > 0 ? `${(sellAvgPrice * 100).toFixed(1)}¢` : "—"}
                    />
                    <Row
                      label="GROSS"
                      value={grossSell > 0 ? `$${grossSell.toFixed(2)}` : "—"}
                    />
                    <Row label={`FEE · ${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`} value={`$${sellFee.toFixed(2)}`} />
                    <Row
                      label="NET"
                      value={netSell > 0 ? `$${netSell.toFixed(2)}` : "—"}
                      color="var(--green)"
                    />
                  </div>

                  {txError && <TxBanner message={txError} onDismiss={clearError} />}

                  <button
                    type="submit"
                    disabled={!userAddress || isActing || !sharesNum || writesDisabled || market.resolved}
                    data-loading={isActing ? "true" : undefined}
                    className="btn"
                    style={{
                      background: side === "YES" ? "var(--green)" : "var(--red)",
                      color: side === "YES" ? "var(--k)" : "var(--w)",
                      border: "2px solid var(--k)",
                      padding: "16px 0",
                      fontSize: 13,
                      letterSpacing: "0.12em",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    {isActing ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        WORKING…
                      </span>
                    ) : (
                      `SELL ${side}`
                    )}
                  </button>
                </form>
              )}

              {market.resolved && (
                <div className="grid gap-2 mt-1">
                  <div
                    className="mono p-3 text-center text-[11px] tracking-[0.1em]"
                    style={{ background: "var(--g0)", border: "2px solid var(--k)", color: "var(--k)" }}
                  >
                    RESOLVED · {market.outcome}
                  </div>
                  {hasPosition && (
                    <Btn
                      kind="yellow"
                      full
                      size="md"
                      onClick={async () => {
                        await claimWinnings();
                        refetch();
                      }}
                      disabled={isActing}
                    >
                      {isActing ? (stepLabel ?? "CLAIMING…") : "CLAIM WINNINGS"}
                    </Btn>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Encrypted position */}
          {hasPosition && (
            <EncryptedPositionPanel encShares={encShares} />
          )}

          {cryptoMeta && coin && livePrice !== undefined && (
            <div
              className="p-3"
              style={{ background: "var(--w)", border: "2px solid var(--k)" }}
            >
              <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
                LIVE TRACKING
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="mono text-[12px]" style={{ color: "var(--k)" }}>
                  {coin.symbol} {formatUsd(livePrice)}
                </span>
                <span
                  className="mono text-[10px] tracking-[0.1em]"
                  style={{
                    color: livePrice > (cryptoMeta?.targetUsd ?? 0) ? "var(--green)" : "var(--red)",
                  }}
                >
                  TARGET {formatUsd(cryptoMeta.targetUsd)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function SteppedChart({ data }: { data: number[] }) {
  const W = 600;
  const H = 140;
  const pad = 24;
  const max = 100;
  const stepX = (W - pad * 2) / (data.length - 1);
  const path = data
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = H - pad - (v / max) * (H - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <div style={{ background: "var(--w)", border: "2px solid var(--k)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 140, display: "block" }}>
        {[20, 40, 60, 80].map((v) => {
          const y = H - pad - (v / max) * (H - pad * 2);
          return <line key={v} x1={pad} x2={W - pad} y1={y} y2={y} stroke="#C7CDD5" strokeDasharray="2 4" />;
        })}
        <path d={`${path} L ${W - pad} ${H - pad} L ${pad} ${H - pad} Z`} fill="#FFD208" opacity="0.4" />
        <path d={path} fill="none" stroke="#0A0A0A" strokeWidth="2" />
        {data.map((v, i) => {
          const x = pad + i * stepX;
          const y = H - pad - (v / max) * (H - pad * 2);
          return <rect key={i} x={x - 2} y={y - 2} width={4} height={4} fill="#0A0A0A" />;
        })}
        {[20, 40, 60, 80].map((v) => {
          const y = H - pad - (v / max) * (H - pad * 2);
          return (
            <text key={`t-${v}`} x={4} y={y + 3} fontFamily="JetBrains Mono" fontSize="9" fill="#6B7280">
              {v}¢
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function EncryptedPositionPanel({
  encShares,
}: {
  encShares: ReturnType<typeof useEncryptedShares>;
}) {
  const ZERO = `0x${"0".repeat(64)}`;
  const hasYes = encShares.yesHandle && encShares.yesHandle !== ZERO;
  const hasNo = encShares.noHandle && encShares.noHandle !== ZERO;
  if (!hasYes && !hasNo) return null;

  return (
    <div style={{ background: "var(--w)", border: "2px solid var(--k)" }}>
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "2px solid var(--k)", background: "var(--g0)" }}
      >
        <div className="mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--k)" }}>
          YOUR ENCRYPTED POSITION
        </div>
        {!encShares.revealed && (
          <Btn kind="ghost" size="sm" onClick={() => encShares.reveal()} disabled={encShares.loading}>
            {encShares.loading ? "DECRYPTING…" : "REVEAL"}
          </Btn>
        )}
      </div>
      <div className="p-4 grid gap-2.5">
        {hasYes && (
          <PosRow
            kind="YES"
            value={encShares.revealed && encShares.yesShares !== null ? formatUSDC(encShares.yesShares) : <EncBadge label="ENCRYPTED" />}
          />
        )}
        {hasNo && (
          <PosRow
            kind="NO"
            value={encShares.revealed && encShares.noShares !== null ? formatUSDC(encShares.noShares) : <EncBadge label="ENCRYPTED" />}
          />
        )}
        <div className="mono text-[10px] tracking-[0.06em] leading-[1.5] mt-1" style={{ color: "var(--g2)" }}>
          euint64 ciphertext — sign EIP-712 to user-decrypt locally. Nothing leaves your device.
        </div>
        {encShares.error && (
          <div className="mono text-[10px]" style={{ color: "var(--red)" }}>
            {encShares.error}
          </div>
        )}
      </div>
    </div>
  );
}

function PosRow({ kind, value }: { kind: "YES" | "NO"; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5"
      style={{
        background: kind === "YES" ? "#ECFDF3" : "#FEF2F2",
        border: "2px solid var(--k)",
      }}
    >
      <span className="mono text-[10px] tracking-[0.1em] font-bold">{kind} SHARES</span>
      <span className="mono text-[13px] font-semibold">{value}</span>
    </div>
  );
}
