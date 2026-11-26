// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {LibString} from "solady/utils/LibString.sol";

import {IPortalTypes, IPortal} from "src/flap/IPortal.sol";
import {LauncherBase} from "src/flap/LauncherBase.sol";
import {Distribution, DistributionTarget} from "src/flap/Distribution.sol";
import {LaunchExtensionHelper} from "src/flap/LaunchExtensionHelper.sol";
import {LauncherDescription, LauncherHelper} from "src/flap/LauncherHelper.sol";

import {Terms, Profile, State} from "src/vault/CovenantTypes.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";

interface ICovenantVaultFunding {
    function fundTreasury(address pool) external payable;
}

string constant COVENANT_TITLE_ZH = unicode"契约发射";
string constant COVENANT_TITLE_EN = "Covenant raise";
string constant COVENANT_SUMMARY_ZH =
    unicode"公开募资，设有最低额与上限，超额部分按比例退还。未达最低额时全额退款。募集资金的大部分存入金库：团队每月只能领取有上限的预算；团队代币只在价格达到倍数后解锁；价格连续三天低于每枚代币的金库价值时，任何持有人都可以按该价值赎回；团队或代理停止运作后金库向持有人开放。";
string constant COVENANT_SUMMARY_EN =
    "A capped public raise with pro rata refunds above the cap and full refunds below the minimum. Most of the raise sits in a vault under fixed rules: the team draws a capped monthly budget, team tokens unlock only at price multiples, any holder can redeem at treasury value per token once the price has been below it for three days, and the treasury opens to holders if the team or agent stops.";

/// @title CovenantLauncher
/// @notice The raise half of a covenant. Holds commitments, settles pro rata, launches once on Flap's Pool Launch
///         Portal, forwards the treasury to the paired vault and pays refunds.
///
///         Raise math (design doc, "The raise"):
///           Q = min(C, cap), q_i = floor(c_i * Q / C), a_i = floor(A * q_i / Q), refund_i = c_i - q_i.
///           Pool seed Q_pool = Q * P / A, so the pool opens at the sale price Q / A.
///           Treasury T0 = Q - Q_pool, less a dust buffer of one wei per contributor so that the floors in q_i can
///           never leave the refunds short.
///         Below the minimum, or if the Portal call reverts for any reason, the state is FAILED and every
///         commitment refunds in full. A failed launch never traps funds.
/// @dev Deployed by `CovenantLauncherFactory` as an ERC1967 beacon proxy. Upgrades: Guardian only, via the factory.
contract CovenantLauncher is LauncherBase, Initializable, ReentrancyGuard {
    using SafeTransferLib for address;

    address public hub;
    address public creator;
    address public factory;
    address public vaultFactory;

    Terms internal _terms;
    Profile internal _profile;
    State internal _state;

    uint64 public saleDeadline;
    uint256 public saleAmount; // A
    uint256 public poolAmount; // P
    uint256 public teamAmount; // E

    uint256 public committed; // C
    uint256 public contributorCount;
    mapping(address account => uint256 amount) public contributions;
    mapping(address account => bool done) public refunded;

    uint256 public accepted; // Q (0 unless launched)
    uint256 public poolQuote; // Q_pool (0 unless launched)
    uint256 public treasuryForwarded; // T0

    /// @notice Gas `finalize` needs before it tries the launch: about twice what a Pool Launch costs (the whole
    ///         finalize measured 6.96M gas against Flap's live Portal on a BNB Chain fork), so the try/catch can
    ///         tell a refused launch from a starved one.
    uint256 public constant LAUNCH_GAS_FLOOR = 15_000_000;

    /// @notice True only while the Portal launch call runs. The paired vault factory reads it.
    bool public launching;

    address public token;
    address public pool;
    address public vault;

    uint256[30] private __gap;

    event Contributed(address indexed account, uint256 amount, uint256 total, uint256 committed);
    event Finalized(State state, uint256 committed, uint256 accepted, uint256 poolQuote, uint256 treasury);
    event Launched(address indexed token, address indexed pool, address indexed vault);
    event LaunchFailed(bytes reason);
    event Refunded(address indexed account, uint256 amount);

    error InvalidConfig();
    error SaleClosed();
    error SaleOpen();
    error ZeroContribution();
    error LaunchInProgress();
    error NotRaising();
    error NotSelf();
    error InsufficientGas();
    error RefundUnavailable();
    error NothingToRefund();
    error WrongVault(address vault, address factory);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Called once by the factory. Stores the terms and locks the salt from this address, because Flap
    ///         requires the locker to be the Launcher. `msg.value` must be exactly `SALT_LOCK_FEE`.
    function initialize(
        address hub_,
        address creator_,
        address vaultFactory_,
        Terms calldata t,
        Profile calldata p
    ) external payable initializer {
        if (hub_ == address(0) || creator_ == address(0) || vaultFactory_ == address(0)) revert InvalidConfig();
        hub = hub_;
        creator = creator_;
        factory = msg.sender;
        vaultFactory = vaultFactory_;
        _terms = t;
        _profile = p;
        _state = State.RAISING;
        saleDeadline = uint64(block.timestamp + t.saleDuration);

        CovenantTermsLib.Split memory s = CovenantTermsLib.split(t);
        saleAmount = s.sale;
        poolAmount = s.pool;
        teamAmount = s.team;

        uint256 fee = IPortal(hub_).SALT_LOCK_FEE();
        if (msg.value != fee) revert InvalidConfig();
        IPortal(hub_).lockSalt{value: fee}(t.salt, uint8(IPortalTypes.LaunchKind.DIRECT_V2_POOL_TAX));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function terms() external view returns (Terms memory) {
        return _terms;
    }

    function profile() external view returns (Profile memory) {
        return _profile;
    }

    /// @notice RAISING, FAILED or ACTIVE (launched). After launch the vault carries the covenant's state.
    function state() external view returns (State) {
        return _state;
    }

    function launched() external view returns (bool) {
        return _state == State.ACTIVE;
    }

    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    /// @notice q_i: the part of `account`'s commitment the sale kept.
    function acceptedOf(address account) public view returns (uint256) {
        if (_state != State.ACTIVE) return 0;
        return contributions[account] * accepted / committed;
    }

    /// @notice a_i: the sale tokens `account` can claim from the vault.
    function allocationOf(address account) public view returns (uint256) {
        if (_state != State.ACTIVE) return 0;
        return saleAmount * acceptedOf(account) / accepted;
    }

    /// @notice What `account` can take back right now (0 once taken).
    function refundOf(address account) public view returns (uint256) {
        uint256 c = contributions[account];
        if (c == 0 || refunded[account]) return 0;
        if (_state == State.FAILED) return c;
        if (_state == State.ACTIVE) return c - acceptedOf(account);
        return 0;
    }

    /// @notice What a commitment of `amount` more from `account` would keep and receive if the sale closed now.
    function previewCommit(address account, uint256 amount)
        external
        view
        returns (uint256 keep, uint256 tokens, uint256 refund)
    {
        uint256 c = contributions[account] + amount;
        uint256 total = committed + amount;
        if (total == 0) return (0, 0, 0);
        uint256 q = total < _terms.cap ? total : _terms.cap;
        keep = c * q / total;
        tokens = saleAmount * keep / q;
        refund = c - keep;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Raise
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Commit BNB while the sale is open. Commitments are not capped; the raise can be oversubscribed.
    function contribute() external payable {
        if (launching) revert LaunchInProgress();
        if (_state != State.RAISING || block.timestamp >= saleDeadline) revert SaleClosed();
        if (msg.value == 0) revert ZeroContribution();
        uint256 c = contributions[msg.sender];
        if (c == 0) ++contributorCount;
        c += msg.value;
        contributions[msg.sender] = c;
        committed += msg.value;
        emit Contributed(msg.sender, msg.value, c, committed);
    }

    /// @notice Anyone, after the deadline. Below the minimum: FAILED. Otherwise settles, launches through the
    ///         Portal and forwards the treasury to the vault in one transaction. A reverted launch ends in FAILED.
    function finalize() external nonReentrant {
        if (_state != State.RAISING) revert NotRaising();
        if (block.timestamp < saleDeadline) revert SaleOpen();

        uint256 c = committed;
        if (c < _terms.minRaise) {
            _state = State.FAILED;
            emit Finalized(State.FAILED, c, 0, 0, 0);
            return;
        }

        uint256 q = c < _terms.cap ? c : _terms.cap;
        uint256 qPool = q * poolAmount / saleAmount;
        uint256 rest = q - qPool;
        // Oversubscribed: each floor in q_i can lose < 1 wei, so keep one wei per contributor back for refunds.
        uint256 buffer = c > q ? contributorCount : 0;
        if (buffer > rest) buffer = rest;
        uint256 treasury = rest - buffer;

        accepted = q;
        poolQuote = qPool;
        launching = true;

        // Enough gas for the whole launch, so the catch below only ever sees a real refusal by the Portal.
        uint256 g = gasleft();
        if (g < LAUNCH_GAS_FLOOR) revert InsufficientGas();
        try this.launchAndFund(treasury) returns (address t, address pl, address v) {
            token = t;
            pool = pl;
            vault = v;
            treasuryForwarded = treasury;
            _state = State.ACTIVE;
            emit Launched(t, pl, v);
        } catch (bytes memory reason) {
            // A launch that ran out of gas must not be mistaken for one the Portal refused: an attacker could
            // otherwise pick a gas limit that fails a healthy raise. A starved launch leaves only the 1/64 shares
            // each nested frame keeps back; a refusal leaves most of `g`, which is several times the launch cost.
            if (gasleft() < g / 8) revert InsufficientGas();
            accepted = 0;
            poolQuote = 0;
            _state = State.FAILED;
            emit LaunchFailed(reason);
        }
        launching = false;
        emit Finalized(_state, c, accepted, poolQuote, treasuryForwarded);
    }

    /// @dev External so `finalize` can wrap launch and funding in one try/catch: if either reverts, both unwind.
    function launchAndFund(uint256 treasury) external returns (address t, address pl, address v) {
        if (msg.sender != address(this)) revert NotSelf();
        IPortalTypes.CreateTaxTokenParams memory p = _buildParams();
        Distribution memory dist = Distribution({
            target: DistributionTarget.VAULT,
            strategy: address(0),
            amount: uint128(saleAmount + teamAmount),
            configData: ""
        });
        IPortalTypes.CreatorBuyParams memory noBuy;
        (t, pl) = IPortal(hub).launchTaxTokenV2{value: poolQuote}(p, dist, noBuy);
        address vf;
        (v, vf) = IPortal(hub).getLaunchVault(t);
        if (v == address(0) || vf != vaultFactory) revert WrongVault(v, vf);
        ICovenantVaultFunding(v).fundTreasury{value: treasury}(pl);
    }

    /// @notice Full commitment back if FAILED; the unaccepted part if launched. Pull payment, once.
    function claimRefund() external nonReentrant {
        if (_state == State.RAISING) revert RefundUnavailable();
        uint256 amount = refundOf(msg.sender);
        if (amount == 0) revert NothingToRefund();
        refunded[msg.sender] = true;
        msg.sender.safeTransferETH(amount);
        emit Refunded(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Launch parameters
    // ─────────────────────────────────────────────────────────────────────────

    function _buildParams() internal view returns (IPortalTypes.CreateTaxTokenParams memory p) {
        Terms storage t = _terms;
        p.name = t.name;
        p.symbol = t.symbol;
        p.meta = t.meta;
        p.totalSupply = t.totalSupply;
        p.salt = t.salt;
        p.quoteToken = address(0);
        p.dexId = 0;
        p.poolQuote = poolQuote;
        p.poolToken = poolAmount;
        p.buyTaxRate = t.buyTaxBps;
        p.sellTaxRate = t.sellTaxBps;
        p.taxDuration = t.taxDuration;
        p.antiFarmerDuration = _profile.antiFarmerDuration;
        p.feeConfigs = new IPortalTypes.FeeConfig[](1);
        // The single fee slot: VAULT at 10000 bps, vaultData = abi.encode(launcher).
        p.feeConfigs[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 10_000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({vaultFactory: vaultFactory, vaultData: abi.encode(address(this))})
            )
        });
        p.exemptAddrs = new address[](0);
        (p.extensionID, p.extensionData) = LaunchExtensionHelper.encodeCreator(creator);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Display
    // ─────────────────────────────────────────────────────────────────────────

    function _getHub() internal view override returns (address) {
        return hub;
    }

    function _description() internal view override returns (LauncherDescription memory d) {
        d.name = _terms.name;
        d.symbol = _terms.symbol;
        d.quoteToken = address(0);
        d.targetRaise = _terms.cap;
        d.poolTokenRatio = uint256(_terms.poolBps) * 1e18 / 10_000;
        d.titleZh = COVENANT_TITLE_ZH;
        d.titleEn = COVENANT_TITLE_EN;
        d.summaryZh = COVENANT_SUMMARY_ZH;
        d.summaryEn = COVENANT_SUMMARY_EN;
    }

    /// @notice Flap's v1 JSON with covenant keys appended (consumers ignore unknown keys). Under 4 KB: name and
    ///         symbol are capped at 64 and 16 bytes by the factory.
    function description() external view override returns (string memory) {
        bytes memory base = bytes(LauncherHelper.toJson(_description()));
        assembly ("memory-safe") {
            mstore(base, sub(mload(base), 1)) // drop the closing brace
        }
        Terms storage t = _terms;
        string memory a = string.concat(
            ',"covenant":"1","minRaise":"',
            LibString.toString(t.minRaise),
            '","cap":"',
            LibString.toString(t.cap),
            '","saleDeadline":"',
            LibString.toString(saleDeadline),
            '","saleBps":"',
            LibString.toString(t.saleBps),
            '","teamWallet":"',
            LibString.toHexString(t.teamWallet)
        );
        string memory b = string.concat(
            '","agentId":"',
            LibString.toString(t.agentId),
            '","tapUsdPer30d":"',
            LibString.toString(t.tapUsdPer30d),
            '","tapCapBps":"',
            LibString.toString(t.tapCapBps),
            '","exitStreak":"',
            LibString.toString(t.exitStreak),
            '","exitFeeBps":"',
            LibString.toString(t.exitFeeBps),
            '","heartbeat":"',
            LibString.toString(t.heartbeat),
            '"}'
        );
        return string.concat(string(base), a, b);
    }
}
