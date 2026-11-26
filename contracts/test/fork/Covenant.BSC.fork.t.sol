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
import {VaultEnv} from "src/vault/CovenantTypes.sol";
import {CovenantVaultDisplay} from "src/vault/CovenantVaultDisplay.sol";

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
        // Flap's UI reads these flat views; the expected token is known before any money is raised.
        address expected = j.l.expectedToken();
        assertEq(uint16(uint160(expected)), 0x7777, "the expected token carries the vanity suffix");
        assertEq(j.l.minRaise(), 200 ether);
        assertEq(j.l.cap(), 500 ether);
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
        // F7: a starved call (a gas estimate below the launch floor) is refused before the launch is tried and changes
        // nothing; a transaction at Flap's 15M cap (its gas less the 21,064 intrinsic) launches.
        assertEq(limit, 15_000_000, "Flap's vault SDK and flap.sh cap a gas override at 15M on BNB Chain");
        vm.prank(keeper);
        vm.expectRevert(CovenantLauncher.InsufficientGas.selector);
        j.l.finalize{gas: 11_900_000}();
        assertEq(uint8(j.l.state()), uint8(State.RAISING));
        uint256 g0 = gasleft();
        vm.prank(keeper);
        j.l.finalize{gas: limit - 21_064}(); // a 15M transaction: the limit the app, the server and the agents send
        uint256 used = g0 - gasleft();
        emit log_named_uint("finalize gas on the live Portal", used);
        assertEq(uint8(j.l.state()), uint8(State.ACTIVE), "launched through Flap");
        assertLt(used, limit, "within the limit every client sends");

        j.token = j.l.token();
        assertEq(j.token, expected, "expectedToken() is the token the live Portal deployed");
        assertEq(j.l.expectedToken(), j.token);
        j.v = CovenantVault(payable(j.l.vault()));
        (address pv, address pvf) = portal.getLaunchVault(j.token);
        assertEq(pv, address(j.v));
        assertEq(pvf, address(pairF.vaultFactory));
        assertEq(uint16(uint160(j.token)), 0x7777, "vanity address");
        // The launch LP is burned: every LP token sits at the dead address or address zero (the pool's depth can
        // never fall below the launch position, so a same-block trade cannot fake a shallow pool).
        IERC20 lp = IERC20(j.l.pool());
        assertEq(lp.balanceOf(DEAD) + lp.balanceOf(address(0)), lp.totalSupply(), "all launch LP burned");
        assertEq(
            ITaxTokenLike(j.token).taxExpirationTime(),
            block.timestamp + 100 * 365 days,
            "the default tax runs 100 years: Flap accepts it"
        );
        assertEq(IERC20(j.token).totalSupply(), 1_000_000_000 ether);
        assertEq(address(j.v).balance, 375 ether - 4, "treasury in the vault");
        // F8: the vault's description says what the treasury lives on once the tax ends.
        assertTrue(
            _has(
                j.v.description(),
                string.concat(
                    "is the treasury's income until ",
                    CovenantVaultDisplay.date(ITaxTokenLike(j.token).taxExpirationTime()),
                    " UTC; after that the tap is paid only from the treasury, so book value only falls unless the team deposits revenue"
                )
            ),
            "post-tax disclosure, dated from Flap's own tax expiry"
        );
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

    /// @dev F2 and F6: no factory on this chain can skip Flap's name screen (a zero or foreign screen is refused at
    ///      construction), and the screen is the Portal's own: the live Portal refuses USDT / USDT at launch with
    ///      `BlacklistedNameOrSymbol`, which our factory now raises at creation as `NameOrSymbolBlocked`.
    function test_fork_F2_usdtUsdt_refusedAtCreate_andTheScreenCannotBeSkipped() public {
        _open();
        Terms memory t = _terms("fork-usdt-usdt", 0);
        t.name = "USDT";
        t.symbol = "USDT";
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NameOrSymbolBlocked.selector, "USDT"));
        portal.newLauncher{value: fee}(address(pairF.launcherFactory), abi.encode(t));

        Net memory n = net;
        n.nameScreen = address(0);
        vm.expectRevert(
            abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, address(0), E.nameScreen)
        );
        this.deployPairExternal(n);

        // The Portal itself refuses the name at launch (a direct launch, outside any covenant).
        IPortalTypes.CreateTaxTokenParams memory p = _directParams("fork-direct-usdt");
        p.name = "USDT";
        p.symbol = "USDT";
        _expectDirectLaunchRevert(p, abi.encodeWithSignature("BlacklistedNameOrSymbol(string)", "USDT"));
    }

    function deployPairExternal(Net memory n) external returns (Pair memory) {
        return _deployPair(address(this), n, address(oracle), CovenantProfiles.production(), "no-screen");
    }

    /// @dev A plain direct `launchTaxTokenV2` (one MARKETING fee slot, no vault), for probing the Portal's own launch
    ///      checks outside any covenant.
    function _directParams(bytes32 seed) internal returns (IPortalTypes.CreateTaxTokenParams memory p) {
        p.name = "Direct";
        p.symbol = "DRCT";
        p.totalSupply = 1_000_000_000 ether;
        p.salt = _mineSalt(BSC_PORTAL, BSC_TOKEN_IMPL, seed);
        p.poolQuote = 50 ether;
        p.poolToken = 1_000_000_000 ether;
        p.buyTaxRate = 100;
        p.sellTaxRate = 100;
        p.taxDuration = 30 days;
        p.antiFarmerDuration = 1 days;
        p.feeConfigs = new IPortalTypes.FeeConfig[](1);
        p.feeConfigs[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.MARKETING,
            bps: 10_000,
            configData: abi.encode(IPortalTypes.FeeConfigMarket({marketingAddress: trader}))
        });
    }

    function _expectDirectLaunchRevert(IPortalTypes.CreateTaxTokenParams memory p, bytes memory reason) internal {
        vm.prank(admin);
        portal.setCreationPaused(false);
        Distribution memory d;
        IPortalTypes.CreatorBuyParams memory noBuy;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.startPrank(trader);
        portal.lockSalt{value: fee}(p.salt, 0);
        vm.expectRevert(reason);
        portal.launchTaxTokenV2{value: p.poolQuote}(p, d, noBuy);
        vm.stopPrank();
        vm.prank(admin);
        portal.setCreationPaused(true);
    }

    function _graduated(Vm.Log[] memory logs) internal pure returns (bool) {
        bytes32 topic = keccak256("FlapTokenGraduated(address)");
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == BSC_PORTAL && logs[i].topics.length > 0 && logs[i].topics[0] == topic) return true;
        }
        return false;
    }

    function _split(bytes32 seed, uint16 saleBps, uint16 poolBps) internal returns (Terms memory t) {
        t = _terms(seed, 0);
        t.saleBps = saleBps;
        t.poolBps = poolBps;
        uint256 teamBps = 10_000 - saleBps - poolBps;
        if (teamBps == 0) {
            t.trancheBps = new uint16[](0);
            t.trancheMultiple = new uint16[](0);
        } else {
            t.trancheBps = new uint16[](1);
            t.trancheBps[0] = uint16(teamBps);
            t.trancheMultiple = new uint16[](1);
            t.trancheMultiple[0] = 200;
        }
    }

    /// @dev Create a covenant at exactly `minRaise` (cap too), raise it, finalize; returns whether Flap graduated it.
    function _launchAtMinimum(Terms memory t, uint256 minRaise) internal returns (CovenantLauncher l, bool graduated) {
        t.minRaise = minRaise;
        t.cap = minRaise;
        l = _create(t);
        vm.prank(alice);
        l.contribute{value: minRaise}();
        vm.warp(l.saleDeadline());
        vm.recordLogs();
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        graduated = _graduated(vm.getRecordedLogs());
    }

    /// @dev F1, the bot's pool shares on the live Portal: at 5%, 15% and 50% the minimum raise seeds 1.5x the
    ///      `graduationFloorV2` floor, one wei less is refused at creation, and a raise exactly at the minimum launches
    ///      and graduates (`FlapTokenGraduated` in the launch transaction).
    function test_fork_F1_floorByPoolShare_5_15_50_graduatesAtTheMinimum() public {
        _open();
        uint16[3] memory pool = [uint16(500), 1_500, 5_000];
        uint16[3] memory sale = [uint16(7_000), 6_000, 5_000];
        for (uint256 i; i < 3; ++i) {
            Terms memory t = _split(keccak256(abi.encode("fork-f1-share", i)), sale[i], pool[i]);
            (uint256 minRaise, uint256 minSeed, uint256 floorUsd, uint256 price, bool graduation, uint256 margin) =
                pairF.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
            assertTrue(graduation);
            assertEq(margin, 15_000);
            assertEq(floorUsd, uint256(1_500 ether) * 10_000 / pool[i], "Flap's graduation floor at 1x");
            assertGe(minSeed * price / 1e18, floorUsd * 3 / 2, "1.5x the floor");
            emit log_named_uint("pool bps", pool[i]);
            emit log_named_decimal_uint("  Flap graduation floor (USD)", floorUsd, 18);
            emit log_named_decimal_uint("  minimum raise (BNB)", minRaise, 18);

            Terms memory below = t;
            below.minRaise = minRaise - 1;
            below.cap = minRaise;
            vm.expectRevert(
                abi.encodeWithSelector(
                    CovenantLauncherFactory.PoolSeedBelowFlapFloor.selector,
                    below.minRaise * t.poolBps / t.saleBps,
                    minSeed,
                    minRaise,
                    true
                )
            );
            pairF.launcherFactory.checkTerms(below);

            (CovenantLauncher l, bool graduated) = _launchAtMinimum(t, minRaise);
            assertEq(uint8(l.state()), uint8(State.ACTIVE), "launched");
            assertTrue(graduated, "graduated in the launch transaction");
        }
    }

    /// @dev F1, the margin: Flap opens our vault factory at a 0.7x multiplier, a raise is created exactly at that
    ///      minimum, and Flap moves the multiplier back to 1x during the sale (the floor rises 43%, the same as its BNB
    ///      price falling 30%). The launch still graduates. Without the margin (main before this fix) a 0.9x -> 1x move
    ///      already left such a raise ungraduated (data/covenant-flap-rereview/logs/poc-main-fork.log).
    function test_fork_F1_theMarginAbsorbsAFloorMoveDuringTheSale() public {
        _open();
        vm.prank(admin);
        portal.setVaultFactoryMultiplier(address(pairF.vaultFactory), 7_000, true);
        Terms memory t = _terms("fork-f1-margin", 0);
        (uint256 minRaise,,,,,) = pairF.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
        t.minRaise = minRaise;
        t.cap = minRaise;
        CovenantLauncher l = _create(t);
        vm.prank(alice);
        l.contribute{value: minRaise}();
        vm.prank(admin);
        portal.setVaultFactoryMultiplier(address(pairF.vaultFactory), 10_000, true);
        vm.warp(l.saleDeadline());
        vm.recordLogs();
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        assertEq(uint8(l.state()), uint8(State.ACTIVE));
        assertTrue(_graduated(vm.getRecordedLogs()), "still graduates after a 43% floor rise");
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
        (uint256 minRaise, uint256 minSeed, uint256 floorUsd, uint256 price, bool graduation,) =
            f.minRaiseFor(1_000_000_000 ether, 6_000, 1_500);
        assertTrue(graduation);
        emit log_named_decimal_uint("production minimum raise at a 15% pool, BNB", minRaise, 18);
        emit log_named_decimal_uint("Portal BNB price, USD", price, 18);
        assertEq(floorUsd, 10_000 ether, "$1,500 / 15% at 1x (the multiplier _open sets)");
        assertGe(minSeed * price / 1e18, floorUsd * 3 / 2, "with the 1.5x margin");

        // The demo profile: Flap's creation floor with the same 1.5x margin, and the live Portal launches a raise
        // exactly at that minimum (it does not graduate: 1.5x the creation floor is 0.75x the graduation floor).
        Pair memory demo = _deployPair(address(this), net, address(oracle), CovenantProfiles.demo(), "demo-floor");
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(demo.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(demo.vaultFactory), 10_000, true);
        vm.stopPrank();
        t = CovenantProfiles.demoTerms(
            "Covenant Floor", "CVFL", _mineSalt(BSC_PORTAL, BSC_TOKEN_IMPL, "floor-demo"), team
        );
        t.minRaise = 40 ether; // 10 BNB seed at 15%: over the creation floor, under 1.5x of it
        _expectFloorRevert(demo.launcherFactory, t);
        demo.launcherFactory.checkTerms(t);
        (uint256 demoMin,,,, bool demoGraduation, uint256 demoMargin) =
            demo.launcherFactory.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
        assertFalse(demoGraduation, "the demo factory needs the creation floor");
        assertEq(demoMargin, 15_000, "with the margin");
        assertApproxEqAbs(demoMin * 2, minRaise, 10);
        t.minRaise = demoMin;
        t.cap = demoMin;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.prank(team);
        CovenantLauncher l =
            CovenantLauncher(payable(portal.newLauncher{value: fee}(address(demo.launcherFactory), abi.encode(t))));
        vm.prank(alice);
        l.contribute{value: demoMin}();
        vm.warp(l.saleDeadline());
        vm.recordLogs();
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        assertEq(uint8(l.state()), uint8(State.ACTIVE), "exactly at the reported minimum, Flap launches");
        assertFalse(_graduated(vm.getRecordedLogs()), "a demo token at its minimum is not graduated (disclosed)");
    }

    function _expectFloorRevert(CovenantLauncherFactory f, Terms memory t) internal {
        (uint256 minRaise, uint256 minSeed,,, bool graduation,) = f.minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
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

    /// @dev F3 (and pre-audit M-3) on the live Portal: the tax terms it refuses at launch are refused by the factory
    ///      at creation (0% / 0%, a higher rate under 1%, a tax shorter than the 1-day anti-farmer window), and the
    ///      Portal itself refuses the same terms in a direct launch. One-sided taxes and the 100-year maximum create.
    function test_fork_F3_taxEdgeCases_areRefusedAtCreate_asThePortalRefusesThem() public {
        _open();
        CovenantLauncherFactory f = pairF.launcherFactory;
        uint16[2][4] memory bad = [[uint16(0), 0], [uint16(1), 0], [uint16(50), 0], [uint16(99), 99]];
        for (uint256 i; i < bad.length; ++i) {
            Terms memory t = _terms(keccak256(abi.encode("fork-f3-bad", i)), 0);
            t.buyTaxBps = bad[i][0];
            t.sellTaxBps = bad[i][1];
            vm.expectRevert(CovenantTermsLib.BadTax.selector);
            f.checkTerms(t);
        }
        uint16[2][3] memory good = [[uint16(100), 0], [uint16(0), 100], [uint16(100), 1]];
        for (uint256 i; i < good.length; ++i) {
            Terms memory t = _terms(keccak256(abi.encode("fork-f3-good", i)), 0);
            t.buyTaxBps = good[i][0];
            t.sellTaxBps = good[i][1];
            f.checkTerms(t);
        }
        Terms memory d = _terms("fork-f3-duration", 0);
        d.taxDuration = 1 days - 1; // under the anti-farmer window the profile passes to the Portal
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, 1 days - 1));
        f.checkTerms(d);
        d.taxDuration = type(uint32).max;
        vm.expectRevert(abi.encodeWithSelector(CovenantTermsLib.BadTaxDuration.selector, type(uint32).max));
        f.checkTerms(d);

        // The Portal's own rules, in direct launches.
        IPortalTypes.CreateTaxTokenParams memory p = _directParams("fork-f3-direct-99");
        p.buyTaxRate = 99;
        p.sellTaxRate = 99;
        _expectDirectLaunchRevert(p, abi.encodeWithSignature("InvalidTaxBps(uint256)", 99));
        p = _directParams("fork-f3-direct-0");
        p.buyTaxRate = 0;
        p.sellTaxRate = 0;
        _expectDirectLaunchRevert(p, abi.encodeWithSignature("InvalidTaxBps(uint256)", 0));
        p = _directParams("fork-f3-direct-dur");
        p.taxDuration = 1 days - 1;
        _expectDirectLaunchRevert(p, bytes("taxDuration < antiFarmerDuration"));

        // Control: the same direct launch at 1% / 0% and one day of tax goes through, so the refusals above are the
        // tax rules and nothing else.
        p = _directParams("fork-f3-direct-ok");
        p.buyTaxRate = 100;
        p.sellTaxRate = 0;
        p.taxDuration = 1 days;
        vm.prank(admin);
        portal.setCreationPaused(false);
        Distribution memory none;
        IPortalTypes.CreatorBuyParams memory noBuy;
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.startPrank(trader);
        portal.lockSalt{value: fee}(p.salt, 0);
        (address tok,) = portal.launchTaxTokenV2{value: p.poolQuote}(p, none, noBuy);
        vm.stopPrank();
        assertTrue(tok != address(0), "1% / 0% for one day launches");
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

    /// @dev A launched default covenant on the live Portal, its tokens claimed, the dollar sale price recorded.
    function _liveCovenant(bytes32 seed) internal returns (CovenantVault v, address token) {
        _open();
        CovenantLauncher l = _create(_terms(seed, 0));
        vm.prank(alice);
        l.contribute{value: 300 ether}();
        vm.warp(l.saleDeadline());
        l.finalize{gas: l.FINALIZE_GAS_LIMIT()}();
        require(l.state() == State.ACTIVE, "launch");
        v = CovenantVault(payable(l.vault()));
        token = l.token();
        vm.prank(alice);
        v.claimTokens();
        _poke(v, BNB_USD);
    }

    function _spotOf(CovenantVault v) internal view returns (uint256 s) {
        (, s,,,) = oracle.preview(address(v));
    }

    /// @dev Buy on the real PancakeSwap pool until the spot price is `pct`% of the BNB sale price.
    function _pumpTo(CovenantVault v, address token, uint256 pct) internal {
        vm.warp(block.timestamp + 601);
        uint256 target = v.salePriceBnb() * pct / 100;
        for (uint256 i; i < 200 && _spotOf(v) < target; ++i) {
            _buy(trader, token, 2 ether);
        }
        require(_spotOf(v) >= target, "pump");
    }

    function _progressOf(CovenantVault v) internal view returns (uint256 p) {
        (,, p,,) = v.trancheProgress(0);
    }

    function _barePoke(CovenantVault v) internal {
        vm.prank(trader);
        oracle.poke(address(v));
    }

    /// @dev F4, the bot's PoC on the live pool: 6 h of strict time at 2.05x, then the price under 2x for 6 h with a
    ///      reportless poke: the counter goes to 0.
    function test_fork_F4_dipWithAReportlessPoke_resetsTheCounterOnTheLivePool() public {
        (CovenantVault v, address token) = _liveCovenant("fork-f4");
        _pumpTo(v, token, 205);
        vm.warp(block.timestamp + 6 hours);
        _poke(v, BNB_USD);
        vm.warp(block.timestamp + 6 hours);
        _poke(v, BNB_USD);
        assertEq(_progressOf(v), 6 hours, "6 h of strict time at 2.05x");

        vm.warp(block.timestamp + 60);
        uint256 target = v.salePriceBnb() * 2;
        uint256 bal = IERC20(token).balanceOf(trader);
        for (uint256 i; i < 40 && _spotOf(v) >= target; ++i) {
            _sell(trader, token, bal / 20);
        }
        assertLt(_spotOf(v), target, "under 2x");
        vm.warp(block.timestamp + 6 hours);
        _barePoke(v);
        assertFalse(v.lastStrict());
        assertEq(_progressOf(v), 0, "reset by the reportless poke");
    }

    /// @dev F5 on the live pool: a reportless poke right before the keeper's report no longer makes it revert
    ///      TooSoon, and unlock time keeps counting while the price holds the multiple.
    function test_fork_F5_aReportlessPokeCannotBlockTheKeeper() public {
        (CovenantVault v, address token) = _liveCovenant("fork-f5");
        _pumpTo(v, token, 250);
        for (uint256 i; i < 12; ++i) {
            vm.warp(block.timestamp + 1 hours);
            _barePoke(v); // a griefer is first every hour
            _poke(v, BNB_USD); // the keeper's report still lands
            assertTrue(v.lastStrict());
        }
        assertGe(_progressOf(v), 11 hours, "unlock time keeps counting");
        assertEq(oracle.nextRatePokeAt(address(v)), block.timestamp + 1 hours);
    }

    /// @dev F4/F5 where there is no Atlas push feed (BNB Chain mainnet; every poke without a pull report carries no
    ///      rate): a griefer pokes without a report first, every hour. It never resets a counter while the price holds
    ///      the multiple, the keeper's report still lands each hour, and the 2x tranche unlocks on schedule. A genuine
    ///      dip seen by a reportless poke still resets the counter (F4), and the count starts again after it.
    function test_fork_F5_noPushFeed_griefingCannotFreezeUnlocks_aRealDipStillResets() public {
        _open();
        Terms memory t = _terms("fork-f5-freeze", 0);
        t.cliff = 0;
        t.unlockWindow = 7 days; // the production minimum, so the run stays short
        CovenantLauncher l = _create(t);
        vm.prank(alice);
        l.contribute{value: 300 ether}();
        vm.warp(l.saleDeadline());
        l.finalize{gas: l.FINALIZE_GAS_LIMIT() - 21_064}();
        CovenantVault v = CovenantVault(payable(l.vault()));
        address token = l.token();
        assertEq(oracle.PUSH_FEED(), address(0), "pull reports only, as on BNB Chain mainnet");
        _poke(v, BNB_USD);
        _pumpTo(v, token, 250);

        // Three days: the griefer is first every hour, the keeper's report lands right after it.
        vm.warp(block.timestamp + 1 hours);
        _poke(v, BNB_USD);
        for (uint256 i; i < 3 * 24; ++i) {
            vm.warp(block.timestamp + 1 hours);
            _barePoke(v);
            _poke(v, BNB_USD);
        }
        assertGe(_progressOf(v), 3 days, "griefing changed nothing: three days counted");

        // A genuine dip under 2x, seen by a reportless poke only (no keeper): the counter resets.
        vm.warp(block.timestamp + 60);
        uint256 bal = IERC20(token).balanceOf(trader);
        for (uint256 i; i < 40 && _spotOf(v) >= v.salePriceBnb() * 2; ++i) {
            _sell(trader, token, bal / 20);
        }
        vm.warp(block.timestamp + 1 hours);
        _barePoke(v);
        assertEq(_progressOf(v), 0, "a real dip resets");

        // The price recovers; with the griefer still first every hour the tranche unlocks after 7 days of strict time.
        _pumpTo(v, token, 250);
        vm.warp(block.timestamp + 1 hours);
        _poke(v, BNB_USD);
        bool unlocked;
        for (uint256 i; i < 7 * 24 + 3 && !unlocked; ++i) {
            vm.warp(block.timestamp + 1 hours);
            _barePoke(v);
            _poke(v, BNB_USD);
            (,,, unlocked,) = v.trancheProgress(0);
        }
        assertTrue(unlocked, "unlocked on schedule despite the griefer");
        assertEq(v.unlockedUnreleased(), 50_000_000 ether);
    }

    /// @dev F6 on the live chain: the factories refuse any Portal, Guardian, Token Dock router or name screen that is
    ///      not Flap's own on this chain.
    function test_fork_F6_factoriesRefuseNonFlapAddresses() public {
        VaultEnv memory env = VaultEnv(BSC_PORTAL, E.guardian, BSC_DOCK_ROUTER, address(oracle), address(0), address(0));
        address other = address(uint160(0xC0DE1F01));
        vm.expectRevert(abi.encodeWithSelector(CovenantVaultFactory.NotFlapAddress.selector, other, E.guardian));
        new CovenantVaultFactory(
            address(1), VaultEnv(BSC_PORTAL, other, BSC_DOCK_ROUTER, address(oracle), address(0), address(0))
        );
        vm.expectRevert(abi.encodeWithSelector(CovenantVaultFactory.NotFlapAddress.selector, other, BSC_PORTAL));
        new CovenantVaultFactory(
            address(1), VaultEnv(other, E.guardian, BSC_DOCK_ROUTER, address(oracle), address(0), address(0))
        );
        vm.expectRevert(abi.encodeWithSelector(CovenantVaultFactory.NotFlapAddress.selector, other, BSC_DOCK_ROUTER));
        new CovenantVaultFactory(
            address(1), VaultEnv(BSC_PORTAL, E.guardian, other, address(oracle), address(0), address(0))
        );
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, other, E.guardian));
        new CovenantLauncherFactory(
            BSC_PORTAL, other, address(pairF.vaultFactory), E.identity, E.nameScreen, CovenantProfiles.production(), "x"
        );
        vm.expectRevert(abi.encodeWithSelector(CovenantLauncherFactory.NotFlapAddress.selector, other, E.nameScreen));
        new CovenantLauncherFactory(
            BSC_PORTAL, E.guardian, address(pairF.vaultFactory), E.identity, other, CovenantProfiles.production(), "x"
        );
        env; // the setUp pair was built from these same values and deployed
        assertEq(pairF.vaultFactory.guardian(), E.guardian);
        assertEq(pairF.launcherFactory.nameScreen(), E.nameScreen);
    }

    /// @dev NEW-1 (independent re-review) on the live pool: a holder sells in one block until the pool's spot BNB
    ///      reserve is under half the seed, the keeper's report and a reportless poke land, the holder buys back. The
    ///      oracle reads depth at the TWAP on the pool's invariant, so the report stays strict, its hour counts and
    ///      nothing is wiped.
    function test_fork_NEW1_aSameBlockSaleCannotWipeTheCounters() public {
        (CovenantVault v, address token) = _liveCovenant("fork-new1");
        _pumpTo(v, token, 250);
        for (uint256 i; i < 13; ++i) {
            vm.warp(block.timestamp + 1 hours);
            _poke(v, BNB_USD);
        }
        uint256 p0 = _progressOf(v);
        assertGe(p0, 12 hours);

        vm.warp(block.timestamp + 1 hours);
        uint256 b0 = alice.balance;
        uint256 t0 = IERC20(token).balanceOf(alice);
        for (uint256 i; i < 60; ++i) {
            (,,,, uint256 q) = oracle.preview(address(v));
            if (q * 2 < v.poolSeedQuote()) break;
            _sell(alice, token, t0 / 60);
        }
        (,,,, uint256 qNow) = oracle.preview(address(v));
        assertLt(qNow * 2, v.poolSeedQuote(), "spot reserve under half the seed");
        _barePoke(v); // a reportless poke inside the sandwich: nothing wiped
        assertEq(_progressOf(v), p0, "no reset");
        _poke(v, BNB_USD); // the keeper's report inside the sandwich
        assertTrue(v.lastStrict(), "still strict: depth at the TWAP");
        _buy(alice, token, alice.balance - b0);
        assertEq(_progressOf(v), p0 + 1 hours, "the hour counts; nothing wiped");
    }

    function _has(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool m = true;
            for (uint256 k; k < n.length; ++k) {
                if (h[i + k] != n[k]) {
                    m = false;
                    break;
                }
            }
            if (m) return true;
        }
        return false;
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
