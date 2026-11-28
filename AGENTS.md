# AGENTS.md

Guide for coding agents working in this repository. For what Covenant is, read [README.md](README.md). For the agent
interface Covenant offers its users (MCP, HTTP, skill file), read [server/mcp/SKILL.md](server/mcp/SKILL.md).

## Where truth lives

| Question | Source |
|---|---|
| Product, rules, formulas, threat model | `docs/DESIGN.md`. Where it and the code differ, the code is newer: the exit streak **decays** above book instead of resetting, the exit runs on on-chain numbers only (no Atlas, no depth gate), and the depth gate applies to unlocks and the tap rate only. See server/README.md, "The three exit-rule fixes" |
| Contract behavior | NatSpec at the top of each contract in `contracts/src/` (`CovenantVault.sol` states all five rules) |
| Defaults and bounds | `contracts/src/launcher/CovenantProfiles.sol` (production and demo profiles, default terms) |
| Deploying to testnet and mainnet | `docs/DEPLOY.md`, `contracts/script/Deploy.s.sol` |
| API response shapes | `server/src/schema.ts` (zod). The web app mirrors these. Change both together |
| Landing copy | `docs/landing/` (specs and content), `web/src/landing/content/` |

## Layout

```
contracts/   Foundry (Solidity 0.8.26). src/{launcher,vault,oracle,lens,openfour}; src/flap + src/vendor are vendored
             UNCHANGED (contracts/VENDORED.md); src/mocks are local-chain stand-ins only; abi/ is exported; deployments/
server/      TypeScript, Node 22, pnpm, viem, Hono. src/{api,keeper,covenant,atlas,sim,abi}, agents/{issuer,investor}, mcp/
web/         Next.js 16 app router, React 19, Tailwind 4, wagmi + viem, Privy. Landing at / (src/landing), docs at /docs
             (src/docs), app at /app
flap/        Covenant's Launcher UI and Vault UI packages for flap.sh, on Flap's component template (flap/README.md)
scripts/     dev-all.sh (whole local stack), dev-up/dev-down (chain + deploy), dev-demo (scenes), dev-abi, dev-funds
docs/        DESIGN.md, DEPLOY.md, landing/, assets/ (README images)
```

Each of `server/` and `web/` is a standalone pnpm package with its own lockfile. There is no root workspace.

## Commands

Foundry lives in `~/.foundry/bin`. Scripts add it to `PATH`; in your own shell run `export PATH="$HOME/.foundry/bin:$PATH"`.

```bash
git submodule update --init                     # contracts/lib (forge-std, OpenZeppelin, solady)

# contracts
( cd contracts && forge build && forge test )   # unit + invariant + oracle fixtures
( cd contracts && forge test --match-path "test/fork/*" )   # needs BSC_RPC_URL / BSC_TESTNET_RPC_URL
scripts/dev-abi.sh                              # after any ABI change: rebuild and re-export contracts/abi/*.json

# server
( cd server && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test )
pnpm --dir server test:unit | test:chain        # chain tests start their own anvil per file
pnpm --dir server api | keeper | issuer | investor | mcp | sim

# web
( cd web && pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm lint && pnpm build )
pnpm --dir web dev                              # http://localhost:8080

# whole stack
scripts/dev-all.sh [--mock|--fork|--prod|--no-chain]    # status | stop | stop-issuer
scripts/testnet-up.sh [--prod]                  # chain 97; status | stop | issuer | stop-issuer
```

Run the tests of every package you touched before you report done. `server/test/chain/deployed.test.ts` is skipped
unless `contracts/deployments/local.json` exists (it does after `scripts/dev-all.sh`).

## Ports

| Port | Service | Override |
|---|---|---|
| 8545 | anvil | `DEV_PORT` |
| 8787 | server API | `API_PORT` |
| 8080 | web app (`pnpm dev`, `pnpm start`) | `WEB_PORT` for dev-all. 8081-8083 and 8085 are the other origins the Privy app allows |
| 3000 | web app without Privy (`pnpm dev:3000`) | browser wallets only |

The server must allow the web origin in `CORS_ORIGINS`.

## Rules that are easy to break

- **No mock or stand-in data on screens.** Every screen reads the chain (through `CovenantLens` when the deployment
  names it) or the server. When the deployment or the chain is missing, show an empty state and say why. Do not add
  sample numbers, placeholder covenants or invented addresses anywhere, including docs.
- **Never hard-code a chain id or an address.** Read them from the deployment record:
  `contracts/deployments/local.json` (dev chain, git-ignored), `97.json` (BNB testnet), or `97.local.json` (the testnet
  record in the app's shape, written by `scripts/testnet-up.sh`, git-ignored). A fork reports chain id **56**, because
  Flap's Portal refuses other ids. The offline mock chain reports **31337**. The server takes `COVENANT_DEPLOYMENTS`
  and `COVENANT_ABI_DIR` to pick another file.
- **Three run modes.** Local mock (31337: Flap, PancakeSwap and ERC-8004 replaced by `src/mocks`), local fork (56: the
  real Portal, forked), and BNB testnet (97: real transactions, Atlas push feed, no faucet, no seeded data). The
  Four.meme path runs on the fork only: OpenFour's ForwardVault refuses any chain but 56 and 97.
- **Keys only in git-ignored files.** `server/.env`, `contracts/.env`, `web/.env.local`, `.dev/testnet/keys.env`.
  Every `NEXT_PUBLIC_*` value in `web/.env*` is public; the only secret there is `ANTHROPIC_API_KEY` in
  `web/.env.local`, read by the Covenant AI route (`/api/ask`) on the server, never with a `NEXT_PUBLIC_` prefix. The anvil keys in
  scripts and tests are anvil's public test keys. Never print, log or commit a real key.
- **Chain guards stay on.** The server refuses to sign on chains 56 and 97 unless the RPC is loopback (a local fork) or
  `COVENANT_ALLOW_PUBLIC_NETWORK=1` is set, and only `scripts/testnet-up.sh` sets it. The faucet refuses any RPC that is
  not a loopback node. Do not loosen these.
- **Writes are unsigned.** The MCP server and the API's `/tx/*` routes return unsigned transactions and never hold a
  key. Keep it that way. In `server/mcp/`, stdout is the MCP protocol: log to stderr only.
- **ABI flow.** Contract change, then `scripts/dev-abi.sh`, then commit `contracts/abi/*.json`. The server and the web
  read the ABIs at runtime (the web through `/api/deployment` on every request). The server's reads are tolerant: a
  view missing from the ABI shows up in `sheet.reads.missing`. `server/src/covenant/read.ts` maps names that differ
  between the doc and the contracts (`VAULT_ALIASES`).
- **Vendored code is unchanged.** Do not edit `contracts/src/flap/` or `contracts/src/vendor/`. Wrap or extend instead.
- **Flap constraints.** The token address must end in `7777`: the web mines the salt in a worker
  (`web/src/lib/chain/salt.worker.ts`). The launcher's `description()` must stay under 4 KB, because past that the
  Portal stores an empty string. `finalize()` is sent with a 15M gas limit (Flap's cap; it needs 12M left at its
  check). In fork tests, use plain numbered accounts, not `makeAddr`.
- **Fork log ranges.** On a fork, read logs from `deployedAtBlock + 1`. Ranges at or below the fork block hit the
  upstream public RPC.
- **Next.js 16 has breaking changes.** Read the relevant guide in `web/node_modules/next/dist/docs/` before writing
  Next code. `web/AGENTS.md` is written and re-added by `next dev`; leave it in place.

## Commits

Small, focused commits with a message that says what changed and why. Do not commit `.env` files, `.dev/`,
`contracts/deployments/local.json` or `97.local.json`.
