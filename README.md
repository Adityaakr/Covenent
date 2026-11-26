# Covenant

Investor protections that enforce themselves: a Flap Pool Launch launcher and vault on BNB Chain.
See docs/DESIGN.md for the product and engineering design.

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
