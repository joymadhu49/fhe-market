// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { IERC7984 } from "./interfaces/IERC7984.sol";

interface ITreasury {
    function feeBps() external view returns (uint256);
}

/// @title PredictionMarket (FHEVM CPMM)
/// @notice Binary YES/NO prediction market with encrypted per-user share balances
///         backed by cUSDT (ERC-7984). Buy/sell/claim use a 2-step
///         "intent → execute" pattern: an intent locks an encrypted ciphertext
///         and marks it publicly decryptable; the execute step verifies the
///         relayer-provided cleartext + KMS proof via `FHE.checkSignatures` and
///         then runs CPMM math + cUSDT settlement on the verified value.
///
///         Privacy model:
///         - Per-user YES/NO share balances: ENCRYPTED (`euint64`).
///         - Pool reserves (`yesReserve`, `noReserve`): PUBLIC (CPMM pricing
///           requires cleartext arithmetic).
///         - Bet/sell/claim amounts: revealed at execute-time (relayer
///           publicDecrypt). Linkability across actions stays low because the
///           encrypted balance hides cumulative position.
contract PredictionMarket is ZamaEthereumConfig, ReentrancyGuard {
    using Math for uint256;

    enum Outcome { UNRESOLVED, YES, NO, CANCELLED }

    struct Market {
        string  question;
        string  description;
        string  category;
        string  imageUrl;
        uint256 resolutionTime;
        uint64  seedLiquidity;
        Outcome outcome;
        bool    resolved;
    }

    struct PendingBuy {
        bool    active;
        bool    isYes;
        uint256 minSharesOut;
    }

    struct PendingSell {
        bool    active;
        bool    isYes;
        uint256 minAmountOut;
    }

    struct PendingClaim {
        bool    active;
        Outcome outcome;
    }

    IERC7984  public immutable cUSDT;
    ITreasury public immutable treasury;
    address   public immutable factory;

    Market public market;

    /// CPMM pool reserves (public, in cUSDT base units / 1e6).
    uint256 public yesReserve;
    uint256 public noReserve;

    /// Cleartext bookkeeping of cUSDT held by this market — updated at every
    /// settled action so the LP can sweep residual cleanly post-resolution.
    uint64 public cUSDTHeld;

    /// Encrypted per-user share balances.
    mapping(address => euint64) private _yesShares;
    mapping(address => euint64) private _noShares;
    mapping(address => bool) public claimed;

    /// Intent snapshots — hidden ciphertext that gets publicly decrypted.
    mapping(address => euint64) private _pendingBuyAmount;
    mapping(address => euint64) private _pendingSellShares;
    mapping(address => euint64) private _pendingClaimAmount;

    mapping(address => PendingBuy)   public pendingBuys;
    mapping(address => PendingSell)  public pendingSells;
    mapping(address => PendingClaim) public pendingClaims;

    /// Minimum cleartext bet/sell size (0.01 cUSDT) so fees never round to zero.
    uint64 public constant MIN_AMOUNT = 10_000;

    event BuyIntent(address indexed user, bool isYes);
    event BetBought(address indexed user, bool isYes, uint64 amountIn, uint256 sharesOut, uint64 fee);
    event SellIntent(address indexed user, bool isYes);
    event BetSold(address indexed user, bool isYes, uint64 sharesIn, uint64 amountOut, uint64 fee);
    event MarketResolved(Outcome outcome);
    event ClaimIntent(address indexed user);
    event WinningsClaimed(address indexed user, uint64 amount);
    event MarketCancelled();

    error MarketClosed();
    error MarketNotClosed();
    error AlreadyResolved();
    error NotResolved();
    error AlreadyClaimed();
    error ZeroAmount();
    error BetTooSmall();
    error NotFactory();
    error PendingActive();
    error NoPending();
    error Slippage();
    error SellExceedsLiquidity();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    constructor(
        address _cUSDT,
        address _treasury,
        address _factory,
        string memory _question,
        string memory _description,
        string memory _category,
        string memory _imageUrl,
        uint256 _resolutionTime,
        uint64  _seedLiquidity
    ) {
        require(_seedLiquidity >= MIN_AMOUNT, "seed too small");
        cUSDT    = IERC7984(_cUSDT);
        treasury = ITreasury(_treasury);
        factory  = _factory;

        market = Market({
            question:       _question,
            description:    _description,
            category:       _category,
            imageUrl:       _imageUrl,
            resolutionTime: _resolutionTime,
            seedLiquidity:  _seedLiquidity,
            outcome:        Outcome.UNRESOLVED,
            resolved:       false
        });

        // Treasury seeds liquidity by `confidentialTransfer`-ing `_seedLiquidity`
        // cUSDT to this contract immediately after construction.
        yesReserve = _seedLiquidity;
        noReserve  = _seedLiquidity;
        cUSDTHeld  = _seedLiquidity;
    }

    // ── Buy: intent / execute ─────────────────────────────────

    /// @notice Step 1 of buy. User must have called
    ///         `cUSDT.setOperator(market, until)` before this. Pulls the
    ///         encrypted amount via cUSDT, snapshots the actually-transferred
    ///         ciphertext, and marks it publicly decryptable.
    function buyIntent(
        bool             isYes,
        externalEuint64  encAmount,
        bytes calldata   inputProof,
        uint256          minSharesOut
    ) external nonReentrant {
        if (market.resolved || block.timestamp >= market.resolutionTime) revert MarketClosed();
        if (pendingBuys[msg.sender].active) revert PendingActive();

        euint64 amount = FHE.fromExternal(encAmount, inputProof);
        FHE.allowTransient(amount, address(cUSDT));
        euint64 transferred = cUSDT.confidentialTransferFrom(msg.sender, address(this), amount);

        _pendingBuyAmount[msg.sender] = transferred;
        FHE.allowThis(transferred);
        FHE.allow(transferred, msg.sender);
        FHE.makePubliclyDecryptable(transferred);

        pendingBuys[msg.sender] = PendingBuy({ active: true, isYes: isYes, minSharesOut: minSharesOut });
        emit BuyIntent(msg.sender, isYes);
    }

    /// @notice Step 2 of buy. Anyone (typically the user) submits the
    ///         relayer-decrypted cleartext + KMS proof. Runs CPMM math on the
    ///         verified amount, mints encrypted shares to `user`, and forwards
    ///         the platform fee to the treasury.
    function executeBuy(address user, uint64 cleartextAmount, bytes calldata decryptionProof)
        external
        nonReentrant
    {
        PendingBuy memory p = pendingBuys[user];
        if (!p.active) revert NoPending();

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_pendingBuyAmount[user]);
        FHE.checkSignatures(handles, abi.encode(cleartextAmount), decryptionProof);

        delete pendingBuys[user];

        if (cleartextAmount == 0) {
            // Underfunded intent: cUSDT pulled 0. No CPMM update, no shares.
            emit BetBought(user, p.isYes, 0, 0, 0);
            return;
        }

        // Cleartext CPMM math.
        uint64 feeBps  = uint64(treasury.feeBps());
        uint64 fee     = uint64((uint256(cleartextAmount) * feeBps) / 10_000);
        uint64 net     = cleartextAmount - fee;
        cUSDTHeld     += cleartextAmount;

        uint256 yOld = yesReserve;
        uint256 nOld = noReserve;
        uint256 k    = yOld * nOld;
        uint256 sharesOut;

        if (p.isYes) {
            uint256 nNew = nOld + uint256(net);
            uint256 yNew = Math.ceilDiv(k, nNew);
            sharesOut    = uint256(net) + (yOld - yNew);
            yesReserve   = yNew;
            noReserve    = nNew;
        } else {
            uint256 yNew = yOld + uint256(net);
            uint256 nNew = Math.ceilDiv(k, yNew);
            sharesOut    = uint256(net) + (nOld - nNew);
            yesReserve   = yNew;
            noReserve    = nNew;
        }
        if (sharesOut < p.minSharesOut) revert Slippage();
        require(sharesOut <= type(uint64).max, "shares overflow");

        // Encrypted user share balance update.
        euint64 prev = p.isYes ? _yesShares[user] : _noShares[user];
        if (!FHE.isInitialized(prev)) prev = FHE.asEuint64(0);
        euint64 next = FHE.add(prev, FHE.asEuint64(uint64(sharesOut)));
        if (p.isYes) {
            _yesShares[user] = next;
        } else {
            _noShares[user] = next;
        }
        FHE.allowThis(next);
        FHE.allow(next, user);

        // Forward fee to treasury.
        if (fee > 0) {
            euint64 encFee = FHE.asEuint64(fee);
            FHE.allowTransient(encFee, address(cUSDT));
            cUSDT.confidentialTransfer(address(treasury), encFee);
            cUSDTHeld -= fee;
        }

        emit BetBought(user, p.isYes, cleartextAmount, sharesOut, fee);
    }

    // ── Sell: intent / execute ────────────────────────────────

    /// @notice Step 1 of sell. Encrypts user's intended share count, clamps it
    ///         branchlessly to the user's current encrypted balance, debits
    ///         shares immediately, and snapshots the clamped amount publicly.
    function sellIntent(
        bool             isYes,
        externalEuint64  encShares,
        bytes calldata   inputProof,
        uint256          minAmountOut
    ) external nonReentrant {
        if (market.resolved || block.timestamp >= market.resolutionTime) revert MarketClosed();
        if (pendingSells[msg.sender].active) revert PendingActive();

        euint64 shares = FHE.fromExternal(encShares, inputProof);

        euint64 bal = isYes ? _yesShares[msg.sender] : _noShares[msg.sender];
        if (!FHE.isInitialized(bal)) bal = FHE.asEuint64(0);

        ebool   ok          = FHE.le(shares, bal);
        euint64 actualShares = FHE.select(ok, shares, FHE.asEuint64(0));

        euint64 newBal = FHE.sub(bal, actualShares);
        if (isYes) {
            _yesShares[msg.sender] = newBal;
        } else {
            _noShares[msg.sender] = newBal;
        }
        FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);

        _pendingSellShares[msg.sender] = actualShares;
        FHE.allowThis(actualShares);
        FHE.allow(actualShares, msg.sender);
        FHE.makePubliclyDecryptable(actualShares);

        pendingSells[msg.sender] = PendingSell({ active: true, isYes: isYes, minAmountOut: minAmountOut });
        emit SellIntent(msg.sender, isYes);
    }

    /// @notice Step 2 of sell. Verifies the cleartext clamped share count via
    ///         KMS proof, runs CPMM swap on cleartext, pays user (cUSDT) and
    ///         treasury (fee).
    function executeSell(address user, uint64 cleartextShares, bytes calldata decryptionProof)
        external
        nonReentrant
    {
        PendingSell memory p = pendingSells[user];
        if (!p.active) revert NoPending();

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_pendingSellShares[user]);
        FHE.checkSignatures(handles, abi.encode(cleartextShares), decryptionProof);

        delete pendingSells[user];

        if (cleartextShares == 0) {
            emit BetSold(user, p.isYes, 0, 0, 0);
            return;
        }

        uint256 grossOut = _computeSellOut(p.isYes, uint256(cleartextShares));
        require(grossOut > 0, "gross zero");
        if (grossOut >= noReserve || grossOut >= yesReserve) revert SellExceedsLiquidity();

        uint64 feeBps    = uint64(treasury.feeBps());
        uint64 fee       = uint64((grossOut * feeBps) / 10_000);
        uint64 amountOut = uint64(grossOut) - fee;

        if (uint256(amountOut) < p.minAmountOut) revert Slippage();

        // Update reserves.
        if (p.isYes) {
            yesReserve += (uint256(cleartextShares) - grossOut);
            noReserve  -= grossOut;
        } else {
            noReserve  += (uint256(cleartextShares) - grossOut);
            yesReserve -= grossOut;
        }

        // Pay treasury fee + user payout.
        if (fee > 0) {
            euint64 encFee = FHE.asEuint64(fee);
            FHE.allowTransient(encFee, address(cUSDT));
            cUSDT.confidentialTransfer(address(treasury), encFee);
        }
        if (amountOut > 0) {
            euint64 encOut = FHE.asEuint64(amountOut);
            FHE.allowTransient(encOut, address(cUSDT));
            cUSDT.confidentialTransfer(user, encOut);
        }
        cUSDTHeld -= (amountOut + fee);

        emit BetSold(user, p.isYes, cleartextShares, amountOut, fee);
    }

    function _computeSellOut(bool isYes, uint256 sharesIn) internal view returns (uint256) {
        uint256 Y = yesReserve;
        uint256 N = noReserve;
        uint256 oppReserve = isYes ? N : Y;
        uint256 b = Y + N + sharesIn;
        uint256 disc = b * b - 4 * sharesIn * oppReserve;
        uint256 root = Math.sqrt(disc);
        return (b - root) / 2;
    }

    // ── Resolution ────────────────────────────────────────────

    function resolve(bool yesWon) external onlyFactory {
        if (market.resolved) revert AlreadyResolved();
        market.resolved = true;
        market.outcome  = yesWon ? Outcome.YES : Outcome.NO;
        emit MarketResolved(market.outcome);
    }

    function cancel() external onlyFactory {
        if (market.resolved) revert AlreadyResolved();
        market.resolved = true;
        market.outcome  = Outcome.CANCELLED;
        emit MarketCancelled();
    }

    // ── Claim: intent / execute ───────────────────────────────

    /// @notice Step 1 of claim. Snapshots the user's winning encrypted balance,
    ///         zeroes the relevant share mappings, and marks the snapshot
    ///         publicly decryptable.
    function claimIntent() external nonReentrant {
        if (!market.resolved) revert NotResolved();
        if (claimed[msg.sender]) revert AlreadyClaimed();
        if (pendingClaims[msg.sender].active) revert PendingActive();

        Outcome o = market.outcome;
        euint64 winShares;

        if (o == Outcome.YES) {
            winShares = _yesShares[msg.sender];
            if (!FHE.isInitialized(winShares)) winShares = FHE.asEuint64(0);
            _yesShares[msg.sender] = FHE.asEuint64(0);
            FHE.allowThis(_yesShares[msg.sender]);
            FHE.allow(_yesShares[msg.sender], msg.sender);
        } else if (o == Outcome.NO) {
            winShares = _noShares[msg.sender];
            if (!FHE.isInitialized(winShares)) winShares = FHE.asEuint64(0);
            _noShares[msg.sender] = FHE.asEuint64(0);
            FHE.allowThis(_noShares[msg.sender]);
            FHE.allow(_noShares[msg.sender], msg.sender);
        } else {
            // CANCELLED: refund both sides.
            euint64 y = _yesShares[msg.sender];
            if (!FHE.isInitialized(y)) y = FHE.asEuint64(0);
            euint64 n = _noShares[msg.sender];
            if (!FHE.isInitialized(n)) n = FHE.asEuint64(0);
            winShares = FHE.add(y, n);
            _yesShares[msg.sender] = FHE.asEuint64(0);
            _noShares[msg.sender]  = FHE.asEuint64(0);
            FHE.allowThis(_yesShares[msg.sender]);
            FHE.allow(_yesShares[msg.sender], msg.sender);
            FHE.allowThis(_noShares[msg.sender]);
            FHE.allow(_noShares[msg.sender], msg.sender);
        }

        _pendingClaimAmount[msg.sender] = winShares;
        FHE.allowThis(winShares);
        FHE.allow(winShares, msg.sender);
        FHE.makePubliclyDecryptable(winShares);

        claimed[msg.sender] = true;
        pendingClaims[msg.sender] = PendingClaim({ active: true, outcome: o });
        emit ClaimIntent(msg.sender);
    }

    /// @notice Step 2 of claim. Verifies cleartext via KMS proof and pays cUSDT.
    function executeClaim(address user, uint64 cleartextAmount, bytes calldata decryptionProof)
        external
        nonReentrant
    {
        PendingClaim memory p = pendingClaims[user];
        if (!p.active) revert NoPending();

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_pendingClaimAmount[user]);
        FHE.checkSignatures(handles, abi.encode(cleartextAmount), decryptionProof);

        delete pendingClaims[user];

        if (cleartextAmount > 0) {
            euint64 encOut = FHE.asEuint64(cleartextAmount);
            FHE.allowTransient(encOut, address(cUSDT));
            cUSDT.confidentialTransfer(user, encOut);
            cUSDTHeld -= cleartextAmount;
        }

        emit WinningsClaimed(user, cleartextAmount);
    }

    /// @notice After resolution, factory sweeps the residual cUSDT (LP profit
    ///         + losing-side capital) back to the treasury. Pass an exact
    ///         cleartext amount equal to current `cUSDTHeld`; cUSDT will only
    ///         transfer if this contract holds at least that much.
    function withdrawResidual(address to) external onlyFactory returns (uint64 amount) {
        if (!market.resolved) revert MarketNotClosed();
        amount = cUSDTHeld;
        if (amount == 0) return 0;
        cUSDTHeld = 0;
        euint64 encOut = FHE.asEuint64(amount);
        FHE.allowTransient(encOut, address(cUSDT));
        cUSDT.confidentialTransfer(to, encOut);
    }

    // ── Views ─────────────────────────────────────────────────

    function getMarket() external view returns (Market memory) {
        return market;
    }

    /// @notice Encrypted YES-share balance handle. Frontend user-decrypts via EIP-712.
    function yesSharesHandle(address user) external view returns (euint64) {
        return _yesShares[user];
    }

    /// @notice Encrypted NO-share balance handle. Frontend user-decrypts via EIP-712.
    function noSharesHandle(address user) external view returns (euint64) {
        return _noShares[user];
    }

    /// @notice Snapshot handle of a user's pending buy (publicly decryptable).
    function pendingBuyHandle(address user) external view returns (euint64) {
        return _pendingBuyAmount[user];
    }

    function pendingSellHandle(address user) external view returns (euint64) {
        return _pendingSellShares[user];
    }

    function pendingClaimHandle(address user) external view returns (euint64) {
        return _pendingClaimAmount[user];
    }

    /// @notice Current YES odds (1e18 = 100%) from CPMM spot: N / (Y + N).
    function yesOdds() external view returns (uint256) {
        uint256 total = yesReserve + noReserve;
        if (total == 0) return 0.5e18;
        return (noReserve * 1e18) / total;
    }

    function noOdds() external view returns (uint256) {
        uint256 total = yesReserve + noReserve;
        if (total == 0) return 0.5e18;
        return (yesReserve * 1e18) / total;
    }

    /// @notice Quote how many shares `amountIn` cUSDT buys (net of fee). Public preview.
    function previewBuy(bool isYes, uint64 amountIn) external view returns (uint256 sharesOut) {
        if (amountIn < MIN_AMOUNT) return 0;
        uint64 feeBps = uint64(treasury.feeBps());
        uint64 net    = amountIn - uint64((uint256(amountIn) * feeBps) / 10_000);
        uint256 k     = yesReserve * noReserve;
        if (isYes) {
            uint256 nNew = noReserve + uint256(net);
            uint256 yNew = Math.ceilDiv(k, nNew);
            sharesOut    = uint256(net) + (yesReserve - yNew);
        } else {
            uint256 yNew = yesReserve + uint256(net);
            uint256 nNew = Math.ceilDiv(k, yNew);
            sharesOut    = uint256(net) + (noReserve - nNew);
        }
    }

    /// @notice Preview gross sell output (pre-fee) for a cleartext sharesIn.
    function previewSell(bool isYes, uint64 sharesIn) external view returns (uint256 grossOut) {
        if (sharesIn == 0) return 0;
        grossOut = _computeSellOut(isYes, uint256(sharesIn));
    }

    function totalPool() external view returns (uint256) {
        return yesReserve + noReserve;
    }
}
