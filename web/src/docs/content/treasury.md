## Book value, the number everything turns on

> **book value = (treasury BNB − budget owed to the team) / (supply − burned tokens − locked team tokens)**

It is what one token is worth in the vault: the BNB a holder gets for it when redemption is open. In the code it is `bookValue()`, in BNB per token scaled by 10^18, rounded down (toward the vault). The pieces:

| Piece | In the code | What it is |
|---|---|---|
| Treasury | `address(vault).balance` | Every wei of BNB the vault holds |
| Budget owed | `owedTeam()` | Budget that has accrued to the team and not been claimed yet. It is already the team's, so it does not back the tokens |
| Supply | `totalSupply()` of the token | Every token, including those in the pool |
| Burned | `balanceOf(0x…dEaD)` | Tokens redeemers sent to the burn address |
| Locked team tokens | `lockedTeam()` | Team tranches that have not unlocked. They have no claim on the treasury |

The denominator is `redeemableSupply()`. The free part of the treasury, the numerator, is `freeTreasury()`.

## Why pool tokens count

Tokens sitting in the PancakeSwap pool count in the supply. That makes book value immune to trading: buying from the pool or selling into it moves the price, never anyone's share of the treasury. If pool tokens were left out, every purchase from the pool would dilute the holders who were already there.

Locked team tokens do not count, so if every outside holder redeems, the team cannot claim what is left through its locked allocation.

## Where it starts

The split sets the starting floor. Part of the raise seeds the pool, and the treasury backs the pool's tokens as well as the buyers':

> **book value at launch / sale price = (A − P) / (A + P)**, with A the sale share and P the pool share

| Sale | Pool | Raise in the pool | Starting floor (book value / sale price) |
|---|---|---|---|
| 70% | 10% | 14.3% | 75% |
| 60% | 15% (default) | 25.0% | 60% |
| 60% | 20% | 33.3% | 50% |
| 50% | 20% | 40.0% | 43% |
| 50% | 45% | 90.0% | 5% |

More pool means deeper liquidity and a lower floor. The last row is the cheapest split on testnet, where Flap's pool floor sets the smallest raise: it launches with very little in the treasury.

## What moves it

| Event | Effect on book value | Why |
|---|---|---|
| A trade on the pool | None | Pool tokens are in the supply |
| Trading tax arrives | Rises | More BNB, same supply |
| The issuer deposits revenue | Rises | More BNB, same supply |
| The budget accrues | Falls | Owed budget leaves the free treasury |
| The team claims its budget | None | It was already subtracted when it accrued |
| A redemption in an exit round | Rises slightly | The 1% exit fee stays in the treasury |
| A redemption at wind-down | None | No fee: the holder takes exactly their share |
| A team tranche unlocks | Falls | Unlocked tokens join the supply |
| Abandonment | Rises | The unclaimed budget returns to the treasury |

## Where the treasury's money comes from

```covenant
diagram:moneyflow
```

- **The raise.** `T0`, sent by the launcher at launch. It is not counted as revenue.
- **Trading tax.** Every buy and sell of the token pays a tax (1% each way by default, for 100 years, the longest the factory allows). Flap's tax processor collects it in the token, sells it for BNB once enough has built up, takes Flap's protocol fee and sends the rest to the vault. Anyone can call the processor's `dispatch()`; the keeper does it on each tick.
- **Revenue.** The issuer, or anyone, calls `depositRevenue(tag)` with BNB. From the team wallet it also counts as a heartbeat. An agent that earns BNB can route its income straight to the vault.
- **Plain transfers.** BNB sent to the vault is recognized as revenue by comparing the balance with the vault's own ledger (`sync()`, Flap's balance-delta rule).
- **Exit fees.** The fee on each redemption in an exit round stays behind for the holders who remain.

When the tax period ends, only revenue and exit fees can raise the treasury, so book value falls with every budget payment unless the issuer deposits revenue. The vault's own `description()` states the date.

## How it falls with the budget

The budget can take at most 4% of the free treasury per 30 days (the default cap). If the cap binds every period, nothing comes in and nobody redeems, the floor falls like this:

| Months after launch | Treasury left | Book value, as a share of the sale price (default split) |
|---|---|---|
| 0 | 100% | 60% |
| 6 | about 78% | about 47% |
| 12 | about 61% | about 37% |
| 24 | about 38% | about 23% |

That is the worst case for an honest team that spends its whole budget. Tax income and revenue push the line up; redemptions at a fee push it up slightly; unlocks push it down. `get_downside` in the MCP server and the covenant page in the app draw this path for any covenant from its live numbers.

## In the code

`bookValue()`, `redeemableSupply()`, `freeTreasury()`, `depositRevenue()`, `sync()` and `receive()` in [`CovenantVault`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVault.sol).
