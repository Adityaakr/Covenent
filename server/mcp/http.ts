import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ServerConfig } from '../src/config.js';
import { CovenantService } from '../src/covenant/read.js';
import { callerAddress, RateLimiter } from '../src/safety.js';
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
  /**
   * Browser origins allowed to call the endpoint. MCP clients send no Origin; a request that carries one from anywhere
   * else is refused, so a web page cannot drive a local server. Empty: no browser origin is allowed.
   */
  allowedOrigins?: string[];
  trustProxy?: boolean;
}

function callerIp(c: Context, trustProxy: boolean): string {
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return callerAddress(c.req.header('x-forwarded-for'), env?.incoming?.socket?.remoteAddress, trustProxy);
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
  const origins = (opts.allowedOrigins ?? []).map((o) => o.toLowerCase());
  app.use('/mcp', cors({ origin: (o) => (origins.includes(o.toLowerCase()) ? o : null), allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'], allowHeaders: ['content-type', 'mcp-protocol-version', 'accept'], exposeHeaders: ['mcp-protocol-version'] }));

  app.get('/health', (c) =>
    c.json({ ok: true, name: 'covenant-mcp', version: SERVER_VERSION, transport: 'streamable-http', stateless: true, mode, chainId: opts.cfg.chainId, tools: mode === 'full' ? TOOL_NAMES.length : READ_TOOLS.length }),
  );

  app.post('/mcp', async (c) => {
    if (opts.allowedHosts?.length) {
      const host = (c.req.header('host') ?? '').toLowerCase();
      if (!opts.allowedHosts.includes(host)) return c.json({ jsonrpc: '2.0', error: { code: -32000, message: `host ${host} not allowed` }, id: null }, 403);
    }
    const origin = c.req.header('origin');
    if (origin && !origins.includes(origin.toLowerCase())) {
      return c.json({ jsonrpc: '2.0', error: { code: -32000, message: `origin ${origin} not allowed` }, id: null }, 403);
    }
    // a JSON-RPC batch costs one token per message in it
    const body = (await c.req.raw.clone().json().catch(() => null)) as unknown;
    const cost = Array.isArray(body) ? Math.max(1, body.length) : 1;
    const lim = limiter.take(callerIp(c, opts.trustProxy ?? false), cost);
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
