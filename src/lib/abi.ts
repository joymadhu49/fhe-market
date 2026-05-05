export const MARKET_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_cUSDT", type: "address" },
      { internalType: "address", name: "_owner", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      { internalType: "string",  name: "question",       type: "string" },
      { internalType: "string",  name: "description",    type: "string" },
      { internalType: "string",  name: "category",       type: "string" },
      { internalType: "string",  name: "imageUrl",       type: "string" },
      { internalType: "uint256", name: "resolutionTime", type: "uint256" },
    ],
    name: "createMarket",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string",  name: "question",       type: "string" },
      { internalType: "string",  name: "description",    type: "string" },
      { internalType: "string",  name: "category",       type: "string" },
      { internalType: "string",  name: "imageUrl",       type: "string" },
      { internalType: "uint256", name: "resolutionTime", type: "uint256" },
      { internalType: "uint64",  name: "seedLiquidity",  type: "uint64" },
    ],
    name: "createMarketWithSeed",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "market", type: "address" },
      { internalType: "bool",    name: "yesWon", type: "bool" },
    ],
    name: "resolveMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "market", type: "address" }],
    name: "cancelMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "market", type: "address" }],
    name: "reclaimResidual",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllMarkets",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMarketCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "treasury",             outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "defaultSeedLiquidity", outputs: [{ type: "uint64"  }], stateMutability: "view", type: "function" },
  { inputs: [], name: "owner",                outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "cUSDT",                outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;

export const PREDICTION_MARKET_ABI = [
  // ── Buy intent / execute ──
  {
    inputs: [
      { internalType: "bool",            name: "isYes",        type: "bool" },
      { internalType: "externalEuint64", name: "encAmount",    type: "bytes32" },
      { internalType: "bytes",           name: "inputProof",   type: "bytes" },
      { internalType: "uint256",         name: "minSharesOut", type: "uint256" },
    ],
    name: "buyIntent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "user",            type: "address" },
      { internalType: "uint64",  name: "cleartextAmount", type: "uint64" },
      { internalType: "bytes",   name: "decryptionProof", type: "bytes" },
    ],
    name: "executeBuy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Sell intent / execute ──
  {
    inputs: [
      { internalType: "bool",            name: "isYes",        type: "bool" },
      { internalType: "externalEuint64", name: "encShares",    type: "bytes32" },
      { internalType: "bytes",           name: "inputProof",   type: "bytes" },
      { internalType: "uint256",         name: "minAmountOut", type: "uint256" },
    ],
    name: "sellIntent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "user",            type: "address" },
      { internalType: "uint64",  name: "cleartextShares", type: "uint64" },
      { internalType: "bytes",   name: "decryptionProof", type: "bytes" },
    ],
    name: "executeSell",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Claim intent / execute ──
  { inputs: [], name: "claimIntent", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "user",            type: "address" },
      { internalType: "uint64",  name: "cleartextAmount", type: "uint64" },
      { internalType: "bytes",   name: "decryptionProof", type: "bytes" },
    ],
    name: "executeClaim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Views ──
  {
    inputs: [],
    name: "getMarket",
    outputs: [
      {
        components: [
          { internalType: "string",  name: "question",       type: "string" },
          { internalType: "string",  name: "description",    type: "string" },
          { internalType: "string",  name: "category",       type: "string" },
          { internalType: "string",  name: "imageUrl",       type: "string" },
          { internalType: "uint256", name: "resolutionTime", type: "uint256" },
          { internalType: "uint64",  name: "seedLiquidity",  type: "uint64" },
          { internalType: "uint8",   name: "outcome",        type: "uint8" },
          { internalType: "bool",    name: "resolved",       type: "bool" },
        ],
        internalType: "struct PredictionMarket.Market",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "yesSharesHandle",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "noSharesHandle",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "pendingBuyHandle",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "pendingSellHandle",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "pendingClaimHandle",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "pendingBuys",
    outputs: [
      { internalType: "bool",    name: "active",       type: "bool" },
      { internalType: "bool",    name: "isYes",        type: "bool" },
      { internalType: "uint256", name: "minSharesOut", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "pendingSells",
    outputs: [
      { internalType: "bool",    name: "active",       type: "bool" },
      { internalType: "bool",    name: "isYes",        type: "bool" },
      { internalType: "uint256", name: "minAmountOut", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "pendingClaims",
    outputs: [
      { internalType: "bool",  name: "active",  type: "bool" },
      { internalType: "uint8", name: "outcome", type: "uint8" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bool",   name: "isYes",    type: "bool" },
      { internalType: "uint64", name: "amountIn", type: "uint64" },
    ],
    name: "previewBuy",
    outputs: [{ internalType: "uint256", name: "sharesOut", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bool",   name: "isYes",    type: "bool" },
      { internalType: "uint64", name: "sharesIn", type: "uint64" },
    ],
    name: "previewSell",
    outputs: [{ internalType: "uint256", name: "grossOut", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "yesOdds",    outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "noOdds",     outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalPool",  outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "yesReserve", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "noReserve",  outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "cUSDTHeld",  outputs: [{ type: "uint64"  }], stateMutability: "view", type: "function" },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "claimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Minimal IERC7984 ABI (cUSDT). For FHE Market the only call we make from the
 * frontend is `setOperator(address operator, uint48 until)` — buys/sells
 * happen through the market contract.
 */
export const ERC7984_ABI = [
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      { internalType: "uint48",  name: "until",    type: "uint48"  },
    ],
    name: "setOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "holder",  type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "isOperator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  // confidentialTransfer (externalEuint64 + proof variant — what the frontend uses)
  {
    inputs: [
      { internalType: "address",         name: "to",              type: "address" },
      { internalType: "externalEuint64", name: "encryptedAmount", type: "bytes32" },
      { internalType: "bytes",           name: "inputProof",      type: "bytes"   },
    ],
    name: "confidentialTransfer",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // confidentialTransferFrom (operator pull — used by markets)
  {
    inputs: [
      { internalType: "address",         name: "from",            type: "address" },
      { internalType: "address",         name: "to",              type: "address" },
      { internalType: "externalEuint64", name: "encryptedAmount", type: "bytes32" },
      { internalType: "bytes",           name: "inputProof",      type: "bytes"   },
    ],
    name: "confidentialTransferFrom",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Legacy alias: kept so callers using `ERC20_ABI` for cUSDT setOperator still
 * compile during the port. Prefer `ERC7984_ABI` going forward.
 */
export const ERC20_ABI = ERC7984_ABI;

/**
 * USDTMock — public-mintable underlying for cUSDT. Cap: 1 USDT per `mint` call.
 * Used by the in-app faucet.
 */
export const USDT_MOCK_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to",     type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount",  type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Confidential ERC-7984 wrapper — `wrap(to, amount)` turns underlying USDT
 * into encrypted cUSDT credited to `to`.
 */
export const CUSDT_WRAPPER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to",     type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "wrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Faucet — single-tx mint+approve+wrap helper. `drip(to, units)` where
 * `units` is whole USDT (e.g. 5 = 5 cUSDT credited to `to`).
 */
export const FAUCET_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to",    type: "address" },
      { internalType: "uint8",   name: "units", type: "uint8"   },
    ],
    name: "drip",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
