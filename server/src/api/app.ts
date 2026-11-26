import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { getAddress, isAddress, parseEther, type Address } from 'viem';
import { fetchBnbUsdReport, NoPullReport } from '../atlas/report.js';
import type { ServerConfig } from '../config.js';
import { downside } from '../covenant/downside.js';
import { CovenantService, UnverifiedCovenantError } from '../covenant/read.js';
import { TxBuilder } from '../covenant/tx.js';
import { readAlerts } from '../keeper/alerts.js';
import { assertValueWithinCap, boundedSet, callerAddress, RateLimiter, redactSecrets, redactUrl } from '../safety.js';
import type { CovenantSheet, Health, PokeReport, SimulatorResult } from '../schema.js';
import { CMC_ROUTES, CmcClient } from './cmc.js';
import { Faucet, FaucetError } from './faucet.js';
import { FourMeme } from './fourmeme.js';

export interface AppDeps {
  cfg: ServerConfig;
  svc?: CovenantService;
  cmc?: CmcClient;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function vaultParam(c: Context): Address {
  const v = c.req.param('vault') ?? c.req.query('vault');
  if (!v || !isAddress(v)) throw new HttpError(400, 'vault must be a 0x address');
  return getAddress(v);
}

function bigintQuery(c: Context, name: string, opts: { ether?: boolean } = {}): bigint | undefined {
  const v = c.req.query(name);
  if (v === undefined || v === '') return undefined;
  try {
    return opts.ether && v.includes('.') ? parseEther(v) : BigInt(v);
  } catch {
    throw new HttpError(400, `${name} must be an integer (wei)${opts.ether ? ' or a decimal BNB amount' : ''}`);
  }
}

/**
 * The caller's IP for rate limits: the socket's peer address, or the first X-Forwarded-For hop when the server sits
 * behind a proxy that sets it (FAUCET_TRUST_PROXY=1; otherwise the header is ignored, since anyone can send it).
 */
function clientIp(c: Context): string | undefined {
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  const ip = callerAddress(c.req.header('x-forwarded-for'), env?.incoming?.socket?.remoteAddress, process.env.FAUCET_TRUST_PROXY === '1');
  return ip === 'unknown' ? undefined : ip;
}

export function createApp(deps: AppDeps) {
  const { cfg } = deps;
  const svc = deps.svc ?? new CovenantService({ cfg });
  const txb = new TxBuilder(svc);
  const cmc = deps.cmc ?? new CmcClient(cfg.cmc.apiKey, cfg.cmc.baseUrl);
  const sheetCache = new Map<string, { at: number; value: Promise<CovenantSheet> }>();
  const sheet = (vault: Address, fresh = false) => {
    const hit = sheetCache.get(vault);
    if (!fresh && hit && Date.now() - hit.at < 2_000) return hit.value;
    const value = svc.sheet(vault);
    boundedSet(sheetCache, vault, { at: Date.now(), value }, 500);
    value.catch(() => sheetCache.delete(vault));
    return value;
  };

  // Routes that build transactions or fetch signed reports: per-IP limits (API_TX_RATE_PER_MIN, default 60/min).
  const txLimiter = new RateLimiter(Number(process.env.API_TX_RATE_PER_MIN ?? 60));
  const limitTx = async (c: Context, next: () => Promise<void>) => {
    const r = txLimiter.take(clientIp(c) ?? 'unknown');
    c.header('x-ratelimit-remaining', String(r.remaining));
    if (!r.ok) {
      c.header('retry-after', String(r.retryAfterSeconds));
      return c.json({ error: `rate limited: retry in ${r.retryAfterSeconds} s` }, 429);
    }
    await next();
  };

  const faucet = new Faucet(cfg, svc.client);
  const fourmeme = new FourMeme(cfg, svc.client);
  const app = new Hono();
  app.use('*', cors({ origin: (o) => (cfg.corsOrigins.includes('*') || cfg.corsOrigins.includes(o) ? o : null) }));
  let errorSeq = 0;
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    if (err instanceof FaucetError) return c.json({ error: err.message, ...err.extra }, err.status as 400);
    if (err instanceof UnverifiedCovenantError) return c.json({ error: err.message }, 404);
    // Upstream messages carry RPC URLs (API keys included) and request bodies: log them here, redacted, never return them.
    const id = `${Date.now().toString(36)}-${(++errorSeq).toString(36)}`;
    console.error(`[api] ${id} ${c.req.method} ${c.req.path}: ${redactSecrets(err.message).split('\n')[0]}`);
    return c.json({ error: 'internal error', id }, 500);
  });

  app.get('/health', async (c) => {
    let block: string | null = null;
    try {
      block = (await svc.client.getBlockNumber()).toString();
    } catch {
      /* chain down */
    }
    const body: Health = {
      ok: block !== null,
      chainId: cfg.chainId,
      rpcUrl: redactUrl(cfg.rpcUrl),
      blockNumber: block,
      deploymentsLoaded: cfg.deployments !== null,
      abiSource: svc.abis.published.length ? svc.abis.published : ['fallback (docs/DESIGN.md)'],
      covenants: svc.covenants().length,
      oracle: cfg.oracle ?? null,
      atlasMode: cfg.atlas.apiKey ? 'atlas' : cfg.atlas.localSignerAllowed ? 'local-test-signer' : cfg.atlas.pushFeed ? 'push-feed' : 'none',
      cmcKey: cmc.hasKey,
      simulator: existsSync(cfg.simulatorFile),
    };
    return c.json(body, block === null ? 503 : 200);
  });

  app.get('/api/covenants', async (c) => c.json({ covenants: await svc.list() }));
  app.get('/api/covenants/:vault', async (c) => c.json(await sheet(vaultParam(c), c.req.query('fresh') === '1')));
  app.get('/api/covenants/:vault/events', async (c) => {
    const ref = svc.ref(vaultParam(c));
    const s = await sheet(ref.vault);
    const full = { ...ref, launcher: s.launcher ?? undefined };
    await svc.syncEvents(full);
    const events = svc.events(full);
    const kind = c.req.query('kind');
    return c.json({ vault: ref.vault, events: kind ? events.filter((e) => e.kind === kind) : events });
  });
  app.get('/api/covenants/:vault/history', async (c) => c.json(await svc.history(vaultParam(c))));
  app.get('/api/covenants/:vault/alerts', (c) => c.json({ alerts: readAlerts(cfg.keeper.alertsFile, vaultParam(c)) }));
  app.get('/api/covenants/:vault/downside', async (c) => {
    const holder = c.req.query('holder');
    if (holder && !isAddress(holder)) throw new HttpError(400, 'holder must be a 0x address');
    return c.json(
      await downside(svc, vaultParam(c), { holder: holder ? getAddress(holder) : undefined, tokensWei: bigintQuery(c, 'tokens') }),
    );
  });

  /** Unsigned transactions for the web (or any wallet). Nothing is signed server-side. */
  // Every API route: a general per-IP limit (API_RATE_PER_MIN, default 300/min); the tx and report routes get a tighter one.
  const apiLimiter = new RateLimiter(Number(process.env.API_RATE_PER_MIN ?? 300));
  app.use('/api/*', async (c, next) => {
    const r = apiLimiter.take(clientIp(c) ?? 'unknown');
    if (!r.ok) {
      c.header('retry-after', String(r.retryAfterSeconds));
      return c.json({ error: `rate limited: retry in ${r.retryAfterSeconds} s` }, 429);
    }
    await next();
  });
  app.use('/api/covenants/:vault/tx/*', limitTx);
  app.use('/api/poke-report', limitTx);
  app.use('/poke-report', limitTx);
  app.get('/api/covenants/:vault/tx/:action', async (c) => {
    // Any covenant address (vault, token, launcher, pool), provenance-checked: no transaction is built for a contract
    // the deployment's factories did not create. A raise that has not launched has only its launcher.
    const r = await svc.resolve(vaultParam(c));
    const action = c.req.param('action');
    const holder = c.req.query('from');
    const from = holder && isAddress(holder) ? getAddress(holder) : undefined;
    const raiseActions = ['commit', 'claim-refund', 'finalize'];
    if (!raiseActions.includes(action) && !r.vault) throw new HttpError(409, `${action}: this raise has not launched, so there is no vault yet`);
    if (raiseActions.includes(action) && !r.launcher) throw new HttpError(409, `${action}: no launcher is known for this covenant`);
    const vault = r.vault as Address;
    const launcher = { launcher: r.launcher ?? undefined };
    switch (action) {
      case 'commit': {
        const amount = bigintQuery(c, 'amount', { ether: true });
        if (!amount) throw new HttpError(400, 'amount (wei or decimal BNB) required');
        try {
          assertValueWithinCap(cfg.chainId, amount);
        } catch (e) {
          throw new HttpError(400, (e as Error).message);
        }
        return c.json(await txb.commit(launcher, amount));
      }
      case 'finalize':
        return c.json(await txb.finalize({ vault }));
      case 'claim-refund':
        return c.json(await txb.claimRefund(launcher));
      case 'finalize':
        return c.json(await txb.finalize(launcher));
      case 'release-team':
        return c.json(txb.releaseTeam(vault));
      case 'claim-tokens':
        return c.json(txb.claimTokens(vault));
      case 'redeem': {
        const amount = bigintQuery(c, 'amount');
        if (!amount) throw new HttpError(400, 'amount (token wei) required');
        return c.json(await txb.redeem(vault, amount, from));
      }
      case 'declare-abandoned':
        return c.json(txb.declareAbandoned(vault));
      case 'claim-tap':
        return c.json(await txb.claimTap(vault));
      case 'heartbeat':
        return c.json(await txb.heartbeat(vault));
      case 'lower-tap': {
        const usd = bigintQuery(c, 'usd');
        if (usd === undefined) throw new HttpError(400, 'usd (18-decimal integer) required');
        return c.json(await txb.lowerTap(vault, usd));
      }
      default:
        throw new HttpError(404, `unknown action ${action}`);
    }
  });

  let reportCache: { at: number; value: ReturnType<typeof fetchBnbUsdReport> } | null = null;
  /** Signed BNB/USD report for the web's poke button; with ?vault= it also returns the full poke tx. */
  const pokeReport = async (c: Context) => {
    const v = c.req.query('vault');
    if (v && !isAddress(v)) throw new HttpError(400, 'vault must be a 0x address');
    let rep;
    try {
      // A signed report is valid for about 180 s: reuse one for 60 s instead of spending the Atlas key per request.
      if (!reportCache || Date.now() - reportCache.at > 60_000) {
        const value = fetchBnbUsdReport(cfg.atlas, svc.client);
        reportCache = { at: Date.now(), value };
        value.catch(() => (reportCache = null));
      }
      rep = await reportCache.value;
    } catch (e) {
      // No pull report to attach (BNB testnet without an Atlas key): a plain poke reads the oracle's push feed.
      if (e instanceof NoPullReport) return c.json({ error: e.message, mode: 'push-feed', pushFeed: cfg.atlas.pushFeed ?? null }, 409);
      throw e;
    }
    const body: PokeReport = {
      mode: rep.mode,
      feedId: rep.feedId,
      bnbUsd: rep.bnbUsd,
      timestamp: rep.timestamp,
      signer: rep.signer,
      extraData: rep.extraData,
      note: rep.note,
      tx: v && cfg.oracle ? txb.poke(getAddress(v), rep) : null,
    };
    c.header('cache-control', 'no-store');
    return c.json(body);
  };
  app.get('/api/poke-report', pokeReport);
  app.get('/poke-report', pokeReport);

  app.get('/api/simulator', (c) => {
    if (!existsSync(cfg.simulatorFile)) return c.json({ error: 'simulator has not run yet: pnpm sim' }, 404);
    const body = JSON.parse(readFileSync(cfg.simulatorFile, 'utf8')) as SimulatorResult;
    return c.json(body);
  });

  // Test funds (dev chain, or the BNB testnet drip): GET says whether it is on, what it pays and whether ?address can
  // be paid now; POST {address} pays out. The caller's IP feeds the testnet drip's once-a-day limit.
  app.get('/api/faucet', async (c) => c.json(await faucet.status(c.req.query('address'), clientIp(c))));
  app.post('/api/faucet', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { address?: string };
    return c.json(await faucet.send(body.address ?? c.req.query('address') ?? '', clientIp(c)));
  });

  // The Four.meme path (Covenant Lite): ForwardVault params encoded exactly as the live ForwardVault decodes them,
  // and the Lite covenants the local launcher created.
  app.get('/api/fourmeme/encode', (c) => {
    const r = fourmeme.encode(c.req.query());
    return c.json(r, r.ok ? 200 : 400);
  });
  app.get('/api/fourmeme/launches', async (c) => c.json(await fourmeme.launches()));

  // The simulator's real launches with their daily candles, for the web app's "try other terms" replay.
  app.get('/api/simulator/sample', (c) => {
    if (!existsSync(cfg.simulatorFile)) return c.json({ error: 'simulator has not run yet: pnpm sim' }, 404);
    const body = JSON.parse(readFileSync(cfg.simulatorFile, 'utf8')) as SimulatorResult;
    const tokens = body.tokens.filter((t) => t.candles && t.candles.length > 1);
    if (!tokens.length) return c.json({ error: 'this snapshot has no candles: rerun pnpm sim' }, 404);
    return c.json({
      source: body.source,
      generatedAt: body.generatedAt,
      tokens: tokens.map((t) => ({ address: t.token, symbol: t.symbol ?? '?', name: t.symbol ?? t.token, launchedAt: t.createdAt ?? 0, candles: t.candles })),
    });
  });

  app.get('/api/cmc', (c) => c.json({ mode: cmc.hasKey ? 'pro' : 'keyless-public-api', routes: CMC_ROUTES.map(({ name, method, path, use }) => ({ name, method, path, use })) }));
  for (const route of CMC_ROUTES) {
    const handler = async (c: Context) => {
      const body = route.method === 'POST' ? await c.req.json().catch(() => ({})) : undefined;
      const r = await cmc.call(route, c.req.query(), body);
      c.header('x-covenant-cmc-mode', r.mode);
      c.header('x-covenant-cache', r.cached ? 'hit' : 'miss');
      return c.json(r.body as object, r.status as 200);
    };
    if (route.method === 'GET') app.get(`/api/cmc/${route.name}`, handler);
    else app.post(`/api/cmc/${route.name}`, handler);
  }

  /** Period reports written by the issuer agent; postReport() stores this URL and the content hash. */
  app.get('/reports/:vault/:period', (c) => {
    const vault = vaultParam(c);
    const period = c.req.param('period').replace(/[^0-9]/g, '');
    const file = path.join(cfg.dataDir, 'reports', vault.toLowerCase(), `${period}.md`);
    if (!existsSync(file)) return c.json({ error: 'no such report' }, 404);
    return c.body(readFileSync(file), 200, { 'content-type': 'text/markdown; charset=utf-8' });
  });

  /** ERC-8004 registration files written by `pnpm issuer:register`. */
  app.get('/agents/:owner/registration.json', (c) => {
    const owner = c.req.param('owner');
    if (!isAddress(owner)) throw new HttpError(400, 'owner must be a 0x address');
    const file = path.join(cfg.dataDir, 'agents', `${owner.toLowerCase()}.json`);
    if (!existsSync(file)) return c.json({ error: 'no registration file' }, 404);
    return c.body(readFileSync(file), 200, { 'content-type': 'application/json' });
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  return app;
}
