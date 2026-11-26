# Covenant

Investor protections that enforce themselves: a Flap Pool Launch launcher and vault on BNB Chain.
See docs/DESIGN.md for the product and engineering design.

## Contracts (`contracts/`, `scripts/dev-*`)

Foundry project: the launcher and vault pair on Flap's Pool Launch bases, the oracle on Atlas's pull consumer, a
read lens, and the OpenFour template. Third-party files are vendored unchanged under `contracts/src/flap` and
`contracts/src/vendor` (see `contracts/VENDORED.md`); libraries are submodules (`git submodule update --init`).

```bash
scripts/dev-up.sh        # local chain + full deploy + ABIs + the seeded demo story (BNB Chain fork if reachable, else offline)
scripts/dev-demo.sh <scene>   # replay one demo scene; scripts/dev-demo.sh advance <seconds> moves the clock
scripts/dev-down.sh      # stop the chain
cd contracts && forge test    # unit, oracle fixtures, invariants; fork tests need BSC_RPC_URL / BSC_TESTNET_RPC_URL
```

What the web app and the server read:

- `contracts/abi/<Contract>.json`: ABIs (CovenantLauncherFactory, CovenantLauncher, CovenantVault, CovenantOracle,
  CovenantLens, ... plus the Flap, ERC-8004 and mock surfaces the stack uses).
- `contracts/deployments/local.json` (written by `dev-up.sh`, git-ignored): `{chainId, rpcUrl, mode, addresses{...},
  atlas{signer, feedIdBnbUsd, ...}, accounts{role: {address, anvilIndex}}, demo{launcher, vault, token, pair,
  taxProcessor, agentId, scene}}`. A fork reports chain id **56** (Flap's Portal refuses other ids); the offline
  chain reports 31337. Read the id from the file, do not hard-code it.
- `CovenantLens.status(launcher)`, `downside(vault, holder, tokens)` and `issuer(vault)` return everything a
  covenant sheet, the keeper or the MCP server needs in one call each.
- Pokes carry a signed Atlas report appended to `poke(vault)` calldata; on the dev chain the signer is anvil
  account 9 and the BNB/USD feed id is `0x00000001` (see `script/lib/StackBuilder.sol:_atlasPayload` for the format).

The exit rule follows the design review: the exit streak decays rather than resets, and it runs on on-chain numbers
only (no Atlas report, no pool-depth gate), so the exit works with no oracle. Deployment to testnet and mainnet:
`docs/DEPLOY.md`.

## Server (`server/`)

Keeper, API on `:8787`, launch simulator, issuer and investor agents, and the Covenant MCP server, in TypeScript (Node 22, viem, pnpm). See [server/README.md](server/README.md) for run commands, env and the API; `server/src/schema.ts` holds the response schemas the web app mirrors.

## Web app (`web/`)

Next.js 16 (app router), TypeScript, Tailwind 4, wagmi + viem, Privy. The landing page lives at `/` (from `web/src/landing`); the product app is under `/app`: covenants, create, raise, settle, the covenant sheet, redeem, the team/agent console, the launch simulator and the scripted demo.

```sh
cd web
cp .env.example .env.local   # Privy app ID and API base URL; all public values
pnpm install
pnpm dev                     # http://localhost:8080, an origin the Privy app allows (pnpm start serves the build there too)
pnpm dev:3000                # explicit alternative on :3000: no Privy there, browser wallets only
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

The app reads `contracts/deployments/local.json` and `contracts/abi/*.json` on every request (`/api/deployment`). When they load and the chain answers, screens read the contracts live (through `CovenantLens` when the deployment names it). Otherwise they show the mock layer: the design doc's worked example, simulated hour by hour under the five rules. The status chip in the sidebar says which one you are looking at. Market data, the signed Atlas report for the poke button, and the simulator result come from the server at `NEXT_PUBLIC_COVENANT_API` (default `http://localhost:8787`). The server must allow the app's origin: set `CORS_ORIGINS=http://localhost:8080` in `server/.env`.
