## Covenant

A covenant is one raise and everything that follows it: a launcher (the raise), a token and its PancakeSwap pool (launched by Flap), and a vault (the treasury and the rules). Any of those four addresses identifies it in the app, the API and the MCP server.

## Book value

Book value is what one token is worth in the treasury:

> book value = (treasury BNB − budget owed to the team) / (supply − burned tokens − locked team tokens)

Tokens in the pool count in the supply, so trading never moves book value; only money in (tax, revenue) and money out (tap, redemptions) does. With the default terms, book value starts at 60% of the sale price, because part of the raise seeds the pool and the treasury covers the pool's tokens too. It then falls as the team spends and rises with revenue.

## States

```covenant
diagram:states
```

`RAISING` until the deadline, then `ACTIVE` once Flap launches the token, or `FAILED` with full refunds. From `ACTIVE`, a full exit streak opens an `EXIT_ROUND`, followed by a `COOLDOWN`. `WIND_DOWN` is the end: the team closed the covenant, or someone declared it abandoned.

## Dollar budgets through Atlas

The tap is set in US dollars, so the team's budget does not swing with the BNB price. Each poke can carry a BNB/USD rate from Atlas: a signed report attached to the call (at most 180 seconds old), or else the Atlas push feed (on BNB testnet, at most an hour old). With no fresh rate, the vault prices the budget at the last verified rate; with no rate ever, nothing accrues. Whatever the rate, the tap never exceeds its cap as a share of the treasury.

## Trusted and strict observations

Every poke sends the vault one observation. It is **trusted** when the pool's time-weighted price is valid; that is all the exit rule needs. It is **strict** when, in addition, a verified fresh BNB/USD rate came with it and the pool is deep (at least half its launch seed, measured in a way a same-block trade cannot fake). Only strict observations add time toward team unlocks.

## The exit streak decays

The exit streak counts time below book value. Each trusted observation adds the time since the last one while the pool price is below book, and takes the same time away while it is at or above book, so an hour above book cancels an hour below it instead of wiping days of progress. A single step counts at most 6 hours (production). When the streak reaches its target, the exit round opens and the streak starts again from zero.

The exit runs on two on-chain numbers, the pool price and book value. Atlas has no part in it, so an exit can open even when no rate arrives.

## Redemption

`redeem(amount, minOut)` sends your tokens to the burn address and pays you their share of the treasury at book value, read before the burn. In an exit round the exit fee (1% by default) stays in the treasury; in wind-down there is no fee and no deadline. Outside those two states, redemption is closed. The app and the MCP server ask for an approval of exactly the amount, never an unlimited one.

## Heartbeats and the end

The team proves it is alive by acting: `claimTap()`, `lowerTap()`, `heartbeat()`, `postReport()` and `depositRevenue()` from the team wallet all reset the abandonment clock. Calls by Flap's Guardian never do. Past the window, `declareAbandoned()` (anyone) ends the covenant: the unclaimed budget goes back to the treasury and the locked team tokens burn. A team can also close honestly with `windDown()` and keep the budget it had already earned, unless the window has already passed.
