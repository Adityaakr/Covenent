// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Profile, Terms} from "src/vault/CovenantTypes.sol";

/// @notice The two launcher factory profiles (design doc, Appendix A) and the default terms used in every example.
library CovenantProfiles {
    /// @notice Production bounds: the design document's ranges and oracle timing.
    function production() internal pure returns (Profile memory p) {
        p.minSaleDuration = 1 days;
        p.maxSaleDuration = 30 days;
        p.minExitStreak = 1 days;
        p.maxExitStreak = 14 days;
        p.minRoundLength = 3 days;
        p.minCooldown = 1 days;
        p.minHeartbeat = 14 days;
        p.maxHeartbeat = 90 days;
        p.minUnlockWindow = 7 days;
        p.maxCliff = 730 days;
        p.minPokeGap = 1 hours;
        p.maxStep = 6 hours;
        p.staleAfter = 14 days;
        p.antiFarmerDuration = 1 days;
        p.requireGraduation = true;
        p.launchRetryWindow = 3 days;
    }

    /// @notice Demo bounds: the same rules with time in minutes, for the stage and the local stack only.
    function demo() internal pure returns (Profile memory p) {
        p.minSaleDuration = 60;
        p.maxSaleDuration = 30 days;
        p.minExitStreak = 60;
        p.maxExitStreak = 14 days;
        p.minRoundLength = 60;
        p.minCooldown = 60;
        p.minHeartbeat = 60;
        p.maxHeartbeat = 90 days;
        p.minUnlockWindow = 60;
        p.maxCliff = 730 days;
        p.minPokeGap = 20;
        p.maxStep = 60;
        p.staleAfter = 1 hours;
        p.antiFarmerDuration = 1 days;
        p.requireGraduation = false; // Flap's creation floor with the 1.5x margin: a demo token launches, it may not graduate
        p.launchRetryWindow = 10 minutes;
    }

    /// @notice Default terms (Appendix A): 1B supply, 60% sale, 15% pool, 25% team at 2x/4x/8x, 200 to 500 BNB,
    ///         1% taxes for 100 years (the longest the factory allows: the tax is the treasury's revenue stream),
    ///         $30k tap capped at 4%, 6-month cliff, 30-day unlock window, 3-day exit streak, 7-day round,
    ///         14-day cooldown, 1% exit fee, 45-day heartbeat. Name, symbol, salt and team are the caller's.
    function defaultTerms(string memory name, string memory symbol, bytes32 salt, address team)
        internal
        pure
        returns (Terms memory t)
    {
        t.name = name;
        t.symbol = symbol;
        t.meta = "";
        t.salt = salt;
        t.totalSupply = 1_000_000_000 ether;
        t.saleBps = 6_000;
        t.poolBps = 1_500;
        t.trancheBps = new uint16[](3);
        t.trancheBps[0] = 500;
        t.trancheBps[1] = 1_000;
        t.trancheBps[2] = 1_000;
        t.trancheMultiple = new uint16[](3);
        t.trancheMultiple[0] = 200;
        t.trancheMultiple[1] = 400;
        t.trancheMultiple[2] = 800;
        t.minRaise = 200 ether;
        t.cap = 500 ether;
        t.saleDuration = 4 days;
        t.buyTaxBps = 100;
        t.sellTaxBps = 100;
        t.taxDuration = 100 * 365 days;
        t.teamWallet = team;
        t.tapUsdPer30d = 30_000 ether;
        t.tapCapBps = 400;
        t.cliff = 180 days;
        t.unlockWindow = 30 days;
        t.exitStreak = 3 days;
        t.roundLength = 7 days;
        t.cooldown = 14 days;
        t.exitFeeBps = 100;
        t.heartbeat = 45 days;
    }

    /// @notice The demo column of Appendix A: sale 2 min, unlock window 2 min, no cliff, exit streak 3 min,
    ///         round 5 min, cooldown 2 min, heartbeat 10 min.
    function demoTerms(string memory name, string memory symbol, bytes32 salt, address team)
        internal
        pure
        returns (Terms memory t)
    {
        t = defaultTerms(name, symbol, salt, team);
        t.saleDuration = 120;
        t.cliff = 0;
        t.unlockWindow = 120;
        t.exitStreak = 180;
        t.roundLength = 300;
        t.cooldown = 120;
        t.heartbeat = 600;
    }
}
