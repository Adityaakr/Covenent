import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { deploymentFile, deploymentsPath, loadConfig } from '../src/config.js';
import { redactUrl } from '../src/safety.js';
import { createMcpHttpApp } from './http.js';

if (!process.env.COVENANT_DEPLOYMENTS && !process.env.COVENANT_NETWORK && !existsSync(deploymentsPath())) {
  process.env.COVENANT_DEPLOYMENTS = deploymentFile('97.json');
}
const cfg = loadConfig();
const host = process.env.MCP_HTTP_HOST ?? '127.0.0.1';
const port = Number(process.env.MCP_HTTP_PORT ?? 8788);
const writes = process.env.MCP_HTTP_WRITES === '1';
const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
const allowedHosts = (process.env.MCP_HTTP_ALLOWED_HOSTS ?? (loopback ? `127.0.0.1:${port},localhost:${port}` : ''))
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const app = createMcpHttpApp({
  cfg,
  writes,
  ratePerMinute: Number(process.env.MCP_HTTP_RATE_PER_MIN ?? 120),
  allowedHosts,
  trustProxy: process.env.MCP_HTTP_TRUST_PROXY === '1',
});
serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.error(
    `[covenant-mcp] streamable HTTP (stateless, ${writes ? 'read + unsigned writes' : 'read-only'}) at http://${host}:${info.port}/mcp; ` +
      `chain ${cfg.chainId} (${redactUrl(cfg.rpcUrl)}). No keys are held.`,
  );
});
