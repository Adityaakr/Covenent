The rules live in `CovenantVault` and run on every covenant the same way. The team sets the numbers once, when it creates the covenant, inside bounds the launcher factory enforces. After that, the only change anyone can make is to lower the budget. Every number on this page comes from the contracts: the defaults from `CovenantProfiles.defaultTerms`, the bounds from `CovenantTermsLib` and the two factory profiles from `CovenantProfiles`, all in [`contracts/src/launcher`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/launcher/CovenantProfiles.sol).

## The five rules

| Rule | In one line | In depth |
|---|---|---|
| **1. Tap** | A dollar budget per 30 days, paid in BNB at the Atlas rate, never more than a share of the treasury; it only goes down | [The budget](/docs/budget) |
| **2. Performance unlock** | Team tokens unlock only after the price holds at a multiple of the sale price, in dollars and in BNB, for the unlock window, after the cliff | [Team unlocks](/docs/unlocks) |
| **3. Book-value exit** | A streak of time below book value opens an exit round in which any holder redeems at book, less the exit fee | [The exit](/docs/exit) |
| **4. Abandonment switch** | After the heartbeat window without a sign of life, anyone ends the covenant and opens the treasury to holders, fee-free, forever | [Heartbeats and the end](/docs/heartbeats) |
| **5. Disclosure** | The team posts each period's report pointer and hash on chain; a relayer's failed verdict, when one is named, pauses the budget | [Reports on chain](/docs/heartbeats#reports-on-chain) |

## Default terms and bounds

| Term | Default | Allowed range (production factory) |
|---|---|---|
| Supply | 1,000,000,000 tokens | 1,000,000 to 1,000,000,000,000, a multiple of 10,000 |
| Supply split | 60% sale, 15% pool, 25% team | sale at least 40%, pool from 5% up to the sale share, team at most 30% |
| Raise | minimum 200 BNB, cap 500 BNB, 4-day sale | sale of 1 to 30 days, cap at most 100,000 BNB; the pool seed at the minimum must clear 1.5x Flap's graduation floor (`minRaiseFor`) |
| Trading tax | 1% buy, 1% sell, for 100 years | each side at most 10%, the higher side at least 1%, for 30 days to 100 years |
| Tap (rule 1) | $30,000 per 30 days, capped at 4% of the treasury | cap at most 10%; at most $1,000,000,000 per 30 days |
| Unlock (rule 2) | 5% at 2x, 10% at 4x, 10% at 8x; 180-day cliff; 30-day unlock window | up to 8 tranches, multiples above 1x up to 100x, sizes adding up to the team share; cliff up to 730 days; window 7 to 365 days |
| Exit (rule 3) | 3-day streak, 7-day round, 14-day cooldown, 1% fee | streak 1 to 14 days, round 3 to 90 days, cooldown 1 to 365 days, fee at most 3% |
| Abandonment (rule 4) | 45-day heartbeat window | 14 to 90 days |
| Disclosure (rule 5) | no report relayer | any address but the team wallet, or none |
| Name and symbol | the creator's | 1 to 64 bytes and 1 to 16 bytes, not on Flap's blocklist; metadata up to 512 bytes |
| Agent id | 0 (a human team) | an ERC-8004 identity owned by the team wallet |

## Production and demo factories

Two factory pairs run the same rules. The demo pair runs its clocks in minutes so a whole lifecycle fits a demo, and needs only Flap's creation floor (a demo token launches but may not graduate on Flap).

| Profile setting | Production | Demo |
|---|---|---|
| Sale length | 1 to 30 days | 60 seconds to 30 days |
| Exit streak, at least | 1 day | 60 seconds |
| Exit round, at least | 3 days | 60 seconds |
| Cooldown, at least | 1 day | 60 seconds |
| Heartbeat window | 14 to 90 days | 60 seconds to 90 days |
| Unlock window, at least | 7 days | 60 seconds |
| Poke gap (one observation per vault per) | 1 hour | 20 seconds |
| Most time one observation counts | 6 hours | 60 seconds |
| Dollar sale price can rise for | 14 days | 1 hour |
| Flap floor the minimum raise must clear | graduation floor, 1.5x | creation floor, 1.5x |
| A refused launch can be retried for | 3 days after the deadline | 10 minutes |

The app's **Demo timers** preset fills the demo column: a 2-minute sale, a 2-minute unlock window with no cliff, a 3-minute exit streak, a 5-minute round, a 2-minute cooldown and a 10-minute heartbeat window.

## Checking terms before you create

`checkTerms(terms)` on a launcher factory runs every check `newLauncher` runs (the bounds, Flap's name screen, Flap's floor and the agent id) and reverts with the reason if one fails. `minRaiseFor(supply, saleBps, poolBps)` answers the smallest minimum raise the factory accepts for a split, from Flap's live floor. The app's Create page and Covenant AI call both as you type.
