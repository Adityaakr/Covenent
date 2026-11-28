## In one paragraph

A founder or an agent creates a covenant through Flap's Portal with the Covenant launcher factory, and every term is fixed at that moment. Buyers commit BNB until the deadline. Then anyone calls `finalize()`: below the minimum everyone gets their BNB back; otherwise the raise settles pro rata at the cap, Flap launches the token and a PancakeSwap pool at the sale price, and the rest of the money goes into the covenant's vault. All of that happens in one transaction.

## 1. Create: the terms are fixed

The team (a person or an agent's wallet) calls `Portal.newLauncher` with the launcher factory and the terms: name and symbol, supply split, minimum and cap, sale length, trading tax, budget, unlock tranches, exit timers and heartbeat window. The factory refuses, before any money is raised, everything Flap's launch would refuse later:

- **Terms outside the bounds.** Every bound is in [Rules and defaults](/docs/rules). For example the sale share is at least 40%, the pool share between 5% and the sale share, and the team share at most 30%.
- **A name or symbol on Flap's blocklist.** The factory asks Flap's own name screen, the one the Portal calls at launch. If the screen does not answer, creation is refused too.
- **A minimum raise too small for Flap's pool floor.** The pool seed at the minimum, less a safety margin (it must clear 1.5x the floor), must meet Flap's floor, read live from the Portal with Flap's BNB price. The production factory needs Flap's graduation floor, the demo factory its creation floor. `minRaiseFor(supply, saleBps, poolBps)` on the factory answers the smallest minimum it accepts; the app's Create page shows it as you type.
- **Tax settings Flap refuses.** Each side at most 10%, the higher side at least 1%, for 30 days to 100 years.
- **An agent id the team wallet does not own.** If `agentId` is set, the ERC-8004 identity must belong to the team wallet.

The launcher locks the token's salt with the Portal (the creator pays Flap's salt lock fee). Flap requires every token address to end in `7777`, so the app mines a salt that produces one, about 65,536 tries on average, in your browser.

`checkTerms(terms)` on the factory runs every one of these checks without creating anything, so a form or an agent can test terms first.

## 2. Commit

While the sale is open, anyone calls `contribute()` with BNB attached. There is no per-wallet limit and no minimum commitment: the raise can be oversubscribed, and the excess is refunded pro rata.

`previewCommit(account, amount)` on the launcher answers what a commitment would keep, receive and get refunded if the sale closed now.

## 3. Settle and launch: one finalize()

After the deadline, anyone calls `finalize()`. It needs a gas limit of 15,000,000, which the app, the API, the MCP server and the keeper all set; only the gas used is paid. (The launcher checks that 12,000,000 gas is left before the launch, so a call with too little gas reverts and leaves the raise open, instead of failing it.)

The maths, with C the total committed, A the sale tokens and P the pool tokens:

| Symbol | Meaning | Formula |
|---|---|---|
| `Q` | Accepted raise | `min(C, cap)` |
| `q_i` | What buyer i keeps in the sale | `c_i × Q / C`, rounded down |
| `refund_i` | What buyer i gets back | `c_i − q_i` |
| `a_i` | Buyer i's tokens | `A × q_i / Q` |
| `p0` | Sale price | `Q / A` |
| `Q_pool` | BNB that seeds the pool | `Q × P / A`, so the pool opens exactly at `p0` |
| `T0` | Treasury | `Q − Q_pool`, less one wei per buyer when oversubscribed, so rounding never leaves a refund short |

In one transaction the launcher calls Flap's `launchTaxTokenV2` with `Q_pool` attached. The Portal:

1. mints the tax token (1,000,000,000 tokens by default);
2. seeds a PancakeSwap V2 pool with `Q_pool` BNB and P tokens, and locks the liquidity (on testnet all of the LP tokens went to the dead and zero addresses);
3. asks the Covenant vault factory to create the vault, which checks that the launch comes from a launcher its paired factory created;
4. hands the sale and team tokens (A + E) to the vault, which deposits them in Flap's Token Dock.

Then the launcher sends `T0` to the vault, and the covenant is `ACTIVE`.

With the default split (60% sale, 15% pool, 25% team), a quarter of the accepted BNB seeds the pool and three quarters become the treasury.

## 4. Claim

- **Buyers** call `claimTokens()` on the vault to take their `a_i` tokens from the Token Dock.
- **Refunds** are pulled with `claimRefund()` on the launcher, never pushed, and stay claimable forever.
- Once every refund is out, anyone can call `sweepDust()` to move the leftover rounding buffer into the treasury.

## When a raise fails

| What happened | Result |
|---|---|
| Less than the minimum was committed | `FAILED`: every buyer claims their full commitment back |
| Flap's Portal refused the launch, within the retry window (3 days after the deadline on the production factory, 10 minutes on the demo factory) | Still `RAISING`: anyone can call `finalize()` again |
| The Portal refused after the retry window | `FAILED`: full refunds |

A failed launch never traps funds: the launch and the funding are wrapped together, so if either reverts both unwind.

## Worked example: an oversubscribed raise

Default terms: 1,000,000,000 tokens, 600M sale, 150M pool, 250M team; minimum 200 BNB, cap 500 BNB.

| Step | Amount |
|---|---|
| Committed by buyers | 1,400 BNB (2.8x the cap) |
| Accepted, `Q` | 500 BNB |
| Refunded pro rata | 900 BNB: each buyer keeps 500 / 1,400 = 35.7% of their commitment |
| Sale price, `p0` | 500 / 600M = 0.000000833 BNB per token |
| Pool seed | 500 × 150 / 600 = 125 BNB, with 150M tokens |
| Treasury, `T0` | 375 BNB |

A buyer who committed 14 BNB keeps 5 BNB in the sale, receives 600M × 5 / 500 = 6,000,000 tokens and claims a 9 BNB refund.

Had only 150 BNB been committed, the raise would have failed and every buyer would have claimed back exactly what they sent. Had 300 BNB been committed, nobody would be refunded: Q = 300 BNB, 75 BNB seeds the pool and 225 BNB is the treasury.

## In the code

`CovenantLauncherFactory` (terms checks, `minRaiseFor`, `checkTerms`), `CovenantLauncher` (`contribute`, `previewCommit`, `finalize`, `claimRefund`, `sweepDust`), `CovenantTermsLib` (the bounds), all in [`contracts/src/launcher`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/launcher/CovenantLauncher.sol).
