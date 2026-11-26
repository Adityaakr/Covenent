import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '../src/config.js';
import { createMcpServer } from './tools.js';

// stdout carries the MCP protocol; log only to stderr.
const cfg = loadConfig();
const server = createMcpServer({ cfg });
await server.connect(new StdioServerTransport());
console.error(`[covenant-mcp] stdio ready: chain ${cfg.chainId} (${cfg.rpcUrl}), ${cfg.covenants.length} covenant(s). Writes return unsigned transactions; this server holds no keys.`);
