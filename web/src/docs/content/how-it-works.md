```covenant
diagram:lifecycle
```

## The whole loop in one example

A covenant with the default terms: 1,000,000,000 tokens, 60% sold, 15% in the pool, 25% for the team; a minimum raise of 200 BNB and a cap of 500 BNB. Buyers commit 1,400 BNB.

| Step | What happens | The numbers |
|---|---|---|
| Raise | Buyers commit BNB for 4 days. No per-wallet limit | 1,400 BNB committed, 2.8x the cap |
| Settle | Anyone calls `finalize()`. Above the cap, every commitment is scaled back pro rata | 500 BNB accepted; 900 BNB refundable; each buyer keeps 35.7% of what they committed |
| Launch | In the same transaction Flap's Portal mints the token, seeds a PancakeSwap pool at the sale price and creates the vault | Sale price 500 / 600M = 0.00000083 BNB per token; pool seed 125 BNB and 150M tokens |
| Vault | The rest of the raise becomes the treasury | 375 BNB |
| Book value | Treasury per redeemable token: the floor a holder can exit at | 375 BNB / 750M tokens = 0.0000005 BNB, 60% of the sale price |
| Budget | The team draws up to $30,000 per 30 days, never more than 4% of the treasury | At most 15 BNB in the first 30 days |
| Exit | If the pool trades below book value for 3 days, a 7-day exit round opens | Any holder burns tokens for book value, less 1% |
| Silence | If the team sends no heartbeat for 45 days, anyone can end the covenant | Redemption at book, no fee, no deadline |

A buyer who committed 14 BNB ends with 6,000,000 tokens for 5 BNB and a 9 BNB refund. From day one, 3 BNB of those 5 is backed by the treasury and can only leave through the rules. The [raise](/docs/raise#worked-example-an-oversubscribed-raise) and [exit](/docs/exit#worked-example-a-redemption) pages work these numbers through in full.

## Where the money goes

```covenant
diagram:moneyflow
```

Money enters through the launcher and leaves the vault only two ways: the team's capped budget to the team wallet fixed at creation, and redemptions to holders. The trading tax (1% on buys and 1% on sells by default) and any revenue the issuer deposits flow into the treasury and raise book value for every holder. [Treasury and book value](/docs/treasury) has the formula.

## The five rules

| Rule | What it does | Default |
|---|---|---|
| **[1. Tap](/docs/budget)** | The team draws a dollar budget per 30 days, paid in BNB at the Atlas rate, capped as a share of the treasury. It can only go down | $30,000, at most 4% |
| **[2. Performance unlock](/docs/unlocks)** | Team tokens unlock only when the price holds at a multiple of the sale price, in dollars and in BNB | 5% of supply at 2x, 10% at 4x, 10% at 8x, after a 180-day cliff |
| **[3. Book-value exit](/docs/exit)** | When the pool trades below book value for the exit streak, any holder can redeem at book | 3-day streak, 7-day round, 1% fee |
| **[4. Abandonment switch](/docs/heartbeats)** | If the team sends no heartbeat for the window, anyone opens the treasury to holders, fee-free, forever | 45 days |
| **[5. Disclosure](/docs/heartbeats#reports-on-chain)** | The team posts each period's report pointer and its hash on chain | every period |

The terms are set once, when the covenant is created, inside bounds the launcher factory enforces. After that the only change anyone can make is to lower the budget. [Rules and defaults](/docs/rules) lists every bound.

## The states

```covenant
diagram:states
```

A covenant is `RAISING` until the deadline, then `ACTIVE` once Flap launches the token, or `FAILED` with full refunds. From `ACTIVE`, a full exit streak opens an `EXIT_ROUND`, followed by a `COOLDOWN` and then `ACTIVE` again. `WIND_DOWN` is the end: the team closed the covenant, or someone declared it abandoned.

## What keeps it running

The contracts need no Covenant server. They move when someone sends a transaction, and every rule can be triggered by anyone:

- **A poke** records a price. About once an hour, the keeper, the app's button, an agent or anyone calls `poke(vault)` on the oracle. Each poke compares the pool's time-weighted price with book value, accrues the budget and steps the unlock counters. [Prices and the oracle](/docs/oracle).
- **finalize()** settles a raise after its deadline.
- **declareAbandoned()** ends a covenant whose team went silent.
- **releaseTeam()** sends unlocked team tokens to the team wallet.

The repository's keeper does all four on a schedule, and any number of keepers can run at once. If none runs, anyone can still press the button.

## What happens when

| Situation | What the rules do |
|---|---|
| The token trades above book value | Normal life. The budget accrues, the exit streak shrinks back toward zero |
| The token slides below book value | The exit streak builds. After 3 days in total (an hour above book cancels an hour below), an exit round opens and holders can redeem at book |
| The team keeps working | Its budget accrues; each claim, report or heartbeat resets the abandonment clock |
| The token proves itself at 2x | After the cliff and 30 days of continuous strict time at 2x, the first tranche unlocks |
| The team or agent goes silent | After 45 days anyone declares it abandoned: unclaimed budget returns to the treasury, locked team tokens burn, redemption opens for good |
| Atlas stops sending rates | The budget is priced at the last verified rate (still within its cap), unlocks stop advancing, and the exit carries on: it never uses Atlas |
| Nobody pokes | Nothing moves. Anyone can poke at any time, and each poke counts at most 6 hours of elapsed time |

## Go deeper

The Mechanism pages take each part in turn, with the formulas, the code that runs them and a worked example: [the raise and the launch](/docs/raise), [treasury and book value](/docs/treasury), [the budget](/docs/budget), [team unlocks](/docs/unlocks), [the exit](/docs/exit), [heartbeats and the end](/docs/heartbeats), [prices and the oracle](/docs/oracle), and [fees and guarantees](/docs/guarantees).
