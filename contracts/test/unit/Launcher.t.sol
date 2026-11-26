// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {Terms, State, Profile} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {LauncherFactoryBase} from "src/flap/LauncherFactoryBase.sol";
import {MockPortal} from "src/mocks/MockFlap.sol";

contract LauncherTest is CovenantTestBase {
    // ── the raise ──────────────────────────────────────────────────────────

    /// @dev Design doc worked example: 1,400 committed, 500 accepted, 125 seeds the pool, 375 to the treasury.
    function test_oversubscribed_settlesProRataAndLaunches() public {
        (CovenantLauncher l, CovenantVault v, IERC20 token) = _launchDefault("pro-rata");

        assertEq(l.committed(), 1_400 ether);
        assertEq(l.accepted(), 500 ether, "Q = cap");
        assertEq(l.poolQuote(), 125 ether, "Q_pool = Q * P / A");
        assertEq(l.treasuryForwarded(), 375 ether - 4, "T0 = Q - Q_pool less one wei per contributor");
        assertEq(address(v).balance, 375 ether - 4);
        assertEq(v.treasuryRaised(), 375 ether - 4);

        // A buyer who committed 14 BNB ends with 6,000,000 tokens for 5 BNB and a 9 BNB refund.
        assertEq(l.acceptedOf(alice), 5 ether);
        assertEq(l.allocationOf(alice), 6_000_000 ether);
        assertEq(l.refundOf(alice), 9 ether);

        // The pool opens at the sale price; book value starts at 60% of it.
        assertApproxEqAbs(_spot(v), v.salePriceBnb(), 1);
        assertApproxEqRel(v.bookValue(), v.salePriceBnb() * 60 / 100, 1e9);

        // Sale and team tokens sit in the Token Dock under the vault.
        assertEq(token.balanceOf(chain.dockRouter), 850_000_000 ether);
        assertEq(v.lockedTeam(), 250_000_000 ether);
    }

    function test_refunds_payTheUnacceptedPartOnce() public {
        (CovenantLauncher l,,) = _launchDefault("refund-once");
        uint256 before = alice.balance;
        vm.startPrank(alice);
        l.claimRefund();
        assertEq(alice.balance - before, 9 ether);
        vm.expectRevert(CovenantLauncher.NothingToRefund.selector);
        l.claimRefund();
        vm.stopPrank();
    }

    function test_everyRefundIsCovered_evenWithRoundingDust() public {
        (CovenantLauncher l,,) = _launchDefault("refund-dust");
        address[4] memory who = [alice, bob, carol, whale];
        uint256 total;
        for (uint256 i; i < 4; ++i) {
            uint256 r = l.refundOf(who[i]);
            total += r;
            vm.prank(who[i]);
            l.claimRefund();
            assertEq(l.acceptedOf(who[i]) + r, l.contributions(who[i]), "accepted + refund == commitment");
        }
        // Each floor in q_i can add < 1 wei to a refund; the one-wei-per-contributor buffer covers it.
        assertApproxEqAbs(total, 900 ether, 4, "900 BNB refunded");
        assertLe(address(l).balance, 4, "only dust is left");
    }

    function test_belowMinimum_failsAndRefundsInFull() public {
        CovenantLauncher l = _create(prod, _terms("below-min"));
        _contribute(l, alice, 50 ether);
        _contribute(l, bob, 100 ether);
        _finalize(l);
        assertEq(uint8(l.state()), uint8(State.FAILED));
        assertEq(l.vault(), address(0));
        uint256 before = bob.balance;
        vm.prank(bob);
        l.claimRefund();
        assertEq(bob.balance - before, 100 ether);
    }

    function test_atCap_noRefund_andNoBuffer() public {
        CovenantLauncher l = _create(prod, _terms("at-cap"));
        _contribute(l, alice, 200 ether);
        _contribute(l, bob, 300 ether);
        _finalize(l);
        assertEq(l.accepted(), 500 ether);
        assertEq(l.treasuryForwarded(), 375 ether, "no dust buffer when not oversubscribed");
        assertEq(l.refundOf(alice), 0);
        vm.prank(alice);
        vm.expectRevert(CovenantLauncher.NothingToRefund.selector);
        l.claimRefund();
    }

    function test_saleWindow_andFinalizeGuards() public {
        CovenantLauncher l = _create(prod, _terms("window"));
        vm.prank(alice);
        vm.expectRevert(CovenantLauncher.ZeroContribution.selector);
        l.contribute{value: 0}();

        vm.expectRevert(CovenantLauncher.SaleOpen.selector);
        l.finalize();

        vm.prank(alice);
        vm.expectRevert(CovenantLauncher.RefundUnavailable.selector);
        l.claimRefund();

        vm.warp(l.saleDeadline());
        vm.prank(alice);
        vm.expectRevert(CovenantLauncher.SaleClosed.selector);
        l.contribute{value: 1 ether}();

        l.finalize();
        vm.expectRevert(CovenantLauncher.NotRaising.selector);
        l.finalize();
    }

    /// @dev If Flap's launch call reverts for any reason, the launcher catches it, moves to FAILED and every
    ///      commitment refunds in full. Here Flap disables the factory mid-sale.
    function test_revertedLaunch_endsFailed_andRefundsInFull() public {
        CovenantLauncher l = _create(prod, _terms("launch-revert"));
        _raiseOversubscribed(l);
        vm.prank(admin);
        portal.setLauncherFactoryMultiplier(address(prod.launcherFactory), 10_000, false);
        vm.recordLogs();
        _finalize(l);
        assertEq(uint8(l.state()), uint8(State.FAILED), "a refused launch fails the raise");
        assertEq(l.accepted(), 0);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawFailure;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == CovenantLauncher.LaunchFailed.selector) sawFailure = true;
        }
        assertTrue(sawFailure, "LaunchFailed emitted");
        assertEq(address(l).balance, 1_400 ether, "nothing left the launcher");
        uint256 before = whale.balance;
        vm.prank(whale);
        l.claimRefund();
        assertEq(whale.balance - before, 600 ether, "full refund");
    }

    function test_launchBelowFlapFloor_failsSafely() public {
        CovenantLauncher l = _create(prod, _terms("floor"));
        _raiseOversubscribed(l);
        vm.prank(admin);
        portal.setMinPoolQuote(200 ether); // above the 125 BNB this raise seeds
        _finalize(l);
        assertEq(uint8(l.state()), uint8(State.FAILED));
    }

    /// @dev An attacker must not be able to fail a healthy raise by calling finalize with just enough gas for the
    ///      catch block. Out-of-gas inside the launch reverts the whole call instead.
    function test_finalize_withTooLittleGas_revertsInsteadOfFailing() public {
        CovenantLauncher l = _create(prod, _terms("gas-grief"));
        _raiseOversubscribed(l);
        vm.warp(l.saleDeadline());
        uint256 floor = l.LAUNCH_GAS_FLOOR();
        // From far too little up to just past the floor: a call either launches or reverts, it never fails the
        // raise.
        for (uint256 g = 300_000; g < floor + 2_000_000; g += 400_000) {
            (bool ok,) = address(l).call{gas: g}(abi.encodeCall(CovenantLauncher.finalize, ()));
            if (ok) {
                assertEq(uint8(l.state()), uint8(State.ACTIVE), "a call with enough gas launches");
                return;
            }
            assertEq(uint8(l.state()), uint8(State.RAISING), "a starved finalize never marks the raise FAILED");
        }
        revert("never launched");
    }

    /// @dev The other direction: a real refusal with plenty of gas still ends in FAILED.
    function test_finalize_refusalAtTheGasFloor_stillFails() public {
        CovenantLauncher l = _create(prod, _terms("gas-refusal"));
        _raiseOversubscribed(l);
        vm.prank(admin);
        portal.setMinPoolQuote(1_000 ether);
        vm.warp(l.saleDeadline());
        l.finalize{gas: l.LAUNCH_GAS_FLOOR() + 1_000_000}();
        assertEq(uint8(l.state()), uint8(State.FAILED));
    }

    function test_launchAndFund_onlySelf() public {
        CovenantLauncher l = _create(prod, _terms("self"));
        vm.expectRevert(CovenantLauncher.NotSelf.selector);
        l.launchAndFund(0);
    }

    function test_launch_declaresTheTeamAsCreator() public {
        CovenantLauncher l = _create(prod, _terms("creator"));
        _raiseOversubscribed(l);
        vm.warp(l.saleDeadline());
        vm.recordLogs();
        l.finalize();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 topic = keccak256("FlapDirectLaunched(address,uint8,address,bytes32,bytes)");
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(portal) || logs[i].topics[0] != topic) continue;
            (, , address creator_,,) = abi.decode(logs[i].data, (address, uint8, address, bytes32, bytes));
            assertEq(creator_, team, "the launch event shows the team, not the launcher");
            found = true;
        }
        assertTrue(found);
    }

    function test_launcherLocksItsOwnSalt() public {
        Terms memory t = _terms("salt-lock");
        CovenantLauncher l = _create(prod, t);
        assertEq(portal.saltLocker(t.salt), address(l), "the Launcher is the locker, as Flap requires");
    }

    function test_previewCommit() public {
        CovenantLauncher l = _create(prod, _terms("preview"));
        _contribute(l, bob, 1_386 ether);
        (uint256 keep, uint256 tokens, uint256 refund) = l.previewCommit(alice, 14 ether);
        assertEq(keep, 5 ether);
        assertEq(tokens, 6_000_000 ether);
        assertEq(refund, 9 ether);
    }

    // ── description ────────────────────────────────────────────────────────

    function test_description_isFlapV1JsonWithCovenantKeys_under4KB() public {
        Terms memory t = _terms("desc");
        t.name = "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN"; // 64 bytes, the cap
        t.symbol = "SSSSSSSSSSSSSSSS"; // 16 bytes
        CovenantLauncher l = _create(prod, t);
        string memory d = l.description();
        assertLt(bytes(d).length, 4096, "the Portal stores an empty string past 4 KB");
        assertTrue(_contains(d, '{"v":1,"name":"'));
        assertTrue(_contains(d, '"quoteToken":"0x0000000000000000000000000000000000000000"'));
        assertTrue(_contains(d, '"poolTokenRatio":"150000000000000000"'));
        assertTrue(_contains(d, '"covenant":"1"'));
        assertTrue(_contains(d, '"tapCapBps":"400"'));
        assertEq(bytes(d)[bytes(d).length - 1], bytes1("}"));
    }

    // ── factory checks ─────────────────────────────────────────────────────

    function test_newLauncher_isPortalOnly() public {
        bytes memory data = abi.encode(_terms("hub-only"));
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LauncherFactoryBase.NotHub.selector, stranger));
        prod.launcherFactory.newLauncher(team, data);
    }

    function test_newLauncher_rejectsTrailingBytes() public {
        bytes memory data = abi.encodePacked(abi.encode(_terms("trailing")), uint256(1));
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        vm.expectRevert(CovenantLauncherFactory.InvalidData.selector);
        portal.newLauncher{value: fee}(address(prod.launcherFactory), data);
    }

    function test_newLauncher_requiresExactSaltFee() public {
        bytes memory data = abi.encode(_terms("fee"));
        vm.prank(team);
        vm.expectRevert(CovenantLauncher.InvalidConfig.selector);
        portal.newLauncher{value: 1 ether}(address(prod.launcherFactory), data);
    }

    function test_factoryPairing_isCheckedAtConstruction() public {
        Profile memory p = prod.launcherFactory.profile();
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NotPaired.selector, address(prod.vaultFactory)));
        new CovenantLauncherFactory(chain.portal, guardian, address(prod.vaultFactory), chain.identity, p, "x");
    }

    function test_terms_boundsFromTheDesignDoc() public {
        Terms memory t;
        CovenantLauncherFactory f = prod.launcherFactory;

        t = _terms("b1");
        t.saleBps = 3_900;
        t.poolBps = 1_500;
        t.trancheBps[2] = 1_100; // keep the sum valid so the split check is what fails
        vm.expectRevert();
        f.checkTerms(t);

        t = _terms("b2");
        t.poolBps = 400; // < 5%
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadSplit.selector, 6_000, 400, 3_600));
        f.checkTerms(t);

        t = _terms("b3");
        t.trancheBps[0] = 400; // tranches no longer sum to the team share
        vm.expectRevert(CovenantTermsLib.BadTranches.selector);
        f.checkTerms(t);

        t = _terms("b4");
        t.trancheMultiple[0] = 100; // not above the sale price
        vm.expectRevert(CovenantTermsLib.BadTranches.selector);
        f.checkTerms(t);

        t = _terms("b5");
        t.tapCapBps = 1_001;
        vm.expectRevert(CovenantTermsLib.BadTap.selector);
        f.checkTerms(t);

        t = _terms("b6");
        t.exitStreak = 15 days;
        vm.expectRevert(CovenantTermsLib.BadExit.selector);
        f.checkTerms(t);

        t = _terms("b7");
        t.roundLength = 2 days;
        vm.expectRevert(CovenantTermsLib.BadExit.selector);
        f.checkTerms(t);

        t = _terms("b8");
        t.exitFeeBps = 301;
        vm.expectRevert(CovenantTermsLib.BadExit.selector);
        f.checkTerms(t);

        t = _terms("b9");
        t.heartbeat = 13 days;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadHeartbeat.selector, 13 days));
        f.checkTerms(t);

        t = _terms("b10");
        t.minRaise = 30 ether; // seeds 7.5 BNB, under the 10 BNB floor guard
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.PoolSeedBelowFloor.selector, 7.5 ether, 10 ether));
        f.checkTerms(t);

        t = _terms("b11");
        t.totalSupply = 1_000_000_001 ether + 1;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadSupply.selector, t.totalSupply));
        f.checkTerms(t);

        t = _terms("b12");
        t.teamWallet = address(0);
        vm.expectRevert(CovenantTermsLib.BadTeamWallet.selector);
        f.checkTerms(t);

        t = _terms("b13");
        t.cap = t.minRaise - 1;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadRaise.selector, t.minRaise, t.cap));
        f.checkTerms(t);

        t = _terms("b14");
        t.saleDuration = 1 hours;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadSaleDuration.selector, 1 hours));
        f.checkTerms(t);

        t = _terms("ok");
        f.checkTerms(t); // the defaults pass
    }

    // ── agent layer: ERC-8004 identity ─────────────────────────────────────

    function test_agentCovenant_requiresTheTeamWalletToOwnTheAgent() public {
        vm.prank(team);
        uint256 id = identity.register("ipfs://agent.json");

        Terms memory t = _terms("agent-ok");
        t.agentId = id;
        CovenantLauncher l = _create(prod, t);
        assertEq(l.terms().agentId, id);

        t = _terms("agent-other");
        vm.prank(stranger);
        uint256 otherId = identity.register("ipfs://other.json");
        t.agentId = otherId;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        vm.expectRevert(
            abi.encodeWithSelector(CovenantLauncherFactory.AgentNotOwnedByTeam.selector, otherId, stranger, team)
        );
        portal.newLauncher{value: fee}(address(prod.launcherFactory), abi.encode(t));

        t = _terms("agent-missing");
        t.agentId = 999;
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.AgentNotFound.selector, 999));
        portal.newLauncher{value: fee}(address(prod.launcherFactory), abi.encode(t));
    }

    function test_humanTeam_hasAgentIdZero_andNeedsNoRegistry() public {
        Pair memory noRegistry = _deployPairWithoutRegistry();
        Terms memory t = _terms("human");
        CovenantLauncher l = _create(noRegistry, t);
        assertEq(l.terms().agentId, 0);

        t = _terms("agent-no-registry");
        t.agentId = 1;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        vm.expectRevert(CovenantLauncherFactory.AgentRegistryMissing.selector);
        portal.newLauncher{value: fee}(address(noRegistry.launcherFactory), abi.encode(t));
    }

    // ── fuzz: raise math ───────────────────────────────────────────────────

    /// @dev Invariant 3: accepted amounts sum to at most Q, accepted + refund == commitment for every buyer, and
    ///      the launcher can always pay every refund.
    function testFuzz_raiseMath(uint96[6] memory raw) public {
        CovenantLauncher l = _create(prod, _terms("fuzz-raise"));
        address[6] memory who;
        uint256 total;
        for (uint256 i; i < 6; ++i) {
            who[i] = address(uint160(0xF00D0000 + i));
            uint256 amt = bound(uint256(raw[i]), 1, 400 ether);
            vm.deal(who[i], amt);
            _contribute(l, who[i], amt);
            total += amt;
        }
        _finalize(l);
        if (total < 200 ether) {
            assertEq(uint8(l.state()), uint8(State.FAILED));
            return;
        }
        assertEq(uint8(l.state()), uint8(State.ACTIVE));
        uint256 q = l.accepted();
        uint256 sumAccepted;
        uint256 sumTokens;
        for (uint256 i; i < 6; ++i) {
            uint256 a = l.acceptedOf(who[i]);
            uint256 r = l.refundOf(who[i]);
            assertEq(a + r, l.contributions(who[i]));
            sumAccepted += a;
            sumTokens += l.allocationOf(who[i]);
            if (r > 0) {
                vm.prank(who[i]);
                l.claimRefund();
            }
        }
        assertLe(sumAccepted, q, "sum accepted <= Q");
        assertLe(sumTokens, l.saleAmount(), "sum allocations <= A");
        assertLe(address(l).balance, 6, "only the dust buffer is left");
    }

    // ── helpers ────────────────────────────────────────────────────────────

    function _deployPairWithoutRegistry() internal returns (Pair memory p) {
        Net memory c = chain;
        c.identity = address(0);
        c.reputation = address(0);
        p = _deployPair(address(this), c, address(oracle), prod.launcherFactory.profile(), "no-registry");
        vm.prank(admin);
        portal.setLauncherFactoryMultiplier(address(p.launcherFactory), 10_000, true);
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
