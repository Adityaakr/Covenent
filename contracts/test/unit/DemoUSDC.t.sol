// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {DemoUSDC} from "src/mocks/DemoUSDC.sol";

contract DemoUSDCTest is Test {
    DemoUSDC usdc;
    address minter = address(0xA11CE);
    address user = address(0xB0B);

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new DemoUSDC(minter);
    }

    function test_minterMintsAnyAmount() public {
        vm.prank(minter);
        usdc.mint(user, 5_000_000e6);
        assertEq(usdc.balanceOf(user), 5_000_000e6);
    }

    function test_othersCannotMint() public {
        vm.prank(user);
        vm.expectRevert(DemoUSDC.NotMinter.selector);
        usdc.mint(user, 1);
    }

    function test_faucetPaysOncePerDay() public {
        assertEq(usdc.faucetAvailableAt(user), 0);
        vm.prank(user);
        assertEq(usdc.faucet(), 1_000e6);
        assertEq(usdc.balanceOf(user), 1_000e6);
        assertEq(usdc.totalSupply(), 1_000e6);
        uint256 next = block.timestamp + 1 days;
        assertEq(usdc.faucetAvailableAt(user), next);

        vm.warp(next - 1);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(DemoUSDC.FaucetCooldown.selector, next));
        usdc.faucet();

        vm.warp(next);
        assertEq(usdc.faucetAvailableAt(user), 0);
        vm.prank(user);
        usdc.faucet();
        assertEq(usdc.balanceOf(user), 2_000e6);
    }

    function test_faucetIsPerAddress() public {
        vm.prank(user);
        usdc.faucet();
        vm.prank(address(0xCAFE));
        usdc.faucet();
        assertEq(usdc.balanceOf(address(0xCAFE)), 1_000e6);
    }

    function test_transferAndAllowance() public {
        vm.prank(user);
        usdc.faucet();
        vm.prank(user);
        usdc.transfer(minter, 25e6);
        assertEq(usdc.balanceOf(minter), 25e6);
        vm.prank(user);
        usdc.approve(address(this), 10e6);
        usdc.transferFrom(user, minter, 10e6);
        assertEq(usdc.balanceOf(user), 965e6);
        vm.expectRevert(DemoUSDC.Insufficient.selector);
        usdc.transferFrom(user, minter, 1);
    }
}
