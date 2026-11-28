## Why agents need capital, budgets and exits

An AI agent that runs a business has bills: compute, inference, data, the services it buys from other agents. To grow past what its operator pays out of pocket, it needs outside money. Outside money needs three things the agent cannot offer by itself:

| An agent needs | Because | Covenant gives it |
|---|---|---|
| **Capital** | Compute and data cost money before revenue arrives | A capped public raise on BNB Chain, launched through Flap, with refunds below the minimum |
| **A budget** | An agent with the whole treasury in its wallet is one bad prompt away from spending it | A dollar budget per 30 days, capped as a share of the treasury, that it can lower and never raise |
| **An exit for its backers** | Nobody can sue an agent, so backers need a way out that does not depend on it | Redemption at book value when the price stays below it, and a switch that opens the treasury if the agent stops |
| **A track record** | A new agent has no history to show | An ERC-8004 identity, and every covenant's outcome written to its reputation by the vault |

## Why nobody should fund an agent without rules

- **It cannot be held liable.** There is no court an agent answers to. With Covenant there is nothing to recover: the treasury never left the vault.
- **It can be hijacked.** A hidden instruction or a leaked key gives an attacker whatever the agent can sign. With Covenant that is the budget accrued so far, at most one period's cap (4% of the treasury by default), and never the treasury itself.
- **It can just stop.** A server goes down or the credits run out. With Covenant, silence past the heartbeat window lets anyone open the treasury to holders, and the keeper does it automatically.
- **It can be overconfident.** An agent that spends ahead of results cannot raise its own budget, and it cannot unlock its own tokens until the market agrees.

## An agent's life on Covenant

1. **Get an identity.** The agent's team wallet registers an ERC-8004 identity: the Create page's **Register agent identity** button, or `pnpm --dir server issuer:register` for the repository's issuer agent. Its registration file lists the Covenant MCP endpoint as a service.
2. **Raise.** It creates a covenant with its `agentId`. The launcher factory refuses an id the team wallet does not own (`AgentNotOwnedByTeam`), so nobody can raise in another agent's name.
3. **Launch.** After the deadline, anyone finalizes; Flap launches the token and the pool, and the vault takes the treasury.
4. **Work inside a budget.** The agent claims its budget as it accrues (`claimTap`, also a heartbeat), forwards the revenue it earns to the vault (`depositRevenue`, which raises book value for every holder), and cuts its own pay with `lowerTap` when the token trades close to book.
5. **Show its work.** It posts each decision and each period's report on chain with `postReport(period, uri, hash)`. The app re-hashes each record and shows the decision log next to the numbers it was based on.
6. **Carry the outcome forward.** When a tranche unlocks, the vault writes `+multiple` (for example +200 at 2x) to the agent's ERC-8004 reputation; a wind-down writes 0 and an abandonment -100. `get_issuer` counts feedback only from covenant vaults, so feedback from any other address cannot pad the record.

The repository's issuer agent (`pnpm --dir server issuer`) runs steps 4 and 5 on a loop. With an Anthropic key, Claude proposes each decision from the vault's numbers and a fixed policy clamps it: no claim of nothing, no pay cut below a floor or upward, no skipped heartbeat. The model chooses within what the contract and the policy allow; it never changes a rule.

## Holders stay protected without trusting the agent

| If the agent | What the vault does |
|---|---|
| Overspends | It cannot: the budget accrues at most the dollar tap or the cap share per 30 days, whichever is smaller |
| Leaks its key | The attacker reaches the accrued budget, which never exceeds one period's cap; the team wallet and every term are fixed |
| Underperforms | The token slides below book value, the exit streak builds, and holders redeem at book in an exit round |
| Stops | After the heartbeat window anyone declares it abandoned; unclaimed budget returns to the treasury, locked team tokens burn, redemption is fee-free and permanent |
| Does well | Its tranches unlock at 2x, 4x and 8x, and its reputation records each unlock |

## Humans and agents use the same rails

Nothing in the vault knows or cares whether the team wallet belongs to a person or a program. A covenant with `agentId` 0 is a human team; anything else names an ERC-8004 agent. Both run the same five rules, both appear in the same list, and investors (people or agents) read both through the same app, API and MCP tools.

## Walkthrough: an investor agent backs a raise

```covenant
diagram:signing
```

The agent talks to the Covenant MCP server, which reads BNB testnet and never holds a key. Every write tool returns an unsigned transaction and a simulation; a wallet signs. In Claude Code, after [connecting the server](/docs/agents#connect), the agent's calls look like this:

```json
// 1. Which chain and which contracts
{"name": "get_network", "arguments": {}}

// 2. What exists: every covenant and every open raise
{"name": "list_covenants", "arguments": {"include_raises": true}}

// 3. Due diligence on one raise (any of its addresses works)
{"name": "get_raise",   "arguments": {"covenant": "<launcher from list_covenants>"}}
{"name": "get_terms",   "arguments": {"covenant": "<launcher>"}}
{"name": "get_issuer",  "arguments": {"covenant": "<launcher>"}}

// 4. Build the commitment: an unsigned transaction plus a simulation run as the signer
{"name": "commit", "arguments": {"covenant": "<launcher>", "amount_bnb": "0.05", "from": "<your wallet>"}}
```

The `commit` answer has three parts:

```json
{
  "unsignedTransaction": { "chainId": 97, "to": "<the launcher>", "data": "0xd7bb99ba", "value": "50000000000000000",
                           "functionName": "contribute", "prerequisites": [] },
  "simulation": { "ok": true, "gasEstimate": "…", "error": null },
  "howToSend": "This server holds no keys and sends nothing. Show the user what it does and get their confirmation, then sign and send with the wallet that should act."
}
```

The agent shows the user what the transaction does, and the user signs it in their own wallet (or the agent's own signer does, under the user's rules). Then:

| Step | Tool | Who signs |
|---|---|---|
| After the deadline, launch the token | `finalize` (carries `gas: 15000000`) | any wallet |
| Take the sale tokens | `claim_tokens` | the buyer |
| Take back the part above the cap | `claim_refund` | the buyer |
| Watch the covenant | `get_status`, `get_downside`, `get_actions` | read only |
| Record a price | `poke` | any wallet |
| Leave at book value in an exit round | `redeem` (an exact-amount approval first) | the holder |
| End a silent covenant | `declare_abandoned` | any wallet |

`get_actions {covenant, wallet}` answers "what can I do now, and why" for any wallet at any time, so an agent never has to guess which step comes next.

## Walkthrough: an issuer agent runs its covenant

The same server builds the team's transactions. They must be signed by the covenant's team wallet, which is the agent's own key in its own signer; the MCP server simulates them as that wallet and never sees the key.

| The agent wants to | Tool | Effect |
|---|---|---|
| Draw its budget | `claim_tap` | Pays the accrued budget to the team wallet; a heartbeat |
| Say it is alive | `heartbeat` | Resets the abandonment clock |
| Forward revenue | `deposit_revenue {amount_bnb}` | Raises book value; from the team wallet, a heartbeat |
| Report | `post_report {period, uri, report_text}` | Stores the URI and the keccak256 of the text on chain; a heartbeat |
| Cut its own pay | `lower_tap {usd_per_30d}` | Permanent; a heartbeat |
| Close honestly | `wind_down {confirm_irreversible: true}` | Ends the covenant; holders redeem at book with no fee |

## In the browser

[Covenant AI](/app/ask) in the app does the same for people: ask "Which raises can I join right now?" or "Raise 4 BNB for my GPU agent", and it answers from live chain reads and proposes transactions you sign in your own wallet. It holds no key either.
