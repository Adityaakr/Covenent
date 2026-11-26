import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { getAddress, isAddress, parseEther, type Address } from 'viem';
import { fetchBnbUsdReport } from '../atlas/report.js';
import type { ServerConfig } from '../config.js';
import { downside } from '../covenant/downside.js';
import { CovenantService } from '../covenant/read.js';
import { TxBuilder } from '../covenant/tx.js';
import { readAlerts } from '../keeper/alerts.js';
import type { CovenantSheet, Health, PokeReport, SimulatorResult } from '../schema.js';
import { CMC_ROUTES, CmcClient } from './cmc.js';

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
    sheetCache.set(vault, { at: Date.now(), value });
    value.catch(() => sheetCache.delete(vault));
    return value;
  };

  const app = new Hono();
  app.use('*', cors({ origin: (o) => (cfg.corsOrigins.includes('*') || cfg.corsOrigins.includes(o) ? o : null) }));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    return c.json({ error: 'internal error', detail: err.message }, 500);
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
      rpcUrl: cfg.rpcUrl,
      blockNumber: block,
      deploymentsLoaded: cfg.deployments !== null,
      abiSource: svc.abis.published.length ? svc.abis.published : ['fallback (docs/DESIGN.md)'],
      covenants: svc.covenants().length,
      oracle: cfg.oracle ?? null,
      atlasMode: cfg.atlas.apiKey ? 'atlas' : 'local-test-signer',
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
  app.get('/api/covenants/:vault/tx/:action', async (c) => {
    const vault = vaultParam(c);
    const action = c.req.param('action');
    const holder = c.req.query('from');
    const from = holder && isAddress(holder) ? getAddress(holder) : undefined;
    switch (action) {
      case 'commit': {
        const amount = bigintQuery(c, 'amount', { ether: true });
        if (!amount) throw new HttpError(400, 'amount (wei or decimal BNB) required');
        return c.json(await txb.commit({ vault }, amount));
      }
      case 'claim-refund':
        return c.json(await txb.claimRefund({ vault }));
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

  /** Signed BNB/USD report for the web's poke button; with ?vault= it also returns the full poke tx. */
  const pokeReport = async (c: Context) => {
    const v = c.req.query('vault');
    if (v && !isAddress(v)) throw new HttpError(400, 'vault must be a 0x address');
    const rep = await fetchBnbUsdReport(cfg.atlas, svc.client);
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
