// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {Terms, State} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {ITokenDock} from "src/flap/ILaunchVaultSpec.sol";
import {MockAggregator} from "src/mocks/MockERC8004.sol";

/// @notice Regression tests for the independent pre-audit (26 Nov 2026, report covenant-preaudit). Each test is the
///         report's PoC (Appendix B, `PreAuditPoC.t.sol`) with its assertion turned around: the PoC showed the issue,
///         this shows the fix. Names keep the finding id.
contract PreAuditRegressionTest is CovenantTestBase {
    function _live(bytes32 seed) internal returns (CovenantLauncher l, CovenantVault v, IERC20 token) {
        (l, v, token) = _launchDefault(seed);
        _claimAll(l, v);
    }

    function _pumpVault(CovenantVault v, IERC20 token, uint256 pct) internal {
        vm.warp(block.timestamp + 601);
        uint256 target = v.salePriceBnb() * pct / 100;
        vm.deal(stranger, 100_000 ether);
        for (uint256 i; i < 400 && _spot(v) < target; ++i) {
            _buy(token, stranger, 2 ether);
        }
        require(_spot(v) >= target, "pump failed");
    }

    function _progress(CovenantVault v, uint256 k) internal view returns (uint256 p, bool unlocked) {
        (,, p, unlocked,) = v.trancheProgress(k);
    }

    // ═════════════════════════════════════════════════════════════════════
    // H-1: withholding the Atlas report no longer skips the tranche reset
    // ═════════════════════════════════════════════════════════════════════

    function test_H1_withheldReports_resetTheTranches_insteadOfSkippingThem() public {
        (, CovenantVault honest, IERC20 tokH) = _live("h1-honest");
        (, CovenantVault gamed, IERC20 tokG) = _live("h1-gamed");
        _poke(honest, BNB_USD);
        _poke(gamed, BNB_USD);
        _pumpVault(honest, tokH, 205);
        _pumpVault(gamed, tokG, 205);
        vm.warp(uint256(gamed.launchedAt()) + 180 days);
        _poke(honest, BNB_USD);
        _poke(gamed, BNB_USD);

        // 60 days: one day the dollar price is 2.05x (BNB/USD 600), the next 1.54x (450). The gamed vault gets bare
        // pokes on the down days, as the report's attacker sends them.
        for (uint256 d; d < 60; ++d) {
            bool up = d % 2 == 0;
            for (uint256 i; i < 4; ++i) {
                vm.warp(block.timestamp + 6 hours);
                _poke(honest, up ? BNB_USD : 450 ether);
                _poke(gamed, up ? BNB_USD : 0);
            }
        }
        (uint256 pH, bool uH) = _progress(honest, 0);
        (uint256 pG, bool uG) = _progress(gamed, 0);
        assertFalse(uH, "honest: every down day resets the counter");
        assertFalse(uG, "gamed: a bare poke now resets too, so withheld reports earn nothing");
        assertLt(pH, 2 days);
        assertLt(pG, 2 days);
        assertEq(gamed.unlockedUnreleased(), 0);
    }

    // ═════════════════════════════════════════════════════════════════════
    // M-1: withholding reports can no longer keep a stale BNB/USD pricing the tap
    // ═════════════════════════════════════════════════════════════════════

    /// @dev The report's attacker poked without a rate to keep the $600 rate while BNB rose to $1,200. Since Flap's
    ///      re-review (F5) a report-carrying poke waits only for the previous report-carrying poke, so the keeper's
    ///      report lands right after the attacker's bare poke and the tap follows the fresh rate. (With no report at
    ///      all, the tap keeps the dollar budget at the last verified rate: `FlapReReview.test_F5_*`.)
    function test_M1_withheldReports_cannotKeepTheRateStale() public {
        (, CovenantVault honest,) = _live("m1-honest");
        (, CovenantVault gamed,) = _live("m1-gamed");
        _poke(honest, BNB_USD);
        _poke(gamed, BNB_USD);
        vm.prank(team);
        honest.lowerTap(3_000 ether);
        vm.prank(team);
        gamed.lowerTap(3_000 ether);

        uint256 h0 = honest.owedTeam();
        uint256 g0 = gamed.owedTeam();
        for (uint256 i; i < 4 * 30; ++i) {
            vm.warp(block.timestamp + 6 hours);
            _poke(honest, 1_200 ether);
            vm.prank(stranger);
            oracle.poke(address(gamed)); // the attacker pokes first, without a rate
            _poke(gamed, 1_200 ether); // the keeper's report still lands, in the same block
        }
        uint256 h = honest.owedTeam() - h0;
        uint256 g = gamed.owedTeam() - g0;
        assertApproxEqRel(h, 2.5 ether, 1e15, "honest: $3,000 at $1,200 over 30 days");
        // Only the attacker's first bare poke is priced at the old $600 (6 hours of 720): under 1% more.
        assertApproxEqRel(g, h, 1e16, "the report still prices the tap");
        assertEq(gamed.lastBnbUsd(), 1_200 ether, "the fresh rate is recorded");
    }

    // ═════════════════════════════════════════════════════════════════════
    // M-2: no poker picks the dollar sale price
    // ═════════════════════════════════════════════════════════════════════

    function test_M2_deferredFirstReport_cannotLowerTheDollarTargets() public {
        (, CovenantVault v, IERC20 tok) = _live("m2");
        _poke(v, 0);
        for (uint256 i; i < 4 * 20; ++i) {
            _step(v, 6 hours, 0);
        }
        assertEq(v.usdSalePrice(), 0, "no dollar sale price yet");
        assertEq(v.owedTeam(), 0, "and no cap-only tap to collect while waiting (M-1)");
        // The dip report sets a first reference...
        _step(v, 6 hours, 400 ether);
        assertEq(v.usdSalePrice(), v.salePriceBnb() * 400 ether / 1e18);
        // ...but the next honest report within staleAfter raises it: a dip can never lower the targets.
        _step(v, 6 hours, BNB_USD);
        assertEq(v.usdSalePrice(), v.salePriceBnb() * BNB_USD / 1e18, "ratcheted to the honest rate");
        // At 1.4x in BNB nothing counts toward the 2x tranche, in dollars or in BNB.
        _pumpVault(v, tok, 140);
        _step(v, 6 hours, BNB_USD);
        (uint256 p,) = _progress(v, 0);
        assertEq(p, 0, "1.4x in BNB clears no 2x target");
        // After the window the reference is fixed.
        vm.warp(uint256(v.usdSaleRefAt()) + 15 days);
        _step(v, 6 hours, 900 ether);
        assertEq(v.usdSalePrice(), v.salePriceBnb() * BNB_USD / 1e18, "fixed after staleAfter");
    }

    /// @dev M-2 on a chain with an Atlas push feed: the dollar sale price is fixed in the launch transaction.
    function test_M2_pushFeed_fixesTheDollarSalePriceAtLaunch() public {
        MockAggregator feed = new MockAggregator(8);
        feed.set(612_00000000, block.timestamp);
        CovenantOracle push = new CovenantOracle(DEV_BNB_USD_FEED, atlasSigner, address(feed), 1 days);
        Pair memory p = _deployPair(address(this), chain, address(push), CovenantProfiles.production(), "push");
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(p.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(p.vaultFactory), 10_000, true);
        vm.stopPrank();
        CovenantLauncher l = _create(p, _terms("m2-push"));
        _raiseOversubscribed(l);
        feed.set(612_00000000, uint256(l.saleDeadline()));
        _finalize(l);
        CovenantVault v = CovenantVault(payable(l.vault()));
        assertEq(v.usdSaleRefAt(), v.launchedAt(), "set in the launch transaction");
        assertEq(v.usdSalePrice(), v.salePriceBnb() * 612 ether / 1e18);
        assertEq(v.lastBnbUsd(), 612 ether);
    }

    // ═════════════════════════════════════════════════════════════════════
    // M-3: terms the live Portal refuses are refused at creation
    // ═════════════════════════════════════════════════════════════════════

    function test_M3_termsThePortalRefuses_areRefusedAtCreation() public {
        CovenantLauncherFactory f = prod.launcherFactory;
        Terms memory t = _terms("m3-notax");
        t.buyTaxBps = 0;
        t.sellTaxBps = 0;
        vm.expectRevert(CovenantTermsLib.BadTax.selector);
        f.checkTerms(t);

        t = _terms("m3-1s");
        t.taxDuration = 1;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, 1));
        f.checkTerms(t);

        t = _terms("m3-max");
        t.taxDuration = type(uint32).max;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, type(uint32).max));
        f.checkTerms(t);

        t = _terms("m3-onesided");
        t.buyTaxBps = 0; // one side may be zero, as on Flap
        f.checkTerms(t);
    }

    // ═════════════════════════════════════════════════════════════════════
    // L-1 and L-2: disclosure
    // ═════════════════════════════════════════════════════════════════════

    function _relayed(bytes32 seed) internal returns (CovenantVault v) {
        Terms memory t = _terms(seed);
        t.reportRelayer = relayer;
        CovenantLauncher l = _create(prod, t);
        _raiseOversubscribed(l);
        _finalize(l);
        v = CovenantVault(payable(l.vault()));
        _poke(v, BNB_USD);
    }

    function test_L1_aReportCannotBeRewritten_afterAVerdict() public {
        CovenantVault v = _relayed("rpt");
        vm.prank(team);
        v.postReport(1, "ipfs://honest-report", keccak256("honest"));
        vm.prank(relayer);
        v.recordVerdict(1, true, keccak256("proof"));
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(CovenantVault.ReportExists.selector, 1));
        v.postReport(1, "ipfs://different-report", keccak256("different"));
        (bytes32 h,, string memory uri) = v.report(1);
        assertEq(h, keccak256("honest"));
        assertEq(uri, "ipfs://honest-report");
        assertEq(v.reportPostedBy(1), team);
    }

    function test_L2_aLatePassCannotLiftANewerFailure() public {
        CovenantVault v = _relayed("vrd");
        vm.prank(team);
        v.postReport(1, "ipfs://p1", keccak256("p1"));
        vm.prank(relayer);
        v.recordVerdict(2, false, keccak256("period 2 missing")); // a fail may mark a missing report
        assertTrue(v.disclosurePaused());
        vm.prank(relayer);
        v.recordVerdict(1, true, keccak256("period 1 late pass"));
        assertTrue(v.disclosurePaused(), "period 2 still stands failed");
        assertEq(v.failedPeriods(), 1);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CovenantVault.NoReport.selector, 99));
        v.recordVerdict(99, true, bytes32(0));
        // Period 2 posted and passed: the pause lifts.
        vm.prank(team);
        v.postReport(2, "ipfs://p2", keccak256("p2"));
        vm.prank(relayer);
        v.recordVerdict(2, true, keccak256("period 2 pass"));
        assertFalse(v.disclosurePaused());
        assertEq(v.failedPeriods(), 0);
    }

    function test_I2_theTeamCannotBeItsOwnRelayer() public {
        Terms memory t = _terms("self-relay");
        t.reportRelayer = team;
        vm.expectRevert(CovenantTermsLib.BadRelayer.selector);
        prod.launcherFactory.checkTerms(t);
    }

    // ═════════════════════════════════════════════════════════════════════
    // Guardian powers: kept (Flap's spec), now disclosed in full and recorded
    // ═════════════════════════════════════════════════════════════════════

    function test_guardianPowers_areDisclosed_andRecorded() public {
        (, CovenantVault v,) = _live("guardian");
        _poke(v, BNB_USD);
        vm.startPrank(guardian);
        v.lowerTap(0);
        v.postReport(1, "ipfs://written-by-guardian", keccak256("g"));
        vm.stopPrank();
        assertEq(v.tapUsdPer30d(), 0, "the Guardian can lower the tap to zero for good (disclosed)");
        assertEq(v.reportPostedBy(1), guardian, "and the vault records that the Guardian posted the report");
        string memory d = v.description();
        assertTrue(_contains(d, "wind the covenant down, lower the tap, post a report and claim the tap"));
    }

    // ═════════════════════════════════════════════════════════════════════
    // L-3: salt squatting is Flap's salt lock (first locker wins); the issuer re-mines
    // ═════════════════════════════════════════════════════════════════════

    function test_L3_aSquattedSalt_isRefused_andTheIssuerCreatesWithAFreshOne() public {
        Terms memory victim = _terms("squat");
        Terms memory squat = _terms("squat-copy"); // a separate struct: memory assignment would alias
        bytes32 fresh = squat.salt; // already mined: the issuer's next salt
        squat.salt = victim.salt;
        squat.teamWallet = stranger;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(stranger);
        portal.newLauncher{value: fee}(address(prod.launcherFactory), abi.encode(squat));
        vm.prank(team);
        vm.expectRevert();
        portal.newLauncher{value: fee}(address(prod.launcherFactory), abi.encode(victim));
        // Known issue (docs/KNOWN-ISSUES.md): a new salt is a few seconds of mining, and the squatter's launcher pays
        // its own team wallet, which the covenant page shows.
        victim.salt = fresh;
        vm.prank(team);
        address l = portal.newLauncher{value: fee}(address(prod.launcherFactory), abi.encode(victim));
        assertEq(CovenantLauncher(payable(l)).terms().teamWallet, team);
    }

    // ═════════════════════════════════════════════════════════════════════
    // L-4: a lapsed team cannot wind down to keep the tap
    // ═════════════════════════════════════════════════════════════════════

    function test_L4_aLapsedTeam_windingDown_forfeitsTheTap() public {
        (, CovenantVault v,) = _live("lapse");
        _poke(v, BNB_USD);
        for (uint256 i; i < 4 * 10; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        vm.warp(v.heartbeatDeadline() + 1 days);
        assertTrue(v.abandonable());
        uint256 owed = v.owedTeam();
        assertGt(owed, 0);
        uint256 treasury = address(v).balance;
        vm.prank(team);
        v.windDown();
        assertEq(v.windDownCause(), 3, "treated as abandonment");
        assertEq(v.owedTeam(), 0, "the tap is forfeited to the treasury");
        assertEq(address(v).balance, treasury, "nothing left the vault");
        vm.prank(team);
        vm.expectRevert(CovenantVault.NothingToClaim.selector);
        v.claimTap();
    }

    // ═════════════════════════════════════════════════════════════════════
    // Section 3, dust: both pools are swept (BNB to the vault, sale tokens to DEAD); I-1 stray tokens too
    // ═════════════════════════════════════════════════════════════════════

    function test_dust_saleTokenRemainder_isBurned_neverAnUnclaimedAllocation() public {
        (CovenantLauncher l, CovenantVault v, IERC20 tok) = _launchDefault("dust");
        uint256 sum = l.allocationOf(alice) + l.allocationOf(bob) + l.allocationOf(carol) + l.allocationOf(whale);
        uint256 dust = l.saleAmount() - sum;
        assertGt(dust, 0, "token dust exists");

        // Before anyone claims, everything left is owed: nothing to burn.
        vm.expectRevert(CovenantVault.NothingToClaim.selector);
        v.burnSaleDust();

        // Alice and Bob claim: the bound still covers Carol and the whale, so only dust can go.
        vm.prank(alice);
        v.claimTokens();
        vm.prank(bob);
        v.claimTokens();
        try v.burnSaleDust() {} catch {}
        vm.prank(carol);
        v.claimTokens();
        vm.prank(whale);
        v.claimTokens(); // never short: their allocations were never burned

        // Everyone claimed: the rest is pure dust, plus tokens someone sent to the vault by mistake (I-1).
        uint256 stray = tok.balanceOf(alice) / 10;
        vm.prank(alice);
        tok.transfer(address(v), stray);
        uint256 r0 = v.redeemableSupply();
        uint256 dead0 = tok.balanceOf(DEAD_ADDR);
        uint256 burned0 = v.saleDustBurned();
        v.burnSaleDust();
        assertEq(v.saleDustBurned(), dust + stray, "the whole remainder and the stray tokens");
        assertEq(tok.balanceOf(DEAD_ADDR) - dead0, dust + stray - burned0);
        assertEq(tok.balanceOf(address(v)), 0);
        assertLt(v.redeemableSupply(), r0, "they leave R");
        assertEq(
            ITokenDock(chain.dockRouter).balanceOf(address(tok), address(v)),
            v.lockedTeam(),
            "dock holds only team tokens"
        );

        // The BNB side: the launcher's buffer goes to the treasury once every refund is out.
        address[4] memory who = [alice, bob, carol, whale];
        for (uint256 i; i < 4; ++i) {
            vm.prank(who[i]);
            l.claimRefund();
        }
        uint256 bnbDust = address(l).balance;
        assertGt(bnbDust, 0);
        l.sweepDust();
        assertEq(address(l).balance, 0);
    }

    address internal constant DEAD_ADDR = 0x000000000000000000000000000000000000dEaD;

    /// @dev Kept from the pre-audit as evidence (it passed there too): every refund is payable, dust <= n wei.
    function testFuzz_launcherRefundsAlwaysPayable(uint256 seed, uint8 nRaw, uint96 capRaw) public {
        uint256 n = bound(nRaw, 1, 24);
        Terms memory t = _terms(keccak256(abi.encode("fz", seed)));
        t.cap = bound(capRaw, 200 ether, 500 ether);
        CovenantLauncher l = _create(prod, t);
        address[] memory who = new address[](n);
        for (uint256 i; i < n; ++i) {
            who[i] = address(uint160(0xF0000 + i));
            uint256 amt = bound(uint256(keccak256(abi.encode(seed, i))), 1 ether, 300 ether) + i;
            vm.deal(who[i], amt);
            vm.prank(who[i]);
            l.contribute{value: amt}();
        }
        if (l.committed() < t.minRaise) return;
        _finalize(l);
        if (l.state() != State.ACTIVE) return;
        for (uint256 i; i < n; ++i) {
            if (l.refundOf(who[i]) == 0) continue;
            vm.prank(who[i]);
            l.claimRefund();
        }
        assertLe(address(l).balance, n, "dust is at most a wei per contributor");
        if (address(l).balance > 0) {
            l.sweepDust();
            assertEq(address(l).balance, 0, "and it can always be swept once every refund is out");
        }
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i <= h.length - n.length; ++i) {
            bool ok = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
