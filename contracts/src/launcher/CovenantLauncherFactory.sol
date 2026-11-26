// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";

import {LauncherFactoryBase} from "src/flap/LauncherFactoryBase.sol";
import {LauncherDataSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";
import {IPortalTypes} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";

import {Terms, Profile} from "src/vault/CovenantTypes.sol";
import {CovenantTermsLib} from "src/launcher/CovenantTermsLib.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {IFlapLaunchFloor, IFlapNameScreen, FlapChain} from "src/launcher/IFlapPreflight.sol";
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
///         before deploying, everything Flap's launch would refuse later, so no raise opens that cannot launch:
///           - non-canonical data and terms outside the design document's bounds (`CovenantTermsLib`), including
///             Flap's tax rules: the higher of the two rates at least 1% (at most 10%), and a tax duration of at
///             least the profile's `antiFarmerDuration`;
///           - a name or symbol on Flap's blocklist: `isScamWord(name, symbol)` on Flap's anti-scam module, the one
///             the launch facet calls. On Flap's chains the module is fixed (`FlapChain.nameScreen`) and a screen
///             that does not answer refuses creation too;
///           - a minimum raise whose pool seed misses Flap's floor with a safety margin: the seed less
///             `FLOOR_MARGIN_BPS` must still meet the floor in `graduationFloorV2(...)`, read live with the Portal's BNB
///             price and our vault factory's multiplier. The production profile needs the graduation floor
///             (`meetsFloor`, twice the creation floor; the token is marked graduated at launch), the demo profile the
///             creation floor (`meetsCreateFloor`; a demo token launches, it may not graduate). The Portal reads its
///             price and the multiplier again at finalize, so the margin absorbs a one-third fall in its BNB price (or
///             a 1.5x higher multiplier) during the sale;
///           - an `agentId` the team wallet does not own in the ERC-8004 IdentityRegistry.
///         The Portal checks the floor and the names again at launch; a launch it refuses ends FAILED with every
///         commitment refundable.
///
///         On BNB Chain and BNB testnet the Portal, the Guardian and the name screen given at construction must be
///         Flap's own (`LaunchVaultAddresses`, `FlapChain`), so a deployment cannot name others.
///
///         Two factories exist: the production one and a demo one with the same rules and bounds in minutes.
///         The difference is only the `Profile` given at construction. Upgrades: Guardian only, via the beacon.
contract CovenantLauncherFactory is LauncherFactoryBase {
    /// @notice The safety margin on Flap's floor, bps of the floor: the minimum raise's pool seed must be at least 1.5x
    ///         the floor the Portal reports at creation (graduation floor in production, creation floor in the demo).
    uint256 public constant FLOOR_MARGIN_BPS = 15_000;

    address public immutable hub;
    address public immutable guardian;
    address public immutable beacon;
    address public immutable pairedVaultFactory;
    /// @notice ERC-8004 IdentityRegistry. Zero disables agent-bound covenants (agentId must then be 0).
    address public immutable identityRegistry;
    /// @notice Flap's name and symbol blocklist (`IFlapNameScreen`), the contract the Portal's launch facet calls.
    ///         The Portal does not expose its address, so it is fixed per chain (`FlapChain.nameScreen`, checked at
    ///         construction). Zero skips the pre-screen, on local chains only.
    address public immutable nameScreen;

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
    error NoCode(address account);
    error NameOrSymbolBlocked(string word);
    /// @dev Flap's name screen reverted: creation is refused, since the Portal's launch would call it too.
    error NameScreenUnavailable();
    /// @dev On BNB Chain or BNB testnet, `given` is not Flap's address for that role.
    error NotFlapAddress(address given, address expected);
    error QuoteNotEnabled();
    /// @dev The minimum raise seeds `seed` BNB; Flap's floor (graduation or creation, per `graduation`) with the safety
    ///      margin needs `minSeed`, which takes a minimum raise of `minRaise` at these sale and pool shares.
    error PoolSeedBelowFlapFloor(uint256 seed, uint256 minSeed, uint256 minRaise, bool graduation);

    event CovenantCreated(
        address indexed launcher, address indexed creator, address indexed teamWallet, uint256 agentId, bytes32 salt
    );
    event FlapLauncherImplementationUpgraded(address implementation);

    constructor(
        address hub_,
        address guardian_,
        address vaultFactory_,
        address identityRegistry_,
        address nameScreen_,
        Profile memory profile_,
        string memory profileName_
    ) {
        if (hub_ == address(0) || guardian_ == address(0) || vaultFactory_ == address(0)) {
            revert ZeroAddress();
        }
        // On Flap's chains every Flap address is Flap's own, never a deployer's choice.
        if (FlapChain.isFlapChain()) {
            _expect(hub_, LaunchVaultAddresses.hub());
            _expect(guardian_, LaunchVaultAddresses.guardian());
            _expect(nameScreen_, FlapChain.nameScreen());
        }
        if (IPairedVaultFactory(vaultFactory_).launcherFactory() != address(this)) revert NotPaired(vaultFactory_);
        if (nameScreen_ != address(0) && nameScreen_.code.length == 0) revert NoCode(nameScreen_);
        hub = hub_;
        guardian = guardian_;
        pairedVaultFactory = vaultFactory_;
        identityRegistry = identityRegistry_;
        nameScreen = nameScreen_;
        _profile = profile_;
        profileName = profileName_;
        beacon = address(new UpgradeableBeacon(address(this), address(new CovenantLauncher())));
    }

    function _expect(address given, address expected) private pure {
        if (given != expected) revert NotFlapAddress(given, expected);
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

    /// @param i index into the creation order
    /// @return the launcher
    function launcherAt(uint256 i) external view returns (address) {
        return _launchers[i];
    }

    function allLaunchers() external view returns (address[] memory) {
        return _launchers;
    }

    /// @notice Reverts with the reason the terms would be refused, or returns quietly. For forms and agents. Runs
    ///         every check `newLauncher` runs, including Flap's name screen and liquidity floor.
    /// @param t the terms to check (units in `Terms`); reverts with the factory's reason if refused
    function checkTerms(Terms calldata t) external view {
        _check(t);
    }

    /// @notice The smallest minimum raise this factory accepts for a split, from Flap's live floor: the pool seed
    ///         `minRaise * poolBps / saleBps` must reach `minSeed`, the BNB worth `floorUsd` x `marginBps` / 10000 at
    ///         Flap's `quotePriceUsd`. `graduation` says which floor this factory's profile applies.
    /// @param totalSupply S, tokens with 18 decimals
    /// @param saleBps A / S in bps
    /// @param poolBps P / S in bps
    /// @return minRaise the smallest accepted minimum raise, BNB in wei
    /// @return minSeed the pool seed that takes, BNB in wei
    /// @return floorUsd Flap's floor for this split, USD 1e18, before the margin
    /// @return quotePriceUsd the Portal's BNB price, USD 1e18
    /// @return graduation true when this profile needs the graduation floor (production), false the creation floor
    /// @return marginBps the safety margin on the floor, bps (`FLOOR_MARGIN_BPS`)
    function minRaiseFor(uint256 totalSupply, uint16 saleBps, uint16 poolBps)
        external
        view
        returns (
            uint256 minRaise,
            uint256 minSeed,
            uint256 floorUsd,
            uint256 quotePriceUsd,
            bool graduation,
            uint256 marginBps
        )
    {
        if (saleBps == 0 || poolBps == 0) revert InvalidData();
        IFlapLaunchFloor.GraduationFloorResultV2 memory r;
        (r, quotePriceUsd) = _floor(0, totalSupply * poolBps / CovenantTermsLib.BPS, totalSupply);
        graduation = _profile.requireGraduation;
        marginBps = FLOOR_MARGIN_BPS;
        floorUsd = graduation ? r.floorUsdWad : r.createFloorUsdWad;
        minSeed = _minSeed(floorUsd, quotePriceUsd);
        minRaise = _divUp(minSeed * saleBps, poolBps);
    }

    function _newLauncher(address creator, bytes calldata data) internal override returns (address launcher) {
        // `abi.decode` ignores trailing bytes, so insist on the canonical encoding.
        Terms memory t = abi.decode(data, (Terms));
        if (keccak256(abi.encode(t)) != keccak256(data)) revert InvalidData();
        _check(t);

        launcher = LibClone.deployDeterministicERC1967BeaconProxy(beacon, t.salt);
        CovenantLauncher(payable(launcher)).initialize{value: msg.value}(hub, creator, pairedVaultFactory, t, _profile);
        _launchers.push(launcher);
        isLauncher[launcher] = true;
        emit CovenantCreated(launcher, creator, t.teamWallet, t.agentId, t.salt);
    }

    function _check(Terms memory t) internal view {
        CovenantTermsLib.validate(t, _profile);
        _checkName(t);
        _checkFloor(t);
        _checkAgent(t);
    }

    /// @dev Flap refuses a launch whose name or symbol is on its blocklist (`BlacklistedNameOrSymbol`), so refuse the
    ///      raise now rather than at finalize. A screen that does not answer refuses creation as well: the Portal's
    ///      launch calls the same module, so a raise opened past it might never launch.
    function _checkName(Terms memory t) internal view {
        address screen = nameScreen;
        if (screen == address(0)) return; // local chains only (never on BNB Chain or BNB testnet, see constructor)
        bool nameBlocked;
        bool symbolBlocked;
        try IFlapNameScreen(screen).isScamWord(t.name, t.symbol) returns (bool n, bool s) {
            (nameBlocked, symbolBlocked) = (n, s);
        } catch {
            revert NameScreenUnavailable();
        }
        if (nameBlocked) revert NameOrSymbolBlocked(t.name);
        if (symbolBlocked) revert NameOrSymbolBlocked(t.symbol);
    }

    /// @dev The pool seed of the smallest raise that can settle, `minRaise * P / A`, less the safety margin, must
    ///      meet Flap's floor for this split as the Portal itself judges it (`meetsFloor` in production,
    ///      `meetsCreateFloor` in the demo), read live with Flap's BNB price and our vault factory's multiplier. A
    ///      larger raise only adds seed.
    function _checkFloor(Terms memory t) internal view {
        uint256 seed = t.minRaise * t.poolBps / t.saleBps;
        (IFlapLaunchFloor.GraduationFloorResultV2 memory r, uint256 price) = _floor(
            seed * CovenantTermsLib.BPS / FLOOR_MARGIN_BPS,
            t.totalSupply * t.poolBps / CovenantTermsLib.BPS,
            t.totalSupply
        );
        bool graduation = _profile.requireGraduation;
        if (graduation ? r.meetsFloor : r.meetsCreateFloor) return;
        uint256 minSeed = _minSeed(graduation ? r.floorUsdWad : r.createFloorUsdWad, price);
        revert PoolSeedBelowFlapFloor(seed, minSeed, _divUp(minSeed * t.saleBps, t.poolBps), graduation);
    }

    /// @dev The smallest seed s whose margin-less part q = floor(s * 10000 / FLOOR_MARGIN_BPS) meets the floor the way
    ///      the Portal compares it (q * price / 1e18 >= floorUsd): q >= ceil(floorUsd * 1e18 / price).
    function _minSeed(uint256 floorUsd, uint256 price) internal pure returns (uint256) {
        return _divUp(_divUp(floorUsd * 1e18, price) * FLOOR_MARGIN_BPS, CovenantTermsLib.BPS);
    }

    function _floor(uint256 poolQuote, uint256 poolToken, uint256 totalSupply)
        internal
        view
        returns (IFlapLaunchFloor.GraduationFloorResultV2 memory r, uint256 price)
    {
        IFlapLaunchFloor portal = IFlapLaunchFloor(hub);
        bool enabled;
        (enabled, price) = portal.launchQuoteConfig(uint8(IPortalTypes.LaunchKind.DIRECT_V2_POOL_TAX), address(0));
        if (!enabled || price == 0) revert QuoteNotEnabled();
        r = portal.graduationFloorV2(
            IFlapLaunchFloor.GraduationFloorParams({
                quoteToken: address(0),
                quotePriceUsd: price,
                poolQuote: poolQuote,
                poolToken: poolToken,
                totalSupply: totalSupply,
                vaultFactory: pairedVaultFactory
            })
        );
    }

    function _divUp(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
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
        f[0] = FieldDescriptor("name", "string", "Token name (1-64 bytes), not on Flap's blocklist", 0);
        f[1] = FieldDescriptor("symbol", "string", "Token symbol (1-16 bytes), not on Flap's blocklist", 0);
        f[2] = FieldDescriptor("meta", "string", "Metadata URI", 0);
        f[3] = FieldDescriptor("salt", "bytes32", "Salt mined so the token address ends in 7777", 0);
        f[4] = FieldDescriptor("totalSupply", "uint256", "Total supply, a multiple of 10000", 18);
        f[5] = FieldDescriptor("saleBps", "uint16", "Sale share in bps (>= 4000)", 0);
        f[6] = FieldDescriptor("poolBps", "uint16", "Pool share in bps (500 to saleBps)", 0);
        f[7] = FieldDescriptor("trancheBps", "uint16[]", "Team tranche sizes in bps of supply", 0);
        f[8] = FieldDescriptor("trancheMultiple", "uint16[]", "Tranche price multiples, 200 = 2x the sale price", 0);
        f[9] = FieldDescriptor(
            "minRaise", "uint256", "Minimum raise in BNB; its pool seed must clear 1.5x Flap's floor (minRaiseFor)", 18
        );
        f[10] = FieldDescriptor("cap", "uint256", "Raise cap in BNB", 18);
        f[11] = FieldDescriptor("saleDuration", "uint32", "Sale window in seconds", 0);
        f[12] = FieldDescriptor("buyTaxBps", "uint16", "Buy tax in bps (<= 1000; the higher rate >= 100)", 0);
        f[13] = FieldDescriptor("sellTaxBps", "uint16", "Sell tax in bps (<= 1000; the higher rate >= 100)", 0);
        f[14] = FieldDescriptor("taxDuration", "uint32", "Tax duration in seconds (30 days to 100 years)", 0);
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
