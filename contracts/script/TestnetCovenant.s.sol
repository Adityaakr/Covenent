// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {Terms} from "src/vault/CovenantTypes.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantLauncherFactory} from "src/launcher/CovenantLauncherFactory.sol";
import {IPortal} from "src/flap/IPortal.sol";

/// @title TestnetCovenant
/// @notice Creates one covenant on BNB testnet through Flap's Portal and our demo launcher factory
///         (contracts/deployments/97.json), from the team wallet. The demo factory needs the minimum raise's pool seed
///         to clear 1.5x Flap's creation floor ($750 x S / P at the Portal's BNB price, read live through
///         `minRaiseFor`); at the default split 50 / 45 / 5 (sale / pool / team) and $700 per BNB that is a 3.57 BNB
///         seed and a 3.97 tBNB minimum raise. The raise defaults to exactly that minimum (min = cap).
///
///   Required env:  TEAM_PRIVATE_KEY (the team wallet; it pays the Portal's salt-lock fee and the gas)
///   Optional env:  TN_RAISE (wei, min = cap, default: the factory's minRaiseFor), TN_SALE_SECONDS (default 300),
///                  TN_HEARTBEAT (s, 600), TN_TAP_USD (dollars per 30 days, 100), TN_NAME, TN_SYMBOL,
///                  TN_FACTORY_KEY (the 97.json key of the launcher factory, default demoLauncherFactory)
///
/// @dev forge script script/TestnetCovenant.s.sol --rpc-url $BSC_TESTNET_RPC_URL            (simulation)
///      forge script script/TestnetCovenant.s.sol --rpc-url $BSC_TESTNET_RPC_URL --broadcast
contract TestnetCovenant is Script, StackBuilder {
    function run() external returns (address launcher) {
        require(block.chainid == 97, "TestnetCovenant targets BNB testnet (97)");
        string memory record = vm.readFile("deployments/97.json");
        address factory =
            vm.parseJsonAddress(record, string.concat(".", vm.envOr("TN_FACTORY_KEY", string("demoLauncherFactory"))));
        address portalAddr = vm.parseJsonAddress(record, ".portal");
        uint256 key = vm.envUint("TEAM_PRIVATE_KEY");
        address team = vm.addr(key);

        uint256 raise = vm.envOr("TN_RAISE", uint256(0));
        bytes32 seed = keccak256(abi.encode("covenant-testnet", team, block.timestamp));
        Terms memory t = CovenantProfiles.demoTerms(
            vm.envOr("TN_NAME", string("Covenant Testnet")),
            vm.envOr("TN_SYMBOL", string("CVT")),
            _mineSalt(portalAddr, BSC_TOKEN_IMPL, seed),
            team
        );
        t.saleBps = 5_000;
        t.poolBps = 4_500;
        t.trancheBps = new uint16[](1);
        t.trancheBps[0] = 500;
        t.trancheMultiple = new uint16[](1);
        t.trancheMultiple[0] = 200;
        if (raise == 0) {
            (raise,,,,,) = CovenantLauncherFactory(factory).minRaiseFor(t.totalSupply, t.saleBps, t.poolBps);
        }
        t.minRaise = raise;
        t.cap = raise;
        t.saleDuration = uint32(vm.envOr("TN_SALE_SECONDS", uint256(300)));
        t.heartbeat = uint32(vm.envOr("TN_HEARTBEAT", uint256(600)));
        t.tapUsdPer30d = vm.envOr("TN_TAP_USD", uint256(100)) * 1 ether;

        CovenantLauncherFactory(factory).checkTerms(t); // the factory's own reason, before any gas is spent
        IPortal portal = IPortal(portalAddr);
        uint256 fee = portal.SALT_LOCK_FEE();

        vm.startBroadcast(key);
        launcher = portal.newLauncher{value: fee}(factory, abi.encode(t));
        vm.stopBroadcast();

        console2.log("factory (demo)", factory);
        console2.log("team", team);
        console2.log("launcher", launcher);
        console2.log("min raise = cap (wei)", raise);
        console2.log("sale closes in (s)", t.saleDuration);
    }
}
