// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {Terms, State} from "src/vault/CovenantTypes.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantVaultFactory} from "src/vault/CovenantVaultFactory.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
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
        IRouterLike(E.router).swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount, 0, path, who, block.timestamp + 600
        );
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
        uint256 g0 = gasleft();
        vm.prank(keeper);
        j.l.finalize();
        emit log_named_uint("finalize gas on the live Portal", g0 - gasleft());
        assertEq(uint8(j.l.state()), uint8(State.ACTIVE), "launched through Flap");

        j.token = j.l.token();
        j.v = CovenantVault(payable(j.l.vault()));
        (address pv, address pvf) = portal.getLaunchVault(j.token);
        assertEq(pv, address(j.v));
        assertEq(pvf, address(pairF.vaultFactory));
        assertEq(uint16(uint160(j.token)), 0x7777, "vanity address");
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
        IForwardVaultLike(fv).initialize(
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
    }
}
