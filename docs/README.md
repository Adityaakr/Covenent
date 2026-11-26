# Covenant documentation

| Document | Read it for |
|---|---|
| [DESIGN.md](DESIGN.md) | The product, the five rules, the formulas, the oracle design and the threat model. Where it and the code differ, the code is newer (see [AGENTS.md](../AGENTS.md)) |
| [DEPLOY.md](DEPLOY.md) | Deploying to BNB testnet and BNB Chain, the testnet record, the end-to-end testnet run with every transaction, the mainnet checklist |
| [../server/README.md](../server/README.md) | The server: every API route, the keeper, the issuer and investor agents, the simulator |
| [../server/mcp/SKILL.md](../server/mcp/SKILL.md) | Connecting Claude Code, Claude Desktop or Cursor; the MCP tools and recipes for agents that fund, hold, exit or run a covenant |
| [AGENT-DEMO.md](AGENT-DEMO.md) | A recorded agent session over MCP against the live BNB testnet covenant (`pnpm --dir server demo:agent`) |
| [../AGENTS.md](../AGENTS.md) | Commands, ports and the rules that are easy to break, for coding agents in this repository |
| [../web/public/llms.txt](../web/public/llms.txt) | A short summary for language models, served by the site at `/llms.txt`; [llms-full.txt](../web/public/llms-full.txt) is the complete reference, generated from the MCP server |
| [../contracts/VENDORED.md](../contracts/VENDORED.md) | Third-party sources vendored unchanged |
| [landing/](landing/) | Specs and content for the landing site |

`assets/` holds the images the root README uses. See [assets/README.md](assets/README.md).
