## The rule

When the token trades below book value for long enough, holders get the right to leave at book value. Each holder decides alone. Nobody votes, and the team cannot stop it.

1. **The streak.** Each price observation compares the pool's time-weighted price with book value. Time below book adds to the exit streak; time at or above book takes the same time off it.
2. **The round.** When the streak reaches its target (**3 days** by default), an **exit round** opens for **7 days**. Any holder can burn tokens for their share of the treasury, less the **1% exit fee**, which stays in the treasury.
3. **The cooldown.** After the round, a **14-day cooldown** runs, then normal life resumes and the streak can build again.

## The streak decays, it does not reset

```covenant
diagram:streak
```

An earlier design reset the streak to zero whenever the price touched book. That let anyone block an exit by pumping the price for an hour every few days. The streak in the vault decays instead: an hour above book cancels an hour below it, not three days of evidence.

- Each observation counts the time since the previous one, **at most 6 hours** on the production factory (1 minute on the demo factory).
- The streak steps only while the covenant is `ACTIVE`: not during a round, and not during the cooldown.
- When the round opens, the streak starts again from zero.

## Only on-chain numbers

The exit compares two numbers that both live on chain: the pool's time-weighted price and book value, both in BNB. It needs no Atlas rate and no minimum pool depth, so a missing or wrong rate cannot keep holders from leaving, and a pool that has been drained cannot block an exit either. The keeper keeps poking without a rate when Atlas cannot be reached, and the exit carries on.

## Redeeming

`redeem(amount, minOut)` on the vault, from the holder's wallet:

1. It sends `amount` tokens to the burn address (the app and the MCP server ask for an approval of exactly that amount first, never an unlimited one).
2. It reads book value **before** the burn and pays, for the tokens that actually reached the burn address:

> **payout = tokens × book value × (1 − exit fee)**, and with no fee at all after the covenant has ended

3. It reverts if the payout is below `minOut`, your slippage guard. `previewRedeem(tokens)` answers the payout in advance.

Redemption is open only in an exit round and after wind-down. At any other time `redeem` reverts with `NotRedeemable`.

## Worked example: a redemption

A covenant a few months in: treasury 320 BNB, redeemable supply 750,000,000 tokens.

| | |
|---|---|
| Book value | 320 / 750M = 0.000000427 BNB per token |
| Pool price for the last 3 days | 0.00000035 BNB, about 18% under book |
| The exit round opens; a holder redeems | 6,000,000 tokens |
| Gross, at book | 6M × 0.000000427 = 2.56 BNB |
| Exit fee, 1% | 0.0256 BNB, stays in the treasury |
| **Paid to the holder** | **2.534 BNB** |
| Selling into the pool instead | about 2.1 BNB, before tax and slippage |
| Book value for everyone else afterwards | 317.47 BNB / 744M = 0.00000042670, up from 0.00000042667 |

The holder who leaves gets about a fifth more than the pool would pay, and the holders who stay are slightly better off than before.

## Why it is hard to abuse

- **To open a round, someone must sell below book for days.** Pushing the price under book means selling tokens for less than the treasury will pay for them: the seller loses and the buyers gain.
- **To block a round, someone must hold the price above book for as long as it was below.** A short pump only takes back the time it lasted.
- **Flash loans do nothing.** The price is the pool's time-weighted average between pokes, which records only prices that survived to the end of a block.
- **Rounds, not an open window.** If redemption were always open, arbitrage would pin the price at book and pause the team's budget for months. A round gives doubters a clean exit, then lets the holders who stayed fund the team again. In a permanent discount the budget is paused at most 7 days in every 24 (3-day streak, 7-day round, 14-day cooldown).

## In the code

`onObservation()` (the streak), `redeem()`, `previewRedeem()`, `exitStreak()`, `state()` and `tick()` in [`CovenantVault`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVault.sol).
