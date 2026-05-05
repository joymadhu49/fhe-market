// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ICUSDTWrapper {
    function wrap(address to, uint256 amount) external;
}

/// @title Faucet
/// @notice Single-tx in-app cUSDT faucet. Bundles `mint × N` + `approve` +
///         `wrap` so the user only signs one transaction. Underlying mock
///         caps `mint` at 1 USDT per call, so we loop N times internally.
///
///         Frontend call: `faucet.drip(user, 5)` → user gets 5 cUSDT.
contract Faucet {
    IERC20Mintable public immutable usdt;
    ICUSDTWrapper  public immutable cUSDT;

    uint256 public constant USDT_PER_CALL = 1_000_000; // 1 USDT (6 decimals)
    uint8   public constant MAX_UNITS = 50;            // 50 USDT per drip cap

    /// @dev Track first-time approval; `approve(uint256.max)` happens once.
    bool private _approved;

    event Dripped(address indexed to, uint64 units);

    constructor(address _usdt, address _cUSDT) {
        usdt = IERC20Mintable(_usdt);
        cUSDT = ICUSDTWrapper(_cUSDT);
    }

    /// @notice Mint `units × 1 USDT` to this contract, wrap to cUSDT, credit `to`.
    /// @dev    Single user-signed call. Loops `mint` to bypass the mock's
    ///         per-call cap. Approves the wrapper for max once on first use.
    function drip(address to, uint8 units) external {
        require(units > 0 && units <= MAX_UNITS, "units out of range");

        for (uint8 i = 0; i < units; i++) {
            usdt.mint(address(this), USDT_PER_CALL);
        }

        if (!_approved) {
            usdt.approve(address(cUSDT), type(uint256).max);
            _approved = true;
        }

        cUSDT.wrap(to, uint256(units) * USDT_PER_CALL);
        emit Dripped(to, uint64(units));
    }

    /// @notice Re-approve helper if the cap somehow gets exhausted (defensive).
    function reapprove() external {
        usdt.approve(address(cUSDT), type(uint256).max);
        _approved = true;
    }
}
