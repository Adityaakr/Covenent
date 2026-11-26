// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";

import {LauncherFactoryBase} from "src/flap/LauncherFactoryBase.sol";
import {LauncherDataSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";

import {Terms, Profile} from "src/vault/CovenantTypes.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {IERC8004Identity} from "src/agent/IERC8004.sol";

interface IPairedVaultFactory {
    function launcherFactory() external view returns (address);
}

/// @title CovenantLauncherFactory
/// @notice Validates covenant terms and deploys one `CovenantLauncher` per raise. The Launcher half of a locked
///         Launcher + Vault pair: every Launcher it creates names the paired `CovenantVaultFactory`, and that
///         factory accepts launches only from Launchers this factory created.
///
///         `newLauncher(creator, abi.encode(Terms))` is Portal-only (`LauncherFactoryBase.onlyHub`). It rejects,
///         before deploying: non-canonical data, terms outside the design document's bounds (see
///         `CovenantTermsLib`), and an `agentId` the team wallet does not own in the ERC-8004 IdentityRegistry.
///
///         Two factories exist: the production one and a demo one with the same rules and bounds in minutes.
///         The difference is only the `Profile` given at construction. Upgrades: Guardian only, via the beacon.
contract CovenantLauncherFactory is LauncherFactoryBase {
    address public immutable hub;
    address public immutable guardian;
    address public immutable beacon;
    address public immutable pairedVaultFactory;
    /// @notice ERC-8004 IdentityRegistry. Zero disables agent-bound covenants (agentId must then be 0).
    address public immutable identityRegistry;

    Profile internal _profile;
    string public profileName;

    address[] internal _launchers;
    mapping(address launcher => bool) public isLauncher;

    error ZeroAddress();
    error NotPaired(address vaultFactory);
    error InvalidData();
    error AgentRegistryMissing();
    error AgentNotFound(uint256 agentId);
    error AgentNotOwnedByTeam(uint256 agentId, address owner, address teamWallet);

    event CovenantCreated(
        address indexed launcher, address indexed creator, address indexed teamWallet, uint256 agentId, bytes32 salt
    );
    event FlapLauncherImplementationUpgraded(address implementation);

    constructor(
        address hub_,
        address guardian_,
        address vaultFactory_,
        address identityRegistry_,
        Profile memory profile_,
        string memory profileName_
    ) {
        if (hub_ == address(0) || guardian_ == address(0) || vaultFactory_ == address(0)) revert ZeroAddress();
        if (IPairedVaultFactory(vaultFactory_).launcherFactory() != address(this)) revert NotPaired(vaultFactory_);
        hub = hub_;
        guardian = guardian_;
        pairedVaultFactory = vaultFactory_;
        identityRegistry = identityRegistry_;
        _profile = profile_;
        profileName = profileName_;
        beacon = address(new UpgradeableBeacon(address(this), address(new CovenantLauncher())));
    }

    function _getHub() internal view override returns (address) {
        return hub;
    }

    function _getGuardian() internal view override returns (address) {
        return guardian;
    }

    function profile() external view returns (Profile memory) {
        return _profile;
    }

    function launcherCount() external view returns (uint256) {
        return _launchers.length;
    }

    function launcherAt(uint256 i) external view returns (address) {
        return _launchers[i];
    }

    function allLaunchers() external view returns (address[] memory) {
        return _launchers;
    }

    /// @notice Reverts with the reason the terms would be refused, or returns quietly. For forms and agents.
    function checkTerms(Terms calldata t) external view {
        CovenantTermsLib.validate(t, _profile);
        _checkAgent(t);
    }

    function _newLauncher(address creator, bytes calldata data) internal override returns (address launcher) {
        // `abi.decode` ignores trailing bytes, so insist on the canonical encoding.
        Terms memory t = abi.decode(data, (Terms));
        if (keccak256(abi.encode(t)) != keccak256(data)) revert InvalidData();
        CovenantTermsLib.validate(t, _profile);
        _checkAgent(t);

        launcher = LibClone.deployDeterministicERC1967BeaconProxy(beacon, t.salt);
        CovenantLauncher(payable(launcher)).initialize{value: msg.value}(hub, creator, pairedVaultFactory, t, _profile);
        _launchers.push(launcher);
        isLauncher[launcher] = true;
        emit CovenantCreated(launcher, creator, t.teamWallet, t.agentId, t.salt);
    }

    /// @dev Agent layer: a covenant bound to an ERC-8004 agent requires the agent NFT to sit in the team wallet.
    function _checkAgent(Terms memory t) internal view {
        if (t.agentId == 0) return;
        address reg = identityRegistry;
        if (reg == address(0)) revert AgentRegistryMissing();
        address owner;
        try IERC8004Identity(reg).ownerOf(t.agentId) returns (address o) {
            owner = o;
        } catch {
            revert AgentNotFound(t.agentId);
        }
        if (owner != t.teamWallet) revert AgentNotOwnedByTeam(t.agentId, owner, t.teamWallet);
    }

    function upgradeVaultImplementation(address newImplementation) external override onlyGuardian {
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
        emit FlapLauncherImplementationUpgraded(newImplementation);
    }

    function beaconImplementation() external view returns (address) {
        return UpgradeableBeacon(beacon).implementation();
    }

    function launcherDataSchema() external pure override returns (LauncherDataSchema memory schema) {
        schema.description =
            "Covenant raise: abi.encode(Terms). A capped raise whose treasury sits in a vault with five rules: a capped dollar tap, team tranches that unlock at price multiples, a book-value exit for holders, an abandonment switch and disclosure. See docs/DESIGN.md.";
        FieldDescriptor[] memory f = new FieldDescriptor[](27);
        f[0] = FieldDescriptor("name", "string", "Token name (1-64 bytes)", 0);
        f[1] = FieldDescriptor("symbol", "string", "Token symbol (1-16 bytes)", 0);
        f[2] = FieldDescriptor("meta", "string", "Metadata URI", 0);
        f[3] = FieldDescriptor("salt", "bytes32", "Salt mined so the token address ends in 7777", 0);
        f[4] = FieldDescriptor("totalSupply", "uint256", "Total supply, a multiple of 10000", 18);
        f[5] = FieldDescriptor("saleBps", "uint16", "Sale share in bps (>= 4000)", 0);
        f[6] = FieldDescriptor("poolBps", "uint16", "Pool share in bps (500 to saleBps)", 0);
        f[7] = FieldDescriptor("trancheBps", "uint16[]", "Team tranche sizes in bps of supply", 0);
        f[8] = FieldDescriptor("trancheMultiple", "uint16[]", "Tranche price multiples, 200 = 2x the sale price", 0);
        f[9] = FieldDescriptor("minRaise", "uint256", "Minimum raise in BNB", 18);
        f[10] = FieldDescriptor("cap", "uint256", "Raise cap in BNB", 18);
        f[11] = FieldDescriptor("saleDuration", "uint32", "Sale window in seconds", 0);
        f[12] = FieldDescriptor("buyTaxBps", "uint16", "Buy tax in bps", 0);
        f[13] = FieldDescriptor("sellTaxBps", "uint16", "Sell tax in bps", 0);
        f[14] = FieldDescriptor("taxDuration", "uint32", "Tax duration in seconds", 0);
        f[15] = FieldDescriptor("teamWallet", "address", "Team wallet: receives the tap and unlocked tranches", 0);
        f[16] = FieldDescriptor("tapUsdPer30d", "uint256", "Team budget in USD per 30 days", 18);
        f[17] = FieldDescriptor("tapCapBps", "uint16", "Tap cap in bps of treasury per 30 days (<= 1000)", 0);
        f[18] = FieldDescriptor("cliff", "uint32", "Unlock cliff in seconds", 0);
        f[19] = FieldDescriptor("unlockWindow", "uint32", "Trusted time above a multiple to unlock, seconds", 0);
        f[20] = FieldDescriptor("exitStreak", "uint32", "Time below book that opens an exit round, seconds", 0);
        f[21] = FieldDescriptor("roundLength", "uint32", "Exit round length in seconds", 0);
        f[22] = FieldDescriptor("cooldown", "uint32", "Cooldown after a round in seconds", 0);
        f[23] = FieldDescriptor("exitFeeBps", "uint16", "Exit fee in bps (<= 300), kept by the treasury", 0);
        f[24] = FieldDescriptor("heartbeat", "uint32", "Silence that lets anyone declare abandonment, seconds", 0);
        f[25] = FieldDescriptor("agentId", "uint256", "ERC-8004 agent id owned by the team wallet, 0 for humans", 0);
        f[26] = FieldDescriptor("reportRelayer", "address", "Disclosure verdict relayer, zero disables rule 5", 0);
        schema.fields = f;
    }
}
