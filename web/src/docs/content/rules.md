The rules live in `CovenantVault` and run on every covenant the same way. The team sets the numbers once, when it creates the covenant, inside bounds the launcher factory enforces. After that, the only change anyone can make is to lower the budget.

## 1. Tap: a budget that only goes down

The team wallet draws a budget set in US dollars per 30 days, paid in BNB at the Atlas BNB/USD rate, and never more than a fixed share of the treasury per 30 days. The tap accrues at each price observation and pauses during exit rounds. What the team has not claimed never exceeds one period's cap. `lowerTap()` cuts it, permanently; nothing can raise it.

## 2. Performance unlock: team tokens unlock on price

The team's tokens sit locked in tranches. A tranche unlocks only after the price has held at or above its multiple of the sale price for the whole unlock window, after the cliff. The multiple must hold in dollars (pool price times Atlas BNB/USD) and in BNB (pool price against the BNB sale price), so a wrong BNB/USD rate alone cannot unlock anything. A dip below the multiple restarts the count. Anyone can then call `releaseTeam()` to send unlocked tokens to the team wallet.

## 3. Book-value exit: holders can leave at the treasury's value

When the pool's time-weighted price stays below book value for the exit streak, an exit round opens. During the round any holder can burn tokens for their share of the treasury, less the exit fee, which stays in the treasury for those who stay. After the round comes a cooldown, then normal life again. This rule uses on-chain numbers only, with no oracle. See [the exit streak](/docs/concepts#the-exit-streak-decays).

## 4. Abandonment switch: a silent team loses the treasury

If the team wallet sends no heartbeat for the heartbeat window, anyone can call `declareAbandoned()`. The covenant ends: unclaimed budget goes back to the treasury, locked team tokens are burned, and holders can redeem at book value with no fee and no deadline. Claiming the tap, lowering it, posting a report, depositing revenue and `heartbeat()` itself all count as heartbeats when the team wallet sends them.

## 5. Disclosure: reports on chain

The team posts each period's report with `postReport(period, uri, hash)`: where the report lives and the keccak256 hash of its text. Each period can be posted once. A covenant can name a report relayer at creation (never the team wallet); while any period stands failed by its verdict, the tap stops accruing.

## Default terms and bounds

The default terms are `CovenantProfiles.defaultTerms` in the contracts; the bounds are what the production launcher factory accepts. The demo factory runs the same rules with timers in minutes (sale 2 minutes, exit streak 3, round 5, cooldown 2, heartbeat 10, no cliff) and needs only Flap's creation floor, so a whole lifecycle fits a demo.

| Term | Default | Allowed range |
|---|---|---|
| Supply split | 60% sale, 15% pool, 25% team | sale at least 40%, pool 5% to the sale share, team at most 30% |
| Raise | minimum 200 BNB, cap 500 BNB, 4-day sale | sale of 1 to 30 days, cap at most 100,000 BNB; the pool seed at the minimum must be 1.5x Flap's graduation floor |
| Trading tax | 1% buy, 1% sell, for 100 years | the higher side at least 1%, each at most 10%, for 30 days to 100 years |
| Tap (rule 1) | $30,000 per 30 days, capped at 4% of the treasury | cap at most 10% |
| Unlock (rule 2) | 5% at 2x, 10% at 4x, 10% at 8x; 180-day cliff; 30-day window | up to 8 tranches, multiples above 1x up to 100x; cliff up to 730 days; window 7 to 365 days |
| Exit (rule 3) | 3-day streak, 7-day round, 14-day cooldown, 1% fee | streak 1 to 14 days, round 3 to 90 days, cooldown 1 to 365 days, fee at most 3% |
| Abandonment (rule 4) | 45-day heartbeat window | 14 to 90 days |
