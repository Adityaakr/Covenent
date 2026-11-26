// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20Like {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

/// Fake-chain stand-in for CovenantVault, written to docs/DESIGN.md "Smart contract specification"
/// with the three exit-rule fixes applied:
///  1. the exit streak decays by the elapsed time on an observation at or above book instead of resetting;
///  2. the pool-depth gate (strict) guards tap rate and unlocks only, never the exit;
///  3. the exit step uses on-chain numbers only, so it runs on every observation, trusted or not.
/// It exists so the server's keeper, API, agents and MCP tools can be tested on anvil before the
/// real contracts land. It is not the product contract.
contract MockCovenantVault {
    enum State { RAISING, FAILED, ACTIVE, EXIT_ROUND, COOLDOWN, WIND_DOWN }

    struct Observation {
        uint32 elapsed;
        uint256 twapBnb;
        uint256 bnbUsd;
        bool trusted;
        bool strict;
    }

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant MAX_STEP = 6 hours;

    address public token;
    address public launcher;
    address public oracle;
    address public teamWallet;
    address public pair;
    uint256 public agentId;

    State public state;
    uint256 public salePriceBnb;
    uint256 public usdSalePrice;
    uint256 public tapUsdPer30d;
    uint16 public tapCapBps;
    uint32 public exitStreakTarget;
    uint32 public roundLength;
    uint32 public cooldown;
    uint16 public exitFeeBps;
    uint32 public heartbeatWindow;
    uint32 public unlockWindow;

    uint256 public exitStreak;
    uint256 public roundEnd;
    uint256 public cooldownEnd;
    uint256 public lastHeartbeat;
    uint256 public owedTeam;
    uint256 public lockedTeam;
    uint256 public ledger;
    uint256 public totalRedeemed;
    uint256 public totalTapPaid;
    uint256 public lastObservedAt;
    bool public lastTrusted;
    bool public lastStrict;

    uint16[] public trancheMultiple;
    uint256[] public trancheAmount;
    uint256[] internal _progress;
    bool[] public trancheUnlocked;

    mapping(uint256 => bytes32) public reportHash;

    event TreasuryFunded(uint256 amount, address pool);
    event RevenueRecognized(uint256 amount);
    event Observed(uint256 twapBnb, uint256 bnbUsd, uint256 bookValue, bool trusted, uint8 state);
    event TapClaimed(address indexed to, uint256 amount);
    event TapLowered(uint256 oldUsd, uint256 newUsd);
    event ExitRoundOpened(uint256 endsAt);
    event ExitRoundClosed(uint256 cooldownEndsAt);
    event Redeemed(address indexed holder, uint256 tokens, uint256 out, uint256 bookValue);
    event TrancheUnlocked(uint256 indexed index, uint256 amount);
    event Heartbeat(uint256 at);
    event WoundDown(uint8 reason);
    event ReportPosted(uint256 indexed period, string uri, bytes32 hash);

    error NotRedeemable();
    error Slippage();
    error NotTeam();
    error NotOracle();
    error NotDue();
    error OnlyDown();
    error BadState();

    struct Init {
        address token;
        address launcher;
        address oracle;
        address teamWallet;
        address pair;
        uint256 agentId;
        uint256 salePriceBnb;
        uint256 tapUsdPer30d;
        uint16 tapCapBps;
        uint32 exitStreak;
        uint32 roundLength;
        uint32 cooldown;
        uint16 exitFeeBps;
        uint32 heartbeat;
        uint32 unlockWindow;
        uint256 lockedTeam;
    }

    constructor(Init memory i, uint16[] memory multiples, uint256[] memory amounts) {
        token = i.token;
        launcher = i.launcher;
        oracle = i.oracle;
        teamWallet = i.teamWallet;
        pair = i.pair;
        agentId = i.agentId;
        salePriceBnb = i.salePriceBnb;
        tapUsdPer30d = i.tapUsdPer30d;
        tapCapBps = i.tapCapBps;
        exitStreakTarget = i.exitStreak;
        roundLength = i.roundLength;
        cooldown = i.cooldown;
        exitFeeBps = i.exitFeeBps;
        heartbeatWindow = i.heartbeat;
        unlockWindow = i.unlockWindow;
        lockedTeam = i.lockedTeam;
        trancheMultiple = multiples;
        trancheAmount = amounts;
        for (uint256 k; k < multiples.length; k++) {
            _progress.push(0);
            trancheUnlocked.push(false);
        }
        state = State.ACTIVE;
        lastHeartbeat = block.timestamp;
    }

    receive() external payable {
        _sync();
    }

    function sync() external {
        _sync();
    }

    function fundTreasury(address pool) external payable {
        ledger += msg.value;
        pair = pool;
        emit TreasuryFunded(msg.value, pool);
    }

    // ---------------------------------------------------------------- views

    function redeemableSupply() public view returns (uint256) {
        IERC20Like t = IERC20Like(token);
        return t.totalSupply() - t.balanceOf(DEAD) - lockedTeam;
    }

    function bookValue() public view returns (uint256) {
        uint256 r = redeemableSupply();
        if (r == 0) return 0;
        uint256 bal = address(this).balance;
        uint256 net = bal > owedTeam ? bal - owedTeam : 0;
        return net * 1e18 / r;
    }

    function tapAccrued() external view returns (uint256) {
        return owedTeam;
    }

    function trancheCount() external view returns (uint256) {
        return trancheMultiple.length;
    }

    function trancheProgress(uint256 k) external view returns (uint256) {
        return _progress[k];
    }

    function treasury() external view returns (uint256) {
        return address(this).balance;
    }

    // ---------------------------------------------------------------- core step

    modifier onlyTeam() {
        if (msg.sender != teamWallet) revert NotTeam();
        _;
    }

    function onObservation(Observation calldata o) external {
        if (msg.sender != oracle) revert NotOracle();
        _tick();
        _sync();
        uint256 dt = o.elapsed > MAX_STEP ? MAX_STEP : o.elapsed;
        if (state == State.ACTIVE || state == State.COOLDOWN) _accrueTap(dt, o);
        if (o.trusted && o.strict) {
            if (usdSalePrice == 0) usdSalePrice = salePriceBnb * o.bnbUsd / 1e18;
            _stepTranches(dt, o.twapBnb * o.bnbUsd / 1e18);
        }
        // Fixes 2 and 3: the exit step compares two on-chain numbers and ignores the trust flags.
        if (state == State.ACTIVE) {
            if (o.twapBnb < bookValue()) {
                exitStreak += dt;
            } else {
                // Fix 1: decay by the elapsed time instead of resetting to zero.
                exitStreak = exitStreak > dt ? exitStreak - dt : 0;
            }
            if (exitStreak >= exitStreakTarget) _openRound();
        }
        lastObservedAt = block.timestamp;
        lastTrusted = o.trusted;
        lastStrict = o.strict;
        emit Observed(o.twapBnb, o.bnbUsd, bookValue(), o.trusted, uint8(state));
    }

    function redeem(uint256 amount, uint256 minOut) external {
        _tick();
        if (state != State.EXIT_ROUND && state != State.WIND_DOWN) revert NotRedeemable();
        _sync();
        uint256 b = bookValue();
        uint256 beforeBal = IERC20Like(token).balanceOf(DEAD);
        IERC20Like(token).transferFrom(msg.sender, DEAD, amount);
        uint256 got = IERC20Like(token).balanceOf(DEAD) - beforeBal;
        uint256 gross = got * b / 1e18;
        uint256 out = state == State.WIND_DOWN ? gross : gross - gross * exitFeeBps / 10_000;
        if (out < minOut) revert Slippage();
        totalRedeemed += out;
        ledger -= out;
        (bool ok,) = msg.sender.call{value: out}("");
        require(ok, "send");
        emit Redeemed(msg.sender, got, out, b);
    }

    function claimTap() external onlyTeam {
        _tick();
        uint256 amt = owedTeam;
        owedTeam = 0;
        ledger -= amt;
        totalTapPaid += amt;
        _beat();
        (bool ok,) = teamWallet.call{value: amt}("");
        require(ok, "send");
        emit TapClaimed(teamWallet, amt);
    }

    function lowerTap(uint256 newUsd) external onlyTeam {
        if (newUsd >= tapUsdPer30d) revert OnlyDown();
        emit TapLowered(tapUsdPer30d, newUsd);
        tapUsdPer30d = newUsd;
        _beat();
    }

    function heartbeat() external onlyTeam {
        _beat();
    }

    function postReport(uint256 period, string calldata uri, bytes32 hash) external onlyTeam {
        reportHash[period] = hash;
        emit ReportPosted(period, uri, hash);
        _beat();
    }

    function windDown() external onlyTeam {
        if (state == State.WIND_DOWN || state == State.FAILED) revert BadState();
        _enterWindDown(0);
    }

    function declareAbandoned() external {
        if (state == State.WIND_DOWN || state == State.FAILED) revert BadState();
        if (block.timestamp <= lastHeartbeat + heartbeatWindow) revert NotDue();
        owedTeam = 0;
        _enterWindDown(1);
    }

    // ---------------------------------------------------------------- internals

    function _beat() internal {
        lastHeartbeat = block.timestamp;
        emit Heartbeat(block.timestamp);
    }

    function _enterWindDown(uint8 reason) internal {
        state = State.WIND_DOWN;
        if (lockedTeam > 0) {
            IERC20Like(token).transfer(DEAD, lockedTeam);
            lockedTeam = 0;
        }
        emit WoundDown(reason);
    }

    function _tick() internal {
        if (state == State.EXIT_ROUND && block.timestamp >= roundEnd) {
            state = State.COOLDOWN;
            cooldownEnd = block.timestamp + cooldown;
            emit ExitRoundClosed(cooldownEnd);
        }
        if (state == State.COOLDOWN && block.timestamp >= cooldownEnd) {
            state = State.ACTIVE;
            exitStreak = 0;
        }
    }

    function _sync() internal {
        uint256 bal = address(this).balance;
        if (bal > ledger) {
            uint256 d = bal - ledger;
            ledger = bal;
            emit RevenueRecognized(d);
        }
    }

    function _accrueTap(uint256 dt, Observation calldata o) internal {
        uint256 bal = address(this).balance;
        uint256 t = bal > owedTeam ? bal - owedTeam : 0;
        uint256 capAmt = dt * tapCapBps * t / (10_000 * 30 days);
        uint256 amt = capAmt;
        if (o.trusted && o.strict && o.bnbUsd > 0) {
            uint256 usdAmt = dt * tapUsdPer30d * 1e18 / (30 days * o.bnbUsd);
            if (usdAmt < amt) amt = usdAmt;
        }
        owedTeam += amt;
    }

    function _stepTranches(uint256 dt, uint256 usdPrice) internal {
        for (uint256 k; k < trancheMultiple.length; k++) {
            if (trancheUnlocked[k]) continue;
            if (usdPrice * 100 >= usdSalePrice * trancheMultiple[k]) {
                _progress[k] += dt;
                if (_progress[k] >= unlockWindow) {
                    trancheUnlocked[k] = true;
                    lockedTeam -= trancheAmount[k];
                    IERC20Like(token).transfer(teamWallet, trancheAmount[k]);
                    emit TrancheUnlocked(k, trancheAmount[k]);
                }
            } else {
                _progress[k] = 0;
            }
        }
    }

    function _openRound() internal {
        state = State.EXIT_ROUND;
        roundEnd = block.timestamp + roundLength;
        exitStreak = 0;
        emit ExitRoundOpened(roundEnd);
    }
}
