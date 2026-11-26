// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {Terms, State} from "src/vault/CovenantTypes.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";
import {MockPortal, MockTaxProcessor} from "src/mocks/MockFlap.sol";
import {MockV2Router, MockWBNB} from "src/mocks/MockV2.sol";
import {MockIdentityRegistry, MockReputationRegistry} from "src/mocks/MockERC8004.sol";

/// @notice The local stack every unit and invariant test starts from: Flap, PancakeSwap and ERC-8004 stand-ins,
///         the oracle with a dev Atlas signer, the production factory pair (enabled on the Portal) and a lens.
///         Accounts are plain numbered addresses, as Flap's test notes advise.
abstract contract CovenantTestBase is Test, StackBuilder {
    address internal admin = address(uint160(0xC0DE0100));
    address internal guardian = address(uint160(0xC0DE0101));
    address internal team = address(uint160(0xC0DE0102));
    address internal alice = address(uint160(0xC0DE0103));
    address internal bob = address(uint160(0xC0DE0104));
    address internal carol = address(uint160(0xC0DE0105));
    address internal whale = address(uint160(0xC0DE0106));
    address internal keeper = address(uint160(0xC0DE0107));
    address internal relayer = address(uint160(0xC0DE0108));
    address internal stranger = address(uint160(0xC0DE0109));

    uint256 internal atlasKey = 0xA71A5;
    address internal atlasSigner;

    uint256 internal constant BNB_USD = 600 ether;
    uint256 internal constant T0 = 1_800_000_000;

    Net internal chain;
    CovenantOracle internal oracle;
    Pair internal prod;
    CovenantLens internal lens;
    MockPortal internal portal;
    MockV2Router internal router;
    MockIdentityRegistry internal identity;
    MockReputationRegistry internal reputation;

    function setUp() public virtual {
        vm.warp(T0);
        atlasSigner = vm.addr(atlasKey);
        chain = _deployMockChain(admin, guardian, 1 ether);
        portal = MockPortal(chain.portal);
        router = MockV2Router(payable(chain.router));
        identity = MockIdentityRegistry(chain.identity);
        reputation = MockReputationRegistry(chain.reputation);
        oracle = _deployOracle(atlasSigner);
        prod = _deployPair(address(this), chain, address(oracle), CovenantProfiles.production(), "production");
        lens = _deployLens();
        vm.startPrank(admin);
        portal.setLauncherFactoryMultiplier(address(prod.launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(prod.vaultFactory), 10_000, true);
        vm.stopPrank();

        vm.deal(team, 100 ether);
        vm.deal(alice, 10_000 ether);
        vm.deal(bob, 10_000 ether);
        vm.deal(carol, 10_000 ether);
        vm.deal(whale, 10_000 ether);
        vm.deal(keeper, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    // ── covenant lifecycle helpers ─────────────────────────────────────────

    function _terms(bytes32 seed) internal returns (Terms memory) {
        return CovenantProfiles.defaultTerms("Covenant Test", "CVT", _mineSalt(chain.portal, chain.tokenImpl, seed), team);
    }

    function _create(Pair memory p, Terms memory t) internal returns (CovenantLauncher l) {
        uint256 fee = portal.SALT_LOCK_FEE();
        vm.startPrank(team);
        l = CovenantLauncher(payable(portal.newLauncher{value: fee}(address(p.launcherFactory), abi.encode(t))));
        vm.stopPrank();
    }

    function _contribute(CovenantLauncher l, address who, uint256 amount) internal {
        vm.startPrank(who);
        l.contribute{value: amount}();
        vm.stopPrank();
    }

    /// @dev The design doc's story: 1,400 BNB against a 500 BNB cap. Alice is the doc's 14 BNB buyer.
    function _raiseOversubscribed(CovenantLauncher l) internal {
        _contribute(l, alice, 14 ether);
        _contribute(l, bob, 386 ether);
        _contribute(l, carol, 400 ether);
        _contribute(l, whale, 600 ether);
    }

    function _finalize(CovenantLauncher l) internal {
        vm.warp(uint256(l.saleDeadline()));
        vm.startPrank(keeper);
        l.finalize();
        vm.stopPrank();
    }

    /// @dev Finalize, and if the Portal refused inside the retry window (L-5), retry once the window is over, which
    ///      settles the raise as FAILED for good.
    function _finalizeFinal(CovenantLauncher l) internal {
        _finalize(l);
        if (l.state() == State.RAISING) {
            vm.warp(l.launchRetryUntil());
            vm.startPrank(keeper);
            l.finalize();
            vm.stopPrank();
        }
    }

    /// @dev Create, raise 1,400 BNB, finalize. Returns the live vault.
    function _launchDefault(bytes32 seed) internal returns (CovenantLauncher l, CovenantVault v, IERC20 token) {
        l = _create(prod, _terms(seed));
        _raiseOversubscribed(l);
        _finalize(l);
        require(l.state() == State.ACTIVE, "launch failed");
        v = CovenantVault(payable(l.vault()));
        token = IERC20(l.token());
    }

    function _claimAll(CovenantLauncher l, CovenantVault v) internal {
        address[4] memory who = [alice, bob, carol, whale];
        for (uint256 i; i < 4; ++i) {
            vm.startPrank(who[i]);
            v.claimTokens();
            if (l.refundOf(who[i]) > 0) l.claimRefund();
            vm.stopPrank();
        }
    }

    // ── oracle helpers ─────────────────────────────────────────────────────

    /// @dev Poke with a fresh signed BNB/USD report (price > 0) or without one (price == 0). Bubbles reverts.
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

    /// @dev Advance `dt` and poke.
    function _step(CovenantVault v, uint256 dt, uint256 price) internal {
        vm.warp(block.timestamp + dt);
        _poke(v, price);
    }

    // ── market helpers ─────────────────────────────────────────────────────

    function _buy(IERC20 token, address who, uint256 bnb) internal {
        address[] memory path = new address[](2);
        path[0] = chain.wbnb;
        path[1] = address(token);
        vm.startPrank(who);
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnb}(0, path, who, block.timestamp);
        vm.stopPrank();
    }

    function _sell(IERC20 token, address who, uint256 amount) internal {
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = chain.wbnb;
        vm.startPrank(who);
        token.approve(address(router), amount);
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(amount, 0, path, who, block.timestamp);
        vm.stopPrank();
    }

    function _dispatch(IERC20 token) internal {
        MockTaxProcessor(payable(portal.taxProcessorOf(address(token)))).dispatch();
    }

    function _spot(CovenantVault v) internal view returns (uint256 s) {
        (, s,,,) = oracle.preview(address(v));
    }
}
