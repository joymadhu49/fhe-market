// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { FHE, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import { IERC7984 } from "./interfaces/IERC7984.sol";

/// @title Treasury
/// @notice Holds cUSDT (ERC-7984) for the arcbet-fhe protocol: seeds new market
///         liquidity and receives platform fees. The on-chain cUSDT balance is
///         encrypted; only the owner (via EIP-712 user-decrypt) can read it.
contract Treasury is ZamaEthereumConfig, Ownable {
    IERC7984 public immutable cUSDT;
    address public immutable factory;

    /// fee basis points (100 = 1%)
    uint256 public feeBps = 150; // 1.5%
    uint256 public constant MAX_FEE_BPS = 500; // 5% max

    /// Lifetime cleartext seed cUSDT sent to markets. Public.
    uint256 public totalSeededOut;

    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event MarketFunded(address indexed market, uint64 amount);
    event Withdrawn(address indexed to, uint64 amount);

    error NotFactory();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    constructor(address _cUSDT, address _owner, address _factory) Ownable(_owner) {
        cUSDT = IERC7984(_cUSDT);
        factory = _factory;
        // Allow caller (owner / view fns) to read the treasury's encrypted cUSDT
        // balance via standard ERC-7984 user-decrypt flow. Nothing to wire here —
        // cUSDT itself manages ACL on its internal balance mappings.
    }

    /// @notice Factory pulls a market seed. We send cUSDT directly to `dest`
    ///         (the new market), so the factory does not need to hold cUSDT.
    function fundMarket(address dest, uint64 amount) external onlyFactory {
        totalSeededOut += amount;
        euint64 enc = FHE.asEuint64(amount);
        FHE.allowTransient(enc, address(cUSDT));
        cUSDT.confidentialTransfer(dest, enc);
        emit MarketFunded(dest, amount);
    }

    /// @notice Owner-only withdraw of a cleartext amount (for treasury rebalancing).
    ///         The transferred amount is publicly logged; the on-chain balance
    ///         remains encrypted at the cUSDT layer.
    function withdraw(address to, uint64 amount) external onlyOwner {
        euint64 enc = FHE.asEuint64(amount);
        FHE.allowTransient(enc, address(cUSDT));
        cUSDT.confidentialTransfer(to, enc);
        emit Withdrawn(to, amount);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        emit FeeBpsUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    /// @notice Encrypted cUSDT balance of treasury. Owner can user-decrypt off-chain.
    function balanceHandle() external view returns (euint64) {
        return cUSDT.confidentialBalanceOf(address(this));
    }
}
