# Security policy

Covenant is hackathon code (BNB Hack Bangkok, 25 to 27 November 2026). It has had an AI pre-audit and Flap's audit
bot's review, and the findings are fixed or listed in [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md). It has not had an
independent human audit. Do not use it with real funds.

## Supported deployments

| Network | Status | Record |
|---|---|---|
| BNB testnet (97) | Deployed, Sourcify-verified, supported | [`contracts/deployments/97.json`](contracts/deployments/97.json), [docs/DEPLOY.md](docs/DEPLOY.md) |
| BNB Chain (56) | Not deployed. Creation is paused on Flap's Portal until Flap enables the launcher factory after its audit | none |

The first testnet deployment (before the audit fixes) is superseded; its one covenant (`CVT`, wound down) stays
readable. Only the current record is supported.

## Scope

In scope:

- `contracts/src/launcher`, `contracts/src/vault`, `contracts/src/oracle`, `contracts/src/lens`,
  `contracts/src/openfour/CovenantLiteVault.sol`, `contracts/src/agent`.
- `contracts/script/Deploy.s.sol` and the deployment records.
- The server (`server/`): API, keeper, MCP server and the issuer and investor agents, which build or sign transactions.
- The web app's transaction paths (`web/src/lib/chain`, `web/src/lib/data/actions.ts`).

Out of scope: vendored third-party code under `contracts/src/flap` (Flap's spec, unchanged), `contracts/src/vendor`
(Atlas consumer, OpenFour), `contracts/src/mocks` and test files; Flap's Portal, Guardian and tax token; Atlas;
PancakeSwap; the ERC-8004 registries. Four.meme's `CovenantLiteVault` is outside Flap's audit scope but inside ours.

## Trust assumptions

Flap's Guardian is the only upgrade path for the vault and launcher beacons and can call every team function (Flap's
Pool Launch spec). One Atlas signer sets BNB/USD. The PancakeSwap pair is the price. The disclosure relayer is trusted
for rule 5 only. See the docs' [Security](https://covenant.adibuilds.in/docs/security#trust-assumptions) page and docs/DESIGN.md "Trust assumptions".

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Include the
contract or file, the network, a description and, if you can, a Foundry test that reproduces it. Please do not open a
public issue or test against live testnet covenants other people use.

We aim to acknowledge within 48 hours and to say within 7 days whether we accept the report and what we will do.
Fixes ship as a new deployment (or, for the vault and launcher, a Guardian upgrade coordinated with Flap). Reporters
are credited in the changelog unless they ask not to be.

## Before you review

- [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md): every known item with its status (fixed, accepted, disclosed by design).
- [docs/DESIGN.md](docs/DESIGN.md): the rules, the formulas and the threat model.
- `contracts/test/regression/PreAuditRegression.t.sol`: the pre-audit's PoCs, turned into regression tests.
- `contracts/storage-layout/`: the storage layout of the upgradeable contracts; `scripts/check-storage-layout.sh` fails
  on any change.
