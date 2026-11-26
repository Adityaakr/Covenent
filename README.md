# Covenant

Investor protections that enforce themselves: a Flap Pool Launch launcher and vault on BNB Chain.
See docs/DESIGN.md for the product and engineering design.

## Run everything on this machine

```bash
git submodule update --init      # contracts/lib
scripts/dev-all.sh               # chain + deploy + demo story + a live covenant + API, keeper, issuer agent + web app
```

One command starts anvil (a BNB Chain fork with chain id 56 when a BNB RPC that serves older state answers, else the
offline mock stack on 31337; `--fork` / `--mock` force one; a block every second), deploys every contract, deploys the
local test funds (Demo USDC and a dUSDC/WBNB pool on the local PancakeSwap), and seeds a covenant at every stage by real
transactions: abandoned by its agent, wound down by its team, ACTIVE with tax and tap, an exit round open, and a raise
under way (recorded under `.seeded` in `contracts/deployments/local.json`). It then starts the server API on `:8787`,
the keeper (pokes every 20 s with the local Atlas test signer), an issuer agent on each live covenant and the web app
on http://localhost:8080 (`WEB_PORT` moves it; 8081-8083 and 8085 are also Privy origins; `--prod` serves a build).
Every screen reads the chain or the server; there is no stand-in data. Settings, Test funds (`/app/settings/funds`)
sends a connected wallet test BNB and Demo USDC on the dev chain (and swaps dUSDC to BNB on the local pool), or a
0.003 tBNB drip on BNB testnet, once per wallet a day.

- `scripts/dev-all.sh status` shows what runs and where the logs are (`.dev/`); `stop` stops everything.
- `scripts/dev-all.sh stop-issuer` kills the issuer agent, the stage moment: once the heartbeat window passes, the
  keeper declares abandonment on its next tick (on by default) and the sheet shows the outcome and the agent's ERC-8004
  record. If the keeper is offline, the sheet's "Declare abandoned" button (anyone can press it) is the fallback.
- `scripts/dev-demo.sh use <launcher>` points the scripted scenes (`trade`, `slide`, `poke`, `advance <s>`, ...) at a
  covenant you created in the web app; `scripts/dev-demo.sh live` seeds another running covenant.
- The Four.meme path (Covenant Lite, rules 1 and 4 as an OpenFour tax vault template): on the fork, `dev-up.sh`
  deploys `FourLiteLauncher`, a local stand-in for Four.meme's token creation (a real Four.meme token needs Four.meme's
  backend signature). One transaction deploys a tax token, clones the live ForwardVault implementation onto the Lite
  template and seeds a PancakeSwap pool; founder tax then flows token -> ForwardVault (6% royalty to the template
  author) -> Lite vault. The seed adds Forge Agent (taxed, tapped, abandoned after 7 silent days, redeemed) and Anvil
  Agent (active). `/app/create?venue=fourmeme` shows the four fields and the exact ForwardVault bytes (also
  `GET /api/fourmeme/encode`) and launches locally; Lite covenants appear on `/app` and at `/app/lite/<vault>`.
  `scripts/dev-demo.sh fourmeme full|active <name> <symbol>` runs the journey by script. Mock mode skips it: OpenFour's
  ForwardVault refuses any chain but BNB Chain and its testnet.
- MCP investor agent: `INVESTOR_PRIVATE_KEY=<anvil #4 key> pnpm --dir server investor` lists covenants under book over
  MCP and redeems where a round is open and redemption beats the pool.
- Wallets: Privy on the Privy-allowed origins, or "Use a browser wallet instead" -> "Account #n", anvil's public
  accounts by role (#0 deployer, #1 team / issuer agent, #2-#4 buyers, #5 whale, #6 keeper, #7 trader).
- `server/.env` (git-ignored) takes `CMC_API_KEY` and `ANTHROPIC_API_KEY`; without them the simulator uses
  GeckoTerminal and issuer reports use a labelled template. Atlas reports are signed by the local test signer (anvil
  #9) until an Atlas API key exists.

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

The app reads `contracts/deployments/local.json` and `contracts/abi/*.json` on every request (`/api/deployment`). Screens read the contracts live (through `CovenantLens` when the deployment names it), on the chain id and RPC that file names. There is no stand-in data: when the deployment or the chain is missing, screens show an empty state and the sidebar's status chip says "Offline" and why. Market data, the signed Atlas report for the poke button, and the simulator result come from the server at `NEXT_PUBLIC_COVENANT_API` (default `http://localhost:8787`). The server must allow the app's origin: set `CORS_ORIGINS=http://localhost:8080` in `server/.env`.
