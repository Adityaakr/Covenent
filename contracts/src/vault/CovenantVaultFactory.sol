// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";

import {IPortalTypes, IPortal} from "src/flap/IPortal.sol";
import {DirectLaunchVaultFactoryBase} from "src/flap/DirectLaunchVaultFactoryBase.sol";
import {Distribution, DistributionTarget} from "src/flap/Distribution.sol";
import {VaultDataSchema, FieldDescriptor, FactoryPolicy} from "src/flap/IVaultSchemas.sol";

import {Terms, VaultEnv, ICovenantLauncher} from "src/vault/CovenantTypes.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";

/// @title CovenantVaultFactory
/// @notice The Vault half of the covenant pair. Accepts only launches from Launchers its paired
///         `CovenantLauncherFactory` created, with exactly the shape their terms imply, and deploys one
///         `CovenantVault` beacon proxy per token.
///
///         `newVault` is Portal-only and reverts before deploying unless all of these hold:
///           1. Flap's common checks (`_validateLaunch`): one VAULT slot naming this factory, non-zero bps,
///              supported quote (native BNB only);
///           2. `Portal.getLauncher(creator).launcherFactory` is our launcher factory: a stranger contract cannot
///              pose as a launcher;
///           3. `vaultData` is exactly `abi.encode(address launcher)` and names the caller;
///           4. the launcher is mid-launch (`launching()`), and the launch parameters equal what its terms imply:
///              supply, salt, pool tokens, pool BNB, tax rates and duration, no creator buy;
///           5. quote is native BNB and the single fee slot is VAULT at 10000 bps;
///           6. `distribution.target == VAULT`, `amount == A + E` and `poolToken + amount == totalSupply`.
///         Upgrades: Guardian only, through the beacon. No other privileged function.
contract CovenantVaultFactory is DirectLaunchVaultFactoryBase {
    address public immutable beacon;
    address public immutable launcherFactory;

    address public immutable hub;
    address public immutable guardian;
    address public immutable dockRouter;
    address public immutable oracle;
    address public immutable reputationRegistry;
    address public immutable identityRegistry;

    address[] internal _vaults;
    mapping(address vault => address launcher) public launcherOf;

    error NotFromLauncherFactory(address launcher);
    error VaultDataLauncherMismatch(address expected, address got);
    error LauncherNotLaunching(address launcher);
    error NativeQuoteOnly(address quoteToken);
    error FeeSlotsMismatch();
    error LaunchParamsMismatch(uint256 field);
    error DistributionMismatch();

    event FlapVaultImplementationUpgraded(address implementation);
    event CovenantVaultCreated(address indexed vault, address indexed token, address indexed launcher);

    constructor(address launcherFactory_, VaultEnv memory env_) {
        if (launcherFactory_ == address(0) || env_.hub == address(0) || env_.guardian == address(0)) {
            revert ZeroAddress();
        }
        if (env_.dockRouter == address(0) || env_.oracle == address(0)) revert ZeroAddress();
        launcherFactory = launcherFactory_;
        hub = env_.hub;
        guardian = env_.guardian;
        dockRouter = env_.dockRouter;
        oracle = env_.oracle;
        reputationRegistry = env_.reputation;
        identityRegistry = env_.identity;
        beacon = address(new UpgradeableBeacon(address(this), address(new CovenantVault())));
    }

    function _getHub() internal view override returns (address) {
        return hub;
    }

    function _getGuardian() internal view override returns (address) {
        return guardian;
    }

    function env() public view returns (VaultEnv memory e) {
        e.hub = hub;
        e.guardian = guardian;
        e.dockRouter = dockRouter;
        e.oracle = oracle;
        e.reputation = reputationRegistry;
        e.identity = identityRegistry;
    }

    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    function vaultAt(uint256 i) external view returns (address) {
        return _vaults[i];
    }

    function allVaults() external view returns (address[] memory) {
        return _vaults;
    }

    /// @notice The vault address `token` gets (deterministic, keyed by the token).
    function predictVault(address token) external view returns (address) {
        return LibClone.predictDeterministicAddressERC1967BeaconProxy(
            beacon, bytes32(uint256(uint160(token))), address(this)
        );
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function newVault(address token, address creator, uint8 launchKind, bytes calldata launchParams)
        external
        override
        onlyHub
        returns (address vault)
    {
        (IPortalTypes.CreateTaxTokenParams memory p, Distribution memory d, bytes memory vaultData) =
            _validateLaunch(token, creator, launchKind, launchParams);

        // 2.
        if (IPortal(hub).getLauncher(creator).launcherFactory != launcherFactory) {
            revert NotFromLauncherFactory(creator);
        }
        // 3.
        if (vaultData.length != 32) revert InvalidVaultData();
        address named = abi.decode(vaultData, (address));
        if (named != creator) revert VaultDataLauncherMismatch(creator, named);
        // 4.
        ICovenantLauncher l = ICovenantLauncher(creator);
        if (!l.launching()) revert LauncherNotLaunching(creator);
        _checkShape(p, d, l);

        vault = LibClone.deployDeterministicERC1967BeaconProxy(beacon, bytes32(uint256(uint160(token))));
        CovenantVault(payable(vault)).initialize(token, creator, env());
        _vaults.push(vault);
        launcherOf[vault] = creator;
        emit CovenantVaultCreated(vault, token, creator);
    }

    function _checkShape(IPortalTypes.CreateTaxTokenParams memory p, Distribution memory d, ICovenantLauncher l)
        internal
        view
    {
        Terms memory t = l.terms();
        // 5.
        if (p.quoteToken != address(0)) revert NativeQuoteOnly(p.quoteToken);
        if (p.feeConfigs.length != 1 || p.feeConfigs[0].bps != 10_000) revert FeeSlotsMismatch();
        // 4.
        if (p.totalSupply != t.totalSupply) revert LaunchParamsMismatch(0);
        if (p.salt != t.salt) revert LaunchParamsMismatch(1);
        if (p.poolToken != l.poolAmount()) revert LaunchParamsMismatch(2);
        if (p.poolQuote != l.poolQuote() || p.poolQuote == 0) revert LaunchParamsMismatch(3);
        if (p.buyTaxRate != t.buyTaxBps || p.sellTaxRate != t.sellTaxBps) revert LaunchParamsMismatch(4);
        if (p.taxDuration != t.taxDuration) revert LaunchParamsMismatch(5);
        if (p.creatorBuyQuote != 0) revert LaunchParamsMismatch(6);
        // 6.
        uint256 reserved = l.saleAmount() + l.teamAmount();
        if (d.target != DistributionTarget.VAULT || d.amount != reserved || p.poolToken + d.amount != p.totalSupply) {
            revert DistributionMismatch();
        }
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function isQuoteTokenSupported(address quoteToken) public pure override returns (bool) {
        return quoteToken == address(0);
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function vaultDataSchema() public pure override returns (VaultDataSchema memory schema) {
        schema.description =
            "Covenant vault: holds the raise treasury and the reserved sale and team tokens of a Covenant launch. Set by the CovenantLauncher, not by hand.";
        schema.fields = new FieldDescriptor[](1);
        schema.fields[0] = FieldDescriptor("launcher", "address", "The CovenantLauncher that is launching", 0);
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function tokenCreationPolicies() public pure override returns (FactoryPolicy[] memory policies) {
        policies = new FactoryPolicy[](3);
        policies[0] = FactoryPolicy({
            target: "quoteToken", operator: "eq", value: abi.encode(address(0)), description: "Native BNB quote only."
        });
        policies[1] = FactoryPolicy({
            target: "vaultSlotBps",
            operator: "eq",
            value: abi.encode(uint256(10_000)),
            description: "One fee slot: VAULT at 100% of the tax."
        });
        policies[2] = FactoryPolicy({
            target: "distribution.target",
            operator: "eq",
            value: abi.encode(uint8(DistributionTarget.VAULT)),
            description: "Sale and team tokens are handed to the vault."
        });
    }

    function upgradeVaultImplementation(address newImplementation) external override onlyGuardian {
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
        emit FlapVaultImplementationUpgraded(newImplementation);
    }

    function beaconImplementation() external view returns (address) {
        return UpgradeableBeacon(beacon).implementation();
    }
}
