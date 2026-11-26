// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {LibString} from "solady/utils/LibString.sol";

import {DirectLaunchVaultBase} from "src/flap/DirectLaunchVaultBase.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {ITokenDock} from "src/flap/ILaunchVaultSpec.sol";
import {VaultUISchema} from "src/flap/IVaultSchemas.sol";

import {
    State,
    Terms,
    Profile,
    Observation,
    VaultEnv,
    ICovenantLauncher,
    ICovenantRateSource,
    CovenantMath
} from "src/vault/CovenantTypes.sol";
import {CovenantVaultDisplay} from "src/vault/CovenantVaultDisplay.sol";
import {IERC8004Reputation} from "src/agent/IERC8004.sol";

/// @title CovenantVault
/// @notice Holds a covenant's treasury and reserved tokens and runs its five rules.
///
///   Book value  b = (T - owedTeam) / R,  R = S - balanceOf(DEAD) - lockedTeam.
///   Rule 1 tap      accrues on each observation at min(tapUsd / bnbUsd, capBps * T) per 30 days, paused in exit
///                   rounds, ended at wind-down. The unclaimed balance never exceeds one period's cap.
///   Rule 2 unlock   a tranche unlocks after `unlockWindow` of strict time at or above its multiple, after
///                   the cliff, with the multiple held both in dollars (Atlas BNB/USD) and in BNB (pool TWAP against
///                   the BNB sale price, no oracle), so a bad BNB/USD rate alone cannot unlock anything. A strict
///                   observation below the multiple resets its counter.
///   Rule 3 exit     the streak adds time while the pool TWAP is below book and loses the same time while it is at
///                   or above book (it decays, it does not reset). It runs on on-chain numbers only: no Atlas, no
///                   depth gate. At `exitStreak` a round opens; holders burn tokens for b * (1 - fee).
///   Rule 4 switch   after `heartbeat` of team silence anyone ends the covenant: unclaimed tap is forfeited, locked
///                   tranches burn, redemption opens with no fee and no deadline.
///   Rule 5 report   the team posts reports; a relayer's failed verdict pauses tap accrual until a passing one.
///   Agent layer     on abandonment, wind-down and every unlock the vault writes the outcome to the issuer's ERC-8004
///                   reputation record (when `agentId != 0`), inside try/catch so it can never block a rule.
///
///   Flap's Guardian (Flap's Pool Launch spec, low-risk badge: every permissioned vault function also accepts the
///   Guardian, and the Guardian is the only upgrade path). What it can do here:
///     - upgrade this vault's logic through the vault factory's beacon (and the launcher's through its factory);
///       an upgrade replaces the code that guards the treasury, so the treasury is only as safe as the Guardian;
///     - call the team functions: `windDown` (ends the tap early and opens fee-free redemption; recorded as a
///       Guardian wind-down, see `windDownCause`), `claimTap` (pays only the fixed team wallet), `lowerTap`,
///       `heartbeat` and `postReport`.
///   What it cannot do: none of its calls count as a heartbeat (it cannot keep a silent team alive), it cannot
///   raise the tap, change the team wallet or any term, unlock tranches, or send treasury BNB or tokens anywhere
///   but the fixed team wallet (accrued tap) and redeeming holders, short of an upgrade.
///
/// @dev Revenue is recognized by balance delta against `accounted` (Flap's spec); every outflow decrements it first.
///      Deployed by `CovenantVaultFactory` as an ERC1967 beacon proxy keyed by token. Upgrades: Guardian only.
contract CovenantVault is DirectLaunchVaultBase, IStrategy, Initializable, ReentrancyGuard {
    using SafeTransferLib for address;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant PERIOD = 30 days;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal constant FEEDBACK_GAS = 500_000;
    uint8 internal constant WIND_DOWN_TEAM = 1;
    uint8 internal constant WIND_DOWN_GUARDIAN = 2;
    uint8 internal constant WIND_DOWN_ABANDONED = 3;

    struct Tranche {
        uint128 amount;
        uint16 multiple; // 200 = 2x the dollar sale price
        bool unlocked;
        uint64 progress; // strict seconds at or above the multiple
    }

    struct Report {
        bytes32 hash;
        uint64 postedAt;
        string uri;
    }

    // ── configuration (set once in initialize) ──────────────────────────────
    address public taxToken;
    address public launcher;
    address public teamWallet;
    address public reportRelayer;
    uint256 public agentId;
    VaultEnv internal _env;

    uint256 public saleAmount; // A
    uint256 public teamAmount; // E
    uint256 public poolSeedQuote; // Q_pool
    uint256 public accepted; // Q
    uint256 public salePriceBnb; // Q / A, BNB per token, 1e18

    uint16 public tapCapBps;
    uint16 public exitFeeBps;
    uint32 public cliff;
    uint32 public unlockWindow;
    uint32 public exitStreakNeeded;
    uint32 public roundLength;
    uint32 public cooldown;
    uint32 public heartbeatWindow;
    uint32 public minPokeGap;
    uint32 public maxStep;
    uint32 public staleAfter;

    uint256 public tapUsdPer30d; // only ever lowered
    Tranche[] internal _tranches;

    // ── state ───────────────────────────────────────────────────────────────
    State internal _state;
    bool public distributionInitialized;
    bool public funded;
    bool public disclosurePaused;
    address public pair;

    uint64 public launchedAt;
    uint64 public lastHeartbeat;
    uint64 public roundStart;
    uint64 public roundEnd;
    uint64 public cooldownEnd;
    uint64 public lastTapAt;
    uint64 public lastObservedAt;
    uint64 public lastStrictAt;
    uint64 public roundsOpened;

    uint256 public exitStreak; // seconds, decaying
    uint256 public owedTeam; // accrued, unclaimed tap
    uint256 public tapPaid;
    uint256 public accounted; // revenue baseline: BNB the ledger knows about
    uint256 public totalRevenue; // tax, agent revenue and gifts
    uint256 public treasuryRaised; // T0 from the launcher
    uint256 public totalRedeemed; // BNB paid to redeemers
    uint256 public tokensBurned; // tokens redeemers sent to DEAD

    uint256 public lockedTeam; // team tokens still locked in the dock
    uint256 public unlockedUnreleased; // unlocked, still in the dock
    uint256 public teamReleased;
    uint256 public saleClaimed;
    mapping(address account => bool) public tokensClaimed;

    uint256 public usdSalePrice; // dollar sale price, USD per token 1e18: salePriceBnb x the reference BNB/USD
    uint256 public lastBnbUsd; // last strict BNB/USD
    uint256 public lastTwap;
    uint256 public lastSpot;
    bool public lastTrusted;
    bool public lastStrict;
    bool public lastAtlas;
    bool public lastDeep;

    mapping(uint256 period => Report) internal _reports;
    uint256 public reportsPosted;
    uint256 public outcomesRecorded;

    /// @notice How the covenant ended: 0 not ended, 1 the team wound it down, 2 Flap's Guardian wound it down,
    ///         3 declared abandoned (anyone, after the heartbeat window).
    uint8 public windDownCause;
    /// @notice Who ended it (the team wallet, the Guardian, or whoever declared abandonment).
    address public windDownBy;

    /// @notice When the dollar sale price got its first BNB/USD reference (the launch-time push read, else the first
    ///         strict observation). For `staleAfter` after that, a higher strict rate raises it; a dip never lowers it.
    uint64 public usdSaleRefAt;
    /// @notice Rule 5: the verdict on each period (0 none, 1 passed, 2 failed) and how many periods stand failed.
    mapping(uint256 period => uint8) public verdictOf;
    uint256 public failedPeriods;
    /// @notice Rule 5: who posted each period's report (the team wallet, or Flap's Guardian per Flap's spec).
    mapping(uint256 period => address) public reportPostedBy;
    /// @notice Sum of the commitments of every account that has claimed its sale tokens (bounds what is still owed).
    uint256 public claimedCommitments;
    /// @notice Sale-token rounding dust (and stray tokens sent to the vault) burned to the dead address.
    uint256 public saleDustBurned;

    uint256[22] private __gap;

    // ── events (design doc list, plus a few the app needs) ──────────────────
    event TreasuryFunded(uint256 amount, address pair);
    event RevenueRecognized(uint256 amount, uint256 totalRevenue);
    event RevenueDeposited(address indexed from, uint256 amount, bytes32 tag);
    event Observed(
        uint256 twapBnb, uint256 bnbUsd, uint256 bookValue, bool trusted, bool strict, State state, uint256 exitStreak
    );
    event TapAccrued(uint256 amount, uint256 owed);
    event TapClaimed(address indexed to, uint256 amount);
    event TapLowered(uint256 oldUsdPer30d, uint256 newUsdPer30d);
    event ExitRoundOpened(uint256 roundEnd, uint256 bookValue, uint256 twapBnb);
    event ExitRoundClosed(uint256 roundEnd, uint256 cooldownEnd);
    event CooldownEnded(uint256 at);
    event Redeemed(address indexed account, uint256 tokens, uint256 bnbOut, uint256 bookValue);
    event TokensClaimed(address indexed account, uint256 amount);
    event TrancheUnlocked(uint256 indexed index, uint256 amount, uint256 multiple);
    event TeamReleased(address indexed to, uint256 amount);
    event Heartbeat(address indexed by, uint256 at);
    event WoundDown(bool abandoned, uint256 forfeitedTap, uint256 burnedTeamTokens);
    /// @notice Emitted with `WoundDown`: who ended the covenant and how (see `windDownCause`).
    event WindDownCaused(address indexed by, uint8 cause);
    event SaleDustBurned(uint256 amount, uint256 total);
    event UsdSalePriceSet(uint256 usdSalePrice, uint256 bnbUsd);
    event ReportPosted(uint256 indexed period, string uri, bytes32 hash);
    event VerdictRecorded(uint256 indexed period, bool passed, bytes32 proofHash);
    event OutcomeRecorded(uint256 indexed agentId, int128 value, string outcome, bool ok);

    error ZeroAddress();
    error NotFactory();
    error NotLauncher();
    error NotOracle();
    error NotTeam();
    error NotRelayer();
    error AlreadyFunded();
    error AlreadyDistributed();
    error WrongToken(address token);
    error WrongAmount(uint256 got, uint256 expected);
    error ReceivedLess(uint256 got, uint256 expected);
    error NotLive();
    error NotRedeemable();
    error Slippage(uint256 out, uint256 minOut);
    error ZeroAmount();
    error NothingToClaim();
    error NotAbandoned(uint256 deadline);
    error Ended();
    error TapNotLower(uint256 current, uint256 proposed);
    error InsufficientGas();
    error ReportExists(uint256 period);
    error NoReport(uint256 period);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Setup: factory, Portal, launcher
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Called by the vault factory inside `newVault`, while the launcher is mid-launch. Copies the terms
    ///         from the launcher, sets state ACTIVE and starts the heartbeat clock.
    /// @param token_ the launched tax token
    /// @param launcher_ the covenant's launcher
    /// @param env_ addresses shared by the vault factory's vaults
    function initialize(address token_, address launcher_, VaultEnv calldata env_) external initializer {
        if (token_ == address(0) || launcher_ == address(0) || env_.oracle == address(0)) revert ZeroAddress();
        ICovenantLauncher l = ICovenantLauncher(launcher_);
        Terms memory t = l.terms();
        Profile memory p = l.profile();

        taxToken = token_;
        launcher = launcher_;
        teamWallet = t.teamWallet;
        reportRelayer = t.reportRelayer;
        agentId = t.agentId;
        _env = env_;

        uint256 a = l.saleAmount();
        uint256 e = l.teamAmount();
        uint256 q = l.accepted();
        saleAmount = a;
        teamAmount = e;
        poolSeedQuote = l.poolQuote();
        accepted = q;
        salePriceBnb = q * WAD / a;

        tapCapBps = t.tapCapBps;
        exitFeeBps = t.exitFeeBps;
        cliff = t.cliff;
        unlockWindow = t.unlockWindow;
        exitStreakNeeded = t.exitStreak;
        roundLength = t.roundLength;
        cooldown = t.cooldown;
        heartbeatWindow = t.heartbeat;
        minPokeGap = p.minPokeGap;
        maxStep = p.maxStep;
        staleAfter = p.staleAfter;
        tapUsdPer30d = t.tapUsdPer30d;

        // Tranche sizes: bps of supply, the last one absorbs nothing because S is a multiple of 10_000.
        uint256 n = t.trancheBps.length;
        for (uint256 i; i < n; ++i) {
            _tranches.push(
                Tranche({
                    amount: uint128(t.totalSupply * t.trancheBps[i] / BPS),
                    multiple: t.trancheMultiple[i],
                    unlocked: false,
                    progress: 0
                })
            );
        }
        lockedTeam = e;
        _state = State.ACTIVE;
        lastHeartbeat = uint64(block.timestamp);
    }

    /// @inheritdoc IStrategy
    /// @dev Portal only, once. Pulls exactly A + E, verifies the balance change, and docks all of it in Flap's
    ///      Token Dock through the router (looked up on every call, never cached).
    function initializeDistribution(address token, uint256 amount, bytes calldata, bytes32)
        external
        override
        onlyHub
        nonReentrant
    {
        if (distributionInitialized) revert AlreadyDistributed();
        if (token != taxToken) revert WrongToken(token);
        uint256 expected = saleAmount + teamAmount;
        if (amount != expected) revert WrongAmount(amount, expected);
        distributionInitialized = true;

        uint256 before = IERC20(token).balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        if (received != amount) revert ReceivedLess(received, amount);

        if (amount > 0) {
            address router = _getTokenDockRouter();
            token.safeApprove(router, amount);
            ITokenDock(router).deposit(token, amount);
        }
        emit FlapDistributionInitialized(token, amount);
    }

    /// @notice The launcher forwards the treasury share of the raise, once, in the launch transaction.
    /// @param pool the PancakeSwap V2 pool the Portal seeded; `msg.value` is T0 in wei
    function fundTreasury(address pool) external payable {
        if (msg.sender != launcher) revert NotLauncher();
        if (funded) revert AlreadyFunded();
        if (pool == address(0)) revert ZeroAddress();
        funded = true;
        pair = pool;
        treasuryRaised = msg.value;
        accounted += msg.value; // the raise is not revenue
        _sync(); // anything else already here is
        launchedAt = uint64(block.timestamp);
        lastHeartbeat = uint64(block.timestamp);
        lastTapAt = uint64(block.timestamp);
        emit TreasuryFunded(msg.value, pool);
        // M-2: fix the dollar sale price in the launch transaction when the oracle has a fresh push rate, so no poker
        // picks the moment. A failing read never blocks the launch; the first strict observation then sets it.
        try ICovenantRateSource(_env.oracle).pushBnbUsd() returns (uint256 rate) {
            if (rate > 0) _setStrictRate(rate);
        } catch {}
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Revenue
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Tax from Flap's TaxProcessor and plain transfers land here. Cheap and idempotent.
    receive() external payable {
        _sync();
    }

    /// @notice Recognize revenue that arrived without a call (for example a forced transfer).
    function sync() external {
        _sync();
    }

    /// @notice Agent layer: the issuer (or anyone) forwards revenue it earned. It raises book value for every
    ///         holder. From the team wallet it also counts as a heartbeat.
    /// @param tag a free label for the deposit (event only); `msg.value` in wei
    function depositRevenue(bytes32 tag) external payable {
        if (msg.value == 0) revert ZeroAmount();
        _sync();
        emit RevenueDeposited(msg.sender, msg.value, tag);
        if (msg.sender == teamWallet && _state != State.WIND_DOWN) _beat();
    }

    function _sync() internal {
        uint256 bal = address(this).balance;
        uint256 known = accounted;
        if (bal <= known) return;
        uint256 r = bal - known;
        accounted = bal;
        uint256 total = totalRevenue + r;
        totalRevenue = total;
        emit RevenueRecognized(r, total);
    }

    /// @dev Every BNB outflow goes through here: ledger first, transfer last.
    function _payOut(address to, uint256 amount) internal {
        accounted -= amount;
        to.safeTransferETH(amount);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Views
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice The covenant's state now, including time-based transitions nobody has triggered yet.
    function state() public view returns (State s) {
        s = _state;
        if (s == State.EXIT_ROUND && block.timestamp >= roundEnd) {
            s = block.timestamp >= uint256(roundEnd) + cooldown ? State.ACTIVE : State.COOLDOWN;
        } else if (s == State.COOLDOWN && block.timestamp >= cooldownEnd) {
            s = State.ACTIVE;
        }
    }

    /// @notice R = S - balanceOf(DEAD) - lockedTeam. Pool-held tokens count, so trading never moves book value.
    /// @return R = S - balanceOf(DEAD) - lockedTeam, tokens with 18 decimals
    function redeemableSupply() public view returns (uint256) {
        if (!distributionInitialized) return 0;
        uint256 s = IERC20(taxToken).totalSupply();
        uint256 out = IERC20(taxToken).balanceOf(DEAD) + lockedTeam;
        return s > out ? s - out : 0;
    }

    /// @notice Treasury BNB the rules can still pay out to holders: balance less the tap owed to the team.
    /// @return treasury balance less the unclaimed tap, BNB in wei
    function freeTreasury() public view returns (uint256) {
        uint256 bal = address(this).balance;
        uint256 owed = owedTeam;
        return bal > owed ? bal - owed : 0;
    }

    /// @notice b = (T - owedTeam) / R in BNB per token, 1e18, rounded down (toward the vault).
    /// @return b, BNB per token scaled 1e18
    function bookValue() public view returns (uint256) {
        uint256 r = redeemableSupply();
        if (r == 0) return 0;
        return freeTreasury() * WAD / r;
    }

    function tapAccrued() external view returns (uint256) {
        return owedTeam;
    }

    /// @notice Most tap the cap allows per 30 days at today's treasury.
    function tapCapPer30d() public view returns (uint256) {
        return freeTreasury() * tapCapBps / BPS;
    }

    /// @return unix seconds after which anyone can declare abandonment
    function heartbeatDeadline() public view returns (uint256) {
        return uint256(lastHeartbeat) + heartbeatWindow;
    }

    function abandonable() public view returns (bool) {
        State s = state();
        return funded && s != State.WIND_DOWN && block.timestamp > heartbeatDeadline();
    }

    function trancheCount() external view returns (uint256) {
        return _tranches.length;
    }

    /// @notice Tranche k: size, multiple, strict seconds at or above it, whether unlocked, and its dollar target.
    function trancheProgress(uint256 k)
        external
        view
        returns (uint256 amount, uint256 multiple, uint256 progress, bool unlocked, uint256 targetUsd)
    {
        Tranche storage t = _tranches[k];
        return (t.amount, t.multiple, t.progress, t.unlocked, usdSalePrice * t.multiple / 100);
    }

    function report(uint256 period) external view returns (bytes32 hash, uint64 postedAt, string memory uri) {
        Report storage r = _reports[period];
        return (r.hash, r.postedAt, r.uri);
    }

    function env() external view returns (VaultEnv memory) {
        return _env;
    }

    function oracleConfig()
        external
        view
        returns (address pair_, address token_, uint256 seedQuote, uint32 minPokeGap_, bool live)
    {
        return (pair, taxToken, poolSeedQuote, minPokeGap, funded);
    }

    /// @notice Sale tokens `account` can still claim.
    /// @param account a contributor
    /// @return sale tokens (18 decimals) it can still claim
    function claimableTokens(address account) external view returns (uint256) {
        if (tokensClaimed[account] || !distributionInitialized) return 0;
        return ICovenantLauncher(launcher).allocationOf(account);
    }

    /// @notice What redeeming `tokens` pays now (0 outside a round or wind-down).
    /// @param tokens tokens (18 decimals) to burn
    /// @return out BNB in wei paid now (0 outside an exit round or wind-down)
    function previewRedeem(uint256 tokens) external view returns (uint256 out) {
        State s = state();
        if (s != State.EXIT_ROUND && s != State.WIND_DOWN) return 0;
        uint256 gross = tokens * bookValue() / WAD;
        out = s == State.WIND_DOWN ? gross : gross - gross * exitFeeBps / BPS;
    }

    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    function _getHub() internal view override returns (address) {
        return _env.hub;
    }

    function _getGuardian() internal view override returns (address) {
        return _env.guardian;
    }

    function _getTokenDockRouter() internal view override returns (address dock) {
        dock = _env.dockRouter;
        if (dock == address(0)) revert TokenDockNotConfigured();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Time-based state
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Apply time-based transitions (round end, cooldown end). Anyone; every rule calls it first.
    function tick() external {
        _tick();
    }

    function _tick() internal {
        State s = _state;
        if (s == State.EXIT_ROUND && block.timestamp >= roundEnd) {
            uint64 end = roundEnd;
            uint64 cEnd = end + cooldown;
            cooldownEnd = cEnd;
            _state = State.COOLDOWN;
            s = State.COOLDOWN;
            emit ExitRoundClosed(end, cEnd);
        }
        if (s == State.COOLDOWN && block.timestamp >= cooldownEnd) {
            _state = State.ACTIVE;
            emit CooldownEnded(block.timestamp);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Observation: the core step
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Called by CovenantOracle about once an hour. Recognizes revenue, accrues the tap, steps the exit
    ///         streak and the tranche counters, and opens a round when the streak is full.
    /// @param o the oracle's observation (prices 1e18, seconds; see `Observation`)
    function onObservation(Observation calldata o) external nonReentrant {
        if (msg.sender != _env.oracle) revert NotOracle();
        if (!funded) revert NotLive();
        _tick();
        _sync();

        State s = _state;
        if (s == State.WIND_DOWN) {
            emit Observed(o.twapBnb, o.bnbUsd, bookValue(), o.trusted, o.strict, s, exitStreak);
            return;
        }

        if (o.strict) _setStrictRate(o.bnbUsd);

        _accrueTap(o);

        uint256 dt = o.elapsed > maxStep ? maxStep : o.elapsed;
        uint256 b = bookValue();
        if (o.trusted && dt > 0) {
            // H-1: whoever pokes decides whether a verified rate rides along, so a trusted observation without one
            // counts against unlocking (it resets the counters) instead of being skipped. Withholding reports while
            // the price is under a multiple can then only delay an unlock, never earn one.
            if (o.strict) _stepTranches(dt, o.twapBnb, o.twapBnb * o.bnbUsd / WAD);
            else _resetTranches();
            if (s == State.ACTIVE) {
                // Exit fix 1: the streak decays instead of resetting, so an hour above book cancels an hour
                // below book, not three days.
                uint256 st = exitStreak;
                if (o.twapBnb < b) st += dt;
                else st = st > dt ? st - dt : 0;
                exitStreak = st;
                if (st >= exitStreakNeeded) _openRound(b, o.twapBnb);
            }
        }

        lastTwap = o.twapBnb;
        lastSpot = o.spotBnb;
        lastTrusted = o.trusted;
        lastStrict = o.strict;
        lastAtlas = o.atlas;
        lastDeep = o.deep;
        lastObservedAt = uint64(block.timestamp);
        emit Observed(o.twapBnb, o.bnbUsd, b, o.trusted, o.strict, _state, exitStreak);
    }

    function _openRound(uint256 b, uint256 twap) internal {
        _state = State.EXIT_ROUND;
        uint64 now_ = uint64(block.timestamp);
        roundStart = now_;
        roundEnd = now_ + roundLength;
        exitStreak = 0;
        ++roundsOpened;
        emit ExitRoundOpened(roundEnd, b, twap);
    }

    /// @dev Tap accrual over the vault's own clock since the last accrual, excluding the most recent exit round,
    ///      capped at `maxStep`. Rate: min(dollar budget at BNB/USD, capBps of the free treasury) per 30 days.
    ///      BNB/USD is the strict observation's, else the last strict one while it is at most `staleAfter` old
    ///      (M-1). With no fresh rate nothing accrues: a cap-only fallback would let whoever pokes turn the dollar
    ///      budget into the cap by withholding reports, so an Atlas outage pauses the tap instead of raising it.
    function _accrueTap(Observation calldata o) internal {
        uint256 from = lastTapAt;
        uint256 to = block.timestamp;
        lastTapAt = uint64(to);
        State s = _state;
        if (s != State.ACTIVE && s != State.COOLDOWN) return;
        if (disclosurePaused || to <= from) return;

        uint256 span = to - from;
        uint256 rs = roundStart;
        uint256 re = roundEnd;
        if (re > from && rs < to) {
            uint256 lo = rs > from ? rs : from;
            uint256 hi = re < to ? re : to;
            span -= hi - lo;
        }
        if (span > maxStep) span = maxStep;
        if (span == 0) return;

        uint256 bal = address(this).balance;
        uint256 owed = owedTeam;
        if (bal <= owed) return;
        uint256 capAmt = (bal - owed) * tapCapBps * span / (BPS * PERIOD);

        uint256 ref = o.strict ? o.bnbUsd : freshBnbUsd();
        if (ref == 0) return;
        uint256 usdAmt = tapUsdPer30d * WAD * span / (ref * PERIOD);
        uint256 amt = usdAmt < capAmt ? usdAmt : capAmt;

        // A stolen key reaches at most one period's cap: unclaimed tap stops growing there.
        uint256 maxOwed = bal * tapCapBps / BPS;
        if (owed + amt > maxOwed) amt = maxOwed > owed ? maxOwed - owed : 0;
        if (amt == 0) return;
        owedTeam = owed + amt;
        emit TapAccrued(amt, owed + amt);
    }

    /// @dev Strict observations only. At or above the multiple adds time, below resets (strict toward the team).
    ///      The multiple must hold in dollars (TWAP x the Atlas BNB/USD rate, against the dollar sale price) AND in
    ///      BNB (the pool TWAP against the BNB sale price Q / A, on-chain numbers only). The BNB leg needs no
    ///      oracle, so no BNB/USD rate, however wrong, can advance an unlock counter on its own: one signer cannot
    ///      unlock team tokens early. The dollar leg still lets the team wait out a BNB rally that the token did
    ///      not share.
    function _stepTranches(uint256 dt, uint256 twapBnb, uint256 usdPrice) internal {
        uint256 usdSale = usdSalePrice;
        if (usdSale == 0) return;
        uint256 bnbSale = salePriceBnb;
        bool cliffPassed = block.timestamp >= uint256(launchedAt) + cliff;
        uint256 n = _tranches.length;
        for (uint256 k; k < n; ++k) {
            Tranche storage t = _tranches[k];
            if (t.unlocked) continue;
            if (usdPrice >= usdSale * t.multiple / 100 && twapBnb >= bnbSale * t.multiple / 100) {
                t.progress += uint64(dt);
            } else {
                t.progress = 0;
            }
            if (cliffPassed && t.progress >= unlockWindow) {
                t.unlocked = true;
                uint256 amt = t.amount;
                lockedTeam -= amt;
                unlockedUnreleased += amt;
                emit TrancheUnlocked(k, amt, t.multiple);
                _recordOutcome(int128(uint128(t.multiple)), "unlock");
            }
        }
    }

    /// @dev H-1: a trusted observation with no verified rate (or a shallow pool) resets every locked tranche.
    function _resetTranches() internal {
        uint256 n = _tranches.length;
        for (uint256 k; k < n; ++k) {
            Tranche storage t = _tranches[k];
            if (!t.unlocked && t.progress != 0) t.progress = 0;
        }
    }

    /// @dev Records a verified BNB/USD rate (1e18 USD per BNB) and, M-2, the dollar sale price: set by the first
    ///      reference (launch-time push read or first strict observation), then raised, never lowered, by higher
    ///      strict rates for `staleAfter`, then fixed. A poker who waits for a dip cannot lower the dollar targets.
    function _setStrictRate(uint256 rate) internal {
        lastBnbUsd = rate;
        lastStrictAt = uint64(block.timestamp);
        uint256 usd = salePriceBnb * rate / WAD;
        uint256 refAt = usdSaleRefAt;
        if (refAt == 0) {
            usdSaleRefAt = uint64(block.timestamp);
            usdSalePrice = usd;
            emit UsdSalePriceSet(usd, rate);
        } else if (block.timestamp <= refAt + staleAfter && usd > usdSalePrice) {
            usdSalePrice = usd;
            emit UsdSalePriceSet(usd, rate);
        }
    }

    /// @notice The last verified BNB/USD (1e18) if it is at most `staleAfter` old, else 0 (M-1: a stale rate never
    ///         prices the tap).
    function freshBnbUsd() public view returns (uint256) {
        uint256 at = lastStrictAt;
        if (at == 0 || block.timestamp - at > staleAfter) return 0;
        return lastBnbUsd;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Holders
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Contributors withdraw their sale tokens from the Token Dock, once.
    function claimTokens() external nonReentrant {
        if (!distributionInitialized) revert NotLive();
        if (tokensClaimed[msg.sender]) revert NothingToClaim();
        uint256 amount = ICovenantLauncher(launcher).allocationOf(msg.sender);
        if (amount == 0) revert NothingToClaim();
        tokensClaimed[msg.sender] = true;
        saleClaimed += amount;
        claimedCommitments += ICovenantLauncher(launcher).contributions(msg.sender);
        ITokenDock(_getTokenDockRouter()).withdraw(taxToken, amount, msg.sender);
        emit TokensClaimed(msg.sender, amount);
    }

    /// @notice Burn `amount` tokens for a pro rata share of the treasury. Only in an exit round (less the exit fee,
    ///         which stays in the treasury) or in wind-down (no fee). Pays on the tokens that actually reached the
    ///         burn address, at book value read before the burn.
    /// @param amount tokens (18 decimals) to send to the dead address
    /// @param minOut the least BNB in wei to accept
    /// @return out BNB in wei paid
    function redeem(uint256 amount, uint256 minOut) external nonReentrant returns (uint256 out) {
        _tick();
        State s = _state;
        if (s != State.EXIT_ROUND && s != State.WIND_DOWN) revert NotRedeemable();
        if (amount == 0) revert ZeroAmount();
        _sync();

        uint256 b = bookValue();
        address tok = taxToken;
        uint256 deadBefore = IERC20(tok).balanceOf(DEAD);
        tok.safeTransferFrom(msg.sender, DEAD, amount);
        uint256 burned = IERC20(tok).balanceOf(DEAD) - deadBefore;

        uint256 gross = burned * b / WAD;
        out = s == State.WIND_DOWN ? gross : gross - gross * exitFeeBps / BPS;
        if (out == 0) revert ZeroAmount();
        if (out < minOut) revert Slippage(out, minOut);

        totalRedeemed += out;
        tokensBurned += burned;
        _payOut(msg.sender, out);
        emit Redeemed(msg.sender, burned, out, b);
    }

    /// @notice Send unlocked tranches from the Token Dock to the team wallet. Anyone.
    function releaseTeam() external nonReentrant {
        uint256 amt = unlockedUnreleased;
        if (amt == 0) revert NothingToClaim();
        unlockedUnreleased = 0;
        teamReleased += amt;
        address to = teamWallet;
        ITokenDock(_getTokenDockRouter()).withdraw(taxToken, amt, to);
        emit TeamReleased(to, amt);
    }

    /// @notice Anyone: burn sale tokens no contributor can ever claim (the rounding remainder of a_i) and any tax
    ///         tokens sent to the vault itself, so they stop counting in R. Only what exceeds an upper bound on the
    ///         allocations still unclaimed is burned: sum(a_i) over unclaimed accounts <= A * (C - claimed) / C, so no
    ///         claim is ever touched. Everything left is burned once every contributor has claimed.
    /// @return amount tokens (18 decimals) sent to the dead address by this call
    function burnSaleDust() external nonReentrant returns (uint256 amount) {
        if (!distributionInitialized) revert NotLive();
        uint256 c = ICovenantLauncher(launcher).committed();
        uint256 owed = c == 0 ? 0 : _divUp(saleAmount * (c - claimedCommitments), c);
        uint256 left = saleAmount - saleClaimed - saleDustBurned;
        uint256 dust = left > owed ? left - owed : 0;
        uint256 stray = IERC20(taxToken).balanceOf(address(this));
        amount = dust + stray;
        if (amount == 0) revert NothingToClaim();
        uint256 total = saleDustBurned + amount;
        saleDustBurned = total;
        if (dust > 0) ITokenDock(_getTokenDockRouter()).withdraw(taxToken, dust, DEAD);
        if (stray > 0) taxToken.safeTransfer(DEAD, stray);
        emit SaleDustBurned(amount, total);
    }

    /// @notice Rule 4: after `heartbeat` of silence anyone ends the covenant. Unclaimed tap is forfeited to the
    ///         treasury, locked tranches burn, redemption opens with no fee and no deadline.
    function declareAbandoned() external nonReentrant {
        _tick();
        if (!funded) revert NotLive();
        if (_state == State.WIND_DOWN) revert Ended();
        uint256 deadline = heartbeatDeadline();
        if (block.timestamp <= deadline) revert NotAbandoned(deadline);
        _sync();
        uint256 forfeited = owedTeam;
        owedTeam = 0;
        _windDown(true, forfeited, WIND_DOWN_ABANDONED);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Team (or Flap's Guardian, per Flap's spec; Guardian calls never count as a heartbeat)
    // ═════════════════════════════════════════════════════════════════════════

    modifier onlyTeam() {
        if (msg.sender != teamWallet && msg.sender != _getGuardian()) revert NotTeam();
        _;
    }

    /// @notice Pay the accrued tap to the team wallet fixed at creation. A heartbeat.
    /// @return amt BNB in wei paid to the team wallet
    function claimTap() external onlyTeam nonReentrant returns (uint256 amt) {
        _tick();
        _sync();
        amt = owedTeam;
        if (amt == 0) revert NothingToClaim();
        owedTeam = 0;
        tapPaid += amt;
        if (msg.sender == teamWallet && _state != State.WIND_DOWN) _beat();
        address to = teamWallet;
        _payOut(to, amt);
        emit TapClaimed(to, amt);
    }

    /// @notice Lower the dollar budget. Only downwards. A heartbeat.
    /// @param newUsdPer30d the new dollar budget per 30 days, USD 1e18; must be lower
    function lowerTap(uint256 newUsdPer30d) external onlyTeam {
        if (_state == State.WIND_DOWN) revert Ended();
        uint256 cur = tapUsdPer30d;
        if (newUsdPer30d >= cur) revert TapNotLower(cur, newUsdPer30d);
        tapUsdPer30d = newUsdPer30d;
        emit TapLowered(cur, newUsdPer30d);
        if (msg.sender == teamWallet) _beat();
    }

    /// @notice Reset the abandonment clock.
    function heartbeat() external onlyTeam {
        if (_state == State.WIND_DOWN) revert Ended();
        if (msg.sender == teamWallet) _beat();
    }

    /// @notice Close honestly. Same end state as abandonment, but accrued tap stays claimable.
    /// @dev Team wallet or Flap's Guardian (Flap's spec: every permissioned function also accepts the Guardian).
    ///      A Guardian call ends the tap early on any covenant; it moves no funds, and the vault records which of
    ///      the two called (`windDownCause`, `WindDownCaused`) so the app shows it.
    ///      L-4: past the heartbeat deadline a wind-down is an abandonment: the unclaimed tap is forfeited to the
    ///      treasury, exactly as `declareAbandoned` would, so a lapsed team cannot wind down first to keep it.
    function windDown() external onlyTeam nonReentrant {
        _tick();
        if (!funded) revert NotLive();
        if (_state == State.WIND_DOWN) revert Ended();
        _sync();
        if (block.timestamp > heartbeatDeadline()) {
            uint256 forfeited = owedTeam;
            owedTeam = 0;
            _windDown(true, forfeited, WIND_DOWN_ABANDONED);
        } else {
            _windDown(false, 0, msg.sender == teamWallet ? WIND_DOWN_TEAM : WIND_DOWN_GUARDIAN);
        }
    }

    /// @notice Rule 5: store a report pointer, once per period (L-1: a verdict always judges the report that is on
    ///         record). A heartbeat from the team wallet. The Guardian can post too (Flap's spec); `reportPostedBy`
    ///         records who did.
    /// @param period the reporting period, from 1
    /// @param uri where the report lives (ipfs:// or https://)
    /// @param hash keccak256 of the report text
    function postReport(uint256 period, string calldata uri, bytes32 hash) external onlyTeam {
        Report storage r = _reports[period];
        if (r.postedAt != 0) revert ReportExists(period);
        ++reportsPosted;
        r.hash = hash;
        r.uri = uri;
        r.postedAt = uint64(block.timestamp);
        reportPostedBy[period] = msg.sender;
        emit ReportPosted(period, uri, hash);
        if (msg.sender == teamWallet && _state != State.WIND_DOWN) _beat();
    }

    /// @notice Rule 5: the relayer fixed at creation records the verdict on a period. A pass needs a posted report;
    ///         a fail may also mark a missing one. Tap accrual pauses while any period stands failed (L-2: a late
    ///         pass on an old period cannot lift a newer failure).
    /// @param period the period judged
    /// @param passed the verdict
    /// @param proofHash the relayer's proof reference (stored in the event only)
    function recordVerdict(uint256 period, bool passed, bytes32 proofHash) external {
        if (msg.sender != reportRelayer || reportRelayer == address(0)) revert NotRelayer();
        if (passed && _reports[period].postedAt == 0) revert NoReport(period);
        uint8 prev = verdictOf[period];
        uint256 failed = failedPeriods;
        if (prev == 2) --failed;
        if (!passed) ++failed;
        failedPeriods = failed;
        verdictOf[period] = passed ? 1 : 2;
        disclosurePaused = failed > 0;
        emit VerdictRecorded(period, passed, proofHash);
    }

    function _beat() internal {
        lastHeartbeat = uint64(block.timestamp);
        emit Heartbeat(msg.sender, block.timestamp);
    }

    function _windDown(bool abandoned, uint256 forfeited, uint8 cause) internal {
        windDownCause = cause;
        windDownBy = msg.sender;
        uint256 locked = lockedTeam;
        lockedTeam = 0;
        uint256 n = _tranches.length;
        for (uint256 k; k < n; ++k) {
            if (!_tranches[k].unlocked) _tranches[k].progress = 0;
        }
        _state = State.WIND_DOWN;
        if (locked > 0) ITokenDock(_getTokenDockRouter()).withdraw(taxToken, locked, DEAD);
        emit WoundDown(abandoned, forfeited, locked);
        emit WindDownCaused(msg.sender, cause);
        _recordOutcome(abandoned ? int128(-100) : int128(0), abandoned ? "abandoned" : "wound-down");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Agent layer: ERC-8004 track record
    // ═════════════════════════════════════════════════════════════════════════

    /// @dev Writes the outcome to the issuer's ERC-8004 record. Never blocks a rule: skipped for human teams or a
    ///      missing registry, and a reverting registry is caught. The caller must leave enough gas for the call so
    ///      that a caller cannot drop the record on purpose by starving it.
    function _recordOutcome(int128 value, string memory outcome) internal {
        uint256 id = agentId;
        address rep = _env.reputation;
        if (id == 0 || rep == address(0) || rep.code.length == 0) return;
        if (gasleft() < FEEDBACK_GAS + FEEDBACK_GAS / 63 + 30_000) revert InsufficientGas();
        string memory uri =
            string.concat("covenant:", LibString.toString(block.chainid), ":", LibString.toHexString(address(this)));
        bytes32 h =
            keccak256(abi.encode(address(this), outcome, address(this).balance, redeemableSupply(), block.timestamp));
        try IERC8004Reputation(rep).giveFeedback{gas: FEEDBACK_GAS}(id, value, 0, "covenant", outcome, "", uri, h) {
            ++outcomesRecorded;
            emit OutcomeRecorded(id, value, outcome, true);
        } catch {
            emit OutcomeRecorded(id, value, outcome, false);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Flap disclosure surface
    // ═════════════════════════════════════════════════════════════════════════

    function _divUp(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    /// @inheritdoc DirectLaunchVaultBase
    function description() public view override returns (string memory) {
        return CovenantVaultDisplay.describe(
            CovenantVaultDisplay.Snapshot({
                state: state(),
                treasury: address(this).balance,
                book: bookValue(),
                team: teamWallet,
                tapCapBps: tapCapBps,
                owed: owedTeam,
                locked: lockedTeam,
                multiples: _multiples(),
                saleAmount: saleAmount,
                exitFeeBps: exitFeeBps,
                agentId: agentId
            })
        );
    }

    function _multiples() internal view returns (uint256[] memory m) {
        uint256 n = _tranches.length;
        m = new uint256[](n);
        for (uint256 k; k < n; ++k) {
            m[k] = _tranches[k].multiple;
        }
    }

    /// @inheritdoc DirectLaunchVaultBase
    function vaultUISchema() public pure override returns (VaultUISchema memory) {
        return CovenantVaultDisplay.schema();
    }
}
