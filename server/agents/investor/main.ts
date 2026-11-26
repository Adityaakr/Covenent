import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Hex } from 'viem';
import { assertSigningAllowed, publicClient, walletClient } from '../../src/chain.js';
import { loadConfig, SERVER_ROOT } from '../../src/config.js';
import { InvestorAgent } from './investor.js';

const cfg = loadConfig();
const key = process.env.INVESTOR_PRIVATE_KEY as Hex | undefined;
if (!key) {
  console.error('INVESTOR_PRIVATE_KEY is required (a holder wallet; local chain only).');
  process.exit(2);
}
assertSigningAllowed(cfg.chainId, cfg.rpcUrl);

// Talk to the Covenant MCP server over stdio, exactly as any MCP client would.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(SERVER_ROOT, 'mcp', 'main.ts')],
  env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string' && !/PRIVATE_KEY/.test(e[0]))),
  stderr: 'inherit',
});
const mcp = new Client({ name: 'covenant-investor-agent', version: '0.1.0' });
await mcp.connect(transport);

const agent = new InvestorAgent(mcp, walletClient(cfg, key), publicClient(cfg), { minEdgePct: Number(process.env.INVESTOR_MIN_EDGE_PCT ?? 1) });
const decisions = await agent.run();
console.log(JSON.stringify(decisions.map(({ downside: _d, ...rest }) => rest), null, 2));
await mcp.close();
