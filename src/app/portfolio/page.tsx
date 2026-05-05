"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, usePublicClient, useReadContracts } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useAllMarketAddresses, useMarketData } from "@/hooks/useMarkets";
import { shortenAddress } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useBet } from "@/hooks/useBet";
import { MarketData } from "@/types";
import { sepolia } from "@/lib/chains";
import { PREDICTION_MARKET_ABI } from "@/lib/abi";
import { txErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import PixelDebris from "@/components/ui/PixelDebris";
import Btn from "@/components/ui/Btn";
import Chip from "@/components/ui/Chip";
import SqDot from "@/components/ui/SqDot";
import SectionHead from "@/components/ui/SectionHead";
import LockGlyph from "@/components/ui/LockGlyph";
import EncBadge from "@/components/ui/EncBadge";

type Filter = "all" | "open" | "claimable" | "resolved";

interface Position {
  marketAddress: `0x${string}`;
  market: MarketData;
  side: "YES" | "NO";
  yesOdds?: bigint;
  noOdds?: bigint;
  claimable: boolean;
  resolved: boolean;
  alreadyClaimed: boolean;
  status: "open" | "claimable" | "claimed" | "resolved-win" | "resolved-loss";
}

const ZERO_HANDLE = `0x${"0".repeat(64)}`;

function PositionLoader({
  marketAddress,
  userAddress,
  onLoad,
}: {
  marketAddress: `0x${string}`;
  userAddress: `0x${string}`;
  onLoad: (addr: `0x${string}`, pos: Position | null) => void;
}) {
  const { market, yesOdds, noOdds } = useMarketData(marketAddress);
  const { data: handles } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: PREDICTION_MARKET_ABI, functionName: "yesSharesHandle", args: [userAddress] },
      { address: marketAddress, abi: PREDICTION_MARKET_ABI, functionName: "noSharesHandle", args: [userAddress] },
      { address: marketAddress, abi: PREDICTION_MARKET_ABI, functionName: "claimed", args: [userAddress] },
    ],
    query: {
      enabled: !!userAddress,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    },
  });

  const yesHandle = (handles?.[0]?.result as `0x${string}` | undefined) ?? ZERO_HANDLE;
  const noHandle = (handles?.[1]?.result as `0x${string}` | undefined) ?? ZERO_HANDLE;
  const alreadyClaimed = Boolean(handles?.[2]?.result);
  const hasYes = yesHandle !== ZERO_HANDLE;
  const hasNo = noHandle !== ZERO_HANDLE;
  const hasPosition = hasYes || hasNo;

  const fp = market
    ? [market.question, market.resolved ? 1 : 0, market.outcome, yesHandle, noHandle, alreadyClaimed].join("|")
    : "";

  useEffect(() => {
    if (!market || !hasPosition) {
      onLoad(marketAddress, null);
      return;
    }
    const side: "YES" | "NO" = hasYes ? "YES" : "NO";
    let status: Position["status"];
    if (!market.resolved) status = "open";
    else if (alreadyClaimed) status = "claimed";
    else if (
      market.outcome === "CANCELLED" ||
      (market.outcome === "YES" && hasYes) ||
      (market.outcome === "NO" && hasNo)
    ) status = "claimable";
    else status = "resolved-loss";

    onLoad(marketAddress, {
      marketAddress,
      market,
      side,
      yesOdds,
      noOdds,
      claimable: status === "claimable",
      resolved: market.resolved,
      alreadyClaimed,
      status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketAddress, fp, hasPosition]);

  return null;
}

function PositionRow({ p }: { p: Position }) {
  const router = useRouter();
  const { claimWinnings, isLoading } = useBet(p.marketAddress);
  const yPct = p.yesOdds ? Number(p.yesOdds) / 1e16 : 50;
  const priceCents = p.side === "YES" ? yPct : 100 - yPct;

  let statusNode: React.ReactNode;
  if (p.status === "open") {
    statusNode = (
      <div className="flex items-center gap-2">
        <SqDot kind="open" size={6} />
        <span className="mono text-[10px] tracking-[0.12em] font-bold">OPEN</span>
      </div>
    );
  } else if (p.status === "claimable") {
    statusNode = (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          claimWinnings();
        }}
        disabled={isLoading}
        className="mono text-[10px] tracking-[0.12em] font-bold uppercase px-2.5 py-1 cursor-pointer disabled:opacity-40"
        style={{ background: "var(--y)", color: "var(--k)", border: "2px solid var(--k)" }}
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "CLAIM"}
      </button>
    );
  } else if (p.status === "claimed") {
    statusNode = <span className="mono text-[10px] tracking-[0.12em] font-bold" style={{ color: "var(--green)" }}>✓ CLAIMED</span>;
  } else if (p.status === "resolved-win") {
    statusNode = <span className="mono text-[10px] tracking-[0.12em] font-bold" style={{ color: "var(--green)" }}>✓ WON</span>;
  } else {
    statusNode = <span className="mono text-[10px] tracking-[0.12em] font-bold" style={{ color: "var(--red)" }}>✕ LOST</span>;
  }

  return (
    <Link
      href={`/market/${p.marketAddress}`}
      className="grid items-center gap-2.5 px-4 py-3.5 transition-colors hover:bg-[#F8F8F5]"
      style={{
        gridTemplateColumns: "2.6fr 0.7fr 0.8fr 0.9fr 0.6fr",
        borderTop: "1px solid var(--g1)",
      }}
    >
      <div className="font-semibold text-[13px] truncate">{p.market.question}</div>
      <div>
        <Chip color={p.side === "YES" ? "g" : "r"}>{p.side}</Chip>
      </div>
      <div><EncBadge /></div>
      <div className="mono text-[11px]" style={{ color: "var(--g2)" }}>@ {priceCents.toFixed(0)}¢</div>
      <div className="justify-self-end">{statusNode}</div>
    </Link>
  );
}

function PortfolioContent({ userAddress }: { userAddress: `0x${string}` }) {
  const { data: addresses, isLoading } = useAllMarketAddresses();
  const [positions, setPositions] = useState<Record<string, Position | null>>({});
  const [claimAllLoading, setClaimAllLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const handleLoad = useCallback((addr: `0x${string}`, pos: Position | null) => {
    setPositions((prev) => {
      const existing = prev[addr];
      if (!existing && !pos) return prev;
      if (!existing || !pos) return { ...prev, [addr]: pos };
      if (existing.status === pos.status && existing.side === pos.side) return prev;
      return { ...prev, [addr]: pos };
    });
  }, []);

  const list = useMemo(
    () => Object.values(positions).filter((p): p is Position => !!p),
    [positions],
  );
  const claimables = list.filter((p) => p.status === "claimable");
  const open = list.filter((p) => p.status === "open");

  const filtered = useMemo(() => {
    if (filter === "open") return list.filter((p) => p.status === "open");
    if (filter === "claimable") return list.filter((p) => p.status === "claimable");
    if (filter === "resolved")
      return list.filter(
        (p) => p.status === "resolved-win" || p.status === "resolved-loss" || p.status === "claimed",
      );
    return list;
  }, [list, filter]);

  const onClaimAll = useCallback(async () => {
    if (claimables.length === 0) return;
    setClaimAllLoading(true);
    let done = 0;
    for (const p of claimables) {
      try {
        toast.loading(`Snapshotting ${done + 1} of ${claimables.length}…`, { id: "claim-all" });
        const hash = await writeContractAsync({
          address: p.marketAddress,
          abi: PREDICTION_MARKET_ABI,
          functionName: "claimIntent",
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        done += 1;
      } catch (e: unknown) {
        toast.error(txErrorMessage(e), { id: "claim-all" });
        break;
      }
    }
    toast.success(`Snapshotted ${done} market${done === 1 ? "" : "s"} — open each to settle`, { id: "claim-all" });
    setClaimAllLoading(false);
  }, [claimables, writeContractAsync, publicClient]);

  const exportCSV = () => {
    const rows = [
      ["market", "category", "side", "status"].join(","),
      ...filtered.map((p) =>
        [JSON.stringify(p.market.question), p.market.category, p.side, p.status].join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fhe-market-positions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--g2)" }} />
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div
        className="py-16 text-center mono text-[12px]"
        style={{ border: "2px dashed var(--k)", color: "var(--g2)" }}
      >
        NO MARKETS YET.
      </div>
    );
  }

  const summary = [
    {
      label: "OPEN POSITIONS",
      sub: `${open.length} MARKET${open.length === 1 ? "" : "S"} · REVEALABLE`,
    },
    {
      label: "CLAIMABLE",
      sub: `${claimables.length} SETTLED · PENDING CLAIM`,
    },
    {
      label: "REALIZED PnL · 30D",
      sub: "CIPHERTEXT AGGREGATE",
    },
  ];

  return (
    <>
      {addresses.map((addr) => (
        <PositionLoader key={addr} marketAddress={addr} userAddress={userAddress} onLoad={handleLoad} />
      ))}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        {summary.map((c) => (
          <div
            key={c.label}
            className="p-5 relative"
            style={{ background: "var(--w)", border: "2px solid var(--k)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--k)" }}>
                {c.label}
              </div>
              <Chip color="b">REVEAL</Chip>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  background: "var(--y)",
                  border: "2px solid var(--k)",
                }}
              >
                <LockGlyph size={22} />
              </span>
              <span
                className="display"
                style={{
                  fontSize: 40,
                  lineHeight: 1,
                  color: "var(--k)",
                  letterSpacing: "-0.04em",
                  fontWeight: 700,
                }}
              >
                ENC
              </span>
            </div>
            <div className="mono text-[10px] tracking-[0.12em] mt-3 font-bold" style={{ color: "var(--g2)" }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Position table */}
      <SectionHead
        eyebrow="POSITIONS"
        title="All positions"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "open", "claimable", "resolved"] as Filter[]).map((k) => (
              <button key={k} onClick={() => setFilter(k)}>
                <Chip color={filter === k ? "k" : "w"}>{k.toUpperCase()}</Chip>
              </button>
            ))}
            <Btn kind="ghost" size="sm" onClick={exportCSV}>EXPORT CSV</Btn>
            {claimables.length > 0 && (
              <Btn kind="yellow" size="sm" onClick={onClaimAll} disabled={claimAllLoading}>
                {claimAllLoading ? "WORKING…" : `CLAIM ${claimables.length}`}
              </Btn>
            )}
          </div>
        }
      />

      <div style={{ background: "var(--w)", border: "2px solid var(--k)" }}>
        <div
          className="mono grid gap-2.5 px-4 py-3 text-[10px] tracking-[0.14em] font-bold"
          style={{
            gridTemplateColumns: "2.6fr 0.7fr 0.8fr 0.9fr 0.6fr",
            background: "var(--k)",
            color: "var(--w)",
          }}
        >
          <span>MARKET</span>
          <span>SIDE</span>
          <span>SHARES</span>
          <span>PRICE</span>
          <span className="text-right">STATUS</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center mono text-[11px] tracking-[0.06em]" style={{ color: "var(--g2)" }}>
            NO POSITIONS MATCH THIS FILTER.
          </div>
        ) : (
          filtered.map((p) => <PositionRow key={p.marketAddress} p={p} />)
        )}
      </div>

      <div className="mono mt-4 text-[10px] tracking-[0.12em]" style={{ color: "var(--g2)" }}>
        ENCRYPTED ROWS REQUIRE LOCAL EIP-712 SIGN · NO RPC LEAKS
      </div>
    </>
  );
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey?.[0];
          return typeof key === "string" && key.startsWith("readContract");
        },
      });
      toast.success("Positions refreshed");
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <div style={{ background: "var(--g0)" }}>
      {/* Yellow hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--y)", borderBottom: "2px solid var(--k)" }}
      >
        <PixelDebris count={16} seed={6} />
        <div className="relative z-[3] mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="eyebrow" style={{ color: "var(--k)" }}>
              {isConnected && address ? `WALLET ${shortenAddress(address)}` : "CONNECT WALLET"}
            </div>
            <h1
              className="display m-0 mt-2"
              style={{
                fontSize: "clamp(28px, 5vw, 52px)",
                lineHeight: 1,
                color: "var(--k)",
                letterSpacing: "-0.03em",
              }}
            >
              Your encrypted portfolio.
            </h1>
            <div
              className="mono mt-2 text-[10px] tracking-[0.12em]"
              style={{ color: "var(--k)" }}
            >
              {sepolia.name.toUpperCase()} · CIPHERTEXT POSITIONS
            </div>
          </div>
          {isConnected && (
            <div className="flex gap-2 flex-wrap">
              <Btn kind="primary" size="md" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                REFRESH
              </Btn>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        {!isConnected ? (
          <div
            className="py-16 text-center"
            style={{ border: "2px dashed var(--k)" }}
          >
            <div className="display" style={{ fontSize: 22, color: "var(--k)" }}>
              Connect your wallet
            </div>
            <p className="mono mt-2 text-[11px] tracking-[0.06em]" style={{ color: "var(--g2)" }}>
              CONNECT TO VIEW YOUR ENCRYPTED POSITIONS.
            </p>
          </div>
        ) : (
          <PortfolioContent userAddress={address!} />
        )}
      </div>
    </div>
  );
}
