// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";
import {CovenantLiteVault} from "src/openfour/CovenantLiteVault.sol";

/// @title Deploy
/// @notice Deploys Covenant to BNB Chain (56) or BNB testnet (97): the oracle, the production factory pair, the
///         demo factory pair (testnet by default), the lens and the OpenFour template. Writes
///         deployments/<chainId>.json. See docs/DEPLOY.md for the runbook; Flap must then enable the launcher
///         factories on its Portal.
///
///   Required env:  DEPLOYER_PRIVATE_KEY; ATLAS_BNB_USD_FEED_ID (bytes4 hex from Atlas onboarding) unless the chain
///                  has an Atlas push feed (testnet: config/atlas-97.json), which then is the BNB/USD source for any
///                  poke without a pull report
///   Optional env:  ATLAS_SIGNER (default Atlas's production signer), ATLAS_PUSH_FEED (default: testnet BNB/USD push
///                  feed on 97, none on 56), ATLAS_PUSH_MAX_AGE (s, default 1 h, checked against updatedAt),
///                  DEPLOY_DEMO_FACTORY (default true on testnet, false on mainnet), LITE_AUTHOR (royalty wallet)
///
/// @dev Dry run first (simulation only, nothing is sent):
///        forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL
///      then add --broadcast --verify once the dry run is clean.
contract Deploy is Script, StackBuilder {
    /// @notice Atlas BNB/USD push feed on BNB testnet (config/atlas-97.json). Chainlink-compatible, open read, keeps
    ///         only the latest round. BNB Chain mainnet has no Atlas push feed yet.
    address internal constant TESTNET_ATLAS_PUSH_BNB_USD = 0x3957d289ee9C38272377786787ea34F9dd29788D;
    // PancakeSwap V2 router per chain (for the record file; the contracts do not use it).
    address internal constant TESTNET_WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address internal constant TESTNET_V2_ROUTER = 0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3;

    struct Config {
        uint256 chainId;
        uint256 key;
        address deployer;
        bytes4 feed;
        address signer;
        address pushFeed;
        uint256 pushAge;
        bool withDemo;
        address liteAuthor;
    }

    struct Result {
        CovenantOracle oracle;
        Pair prod;
        Pair demo;
        CovenantLens lens;
        CovenantLiteVault lite;
    }

    function run() external {
        Config memory c = _config();
        Net memory net = _net(c.chainId);
        Result memory r = _deploy(c, net);
        _write(c, net, r);
    }

    function _config() internal view returns (Config memory c) {
        c.chainId = block.chainid;
        require(c.chainId == 56 || c.chainId == 97, "Deploy.s.sol targets BNB Chain (56) or BNB testnet (97)");
        c.key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        c.deployer = vm.addr(c.key);
        c.pushFeed = vm.envOr("ATLAS_PUSH_FEED", c.chainId == 97 ? TESTNET_ATLAS_PUSH_BNB_USD : address(0));
        // Pull mode needs the feed id from Atlas onboarding; with a push feed it is optional (pokes without a pull
        // report read the push feed). The id is fixed at deployment, so pass it now if a pull key is coming.
        c.feed = bytes4(vm.envOr("ATLAS_BNB_USD_FEED_ID", bytes("")));
        require(c.feed != bytes4(0) || c.pushFeed != address(0), "ATLAS_BNB_USD_FEED_ID is required without a push feed");
        if (c.feed == bytes4(0)) c.feed = DEV_BNB_USD_FEED; // no pull reports expected; any signed report would fail the signer check
        c.signer = vm.envOr("ATLAS_SIGNER", ATLAS_PROD_SIGNER);
        c.pushAge = vm.envOr("ATLAS_PUSH_MAX_AGE", uint256(1 hours));
        c.withDemo = vm.envOr("DEPLOY_DEMO_FACTORY", c.chainId == 97);
        c.liteAuthor = vm.envOr("LITE_AUTHOR", c.deployer);
    }

    function _net(uint256 id) internal view returns (Net memory net) {
        net.portal = LaunchVaultAddresses.hub();
        net.guardian = LaunchVaultAddresses.guardian();
        net.dockRouter = LaunchVaultAddresses.tokenDockRouter();
        net.tokenImpl = BSC_TOKEN_IMPL;
        net.identity = id == 56 ? BSC_IDENTITY : BSC_TESTNET_IDENTITY;
        net.reputation = id == 56 ? BSC_REPUTATION : BSC_TESTNET_REPUTATION;
        net.wbnb = id == 56 ? BSC_WBNB : TESTNET_WBNB;
        net.router = id == 56 ? BSC_V2_ROUTER : TESTNET_V2_ROUTER;
        require(net.portal.code.length > 0 && net.dockRouter.code.length > 0, "Flap is not deployed here");
        require(net.identity.code.length > 0 && net.reputation.code.length > 0, "ERC-8004 is not deployed here");
    }

    function _deploy(Config memory c, Net memory net) internal returns (Result memory r) {
        vm.startBroadcast(c.key);
        r.oracle = new CovenantOracle(c.feed, c.signer, c.pushFeed, c.pushAge);
        r.prod = _deployPair(c.deployer, net, address(r.oracle), CovenantProfiles.production(), "production");
        if (c.withDemo) r.demo = _deployPair(c.deployer, net, address(r.oracle), CovenantProfiles.demo(), "demo");
        r.lens = new CovenantLens();
        r.lite = new CovenantLiteVault(c.liteAuthor);
        vm.stopBroadcast();
    }

    function _write(Config memory c, Net memory net, Result memory r) internal {
        string memory o = "deploy";
        vm.serializeUint(o, "chainId", c.chainId);
        vm.serializeAddress(o, "deployer", c.deployer);
        vm.serializeAddress(o, "portal", net.portal);
        vm.serializeAddress(o, "guardian", net.guardian);
        vm.serializeAddress(o, "dockRouter", net.dockRouter);
        vm.serializeAddress(o, "identityRegistry", net.identity);
        vm.serializeAddress(o, "reputationRegistry", net.reputation);
        vm.serializeAddress(o, "oracle", address(r.oracle));
        vm.serializeAddress(o, "atlasSigner", c.signer);
        vm.serializeBytes(o, "atlasFeedIdBnbUsd", abi.encodePacked(c.feed));
        vm.serializeAddress(o, "launcherFactory", address(r.prod.launcherFactory));
        vm.serializeAddress(o, "vaultFactory", address(r.prod.vaultFactory));
        vm.serializeAddress(o, "demoLauncherFactory", address(r.demo.launcherFactory));
        vm.serializeAddress(o, "demoVaultFactory", address(r.demo.vaultFactory));
        vm.serializeAddress(o, "lens", address(r.lens));
        string memory json = vm.serializeAddress(o, "liteVaultTemplate", address(r.lite));
        string memory path = string.concat("deployments/", vm.toString(c.chainId), ".json");
        vm.writeJson(json, path);

        console2.log("chain", c.chainId);
        console2.log("oracle", address(r.oracle));
        console2.log("launcherFactory (ask Flap to enable)", address(r.prod.launcherFactory));
        console2.log("vaultFactory", address(r.prod.vaultFactory));
        if (c.withDemo) console2.log("demoLauncherFactory (ask Flap to enable)", address(r.demo.launcherFactory));
        console2.log("lens", address(r.lens));
        console2.log("liteVaultTemplate", address(r.lite));
        console2.log("written", path);
    }
}
