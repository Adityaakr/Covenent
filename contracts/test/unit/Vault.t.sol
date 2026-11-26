// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {Terms, State} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";

contract RevertingRegistry {
    fallback() external {
        revert("registry down");
    }
}

contract VaultRulesTest is CovenantTestBase {
    uint256 internal constant DEAD_SUPPLY_START = 0;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    CovenantLauncher internal l;
    CovenantVault internal v;
    IERC20 internal token;

    function setUp() public override {
        super.setUp();
        (l, v, token) = _launchDefault("rules");
        _claimAll(l, v);
        _poke(v, BNB_USD); // the keeper's first poke records the sale price in dollars
    }

    // ═════════════════════════════════════════════════════════════════════
    // Rule 1: tap
    // ═════════════════════════════════════════════════════════════════════

    function test_tap_firstPokeSetsTheDollarSalePrice() public view {
        assertEq(v.usdSalePrice(), v.salePriceBnb() * BNB_USD / 1e18);
        assertEq(v.lastBnbUsd(), BNB_USD);
    }

    function test_tap_accruesAtTheCap_whenTheCapBinds() public {
        uint256 bal = address(v).balance;
        _step(v, 1 hours, BNB_USD);
        // $30k at $600 is 50 BNB a month, above 4% of 375 BNB = 15 BNB: the cap binds.
        assertEq(v.owedTeam(), bal * 400 * 1 hours / (10_000 * 30 days));
        assertApproxEqRel(v.tapCapPer30d(), 15 ether, 1e15);
    }

    function test_tap_accruesTheDollarBudget_whenItBinds() public {
        vm.prank(team);
        v.lowerTap(3_000 ether);
        _step(v, 1 hours, BNB_USD);
        assertEq(v.owedTeam(), uint256(3_000 ether) * 1e18 * 1 hours / (BNB_USD * 30 days));
    }

    function test_tap_aPokeAddsAtMostSixHours() public {
        uint256 bal = address(v).balance;
        _step(v, 24 hours, BNB_USD);
        assertEq(v.owedTeam(), bal * 400 * 6 hours / (10_000 * 30 days), "sparse pokes slow the tap, never speed it");
    }

    function test_tap_withoutAtlas_usesTheLastStrictRate() public {
        uint256 bal = address(v).balance;
        _step(v, 1 hours, 0);
        assertFalse(v.lastStrict());
        assertEq(v.owedTeam(), bal * 400 * 1 hours / (10_000 * 30 days));
    }

    /// @dev M-1 and M-2: with no verified rate the tap does not run (no cap-only fallback a poker could reach by
    ///      withholding reports), and no dollar sale price is set, so no unlock counter moves.
    function test_tap_neverAnyAtlas_paysNothing() public {
        (CovenantLauncher l2, CovenantVault v2,) = _launchDefault("no-atlas-ever");
        l2;
        _poke(v2, 0);
        for (uint256 i; i < 20 * 4; ++i) {
            _step(v2, 6 hours, 0);
        }
        assertEq(v2.owedTeam(), 0, "no verified rate, no tap, even after staleAfter");
        assertEq(v2.usdSalePrice(), 0, "and the unlock counters stay frozen");
        _step(v2, 6 hours, BNB_USD);
        _step(v2, 6 hours, BNB_USD);
        assertGt(v2.owedTeam(), 0, "a verified rate restarts the tap");
    }

    function test_tap_unclaimedBalance_stopsAtOnePeriodsCap() public {
        for (uint256 i; i < 60 * 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertLe(v.owedTeam(), address(v).balance * 400 / 10_000, "a stolen key reaches at most one month's cap");
        assertApproxEqRel(v.owedTeam(), address(v).balance * 400 / 10_000, 1e15);
    }

    function test_claimTap_paysTheTeamWallet_andIsAHeartbeat() public {
        _step(v, 6 hours, BNB_USD);
        vm.warp(block.timestamp + 10 days);
        uint256 owed = v.owedTeam();
        uint256 before = team.balance;
        vm.prank(team);
        v.claimTap();
        assertEq(team.balance - before, owed);
        assertEq(v.owedTeam(), 0);
        assertEq(v.tapPaid(), owed);
        assertEq(v.lastHeartbeat(), block.timestamp);
        assertEq(v.accounted(), address(v).balance);
    }

    function test_guardianCalls_payTheTeam_butAreNoHeartbeat() public {
        _step(v, 6 hours, BNB_USD);
        uint256 hb = v.lastHeartbeat();
        vm.warp(block.timestamp + 1 days);
        uint256 owed = v.owedTeam();
        uint256 before = team.balance;
        vm.prank(guardian);
        v.claimTap();
        assertEq(team.balance - before, owed, "the payout address is fixed");
        vm.prank(guardian);
        v.heartbeat();
        assertEq(v.lastHeartbeat(), hb, "Flap cannot keep a silent team alive");
    }

    function test_lowerTap_onlyDownwards() public {
        vm.startPrank(team);
        vm.expectRevert(abi.encodeWithSelector(CovenantVault.TapNotLower.selector, 30_000 ether, 30_000 ether));
        v.lowerTap(30_000 ether);
        vm.expectRevert(abi.encodeWithSelector(CovenantVault.TapNotLower.selector, 30_000 ether, 40_000 ether));
        v.lowerTap(40_000 ether);
        v.lowerTap(10_000 ether);
        vm.stopPrank();
        assertEq(v.tapUsdPer30d(), 10_000 ether);
    }

    function test_disclosure_failedVerdictPausesTheTap_untilAPass() public {
        Terms memory t = _terms("disclosure");
        t.reportRelayer = relayer;
        CovenantLauncher l2 = _create(prod, t);
        _raiseOversubscribed(l2);
        _finalize(l2);
        CovenantVault v2 = CovenantVault(payable(l2.vault()));
        _poke(v2, BNB_USD);

        vm.prank(team);
        v2.postReport(1, "ipfs://report-1", keccak256("report-1"));
        (bytes32 h,, string memory uri) = v2.report(1);
        assertEq(h, keccak256("report-1"));
        assertEq(uri, "ipfs://report-1");

        vm.prank(relayer);
        v2.recordVerdict(1, false, keccak256("proof"));
        _step(v2, 6 hours, BNB_USD);
        assertEq(v2.owedTeam(), 0, "a failed report pauses accrual");

        vm.prank(relayer);
        v2.recordVerdict(1, true, keccak256("proof-2"));
        _step(v2, 6 hours, BNB_USD);
        assertGt(v2.owedTeam(), 0, "a passing one resumes it");
    }

    // ═════════════════════════════════════════════════════════════════════
    // Rule 3: book-value exit, with the three fixes
    // ═════════════════════════════════════════════════════════════════════

    function test_exit_opensAfterThreeTrustedDaysBelowBook() public {
        _dump();
        for (uint256 i; i < 11; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertEq(uint8(v.state()), uint8(State.ACTIVE));
        assertEq(v.exitStreak(), 66 hours);
        _step(v, 6 hours, BNB_USD);
        assertEq(uint8(v.state()), uint8(State.EXIT_ROUND));
        assertEq(v.roundEnd(), block.timestamp + 7 days);
        assertEq(v.exitStreak(), 0);
        assertEq(v.roundsOpened(), 1);
    }

    /// @dev Fix 1: one trusted observation at or above book no longer resets three days of streak. The team pumps
    ///      the price above book for an hour after two days below; under the old rule the holders would need three
    ///      more days, now they need one day and one hour.
    function test_exitFix1_streakDecays_anHourAboveBookCancelsOnlyAnHour() public {
        _dump();
        for (uint256 i; i < 8; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertEq(v.exitStreak(), 48 hours);

        // The team buys the price back above book for one hour...
        uint256 bought = _pumpAboveBook();
        _step(v, 1 hours, BNB_USD);
        assertGe(v.lastTwap(), v.bookValue(), "the hour was above book");
        assertEq(v.exitStreak(), 47 hours, "it cancelled one hour, not the streak");

        // ...and lets it fall back.
        _sell(token, team, bought);
        for (uint256 i; i < 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertEq(v.exitStreak(), 71 hours);
        _step(v, 1 hours, BNB_USD);
        assertEq(uint8(v.state()), uint8(State.EXIT_ROUND), "open 25 hours after the pump, not 72");
    }

    /// @dev Fix 2: the pool's BNB fell under half its launch seed. The depth gate now guards unlocks and the tap
    ///      rate only; the exit streak still counts in exactly the crash holders need it for.
    function test_exitFix2_countsInAShallowPool() public {
        _dump();
        _step(v, 6 hours, BNB_USD);
        (,,, bool deep, uint256 quoteReserve) = oracle.preview(address(v));
        assertLt(quoteReserve * 2, v.poolSeedQuote(), "pool BNB is under half the seed");
        assertFalse(deep);
        assertFalse(v.lastStrict(), "not strict: no unlock or dollar pricing");
        assertTrue(v.lastTrusted(), "but trusted for the exit");
        assertEq(v.exitStreak(), 6 hours);
        for (uint256 i; i < 11; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertEq(uint8(v.state()), uint8(State.EXIT_ROUND));
    }

    /// @dev Fix 3: the exit compares two on-chain numbers. With no Atlas report at all, it opens on time.
    function test_exitFix3_opensWithNoAtlasReportAtAll() public {
        (CovenantLauncher l2, CovenantVault v2, IERC20 t2) = _launchDefault("no-atlas-exit");
        _claimAll(l2, v2);
        _poke(v2, 0);
        vm.warp(block.timestamp + 601);
        _sell(t2, whale, t2.balanceOf(whale));
        for (uint256 i; i < 12; ++i) {
            _step(v2, 6 hours, 0);
        }
        assertEq(v2.lastBnbUsd(), 0, "Atlas never reported");
        assertEq(uint8(v2.state()), uint8(State.EXIT_ROUND), "three days below book, no oracle, round open");
    }

    function test_exit_roundCloses_intoCooldown_thenRearms() public {
        _openRound();
        uint256 owed = v.owedTeam();
        // During the round the tap is paused.
        for (uint256 i; i < 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertEq(v.owedTeam(), owed, "no tap during a round");
        assertEq(v.exitStreak(), 0, "no streak during a round");

        vm.warp(v.roundEnd());
        assertEq(uint8(v.state()), uint8(State.COOLDOWN));
        _poke(v, BNB_USD);
        assertEq(v.owedTeam(), owed, "a poke at the round's last second accrues nothing for the round");
        _step(v, 1 hours, BNB_USD);
        assertEq(v.exitStreak(), 0, "the trigger is disarmed in cooldown");
        assertGt(v.owedTeam(), owed, "the tap runs again in cooldown");

        vm.warp(uint256(v.roundEnd()) + 14 days);
        assertEq(uint8(v.state()), uint8(State.ACTIVE));
        _poke(v, BNB_USD);
        assertGt(v.exitStreak(), 0, "armed again");
    }

    function test_exit_tapExcludesTheRound_evenWithoutPokesDuringIt() public {
        _openRound();
        uint256 owed = v.owedTeam();
        uint256 roundEnd = v.roundEnd();
        vm.warp(roundEnd + 2 hours); // nobody poked during the round
        uint256 bal = address(v).balance;
        _poke(v, BNB_USD);
        assertEq(v.owedTeam() - owed, (bal - owed) * 400 * 2 hours / (10_000 * 30 days), "only the 2 hours after");
    }

    function test_redeem_paysBookLessTheFee_andRaisesBookForTheRest() public {
        _openRound();
        uint256 b = v.bookValue();
        uint256 amount = 6_000_000 ether;
        uint256 before = alice.balance;
        vm.startPrank(alice);
        token.approve(address(v), amount);
        uint256 out = v.redeem(amount, 0);
        vm.stopPrank();
        uint256 gross = amount * b / 1e18;
        assertEq(out, gross - gross * 100 / 10_000);
        assertEq(alice.balance - before, out);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(DEAD), amount, "burned to the dead address");
        assertGe(v.bookValue(), b, "remaining holders keep at least the same book value");
        assertEq(v.totalRedeemed(), out);
        assertEq(v.accounted(), address(v).balance);
    }

    function test_redeem_guards() public {
        vm.startPrank(alice);
        token.approve(address(v), type(uint256).max);
        vm.expectRevert(CovenantVault.NotRedeemable.selector);
        v.redeem(1 ether, 0);
        vm.stopPrank();

        _openRound();
        vm.startPrank(alice);
        vm.expectRevert(CovenantVault.ZeroAmount.selector);
        v.redeem(0, 0);
        uint256 quote = v.previewRedeem(1_000_000 ether);
        vm.expectRevert(abi.encodeWithSelector(CovenantVault.Slippage.selector, quote, quote + 1));
        v.redeem(1_000_000 ether, quote + 1);
        vm.stopPrank();

        vm.warp(v.roundEnd());
        vm.prank(alice);
        vm.expectRevert(CovenantVault.NotRedeemable.selector);
        v.redeem(1 ether, 0);
    }

    function testFuzz_redeem_neverLowersBookValue(uint256 amount, uint256 tax) public {
        _openRound();
        tax = bound(tax, 0, 50 ether);
        if (tax > 0) {
            vm.deal(address(this), tax);
            (bool ok,) = address(v).call{value: tax}("");
            assertTrue(ok);
        }
        uint256 bal = token.balanceOf(bob);
        amount = bound(amount, 1, bal);
        uint256 b = v.bookValue();
        if (amount * b / 1e18 < 102) return; // rounds to zero after the fee
        vm.startPrank(bob);
        token.approve(address(v), amount);
        v.redeem(amount, 0);
        vm.stopPrank();
        assertGe(v.bookValue(), b);
    }

    function test_trading_doesNotMoveBookValue() public {
        uint256 b = v.bookValue();
        vm.warp(block.timestamp + 601);
        _buy(token, stranger, 30 ether);
        _sell(token, stranger, token.balanceOf(stranger));
        assertEq(v.bookValue(), b, "pool tokens count in R, so trades never move book value");
        _dispatch(token);
        assertGt(v.bookValue(), b, "only the tax they leave raises it");
        assertGt(v.totalRevenue(), 0);
    }

    // ═════════════════════════════════════════════════════════════════════
    // Rule 4: abandonment switch
    // ═════════════════════════════════════════════════════════════════════

    function test_abandonment_opensTheTreasury_whenTheTeamStops() public {
        _step(v, 6 hours, BNB_USD);
        uint256 owed = v.owedTeam();
        assertGt(owed, 0);
        uint256 deadline = v.heartbeatDeadline();

        vm.warp(deadline);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(CovenantVault.NotAbandoned.selector, deadline));
        v.declareAbandoned();

        vm.warp(deadline + 1);
        assertTrue(v.abandonable());
        uint256 b = v.bookValue();
        uint256 r = v.redeemableSupply();
        vm.prank(stranger);
        v.declareAbandoned();

        assertEq(uint8(v.state()), uint8(State.WIND_DOWN));
        assertEq(v.owedTeam(), 0, "unclaimed tap is forfeited to the treasury");
        assertEq(v.lockedTeam(), 0);
        assertEq(token.balanceOf(DEAD), 250_000_000 ether, "locked team tokens burned");
        assertEq(v.redeemableSupply(), r, "burning locked tokens leaves R unchanged");
        assertGt(v.bookValue(), b, "the forfeited tap raises book value");

        // Redemption is open with no fee and no deadline.
        vm.warp(block.timestamp + 365 days);
        uint256 b2 = v.bookValue();
        vm.startPrank(alice);
        token.approve(address(v), 6_000_000 ether);
        uint256 out = v.redeem(6_000_000 ether, 0);
        vm.stopPrank();
        assertEq(out, 6_000_000 ether * b2 / 1e18, "no exit fee at wind-down");

        vm.prank(team);
        vm.expectRevert(CovenantVault.NothingToClaim.selector);
        v.claimTap();
        vm.expectRevert(CovenantVault.Ended.selector);
        v.declareAbandoned();
    }

    function test_abandonment_anyTeamActionResetsTheClock() public {
        vm.warp(block.timestamp + 40 days);
        vm.prank(team);
        v.heartbeat();
        vm.warp(block.timestamp + 40 days);
        vm.prank(stranger);
        vm.expectRevert();
        v.declareAbandoned();

        vm.prank(team);
        v.postReport(1, "ipfs://r", bytes32(uint256(1)));
        assertEq(v.lastHeartbeat(), block.timestamp);
        vm.warp(block.timestamp + 1 days);
        vm.prank(team);
        v.depositRevenue{value: 1 ether}("x402:data-sale");
        assertEq(v.lastHeartbeat(), block.timestamp);
    }

    function test_keeperPokes_doNotKeepASilentTeamAlive() public {
        for (uint256 i; i < 46 * 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        assertTrue(v.abandonable(), "only team actions are heartbeats");
    }

    function test_windDown_keepsAccruedTapClaimable() public {
        _step(v, 6 hours, BNB_USD);
        uint256 owed = v.owedTeam();
        vm.prank(team);
        v.windDown();
        assertEq(uint8(v.state()), uint8(State.WIND_DOWN));
        assertEq(v.owedTeam(), owed);
        _step(v, 6 hours, BNB_USD);
        assertEq(v.owedTeam(), owed, "no tap after wind-down");
        uint256 before = team.balance;
        vm.prank(team);
        v.claimTap();
        assertEq(team.balance - before, owed);
        vm.prank(team);
        vm.expectRevert(CovenantVault.Ended.selector);
        v.windDown();
    }

    /// @dev Flap's spec lets the Guardian call every team function, windDown included. The vault records who ended
    ///      the covenant so the app can show a Guardian wind-down for what it is.
    function test_windDown_recordsWhoEndedIt_teamGuardianOrAbandonment() public {
        assertEq(v.windDownCause(), 0);
        vm.expectEmit(true, false, false, true, address(v));
        emit CovenantVault.WindDownCaused(team, 1);
        vm.prank(team);
        v.windDown();
        assertEq(v.windDownCause(), 1, "team");
        assertEq(v.windDownBy(), team);

        (, CovenantVault v2,) = _launchDefault("guardian-wind-down");
        vm.expectEmit(true, false, false, true, address(v2));
        emit CovenantVault.WindDownCaused(guardian, 2);
        vm.prank(guardian);
        v2.windDown();
        assertEq(uint8(v2.state()), uint8(State.WIND_DOWN));
        assertEq(v2.windDownCause(), 2, "Flap's Guardian");
        assertEq(v2.windDownBy(), guardian);

        (, CovenantVault v3,) = _launchDefault("abandoned-cause");
        vm.warp(block.timestamp + 46 days);
        vm.prank(stranger);
        v3.declareAbandoned();
        assertEq(v3.windDownCause(), 3, "abandoned");
        assertEq(v3.windDownBy(), stranger);

        vm.prank(stranger);
        vm.expectRevert(CovenantVault.NotTeam.selector);
        v3.windDown();
    }

    // ═════════════════════════════════════════════════════════════════════
    // Rule 2: performance unlock
    // ═════════════════════════════════════════════════════════════════════

    /// @dev Audit fix: one signer's bad BNB/USD rate must not unlock team tokens. A report at 10x the real rate makes
    ///      the dollar price look like 10x the sale price, but the pool still trades at the sale price in BNB, so no
    ///      counter moves, before or after the cliff.
    function test_unlock_anOutlierAtlasRateAloneCannotUnlock() public {
        vm.warp(uint256(v.launchedAt()) + 180 days); // past the cliff
        for (uint256 i; i < 31 * 4; ++i) {
            _step(v, 6 hours, BNB_USD * 10);
        }
        assertTrue(v.lastStrict(), "the forged-rate pokes were strict");
        for (uint256 k; k < 3; ++k) {
            (,, uint256 progress, bool unlocked,) = v.trancheProgress(k);
            assertEq(progress, 0, "no unlock time without the multiple in BNB");
            assertFalse(unlocked);
        }
        assertEq(v.lockedTeam(), 250_000_000 ether, "every team token still locked");
    }

    /// @dev And the other way: the pool at 2x in BNB with an honest rate still unlocks; a rate that understates
    ///      BNB (dollar leg fails) holds it back, so the team cannot ride a bad low rate either.
    function test_unlock_needsTheMultipleInBnbAndInDollars() public {
        _pumpTo(205);
        vm.warp(uint256(v.launchedAt()) + 180 days);
        for (uint256 i; i < 10 * 4; ++i) {
            _step(v, 6 hours, BNB_USD / 4); // the dollar price reads ~0.5x: dollar leg fails
        }
        (,, uint256 progress,,) = v.trancheProgress(0);
        assertEq(progress, 0);
        for (uint256 i; i < 31 * 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        (,,, bool unlocked,) = v.trancheProgress(0);
        assertTrue(unlocked, "both legs held for the window");
    }

    function test_unlock_firstTranche_after30StrictDaysAt2x_andTheCliff() public {
        _pumpTo(205); // the dollar price at 2.05x the sale price, BNB/USD unchanged
        // 30 strict days above 2x before the cliff are not enough on their own...
        for (uint256 i; i < 31 * 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        (,, uint256 progress, bool unlocked,) = v.trancheProgress(0);
        assertGe(progress, 30 days);
        assertFalse(unlocked, "the cliff has not passed");
        (,, uint256 p1,,) = v.trancheProgress(1);
        assertEq(p1, 0, "4x is not reached");

        // ...the first strict observation after the cliff unlocks the 2x tranche.
        vm.warp(uint256(v.launchedAt()) + 180 days);
        uint256 b = v.bookValue();
        _poke(v, BNB_USD);
        (,,, unlocked,) = v.trancheProgress(0);
        assertTrue(unlocked);
        assertEq(v.lockedTeam(), 200_000_000 ether);
        assertEq(v.unlockedUnreleased(), 50_000_000 ether);
        assertLt(v.bookValue(), b, "unlocked tokens join R and dilute book value");

        v.releaseTeam();
        assertEq(token.balanceOf(team), 50_000_000 ether);
        vm.expectRevert(CovenantVault.NothingToClaim.selector);
        v.releaseTeam();
    }

    function test_unlock_aStrictObservationBelowResetsTheCounter() public {
        _pumpTo(205);
        for (uint256 i; i < 10 * 4; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        (,, uint256 progress,,) = v.trancheProgress(0);
        assertEq(progress, 10 days);
        _step(v, 6 hours, BNB_USD / 2); // BNB halves: the dollar price falls under 2x
        (,, progress,,) = v.trancheProgress(0);
        assertEq(progress, 0, "strict toward the team");
    }

    function test_unlock_untrustedTimeNeverCounts() public {
        _pumpTo(205);
        for (uint256 i; i < 10 * 4; ++i) {
            _step(v, 6 hours, 0); // no Atlas report: not strict
        }
        (,, uint256 progress,,) = v.trancheProgress(0);
        assertEq(progress, 0, "no counter moves without a verified dollar rate");
    }

    // ═════════════════════════════════════════════════════════════════════
    // Agent layer
    // ═════════════════════════════════════════════════════════════════════

    function test_agent_abandonment_isWrittenToTheAgentsERC8004Record() public {
        (CovenantVault va, uint256 id) = _agentCovenant("agent-abandon");
        vm.warp(va.heartbeatDeadline() + 1);
        vm.recordLogs();
        vm.prank(stranger);
        va.declareAbandoned();
        assertEq(reputation.getLastIndex(id, address(va)), 1);
        (int128 value, uint8 dec, string memory tag1, string memory tag2, bool revoked) =
            reputation.readFeedback(id, address(va), 1);
        assertEq(value, -100);
        assertEq(dec, 0);
        assertEq(tag1, "covenant");
        assertEq(tag2, "abandoned");
        assertFalse(revoked);
        assertEq(va.outcomesRecorded(), 1);

        CovenantLens.Issuer memory i = lens.issuer(address(va));
        assertEq(i.agentId, id);
        assertTrue(i.agentBound);
        assertEq(i.agentURI, "ipfs://issuer-agent.json");
        assertEq(i.outcomesFromThisVault, 1);
    }

    function test_agent_windDown_andUnlock_areRecordedToo() public {
        (CovenantVault va, uint256 id) = _agentCovenant("agent-wind");
        vm.prank(team);
        va.windDown();
        (int128 value,,, string memory tag2,) = reputation.readFeedback(id, address(va), 1);
        assertEq(value, 0);
        assertEq(tag2, "wound-down");
    }

    function test_agent_aBrokenRegistryNeverBlocksTheSwitch() public {
        (CovenantVault va, uint256 id) = _agentCovenant("agent-broken");
        id;
        vm.etch(chain.reputation, address(new RevertingRegistry()).code);
        vm.warp(va.heartbeatDeadline() + 1);
        vm.recordLogs();
        vm.prank(stranger);
        va.declareAbandoned();
        assertEq(uint8(va.state()), uint8(State.WIND_DOWN), "the rule held");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawFailedRecord;
        for (uint256 k; k < logs.length; ++k) {
            if (logs[k].topics[0] == CovenantVault.OutcomeRecorded.selector) {
                (, string memory outcome, bool ok) = abi.decode(logs[k].data, (int128, string, bool));
                assertEq(outcome, "abandoned");
                sawFailedRecord = !ok;
            }
        }
        assertTrue(sawFailedRecord);
    }

    function test_agent_aStarvedCallerCannotDropTheRecord() public {
        (CovenantVault va,) = _agentCovenant("agent-starve");
        vm.warp(va.heartbeatDeadline() + 1);
        vm.prank(stranger);
        (bool ok,) = address(va).call{gas: 400_000}(abi.encodeCall(CovenantVault.declareAbandoned, ()));
        assertFalse(ok, "too little gas for the record reverts the whole call");
        assertEq(uint8(va.state()), uint8(State.ACTIVE));
    }

    function test_agent_revenueForwarding_raisesBookValue() public {
        uint256 b = v.bookValue();
        vm.recordLogs();
        vm.prank(team);
        v.depositRevenue{value: 5 ether}("x402:market-data");
        assertGt(v.bookValue(), b);
        assertEq(v.totalRevenue(), 5 ether);
        vm.prank(stranger);
        v.depositRevenue{value: 1 ether}("customer");
        assertEq(v.totalRevenue(), 6 ether);
        vm.expectRevert(CovenantVault.ZeroAmount.selector);
        v.depositRevenue{value: 0}("");
    }

    function test_lens_oneCallStatus_andDownside() public {
        CovenantLens.Status memory s = lens.status(address(l));
        assertEq(s.vault, address(v));
        assertEq(uint8(s.state), uint8(State.ACTIVE));
        assertEq(s.committed, 1_400 ether);
        assertEq(s.accepted, 500 ether);
        assertEq(s.bookValue, v.bookValue());
        assertEq(s.tranches.length, 3);
        assertEq(s.tranches[2].multiple, 800);
        assertLt(s.premiumBps, 7_000);
        assertGt(s.premiumBps, 6_000, "the pool opens ~66% above a 60% floor");
        assertEq(s.contributorCount, 4);

        CovenantLens.Downside memory d = lens.downside(address(v), alice, 0);
        assertEq(d.tokens, 6_000_000 ether);
        assertEq(d.redeemNow, 0, "no round open");
        assertApproxEqRel(d.atBookGross, 3 ether, 1e12, "6M tokens are backed by 3 BNB from day one");
        assertApproxEqAbs(d.floorBpsOfSale, 6_000, 1, "floor at 60% of the sale price");
        assertApproxEqRel(d.spendPer30d, 15 ether, 1e15);
        assertApproxEqAbs(d.runwayDays, 750, 1);
        assertApproxEqAbs(d.floorIn12MonthsBpsOfSale, 3_677, 10, "36.8% after a year at the cap (design doc table)");

        (address[] memory ls, uint256 total) = lens.list(address(prod.launcherFactory), 0, 10);
        assertEq(total, 1);
        assertEq(ls[0], address(l));
    }

    // ── helpers ────────────────────────────────────────────────────────────

    /// @dev The whale sells everything: price falls far below book and the pool's BNB under half its seed.
    function _dump() internal {
        vm.warp(block.timestamp + 601);
        _sell(token, whale, token.balanceOf(whale));
        assertLt(_spot(v), v.bookValue());
    }

    function _openRound() internal {
        _dump();
        for (uint256 i; i < 12; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        require(v.state() == State.EXIT_ROUND, "round did not open");
    }

    /// @dev The team buys until the pool price is above book; returns the tokens it bought.
    function _pumpAboveBook() internal returns (uint256 bought) {
        uint256 before = token.balanceOf(team);
        vm.deal(team, 500 ether);
        for (uint256 i; i < 20 && _spot(v) <= v.bookValue() * 11 / 10; ++i) {
            _buy(token, team, 10 ether);
        }
        bought = token.balanceOf(team) - before;
    }

    /// @dev Buy until the spot price is `pct`% of the sale price.
    function _pumpTo(uint256 pct) internal {
        vm.warp(block.timestamp + 601);
        uint256 target = v.salePriceBnb() * pct / 100;
        vm.deal(stranger, 10_000 ether);
        for (uint256 i; i < 200 && _spot(v) < target; ++i) {
            _buy(token, stranger, 2 ether);
        }
        assertGe(_spot(v), target);
    }

    function _agentCovenant(bytes32 seed) internal returns (CovenantVault va, uint256 id) {
        vm.prank(team);
        id = identity.register("ipfs://issuer-agent.json");
        Terms memory t = _terms(seed);
        t.agentId = id;
        CovenantLauncher la = _create(prod, t);
        _raiseOversubscribed(la);
        _finalize(la);
        va = CovenantVault(payable(la.vault()));
        _poke(va, BNB_USD);
    }
}
