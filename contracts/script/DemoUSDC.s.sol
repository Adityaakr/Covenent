// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {DemoUSDC} from "src/mocks/DemoUSDC.sol";

/// @title DeployDemoUSDC
/// @notice Deploys DemoUSDC (test funds, worthless) on BNB testnet for the agent economy demo. Anyone mints
///         1,000 dUSDC a day from faucet(); the deployer is the minter. It is never part of a covenant: treasuries
///         stay BNB because Flap's pools are BNB-quoted. Add the printed address to deployments/97.json as demoUsdc.
///
///   Required env: PRIVATE_KEY (the deployer)
/// @dev Simulate with `forge script script/DemoUSDC.s.sol --rpc-url $BSC_TESTNET_RPC_URL`, then add the broadcast flag.
contract DeployDemoUSDC is Script {
    function run() external returns (DemoUSDC usdc) {
        require(block.chainid == 97, "DemoUSDC.s.sol targets BNB testnet (97)");
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        usdc = new DemoUSDC(vm.addr(key));
        vm.stopBroadcast();
        console2.log("demoUsdc", address(usdc));
    }
}
