# Covenant

Investor protections that enforce themselves: a Flap Pool Launch launcher and vault on BNB Chain.
See docs/DESIGN.md for the product and engineering design.

## Server (`server/`)

Keeper, API on `:8787`, launch simulator, issuer and investor agents, and the Covenant MCP server, in TypeScript (Node 22, viem, pnpm). See [server/README.md](server/README.md) for run commands, env and the API; `server/src/schema.ts` holds the response schemas the web app mirrors.
