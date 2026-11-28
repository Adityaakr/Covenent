## Heartbeats

A team proves it is alive by acting. Each of these, sent **from the team wallet**, resets the abandonment clock:

| Call | What else it does |
|---|---|
| `claimTap()` | Pays the accrued budget |
| `lowerTap(newUsd)` | Cuts the budget for good |
| `postReport(period, uri, hash)` | Puts a report on chain |
| `depositRevenue(tag)` | Adds BNB to the treasury |
| `heartbeat()` | Nothing else: a plain sign of life |

The same calls from Flap's Guardian never count, so nobody can keep a silent team's covenant alive on its behalf. The window is **45 days** by default (14 to 90 days on the production factory; 10 minutes on the demo timers). `heartbeatDeadline()` on the vault answers when it runs out.

## Abandonment: when the team goes silent

After the deadline passes, **anyone** can call `declareAbandoned()`. In one transaction:

1. the budget the team accrued and never claimed returns to the treasury, which raises book value;
2. every team tranche still locked goes to the burn address;
3. the covenant moves to `WIND_DOWN`, for good;
4. redemption opens at book value with **no fee and no deadline**;
5. if the covenant has an ERC-8004 agent id, the vault writes **-100, "abandoned"** to the agent's reputation.

The repository's keeper declares abandonment on its first tick after the window passes. If no keeper runs, the app's **Declare abandoned** button or the MCP tool `declare_abandoned` does the same.

## Winding down honestly

A team that wants to stop can call `windDown()` before its window runs out. The end state is the same (no more budget, locked tranches burned, fee-free redemption forever), with one difference: the budget it had already earned stays claimable. The reputation record reads **0, "wound-down"**.

Past the deadline, `windDown()` is treated as an abandonment: the unclaimed budget is forfeited exactly as `declareAbandoned()` would, so a lapsed team cannot wind down first to keep it. Flap's Guardian can also wind a covenant down; the vault records who did it (`windDownCause`: 1 the team, 2 the Guardian, 3 abandoned) and the app shows it.

## Reports on chain

The fifth rule is disclosure. The team posts each period's report with `postReport(period, uri, hash)`: where the report lives (`https://` or `ipfs://`, or the report itself as a `data:` URI) and the keccak256 hash of its text. Each period can be posted once, so the record cannot be rewritten. The repository's issuer agent posts every decision this way, with the numbers it read and the transaction it sent, and the app re-hashes each record before showing it.

A covenant can name a **report relayer** at creation (never the team wallet). While any period stands failed by the relayer's verdict, the budget stops accruing. The vault's hook is live; the relayer that would judge reports (a Cournot market per period) is planned, and none runs today.

## The track record

For an agent, the end of a covenant is not the end of the story. The outcome the vault writes to the ERC-8004 reputation registry (abandoned -100, wound down 0, each unlock +multiple) follows the agent's identity to its next raise. `get_issuer` and the covenant page show it, counting feedback only from vaults the Covenant factories created.

## On testnet

The first testnet covenant, [CVT](/app/c/{{address:legacyCovenantVault}}), ran this path for real: its issuer agent claimed its budget and sent heartbeats, then the agent was stopped, and 600 seconds later (the demo window) the keeper declared it abandoned. Its holders can still redeem at book value with no fee.

## In the code

`heartbeat()`, `heartbeatDeadline()`, `abandonable()`, `declareAbandoned()`, `windDown()`, `postReport()`, `recordVerdict()` in [`CovenantVault`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVault.sol).
