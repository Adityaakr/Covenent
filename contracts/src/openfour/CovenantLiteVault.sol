// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {BaseTaxVault} from "src/vendor/openfour/taxvault/BaseTaxVault.sol";
import {ModuleEncodeSchema, ParamDescriptor} from "src/vendor/openfour/libraries/OpenFourTypes.sol";

/// @title CovenantLiteVault
/// @notice Rules 1 and 4 of Covenant for any Four.meme tax token, as an OpenFour tax vault template on the
///         Unverified Royalty path. The platform's ForwardVault clones this template (EIP-1167) as the token's
///         founder recipient, so the founder's share of trading tax lands here instead of in the founder's wallet.
///
///   Tap        the founder (owner) withdraws at most `tapBps` of the treasury per `tapPeriod`. A heartbeat.
///   Switch     if the founder is silent past `heartbeat`, anyone opens the treasury; the founder can also wind
///              down. Either way holders then burn tokens for a pro rata share, less `redeemFeeBps` (kept by the
///              treasury for those who stay).
///
///   The treasury holds whatever the receipts were: native BNB, the quote ERC20 (for example WBNB), or both. Every
///   payout splits both pro rata. ForwardVault takes its ~6% royalty for `authorWallet()` before forwarding.
/// @dev Limits (from OpenFour's mechanism doc): `updateShares` is not forwarded, so redemption burns tokens instead
///      of tracking holders. Redeemable supply excludes the burn address, this vault and the token contract
///      itself; tokens still unsold on the inner market count, which lowers the per-token payout until migration.
contract CovenantLiteVault is BaseTaxVault, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant TYPE_ID = keccak256("Covenant.LiteVault.v1");
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal constant BPS = 10_000;

    /// @dev Covenant's own tap bounds (L-12): at most 10% of the treasury per period, periods of at least 30 days.
    uint256 public constant MAX_TAP_BPS = 1_000;
    uint256 public constant MIN_TAP_PERIOD = 30 days;
    uint256 public constant MAX_TAP_PERIOD = 90 days;
    uint256 public constant MIN_HEARTBEAT = 7 days;
    uint256 public constant MAX_HEARTBEAT = 180 days;
    uint256 public constant MAX_REDEEM_FEE_BPS = 300;

    /// @notice Template author: receives ForwardVault's royalty. Immutable, so every clone reads the same.
    address public immutable AUTHOR;

    struct Params {
        uint16 tapBps;
        uint32 tapPeriod;
        uint32 heartbeat;
        uint16 redeemFeeBps;
    }

    Params public params;
    uint64 public startedAt;
    uint64 public lastHeartbeat;
    bool public open;
    bool public abandoned;

    uint256 public periodIndex;
    uint256 public periodBaseNative;
    uint256 public periodBaseQuote;
    uint256 public periodSpentNative;
    uint256 public periodSpentQuote;

    uint256 public tapPaidNative;
    uint256 public tapPaidQuote;
    uint256 public tokensBurned;

    event TapWithdrawn(address indexed to, uint256 native, uint256 quote);
    event Heartbeat(uint256 at);
    event Opened(bool abandoned, uint256 at);
    event Redeemed(address indexed account, uint256 tokens, uint256 native, uint256 quote);

    error BadParams();
    error Closed();
    error AlreadyOpen();
    error NotAbandoned(uint256 deadline);
    error NothingToWithdraw();
    error ZeroAmount();
    error Slippage();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address author) {
        AUTHOR = author;
        _disableInitializers();
    }

    /// @dev initParams = abi.encode(uint16 tapBps, uint32 tapPeriod, uint32 heartbeat, uint16 redeemFeeBps).
    function _customInit(address[] calldata, bytes calldata initParams) internal override {
        _setTypeId(TYPE_ID);
        __ReentrancyGuard_init();
        if (initParams.length != 128) revert BadParams();
        (uint256 tapBps, uint256 tapPeriod, uint256 hb, uint256 fee) =
            abi.decode(initParams, (uint256, uint256, uint256, uint256));
        if (tapBps == 0 || tapBps > MAX_TAP_BPS) revert BadParams();
        if (tapPeriod < MIN_TAP_PERIOD || tapPeriod > MAX_TAP_PERIOD) revert BadParams();
        if (hb < MIN_HEARTBEAT || hb > MAX_HEARTBEAT || fee > MAX_REDEEM_FEE_BPS) revert BadParams();
        params = Params(uint16(tapBps), uint32(tapPeriod), uint32(hb), uint16(fee));
        startedAt = uint64(block.timestamp);
        lastHeartbeat = uint64(block.timestamp);
    }

    function authorWallet() public view override returns (address) {
        return AUTHOR;
    }

    /// @notice Native tax (forwarded by ForwardVault) and anyone's gifts.
    receive() external payable override {
        emit Received(msg.sender, msg.value);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function balances() public view returns (uint256 native, uint256 quote) {
        native = address(this).balance;
        address q = _taxVaultQuote;
        if (q != address(0) && q.code.length > 0) quote = IERC20(q).balanceOf(address(this));
    }

    function redeemableSupply() public view returns (uint256) {
        IERC20 t = IERC20(_taxVaultToken);
        uint256 s = t.totalSupply();
        uint256 out = t.balanceOf(DEAD) + t.balanceOf(address(this)) + t.balanceOf(_taxVaultToken);
        return s > out ? s - out : 0;
    }

    function heartbeatDeadline() public view returns (uint256) {
        return uint256(lastHeartbeat) + params.heartbeat;
    }

    function currentPeriod() public view returns (uint256) {
        return (block.timestamp - startedAt) / params.tapPeriod;
    }

    /// @notice What the founder may still withdraw this period.
    function tapAvailable() public view returns (uint256 native, uint256 quote) {
        if (open) return (0, 0);
        (uint256 n, uint256 q) = balances();
        uint256 bn = periodBaseNative;
        uint256 bq = periodBaseQuote;
        uint256 sn = periodSpentNative;
        uint256 sq = periodSpentQuote;
        if (currentPeriod() != periodIndex || (bn == 0 && bq == 0 && sn == 0 && sq == 0)) {
            (bn, bq, sn, sq) = (n, q, 0, 0);
        }
        uint256 an = bn * params.tapBps / BPS;
        uint256 aq = bq * params.tapBps / BPS;
        native = an > sn ? an - sn : 0;
        quote = aq > sq ? aq - sq : 0;
        if (native > n) native = n;
        if (quote > q) quote = q;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Founder
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Withdraw this period's remaining tap to the owner. A heartbeat.
    function withdrawTap() external onlyOwner nonReentrant {
        if (open) revert Closed();
        _rollPeriod();
        (uint256 n, uint256 q) = tapAvailable();
        if (n == 0 && q == 0) revert NothingToWithdraw();
        periodSpentNative += n;
        periodSpentQuote += q;
        tapPaidNative += n;
        tapPaidQuote += q;
        _beat();
        address to = owner();
        if (q > 0) IERC20(_taxVaultQuote).safeTransfer(to, q);
        if (n > 0) {
            (bool ok,) = to.call{value: n}("");
            require(ok, "LiteVault: send failed");
        }
        emit TapWithdrawn(to, n, q);
    }

    function heartbeat() external onlyOwner {
        if (open) revert Closed();
        _beat();
    }

    /// @notice Close honestly: open the treasury to holders.
    function windDown() external onlyOwner {
        if (open) revert AlreadyOpen();
        open = true;
        emit Opened(false, block.timestamp);
    }

    /// @notice Anyone, once the founder has been silent past the heartbeat window.
    function declareAbandoned() external {
        if (open) revert AlreadyOpen();
        uint256 deadline = heartbeatDeadline();
        if (block.timestamp <= deadline) revert NotAbandoned(deadline);
        open = true;
        abandoned = true;
        emit Opened(true, block.timestamp);
    }

    function _beat() internal {
        lastHeartbeat = uint64(block.timestamp);
        emit Heartbeat(block.timestamp);
    }

    function _rollPeriod() internal {
        uint256 p = currentPeriod();
        if (
            p != periodIndex
                || (periodBaseNative == 0 && periodBaseQuote == 0 && periodSpentNative == 0 && periodSpentQuote == 0)
        ) {
            (uint256 n, uint256 q) = balances();
            periodIndex = p;
            periodBaseNative = n;
            periodBaseQuote = q;
            periodSpentNative = 0;
            periodSpentQuote = 0;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Holders
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Burn `amount` tokens for a pro rata share of both treasury balances, once the vault is open.
    function redeem(uint256 amount, uint256 minNative, uint256 minQuote)
        external
        nonReentrant
        returns (uint256 outNative, uint256 outQuote)
    {
        if (!open) revert Closed();
        if (amount == 0) revert ZeroAmount();
        IERC20 t = IERC20(_taxVaultToken);
        uint256 deadBefore = t.balanceOf(DEAD);
        t.safeTransferFrom(msg.sender, DEAD, amount);
        uint256 burned = t.balanceOf(DEAD) - deadBefore;
        // L-11: read R and the balances after the transfer, so a token that moves its own balance (or pays tax into
        // this vault) inside transferFrom cannot shift the pro rata share. R now excludes the burned tokens.
        uint256 r = redeemableSupply() + burned;
        (uint256 n, uint256 q) = balances();
        if (burned > r) burned = r;

        uint256 keep = BPS - params.redeemFeeBps;
        outNative = n * burned / r * keep / BPS;
        outQuote = q * burned / r * keep / BPS;
        if (outNative == 0 && outQuote == 0) revert ZeroAmount();
        if (outNative < minNative || outQuote < minQuote) revert Slippage();
        tokensBurned += burned;
        if (outQuote > 0) IERC20(_taxVaultQuote).safeTransfer(msg.sender, outQuote);
        if (outNative > 0) {
            (bool ok,) = msg.sender.call{value: outNative}("");
            require(ok, "LiteVault: send failed");
        }
        emit Redeemed(msg.sender, burned, outNative, outQuote);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OpenFour schema
    // ─────────────────────────────────────────────────────────────────────────

    function moduleEncodeSchema() external pure override returns (ModuleEncodeSchema memory) {
        ParamDescriptor[] memory ps = new ParamDescriptor[](4);
        ps[0] = ParamDescriptor({
            name: "tapBps",
            abiType: "uint16",
            decimals: 0,
            optional: false,
            title: "Tap per period (bps of treasury)",
            defaultValue: "400",
            hint: "Most the founder can withdraw each period, as bps of the treasury (400 = 4%)",
            minValue: "1",
            maxValue: "5000"
        });
        ps[1] = ParamDescriptor({
            name: "tapPeriod",
            abiType: "uint32",
            decimals: 0,
            optional: false,
            title: "Tap period (seconds)",
            defaultValue: "2592000",
            hint: "Length of one tap period; 30 days = 2592000",
            minValue: "86400",
            maxValue: "7776000"
        });
        ps[2] = ParamDescriptor({
            name: "heartbeat",
            abiType: "uint32",
            decimals: 0,
            optional: false,
            title: "Heartbeat window (seconds)",
            defaultValue: "3888000",
            hint: "Founder silence after which anyone can open the treasury to holders; 45 days = 3888000",
            minValue: "604800",
            maxValue: "15552000"
        });
        ps[3] = ParamDescriptor({
            name: "redeemFeeBps",
            abiType: "uint16",
            decimals: 0,
            optional: false,
            title: "Redeem fee (bps)",
            defaultValue: "100",
            hint: "Kept by the treasury for remaining holders on each redemption (max 300)",
            minValue: "0",
            maxValue: "300"
        });
        return ModuleEncodeSchema("Covenant.LiteVault", 1, ps);
    }
}
