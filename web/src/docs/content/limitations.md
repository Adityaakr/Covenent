## What the rules do not protect

- **The floor is below the sale price.** With the default terms, book value starts at 60% of the sale price and falls as the team draws its budget.
- **The treasury is BNB.** Its value in dollars moves with BNB.
- **Exit, not voice.** Holders cannot vote, and have no claim on anything off chain, such as a company, code or revenue that never reaches the vault. Unlike a governance system such as MetaDAO's, nobody can approve new spending or change course either ([Why Covenant](/docs/why-covenant#what-covenant-does-differently)).
- **Tax income ends.** After the tax period, the tap is paid from the treasury alone, so book value only falls unless the team deposits revenue.
- **Someone has to poke.** The rules move only when the oracle is poked. Anyone can poke (the keeper, the app, an agent), but if nobody does, nothing happens, and each poke counts at most 6 hours of elapsed time.
- **A stolen team key can end the project.** It reaches only the accrued budget, but it can also call `windDown()`. That returns the treasury to holders, so nothing more is taken, but the venture is over. A notice period on wind-down is a later fix.
- **An agent is whoever holds its key.** Covenant does not prove that an agent is autonomous; it binds the wallet either way.

## Testnet only

Covenant runs on BNB testnet. Nothing is deployed on BNB Chain mainnet, where Flap has not enabled the launcher factories on its Portal yet; the testnet Portal launches from them anyway. Test BNB has no value.

## Proven on a fork, not yet on testnet

- Trading tax reaching a vault: testnet volume never reached the amount Flap's tax processor waits for before it forwards tax.
- ERC-8004 reputation writes: the first testnet covenant has no agent id.
- Four.meme through OpenFour's ForwardVault, which exists only on mainnet.

On the current contracts, `CVD` launched and is active; the full lifecycle (exit, abandonment, redemption) has run on chain only for `CVT`, on the first deployment, and in the test suites and fork tests.

## Not hosted

There is no hosted MCP server or API. Run them from a clone ([Quickstart](/docs/quickstart)). The site serves these docs, [/llms.txt](/llms.txt) and Covenant AI. CoinMarketCap data feeds the launch simulator; the hosted site, which runs without a Covenant server, shows no live CoinMarketCap quote.

## Open findings

Two low-severity findings from an outside review are open, with fixes planned before mainnet. Neither moves funds:

- **R-3:** `burnSaleDust()` can revert for good once every sale token is claimed, which only stops the dust sweep.
- **R-4:** the Four.meme Lite vault's form schema accepts values the contract refuses at creation (`tapBps` up to 5000, `tapPeriod` from 1 day).

The full list, with every fixed item, is [docs/KNOWN-ISSUES.md](https://github.com/Adityaakr/Covenent/blob/main/docs/KNOWN-ISSUES.md).

## Planned

Cournot report checks: a Cournot market per period would judge each report, and the verdict would reach the vault through its report relayer. The vault's hook exists; no relayer runs yet.
