## For founders and AI agents

You raise once, under terms you set and cannot loosen. That is the point: buyers do not have to trust your promises, only read your terms, and a covenant with fixed terms is easier to fund than a wallet with a roadmap.

- **What you get.** A treasury in a vault, a dollar budget you draw every 30 days, and team tokens that unlock as the price proves your work at 2x, 4x and 8x the sale price. The token's trading tax keeps funding the treasury.
- **What you give up.** You cannot raise the budget, move the treasury anywhere but your fixed team wallet (the budget) and redeeming holders, change the team wallet, or edit a term. You can only lower the budget.
- **What you must keep doing.** Show you are alive within the heartbeat window: claiming the budget, posting a report or depositing revenue all count. Post a report each period. If the pool trades close to book value, consider lowering the budget: a long stretch below book opens an exit round.
- **If you stop.** After the window anyone can declare the covenant abandoned. You keep nothing that was not claimed, and your locked tokens burn. To close honestly, call `windDown()` before the window passes and keep what you had earned.
- **For an AI agent.** The same contracts bind an agent. It can carry an ERC-8004 identity: the factory refuses an agent id the team wallet does not own, and the vault writes the outcome (abandoned, wound down, or each unlock) to the agent's reputation record. [Agentic finance](/docs/agentic-finance) walks through an agent's life on Covenant.

### Choosing terms

| Choice | Trade-off |
|---|---|
| A larger pool share | Deeper liquidity and a lower Flap minimum raise, but a lower starting floor for buyers ([treasury](/docs/treasury#where-it-starts)) |
| A higher budget cap | More room to spend, a faster-falling floor, and an exit that comes sooner if the price follows the floor down |
| A longer exit streak | Fewer exit rounds in a choppy market; holders wait longer for their way out |
| A shorter heartbeat window | A stronger promise to holders; less room for an outage |
| Higher unlock multiples | A stronger signal; tokens you may never see |

The Create page checks every choice against the factory as you type and shows the starting floor, the pool seed and Flap's live minimum raise. [Quickstart](/docs/quickstart#founder-open-a-raise-in-five-minutes) has the clicks.

## For investors

You get a floor you can claim yourself and a team that cannot drain the treasury or walk away with it.

- **Before you commit,** read the terms, the issuer and the worst case. The covenant page in the app shows them; the MCP prompt `before_you_commit` checks them for you; `get_downside` prices your position at book value now and after 6, 12 and 24 months of full budget claims.
- **The floor is book value.** With the default terms it starts at 60% of the sale price and falls as the team draws its budget, unless revenue comes in. You can redeem at book value only in an exit round or after the covenant ends.
- **Refunds are yours to take.** If the raise fails, or takes only part of your commitment, call `claimRefund()` (the app has a button). After a launch, claim your tokens with `claimTokens()`.
- **You can trigger the rules yourself.** Poke the oracle, finalize a raise, or declare a silent team abandoned: none of it needs the team, Covenant or a keeper.
- **What it does not give you.** Exit, not voice: no vote, and no claim on anything off chain. The treasury is in BNB, so its dollar value moves. See [Known limitations](/docs/limitations).

## Who can do what

[Fees and guarantees](/docs/guarantees#who-can-do-what) has the full table, and the list of what nobody, the team included, can do.
