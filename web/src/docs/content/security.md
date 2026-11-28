## Status

Covenant was built in three days for BNB Hack Bangkok. It has had an AI pre-audit, a review by Flap's audit bot (its pre-audit findings F1 to F8) and an independent re-review of those fixes. It has not had an independent human audit. Do not use it with real funds.

Every finding is in [docs/KNOWN-ISSUES.md](https://github.com/Adityaakr/Covenent/blob/main/docs/KNOWN-ISSUES.md) with its status: fixed (with the regression test named), disclosed by design, accepted with a reason, or open.

## What the reviews changed

- **Launch floors and terms checked at creation.** The raise's minimum must clear Flap's own floor with a 1.5x margin, names and symbols go through Flap's scam-word screen (failing closed), and tax settings the Portal would refuse are refused up front. A raise can no longer fail at launch for terms the factory accepted.
- **Unlocks that cannot be gamed.** A dip cannot be hidden by poking without a rate, a poke without a rate cannot block one with a rate, unlock time must be continuous, and pool depth is measured so that a trade in the same block cannot fake it.
- **A budget that always binds.** With no fresh rate, the tap is priced at the last verified BNB/USD rate, never at the cap alone.
- **Safe finalize.** `finalize()` needs 12M gas left before the launch and every client sends 15M; a call with too little gas reverts and leaves the raise open instead of failing it.
- **Flap's addresses fixed per chain.** On chains 56 and 97 the factories refuse any Portal, Guardian, Token Dock or name screen but Flap's own.

## Tests

`forge test` in `contracts/` runs the unit tests, the invariants (for example, the tap stays within its cap over any 30-day window), a regression test for every pre-audit finding, and, with an RPC set, fork tests against Flap's live Portal. `pnpm test` in `server/` runs unit tests and chain tests on a local anvil node; `pnpm test` in `web/` runs the app's tests. CI runs all three and also checks contract sizes against EIP-170 and the storage layout of the upgradeable contracts.

## Trust assumptions

| Who | What it can do | What it cannot do |
|---|---|---|
| Flap's Guardian | Upgrade the vault and launcher logic (the only upgrade path, per Flap's Pool Launch spec); call every team function, including `windDown()`, which the vault records | Count as a heartbeat, raise the tap, change the team wallet or a term, or send treasury funds anywhere but the team wallet and redeeming holders, short of an upgrade |
| Atlas (one signer) | Set the BNB/USD rate the budget and the dollar unlock targets use | Open or block an exit; unlock team tokens alone, since the multiple must also hold in BNB |
| The PancakeSwap pool | Set the price every rule reads | Move book value: pool tokens count in the supply |
| The report relayer, if named | Pause the tap with a failed verdict | Touch funds or any other rule |
| Keepers and pokers | Choose when to poke, within the oracle's minimum gap, and whether a signed rate rides along | Change the pool price or forge a rate; anyone else can poke too |

## Atlas never controls the exit

The exit rule compares two numbers that both live on chain: the pool's time-weighted price and book value, both in BNB. An observation needs no Atlas rate to step the exit streak, and the keeper pokes without one when Atlas cannot be reached. A wrong, late or missing rate can delay or misprice the budget, within its cap; it cannot keep holders from leaving.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on the repository (Security tab, "Report a vulnerability"), as [SECURITY.md](https://github.com/Adityaakr/Covenent/blob/main/SECURITY.md) describes. Please do not open a public issue or test against covenants other people use.
