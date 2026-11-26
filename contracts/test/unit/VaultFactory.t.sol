// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {Terms, State, Observation} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantVaultFactory} from "src/vault/CovenantVaultFactory.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {IPortalTypes} from "src/flap/IPortal.sol";
import {Distribution, DistributionTarget} from "src/flap/Distribution.sol";
import {DirectLaunchVaultFactoryBase} from "src/flap/DirectLaunchVaultFactoryBase.sol";
import {DirectLaunchVaultBase} from "src/flap/DirectLaunchVaultBase.sol";
import {VaultUISchema} from "src/flap/IVaultSchemas.sol";

contract CovenantVaultV2 is CovenantVault {
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }
}

contract CovenantLauncherV2 is CovenantLauncher {
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }
}

/// @notice Flap's nine pre-audit scenarios for a vault test suite, adopted as written, plus the pair checks.
contract VaultFactoryTest is CovenantTestBase {
    // 1. Hub creates the vault: at the expected address, initialized with the right token, launcher and terms.
    function test_1_hubCreatesTheVault_atTheExpectedAddress() public {
        (CovenantLauncher l, CovenantVault v, IERC20 token) = _launchDefault("s1");
        assertEq(address(v), prod.vaultFactory.predictVault(address(token)), "deterministic, keyed by token");
        (address pv, address pvf) = portal.getLaunchVault(address(token));
        assertEq(pv, address(v));
        assertEq(pvf, address(prod.vaultFactory));
        assertEq(v.taxToken(), address(token));
        assertEq(v.launcher(), address(l));
        assertEq(v.teamWallet(), team);
        assertEq(v.tapCapBps(), 400);
        assertEq(v.exitStreakNeeded(), 3 days);
        assertEq(v.trancheCount(), 3);
        assertEq(uint8(v.state()), uint8(State.ACTIVE));
        assertEq(prod.vaultFactory.vaultCount(), 1);
        assertEq(prod.vaultFactory.launcherOf(address(v)), address(l));
        assertEq(prod.vaultFactory.factorySpecVersion(), "pl-v1");
        assertEq(prod.launcherFactory.factorySpecVersion(), "lf-v1");
        assertTrue(prod.vaultFactory.isQuoteTokenSupported(address(0)));
        assertFalse(prod.vaultFactory.isQuoteTokenSupported(chain.wbnb));
    }

    // 2. A non-Hub caller reverts.
    function test_2_nonHub_reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DirectLaunchVaultFactoryBase.NotHub.selector, stranger));
        prod.vaultFactory.newVault(address(1), address(2), 0, "");
    }

    // 3. Bad input reverts before deployment.
    function test_3_badInput_revertsBeforeDeploying() public {
        CovenantLauncher l = _create(prod, _terms("s3"));
        address token = portal.predictToken(l.terms().salt);
        address predicted = prod.vaultFactory.predictVault(token);

        (IPortalTypes.CreateTaxTokenParams memory p, Distribution memory d) = _shape(l);

        // unsupported launch kind
        _expectNewVaultRevert(
            token, address(l), 1, abi.encode(p, d), abi.encodeWithSelector(DirectLaunchVaultFactoryBase.UnsupportedLaunchKind.selector, 1)
        );
        // unsupported quote
        p.quoteToken = chain.wbnb;
        _expectNewVaultRevert(
            token,
            address(l),
            0,
            abi.encode(p, d),
            abi.encodeWithSelector(DirectLaunchVaultFactoryBase.UnsupportedQuoteToken.selector, chain.wbnb)
        );
        p.quoteToken = address(0);
        // a caller the Portal never recorded as our launcher
        _expectNewVaultRevert(
            token,
            stranger,
            0,
            abi.encode(p, d),
            abi.encodeWithSelector(CovenantVaultFactory.NotFromLauncherFactory.selector, stranger)
        );
        // the launcher is not mid-launch
        _expectNewVaultRevert(
            token,
            address(l),
            0,
            abi.encode(p, d),
            abi.encodeWithSelector(CovenantVaultFactory.LauncherNotLaunching.selector, address(l))
        );
        // vaultData naming someone else, and vaultData with trailing bytes
        p.feeConfigs[0].configData = abi.encode(
            IPortalTypes.FeeConfigVault({vaultFactory: address(prod.vaultFactory), vaultData: abi.encode(stranger)})
        );
        _expectNewVaultRevert(
            token,
            address(l),
            0,
            abi.encode(p, d),
            abi.encodeWithSelector(CovenantVaultFactory.VaultDataLauncherMismatch.selector, address(l), stranger)
        );
        p.feeConfigs[0].configData = abi.encode(
            IPortalTypes.FeeConfigVault({
                vaultFactory: address(prod.vaultFactory), vaultData: abi.encode(address(l), uint256(1))
            })
        );
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(DirectLaunchVaultFactoryBase.InvalidVaultData.selector)
        );

        // With the launcher pretending to be mid-launch, a launch that does not match its terms is refused.
        (p, d) = _shape(l);
        vm.mockCall(address(l), abi.encodeWithSignature("launching()"), abi.encode(true));
        vm.mockCall(address(l), abi.encodeWithSignature("poolQuote()"), abi.encode(p.poolQuote));
        p.poolToken += 1;
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(CovenantVaultFactory.LaunchParamsMismatch.selector, 2)
        );
        (p, d) = _shape(l);
        p.buyTaxRate = 500;
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(CovenantVaultFactory.LaunchParamsMismatch.selector, 4)
        );
        (p, d) = _shape(l);
        d.amount -= 1;
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(CovenantVaultFactory.DistributionMismatch.selector)
        );
        (p, d) = _shape(l);
        d.target = DistributionTarget.EXPLICIT;
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(CovenantVaultFactory.DistributionMismatch.selector)
        );
        (p, d) = _shape(l);
        p.feeConfigs[0].bps = 9_000;
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(CovenantVaultFactory.FeeSlotsMismatch.selector)
        );
        (p, d) = _shape(l);
        p.creatorBuyQuote = 1;
        _expectNewVaultRevert(
            token, address(l), 0, abi.encode(p, d), abi.encodeWithSelector(CovenantVaultFactory.LaunchParamsMismatch.selector, 6)
        );

        assertEq(predicted.code.length, 0, "nothing was deployed");
        assertEq(prod.vaultFactory.vaultCount(), 0);
    }

    // 4. Native revenue arriving through receive() is credited.
    function test_4_nativeRevenue_isCredited() public {
        (, CovenantVault v,) = _launchDefault("s4");
        uint256 book0 = v.bookValue();
        vm.deal(address(this), 10 ether);
        (bool ok,) = address(v).call{value: 2 ether}("");
        assertTrue(ok);
        assertEq(v.totalRevenue(), 2 ether);
        assertEq(v.accounted(), address(v).balance);
        assertGt(v.bookValue(), book0, "tax raises book value");
    }

    // 5. A zero-value ping, a spurious second ping and a sync credit nothing twice.
    function test_5_spuriousPings_creditOnce() public {
        (, CovenantVault v,) = _launchDefault("s5");
        vm.deal(address(this), 10 ether);
        (bool ok,) = address(v).call{value: 1 ether}("");
        assertTrue(ok);
        (ok,) = address(v).call{value: 0}("");
        assertTrue(ok);
        (ok,) = address(v).call{value: 0}("");
        assertTrue(ok);
        v.sync();
        v.sync();
        assertEq(v.totalRevenue(), 1 ether, "credited once");

        // BNB forced in without a call is recognized on the next sync, once.
        vm.deal(address(v), address(v).balance + 3 ether);
        v.sync();
        v.sync();
        assertEq(v.totalRevenue(), 4 ether);
    }

    // 6. Every outflow decrements the baseline; no double counting.
    function test_6_everyOutflow_decrementsTheBaseline() public {
        (CovenantLauncher l, CovenantVault v, IERC20 token) = _launchDefault("s6");
        _claimAll(l, v);
        _poke(v, BNB_USD);
        _step(v, 6 hours, BNB_USD);
        uint256 rev0 = v.totalRevenue();

        vm.prank(team);
        v.claimTap();
        assertEq(v.accounted(), address(v).balance, "tap outflow decremented");

        _openRound(v, token);
        vm.startPrank(alice);
        token.approve(address(v), type(uint256).max);
        v.redeem(1_000_000 ether, 0);
        vm.stopPrank();
        assertEq(v.accounted(), address(v).balance, "redemption outflow decremented");
        v.sync();
        assertEq(v.totalRevenue(), rev0, "no outflow ever looks like revenue");
    }

    // 7. The core action and its gating.
    function test_7_coreActionsAreGated() public {
        (CovenantLauncher l, CovenantVault v, IERC20 token) = _launchDefault("s7");
        _claimAll(l, v);
        vm.startPrank(alice);
        token.approve(address(v), type(uint256).max);
        vm.expectRevert(CovenantVault.NotRedeemable.selector);
        v.redeem(1 ether, 0);
        vm.expectRevert(CovenantVault.NothingToClaim.selector);
        v.claimTokens(); // once only
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(CovenantVault.NotTeam.selector);
        v.claimTap();
        vm.prank(stranger);
        vm.expectRevert(CovenantVault.NotTeam.selector);
        v.windDown();
        vm.prank(stranger);
        vm.expectRevert(CovenantVault.NotOracle.selector);
        v.onObservation(_emptyObservation());
        vm.prank(stranger);
        vm.expectRevert(CovenantVault.NotLauncher.selector);
        v.fundTreasury(address(1));
        vm.prank(stranger);
        vm.expectRevert(CovenantVault.NotRelayer.selector);
        v.recordVerdict(0, false, 0);
    }

    // 8. Only the Guardian upgrades, and state survives the upgrade.
    function test_8_onlyGuardianUpgrades_statePreserved() public {
        (CovenantLauncher l, CovenantVault v,) = _launchDefault("s8");
        _poke(v, BNB_USD);
        _step(v, 6 hours, BNB_USD);
        uint256 book = v.bookValue();
        uint256 owed = v.owedTeam();
        uint256 raised = v.treasuryRaised();
        assertEq(v.version(), "1.0.0");

        CovenantVaultV2 impl = new CovenantVaultV2();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DirectLaunchVaultFactoryBase.NotGuardian.selector, stranger));
        prod.vaultFactory.upgradeVaultImplementation(address(impl));
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(DirectLaunchVaultFactoryBase.NotGuardian.selector, team));
        prod.vaultFactory.upgradeVaultImplementation(address(impl));

        vm.prank(guardian);
        prod.vaultFactory.upgradeVaultImplementation(address(impl));
        assertEq(v.version(), "2.0.0");
        assertEq(v.bookValue(), book);
        assertEq(v.owedTeam(), owed);
        assertEq(v.treasuryRaised(), raised);
        assertEq(v.teamWallet(), team);

        CovenantLauncherV2 limpl = new CovenantLauncherV2();
        vm.prank(stranger);
        vm.expectRevert();
        prod.launcherFactory.upgradeVaultImplementation(address(limpl));
        vm.prank(guardian);
        prod.launcherFactory.upgradeVaultImplementation(address(limpl));
        assertEq(l.version(), "2.0.0");
        assertEq(l.accepted(), 500 ether);
    }

    // 9. The reserve hand-off is Hub-only and exact.
    function test_9_reserveHandOff_isHubOnlyAndExact() public {
        (, CovenantVault v, IERC20 token) = _launchDefault("s9");
        assertTrue(v.distributionInitialized());
        assertEq(token.balanceOf(address(v)), 0, "the vault holds nothing itself");
        assertEq(token.balanceOf(chain.dockRouter), v.saleAmount() + v.teamAmount(), "all of A + E is docked");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DirectLaunchVaultBase.NotHub.selector, stranger));
        v.initializeDistribution(address(token), 1, "", 0);

        uint256 reserved = v.saleAmount() + v.teamAmount();
        vm.prank(address(portal));
        vm.expectRevert(CovenantVault.AlreadyDistributed.selector);
        v.initializeDistribution(address(token), reserved, "", 0);
    }

    function test_vaultUISchema_and_description() public {
        (, CovenantVault v,) = _launchDefault("schema");
        VaultUISchema memory s = v.vaultUISchema();
        assertEq(s.vaultType, "CovenantVault");
        assertEq(s.methods.length, 10);
        assertEq(s.methods[6].name, "redeem");
        assertEq(s.methods[6].approvals[0].tokenType, "taxToken");
        string memory d = v.description();
        emit log_string(d);
        assertGt(bytes(d).length, 200);
        assertEq(prod.vaultFactory.tokenCreationPolicies().length, 3);
        assertEq(prod.vaultFactory.vaultDataSchema().fields.length, 1);
        assertEq(prod.launcherFactory.launcherDataSchema().fields.length, 27);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    function _shape(CovenantLauncher l)
        internal
        view
        returns (IPortalTypes.CreateTaxTokenParams memory p, Distribution memory d)
    {
        Terms memory t = l.terms();
        p.name = t.name;
        p.symbol = t.symbol;
        p.totalSupply = t.totalSupply;
        p.salt = t.salt;
        p.poolQuote = 125 ether;
        p.poolToken = l.poolAmount();
        p.buyTaxRate = t.buyTaxBps;
        p.sellTaxRate = t.sellTaxBps;
        p.taxDuration = t.taxDuration;
        p.feeConfigs = new IPortalTypes.FeeConfig[](1);
        p.feeConfigs[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 10_000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({vaultFactory: address(prod.vaultFactory), vaultData: abi.encode(address(l))})
            )
        });
        d = Distribution({
            target: DistributionTarget.VAULT,
            strategy: address(0),
            amount: uint128(l.saleAmount() + l.teamAmount()),
            configData: ""
        });
    }

    function _expectNewVaultRevert(
        address token,
        address creator,
        uint8 kind,
        bytes memory params,
        bytes memory err
    ) internal {
        vm.prank(address(portal));
        vm.expectRevert(err);
        prod.vaultFactory.newVault(token, creator, kind, params);
    }

    function _openRound(CovenantVault v, IERC20 token) internal {
        vm.warp(block.timestamp + 601);
        _sell(token, whale, token.balanceOf(whale));
        for (uint256 i; i < 14 && v.state() != State.EXIT_ROUND; ++i) {
            _step(v, 6 hours, BNB_USD);
        }
        require(v.state() == State.EXIT_ROUND, "round did not open");
    }

    function _emptyObservation() internal pure returns (Observation memory o) {}
}

