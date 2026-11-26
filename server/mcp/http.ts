import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ServerConfig } from '../src/config.js';
import { CovenantService } from '../src/covenant/read.js';
import { RateLimiter } from '../src/safety.js';
import { createMcpServer, SERVER_VERSION, TOOL_NAMES, READ_TOOLS } from './tools.js';

export interface McpHttpOptions {
  cfg: ServerConfig;
  svc?: CovenantService;
  /** register the write tools too (they still only build unsigned transactions); default false */
  writes?: boolean;
  /** requests per minute per caller IP; default 120 */
  ratePerMinute?: number;
  /** Host header values to accept (DNS-rebinding guard); empty accepts any */
  allowedHosts?: string[];
  trustProxy?: boolean;
}

function callerIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (fwd) return fwd;
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
}

/**
 * Covenant MCP over streamable HTTP, stateless: every POST /mcp gets a fresh server and transport (no session ids),
 * sharing one chain reader so its event cache survives between requests. Read-only by default, so it can be hosted
 * for remote agents; it never holds a key either way.
 */
export function createMcpHttpApp(opts: McpHttpOptions) {
  const svc = opts.svc ?? new CovenantService({ cfg: opts.cfg });
  const mode = opts.writes ? 'full' : 'read-only';
  const limiter = new RateLimiter(opts.ratePerMinute ?? 120);
  const app = new Hono();
  app.use('/mcp', cors({ origin: '*', allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'], allowHeaders: ['content-type', 'mcp-protocol-version', 'accept'], exposeHeaders: ['mcp-protocol-version'] }));

  app.get('/health', (c) =>
    c.json({ ok: true, name: 'covenant-mcp', version: SERVER_VERSION, transport: 'streamable-http', stateless: true, mode, chainId: opts.cfg.chainId, tools: mode === 'full' ? TOOL_NAMES.length : READ_TOOLS.length }),
  );

  app.post('/mcp', async (c) => {
    if (opts.allowedHosts?.length) {
      const host = (c.req.header('host') ?? '').toLowerCase();
      if (!opts.allowedHosts.includes(host)) return c.json({ jsonrpc: '2.0', error: { code: -32000, message: `host ${host} not allowed` }, id: null }, 403);
    }
    const lim = limiter.take(callerIp(c, opts.trustProxy ?? false));
    if (!lim.ok) {
      c.header('retry-after', String(lim.retryAfterSeconds));
      return c.json({ jsonrpc: '2.0', error: { code: -32000, message: `rate limited: retry in ${lim.retryAfterSeconds} s` }, id: null }, 429);
    }
    const server = createMcpServer({ cfg: opts.cfg, svc, mode, transport: 'http' });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      // the JSON response is complete once handleRequest resolves; close after the body is handed over
      queueMicrotask(() => void server.close().catch(() => undefined));
    }
  });
  // stateless: no server-sent stream to resume and no session to end
  const noSession = (c: Context) => c.json({ jsonrpc: '2.0', error: { code: -32000, message: 'stateless server: only POST /mcp' }, id: null }, 405);
  app.get('/mcp', noSession);
  app.delete('/mcp', noSession);
  app.notFound((c) => c.json({ error: 'not found: POST /mcp for MCP, GET /health' }, 404));
  return app;
}
