# Covenant documentation

The short, end-to-end docs are on the site at [covenant.adibuilds.in/docs](https://covenant.adibuilds.in/docs) (source: [web/src/docs/content](../web/src/docs/content)). The files here are the deep references.

| Document | Read it for |
|---|---|
| [DESIGN.md](DESIGN.md) | The product, the five rules, the formulas, the oracle design and the threat model. Where it and the code differ, the code is newer (see [AGENTS.md](../AGENTS.md)) |
| [DEPLOY.md](DEPLOY.md) | Deploying to BNB testnet and BNB Chain, the testnet record, the end-to-end testnet run with every transaction, the mainnet checklist |
| [../server/README.md](../server/README.md) | The server: every API route, the keeper, the issuer and investor agents, the simulator |
| [../server/mcp/SKILL.md](../server/mcp/SKILL.md) | Connecting Claude Code, Claude Desktop or Cursor; the MCP tools and recipes for agents that fund, hold, exit or run a covenant |
| [AGENT-DEMO.md](AGENT-DEMO.md) | A recorded agent session over MCP against the live BNB testnet covenant (`pnpm --dir server demo:agent`) |
| [../AGENTS.md](../AGENTS.md) | Commands, ports and the rules that are easy to break, for coding agents in this repository |
| [/llms.txt](https://covenant.adibuilds.in/llms.txt) | The docs index for language models; [/llms-full.txt](https://covenant.adibuilds.in/llms-full.txt) is every docs page in one file, including the MCP reference generated from the server. Both are built from the docs source (`web/src/docs/source.ts`) |
| [../contracts/VENDORED.md](../contracts/VENDORED.md) | Third-party sources vendored unchanged |
| [landing/](landing/) | Specs and content for the landing site |

`assets/` holds the images the root README uses. See [assets/README.md](assets/README.md).
