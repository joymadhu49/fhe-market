// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { FHE, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import { IERC7984 } from "./interfaces/IERC7984.sol";
import { Treasury } from "./Treasury.sol";
import { PredictionMarket } from "./PredictionMarket.sol";

/// @title MarketFactory
/// @notice Deploys binary CPMM prediction markets. Each new market is seeded
///         with cUSDT pulled from the treasury via `confidentialTransfer`.
contract MarketFactory is ZamaEthereumConfig, Ownable {
    IERC7984 public immutable cUSDT;
    Treasury public immutable treasury;

    /// Seed liquidity per market (cUSDT base units, 6 decimals — matches USDT).
    uint64 public defaultSeedLiquidity = 100 * 10**6;       // 100 cUSDT
    uint64 public constant MIN_SEED = 1 * 10**6;            // 1 cUSDT
    uint64 public constant MAX_SEED = 100_000 * 10**6;      // 100k cUSDT

    address[] public allMarkets;

    event MarketCreated(
        address indexed market,
        string  question,
        string  category,
        uint256 resolutionTime,
        uint64  seedLiquidity
    );
    event MarketResolved(address indexed market, bool yesWon);
    event MarketCancelled(address indexed market);
    event SeedLiquidityUpdated(uint64 oldValue, uint64 newValue);

    error SeedOutOfBounds();

    constructor(address _cUSDT, address _owner) Ownable(_owner) {
        cUSDT = IERC7984(_cUSDT);
        treasury = new Treasury(_cUSDT, _owner, address(this));
    }

    function setDefaultSeedLiquidity(uint64 newSeed) external onlyOwner {
        if (newSeed < MIN_SEED || newSeed > MAX_SEED) revert SeedOutOfBounds();
        emit SeedLiquidityUpdated(defaultSeedLiquidity, newSeed);
        defaultSeedLiquidity = newSeed;
    }

    function createMarket(
        string memory question,
        string memory description,
        string memory category,
        string memory imageUrl,
        uint256       resolutionTime
    ) external onlyOwner returns (address) {
        return _createMarket(question, description, category, imageUrl, resolutionTime, defaultSeedLiquidity);
    }

    function createMarketWithSeed(
        string memory question,
        string memory description,
        string memory category,
        string memory imageUrl,
        uint256       resolutionTime,
        uint64        seedLiquidity
    ) external onlyOwner returns (address) {
        if (seedLiquidity < MIN_SEED || seedLiquidity > MAX_SEED) revert SeedOutOfBounds();
        return _createMarket(question, description, category, imageUrl, resolutionTime, seedLiquidity);
    }

    function _createMarket(
        string memory question,
        string memory description,
        string memory category,
        string memory imageUrl,
        uint256       resolutionTime,
        uint64        seedLiquidity
    ) internal returns (address) {
        require(resolutionTime > block.timestamp, "Resolution must be in future");

        // Deploy the market first so we have its address.
        PredictionMarket m = new PredictionMarket(
            address(cUSDT),
            address(treasury),
            address(this),
            question,
            description,
            category,
            imageUrl,
            resolutionTime,
            seedLiquidity
        );

        // Pull cUSDT seed from the treasury directly into the new market.
        // Treasury holds cUSDT; it does the confidentialTransfer to `m`.
        treasury.fundMarket(address(m), seedLiquidity);

        allMarkets.push(address(m));
        emit MarketCreated(address(m), question, category, resolutionTime, seedLiquidity);
        return address(m);
    }

    function resolveMarket(address market, bool yesWon) external onlyOwner {
        PredictionMarket(market).resolve(yesWon);
        emit MarketResolved(market, yesWon);
    }

    function cancelMarket(address market) external onlyOwner {
        PredictionMarket(market).cancel();
        emit MarketCancelled(market);
    }

    /// @notice After resolution, sweep the market's losing-side residual cUSDT
    ///         back to the treasury. Idempotent across markets.
    function reclaimResidual(address market) external onlyOwner returns (uint64) {
        return PredictionMarket(market).withdrawResidual(address(treasury));
    }

    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function getMarketsPaginated(uint256 offset, uint256 limit)
        external view returns (address[] memory)
    {
        uint256 total = allMarkets.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 size = end - offset;
        address[] memory result = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = allMarkets[offset + i];
        }
        return result;
    }
}
