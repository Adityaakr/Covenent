## For founders and AI agents

You raise once, under terms you set and cannot loosen. That is the point: buyers do not have to trust your promises, only read your terms.

- **What you get.** A treasury in a vault, a dollar budget you can draw every 30 days, and team tokens that unlock as the price proves your work at 2x, 4x and 8x the sale price.
- **What you give up.** You cannot raise the budget, move the treasury anywhere but your fixed team wallet (the budget) and redeeming holders, change the team wallet, or edit a term. You can only lower the budget.
- **What you must keep doing.** Show you are alive within the heartbeat window: claiming the budget, posting a report or depositing revenue all count. Post a report each period. If the pool trades close to book value, consider lowering the budget, because a long stretch below book opens an exit round.
- **If you stop.** After the window anyone can declare the covenant abandoned. You keep nothing that was not claimed, and your locked tokens burn. To close honestly, call `windDown()` before the window passes and keep what you had earned.
- **For an AI agent.** The same contracts bind an agent. It can carry an ERC-8004 identity: the factory refuses an agent id the team wallet does not own, and the vault writes the outcome (abandoned, wound down, or each unlock) to the agent's reputation record. The repository's issuer agent (`server/agents/issuer`) runs this loop: Claude proposes each decision, a fixed policy bounds it, and the decision is posted on chain.

## For investors

You get a floor you can claim yourself and a team that cannot drain the treasury or walk away with it.

- **Before you commit,** read the terms, the issuer and the worst case: the covenant page in the app shows them, and the MCP prompt `before_you_commit` checks them for you.
- **The floor is book value.** With the default terms it starts at 60% of the sale price and falls as the team draws its budget, unless revenue comes in. You can redeem at book value only in an exit round or after the covenant ends.
- **Refunds are yours to take.** If the raise fails, or takes only part of your commitment, call `claimRefund()` (the app has a button). After a launch, claim your tokens with `claimTokens()`.
- **What it does not give you.** Exit, not voice: no vote, and no claim on anything off chain. The treasury is in BNB, so its dollar value moves. See [Known limitations](/docs/limitations).

## Who can do what

| Action | Who |
|---|---|
| Commit, claim tokens, claim a refund | Each buyer, for their own wallet |
| Finalize the raise, poke the oracle, declare abandonment, release unlocked team tokens, deposit revenue | Anyone |
| Redeem at book value | Any holder, during an exit round or after the covenant ends |
| Claim the budget, lower it, heartbeat, post a report, wind down | The team wallet (Flap's Guardian can also call these, but its calls never count as a heartbeat) |
