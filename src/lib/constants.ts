export const FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

export const TREASURY_ADDRESS =
  (process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

export const FAUCET_ADDRESS =
  (process.env.NEXT_PUBLIC_FAUCET_ADDRESS as `0x${string}`) ||
  "0x83D2B20D96e443f3fd7c248582d8Fd4A0Ab1124B";

/**
 * cUSDT — confidential USDT (ERC-7984) on Sepolia. Settlement token.
 * https://sepolia.etherscan.io/address/0x4E7B06D78965594eB5EF5414c357ca21E1554491
 */
export const CUSDT_ADDRESS =
  (process.env.NEXT_PUBLIC_CUSDT_ADDRESS as `0x${string}`) ||
  "0x4E7B06D78965594eB5EF5414c357ca21E1554491";

export const CUSDT_DECIMALS = 6;

/**
 * USDTMock — public-mintable underlying for cUSDT. Pre-cUSDT step is
 * `mint(address,uint256)` (1 USDT cap per call), then `cUSDT.deposit(amount)`
 * to wrap. Useful for the demo "fund my wallet" button.
 */
export const USDT_MOCK_ADDRESS =
  (process.env.NEXT_PUBLIC_USDT_MOCK_ADDRESS as `0x${string}`) ||
  "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0";

export const CATEGORIES = ["All", "Crypto", "Sports", "Politics", "Tech", "Entertainment"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLATFORM_FEE_BPS = 150; // 1.5%

export const ADMIN_ADDRESS = (
  process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? ""
).toLowerCase() as `0x${string}` | "";

export const MARKET_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
  CANCELLED: "cancelled",
} as const;

/**
 * Default operator window for cUSDT.setOperator (24 hours).
 * After this, user must re-grant operator status to the market.
 */
export const OPERATOR_WINDOW_SECONDS = 24 * 3600;
