import { existsSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { deploymentFile, deploymentsPath, loadConfig } from '../src/config.js';
import { redactUrl } from '../src/safety.js';
import { createMcpServer } from './tools.js';

// stdout carries the MCP protocol; log only to stderr.
// With no record chosen and no local dev chain, serve the committed BNB testnet deployment, so `pnpm mcp` works
// from a fresh clone.
if (!process.env.COVENANT_DEPLOYMENTS && !process.env.COVENANT_NETWORK && !existsSync(deploymentsPath())) {
  process.env.COVENANT_DEPLOYMENTS = deploymentFile('97.json');
  console.error('[covenant-mcp] no contracts/deployments/local.json: serving BNB testnet (contracts/deployments/97.json)');
}
const cfg = loadConfig();
const server = createMcpServer({ cfg, transport: 'stdio' });
await server.connect(new StdioServerTransport());
console.error(
  `[covenant-mcp] stdio ready: chain ${cfg.chainId} (${redactUrl(cfg.rpcUrl)}), ${cfg.covenants.length} covenant(s) in the record, ` +
    `${cfg.launcherFactories.length} launcher factory(ies). Writes return unsigned transactions; this server holds no keys.`,
);
