---
name: covenant
description: Read and act on Covenant token raises on BNB Chain — terms, live status, downside at book value, and unsigned transactions to commit, redeem, poke or declare a silent team abandoned. Use when an agent evaluates, funds, holds or exits a Covenant token, or runs as a covenant's issuer.
---

# Covenant

A covenant is a token raise whose treasury sits in a vault under five fixed rules:

1. **Tap** — the team (human or AI agent) draws a dollar budget per 30 days, capped as a share of the treasury. It can only be lowered.
2. **Performance unlock** — team tokens unlock only when the dollar price holds above 2x / 4x / 8x the sale price for a sustained trusted window.
3. **Book-value exit** — when the pool trades below book value (treasury per redeemable token) for the exit streak, an exit round opens and any holder can burn tokens for a pro-rata share of the treasury. The streak decays above book instead of resetting and uses on-chain numbers only, so it works with no oracle.
4. **Abandonment switch** — if the team or agent stops and sends no heartbeat for the window, anyone can open the treasury to holders permanently, fee-free.
5. **Disclosure** — the team posts a period report pointer and hash on-chain.

Book value = (vault BNB − tap owed) / (supply − burned − locked team tokens). Prices are BNB per token scaled by 1e18; amounts are wei strings.

## Two ways to use it

**MCP server (recommended).** Run `pnpm --dir server mcp` (stdio). Point your MCP client at it:

```json
{ "mcpServers": { "covenant": { "command": "pnpm", "args": ["--dir", "server", "mcp"] } } }
```

**HTTP, no server process of your own.** The Covenant API (default `http://127.0.0.1:8787`) exposes the same data:
`GET /api/covenants`, `GET /api/covenants/{vault}`, `/downside?holder=`, `/history`, `/events`, `/tx/{commit|redeem|claim-tokens|claim-refund|declare-abandoned|claim-tap|heartbeat|lower-tap}`, and `GET /api/poke-report?vault=`.

## Tools

| Tool | Kind | Use it to |
|---|---|---|
| `list_covenants` | read | find covenants; `under_book_only: true` lists those trading below book |
| `get_terms` | read | full terms JSON plus a plain-language summary of the five rules |
| `get_status` | read | state, exit streak and round end, tap accrued and cap, heartbeat age, tranches, trust |
| `get_downside` | read | what a holder's tokens redeem for at book now vs. selling into the pool; floor path; runway |
| `get_issuer` | read | team wallet, ERC-8004 agent id, registration file, outcomes of past covenants |
| `get_market` | read | CoinMarketCap pair quote, liquidity, holders, plus on-chain reserves |
| `commit`, `claim_tokens`, `claim_refund` | write | join a raise, take your allocation, take your refund |
| `redeem`, `poke`, `declare_abandoned` | write | exit at book in a round, record a price observation, open the treasury of a silent team |
| `claim_tap`, `heartbeat`, `lower_tap`, `post_report` | write, issuer only | run the issuer side from the team wallet |

**Writes return an unsigned transaction** (`{chainId, to, data, value, from, prerequisites[]}`) and never sign. Send each prerequisite first (for `redeem`, a token approval), then the main transaction, from the wallet named in `from` when it is set. Never give this server, or any hosted MCP server, a private key.

## Recipes

**Before funding a raise.** `get_terms` → read the summary; `get_downside` with `tokens` set to your expected allocation → the worst case is `redeemNowBnb` if a round opens, falling along `floorPath` as the team spends. `get_issuer` → if `agentId` is set, check `ownerMatchesTeam` and the reputation summary (counted only from covenant vaults).

**Holding through a slide.** `list_covenants {under_book_only: true}` → `get_status` shows `exit.streakSeconds` of `exit.targetSeconds`. If no round is open, nothing to do but `poke` (anyone may, once per interval). When `state` is `EXIT_ROUND` or `WIND_DOWN`, compare `redeemNowWei` with `sellOnPoolWei` from `get_downside`; if redeeming pays more, call `redeem` and sign.

**A team or agent that stopped.** `get_status` → `heartbeat.abandonable: true` means `declare_abandoned` is valid now. After it lands the state is `WIND_DOWN` and `redeem` pays book value with no fee, forever.

**As the issuer.** Claim the tap when it has accrued (it is also a heartbeat), heartbeat well inside the window, lower the tap when the pool trades close to book, send any revenue you earn to the vault address (plain BNB transfer), and post a report each period. The rules are enforced by the vault; nothing you write changes them.

## What it does not protect

The floor is below the sale price and falls as the team spends. The treasury is BNB, so its dollar value moves. Holders get exit, not voice, and no claim on anything off-chain.
