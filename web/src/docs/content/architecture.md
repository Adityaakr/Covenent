```covenant
diagram:architecture
```

## On chain

- **CovenantLauncherFactory** and **CovenantVaultFactory** extend Flap's launcher and vault factory bases. Flap's Portal calls them to create each covenant's launcher, and, at launch, its vault. There are two pairs: production (timers in days) and demo (timers in minutes).
- **CovenantLauncher** holds the raise, settles it pro rata and launches the token and pool through the Portal.
- **CovenantVault** holds the treasury and runs the five rules. Each one is a beacon proxy that only Flap's Guardian can upgrade.
- **CovenantOracle** has no owner. `poke(vault)` reads the PancakeSwap pair, computes the time-weighted price since that vault's last poke, verifies an Atlas BNB/USD rate if one is available, and sends the vault one observation.
- **CovenantLens** gives the app every view of a covenant in a few calls.
- **CovenantLiteVault** brings the tap and the abandonment switch to Four.meme tokens through OpenFour's ForwardVault.

## Off chain

All in `server/`, TypeScript on Node 22:

- **Keeper:** pokes the oracle for every covenant, dispatches pending trading tax, raises alerts and declares a silent team abandoned. Any number of keepers can run at once; the oracle refuses pokes that come too soon.
- **API:** the read model the web app can use, plus unsigned transactions (`pnpm api`, port 8787).
- **MCP server:** the agent interface, over stdio or HTTP ([For agents](/docs/agents)).
- **Issuer agent:** runs a covenant as its team: forwards revenue, claims the budget, lowers it when the pool trades near book, heartbeats and posts reports. With an Anthropic key, Claude proposes each decision inside a fixed policy.
- **Investor agent:** finds covenants under book, prices its downside and redeems when an exit round pays more than the pool, through the MCP server.
- **Simulator:** replays the default terms over real BNB Chain launches to show how often an exit would have opened.

## Web

`web/` is a Next.js app: the landing pages, these docs and the app at [/app](/app). The app reads the chain directly, through CovenantLens where the deployment names it, and signs with the visitor's own wallet. A hosted build carries the testnet deployment record and the ABIs, so it reads the chain without a Covenant server.

## Repository

| Folder | What is in it |
|---|---|
| `contracts/` | Foundry project: the Covenant contracts, Flap and vendor code (unchanged), tests, deploy scripts, ABIs, deployment records |
| `server/` | keeper, API, MCP server, issuer and investor agents, simulator |
| `web/` | landing pages, docs (`web/src/docs`) and the app |
| `flap/` | Covenant's Launcher UI and Vault UI packages for flap.sh |
| `scripts/` | one-command local stack (`dev-all.sh`) and testnet helpers |
| `docs/` | the design document, the deploy runbook, known issues |
