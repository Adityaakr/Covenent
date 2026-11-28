## Covenant

One raise and everything that follows it: a launcher (the raise), a token and its PancakeSwap pool (launched by Flap), and a vault (the treasury and the rules). Any of those four addresses identifies it in the app, the API and the MCP server.

## Abandonment

The end of a covenant whose team sent no heartbeat for the heartbeat window. Anyone calls `declareAbandoned()`: unclaimed budget returns to the treasury, locked team tokens burn, and redemption opens at book value with no fee, forever. [Heartbeats and the end](/docs/heartbeats).

## Book value

The treasury per redeemable token: (treasury BNB − budget owed to the team) / (supply − burned tokens − locked team tokens). It is what a token redeems for. Trading never moves it, because pool tokens count in the supply. [Treasury and book value](/docs/treasury).

## Cliff

The time after launch before any team tranche can unlock: 180 days by default. Strict time above a multiple counts toward the unlock window even before the cliff.

## Cooldown

The period after an exit round (14 days by default) in which the exit streak does not build. Then the covenant is active again.

## Exit fee

The share of each redemption in an exit round that stays in the treasury for the holders who remain: 1% by default, at most 3%. There is no fee after the covenant has ended.

## Exit round

The window (7 days by default) in which any holder can redeem tokens at book value. It opens when the exit streak reaches its target, and the team's budget is paused while it runs. [The exit](/docs/exit).

## Exit streak

Time the pool has traded below book value, counted on each trusted observation. Time at or above book takes the same time off; it decays rather than resets. When it reaches its target (3 days by default), an exit round opens.

## Finalize

`finalize()` on the launcher, after the sale deadline. Anyone can call it, with a 15,000,000 gas limit. It fails the raise below the minimum; otherwise it settles pro rata, launches the token and pool through Flap and funds the vault. [The raise and the launch](/docs/raise).

## Heartbeat

Any team action from the team wallet that proves it is alive: claiming the budget, lowering it, posting a report, depositing revenue, or `heartbeat()` itself. Calls by Flap's Guardian never count.

## Observation

What one poke of the oracle sends a vault: the pool's time-weighted price since the last poke, the time elapsed, a BNB/USD rate if one was verified, and whether the observation is trusted and strict. [Prices and the oracle](/docs/oracle).

## Poke

`poke(vault)` on `CovenantOracle`: records one observation. Anyone can call it, at most once per poke gap (1 hour in production).

## Redeemable supply

Supply less burned tokens and locked team tokens: the tokens that have a claim on the treasury.

## States

`RAISING`, `FAILED` (terminal, full refunds), `ACTIVE`, `EXIT_ROUND`, `COOLDOWN` and `WIND_DOWN` (terminal, redemption open forever). [How it works](/docs/how-it-works#the-states) draws them.

## Strict observation

A trusted observation that also carries a verified, fresh BNB/USD rate, in a pool at least half as deep as its launch seed, over a window at least the poke gap long. Only strict time advances team unlocks.

## Tap

The team's budget: a dollar amount per 30 days, paid in BNB at the Atlas rate, never more than a fixed share of the treasury. It can be lowered, never raised. [The budget](/docs/budget).

## Team wallet

The address fixed at creation that receives the budget and unlocked team tokens and sends heartbeats. For an agent it is the agent's own key, and it must own the agent's ERC-8004 identity.

## Tranche

A slice of the team's tokens that unlocks at one multiple of the sale price. The defaults are 5% of supply at 2x, 10% at 4x and 10% at 8x. [Team unlocks](/docs/unlocks).

## Trusted observation

An observation with a valid time-weighted pool price. That is all the exit streak needs: it never uses Atlas or the pool's depth.

## TWAP

Time-weighted average price: the pool's average price between two pokes, from PancakeSwap's cumulative price. It only records prices that survived to the end of a block, so a flash loan cannot move it.

## Wind-down

The end state, `WIND_DOWN`, reached by abandonment or when the team (or Flap's Guardian) calls `windDown()`. No more budget, locked team tokens burned, redemption at book with no fee and no deadline.
