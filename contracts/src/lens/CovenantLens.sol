// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {State, Terms, VaultEnv, ICovenantLauncher} from "src/vault/CovenantTypes.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {IERC8004Identity, IERC8004Reputation} from "src/agent/IERC8004.sol";

interface ILauncherFactoryList {
    function launcherCount() external view returns (uint256);
    function launcherAt(uint256 i) external view returns (address);
}

/// @title CovenantLens
/// @notice Read-only aggregation for the app, the keeper and the MCP server: one call returns a covenant's status,
///         its downside for a holder, or its issuer. Stateless, no owner, safe to redeploy at will.
contract CovenantLens {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;

    struct Status {
        address launcher;
        address vault;
        address token;
        address pair;
        State state; // launcher state before launch, vault state after
        // raise
        uint256 committed;
        uint256 accepted;
        uint256 minRaise;
        uint256 cap;
        uint64 saleDeadline;
        uint256 contributorCount;
        // treasury and prices (BNB, 1e18; prices are BNB per token)
        uint256 treasury;
        uint256 owedTeam;
        uint256 bookValue;
        uint256 salePriceBnb;
        uint256 spotBnb;
        uint256 lastTwapBnb;
        int256 premiumBps; // spot vs book: negative = trading under book
        uint256 redeemableSupply;
        uint256 lockedTeam;
        uint256 totalRevenue;
        uint256 tapPaid;
        uint256 totalRedeemed;
        // rule 1
        uint256 tapUsdPer30d;
        uint256 tapCapPer30d;
        uint256 lastBnbUsd;
        bool disclosurePaused;
        // rule 3
        uint256 exitStreak;
        uint256 exitStreakNeeded;
        uint64 roundEnd;
        uint64 cooldownEnd;
        uint64 roundsOpened;
        // rule 4
        uint64 lastHeartbeat;
        uint256 heartbeatDeadline;
        bool abandonable;
        // oracle
        uint64 lastObservedAt;
        uint256 nextPokeAt;
        bool lastTrusted;
        bool lastStrict;
        bool lastAtlas;
        bool lastDeep;
        // rule 2
        uint256 usdSalePrice;
        Tranche[] tranches;
        // issuer
        address teamWallet;
        uint256 agentId;
    }

    struct Tranche {
        uint256 amount;
        uint256 multiple;
        uint256 progress;
        uint256 window;
        bool unlocked;
        uint256 targetUsd;
    }

    struct Downside {
        uint256 tokens; // the position measured
        uint256 redeemNow; // BNB it redeems for right now (0 outside a round or wind-down)
        uint256 atBookGross; // BNB at book value before any fee
        uint256 atBookNet; // after the exit fee (what a round would pay today)
        uint256 bookValue;
        uint256 floorBpsOfSale; // book value as a share of the sale price, bps
        uint256 spendPer30d; // tap at today's rate (min of the dollar budget and the cap), BNB
        uint256 runwayDays; // free treasury / spend, at today's rate with no income
        uint256 floorIn12MonthsBpsOfSale; // floor after 12 months at the cap with no income or redemptions
    }

    struct Issuer {
        address teamWallet;
        uint256 agentId;
        address identityRegistry;
        address reputationRegistry;
        bool agentBound;
        address agentOwner;
        string agentURI;
        uint256 outcomesFromThisVault;
        uint64 lastHeartbeat;
        uint256 heartbeatDeadline;
        uint256 reportsPosted;
    }

    function status(address launcher) public view returns (Status memory s) {
        ICovenantLauncher l = ICovenantLauncher(launcher);
        Terms memory t = l.terms();
        s.launcher = launcher;
        s.state = l.state();
        s.committed = l.committed();
        s.accepted = l.accepted();
        s.minRaise = t.minRaise;
        s.cap = t.cap;
        s.saleDeadline = l.saleDeadline();
        s.teamWallet = t.teamWallet;
        s.agentId = t.agentId;
        s.tapUsdPer30d = t.tapUsdPer30d;
        s.exitStreakNeeded = t.exitStreak;
        (bool ok, bytes memory ret) = launcher.staticcall(abi.encodeWithSignature("contributorCount()"));
        if (ok && ret.length == 32) s.contributorCount = abi.decode(ret, (uint256));

        address v = l.vault();
        if (v == address(0)) return s;
        _fillVault(s, CovenantVault(payable(v)));
    }

    function _fillVault(Status memory s, CovenantVault v) internal view {
        s.vault = address(v);
        s.token = v.taxToken();
        s.pair = v.pair();
        s.state = v.state();
        s.treasury = address(v).balance;
        s.owedTeam = v.owedTeam();
        s.bookValue = v.bookValue();
        s.salePriceBnb = v.salePriceBnb();
        s.lastTwapBnb = v.lastTwap();
        s.redeemableSupply = v.redeemableSupply();
        s.lockedTeam = v.lockedTeam();
        s.totalRevenue = v.totalRevenue();
        s.tapPaid = v.tapPaid();
        s.totalRedeemed = v.totalRedeemed();
        s.tapUsdPer30d = v.tapUsdPer30d();
        s.tapCapPer30d = v.tapCapPer30d();
        s.lastBnbUsd = v.lastBnbUsd();
        s.disclosurePaused = v.disclosurePaused();
        s.exitStreak = v.exitStreak();
        s.roundEnd = v.roundEnd();
        // cooldownEnd is only written when someone ticks; it always equals roundEnd + cooldown.
        if (s.roundsOpened > 0 || v.roundsOpened() > 0) s.cooldownEnd = uint64(uint256(s.roundEnd) + v.cooldown());
        s.roundsOpened = v.roundsOpened();
        s.lastHeartbeat = v.lastHeartbeat();
        s.heartbeatDeadline = v.heartbeatDeadline();
        s.abandonable = v.abandonable();
        s.lastObservedAt = v.lastObservedAt();
        s.lastTrusted = v.lastTrusted();
        s.lastStrict = v.lastStrict();
        s.lastAtlas = v.lastAtlas();
        s.lastDeep = v.lastDeep();
        s.usdSalePrice = v.usdSalePrice();

        VaultEnv memory e = v.env();
        try CovenantOracle(e.oracle).preview(address(v)) returns (uint256, uint256 spot, uint32, bool, uint256) {
            s.spotBnb = spot;
        } catch {}
        try CovenantOracle(e.oracle).nextPokeAt(address(v)) returns (uint256 next) {
            s.nextPokeAt = next;
        } catch {}
        if (s.bookValue > 0 && s.spotBnb > 0) {
            s.premiumBps = (int256(s.spotBnb) - int256(s.bookValue)) * int256(BPS) / int256(s.bookValue);
        }

        uint256 n = v.trancheCount();
        s.tranches = new Tranche[](n);
        uint256 window = v.unlockWindow();
        for (uint256 k; k < n; ++k) {
            (uint256 amount, uint256 multiple, uint256 progress, bool unlocked, uint256 targetUsd) =
                v.trancheProgress(k);
            s.tranches[k] = Tranche(amount, multiple, progress, window, unlocked, targetUsd);
        }
    }

    /// @notice Status of several covenants in one call.
    function statuses(address[] calldata launchers) external view returns (Status[] memory out) {
        out = new Status[](launchers.length);
        for (uint256 i; i < launchers.length; ++i) {
            out[i] = status(launchers[i]);
        }
    }

    /// @notice Every launcher a factory created, newest last, with `offset`/`limit` paging.
    function list(address launcherFactory, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory launchers, uint256 total)
    {
        ILauncherFactoryList f = ILauncherFactoryList(launcherFactory);
        total = f.launcherCount();
        if (offset >= total) return (new address[](0), total);
        uint256 end = offset + limit > total ? total : offset + limit;
        launchers = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            launchers[i - offset] = f.launcherAt(i);
        }
    }

    /// @notice What `tokens` redeem for at book today, the floor against the sale price and the runway.
    ///         Pass `holder` instead of `tokens` (tokens = 0) to measure that holder's balance plus unclaimed sale
    ///         tokens.
    function downside(address vault, address holder, uint256 tokens) external view returns (Downside memory d) {
        CovenantVault v = CovenantVault(payable(vault));
        if (tokens == 0 && holder != address(0)) {
            tokens = IERC20(v.taxToken()).balanceOf(holder) + v.claimableTokens(holder);
        }
        d.tokens = tokens;
        d.bookValue = v.bookValue();
        d.atBookGross = tokens * d.bookValue / WAD;
        d.atBookNet = d.atBookGross - d.atBookGross * v.exitFeeBps() / BPS;
        d.redeemNow = v.previewRedeem(tokens);
        uint256 sale = v.salePriceBnb();
        if (sale > 0) d.floorBpsOfSale = d.bookValue * BPS / sale;

        uint256 free = v.freeTreasury();
        uint256 cap = free * v.tapCapBps() / BPS;
        uint256 spend = cap;
        uint256 bnbUsd = v.lastBnbUsd();
        if (bnbUsd > 0) {
            uint256 usdBnb = v.tapUsdPer30d() * WAD / bnbUsd;
            if (usdBnb < spend) spend = usdBnb;
        }
        if (v.state() == State.WIND_DOWN) spend = 0;
        d.spendPer30d = spend;
        d.runwayDays = spend == 0 ? type(uint256).max : free * 30 / spend;

        uint256 left = BPS;
        for (uint256 m; m < 12; ++m) {
            left = left * (BPS - v.tapCapBps()) / BPS;
        }
        d.floorIn12MonthsBpsOfSale = d.floorBpsOfSale * left / BPS;
    }

    /// @notice The issuer behind a covenant: team wallet, ERC-8004 agent id and record from this vault.
    function issuer(address vault) external view returns (Issuer memory i) {
        CovenantVault v = CovenantVault(payable(vault));
        VaultEnv memory e = v.env();
        i.teamWallet = v.teamWallet();
        i.agentId = v.agentId();
        i.identityRegistry = e.identity;
        i.reputationRegistry = e.reputation;
        i.lastHeartbeat = v.lastHeartbeat();
        i.heartbeatDeadline = v.heartbeatDeadline();
        i.reportsPosted = v.reportsPosted();
        if (i.agentId == 0) return i;
        if (e.identity != address(0) && e.identity.code.length > 0) {
            try IERC8004Identity(e.identity).ownerOf(i.agentId) returns (address o) {
                i.agentOwner = o;
                i.agentBound = o == i.teamWallet;
            } catch {}
            try IERC8004Identity(e.identity).tokenURI(i.agentId) returns (string memory u) {
                i.agentURI = u;
            } catch {}
        }
        if (e.reputation != address(0) && e.reputation.code.length > 0) {
            try IERC8004Reputation(e.reputation).getLastIndex(i.agentId, vault) returns (uint64 n) {
                i.outcomesFromThisVault = n;
            } catch {}
        }
    }
}
