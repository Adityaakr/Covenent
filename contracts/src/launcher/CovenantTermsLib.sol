// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Terms, Profile} from "src/vault/CovenantTypes.sol";

/// @notice The bounds the launcher factory enforces on every covenant's terms, and the token split they imply.
library CovenantTermsLib {
    uint256 internal constant BPS = 10_000;

    uint256 internal constant MIN_SUPPLY = 1_000_000 ether;
    uint256 internal constant MAX_SUPPLY = 1_000_000_000_000 ether;
    uint256 internal constant MAX_CAP = 100_000 ether;
    uint256 internal constant MAX_TRANCHES = 8;
    uint256 internal constant MAX_MULTIPLE = 10_000; // 100x
    uint256 internal constant MAX_TAX_BPS = 1_000;
    uint256 internal constant MAX_TAP_CAP_BPS = 1_000;
    uint256 internal constant MAX_EXIT_FEE_BPS = 300;
    uint256 internal constant MIN_SALE_BPS = 4_000;
    uint256 internal constant MIN_POOL_BPS = 500;
    uint256 internal constant MAX_TEAM_BPS = 3_000;
    uint256 internal constant MAX_ROUND = 90 days;
    uint256 internal constant MAX_COOLDOWN = 365 days;
    uint256 internal constant MAX_UNLOCK_WINDOW = 365 days;
    uint256 internal constant MAX_TAP_USD = 1e9 ether; // a billion dollars a month is not a budget
    uint256 internal constant MAX_NAME = 64;
    uint256 internal constant MAX_SYMBOL = 16;
    uint256 internal constant MAX_META = 512;

    error BadText();
    error BadSupply(uint256 supply);
    error BadSplit(uint256 saleBps, uint256 poolBps, uint256 teamBps);
    error BadTranches();
    error BadRaise(uint256 minRaise, uint256 cap);
    error PoolSeedBelowFloor(uint256 seed, uint256 floor);
    error BadSaleDuration(uint256 got);
    error BadTax();
    error BadTeamWallet();
    error BadTap();
    error BadUnlock();
    error BadExit();
    error BadHeartbeat(uint256 got);

    struct Split {
        uint256 sale; // A
        uint256 pool; // P
        uint256 team; // E = S - A - P
    }

    /// @notice The exact token amounts of a covenant's split. Every share is exact because S is a multiple of 10_000.
    function split(Terms memory t) internal pure returns (Split memory s) {
        s.sale = t.totalSupply * t.saleBps / BPS;
        s.pool = t.totalSupply * t.poolBps / BPS;
        s.team = t.totalSupply - s.sale - s.pool;
    }

    /// @notice Reverts unless `t` is inside the bounds of the design document and of `p`.
    function validate(Terms memory t, Profile memory p) internal pure {
        uint256 nameLen = bytes(t.name).length;
        uint256 symLen = bytes(t.symbol).length;
        if (nameLen == 0 || nameLen > MAX_NAME || symLen == 0 || symLen > MAX_SYMBOL) revert BadText();
        if (bytes(t.meta).length > MAX_META || t.salt == bytes32(0)) revert BadText();

        if (t.totalSupply < MIN_SUPPLY || t.totalSupply > MAX_SUPPLY || t.totalSupply % BPS != 0) {
            revert BadSupply(t.totalSupply);
        }

        // Split: buyers hold the largest share, the pool opens at the sale price, the team is capped.
        uint256 sale = t.saleBps;
        uint256 pool = t.poolBps;
        if (sale + pool > BPS) revert BadSplit(sale, pool, 0);
        uint256 team = BPS - sale - pool;
        if (sale < MIN_SALE_BPS || pool < MIN_POOL_BPS || pool > sale || team > MAX_TEAM_BPS) {
            revert BadSplit(sale, pool, team);
        }

        // Tranches: one entry per team slice, sizes summing to the team share, multiples above the sale price.
        uint256 n = t.trancheBps.length;
        if (n != t.trancheMultiple.length || n > MAX_TRANCHES) revert BadTranches();
        if (team > 0 && n == 0) revert BadTranches();
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            if (t.trancheBps[i] == 0) revert BadTranches();
            if (t.trancheMultiple[i] <= 100 || t.trancheMultiple[i] > MAX_MULTIPLE) revert BadTranches();
            sum += t.trancheBps[i];
        }
        if (sum != team) revert BadTranches();

        // Raise. The seed the minimum raise implies must clear Flap's creation floor, or the launch reverts.
        if (t.minRaise == 0 || t.cap < t.minRaise || t.cap > MAX_CAP) revert BadRaise(t.minRaise, t.cap);
        uint256 minSeed = t.minRaise * pool / sale;
        if (minSeed < p.minPoolQuote) revert PoolSeedBelowFloor(minSeed, p.minPoolQuote);
        if (t.saleDuration < p.minSaleDuration || t.saleDuration > p.maxSaleDuration) {
            revert BadSaleDuration(t.saleDuration);
        }

        if (t.buyTaxBps > MAX_TAX_BPS || t.sellTaxBps > MAX_TAX_BPS) revert BadTax();

        // Rule 1.
        if (t.teamWallet == address(0)) revert BadTeamWallet();
        if (t.tapCapBps > MAX_TAP_CAP_BPS || t.tapUsdPer30d > MAX_TAP_USD) revert BadTap();

        // Rule 2.
        if (t.cliff > p.maxCliff || t.unlockWindow < p.minUnlockWindow || t.unlockWindow > MAX_UNLOCK_WINDOW) {
            revert BadUnlock();
        }

        // Rule 3.
        if (
            t.exitStreak < p.minExitStreak || t.exitStreak > p.maxExitStreak || t.roundLength < p.minRoundLength
                || t.roundLength > MAX_ROUND || t.cooldown < p.minCooldown || t.cooldown > MAX_COOLDOWN
                || t.exitFeeBps > MAX_EXIT_FEE_BPS
        ) revert BadExit();

        // Rule 4.
        if (t.heartbeat < p.minHeartbeat || t.heartbeat > p.maxHeartbeat) revert BadHeartbeat(t.heartbeat);
    }
}
