// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StackBuilder} from "script/lib/StackBuilder.sol";
import {LocalJson} from "script/lib/LocalJson.sol";
import {Terms, State} from "src/vault/CovenantTypes.sol";
import {CovenantProfiles} from "src/launcher/CovenantProfiles.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantLens} from "src/lens/CovenantLens.sol";
import {CovenantVaultDisplay} from "src/vault/CovenantVaultDisplay.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {IERC8004Identity} from "src/agent/IERC8004.sol";
import {MockPortal} from "src/mocks/MockFlap.sol";

interface IRouterV2 {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, address[] calldata, address, uint256)
        external
        payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256)
        external;
}

interface ITaxToken {
    function taxProcessor() external view returns (address);
}

interface ITaxProcessor {
    function dispatch() external;
}

/// @title Demo
/// @notice The three-minute demo story on the dev chain, one scene per call, on the short-timer demo factory:
///         an AI agent (team wallet, ERC-8004 identity) raises 1,400 BNB against a 500 BNB cap; buyers claim;
///         trading tax reaches the vault; the agent draws its tap and forwards revenue; a whale slides the price
///         under book; an exit round opens and a holder redeems; the agent stops and anyone opens the treasury.
///         Time between scenes is advanced by scripts/dev-demo.sh (evm_increaseTime), never by this script.
/// @dev forge script script/Demo.s.sol --sig "run(string)" <scene> --rpc-url http://127.0.0.1:8545 --broadcast
///      Scenes: create raise finalize claim trade tap revenue report slide poke poke-noatlas redeem heartbeat
///      abandon redeem-after status.
contract Demo is Script, StackBuilder, LocalJson {
    uint256 internal constant DEFAULT_BNB_USD = 600 ether;

    Local internal L;

    function run(string calldata scene) external {
        L = _readLocal();
        bytes32 s = keccak256(bytes(scene));
        if (s == keccak256("create")) _create();
        else if (s == keccak256("raise")) _raise();
        else if (s == keccak256("finalize")) _finalize();
        else if (s == keccak256("claim")) _claim();
        else if (s == keccak256("trade")) _trade();
        else if (s == keccak256("tap")) _tap();
        else if (s == keccak256("revenue")) _revenue();
        else if (s == keccak256("report")) _report();
        else if (s == keccak256("slide")) _slide();
        else if (s == keccak256("poke")) _poke(_bnbUsd());
        else if (s == keccak256("poke-noatlas")) _poke(0);
        else if (s == keccak256("redeem")) _redeem(IDX_BUYER1);
        else if (s == keccak256("heartbeat")) _heartbeat();
        else if (s == keccak256("abandon")) _abandon();
        else if (s == keccak256("redeem-after")) _redeem(IDX_BUYER2);
        else if (s == keccak256("status")) {
            _status();
            return;
        } else {
            revert(string.concat("unknown scene: ", scene));
        }
        L.demo.scene = scene;
        _writeLocal(L);
        _status();
    }

    function _bnbUsd() internal view returns (uint256) {
        return vm.envOr("DEMO_BNB_USD", DEFAULT_BNB_USD);
    }

    // ── scenes ─────────────────────────────────────────────────────────────

    /// @dev The issuer agent registers its ERC-8004 identity and opens a covenant on the demo factory.
    function _create() internal {
        address team = _addr(IDX_TEAM);
        vm.startBroadcast(_key(IDX_TEAM));
        uint256 agentId = IERC8004Identity(L.a.identityRegistry).register("ipfs://covenant-demo/issuer-agent.json");
        vm.stopBroadcast();

        bytes32 salt = _mineSalt(L.a.portal, L.a.tokenImpl, keccak256(abi.encode("covenant-demo", block.timestamp)));
        Terms memory t = CovenantProfiles.demoTerms("Covenant Agent", "CVNA", salt, team);
        t.meta = "ipfs://covenant-demo/token.json";
        t.agentId = agentId;
        t.reportRelayer = _addr(IDX_RELAYER);

        uint256 fee = IPortal(L.a.portal).SALT_LOCK_FEE();
        vm.startBroadcast(_key(IDX_TEAM));
        address launcher = IPortal(L.a.portal).newLauncher{value: fee}(L.a.demoLauncherFactory, abi.encode(t));
        vm.stopBroadcast();
        L.demo.launcher = launcher;
        L.demo.agentId = agentId;
        console2.log("agent id", agentId);
        console2.log("launcher", launcher);
    }

    function _raise() internal {
        CovenantLauncher l = CovenantLauncher(payable(L.demo.launcher));
        _contribute(l, IDX_BUYER1, 14 ether); // the design doc's 14 BNB buyer
        _contribute(l, IDX_BUYER2, 386 ether);
        _contribute(l, IDX_BUYER3, 400 ether);
        _contribute(l, IDX_WHALE, 600 ether);
        console2.log("committed (BNB)", l.committed() / 1e18);
    }

    function _contribute(CovenantLauncher l, uint32 who, uint256 amount) internal {
        vm.startBroadcast(_key(who));
        l.contribute{value: amount}();
        vm.stopBroadcast();
    }

    function _finalize() internal {
        CovenantLauncher l = CovenantLauncher(payable(L.demo.launcher));
        vm.startBroadcast(_key(IDX_KEEPER));
        l.finalize{gas: 20_000_000}();
        vm.stopBroadcast();
        require(l.state() == State.ACTIVE, "the launch did not go through");
        L.demo.vault = l.vault();
        L.demo.token = l.token();
        L.demo.pair = l.pool();
        L.demo.taxProcessor = _processor(l.token());
        console2.log("token", l.token());
        console2.log("vault", l.vault());
    }

    function _processor(address token) internal view returns (address) {
        if (keccak256(bytes(L.mode)) == keccak256("mock")) return MockPortal(L.a.portal).taxProcessorOf(token);
        return ITaxToken(token).taxProcessor();
    }

    /// @dev Buyers take their tokens and refunds; the keeper's first poke records the dollar sale price.
    function _claim() internal {
        CovenantLauncher l = CovenantLauncher(payable(L.demo.launcher));
        CovenantVault v = CovenantVault(payable(L.demo.vault));
        uint32[4] memory who = [IDX_BUYER1, IDX_BUYER2, IDX_BUYER3, IDX_WHALE];
        for (uint256 i; i < 4; ++i) {
            vm.startBroadcast(_key(who[i]));
            v.claimTokens();
            if (l.refundOf(_addr(who[i])) > 0) l.claimRefund();
            vm.stopBroadcast();
        }
        _poke(_bnbUsd());
        _heartbeat();
    }

    /// @dev Trading on the pool leaves tax; dispatch sends the vault its share in BNB.
    function _trade() internal {
        address token = L.demo.token;
        address trader = _addr(IDX_TRADER);
        vm.startBroadcast(_key(IDX_TRADER));
        _swapIn(token, trader, 40 ether);
        for (uint256 i; i < 6; ++i) {
            uint256 amt = IERC20(token).balanceOf(trader) * 30 / 100;
            uint256 before = trader.balance;
            _swapOut(token, trader, amt);
            uint256 proceeds = trader.balance - before;
            if (proceeds > 0) _swapIn(token, trader, proceeds * 90 / 100);
        }
        ITaxProcessor(L.demo.taxProcessor).dispatch();
        vm.stopBroadcast();
        console2.log("tax revenue so far (wei)", CovenantVault(payable(L.demo.vault)).totalRevenue());
    }

    function _tap() internal {
        _poke(_bnbUsd());
        CovenantVault v = CovenantVault(payable(L.demo.vault));
        if (v.owedTeam() == 0) return;
        vm.startBroadcast(_key(IDX_TEAM));
        v.claimTap();
        vm.stopBroadcast();
        console2.log("tap paid (wei)", v.tapPaid());
    }

    /// @dev The agent earns once (a data sale) and forwards it to the vault.
    function _revenue() internal {
        vm.startBroadcast(_key(IDX_TEAM));
        CovenantVault(payable(L.demo.vault)).depositRevenue{value: 2 ether}("x402:market-data");
        vm.stopBroadcast();
    }

    function _report() internal {
        vm.startBroadcast(_key(IDX_TEAM));
        CovenantVault(payable(L.demo.vault)).postReport(
            1, "ipfs://covenant-demo/report-1.json", keccak256("covenant-demo report 1")
        );
        vm.stopBroadcast();
    }

    /// @dev The whale sells everything into the pool: the price falls under book value.
    function _slide() internal {
        address whale = _addr(IDX_WHALE);
        vm.startBroadcast(_key(IDX_WHALE));
        _swapOut(L.demo.token, whale, IERC20(L.demo.token).balanceOf(whale));
        vm.stopBroadcast();
    }

    function _poke(uint256 price) internal {
        bytes memory data = _pokeCalldata(L.demo.vault, _key(IDX_ATLAS), price, block.timestamp);
        vm.startBroadcast(_key(IDX_KEEPER));
        (bool ok, bytes memory ret) = L.a.oracle.call(data);
        vm.stopBroadcast();
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    function _redeem(uint32 who) internal {
        CovenantVault v = CovenantVault(payable(L.demo.vault));
        address a = _addr(who);
        uint256 bal = IERC20(L.demo.token).balanceOf(a);
        uint256 quote = v.previewRedeem(bal);
        vm.startBroadcast(_key(who));
        IERC20(L.demo.token).approve(address(v), bal);
        uint256 out = v.redeem(bal, quote);
        vm.stopBroadcast();
        console2.log("redeemed tokens", bal / 1e18);
        console2.log("for (wei)", out);
    }

    function _heartbeat() internal {
        vm.startBroadcast(_key(IDX_TEAM));
        CovenantVault(payable(L.demo.vault)).heartbeat();
        vm.stopBroadcast();
    }

    /// @dev The agent has stopped. Anyone (the keeper) flips the switch.
    function _abandon() internal {
        vm.startBroadcast(_key(IDX_KEEPER));
        CovenantVault(payable(L.demo.vault)).declareAbandoned{gas: 3_000_000}();
        vm.stopBroadcast();
    }

    // ── helpers ────────────────────────────────────────────────────────────

    function _swapIn(address token, address to, uint256 bnb) internal {
        address[] memory path = new address[](2);
        path[0] = L.a.wbnb;
        path[1] = token;
        IRouterV2(L.a.router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnb}(
            0, path, to, block.timestamp + 600
        );
    }

    function _swapOut(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = L.a.wbnb;
        IERC20(token).approve(L.a.router, amount);
        IRouterV2(L.a.router).swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount, 0, path, to, block.timestamp + 600
        );
    }

    function _status() internal view {
        if (L.demo.launcher == address(0)) {
            console2.log("no covenant yet");
            return;
        }
        CovenantLens.Status memory s = CovenantLens(L.a.lens).status(L.demo.launcher);
        console2.log("scene", L.demo.scene);
        console2.log("state", CovenantVaultDisplay.stateName(s.state));
        console2.log("committed / accepted (BNB)", s.committed / 1e18, s.accepted / 1e18);
        if (s.vault == address(0)) return;
        console2.log("treasury (wei)", s.treasury);
        console2.log("book value / spot (BNB per token, 1e18)", s.bookValue, s.spotBnb);
        console2.log("exit streak (s) / needed", s.exitStreak, s.exitStreakNeeded);
        console2.log("tap owed / paid (wei)", s.owedTeam, s.tapPaid);
        console2.log("heartbeat deadline", s.heartbeatDeadline);
        console2.log("now", block.timestamp);
    }
}
