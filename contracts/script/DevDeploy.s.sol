// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {LocalJson} from "script/lib/LocalJson.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";
import {CovenantLiteVault} from "src/openfour/CovenantLiteVault.sol";
import {MockPortal} from "src/mocks/MockFlap.sol";

interface IProxyAdminOwner {
    function owner() external view returns (address);
}

/// @title DevDeploy
/// @notice Deploys the whole Covenant stack to the local dev chain started by scripts/dev-up.sh and writes
///         deployments/local.json.
///           fork mode (a BNB Chain fork): Flap's live Portal, Token Dock, PancakeSwap and the ERC-8004 registries;
///             the Portal admin opens our factories afterwards (dev-up.sh impersonates it).
///           mock mode (offline): the local stand-ins in src/mocks, with the deployer as Portal admin.
///         Both: the oracle with the dev Atlas signer (anvil account 9), the production and demo factory pairs,
///         the lens and the OpenFour template.
/// @dev forge script script/DevDeploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract DevDeploy is Script, StackBuilder, LocalJson {
    function run() external {
        bool fork = BSC_PORTAL.code.length > 0;
        uint256 deployerKey = _key(IDX_DEPLOYER);
        address deployer = vm.addr(deployerKey);
        address atlasSigner = _addr(IDX_ATLAS);

        Local memory l;
        l.chainId = block.chainid;
        l.rpcUrl = vm.envOr("DEV_RPC_URL", string("http://127.0.0.1:8545"));
        l.mode = fork ? "fork" : "mock";
        l.deployedAtBlock = block.number;
        l.atlasSigner = atlasSigner;
        l.atlasFeed = DEV_BNB_USD_FEED;
        l.demo.scene = "deployed";

        vm.startBroadcast(deployerKey);
        Net memory net;
        if (fork) {
            net = _bscChain(IProxyAdminOwner(BSC_PORTAL_PROXY_ADMIN).owner());
            l.a.forwardVaultImpl = 0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4;
        } else {
            // The deployer plays Flap's admin and Guardian on the offline chain.
            net = _deployMockChain(deployer, deployer, 1 ether);
        }
        CovenantOracle oracle = _deployOracle(atlasSigner);
        Pair memory prod = _deployPair(deployer, net, address(oracle), CovenantProfiles.production(), "production");
        Pair memory demo = _deployPair(deployer, net, address(oracle), CovenantProfiles.demo(), "demo");
        CovenantLens lens = _deployLens();
        CovenantLiteVault lite = new CovenantLiteVault(deployer);
        if (!fork) {
            MockPortal p = MockPortal(net.portal);
            p.setLauncherFactoryMultiplier(address(prod.launcherFactory), 10_000, true);
            p.setVaultFactoryMultiplier(address(prod.vaultFactory), 10_000, true);
            p.setLauncherFactoryMultiplier(address(demo.launcherFactory), 10_000, true);
            p.setVaultFactoryMultiplier(address(demo.vaultFactory), 10_000, true);
        }
        vm.stopBroadcast();

        l.a.portal = net.portal;
        l.a.tokenImpl = net.tokenImpl;
        l.a.dockRouter = net.dockRouter;
        l.a.guardian = net.guardian;
        l.a.portalAdmin = net.admin;
        l.a.wbnb = net.wbnb;
        l.a.router = net.router;
        l.a.identityRegistry = net.identity;
        l.a.reputationRegistry = net.reputation;
        l.a.oracle = address(oracle);
        l.a.lens = address(lens);
        l.a.launcherFactory = address(prod.launcherFactory);
        l.a.vaultFactory = address(prod.vaultFactory);
        l.a.demoLauncherFactory = address(demo.launcherFactory);
        l.a.demoVaultFactory = address(demo.vaultFactory);
        l.a.liteVaultTemplate = address(lite);
        _writeLocal(l);

        console2.log("mode", l.mode);
        console2.log("portal", net.portal);
        console2.log("oracle", address(oracle));
        console2.log("launcherFactory", address(prod.launcherFactory));
        console2.log("demoLauncherFactory", address(demo.launcherFactory));
        console2.log("portalAdmin", net.admin);
    }
}
