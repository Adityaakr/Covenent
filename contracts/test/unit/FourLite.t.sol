// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {ForwardVault} from "src/vendor/openfour/taxvault/vaults/ForwardVault.sol";
import {CovenantLiteVault} from "src/openfour/CovenantLiteVault.sol";
import {MockWBNB, MockV2Factory, MockV2Router} from "src/mocks/MockV2.sol";
import {FourLiteLauncher, FourStyleTaxToken} from "src/mocks/FourLiteLauncher.sol";

interface IRouterSwap {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, address[] calldata, address, uint256)
        external
        payable;
}

/// @notice The local Four.meme path end to end: launch a tax token whose founder tax goes through OpenFour's
///         ForwardVault (vendored unchanged) into a Covenant Lite vault; trades pay tax; dispatch forwards it with the
///         6% royalty; the founder taps; the founder goes silent; anyone opens the treasury; a holder redeems.
contract FourLiteTest is Test {
    address internal constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address internal author = address(uint160(0xA0700001));
    address internal founder = address(uint160(0xA0700002));
    address internal buyer = address(uint160(0xA0700003));
    address internal stranger = address(uint160(0xA0700004));

    FourLiteLauncher internal launcher;
    CovenantLiteVault internal template;
    MockV2Router internal router;

    function setUp() public {
        vm.chainId(56); // ForwardVault resolves WBNB by chain id
        vm.etch(WBNB, address(new MockWBNB()).code);
        vm.warp(1_800_000_000);
        router = new MockV2Router(address(new MockV2Factory()), WBNB);
        template = new CovenantLiteVault(author);
        launcher = new FourLiteLauncher(address(new ForwardVault()), address(router), WBNB);
        vm.deal(founder, 100 ether);
        vm.deal(buyer, 100 ether);
    }

    function _launch() internal returns (FourLiteLauncher.Launch memory l) {
        bytes memory vaultData = launcher.encodeVaultData(address(template), 400, 30 days, 7 days, 100);
        // the exact bytes the live ForwardVault decodes: one struct (address template, bytes initData)
        assertEq(
            vaultData,
            abi.encode(
                ForwardVault.InitParams(
                    address(template), abi.encode(uint16(400), uint32(30 days), uint32(7 days), uint16(100))
                )
            )
        );
        vm.prank(founder);
        l = launcher.launch{value: 20 ether}(
            "Forge Agent", "FORGE", 1_000_000_000 ether, 500, vaultData, 300_000_000 ether
        );
    }

    function test_launch_wiresTokenForwardVaultLiteAndPool() public {
        FourLiteLauncher.Launch memory l = _launch();
        CovenantLiteVault lite = CovenantLiteVault(payable(l.liteVault));
        assertEq(lite.owner(), founder);
        assertEq(lite.taxVaultToken(), l.token);
        assertEq(FourStyleTaxToken(payable(l.token)).founderRecipient(), l.forwardVault);
        assertEq(FourStyleTaxToken(payable(l.token)).balanceOf(founder), 700_000_000 ether);
        assertEq(launcher.launchCount(), 1);
    }

    function test_journey_taxTapAbandonRedeem() public {
        FourLiteLauncher.Launch memory l = _launch();
        FourStyleTaxToken token = FourStyleTaxToken(payable(l.token));
        CovenantLiteVault lite = CovenantLiteVault(payable(l.liteVault));

        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = address(token);
        vm.prank(buyer);
        IRouterSwap(address(router)).swapExactETHForTokensSupportingFeeOnTransferTokens{value: 10 ether}(
            0, path, buyer, block.timestamp
        );
        assertGt(token.balanceOf(address(token)), 0, "a buy pays tax to the token");

        uint256 bnb = token.dispatch();
        assertGt(bnb, 0);
        assertEq(MockWBNB(payable(WBNB)).balanceOf(author), bnb * 600 / 10_000, "6% royalty to the template author");
        assertEq(address(lite).balance, bnb - bnb * 600 / 10_000, "the founder's tax lands in the Lite vault");

        uint256 before = founder.balance;
        vm.prank(founder);
        lite.withdrawTap();
        assertEq(founder.balance - before, (bnb - bnb * 600 / 10_000) * 400 / 10_000, "4% tap");

        vm.prank(stranger);
        vm.expectRevert();
        lite.declareAbandoned();
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(stranger);
        lite.declareAbandoned();
        assertTrue(lite.abandoned());

        uint256 held = token.balanceOf(buyer);
        vm.startPrank(buyer);
        token.approve(address(lite), held);
        (uint256 out,) = lite.redeem(held, 0, 0);
        vm.stopPrank();
        assertGt(out, 0, "holders redeem pro rata once the treasury opens");
    }
}
