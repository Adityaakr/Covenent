// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {ForwardVault} from "src/vendor/openfour/taxvault/vaults/ForwardVault.sol";
import {CovenantLiteVault} from "src/openfour/CovenantLiteVault.sol";
import {ModuleEncodeSchema} from "src/vendor/openfour/libraries/OpenFourTypes.sol";
import {MockWBNB} from "src/mocks/MockV2.sol";
import {MockTaxToken} from "src/mocks/MockFlap.sol";

/// @notice CovenantLiteVault behind OpenFour's ForwardVault (vendored unchanged), the way Four.meme's Unverified
///         Royalty path wires it: the platform clones ForwardVault as the token's founder, ForwardVault clones our
///         template and forwards each tax receipt after its 6% royalty to the template author.
contract LiteVaultTest is Test {
    address internal constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address internal author = address(uint160(0xA0700001));
    address internal founder = address(uint160(0xA0700002));
    address internal holderA = address(uint160(0xA0700003));
    address internal holderB = address(uint160(0xA0700004));
    address internal stranger = address(uint160(0xA0700005));

    MockTaxToken internal token;
    CovenantLiteVault internal template;
    ForwardVault internal forward;
    CovenantLiteVault internal lite;

    function setUp() public {
        vm.chainId(56); // ForwardVault resolves WBNB by chain id
        vm.etch(WBNB, address(new MockWBNB()).code);
        vm.warp(1_800_000_000);

        token = new MockTaxToken();
        token.initialize("Four Agent", "FAGT", 1_000_000_000 ether);
        token.transfer(holderA, 300_000_000 ether);
        token.transfer(holderB, 100_000_000 ether);
        token.transfer(DEAD, 100_000_000 ether); // already burned supply is not redeemable

        template = new CovenantLiteVault(author);
        (forward, lite) = _wire(_params(400, 30 days, 45 days, 100));
    }

    function _params(uint256 tapBps, uint256 period, uint256 hb, uint256 fee) internal pure returns (bytes memory) {
        return abi.encode(uint16(tapBps), uint32(period), uint32(hb), uint16(fee));
    }

    /// @dev What the OpenFour registry does: clone ForwardVault and initialize it with (template, initData).
    function _wire(bytes memory initData) internal returns (ForwardVault f, CovenantLiteVault c) {
        f = ForwardVault(payable(Clones.clone(address(new ForwardVault()))));
        f.initialize(
            address(token), WBNB, founder, new address[](0), abi.encode(ForwardVault.InitParams(address(template), initData))
        );
        c = CovenantLiteVault(payable(f.clonedVault()));
    }

    function _taxNative(uint256 amount) internal {
        vm.deal(address(token), amount);
        vm.prank(address(token));
        (bool ok,) = address(forward).call{value: amount}("");
        assertTrue(ok);
    }

    function test_clone_isBoundToTheToken_andPaysTheAuthorRoyalty() public {
        assertEq(lite.taxVaultToken(), address(token));
        assertEq(lite.taxVaultQuote(), WBNB);
        assertEq(lite.owner(), founder);
        assertEq(lite.authorWallet(), author);
        assertEq(lite.taxVaultTypeId(), keccak256("Covenant.LiteVault.v1"));
        (uint16 tapBps, uint32 period, uint32 hb, uint16 fee) = lite.params();
        assertEq(tapBps, 400);
        assertEq(period, 30 days);
        assertEq(hb, 45 days);
        assertEq(fee, 100);

        _taxNative(10 ether);
        assertEq(MockWBNB(payable(WBNB)).balanceOf(author), 0.6 ether, "ROYALTY_BPS = 600 to authorWallet()");
        assertEq(address(lite).balance, 9.4 ether, "the founder's share lands in the covenant, not the wallet");
    }

    function test_erc20Receipts_areHeldAndSplitToo() public {
        (ForwardVault f2, CovenantLiteVault c2) = _wire(_params(400, 30 days, 45 days, 0));
        MockWBNB(payable(WBNB)).deposit{value: 5 ether}();
        MockWBNB(payable(WBNB)).transfer(address(f2), 5 ether);
        vm.prank(address(token));
        f2.onERC20TaxReceived(WBNB, 5 ether);
        (uint256 n, uint256 q) = c2.balances();
        assertEq(n, 0);
        assertEq(q, 4.7 ether);
    }

    function test_tap_atMostTapBpsPerPeriod_andAHeartbeat() public {
        _taxNative(100 ether); // 94 BNB in the vault
        uint256 before = founder.balance;
        vm.prank(founder);
        lite.withdrawTap();
        assertEq(founder.balance - before, 94 ether * 400 / 10_000);
        assertEq(lite.lastHeartbeat(), block.timestamp);

        _taxNative(100 ether);
        vm.prank(founder);
        vm.expectRevert(CovenantLiteVault.NothingToWithdraw.selector);
        lite.withdrawTap(); // the period's allowance is fixed at its first withdrawal

        vm.warp(block.timestamp + 30 days);
        uint256 bal = address(lite).balance;
        vm.prank(founder);
        lite.withdrawTap();
        assertEq(founder.balance - before, 94 ether * 400 / 10_000 + bal * 400 / 10_000);

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        lite.withdrawTap();
    }

    function test_switch_opensTheTreasury_afterTheHeartbeatLapses() public {
        _taxNative(100 ether);
        uint256 deadline = lite.heartbeatDeadline();
        vm.expectRevert(abi.encodeWithSelector(CovenantLiteVault.NotAbandoned.selector, deadline));
        lite.declareAbandoned();

        vm.warp(deadline + 1);
        vm.prank(stranger);
        lite.declareAbandoned();
        assertTrue(lite.open());
        assertTrue(lite.abandoned());

        vm.prank(founder);
        vm.expectRevert(CovenantLiteVault.Closed.selector);
        lite.withdrawTap();

        // Redeemable supply excludes only the burn address, the vault and the token contract: 1B - 100M burned.
        uint256 r = lite.redeemableSupply();
        assertEq(r, 900_000_000 ether);
        vm.startPrank(holderA);
        token.approve(address(lite), type(uint256).max);
        (uint256 outN,) = lite.redeem(300_000_000 ether, 0, 0);
        vm.stopPrank();
        assertEq(outN, uint256(94 ether) * 300_000_000 ether / r * 9_900 / 10_000, "pro rata less the 1% fee");
        assertEq(holderA.balance, outN);
        assertEq(token.balanceOf(DEAD), 400_000_000 ether);
    }

    function test_windDown_byTheFounder() public {
        _taxNative(10 ether);
        vm.prank(founder);
        lite.windDown();
        assertTrue(lite.open());
        assertFalse(lite.abandoned());
        vm.startPrank(holderB);
        token.approve(address(lite), type(uint256).max);
        lite.redeem(100_000_000 ether, 0, 0);
        vm.stopPrank();
        assertGt(holderB.balance, 0);
    }

    function test_redeem_closedUntilTheSwitch() public {
        vm.startPrank(holderA);
        token.approve(address(lite), type(uint256).max);
        vm.expectRevert(CovenantLiteVault.Closed.selector);
        lite.redeem(1 ether, 0, 0);
        vm.stopPrank();
    }

    function test_initParams_areBounded() public {
        ForwardVault f = ForwardVault(payable(Clones.clone(address(new ForwardVault()))));
        bytes memory bad = _params(6_000, 30 days, 45 days, 100); // tap above 50%
        vm.expectRevert(CovenantLiteVault.BadParams.selector);
        f.initialize(address(token), WBNB, founder, new address[](0), abi.encode(ForwardVault.InitParams(address(template), bad)));

        f = ForwardVault(payable(Clones.clone(address(new ForwardVault()))));
        bad = abi.encodePacked(_params(400, 30 days, 45 days, 100), uint256(1)); // trailing bytes
        vm.expectRevert(CovenantLiteVault.BadParams.selector);
        f.initialize(address(token), WBNB, founder, new address[](0), abi.encode(ForwardVault.InitParams(address(template), bad)));
    }

    function test_template_cannotBeInitializedDirectly() public {
        vm.expectRevert("Initializable: contract is already initialized");
        template.initialize(address(token), WBNB, founder, new address[](0), _params(400, 30 days, 45 days, 100));
    }

    function test_moduleEncodeSchema_hasTheFourFields() public view {
        ModuleEncodeSchema memory s = lite.moduleEncodeSchema();
        assertEq(s.params.length, 4);
        assertEq(s.params[0].name, "tapBps");
        assertEq(s.params[1].name, "tapPeriod");
        assertEq(s.params[2].name, "heartbeat");
        assertEq(s.params[3].name, "redeemFeeBps");
    }
}
