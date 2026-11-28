## The rule

The team's tokens sit locked in Flap's Token Dock, in tranches. A tranche unlocks only when the token's price has held at or above its multiple of the sale price for the whole **unlock window**, and only after the **cliff**. Calendar time alone unlocks nothing.

| Default tranche | Share of supply | Multiple of the sale price |
|---|---|---|
| 1 | 5% | 2x |
| 2 | 10% | 4x |
| 3 | 10% | 8x |

Cliff **180 days**, unlock window **30 days**. A covenant can have up to 8 tranches with multiples above 1x and up to 100x; their sizes must add up to the team share.

## Held in dollars and in BNB

Each tranche's multiple must hold two ways at once:

- **In BNB:** the pool's time-weighted price against the BNB sale price. This leg reads only the pool, with no oracle.
- **In dollars:** the pool price times the Atlas BNB/USD rate, against the dollar sale price.

The BNB leg means no BNB/USD rate, however wrong, can unlock anything on its own. The dollar leg means the team does not unlock on a BNB rally the token did not share: a 2x that is only BNB moving is not performance.

The dollar sale price is fixed in the launch transaction from the Atlas push feed when it is fresh, otherwise by the first verified rate. For 14 days after that (production) a higher verified rate can raise it, never lower it, so nobody can pick a BNB dip to make the dollar targets easier.

## Only strict time counts

The counters advance only on **strict** observations: a poke with a verified, fresh BNB/USD rate, in a pool at least half as deep as its launch seed, over a window at least the poke gap long (1 hour in production). [Prices and the oracle](/docs/oracle#trusted-and-strict) defines them.

- A strict observation adds its whole window to every locked tranche whose multiple held over it. A tranche whose multiple did not hold resets to zero.
- A window longer than 6 hours (production) resets every counter: unlock time must be continuous.
- An observation without a rate never adds time. It still resets each counter whose multiple the price misses at the last verified rate, and every counter when that rate is more than 6 hours old. So nobody can hide a dip by poking without a rate.

Time before the cliff counts. When the cliff passes, a tranche whose counter is already full unlocks on the next strict observation.

## After a tranche unlocks

- Anyone calls `releaseTeam()` to send the unlocked tokens from the Token Dock to the team wallet.
- The unlocked tokens join the redeemable supply, so each unlock lowers book value. After all three default tranches, book value is 75% of what it would otherwise be (750M redeemable tokens become 1,000M).
- If the covenant has an ERC-8004 agent id, the vault writes the multiple (+200, +400 or +800) to the agent's reputation.

If the covenant ends, by abandonment or a wind-down, every tranche still locked goes to the burn address. The team keeps only what had already unlocked.

## Worked example

The default covenant has a sale price of 0.000000833 BNB per token, and suppose its dollar sale price was fixed at launch. For tranche 1 (2x):

1. The token has to trade at 0.00000167 BNB or more, and at twice the dollar sale price or more, over every strict window.
2. Keepers poke with an Atlas rate about once an hour; each strict hour at 2x adds an hour to the counter.
3. On day 20 the token dips under 2x for one window. The counter resets to zero.
4. It climbs back and holds for 30 days straight. If those 30 days end after day 180, the tranche (50,000,000 tokens) unlocks then; if they end before, it unlocks on the first strict observation after day 180.

## In the code

`trancheCount()`, `trancheProgress(k)` and `releaseTeam()` in [`CovenantVault`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVault.sol); the counter rule is `observeTranches()` in [`CovenantVaultDisplay`](https://github.com/Adityaakr/Covenent/blob/main/contracts/src/vault/CovenantVaultDisplay.sol).
