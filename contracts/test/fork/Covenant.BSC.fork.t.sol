// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {Terms, State} from "src/vault/CovenantTypes.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantVaultFactory} from "src/vault/CovenantVaultFactory.sol";
import {CovenantOracle, IAggregatorV3} from "src/oracle/CovenantOracle.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";
import {CovenantLiteVault} from "src/openfour/CovenantLiteVault.sol";
import {ForwardVault} from "src/vendor/openfour/taxvault/vaults/ForwardVault.sol";
import {IPortal, IPortalTypes} from "src/flap/IPortal.sol";
import {ITokenDock} from "src/flap/ILaunchVaultSpec.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {IERC8004Identity, IERC8004Reputation} from "src/agent/IERC8004.sol";

interface IProxyAdminLike {
    function owner() external view returns (address);
}

interface IRouterLike {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, address[] calldata, address, uint256)
        external
        payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256)
        external;
}

interface ITaxTokenLike {
    function taxProcessor() external view returns (address);
    function taxExpirationTime() external view returns (uint256);
}

interface IV2RouterFactoryLike {
    function factory() external view returns (address);
}

interface IV2FactoryLike {
    function createPair(address a, address b) external returns (address);
}

interface IWBNBLike {
    function deposit() external payable;
    function transfer(address, uint256) external returns (bool);
}

interface INameScreenLike {
    function isScamWord(string calldata name, string calldata symbol) external view returns (bool, bool);
}

interface ITaxProcessorLike {
    function dispatch() external;
    function feeQuoteBalance() external view returns (uint256);
    function marketQuoteBalance() external view returns (uint256);
    function pendingDividendQuoteTokenBalance() external view returns (uint256);
    function lpQuoteBalance() external view returns (uint256);
}

interface IForwardVaultLike {
    function initialize(address, address, address, address[] calldata, bytes calldata) external;
    function clonedVault() external view returns (address);
}

/// @notice The covenant journey on a fork against Flap's live Pool Launch Portal, PancakeSwap V2, the Token Dock
///         router, the tax processor and the ERC-8004 registries. Nothing of theirs is mocked. Flap opens our factory
///         the way its own fork tests do, as the Portal admin. Atlas reports are signed by a dev key the oracle is
///         deployed with (production uses Atlas's signer). One thin subclass per chain, as in Flap's example repo;
///         each is skipped when its RPC variable is unset.
abstract contract CovenantForkBase is Test, StackBuilder {
    struct ForkEnv {
        string rpcEnv;
        uint256 chainId;
        address guardian;
        address wbnb;
        address router;
        address identity;
        address reputation;
        address forwardVaultImpl; // 0 when unknown on this chain
        address atlasPushBnbUsd; // Atlas BNB/USD push feed, 0 where none exists (BNB Chain mainnet has none yet)
        address nameScreen; // Flap's name and symbol blocklist, the one the Portal's launch facet calls
    }

    function _env() internal pure virtual returns (ForkEnv memory);

    ForkEnv internal E;

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
    bytes4 internal constant CREATION_PAUSED = bytes4(keccak256("CreationPaused()"));

    // Plain accounts with no code on BNB Chain (Flap's fork notes: makeAddr can collide with live accounts).
    address internal team = address(uint160(0xC0DE1001));
    address internal alice = address(uint160(0xC0DE1002));
    address internal bob = address(uint160(0xC0DE1003));
    address internal carol = address(uint160(0xC0DE1004));
    address internal whale = address(uint160(0xC0DE1005));
    address internal keeper = address(uint160(0xC0DE1006));
    address internal trader = address(uint160(0xC0DE1007));

    uint256 internal atlasKey = 0xA71A5;
    uint256 internal constant BNB_USD = 600 ether;

    IPortal internal portal;
    address internal admin;
    Net internal net;
    CovenantOracle internal oracle;
    Pair internal pairF;
    CovenantLens internal lens;

    function setUp() public {
        E = _env();
        string memory rpc = vm.envOr(E.rpcEnv, string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        require(block.chainid == E.chainId, "the RPC is not the chain this test expects");
        admin = IProxyAdminLike(BSC_PORTAL_PROXY_ADMIN).owner();
        net = _bscChain(admin);
        net.guardian = E.guardian;
        net.wbnb = E.wbnb;
        net.router = E.router;
        net.identity = E.identity;
        net.reputation = E.reputation;
        net.nameScreen = E.nameScreen;
        portal = IPortal(BSC_PORTAL);
        oracle = _deployOracle(vm.addr(atlasKey));
        pairF = _deployPair(address(this), net, address(oracle), CovenantProfiles.production(), "production");
        lens = _deployLens();

        // Start every chain from the same gate, as Flap's ForkBase does: creation paused (BNB Chain is paused
        // already, the testnet is open). An enabled launcher factory is what lets a launch through.
        vm.prank(admin);
        portal.setCreationPaused(true);

        address[7] memory who = [team, alice, bob, carol, whale, keeper, trader];
        for (uint256 i; i < who.length; ++i) {
            require(who[i].code.length == 0, "test account has code");
            vm.deal(who[i], 2_000 ether);
        }
    }

    function _open() internal {
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(pairF.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(pairF.vaultFactory), 10_000, true);
        vm.stopPrank();
    }

    function _create(Terms memory t) internal returns (CovenantLauncher l) {
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.startPrank(team);
        l = CovenantLauncher(payable(portal.newLauncher{value: fee}(address(pairF.launcherFactory), abi.encode(t))));
        vm.stopPrank();
    }

    function _terms(bytes32 seed, uint256 agentId) internal returns (Terms memory t) {
        t = CovenantProfiles.defaultTerms("Covenant Fork", "CVNF", _mineSalt(BSC_PORTAL, BSC_TOKEN_IMPL, seed), team);
        t.agentId = agentId;
    }

    function _poke(CovenantVault v, uint256 price) internal {
        bytes memory data = _pokeCalldata(address(v), atlasKey, price, block.timestamp);
        vm.startPrank(keeper);
        (bool ok, bytes memory ret) = address(oracle).call(data);
        vm.stopPrank();
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    function _buy(address who, address token, uint256 bnb) internal {
        address[] memory path = new address[](2);
        path[0] = E.wbnb;
        path[1] = token;
        vm.startPrank(who);
        IRouterLike(E.router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnb}(
            0, path, who, block.timestamp + 600
        );
        vm.stopPrank();
    }

    function _sell(address who, address token, uint256 amount) internal {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = E.wbnb;
        vm.startPrank(who);
        IERC20(token).approve(E.router, amount);
        IRouterLike(E.router)
            .swapExactTokensForETHSupportingFeeOnTransferTokens(amount, 0, path, who, block.timestamp + 600);
        vm.stopPrank();
    }

    function _taxLiquidated(address proc) internal view returns (bool) {
        ITaxProcessorLike t = ITaxProcessorLike(proc);
        return t.feeQuoteBalance() > 0 || t.marketQuoteBalance() > 0 || t.pendingDividendQuoteTokenBalance() > 0
            || t.lpQuoteBalance() > 0;
    }

    /// @dev Trade until the token's tax has been liquidated into its processor, then dispatch it (ForkBase style).
    function _generateTaxAndDispatch(address token) internal {
        address proc = ITaxTokenLike(token).taxProcessor();
        _buy(trader, token, 40 ether);
        for (uint256 i; i < 80 && !_taxLiquidated(proc); ++i) {
            uint256 amt = IERC20(token).balanceOf(trader) * 30 / 100;
            if (amt == 0) break;
            uint256 before = trader.balance;
            _sell(trader, token, amt);
            uint256 proceeds = trader.balance - before;
            if (proceeds > 0) _buy(trader, token, proceeds * 90 / 100);
        }
        assertTrue(_taxLiquidated(proc), "tax never liquidated");
        ITaxProcessorLike(proc).dispatch();
    }

    // ═════════════════════════════════════════════════════════════════════

    /// @dev The demo story end to end on the live Portal: an agent registers on ERC-8004, raises 1,400 BNB against
    ///      a 500 BNB cap, launches; buyers claim; trading tax reaches the vault; the agent claims its tap; a whale
    ///      slides the price under book; an exit round opens with no Atlas needed; a holder redeems; the agent goes
    ///      silent and anyone opens the treasury; the outcome lands in the agent's ERC-8004 record.
    struct Journey {
        CovenantLauncher l;
        CovenantVault v;
        address token;
        uint256 agentId;
    }

    function test_fork_fullJourney_onTheLivePortal() public {
        _open();
        Journey memory j = _phaseRaiseAndLaunch();
        _phaseOperate(j);
        _phaseExit(j);
        _phaseAbandon(j);
    }

    function _phaseRaiseAndLaunch() internal returns (Journey memory j) {
        // Agent identity on the real ERC-8004 IdentityRegistry, owned by the team wallet.
        vm.prank(team);
        j.agentId = IERC8004Identity(E.identity).register("ipfs://covenant-issuer-agent.json");
        assertEq(IERC8004Identity(E.identity).ownerOf(j.agentId), team);

        vm.recordLogs();
        j.l = _create(_terms("fork-journey", j.agentId));
        _assertDescriptionFolded(vm.getRecordedLogs(), address(j.l));
        assertEq(portal.getLauncher(address(j.l)).launcherFactory, address(pairF.launcherFactory), "recorded by Flap");

        vm.prank(alice);
        j.l.contribute{value: 14 ether}();
        vm.prank(bob);
        j.l.contribute{value: 386 ether}();
        vm.prank(carol);
        j.l.contribute{value: 400 ether}();
        vm.prank(whale);
        j.l.contribute{value: 600 ether}();

        vm.warp(j.l.saleDeadline());
        uint256 limit = j.l.FINALIZE_GAS_LIMIT();
        uint256 g0 = gasleft();
        vm.prank(keeper);
        j.l.finalize{gas: limit}(); // the limit the app, the server and the agents send
        uint256 used = g0 - gasleft();
        emit log_named_uint("finalize gas on the live Portal", used);
        assertEq(uint8(j.l.state()), uint8(State.ACTIVE), "launched through Flap");
        assertLt(used, limit, "within the limit every client sends");

        j.token = j.l.token();
        j.v = CovenantVault(payable(j.l.vault()));
        (address pv, address pvf) = portal.getLaunchVault(j.token);
        assertEq(pv, address(j.v));
        assertEq(pvf, address(pairF.vaultFactory));
        assertEq(uint16(uint160(j.token)), 0x7777, "vanity address");
        assertEq(
            ITaxTokenLike(j.token).taxExpirationTime(),
            block.timestamp + 100 * 365 days,
            "the default tax runs 100 years: Flap accepts it"
        );
        assertEq(IERC20(j.token).totalSupply(), 1_000_000_000 ether);
        assertEq(address(j.v).balance, 375 ether - 4, "treasury in the vault");
        assertEq(
            ITokenDock(BSC_DOCK_ROUTER).balanceOf(j.token, address(j.v)),
            850_000_000 ether,
            "reserve in Flap's Token Dock"
        );

        address[4] memory buyers = [alice, bob, carol, whale];
        for (uint256 i; i < 4; ++i) {
            vm.startPrank(buyers[i]);
            j.v.claimTokens();
            j.l.claimRefund();
            vm.stopPrank();
        }
        assertEq(IERC20(j.token).balanceOf(alice), 6_000_000 ether);

        // Every refund is out: the rest of the rounding buffer goes to the treasury.
        uint256 dust = address(j.l).balance;
        assertLe(dust, 4);
        uint256 treasury = address(j.v).balance;
        if (dust > 0) {
            j.l.sweepDust();
            assertEq(address(j.v).balance, treasury + dust, "dust into the treasury");
        }
        assertEq(address(j.l).balance, 0, "nothing left in the launcher");
    }

    function _phaseOperate(Journey memory j) internal {
        // The keeper's first poke records the dollar sale price.
        _poke(j.v, BNB_USD);
        assertEq(j.v.usdSalePrice(), j.v.salePriceBnb() * BNB_USD / 1e18);

        // Real trading on the PancakeSwap pool; the TaxProcessor pays the VAULT slot in BNB.
        vm.warp(block.timestamp + 601);
        uint256 rev0 = j.v.totalRevenue();
        _generateTaxAndDispatch(j.token);
        assertGt(j.v.totalRevenue(), rev0, "tax reached the vault through receive()");
        emit log_named_uint("tax revenue to the vault", j.v.totalRevenue() - rev0);

        // The agent claims its tap.
        vm.warp(block.timestamp + 1 hours);
        _poke(j.v, BNB_USD);
        uint256 owed = j.v.owedTeam();
        assertGt(owed, 0);
        uint256 teamBefore = team.balance;
        vm.prank(team);
        j.v.claimTap();
        assertEq(team.balance - teamBefore, owed);

        // The agent earns once and forwards it to the vault.
        vm.prank(team);
        j.v.depositRevenue{value: 2 ether}("x402:data-sale");
    }

    function _phaseExit(Journey memory j) internal {
        // A whale slides the price under book; three days of pokes with no Atlas report open a round.
        _sell(whale, j.token, IERC20(j.token).balanceOf(whale));
        for (uint256 i; i < 12; ++i) {
            vm.warp(block.timestamp + 6 hours);
            _poke(j.v, 0);
        }
        assertEq(uint8(j.v.state()), uint8(State.EXIT_ROUND), "exit round on on-chain numbers only");

        uint256 b = j.v.bookValue();
        vm.startPrank(alice);
        IERC20(j.token).approve(address(j.v), 6_000_000 ether);
        uint256 out = j.v.redeem(6_000_000 ether, 0);
        vm.stopPrank();
        uint256 gross = 6_000_000 ether * b / 1e18;
        assertEq(out, gross - gross * 100 / 10_000, "book value less the 1% exit fee");
        assertGe(j.v.bookValue(), b, "remaining holders keep their book value");
        emit log_named_uint("alice redeemed 6M tokens for (wei)", out);
    }

    function _phaseAbandon(Journey memory j) internal {
        vm.warp(j.v.heartbeatDeadline() + 1);
        vm.prank(keeper);
        j.v.declareAbandoned();
        assertEq(uint8(j.v.state()), uint8(State.WIND_DOWN));
        assertGe(IERC20(j.token).balanceOf(DEAD), 250_000_000 ether, "locked team tokens burned");

        // The outcome is in the agent's public record on the real ReputationRegistry.
        IERC8004Reputation rep = IERC8004Reputation(E.reputation);
        assertEq(rep.getLastIndex(j.agentId, address(j.v)), 1);
        (int128 value,, string memory tag1, string memory tag2,) = rep.readFeedback(j.agentId, address(j.v), 1);
        assertEq(value, -100);
        assertEq(tag1, "covenant");
        assertEq(tag2, "abandoned");

        CovenantLens.Issuer memory iss = lens.issuer(address(j.v));
        assertTrue(iss.agentBound);
        assertEq(iss.outcomesFromThisVault, 1);

        // Redemption stays open with no fee.
        uint256 bal = IERC20(j.token).balanceOf(bob);
        uint256 b2 = j.v.bookValue();
        vm.startPrank(bob);
        IERC20(j.token).approve(address(j.v), bal);
        uint256 out2 = j.v.redeem(bal, 0);
        vm.stopPrank();
        assertEq(out2, bal * b2 / 1e18, "no exit fee at wind-down");
    }

    /// @dev Flap gate. On BNB Chain a factory Flap has not opened cannot create a launcher. On the testnet Portal
    ///      (v1.2.0, Nov 26 2026) the gate is open: an unopened factory's covenant launched even with creation
    ///      paused, so a testnet demo may not need Flap to enable the factory. Either way the raise is safe: a
    ///      refused launch ends FAILED and refunds in full, and a launch that goes through is a normal covenant.
    function test_fork_unopenedFactory_isRefused() public {
        Terms memory t = _terms("fork-closed", 0);
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        try portal.newLauncher{value: fee}(address(pairF.launcherFactory), abi.encode(t)) returns (address la) {
            assertTrue(E.chainId != 56, "BNB Chain must refuse an unopened factory");
            CovenantLauncher l = CovenantLauncher(payable(la));
            vm.prank(alice);
            l.contribute{value: 300 ether}();
            vm.warp(l.saleDeadline());
            l.finalize();
            if (l.state() == State.FAILED) {
                uint256 before = alice.balance;
                vm.prank(alice);
                l.claimRefund();
                assertEq(alice.balance - before, 300 ether, "full refund");
            } else {
                assertEq(uint8(l.state()), uint8(State.ACTIVE));
                assertTrue(l.vault() != address(0));
                emit log("testnet Portal launched a covenant from an unopened launcher factory");
            }
        } catch {
            // refused up front (BNB Chain)
        }
    }

    /// @dev Flap's launch refuses a blocked name or symbol (`BlacklistedNameOrSymbol`); our factory now refuses it at
    ///      creation with the same live screen, before any money is raised. A normal name still creates.
    function test_fork_blockedNameOrSymbol_revertsAtCreate_normalNamePasses() public {
        _open();
        (bool nameBad, bool symbolBad) = INameScreenLike(E.nameScreen).isScamWord("BNB", "usdt");
        assertTrue(nameBad && symbolBad, "Flap's live list blocks BNB and USDT");

        uint256 fee = portal.SALT_LOCK_FEE();
        Terms memory t = _terms("fork-name-bnb", 0);
        t.name = "BNB";
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NameOrSymbolBlocked.selector, "BNB"));
        portal.newLauncher{value: fee}(address(pairF.launcherFactory), abi.encode(t));

        t = _terms("fork-symbol-usdt", 0);
        t.symbol = "usdt";
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NameOrSymbolBlocked.selector, "usdt"));
        pairF.launcherFactory.checkTerms(t);

        CovenantLauncher ok = _create(_terms("fork-name-ok", 0));
        assertEq(uint8(ok.state()), uint8(State.RAISING), "a normal name creates");
    }

    /// @dev Without the pre-screen, the same blocked name raises money and the live Portal refuses it at finalize:
    ///      the case the pre-screen now prevents. Funds stay safe either way (full refund).
    function test_fork_withoutThePrescreen_theLivePortalRefusesTheNameAtFinalize() public {
        Net memory n = net;
        n.nameScreen = address(0);
        Pair memory p = _deployPair(address(this), n, address(oracle), CovenantProfiles.production(), "no-screen");
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(p.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(p.vaultFactory), 10_000, true);
        vm.stopPrank();
        Terms memory t = _terms("fork-no-screen", 0);
        t.symbol = "USDT"; // blocked on both chains (ETH and BTC only on testnet, 26 Nov 2026)
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        CovenantLauncher l =
            CovenantLauncher(payable(portal.newLauncher{value: fee}(address(p.launcherFactory), abi.encode(t))));
        vm.prank(alice);
        l.contribute{value: 300 ether}();
        vm.warp(l.saleDeadline());
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        assertEq(uint8(l.state()), uint8(State.RAISING), "refused inside the retry window: still open (L-5)");
        vm.warp(l.launchRetryUntil());
        vm.recordLogs();
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        assertEq(uint8(l.state()), uint8(State.FAILED), "the Portal refused the launch");
        bytes memory reason = _launchFailedReason(vm.getRecordedLogs(), address(l));
        assertEq(bytes4(reason), bytes4(keccak256("BlacklistedNameOrSymbol(string)")), "Flap's name screen");
        uint256 before = alice.balance;
        vm.prank(alice);
        l.claimRefund();
        assertEq(alice.balance - before, 300 ether, "full refund");
    }

    /// @dev Flap's floors scale with pool share ($750 x S / P x multiplier at the Portal's BNB price to launch,
    ///      twice that to graduate), read live. Production needs the graduation floor at creation; the demo profile
    ///      needs the launch floor, and a demo raise exactly at its reported minimum launches on the live Portal.
    function test_fork_flapFloor_scalesWithPoolShare_checkedAtCreate() public {
        _open();
        CovenantLauncherFactory f = pairF.launcherFactory;

        // 15% pool, 10 BNB seed: Flap would launch it but never graduate it. Refused by production.
        Terms memory t = _terms("fork-floor-15", 0);
        t.minRaise = 40 ether;
        _expectFloorRevert(f, t);
        f.checkTerms(t);

        // 5% pool, 10 BNB seed: under even the launch floor. Refused.
        t = _terms("fork-floor-5", 0);
        t.poolBps = 500;
        t.saleBps = 7_000;
        t.minRaise = 140 ether;
        _expectFloorRevert(f, t);
        f.checkTerms(t);

        // Defaults: 200 BNB minimum, 50 BNB seed at 15%. Accepted.
        f.checkTerms(_terms("fork-floor-default", 0));

        // Our minimum is the Portal's: minRaiseFor seeds exactly the floor graduationFloorV2 reports.
        (uint256 minRaise, uint256 minSeed, uint256 floorUsd, uint256 price, bool graduation) =
            f.minRaiseFor(1_000_000_000 ether, 6_000, 1_500);
        assertTrue(graduation);
        emit log_named_decimal_uint("production minimum raise at a 15% pool, BNB", minRaise, 18);
        emit log_named_decimal_uint("Portal BNB price, USD", price, 18);
        assertEq(floorUsd, 10_000 ether, "$1,500 / 15% at 1x (the multiplier _open sets)");
        assertGe(minSeed * price / 1e18, floorUsd);

        // The demo profile: launch floor only, and the live Portal launches a raise exactly at that minimum.
        Pair memory demo = _deployPair(address(this), net, address(oracle), CovenantProfiles.demo(), "demo-floor");
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(demo.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(demo.vaultFactory), 10_000, true);
        vm.stopPrank();
        t = CovenantProfiles.demoTerms(
            "Covenant Floor", "CVFL", _mineSalt(BSC_PORTAL, BSC_TOKEN_IMPL, "floor-demo"), team
        );
        t.minRaise = 40 ether; // 10 BNB seed at 15%: over the launch floor
        demo.launcherFactory.checkTerms(t);
        (uint256 demoMin,,,, bool demoGraduation) =
            demo.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
        assertFalse(demoGraduation);
        t.minRaise = demoMin;
        t.cap = demoMin;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        CovenantLauncher l =
            CovenantLauncher(payable(portal.newLauncher{value: fee}(address(demo.launcherFactory), abi.encode(t))));
        vm.prank(alice);
        l.contribute{value: demoMin}();
        vm.warp(l.saleDeadline());
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        assertEq(uint8(l.state()), uint8(State.ACTIVE), "exactly at the reported minimum, Flap launches");
    }

    function _expectFloorRevert(CovenantLauncherFactory f, Terms memory t) internal {
        (uint256 minRaise, uint256 minSeed,,, bool graduation) = f.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
        vm.expectRevert(
            abi.encodeWithSelector(
                CovenantLauncherFactory.PoolSeedBelowFlapFloor.selector,
                t.minRaise * t.poolBps / t.saleBps,
                minSeed,
                minRaise,
                graduation
            )
        );
    }

    /// @dev Pre-audit M-3 on the live Portal: terms it refuses at launch (no tax, a tax shorter than the anti-farmer
    ///      window) are refused by the factory at creation; the 100-year maximum and one-sided taxes still create.
    function test_fork_termsThePortalRefuses_areRefusedAtCreate() public {
        _open();
        CovenantLauncherFactory f = pairF.launcherFactory;
        Terms memory t = _terms("fork-m3", 0);
        t.buyTaxBps = 0;
        t.sellTaxBps = 0;
        vm.expectRevert(CovenantTermsLib.BadTax.selector);
        f.checkTerms(t);
        t.buyTaxBps = 0;
        t.sellTaxBps = 100;
        f.checkTerms(t);
        t.taxDuration = 1;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, 1));
        f.checkTerms(t);
        t.taxDuration = type(uint32).max;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, type(uint32).max));
        f.checkTerms(t);
    }

    /// @dev Pre-audit "ruled out", kept as evidence: pre-creating (and funding) the PancakeSwap pair for the
    ///      predictable 7777 token address does not break the launch, and the pool still opens at the sale price.
    function test_fork_preCreatedPairWithDonation_doesNotBreakTheLaunch() public {
        _open();
        Terms memory t = _terms("fork-precreate", 0);
        CovenantLauncher l = _create(t);
        vm.prank(alice);
        l.contribute{value: 300 ether}();
        address predicted = Clones.predictDeterministicAddress(BSC_TOKEN_IMPL, t.salt, BSC_PORTAL);
        address griefer = address(uint160(0xC0DE1F00));
        vm.deal(griefer, 10 ether);
        vm.startPrank(griefer);
        address pair = IV2FactoryLike(IV2RouterFactoryLike(E.router).factory()).createPair(predicted, E.wbnb);
        IWBNBLike(E.wbnb).deposit{value: 1 ether}();
        IWBNBLike(E.wbnb).transfer(pair, 1 ether);
        vm.stopPrank();
        vm.warp(l.saleDeadline());
        vm.prank(keeper);
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        assertEq(uint8(l.state()), uint8(State.ACTIVE), "the launch went through");
        assertEq(l.pool(), pair, "the Portal reused the pre-created pair");
    }

    function _launchFailedReason(Vm.Log[] memory logs, address launcher) internal pure returns (bytes memory) {
        bytes32 topic = keccak256("LaunchFailed(bytes)");
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == launcher && logs[i].topics[0] == topic) return abi.decode(logs[i].data, (bytes));
        }
        revert("LaunchFailed not found");
    }

    /// @dev The vault factory refuses a launch from a caller the Portal never recorded as our launcher.
    function test_fork_vaultFactoryRefusesAStrangerLauncher() public {
        _open();
        vm.prank(admin);
        portal.setCreationPaused(false);

        IPortalTypes.CreateTaxTokenParams memory p;
        p.name = "Stranger";
        p.symbol = "STR";
        p.totalSupply = 1_000_000_000 ether;
        p.salt = _mineSalt(BSC_PORTAL, BSC_TOKEN_IMPL, "fork-stranger");
        p.poolQuote = 20 ether;
        p.poolToken = 1_000_000_000 ether;
        p.buyTaxRate = 100;
        p.sellTaxRate = 100;
        p.taxDuration = 30 days;
        p.antiFarmerDuration = 1 days;
        p.feeConfigs = new IPortalTypes.FeeConfig[](1);
        p.feeConfigs[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 10_000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({vaultFactory: address(pairF.vaultFactory), vaultData: abi.encode(trader)})
            )
        });
        Distribution memory d;
        IPortalTypes.CreatorBuyParams memory noBuy;

        uint256 fee = portal.SALT_LOCK_FEE();
        vm.startPrank(trader);
        portal.lockSalt{value: fee}(p.salt, 0);
        vm.expectRevert(abi.encodeWithSelector(CovenantVaultFactory.NotFromLauncherFactory.selector, trader));
        portal.launchTaxTokenV2{value: 20 ether}(p, d, noBuy);
        vm.stopPrank();
    }

    /// @dev An agent covenant needs the agent NFT in the team wallet, on the real IdentityRegistry.
    function test_fork_agentIdMustBeOwnedByTheTeamWallet() public {
        _open();
        vm.prank(trader);
        uint256 otherAgent = IERC8004Identity(E.identity).register("ipfs://someone-else.json");
        Terms memory t = _terms("fork-agent-other", otherAgent);
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        vm.expectRevert();
        portal.newLauncher{value: fee}(address(pairF.launcherFactory), abi.encode(t));
    }

    /// @dev CovenantLiteVault behind Four.meme's live ForwardVault implementation on BNB Chain.
    function test_fork_liteVault_behindTheLiveForwardVault() public {
        if (E.forwardVaultImpl == address(0)) vm.skip(true);
        address author = address(uint160(0xC0DE10A0));
        address tokenStandIn = address(uint160(0xC0DE10A1));
        CovenantLiteVault template = new CovenantLiteVault(author);
        address fv = Clones.clone(E.forwardVaultImpl);
        IForwardVaultLike(fv)
            .initialize(
                tokenStandIn,
                E.wbnb,
                team,
                new address[](0),
                // ForwardVault decodes a struct (address template, bytes initData): tuple-wrapped, not flat.
                abi.encode(
                    ForwardVault.InitParams(
                        address(template), abi.encode(uint16(400), uint32(30 days), uint32(45 days), uint16(100))
                    )
                )
            );
        CovenantLiteVault lite = CovenantLiteVault(payable(IForwardVaultLike(fv).clonedVault()));
        assertEq(lite.owner(), team);
        assertEq(lite.taxVaultToken(), tokenStandIn);

        vm.deal(tokenStandIn, 10 ether);
        vm.prank(tokenStandIn);
        (bool ok,) = fv.call{value: 10 ether}("");
        assertTrue(ok);
        assertEq(IERC20(E.wbnb).balanceOf(author), 0.6 ether, "6% royalty to the template author as WBNB");
        assertEq(address(lite).balance, 9.4 ether);
    }

    /// @dev Atlas's real BNB/USD push feed read through CovenantOracle: a poke with no pull report takes the feed's
    ///      latest round (it keeps only that one, so freshness is its updatedAt), the observation is strict while
    ///      the round is fresh and the pool deep, and once the round is older than the max age the rate drops out
    ///      while the exit observation still counts (exit fix 3).
    function test_fork_atlasPushFeed_pricesTheTapAndTheStrictGate() public {
        if (E.atlasPushBnbUsd == address(0)) vm.skip(true);
        IAggregatorV3 feed = IAggregatorV3(E.atlasPushBnbUsd);
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        uint8 dec = feed.decimals();
        assertGt(answer, 0, "the feed answers");
        assertLe(block.timestamp - updatedAt, 1 hours, "the feed is live at the fork block");
        uint256 px = dec <= 18 ? uint256(answer) * 10 ** (18 - dec) : uint256(answer) / 10 ** (dec - 18);
        assertGt(px, 50 ether, "BNB/USD above $50");
        assertLt(px, 5_000 ether, "BNB/USD below $5,000");

        CovenantOracle push = new CovenantOracle(DEV_BNB_USD_FEED, vm.addr(atlasKey), E.atlasPushBnbUsd, 1 hours);
        Pair memory demo = _deployPair(address(this), net, address(push), CovenantProfiles.demo(), "demo-push");
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(demo.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(demo.vaultFactory), 10_000, true);
        vm.stopPrank();

        Terms memory t = CovenantProfiles.demoTerms(
            "Covenant Push", "CVPF", _mineSalt(BSC_PORTAL, BSC_TOKEN_IMPL, "push-feed"), team
        );
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        CovenantLauncher l =
            CovenantLauncher(payable(portal.newLauncher{value: fee}(address(demo.launcherFactory), abi.encode(t))));
        vm.prank(alice);
        l.contribute{value: 300 ether}();
        vm.warp(l.saleDeadline());
        vm.prank(keeper);
        l.finalize();
        assertEq(uint8(l.state()), uint8(State.ACTIVE));
        CovenantVault v = CovenantVault(payable(l.vault()));
        // Pre-audit M-2: with a live push feed the dollar sale price is fixed in the launch transaction.
        assertEq(v.usdSaleRefAt(), v.launchedAt(), "dollar sale price set at launch");
        assertEq(v.usdSalePrice(), v.salePriceBnb() * push.pushBnbUsd() / 1e18);

        // A plain poke (no pull report attached): the oracle reads the push feed.
        vm.prank(keeper);
        push.poke(address(v));
        assertTrue(v.lastAtlas(), "fresh push round");
        assertTrue(v.lastStrict(), "strict: fresh rate and a deep pool");
        assertEq(v.lastBnbUsd(), px, "the dollar rate is the feed's latest round");
        assertEq(v.usdSalePrice(), v.salePriceBnb() * px / 1e18, "the first strict poke fixes the dollar sale price");

        // Past the max age with no new round on the fork: no rate, nothing strict, the exit observation still counts.
        vm.warp(updatedAt + 1 hours + 1);
        vm.prank(keeper);
        push.poke(address(v));
        assertFalse(v.lastAtlas(), "stale round refused by updatedAt");
        assertFalse(v.lastStrict());
        assertTrue(v.lastTrusted(), "the exit rule needs no Atlas");
    }

    function _assertDescriptionFolded(Vm.Log[] memory logs, address launcher) internal view {
        bytes32 topic = keccak256("FlapNewLauncherCreated(address,address,address,string)");
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != BSC_PORTAL || logs[i].topics.length == 0 || logs[i].topics[0] != topic) continue;
            (address emitted,,, string memory description) =
                abi.decode(logs[i].data, (address, address, address, string));
            if (emitted != launcher) continue;
            assertEq(description, CovenantLauncher(payable(launcher)).description(), "Flap folded our JSON");
            return;
        }
        revert("FlapNewLauncherCreated not found");
    }
}

/// @notice BNB Chain mainnet. Needs BSC_RPC_URL.
contract CovenantBSCForkTest is CovenantForkBase {
    function _env() internal pure override returns (ForkEnv memory e) {
        e.rpcEnv = "BSC_RPC_URL";
        e.chainId = 56;
        e.guardian = BSC_GUARDIAN;
        e.wbnb = BSC_WBNB;
        e.router = BSC_V2_ROUTER;
        e.identity = BSC_IDENTITY;
        e.reputation = BSC_REPUTATION;
        e.forwardVaultImpl = 0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4;
        e.nameScreen = BSC_NAME_SCREEN;
    }
}

/// @notice BNB testnet, where the first public deployment goes. Needs BSC_TESTNET_RPC_URL.
contract CovenantBSCTestnetForkTest is CovenantForkBase {
    function _env() internal pure override returns (ForkEnv memory e) {
        e.rpcEnv = "BSC_TESTNET_RPC_URL";
        e.chainId = 97;
        e.guardian = BSC_TESTNET_GUARDIAN;
        e.wbnb = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
        e.router = 0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3;
        e.identity = BSC_TESTNET_IDENTITY;
        e.reputation = BSC_TESTNET_REPUTATION;
        e.atlasPushBnbUsd = 0x3957d289ee9C38272377786787ea34F9dd29788D; // Atlas BNB/USD push feed, verified 2026-11-26
        e.nameScreen = BSC_TESTNET_NAME_SCREEN;
    }
}
