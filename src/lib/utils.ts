import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CUSDT_DECIMALS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(raw: bigint): string {
  const n = Number(raw) / 10 ** CUSDT_DECIMALS;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function parseUSDC(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * 10 ** CUSDT_DECIMALS));
}

/** cUSDT-aware aliases. */
export const formatCUSDT = formatUSDC;
export const parseCUSDT = parseUSDC;

export function formatOdds(raw: bigint): string {
  // raw is scaled 1e18
  const pct = Number(raw) / 1e16; // → percentage
  return `${pct.toFixed(1)}%`;
}

export function formatPayout(odds: bigint, betAmount: bigint): string {
  if (odds === BigInt(0)) return "$0.00";
  const payout = (betAmount * BigInt("1000000000000000000")) / odds;
  return formatUSDC(payout);
}

export function timeLeft(resolutionTime: number): string {
  const diff = resolutionTime * 1000 - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Compact $ format: $1.23M / $45.6K / $123 — for densely packed cells. */
export function fmtUSD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Compact bigint cUSDT value using the 6-decimal scale. */
export function fmtUSDCCompact(raw: bigint): string {
  const n = Number(raw) / 10 ** CUSDT_DECIMALS;
  return fmtUSD(n);
}

export const fmtCUSDTCompact = fmtUSDCCompact;

/** Short-form number: 1.2M / 45K / 123 (no dollar sign). */
export function fmtShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/**
 * Deterministic seeded sparkline generator from an address — stays stable
 * across rerenders so the card doesn't flicker, but varies per market.
 */
export function seededSparkline(seed: string, length = 28, currentPct = 50): number[] {
  // Fast hash of the seed to a 32-bit number
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out: number[] = [];
  let v = currentPct / 100;
  for (let i = 0; i < length; i++) {
    v = Math.max(0.05, Math.min(0.95, v + Math.sin(i * 0.6 + currentPct) * 0.06 + (rand() - 0.5) * 0.03));
    out.push(v);
  }
  out[out.length - 1] = currentPct / 100;
  return out;
}
