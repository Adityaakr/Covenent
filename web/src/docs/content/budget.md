## The rule

The team's budget (the **tap**) is set in US dollars per 30 days, so it does not swing with the BNB price, and paid in BNB at a verified BNB/USD rate. It can never exceed a fixed share of the treasury per 30 days. Every 30-day period it accrues the smaller of the two:

> **budget per 30 days = min( tap in dollars / BNB price in dollars , cap × free treasury )**

Default: **$30,000 per 30 days, capped at 4% of the treasury.** The factory allows a cap of at most 10%.

## How it accrues

The budget accrues on each price observation (each poke of the oracle), for the time since the last one:

- **At most 6 hours per observation** on the production factory (1 minute on the demo factory). If nobody pokes for a day, the next poke adds 6 hours of budget, not 24, so the team needs the covenant to keep being observed.
- **Paused in an exit round.** Time inside an exit round never accrues. It accrues again in the cooldown that follows.
- **Ended at wind-down.** After the covenant ends, nothing more accrues.
- **Paused by a failed report.** If the covenant named a report relayer and any period stands failed, nothing accrues until it passes (no relayer runs yet; see [Heartbeats and the end](/docs/heartbeats#reports-on-chain)).
- **Never more than one period's cap unclaimed.** What the team has not claimed stops growing at the cap share of the treasury, so a stolen key reaches at most one period's budget.

## Which BNB price

The rate is an Atlas BNB/USD price, verified on chain by the oracle:

1. a signed Atlas report attached to the poke, at most 180 seconds old; else
2. the Atlas push feed, at most an hour old on BNB testnet; else
3. the **last verified rate**, however old. The dollar budget keeps binding at the last known price; the cap never pays out on its own.

With no verified rate ever, nothing accrues. Whatever the rate, the budget never exceeds its cap. [Prices and the oracle](/docs/oracle) explains the verification.

## Claiming and cutting

| Call | Who | What it does |
|---|---|---|
| `claimTap()` | The team wallet (or Flap's Guardian) | Pays everything accrued to the team wallet fixed at creation. A heartbeat when the team wallet sends it |
| `lowerTap(newUsdPer30d)` | The team wallet (or Flap's Guardian) | Sets a lower dollar budget, for good. A higher or equal value reverts (`TapNotLower`). A heartbeat |

Nothing can raise the budget: there is no function for it, and no admin. A team that sees its token trading close to book value can cut its own pay to slow the fall of the floor; the repository's issuer agent does exactly that.

## Worked example

The default covenant from [the raise](/docs/raise#worked-example-an-oversubscribed-raise): a 375 BNB treasury.

- **The cap:** 4% of 375 BNB = **15 BNB per 30 days**, or 15 / 720 ≈ 0.021 BNB for each hour of observed time.
- **The dollar budget:** $30,000 / the BNB price. At any BNB price under $2,000 that is more than 15 BNB, so the cap binds and the team gets 15 BNB per 30 days. At a BNB price above $2,000 the dollar budget is under 15 BNB, so the dollar budget binds.
- **After a cut** to $10,000 per 30 days, the cap binds only while BNB is under about $667.

The cap is a share of the free treasury, so it shrinks as the treasury does: after six months of full claims, with no income, the treasury is about 78% of what it was and the cap is about 11.7 BNB per 30 days. [Treasury and book value](/docs/treasury#how-it-falls-with-the-budget) shows the floor along that path.

## Why it is built this way

- **Dollars, not BNB.** A team's costs are in dollars; a BNB rally should not double its pay and a BNB crash should not starve it.
- **A cap in BNB.** However the dollar rate is wrong, stale or manipulated, the treasury cannot drain faster than the cap.
- **Only downwards.** A budget that can be raised is a promise; one that can only be lowered is a commitment.
- **Accrual per observation.** The vault has no clock of its own. Tying the budget to pokes means it accrues only while the covenant is being watched, and an invariant test checks that it stays within the cap over any 30-day window.

## In the code

`claimTap()`, `lowerTap()`, `owedTeam()`, `tapCapPer30d()` in [`CovenantVault`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVault.sol); the accrual is `tapAmount()` in [`CovenantVaultDisplay`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVaultDisplay.sol).
