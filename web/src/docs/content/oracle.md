## What a poke does

The vault has no clock of its own; it moves when it is told what the price is. `poke(vault)` on `CovenantOracle` does that:

1. reads the token's PancakeSwap pool and computes the **time-weighted average price** since this vault's previous poke;
2. reads a **BNB/USD rate** from Atlas, if one is available, and verifies it;
3. measures whether the pool is **deep** enough;
4. sends the vault one **observation**.

The vault then recognizes new revenue, accrues the budget, steps the exit streak and the unlock counters, and opens an exit round if the streak is full.

## Who pokes, and how often

**Anyone.** The keeper does it about once an hour for every covenant; the app has a **Poke now** button; the MCP server has a `poke` tool; a plain transaction works too. The oracle has no owner.

The oracle refuses pokes that come too soon, at most one per vault per **poke gap** (1 hour on the production factory, 20 seconds on the demo factory). Two clocks run per vault: a poke without a rate waits for the previous poke of any kind, and a poke with a rate waits only for the previous poke with a rate. So nobody can use up the slot of a rate-carrying poke by poking without one first.

Any number of keepers can run at once: a redundant poke simply reverts with `TooSoon`, and the keeper simulates before it sends, so it costs nothing.

## The pool price

The price is the PancakeSwap V2 pool's own cumulative price, the same mechanism as the Uniswap V2 oracle. It records only prices that survived to the end of a block, so a flash loan or a trade and its reversal inside one transaction cannot move it. Between two pokes, the average is the price every rule uses.

## The BNB/USD rate

| Source | When | Accepted if |
|---|---|---|
| A signed Atlas report attached to the poke's calldata | The keeper has an Atlas API key | Signed by the one Atlas signer fixed at deployment, at most 180 seconds old, at most 60 seconds in the future, and newer than the last report this vault accepted (no replays) |
| The Atlas push feed | No report attached | The feed's latest round is at most an hour old (the testnet deployment) |
| None | Neither is available | The observation carries no rate |

No owner can rotate the signer or change the feed.

## Trusted and strict

Each observation is graded:

| Grade | Means | What uses it |
|---|---|---|
| **Trusted** | The time-weighted price is valid (time has passed since the last poke) | The exit streak. That is all the exit needs |
| **Strict** | Trusted, plus a verified fresh rate, plus a deep pool, over a window at least the poke gap long | The unlock counters. Only strict time unlocks team tokens |

A pool is **deep** when its BNB reserve, measured at the window's time-weighted price on the pool's own invariant (the square root of k times the price), is at least half of its launch seed. A swap can never lower k, so a sale and a buyback inside one block cannot make the pool look shallow, or deep.

The budget uses the rate whenever one is verified, and otherwise the last one the vault recorded; the depth gate applies to unlocks only, never to the exit.

## When something is down

| What fails | What happens |
|---|---|
| Atlas: no report and no fresh push round | Pokes still go through. The exit streak keeps stepping; the budget is priced at the last verified rate, within its cap; unlock counters stop advancing and reset after 6 hours |
| The keeper | Anyone can poke. Until someone does, nothing moves, and the next poke counts at most 6 hours |
| The pool drains | The exit still runs on the pool's price; unlocks need the pool back above half its seed |

## In the code

`poke()`, `nextPokeAt()`, `nextRatePokeAt()` and `preview()` in [`CovenantOracle`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/oracle/CovenantOracle.sol); the price maths in [`PairTwap`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/oracle/PairTwap.sol); the keeper in the [server README](https://github.com/Adityaakr/Covenent/blob/main/server/README.md#keeper).
