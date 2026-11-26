// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {StackBuilder} from "script/lib/StackBuilder.sol";
import {State} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {MockV2Router} from "src/mocks/MockV2.sol";
import {MockPortal, MockTaxProcessor, MockTokenDockRouter} from "src/mocks/MockFlap.sol";

/// @notice Drives one live covenant through random sequences of trades, pokes (with and without Atlas), tax,
///         revenue, tap claims, redemptions, heartbeats and the abandonment switch, and keeps the ghost records
///         the invariants need.
contract VaultHandler is Test, StackBuilder {
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal constant BPS = 10_000;

    CovenantVault public v;
    CovenantLauncher public l;
    IERC20 public token;
    CovenantOracle public oracle;
    MockV2Router public router;
    MockPortal public portal;
    address public wbnb;
    address public team;
    uint256 internal atlasKey;
    address[] internal holders;

    // ghosts
    bool public redemptionLoweredBook;
    bool public untrustedMovedACounter;
    bool public badEdge;
    State public lastState;
    uint256 public calls;
    uint256 public roundsSeen;
    uint256 public redeemsOk;
    uint256 public windDownsSeen;

    struct Accrual {
        uint256 at;
        uint256 amount;
        uint256 freeBefore;
        uint256 revBefore; // totalRevenue before this poke
        uint256 revAfter; // and after it (the poke syncs revenue first)
    }

    Accrual[] internal _accruals;

    constructor(
        CovenantVault v_,
        CovenantLauncher l_,
        CovenantOracle oracle_,
        MockV2Router router_,
        MockPortal portal_,
        address wbnb_,
        address team_,
        uint256 atlasKey_,
        address[] memory holders_
    ) {
        v = v_;
        l = l_;
        token = IERC20(l_.token());
        oracle = oracle_;
        router = router_;
        portal = portal_;
        wbnb = wbnb_;
        team = team_;
        atlasKey = atlasKey_;
        holders = holders_;
        lastState = v_.state();
        for (uint256 i; i < holders_.length; ++i) {
            vm.prank(holders_[i]);
            token.approve(address(v_), type(uint256).max);
        }
    }

    function accrualCount() external view returns (uint256) {
        return _accruals.length;
    }

    function accrualAt(uint256 i) external view returns (Accrual memory) {
        return _accruals[i];
    }

    function _after() internal {
        ++calls;
        State s = v.state();
        State p = lastState;
        if (p != s) {
            bool ok = (p == State.ACTIVE && s == State.EXIT_ROUND) || (p == State.EXIT_ROUND && s == State.COOLDOWN)
                || (p == State.EXIT_ROUND && s == State.ACTIVE) // round and cooldown both elapsed between looks
                || (p == State.COOLDOWN && s == State.ACTIVE) || (p != State.WIND_DOWN && s == State.WIND_DOWN);
            if (!ok) badEdge = true;
            if (s == State.EXIT_ROUND) ++roundsSeen;
            if (s == State.WIND_DOWN) ++windDownsSeen;
        }
        lastState = s;
    }

    // ── actions ────────────────────────────────────────────────────────────

    /// @dev Time passes and the keeper pokes, as in production. Most of the time the team stays alive (seed),
    ///      so runs spend long stretches in ACTIVE, EXIT_ROUND and COOLDOWN instead of all ending in WIND_DOWN.
    function warp(uint256 dt, uint256 seed, bool withAtlas) external {
        uint256 end = block.timestamp + bound(dt, 1 hours, 2 days);
        while (block.timestamp + 6 hours <= end) {
            vm.warp(block.timestamp + 6 hours);
            this.poke(seed, withAtlas);
        }
        vm.warp(end);
        if (seed % 10 != 0) {
            vm.prank(team);
            try v.heartbeat() {} catch {}
        }
        _after();
    }

    /// @dev The whale-style crash that opens exit rounds.
    function dump(uint256 who) external {
        this.sell(who, 100);
    }

    function poke(uint256 priceSeed, bool withAtlas) external {
        if (block.timestamp < oracle.nextPokeAt(address(v))) vm.warp(oracle.nextPokeAt(address(v)));
        uint256 price = withAtlas ? bound(priceSeed, 200 ether, 1_200 ether) : 0;
        uint256 streak0 = v.exitStreak();
        uint256[] memory prog0 = _progress();
        uint256 owed0 = v.owedTeam();
        uint256 free0 = v.freeTreasury();
        uint256 rev0 = v.totalRevenue();
        bool wasActive = v.state() == State.ACTIVE;

        bytes memory data = _pokeCalldata(address(v), atlasKey, price, block.timestamp);
        (bool ok,) = address(oracle).call(data);
        if (!ok) return;

        // Ghost for invariant 7: an untrusted observation moves no counter; a non-strict one never adds unlock time
        // (H-1: a trusted one without a verified rate resets the tranches instead).
        if (!v.lastTrusted() && wasActive && v.state() == State.ACTIVE && v.exitStreak() != streak0) {
            untrustedMovedACounter = true;
        }
        if (!v.lastStrict()) {
            uint256[] memory prog1 = _progress();
            for (uint256 k; k < prog1.length; ++k) {
                if (prog1[k] > prog0[k]) untrustedMovedACounter = true;
                if (!v.lastTrusted() && prog1[k] != prog0[k]) untrustedMovedACounter = true;
            }
        }
        // Ghost for invariant 4: every accrual with the free treasury and revenue before it.
        uint256 owed1 = v.owedTeam();
        if (owed1 > owed0) _accruals.push(Accrual(block.timestamp, owed1 - owed0, free0, rev0, v.totalRevenue()));
        _after();
    }

    function buy(uint256 who, uint256 bnb) external {
        address a = holders[who % holders.length];
        bnb = bound(bnb, 0.01 ether, 80 ether);
        vm.deal(a, a.balance + bnb);
        address[] memory path = new address[](2);
        path[0] = wbnb;
        path[1] = address(token);
        vm.prank(a);
        try router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnb}(0, path, a, block.timestamp) {}
            catch {}
        _after();
    }

    function sell(uint256 who, uint256 pct) external {
        address a = holders[who % holders.length];
        uint256 amt = token.balanceOf(a) * bound(pct, 1, 100) / 100;
        if (amt == 0) return;
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = wbnb;
        vm.startPrank(a);
        token.approve(address(router), amt);
        try router.swapExactTokensForETHSupportingFeeOnTransferTokens(amt, 0, path, a, block.timestamp) {} catch {}
        vm.stopPrank();
        _after();
    }

    function dispatchTax() external {
        MockTaxProcessor(payable(portal.taxProcessorOf(address(token)))).dispatch();
        _after();
    }

    function gift(uint256 amt) external {
        amt = bound(amt, 1, 20 ether);
        vm.deal(address(v), address(v).balance + amt); // forced BNB: counted as revenue on the next sync
        _after();
    }

    function depositRevenue(uint256 amt, bool fromTeam) external {
        amt = bound(amt, 1, 20 ether);
        address from = fromTeam ? team : holders[0];
        vm.deal(from, from.balance + amt);
        vm.prank(from);
        try v.depositRevenue{value: amt}("revenue") {} catch {}
        _after();
    }

    function claimTap() external {
        vm.prank(team);
        try v.claimTap() {} catch {}
        _after();
    }

    function lowerTap(uint256 pct) external {
        uint256 cur = v.tapUsdPer30d();
        if (cur == 0) return;
        vm.prank(team);
        try v.lowerTap(cur * bound(pct, 0, 99) / 100) {} catch {}
        _after();
    }

    function heartbeat() external {
        vm.prank(team);
        try v.heartbeat() {} catch {}
        _after();
    }

    function redeem(uint256 who, uint256 pct) external {
        address a = holders[who % holders.length];
        uint256 amt = token.balanceOf(a) * bound(pct, 1, 100) / 100;
        if (amt == 0) return;
        uint256 b0 = v.bookValue();
        vm.prank(a);
        try v.redeem(amt, 0) {
            ++redeemsOk;
            if (v.bookValue() < b0) redemptionLoweredBook = true;
        } catch {}
        _after();
    }

    function declareAbandoned() external {
        if (!v.abandonable()) return;
        try v.declareAbandoned() {} catch {}
        _after();
    }

    function windDown(uint256 seed) external {
        if (seed % 25 != 0) return; // rare
        vm.prank(team);
        try v.windDown() {} catch {}
        _after();
    }

    function releaseTeam() external {
        try v.releaseTeam() {} catch {}
        _after();
    }

    function _progress() internal view returns (uint256[] memory p) {
        uint256 n = v.trancheCount();
        p = new uint256[](n);
        for (uint256 k; k < n; ++k) {
            (,, p[k],,) = v.trancheProgress(k);
        }
    }
}

/// @notice The seven invariants of the design document ("Invariants to test"), plus the revenue ledger.
contract CovenantInvariantTest is CovenantTestBase {
    VaultHandler internal h;
    CovenantLauncher internal l;
    CovenantVault internal v;
    IERC20 internal token;

    function setUp() public override {
        super.setUp();
        (l, v, token) = _launchDefault("invariant");
        _claimAll(l, v);
        _poke(v, BNB_USD);
        vm.warp(block.timestamp + 601);
        address[] memory holders = new address[](4);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = carol;
        holders[3] = whale;
        h = new VaultHandler(v, l, oracle, router, portal, chain.wbnb, team, atlasKey, holders);
        targetContract(address(h));
    }

    /// 1. The vault's BNB balance is never less than owedTeam.
    function invariant_1_balanceCoversTheTapOwed() public view {
        assertGe(address(v).balance, v.owedTeam());
    }

    /// 2. A redemption never lowers book value for the holders who remain.
    function invariant_2_redemptionNeverLowersBook() public view {
        assertFalse(h.redemptionLoweredBook());
    }

    /// 3. (raise math) Accepted amounts sum to at most Q, and accepted + refund == commitment for every buyer.
    function invariant_3_raiseSettlement() public view {
        address[4] memory who = [alice, bob, carol, whale];
        uint256 sum;
        for (uint256 i; i < 4; ++i) {
            uint256 a = l.acceptedOf(who[i]);
            sum += a;
            uint256 c = l.contributions(who[i]);
            assertEq(a + (c - a), c);
            assertTrue(l.refunded(who[i]) || l.refundOf(who[i]) == c - a);
        }
        assertLe(sum, l.accepted());
    }

    /// 4. Tap accrued over any 30 days is at most tapCapBps of the free treasury at the start of that window, plus
    ///    the revenue that arrived inside it (accrual is priced on the treasury of the moment, and revenue raises
    ///    it). One poke can reach back up to 6 hours before the window.
    function invariant_4_tapBoundedByTheCapOverAny30Days() public view {
        uint256 n = h.accrualCount();
        uint256 cap = v.tapCapBps();
        for (uint256 i; i < n; ++i) {
            VaultHandler.Accrual memory a = h.accrualAt(i);
            uint256 sum;
            uint256 revEnd = a.revAfter;
            for (uint256 j = i; j < n; ++j) {
                VaultHandler.Accrual memory b = h.accrualAt(j);
                if (b.at >= a.at + 30 days) break;
                sum += b.amount;
                revEnd = b.revAfter;
            }
            uint256 base = a.freeBefore + (revEnd - a.revBefore);
            uint256 bound_ = base * cap * (30 days + 6 hours) / (10_000 * 30 days);
            assertLe(sum, bound_ + 10, "tap over a 30-day window exceeds the cap");
        }
    }

    /// 5. Locked team tokens leave the vault only to the team wallet after an unlock, or to the burn address at
    ///    wind-down: the dock holds exactly the locked, the unlocked-unreleased and the unclaimed sale tokens.
    function invariant_5_reservedTokensAreAccountedFor() public view {
        uint256 docked = MockTokenDockRouter(chain.dockRouter).balanceOf(address(token), address(v));
        assertEq(docked, v.lockedTeam() + v.unlockedUnreleased() + (v.saleAmount() - v.saleClaimed()));
        assertEq(token.balanceOf(team), v.teamReleased(), "team tokens reach the team only through releaseTeam");
    }

    /// 6. State only moves along the edges of the state table; WIND_DOWN is terminal.
    function invariant_6_stateMovesOnlyAlongTheTable() public view {
        assertFalse(h.badEdge());
        if (h.lastState() == State.WIND_DOWN) assertEq(uint8(v.state()), uint8(State.WIND_DOWN));
    }

    /// 7. With no trusted observation, no counter changes; with no strict one, no tranche counter grows (H-1).
    function invariant_7_untrustedObservationsMoveNoCounter() public view {
        assertFalse(h.untrustedMovedACounter());
    }

    /// Not an invariant: the share of runs that reached the interesting states, printed with -vv.
    /// @dev Coverage record, not an assertion: one line per run in cache/invariant-coverage.txt (rounds opened,
    ///      redemptions, wind-down, tap accruals), so a run that never left ACTIVE is visible.
    function afterInvariant() external {
        vm.writeLine(
            "cache/invariant-coverage.txt",
            string.concat(
                vm.toString(h.calls()),
                " ",
                vm.toString(h.roundsSeen()),
                " ",
                vm.toString(h.redeemsOk()),
                " ",
                vm.toString(h.windDownsSeen()),
                " ",
                vm.toString(h.accrualCount())
            )
        );
    }

    /// Revenue ledger: the baseline never exceeds the balance, and book value is never negative.
    function invariant_ledger_baselineNeverAboveBalance() public view {
        assertLe(v.accounted(), address(v).balance);
    }
}

/// @notice Invariants 3 and 6 for the launcher: random commitments, refunds and a finalize at a random moment.
contract RaiseHandler is Test {
    CovenantLauncher public l;
    address[] internal actors;
    bool public finalized;
    State public firstFinal;
    bool public badEdge;

    constructor(CovenantLauncher l_, address[] memory actors_) {
        l = l_;
        actors = actors_;
    }

    function contribute(uint256 who, uint256 amt) external {
        address a = actors[who % actors.length];
        amt = bound(amt, 1, 300 ether);
        vm.deal(a, a.balance + amt);
        vm.prank(a);
        try l.contribute{value: amt}() {} catch {}
    }

    function finalize(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 0, 2 days));
        try l.finalize() {
            finalized = true;
            firstFinal = l.state();
        } catch {}
        if (finalized && l.state() != firstFinal) badEdge = true;
    }

    function refund(uint256 who) external {
        address a = actors[who % actors.length];
        vm.prank(a);
        try l.claimRefund() {} catch {}
        if (finalized && l.state() != firstFinal) badEdge = true;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract RaiseInvariantTest is CovenantTestBase {
    RaiseHandler internal h;
    CovenantLauncher internal l;

    function setUp() public override {
        super.setUp();
        l = _create(prod, _terms("raise-invariant"));
        address[] memory actors = new address[](5);
        for (uint256 i; i < 5; ++i) {
            actors[i] = address(uint160(0xB0B00000 + i));
        }
        h = new RaiseHandler(l, actors);
        targetContract(address(h));
    }

    function invariant_3_acceptedPlusRefundIsTheCommitment_andRefundsAreCovered() public view {
        uint256 n = h.actorCount();
        uint256 sumAccepted;
        uint256 sumContrib;
        uint256 owed;
        for (uint256 i; i < n; ++i) {
            address a = h.actorAt(i);
            uint256 c = l.contributions(a);
            uint256 acc = l.acceptedOf(a);
            sumContrib += c;
            sumAccepted += acc;
            if (!l.refunded(a)) {
                uint256 r = l.refundOf(a);
                if (l.state() == State.ACTIVE) assertEq(acc + r, c);
                if (l.state() == State.FAILED) assertEq(r, c);
                owed += r;
            }
        }
        assertEq(sumContrib, l.committed());
        if (l.state() == State.ACTIVE) assertLe(sumAccepted, l.accepted(), "sum q_i <= Q");
        assertGe(address(l).balance, owed, "the launcher can always pay every refund");
    }

    function invariant_6_launcherStatesAreTerminal() public view {
        assertFalse(h.badEdge());
    }
}
