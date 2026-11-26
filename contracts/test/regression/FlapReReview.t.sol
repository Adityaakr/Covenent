// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {Terms, State, Profile, VaultEnv} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {FlapChain} from "src/launcher/IFlapPreflight.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantVaultFactory} from "src/vault/CovenantVaultFactory.sol";
import {CovenantVaultDisplay} from "src/vault/CovenantVaultDisplay.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {VaultUISchema} from "src/flap/IVaultSchemas.sol";

/// @notice A name screen that does not answer.
contract DownScreen {
    function isScamWord(string calldata, string calldata) external pure returns (bool, bool) {
        revert("screen down");
    }
}

/// @notice Flap's audit bot, pre-audit of 641afab (26 Nov 2026), findings F1 to F8: each test is the bot's PoC
///         scenario with the assertion the bot asked for. The same scenarios run against Flap's live Portal on forks
///         of BNB Chain and BNB testnet in `test/fork/Covenant.BSC.fork.t.sol` (`test_fork_F*`).
contract FlapReReviewTest is CovenantTestBase {
    function _live(bytes32 seed) internal returns (CovenantLauncher l, CovenantVault v, IERC20 token) {
        (l, v, token) = _launchDefault(seed);
        _claimAll(l, v);
    }

    /// @dev Buy until the spot price is `pct`% of the BNB sale price.
    function _pump(CovenantVault v, IERC20 token, uint256 pct) internal {
        vm.warp(block.timestamp + 601);
        uint256 target = v.salePriceBnb() * pct / 100;
        vm.deal(stranger, 100_000 ether);
        for (uint256 i; i < 400 && _spot(v) < target; ++i) {
            _buy(token, stranger, 2 ether);
        }
        require(_spot(v) >= target, "pump failed");
    }

    /// @dev Sell the stranger's tokens until the spot price is under `pct`% of the BNB sale price.
    function _dipUnder(CovenantVault v, IERC20 token, uint256 pct) internal {
        uint256 target = v.salePriceBnb() * pct / 100;
        uint256 bal = token.balanceOf(stranger);
        for (uint256 i; i < 50 && _spot(v) >= target; ++i) {
            _sell(token, stranger, bal / 20);
        }
        require(_spot(v) < target, "dip failed");
    }

    /// @dev A poke with no report, from someone other than the keeper. Bubbles reverts.
    function _bare(CovenantVault v) internal {
        vm.prank(stranger);
        oracle.poke(address(v));
    }

    function _progress(CovenantVault v, uint256 k) internal view returns (uint256 p, bool unlocked) {
        (,, p, unlocked,) = v.trancheProgress(k);
    }

    // ═════════════════════════════════════════════════════════════════════
    // F1: the pool-seed floor is Flap's graduation floor, with a safety margin
    // ═════════════════════════════════════════════════════════════════════

    function _split(bytes32 seed, uint16 saleBps, uint16 poolBps) internal returns (Terms memory t) {
        t = _terms(seed);
        t.saleBps = saleBps;
        t.poolBps = poolBps;
        uint256 team = 10_000 - saleBps - poolBps;
        if (team == 0) {
            t.trancheBps = new uint16[](0);
            t.trancheMultiple = new uint16[](0);
        } else {
            t.trancheBps = new uint16[](1);
            t.trancheBps[0] = uint16(team);
            t.trancheMultiple = new uint16[](1);
            t.trancheMultiple[0] = 200;
        }
    }

    /// @dev The bot's pool shares: 5%, 15%, 50%. At each, the minimum raise's seed is 1.5x Flap's graduation floor
    ///      at Flap's price, the minimum passes, one wei less is refused, and both profiles apply the same floor.
    function test_F1_floorByPoolShare_5_15_50_isTheGraduationFloorWithAMargin() public {
        uint16[3] memory pool = [uint16(500), 1_500, 5_000];
        uint16[3] memory sale = [uint16(7_000), 6_000, 5_000];
        uint256[3] memory floorUsd = [uint256(30_000 ether), 10_000 ether, 3_000 ether]; // $1,500 x S / P at 1x
        Pair memory demo = _deployPair(address(this), chain, address(oracle), CovenantProfiles.demo(), "demo");
        vm.prank(admin);
        portal.setVaultFactoryMultiplier(address(demo.vaultFactory), 10_000, true);
        for (uint256 i; i < 3; ++i) {
            Terms memory t = _split(bytes32(i), sale[i], pool[i]);
            (uint256 minRaise, uint256 minSeed, uint256 fUsd, uint256 price, bool graduation, uint256 margin) =
                prod.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
            assertTrue(graduation);
            assertEq(margin, 15_000);
            assertEq(fUsd, floorUsd[i], "Flap's graduation floor for this pool share");
            assertGe(minSeed * price / 1e18, fUsd * 15_000 / 10_000, "the seed is worth 1.5x the floor");
            assertLt((minSeed - 1) * price / 1e18, fUsd * 15_000 / 10_000 + 1e18, "and no more than that");
            (uint256 demoMin,,,, bool demoGraduation, uint256 demoMargin) =
                demo.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
            assertFalse(demoGraduation, "the demo profile needs Flap's creation floor (half the graduation floor)");
            assertEq(demoMargin, 15_000, "with the same 1.5x margin");
            assertApproxEqAbs(demoMin * 2, minRaise, 100, "so half the production minimum (rounding aside)");

            t.minRaise = minRaise;
            t.cap = minRaise;
            prod.launcherFactory.checkTerms(t);
            t.minRaise = minRaise - 1;
            vm.expectRevert(
                abi.encodeWithSelector(
                    CovenantLauncherFactory.PoolSeedBelowFlapFloor.selector,
                    t.minRaise * t.poolBps / t.saleBps,
                    minSeed,
                    minRaise,
                    true
                )
            );
            prod.launcherFactory.checkTerms(t);
            emit log_named_uint("pool bps", pool[i]);
            emit log_named_decimal_uint("  minimum raise (BNB)", minRaise, 18);
        }
    }

    /// @dev The Portal reads its BNB price and our multiplier again at finalize. A raise exactly at the minimum still
    ///      clears the graduation floor after Flap's BNB price falls by a third during the sale (the same move as a
    ///      1.5x higher multiplier), and still launches (creation floor) after a 50% fall.
    function test_F1_theMarginAbsorbsAFloorMoveBetweenCreateAndFinalize() public {
        Terms memory t = _terms("f1-margin");
        (uint256 minRaise,,,,,) = prod.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
        t.minRaise = minRaise;
        t.cap = minRaise;
        CovenantLauncher l = _create(prod, t);
        _contribute(l, alice, minRaise);

        vm.prank(admin);
        portal.setQuotePriceUsd(467 ether); // $700 -> $467: a third lower
        _finalize(l);
        assertEq(uint8(l.state()), uint8(State.ACTIVE));
        (bool graduates,) = _floorAt(l, 467 ether);
        assertTrue(graduates, "still meets the graduation floor at finalize");

        // Without the margin (the old check) the same move would have left the token ungraduated.
        (uint256 seedNoMargin) = minRaise * 10_000 / 15_000 * t.poolBps / t.saleBps;
        assertLt(seedNoMargin * 467 ether / 1e18, 10_000 ether, "an unmargined minimum would miss it");
    }

    function _floorAt(CovenantLauncher l, uint256 price) internal view returns (bool meets, bool meetsCreate) {
        (bool ok, bytes memory ret) = address(portal)
            .staticcall(
                abi.encodeWithSignature(
                    "graduationFloorV2((address,uint256,uint256,uint256,uint256,address))",
                    address(0),
                    price,
                    l.poolQuote(),
                    l.poolAmount(),
                    l.terms().totalSupply,
                    l.vaultFactory()
                )
            );
        require(ok);
        (meets,,,, meetsCreate,) = abi.decode(ret, (bool, uint256, uint256, uint16, bool, uint256));
    }

    // ═════════════════════════════════════════════════════════════════════
    // F2: Flap's name screen at creation, failing closed
    // ═════════════════════════════════════════════════════════════════════

    /// @dev The bot's case: USDT / USDT raised 300 BNB and failed at finalize. Now refused before any money moves.
    function test_F2_usdtUsdt_isRefusedAtCreation() public {
        Terms memory t = _terms("f2-usdt");
        t.name = "USDT";
        t.symbol = "USDT";
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NameOrSymbolBlocked.selector, "USDT"));
        prod.launcherFactory.checkTerms(t);
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NameOrSymbolBlocked.selector, "USDT"));
        portal.newLauncher{value: fee}(address(prod.launcherFactory), abi.encode(t));
    }

    /// @dev A screen that does not answer refuses creation (it used to let the raise open).
    function test_F2_aScreenThatDoesNotAnswer_refusesCreation() public {
        Net memory n = chain;
        n.nameScreen = address(new DownScreen());
        Pair memory p = _deployPair(address(this), n, address(oracle), CovenantProfiles.production(), "down");
        vm.expectRevert(CovenantLauncherFactory.NameScreenUnavailable.selector);
        p.launcherFactory.checkTerms(_terms("f2-down"));
    }

    // ═════════════════════════════════════════════════════════════════════
    // F3: Flap's tax rules at creation
    // ═════════════════════════════════════════════════════════════════════

    /// @dev max(buy, sell) >= 100 bps (1%), each at most 1000: what the live Portal accepts (fork probe).
    function test_F3_taxRatesFlapRefuses_areRefusedAtCreation() public {
        uint16[2][6] memory bad =
            [[uint16(0), 0], [uint16(1), 0], [uint16(50), 0], [uint16(0), 99], [uint16(99), 99], [uint16(1_001), 100]];
        for (uint256 i; i < bad.length; ++i) {
            Terms memory t = _terms(bytes32(i));
            t.buyTaxBps = bad[i][0];
            t.sellTaxBps = bad[i][1];
            vm.expectRevert(CovenantTermsLib.BadTax.selector);
            prod.launcherFactory.checkTerms(t);
        }
        uint16[2][5] memory good =
            [[uint16(100), 0], [uint16(0), 100], [uint16(100), 1], [uint16(50), 100], [uint16(1_000), 1_000]];
        for (uint256 i; i < good.length; ++i) {
            Terms memory t = _terms(bytes32(100 + i));
            t.buyTaxBps = good[i][0];
            t.sellTaxBps = good[i][1];
            prod.launcherFactory.checkTerms(t);
        }
    }

    /// @dev taxDuration < antiFarmerDuration (1 day): refused. The profile's window is checked on its own too.
    function test_F3_taxDurationShorterThanTheAntiFarmerWindow_isRefused() public {
        Terms memory t = _terms("f3-dur");
        t.taxDuration = 1 days - 1;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, 1 days - 1));
        prod.launcherFactory.checkTerms(t);
        t.taxDuration = 12 hours;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, 12 hours));
        prod.launcherFactory.checkTerms(t);

        Profile memory p = CovenantProfiles.production();
        p.antiFarmerDuration = 60 days;
        Pair memory longWindow = _deployPair(address(this), chain, address(oracle), p, "long-anti-farmer");
        t = _terms("f3-dur-60");
        t.taxDuration = 45 days; // over our 30-day minimum, under this profile's anti-farmer window
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, 45 days));
        longWindow.launcherFactory.checkTerms(t);
        assertEq(prod.launcherFactory.profile().antiFarmerDuration, 1 days);
    }

    // ═════════════════════════════════════════════════════════════════════
    // F4: no dip can be hidden from the unlock counter
    // ═════════════════════════════════════════════════════════════════════

    /// @dev The bot's PoC: 6 h of strict progress at 2x, then the price below 2x for 6 h with a reportless poke.
    ///      The counter resets to 0 (it stayed at 6 h).
    function test_F4_aDipWithAReportlessPoke_resetsTheCounterToZero() public {
        (, CovenantVault v, IERC20 tok) = _live("f4");
        _poke(v, BNB_USD);
        _pump(v, tok, 205);
        _step(v, 6 hours, BNB_USD); // starts the window (the first one includes the pump delay)
        _step(v, 6 hours, BNB_USD);
        (uint256 p0,) = _progress(v, 0);
        assertEq(p0, 6 hours, "6 h of strict time at 2.05x");

        vm.warp(block.timestamp + 60);
        _dipUnder(v, tok, 200);
        vm.warp(block.timestamp + 6 hours);
        _bare(v);
        assertFalse(v.lastStrict());
        (uint256 p1,) = _progress(v, 0);
        assertEq(p1, 0, "the reportless poke valued the dip at the last rate and reset the counter");
    }

    /// @dev The other half of the rule: a reportless poke never adds, and at a price that holds the multiple it
    ///      leaves the counter alone (a free poke can no longer wipe the team's progress: F5).
    function test_F4_aReportlessPoke_neverAdds_andKeepsAHoldingCounter() public {
        (, CovenantVault v, IERC20 tok) = _live("f4-hold");
        _poke(v, BNB_USD);
        _pump(v, tok, 250);
        _step(v, 6 hours, BNB_USD);
        _step(v, 6 hours, BNB_USD);
        (uint256 p0,) = _progress(v, 0);
        vm.warp(block.timestamp + 1 hours);
        _bare(v);
        (uint256 p1,) = _progress(v, 0);
        assertEq(p1, p0, "unchanged at 2.5x: no reset, no time added");
        assertGt(p0, 0);
    }

    /// @dev Withholding reports through a dollar dip (BNB/USD falls, the pool holds 2.05x in BNB): once the last
    ///      verified rate is more than maxStep old, a reportless poke resets every counter, and a strict poke after a
    ///      longer gap resets too. Unlock time is continuous strict time.
    function test_F4_withholdingReportsThroughADollarDip_cannotKeepTheCount() public {
        (, CovenantVault v, IERC20 tok) = _live("f4-dollar");
        _poke(v, BNB_USD);
        _pump(v, tok, 205);
        _step(v, 6 hours, BNB_USD);
        _step(v, 6 hours, BNB_USD);
        (uint256 p0,) = _progress(v, 0);
        assertEq(p0, 6 hours);
        // Down day: nobody sends a report; someone pokes without one after 7 h.
        vm.warp(block.timestamp + 7 hours);
        _bare(v);
        (uint256 p1,) = _progress(v, 0);
        assertEq(p1, 0, "the last rate is over maxStep old: every counter resets");

        // The keeper is back: its first window (13 h since the last report) is not continuous, so the count
        // restarts with the next one.
        _step(v, 6 hours, BNB_USD);
        (uint256 p2,) = _progress(v, 0);
        assertEq(p2, 0, "a 13 h strict window restarts the count");
        _step(v, 6 hours, BNB_USD);
        _step(v, 6 hours, BNB_USD);
        (p2,) = _progress(v, 0);
        assertEq(p2, 12 hours);
        // And if nobody pokes at all for 18 h, the next strict poke resets as well.
        vm.warp(block.timestamp + 18 hours);
        _poke(v, BNB_USD);
        (uint256 p3,) = _progress(v, 0);
        assertEq(p3, 0, "an 18 h strict window is not continuous strict time");
    }

    /// @dev A dip in the second half of a strict window that a reportless poke split: the window since that poke is
    ///      checked on its own, so averaging over the whole window cannot hide it.
    function test_F4_aDipAfterAReportlessPoke_isNotAveragedAway() public {
        (, CovenantVault v, IERC20 tok) = _live("f4-split");
        _poke(v, BNB_USD);
        _pump(v, tok, 240);
        _step(v, 3 hours, BNB_USD);
        _step(v, 3 hours, BNB_USD);
        (uint256 p0,) = _progress(v, 0);
        assertGt(p0, 6 hours, "6 h and the pump delay of strict time at 2.4x");
        vm.warp(block.timestamp + 3 hours);
        _bare(v); // 3 h at 2.4x: holds, nothing changes
        vm.warp(block.timestamp + 60);
        _dipUnder(v, tok, 180);
        vm.warp(block.timestamp + 3 hours - 60);
        _poke(v, BNB_USD); // the 6 h window averages ~2.1x, the last 3 h are under 1.8x
        (uint256 p1,) = _progress(v, 0);
        assertEq(p1, 0, "the recent window missed 2x: reset");
    }

    // ═════════════════════════════════════════════════════════════════════
    // F5: nobody can block strict observations, and the dollar budget always binds
    // ═════════════════════════════════════════════════════════════════════

    /// @dev The bot's PoC: a reportless poke used up the 1 h gap and the keeper's strict poke reverted TooSoon.
    function test_F5_aReportlessPoke_cannotBlockTheKeepersReport() public {
        (, CovenantVault v,) = _live("f5-block");
        _poke(v, BNB_USD);
        vm.warp(block.timestamp + 1 hours);
        _bare(v);
        assertFalse(v.lastStrict());
        _poke(v, BNB_USD); // same block: no TooSoon
        assertTrue(v.lastStrict(), "the report landed");
        assertEq(oracle.nextRatePokeAt(address(v)), block.timestamp + 1 hours);
        // Report-carrying pokes keep their own gap.
        vm.warp(block.timestamp + 59 minutes);
        vm.expectRevert(abi.encodeWithSelector(CovenantOracle.TooSoon.selector, block.timestamp + 1 minutes));
        _poke(v, BNB_USD);
    }

    /// @dev Repeated: a griefer pokes without a report first every hour for the whole cliff. The keeper's reports
    ///      still land, and the 2x tranche unlocks at the cliff (the price holds 2.5x throughout).
    function test_F5_aGrieferFirstEveryHour_cannotFreezeUnlocks() public {
        (, CovenantVault v, IERC20 tok) = _live("f5-freeze");
        _poke(v, BNB_USD);
        _pump(v, tok, 250);
        uint256 cliffAt = uint256(v.launchedAt()) + 180 days;
        vm.warp(block.timestamp + 1 hours);
        while (block.timestamp <= cliffAt + 1 hours) {
            _bare(v);
            _poke(v, BNB_USD);
            vm.warp(block.timestamp + 1 hours);
        }
        (, bool unlocked) = _progress(v, 0);
        assertTrue(unlocked, "unlocked on schedule despite the griefer");
        assertEq(v.unlockedUnreleased(), 50_000_000 ether);
    }

    /// @dev The bot's tap PoC: $1k / month budget, 20 days with no strict observation landing. The tap keeps the
    ///      dollar budget at the last known rate ($600): about 1.11 BNB, never the 4% cap alone (3.11+ BNB), and it
    ///      keeps running past `staleAfter` instead of stopping.
    function test_F5_noStrictObservationFor20Days_tapStaysWithinTheBudgetAtTheLastRate() public {
        (, CovenantVault v,) = _live("f5-tap");
        _poke(v, BNB_USD);
        vm.prank(team);
        v.lowerTap(1_000 ether);
        uint256 o0 = v.owedTeam();
        uint256 end = block.timestamp + 20 days;
        while (block.timestamp < end) {
            vm.warp(block.timestamp + 1 hours);
            _bare(v);
        }
        uint256 accrued = v.owedTeam() - o0;
        uint256 budget = uint256(1_000 ether) * 20 days / 30 days * 1e18 / BNB_USD;
        uint256 capAlone = address(v).balance * 400 / 10_000 * 20 days / 30 days;
        emit log_named_decimal_uint("tap accrued in 20 days without a report (BNB)", accrued, 18);
        emit log_named_decimal_uint("budget at the last known $600 (BNB)", budget, 18);
        emit log_named_decimal_uint("4% cap alone over 20 days (BNB)", capAlone, 18);
        assertLe(accrued, budget, "never above the dollar budget at the last known rate");
        assertApproxEqRel(accrued, budget, 1e15, "the budget keeps paying (no pause after staleAfter)");
        assertLt(accrued, capAlone / 2);
    }

    // ═════════════════════════════════════════════════════════════════════
    // F6: Flap's addresses are Flap's on Flap's chains
    // ═════════════════════════════════════════════════════════════════════

    function test_F6_onBnbChainAndTestnet_theFactoriesRefuseNonFlapAddresses() public {
        uint256[2] memory ids = [uint256(56), 97];
        for (uint256 i; i < 2; ++i) {
            vm.chainId(ids[i]);
            address hub = LaunchVaultAddresses.hub();
            address guard = LaunchVaultAddresses.guardian();
            address dock = LaunchVaultAddresses.tokenDockRouter();
            address screen = FlapChain.nameScreen();
            vm.etch(screen, hex"00");

            VaultEnv memory env = VaultEnv(hub, guard, dock, address(oracle), address(0), address(0));
            vm.expectRevert(abi.encodeWithSelector(CovenantVaultFactory.NotFlapAddress.selector, chain.portal, hub));
            new CovenantVaultFactory(
                address(1), VaultEnv(chain.portal, guard, dock, address(oracle), address(0), address(0))
            );
            vm.expectRevert(abi.encodeWithSelector(CovenantVaultFactory.NotFlapAddress.selector, guardian, guard));
            new CovenantVaultFactory(address(1), VaultEnv(hub, guardian, dock, address(oracle), address(0), address(0)));
            vm.expectRevert(
                abi.encodeWithSelector(CovenantVaultFactory.NotFlapAddress.selector, chain.dockRouter, dock)
            );
            new CovenantVaultFactory(
                address(1), VaultEnv(hub, guard, chain.dockRouter, address(oracle), address(0), address(0))
            );

            // The Flap-address checks run before the pairing check, so any vault factory address shows them.
            Profile memory p = CovenantProfiles.production();
            address anyVf = address(prod.vaultFactory);
            vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, guardian, guard));
            new CovenantLauncherFactory(hub, guardian, anyVf, address(0), screen, p, "x");
            vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, chain.portal, hub));
            new CovenantLauncherFactory(chain.portal, guard, anyVf, address(0), screen, p, "x");
            vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, address(0), screen));
            new CovenantLauncherFactory(hub, guard, anyVf, address(0), address(0), p, "x");
            vm.expectRevert(
                abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, chain.nameScreen, screen)
            );
            new CovenantLauncherFactory(hub, guard, anyVf, address(0), chain.nameScreen, p, "x");

            address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
            CovenantVaultFactory vf = new CovenantVaultFactory(predicted, env);
            CovenantLauncherFactory lf =
                new CovenantLauncherFactory(hub, guard, address(vf), address(0), screen, p, "x");
            assertEq(address(lf), predicted, "Flap's own addresses deploy");
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // F7: finalize gas
    // ═════════════════════════════════════════════════════════════════════

    /// @dev F7, with Flap's 15M gas cap (vault SDK, flap.sh): the floor is 12M, every client sends exactly 15M, a 15M
    ///      transaction finalizes, and a starved call reverts instead of failing the raise.
    function test_F7_aFifteenMillionGasTransactionFinalizes_aStarvedOneReverts() public {
        CovenantLauncher l = _create(prod, _terms("f7"));
        _raiseOversubscribed(l);
        vm.warp(uint256(l.saleDeadline()));
        assertEq(l.LAUNCH_GAS_FLOOR(), 12_000_000);
        assertEq(l.FINALIZE_GAS_LIMIT(), 15_000_000);
        assertTrue(_contains(l.description(), '"finalizeGasLimit":"15000000"'), "in the launcher's description");
        vm.expectRevert(CovenantLauncher.InsufficientGas.selector);
        l.finalize{gas: 11_900_000}();
        assertEq(uint8(l.state()), uint8(State.RAISING), "the starved call changed nothing");
        l.finalize{gas: 15_000_000 - 21_064}(); // a 15M transaction, less its intrinsic gas
        assertEq(uint8(l.state()), uint8(State.ACTIVE));
    }

    // ═════════════════════════════════════════════════════════════════════
    // F8: what the treasury lives on after the tax period
    // ═════════════════════════════════════════════════════════════════════

    function test_F8_descriptionStatesTheTreasuryAfterTheTaxPeriod() public {
        (CovenantLauncher l, CovenantVault v,) = _live("f8");
        string memory d = v.description();
        emit log_string(d);
        uint256 end = uint256(v.launchedAt()) + l.terms().taxDuration;
        assertTrue(
            _contains(
                d,
                string.concat(
                    "Trading tax (buy 1%, sell 1%) is the treasury's income until ",
                    CovenantVaultDisplay.date(end),
                    " UTC; after that the tap is paid only from the treasury, so book value only falls unless the team deposits revenue (depositRevenue; anyone can deposit, and exit fees the treasury keeps add to it too)."
                )
            )
        );
        vm.warp(end);
        d = v.description();
        assertTrue(
            _contains(
                d,
                string.concat(
                    "Trading tax ended on ",
                    CovenantVaultDisplay.date(end),
                    " UTC: the tap is paid only from the treasury, so book value only falls unless the team deposits revenue (depositRevenue; anyone can deposit, and exit fees the treasury keeps add to it too)."
                )
            )
        );
    }

    function test_F8_dateFormatter() public pure {
        assertEq(CovenantVaultDisplay.date(0), "1970-01-01");
        assertEq(CovenantVaultDisplay.date(951_782_400), "2000-02-29");
        assertEq(CovenantVaultDisplay.date(1_800_000_000), "2027-01-15");
        assertEq(CovenantVaultDisplay.date(4_102_444_800), "2100-01-01");
        assertEq(CovenantVaultDisplay.date(4_953_600_000), "2126-12-22");
    }

    // ═════════════════════════════════════════════════════════════════════
    // Found while re-checking: the Flap UI schema named a view the vault no longer has
    // ═════════════════════════════════════════════════════════════════════

    function test_vaultUISchema_everyViewItNamesExists() public {
        (, CovenantVault v,) = _live("schema");
        VaultUISchema memory s = v.vaultUISchema();
        for (uint256 i; i < s.methods.length; ++i) {
            if (s.methods[i].isWriteMethod) continue;
            (bool ok,) = address(v).staticcall(abi.encodeWithSignature(string.concat(s.methods[i].name, "()")));
            assertTrue(ok, s.methods[i].name);
        }
        assertEq(s.methods[3].name, "owedTeam");
    }

    // ═════════════════════════════════════════════════════════════════════
    // NEW-1 (independent re-review of these fixes): a same-block sale cannot fake a shallow pool
    // ═════════════════════════════════════════════════════════════════════

    /// @dev Sell `whale`'s tokens in one block until the pool's spot BNB reserve is under half its seed.
    function _drainSpotUnderHalf(CovenantVault v, IERC20 tok) internal returns (uint256 bnbOut) {
        uint256 b0 = whale.balance;
        uint256 chunk = tok.balanceOf(whale) / 40;
        for (uint256 i; i < 40; ++i) {
            (,,,, uint256 q) = oracle.preview(address(v));
            if (q * 2 < v.poolSeedQuote()) break;
            _sell(tok, whale, chunk);
        }
        (,,,, uint256 qNow) = oracle.preview(address(v));
        require(qNow * 2 < v.poolSeedQuote(), "spot reserve still over half the seed");
        bnbOut = whale.balance - b0;
    }

    function _hourlyProgress(CovenantVault v, IERC20 tok, uint256 hoursOf) internal {
        _poke(v, BNB_USD);
        _pump(v, tok, 250);
        _step(v, 1 hours, BNB_USD);
        for (uint256 i; i < hoursOf; ++i) {
            _step(v, 1 hours, BNB_USD);
        }
    }

    /// @dev The reviewer's PoC: sell until the spot reserve is under half the seed, poke without a report, buy back,
    ///      all in one block. It wiped every counter; now the poke sees the pool at its TWAP (still 2.5x, deep) and
    ///      changes nothing.
    function test_NEW1_aSameBlockSale_cannotWipeTheCounters_withAReportlessPoke() public {
        (, CovenantVault v, IERC20 tok) = _live("new1-bare");
        _hourlyProgress(v, tok, 48);
        (uint256 p0,) = _progress(v, 0);
        assertGt(p0, 48 hours);
        vm.warp(block.timestamp + 1 hours);
        uint256 bnbOut = _drainSpotUnderHalf(v, tok);
        _bare(v);
        _buy(tok, whale, bnbOut);
        assertTrue(v.lastDeep(), "deep at the TWAP on the pool's invariant");
        (uint256 p1,) = _progress(v, 0);
        assertEq(p1, p0, "nothing wiped, nothing added");
    }

    /// @dev The same sandwich around the keeper's report: the report stays strict and its hour counts.
    function test_NEW1_aSandwichedKeeperReport_staysStrict_andCounts() public {
        (, CovenantVault v, IERC20 tok) = _live("new1-keeper");
        _hourlyProgress(v, tok, 24);
        (uint256 p0,) = _progress(v, 0);
        vm.warp(block.timestamp + 1 hours);
        uint256 bnbOut = _drainSpotUnderHalf(v, tok);
        _poke(v, BNB_USD);
        _buy(tok, whale, bnbOut);
        assertTrue(v.lastStrict(), "still strict");
        (uint256 p1,) = _progress(v, 0);
        assertEq(p1, p0 + 1 hours, "the hour counts");
    }

    /// @dev A real crash still reads shallow once the window has seen it: after a sale that lasts, the TWAP falls with
    ///      the reserve (here over 6 hours, against 10 minutes at the old price).
    function test_NEW1_aSustainedCrash_stillReadsShallow() public {
        (, CovenantVault v, IERC20 tok) = _live("new1-crash");
        _poke(v, BNB_USD);
        vm.warp(block.timestamp + 601);
        _sell(tok, whale, tok.balanceOf(whale));
        vm.warp(block.timestamp + 6 hours);
        _poke(v, BNB_USD);
        assertFalse(v.lastDeep(), "a pool that stayed drained for the window is shallow");
        assertFalse(v.lastStrict());
    }

    /// @dev Flap's UI: flat minRaise() and cap(), and expectedToken() equal to the token the Portal deploys.
    function test_launcherViews_forFlapsUI_expectedTokenIsTheLaunchedToken() public {
        Terms memory t = _terms("ui-views");
        CovenantLauncher l = _create(prod, t);
        assertEq(l.minRaise(), t.minRaise);
        assertEq(l.cap(), t.cap);
        address expected = l.expectedToken();
        assertEq(expected, portal.predictToken(t.salt));
        assertEq(uint16(uint160(expected)), 0x7777);
        _raiseOversubscribed(l);
        _finalize(l);
        assertEq(l.token(), expected, "the launched token");
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool m = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    m = false;
                    break;
                }
            }
            if (m) return true;
        }
        return false;
    }
}
