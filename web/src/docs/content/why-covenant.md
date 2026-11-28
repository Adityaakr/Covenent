## The short version

People will fund a raise when they know the treasury cannot simply walk away. MetaDAO proved that on Solana. Covenant takes the same promise and changes the engine: the protection is a set of fixed rules inside a vault, not a governance process, so it works for one holder at a time, needs nobody to vote, and runs the same way whether the issuer is a person or an AI agent.

## What MetaDAO does

MetaDAO is a Solana project best known for **futarchy**: decisions are made by markets. A proposal opens two conditional markets, one trading the token as if the proposal passes and one as if it fails, and the proposal executes when the "pass" market prices the token sufficiently higher than the "fail" market over the decision window.

Its launchpad uses that machinery for public raises, which it calls ownership coins:

- The money raised goes to a treasury the team does not control outright; changes go through proposals priced by those markets.
- The team works from a limited monthly allowance; asking for more is a proposal.
- Team tokens unlock on price targets rather than on a calendar.
- If a team misbehaves, holders can propose to liquidate the treasury and return it to holders pro rata.

That is the important idea: an investor's money stays protected after the raise, and there is a route to get it back. [MetaDAO's site](https://metadao.fi) has the details of its own design.

## What Covenant takes from it

- **A treasury that outlives the raise.** Most of the money sits in a vault, not in the team's wallet.
- **A budget, not a payout.** The team draws a capped amount per 30 days.
- **Team tokens that unlock on results.** Price multiples of the sale price, not dates.
- **A way back for holders.** Holders can turn their tokens back into their share of the treasury.

## What Covenant does differently

| | MetaDAO (Solana) | Covenant (BNB Chain) |
|---|---|---|
| What enforces the protection | Proposals decided by conditional markets | Fixed rules in the vault contract, triggered by anyone |
| Exit when the token trades below the treasury | Collective: a liquidation proposal has to pass | Individual: after a 3-day streak below book value, any holder redeems alone, at book |
| A team that goes quiet | Holders have to propose and pass a liquidation | After 45 days without a heartbeat, anyone flips the abandonment switch; no vote |
| The team's budget | A monthly allowance; more needs a proposal | A dollar budget per 30 days, capped as a share of the treasury, that can only go down |
| Changing the terms later | Possible, by proposal | Impossible; the only change is a lower budget |
| Prices it relies on | The decision markets themselves | The pool's time-weighted price on chain, plus Atlas BNB/USD for the dollar budget and unlocks (never for the exit) |
| Where it launches | MetaDAO's own launchpad | [Flap](https://flap.sh)'s Pool Launch, with a PancakeSwap pool, on the launchpad BNB Chain already uses |
| Treasury income | What the project brings in | The token's trading tax goes to the vault for as long as it runs (100 years by default), plus any revenue the issuer deposits |
| Who it is built for | Founders | Founders and AI agents alike: ERC-8004 identity, on-chain track record, an MCP server for agents on both sides |

Each design gives something up. MetaDAO gives holders **voice**: the market can approve new spending, change course or replace a plan, which a rule can never do. Covenant gives holders **exit**: no turnout, no market liquidity and no proposal is needed for one holder to leave at book value, and no one can loosen the terms, including the team. [Known limitations](/docs/limitations) states what that costs.

## Four mechanisms that make it work without votes

- **Book value as the line.** The vault knows exactly how much BNB backs each redeemable token. [Treasury and book value](/docs/treasury).
- **A decaying exit streak.** Time below book adds to a counter, time above book takes the same time off, and three days below opens an exit round. A one-day pump cannot reset three days of evidence. [The exit at book value](/docs/exit).
- **A dollar budget priced by Atlas.** The budget is set in dollars and paid in BNB at a verified rate, never above its cap as a share of the treasury. [The budget](/docs/budget).
- **An abandonment path.** Every team action is a heartbeat; silence past the window lets anyone open the treasury to holders, fee-free, forever. [Heartbeats and the end](/docs/heartbeats).

## Why rules suit AI agents

An agent issuer is the case where governance protection fits worst and rules fit best:

- **An agent cannot be sued, and nobody needs to sue it.** The vault already holds the treasury, so there is nothing to recover.
- **An agent can be hijacked.** A stolen key reaches the budget accrued so far, at most one period's cap, and never the treasury.
- **An agent can just stop.** A rule notices silence without anyone watching: the heartbeat window does it.
- **Agents invest too.** An investor agent can read fixed terms and compute its worst case before it commits; it cannot forecast how a vote will go.
- **Agents need machine-readable money.** Every term, state and action is on chain and exposed as [MCP tools](/docs/agents), and every write is an unsigned transaction a wallet signs.

So the pitch in one line: **think MetaDAO, plus AI agents raising, with the rules enforced by code on BNB Chain.**
