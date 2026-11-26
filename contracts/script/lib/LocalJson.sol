// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {CommonBase} from "forge-std/Base.sol";

/// @notice Reads and writes contracts/deployments/local.json, the file the web app and the server read:
///         {chainId, rpcUrl, mode, addresses{...}, atlas{...}, accounts{...}, demo{...}}.
abstract contract LocalJson is CommonBase {
    string internal constant LOCAL_JSON = "deployments/local.json";
    string internal constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

    // Roles on the dev chain, by anvil account index (the standard anvil mnemonic, public test keys only).
    uint32 internal constant IDX_DEPLOYER = 0;
    uint32 internal constant IDX_TEAM = 1; // the issuer agent's wallet
    uint32 internal constant IDX_BUYER1 = 2;
    uint32 internal constant IDX_BUYER2 = 3;
    uint32 internal constant IDX_BUYER3 = 4;
    uint32 internal constant IDX_WHALE = 5;
    uint32 internal constant IDX_KEEPER = 6;
    uint32 internal constant IDX_TRADER = 7;
    uint32 internal constant IDX_RELAYER = 8;
    uint32 internal constant IDX_ATLAS = 9; // dev Atlas signer

    struct Addresses {
        address portal;
        address tokenImpl;
        address dockRouter;
        address guardian;
        address portalAdmin;
        address wbnb;
        address router;
        address identityRegistry;
        address reputationRegistry;
        address oracle;
        address lens;
        address launcherFactory;
        address vaultFactory;
        address demoLauncherFactory;
        address demoVaultFactory;
        address liteVaultTemplate;
        address forwardVaultImpl;
    }

    struct Demo {
        address launcher;
        address vault;
        address token;
        address pair;
        address taxProcessor;
        uint256 agentId;
        string scene;
    }

    struct Local {
        uint256 chainId;
        string rpcUrl;
        string mode;
        uint256 deployedAtBlock;
        Addresses a;
        address atlasSigner;
        bytes4 atlasFeed;
        Demo demo;
    }

    function _key(uint32 index) internal pure returns (uint256) {
        return vm.deriveKey(ANVIL_MNEMONIC, index);
    }

    function _addr(uint32 index) internal pure returns (address) {
        return vm.addr(_key(index));
    }

    function _readLocal() internal view returns (Local memory l) {
        string memory j = vm.readFile(LOCAL_JSON);
        l.chainId = vm.parseJsonUint(j, ".chainId");
        l.rpcUrl = vm.parseJsonString(j, ".rpcUrl");
        l.mode = vm.parseJsonString(j, ".mode");
        l.deployedAtBlock = vm.parseJsonUint(j, ".deployedAtBlock");
        l.a.portal = vm.parseJsonAddress(j, ".addresses.portal");
        l.a.tokenImpl = vm.parseJsonAddress(j, ".addresses.tokenImpl");
        l.a.dockRouter = vm.parseJsonAddress(j, ".addresses.dockRouter");
        l.a.guardian = vm.parseJsonAddress(j, ".addresses.guardian");
        l.a.portalAdmin = vm.parseJsonAddress(j, ".addresses.portalAdmin");
        l.a.wbnb = vm.parseJsonAddress(j, ".addresses.wbnb");
        l.a.router = vm.parseJsonAddress(j, ".addresses.router");
        l.a.identityRegistry = vm.parseJsonAddress(j, ".addresses.identityRegistry");
        l.a.reputationRegistry = vm.parseJsonAddress(j, ".addresses.reputationRegistry");
        l.a.oracle = vm.parseJsonAddress(j, ".addresses.oracle");
        l.a.lens = vm.parseJsonAddress(j, ".addresses.lens");
        l.a.launcherFactory = vm.parseJsonAddress(j, ".addresses.launcherFactory");
        l.a.vaultFactory = vm.parseJsonAddress(j, ".addresses.vaultFactory");
        l.a.demoLauncherFactory = vm.parseJsonAddress(j, ".addresses.demoLauncherFactory");
        l.a.demoVaultFactory = vm.parseJsonAddress(j, ".addresses.demoVaultFactory");
        l.a.liteVaultTemplate = vm.parseJsonAddress(j, ".addresses.liteVaultTemplate");
        l.a.forwardVaultImpl = vm.parseJsonAddress(j, ".addresses.forwardVaultImpl");
        l.atlasSigner = vm.parseJsonAddress(j, ".atlas.signer");
        l.atlasFeed = bytes4(vm.parseJsonBytes(j, ".atlas.feedIdBnbUsd"));
        l.demo.launcher = vm.parseJsonAddress(j, ".demo.launcher");
        l.demo.vault = vm.parseJsonAddress(j, ".demo.vault");
        l.demo.token = vm.parseJsonAddress(j, ".demo.token");
        l.demo.pair = vm.parseJsonAddress(j, ".demo.pair");
        l.demo.taxProcessor = vm.parseJsonAddress(j, ".demo.taxProcessor");
        l.demo.agentId = vm.parseJsonUint(j, ".demo.agentId");
        l.demo.scene = vm.parseJsonString(j, ".demo.scene");
    }

    function _writeLocal(Local memory l) internal {
        string memory a = "addresses";
        vm.serializeAddress(a, "portal", l.a.portal);
        vm.serializeAddress(a, "tokenImpl", l.a.tokenImpl);
        vm.serializeAddress(a, "dockRouter", l.a.dockRouter);
        vm.serializeAddress(a, "guardian", l.a.guardian);
        vm.serializeAddress(a, "portalAdmin", l.a.portalAdmin);
        vm.serializeAddress(a, "wbnb", l.a.wbnb);
        vm.serializeAddress(a, "router", l.a.router);
        vm.serializeAddress(a, "identityRegistry", l.a.identityRegistry);
        vm.serializeAddress(a, "reputationRegistry", l.a.reputationRegistry);
        vm.serializeAddress(a, "oracle", l.a.oracle);
        vm.serializeAddress(a, "lens", l.a.lens);
        vm.serializeAddress(a, "launcherFactory", l.a.launcherFactory);
        vm.serializeAddress(a, "vaultFactory", l.a.vaultFactory);
        vm.serializeAddress(a, "demoLauncherFactory", l.a.demoLauncherFactory);
        vm.serializeAddress(a, "demoVaultFactory", l.a.demoVaultFactory);
        vm.serializeAddress(a, "liteVaultTemplate", l.a.liteVaultTemplate);
        string memory addrJson = vm.serializeAddress(a, "forwardVaultImpl", l.a.forwardVaultImpl);

        string memory at = "atlas";
        vm.serializeAddress(at, "signer", l.atlasSigner);
        vm.serializeBytes(at, "feedIdBnbUsd", abi.encodePacked(l.atlasFeed));
        vm.serializeUint(at, "devSignerAnvilIndex", IDX_ATLAS);
        vm.serializeUint(at, "maxDelaySeconds", 180);
        string memory atlasJson = vm.serializeUint(at, "maxFutureDriftSeconds", 60);

        string memory acc = "accounts";
        vm.serializeString(acc, "mnemonic", ANVIL_MNEMONIC);
        vm.serializeString(acc, "note", "anvil's public test mnemonic; dev chain only");
        vm.serializeString(acc, "deployer", _account("deployer", IDX_DEPLOYER));
        vm.serializeString(acc, "team", _account("team", IDX_TEAM));
        vm.serializeString(acc, "buyer1", _account("buyer1", IDX_BUYER1));
        vm.serializeString(acc, "buyer2", _account("buyer2", IDX_BUYER2));
        vm.serializeString(acc, "buyer3", _account("buyer3", IDX_BUYER3));
        vm.serializeString(acc, "whale", _account("whale", IDX_WHALE));
        vm.serializeString(acc, "keeper", _account("keeper", IDX_KEEPER));
        vm.serializeString(acc, "trader", _account("trader", IDX_TRADER));
        vm.serializeString(acc, "relayer", _account("relayer", IDX_RELAYER));
        string memory accJson = vm.serializeString(acc, "atlasSigner", _account("atlasSigner", IDX_ATLAS));

        string memory d = "demo";
        vm.serializeAddress(d, "launcher", l.demo.launcher);
        vm.serializeAddress(d, "vault", l.demo.vault);
        vm.serializeAddress(d, "token", l.demo.token);
        vm.serializeAddress(d, "pair", l.demo.pair);
        vm.serializeAddress(d, "taxProcessor", l.demo.taxProcessor);
        vm.serializeUint(d, "agentId", l.demo.agentId);
        string memory demoJson = vm.serializeString(d, "scene", l.demo.scene);

        string memory root = "root";
        vm.serializeUint(root, "chainId", l.chainId);
        vm.serializeString(root, "rpcUrl", l.rpcUrl);
        vm.serializeString(root, "mode", l.mode);
        vm.serializeUint(root, "deployedAtBlock", l.deployedAtBlock);
        vm.serializeString(root, "addresses", addrJson);
        vm.serializeString(root, "atlas", atlasJson);
        vm.serializeString(root, "accounts", accJson);
        string memory out = vm.serializeString(root, "demo", demoJson);
        vm.writeJson(out, LOCAL_JSON);
    }

    function _account(string memory label, uint32 index) internal returns (string memory) {
        string memory k = string.concat("acct-", label);
        vm.serializeAddress(k, "address", _addr(index));
        return vm.serializeUint(k, "anvilIndex", index);
    }
}
