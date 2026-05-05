export type Outcome = "UNRESOLVED" | "YES" | "NO" | "CANCELLED";

export interface MarketData {
  address: `0x${string}`;
  question: string;
  description: string;
  category: string;
  imageUrl: string;
  resolutionTime: number;
  /** LP seed cUSDT locked into the FPMM at market creation. */
  seedLiquidity: bigint;
  /** Live CPMM reserves. */
  yesReserve: bigint;
  noReserve: bigint;
  outcome: Outcome;
  resolved: boolean;
}

export interface UserPosition {
  market: `0x${string}`;
  yesShares: bigint;
  noShares: bigint;
  claimed: boolean;
}

export type BetSide = "YES" | "NO";

export interface BetFormState {
  side: BetSide;
  amount: string;
  token: string;
  chain: string;
}
