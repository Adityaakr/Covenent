// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {CommonBase} from "forge-std/Base.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {Profile, VaultEnv} from "src/vault/CovenantTypes.sol";
import {CovenantVaultFactory} from "src/vault/CovenantVaultFactory.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";
import {MockWBNB, MockV2Factory, MockV2Router} from "src/mocks/MockV2.sol";
import {MockPortal, MockTokenDockRouter} from "src/mocks/MockFlap.sol";
import {MockIdentityRegistry, MockReputationRegistry} from "src/mocks/MockERC8004.sol";

/// @notice Deployment and helper steps shared by the tests and the scripts: the local Flap and PancakeSwap
///         stand-ins, the ERC-8004 stand-ins, the oracle, a paired factory set, salt mining and signed Atlas
///         reports. Works the same inside a Test and inside a broadcasting Script.
abstract contract StackBuilder is CommonBase {
    /// @dev Dev-only Atlas feed id for BNB/USD. The production id comes from Atlas onboarding.
    bytes4 internal constant DEV_BNB_USD_FEED = 0x00000001;
    uint16 internal constant ATLAS_MARKER = 0x7096;

    address internal constant BSC_PORTAL = 0x000042108465206185A077Edc3F3fd2b49060000;
    address internal constant BSC_PORTAL_PROXY_ADMIN = 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000;
    address internal constant BSC_TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant BSC_DOCK_ROUTER = 0x000048E888aBf09f690a952E1b386b2D031a0000;
    address internal constant BSC_GUARDIAN = 0x9e27098dcD8844bcc6287a557E0b4D09C86B8a4b;
    address internal constant BSC_TESTNET_GUARDIAN = 0x00004d58290854c5E9880F4b5B1993c6Ad8b0000;
    address internal constant BSC_WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address internal constant BSC_V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant BSC_IDENTITY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address internal constant BSC_REPUTATION = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;
    address internal constant BSC_TESTNET_IDENTITY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant BSC_TESTNET_REPUTATION = 0x8004B663056A597Dffe9eCcC1965A193B7388713;
    address internal constant ATLAS_PROD_SIGNER = 0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600;
    /// @dev Flap's name and symbol blocklist, the proxy the Portal's launch facet calls inside `launchTaxTokenV2`
    ///      (read from launch traces on forks of each chain, 26 Nov 2026; the Portal does not expose it).
    address internal constant BSC_NAME_SCREEN = 0xfFb69d59f62454f3B8322Bc1a9FCE6E171a5264f;
    address internal constant BSC_TESTNET_NAME_SCREEN = 0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E;

    struct Net {
        address portal;
        address tokenImpl;
        address guardian;
        address dockRouter;
        address wbnb;
        address router;
        address identity;
        address reputation;
        address admin; // Portal admin (the mock's admin, or the live ProxyAdmin owner on a fork)
        address nameScreen; // Flap's name and symbol blocklist (IFlapNameScreen), 0 to skip the pre-screen
    }

    struct Pair {
        CovenantLauncherFactory launcherFactory;
        CovenantVaultFactory vaultFactory;
    }

    uint256 internal _saltNonce;

    /// @notice Deploys the Flap, PancakeSwap and ERC-8004 stand-ins. `guardian` is whoever plays Flap's Guardian.
    function _deployMockChain(address admin, address guardian, uint256 minPoolQuote)
        internal
        returns (Net memory c)
    {
        MockWBNB wbnb = new MockWBNB();
        MockV2Factory f = new MockV2Factory();
        MockV2Router router = new MockV2Router(address(f), address(wbnb));
        MockTokenDockRouter dock = new MockTokenDockRouter();
        MockPortal portal = new MockPortal(admin, address(wbnb), address(f), minPoolQuote);
        MockIdentityRegistry identity = new MockIdentityRegistry();
        MockReputationRegistry reputation = new MockReputationRegistry(address(identity));
        c.portal = address(portal);
        c.tokenImpl = portal.tokenImpl();
        c.guardian = guardian;
        c.dockRouter = address(dock);
        c.wbnb = address(wbnb);
        c.router = address(router);
        c.identity = address(identity);
        c.reputation = address(reputation);
        c.admin = admin;
        c.nameScreen = portal.nameScreen();
    }

    /// @notice The live BNB Chain addresses, for a fork.
    function _bscChain(address admin) internal pure returns (Net memory c) {
        c.portal = BSC_PORTAL;
        c.tokenImpl = BSC_TOKEN_IMPL;
        c.guardian = BSC_GUARDIAN;
        c.dockRouter = BSC_DOCK_ROUTER;
        c.wbnb = BSC_WBNB;
        c.router = BSC_V2_ROUTER;
        c.identity = BSC_IDENTITY;
        c.reputation = BSC_REPUTATION;
        c.admin = admin;
        c.nameScreen = BSC_NAME_SCREEN;
    }

    function _deployOracle(address signer) internal returns (CovenantOracle) {
        return new CovenantOracle(DEV_BNB_USD_FEED, signer, address(0), 0);
    }

    /// @notice Deploys a paired vault factory and launcher factory. The vault factory is created first with the
    ///         launcher factory's predicted address, and the launcher factory checks the pairing in its constructor.
    function _deployPair(
        address deployer,
        Net memory c,
        address oracle,
        Profile memory profile,
        string memory profileName
    ) internal returns (Pair memory p) {
        address predicted = vm.computeCreateAddress(deployer, vm.getNonce(deployer) + 1);
        VaultEnv memory env = VaultEnv({
            hub: c.portal,
            guardian: c.guardian,
            dockRouter: c.dockRouter,
            oracle: oracle,
            reputation: c.reputation,
            identity: c.identity
        });
        p.vaultFactory = new CovenantVaultFactory(predicted, env);
        p.launcherFactory = new CovenantLauncherFactory(
            c.portal, c.guardian, address(p.vaultFactory), c.identity, c.nameScreen, profile, profileName
        );
        require(address(p.launcherFactory) == predicted, "launcher factory address prediction failed");
    }

    function _deployLens() internal returns (CovenantLens) {
        return new CovenantLens();
    }

    /// @notice A salt whose token address (an EIP-1167 clone of `tokenImpl` by `portal`) ends in 0x7777, as Flap
    ///         requires. Hashes in scratch space so memory does not grow per candidate.
    function _mineSalt(address portal, address tokenImpl, bytes32 seed) internal returns (bytes32 salt) {
        uint256 start = ++_saltNonce << 128;
        for (uint256 i = start;; ++i) {
            assembly ("memory-safe") {
                mstore(0x00, seed)
                mstore(0x20, i)
                salt := keccak256(0x00, 0x40)
            }
            if (uint16(uint160(Clones.predictDeterministicAddress(tokenImpl, salt, portal))) == 0x7777) return salt;
        }
    }

    /// @notice A signed Atlas pull payload for one feed, in the wire format of the Atlas consumer:
    ///         [feedId 4B][price 10B][timestamp 6B][count 1B][signature 65B][marker 2B].
    function _atlasPayload(uint256 signerKey, bytes4 feedId, uint256 price, uint256 ts)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory pkg = abi.encodePacked(feedId, uint80(price), uint48(ts));
        bytes32 digest = keccak256(abi.encodePacked(pkg, uint8(1)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(pkg, uint8(1), r, s, v, ATLAS_MARKER);
    }

    /// @notice Calldata for `oracle.poke(vault)`, with a signed BNB/USD report appended when `price > 0`.
    function _pokeCalldata(address vault, uint256 signerKey, uint256 price, uint256 ts)
        internal
        pure
        returns (bytes memory data)
    {
        data = abi.encodeCall(CovenantOracle.poke, (vault));
        if (price > 0) data = abi.encodePacked(data, _atlasPayload(signerKey, DEV_BNB_USD_FEED, price, ts));
    }
}
