// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRedeemVault {
    function state() external view returns (uint8);
    function taxToken() external view returns (address);
    function pair() external view returns (address);
    function bookValue() external view returns (uint256);
    function previewRedeem(uint256 tokens) external view returns (uint256);
    function redeem(uint256 amount, uint256 minOut) external returns (uint256);
}

/// @notice The web app's redeem flow, run against the live BNB testnet covenant in wind-down (deployments/97.json,
///         legacyCovenantVault): read the balance and allowance, approve exactly the amount, read previewRedeem, redeem
///         with a 99.5% floor, then check the payout, the burn, the event and that no allowance is left behind.
///         Needs BSC_TESTNET_RPC_URL; skipped without it.
contract RedeemTestnetForkTest is Test {
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint8 constant WIND_DOWN = 5;

    IRedeemVault vault;
    IERC20 token;
    address holder = address(0xC0FFEE01);

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/deployments/97.json"));
        vault = IRedeemVault(vm.parseJsonAddress(json, ".legacyCovenantVault"));
        token = IERC20(vault.taxToken());
        // fund a plain holder from the pool's token reserve (the pair is the one large holder on testnet)
        address pool = vault.pair();
        uint256 take = token.balanceOf(pool) / 100;
        vm.prank(pool);
        token.transfer(holder, take);
    }

    function test_redeemAtWindDown_exactApprove_noFee() public {
        assertEq(vault.state(), WIND_DOWN, "the testnet covenant is wound down");
        uint256 amount = token.balanceOf(holder); // "Max": the exact on-chain balance
        assertGt(amount, 0);
        assertEq(token.allowance(holder, address(vault)), 0, "allowance short, so the app approves first");

        vm.startPrank(holder);
        token.approve(address(vault), amount); // exactly the amount, never open-ended
        uint256 preview = vault.previewRedeem(amount);
        uint256 book = vault.bookValue();
        assertEq(preview, amount * book / 1e18, "wind-down pays gross at book: no exit fee");
        uint256 minOut = preview * 995 / 1000;

        uint256 bnbBefore = holder.balance;
        uint256 deadBefore = token.balanceOf(DEAD);
        vm.recordLogs();
        uint256 out = vault.redeem(amount, minOut);
        vm.stopPrank();

        assertGe(out, minOut, "paid at least the floor the app sends");
        assertEq(holder.balance - bnbBefore, out, "BNB received equals the return value");
        assertEq(token.balanceOf(holder), 0, "every token left the wallet");
        assertEq(token.balanceOf(DEAD) - deadBefore, amount, "tokens burned at the dead address");
        assertEq(token.allowance(holder, address(vault)), 0, "the exact approval is fully used");

        bytes32 sig = keccak256("Redeemed(address,uint256,uint256,uint256)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool seen;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(vault) && logs[i].topics[0] == sig) {
                assertEq(address(uint160(uint256(logs[i].topics[1]))), holder);
                (uint256 burned, uint256 bnbOut,) = abi.decode(logs[i].data, (uint256, uint256, uint256));
                assertEq(burned, amount);
                assertEq(bnbOut, out);
                seen = true;
            }
        }
        assertTrue(seen, "Redeemed event emitted");
    }

    function test_redeemReverts_whenMinOutAboveQuote() public {
        uint256 amount = token.balanceOf(holder);
        vm.startPrank(holder);
        token.approve(address(vault), amount);
        uint256 preview = vault.previewRedeem(amount);
        vm.expectRevert();
        vault.redeem(amount, preview + 1);
        vm.stopPrank();
    }
}
