import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { createApp } from '../../src/api/app.js';
import { CmcClient } from '../../src/api/cmc.js';
import { FINALIZE_GAS } from '../../src/covenant/gas.js';
import { CovenantSheet, CovenantSummary, Downside, Health, History, LedgerEvent, PokeReport, UnsignedTx } from '../../src/schema.js';
import { deployFixture, E18, KEYS, POOL, startAnvil, type Anvil, type Fixture } from './harness.js';

let anvil: Anvil;
let fx: Fixture;
let app: ReturnType<typeof createApp>;

const fakeFetch = (async (url: string | URL) =>
  new Response(JSON.stringify({ data: { echoed: String(url) }, status: { error_code: '0' } }), { status: 200 })) as typeof fetch;

beforeAll(async () => {
  anvil = await startAnvil();
  fx = await deployFixture(anvil);
  const cfg = fx.cfg({ simulatorFile: path.join(fx.dataDir, 'sim.json') });
  app = createApp({ cfg, cmc: new CmcClient(undefined, 'https://cmc.example', 30_000, fakeFetch) });
});
afterAll(() => anvil?.stop());

const get = async (p: string) => {
  const r = await app.request(p);
  return { status: r.status, body: (await r.json()) as unknown };
};

describe('API', () => {
  it('health reports the chain, the oracle and the Atlas mode', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    const h = Health.parse(body);
    expect(h.covenants).toBe(1);
    expect(h.atlasMode).toBe('local-test-signer');
  });

  it('lists covenants and serves the sheet', async () => {
    const list = (await get('/api/covenants')).body as { covenants: unknown[] };
    expect(list.covenants).toHaveLength(1);
    const c = CovenantSummary.parse(list.covenants[0]);
    expect(c.state).toBe('ACTIVE');
    const sheet = CovenantSheet.parse((await get(`/api/covenants/${fx.vault}`)).body);
    expect(sheet.treasuryBnb).toBe(375);
    expect(sheet.exit.rule).toBe('decaying-streak-onchain');
  });

  it('allows the web app origins (8080 and 3000) and refuses others', async () => {
    for (const origin of ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000']) {
      const r = await app.request('/health', { headers: { origin } });
      expect(r.headers.get('access-control-allow-origin')).toBe(origin);
    }
    const r = await app.request('/health', { headers: { origin: 'http://evil.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('rejects a bad address', async () => {
    expect((await get('/api/covenants/0x123')).status).toBe(400);
  });

  it('poke-report returns a signed report and a ready poke tx that lands on-chain', async () => {
    const { body } = await get(`/api/poke-report?vault=${fx.vault}`);
    const rep = PokeReport.parse(body);
    expect(rep.mode).toBe('local-test-signer');
    expect(rep.tx).not.toBeNull();
    expect(rep.tx!.data.endsWith('7096')).toBe(true);
    // the web's poke button: the user's own wallet sends it
    const w = createWalletClient({ account: privateKeyToAccount(KEYS.whale), chain: foundry, transport: http(fx.rpcUrl) });
    const hash = await w.sendTransaction({ to: rep.tx!.to, data: rep.tx!.data });
    expect((await fx.client.waitForTransactionReceipt({ hash })).status).toBe('success');
    expect((await get('/poke-report')).status).toBe(200); // alias path
  });

  it('events and history come from contract logs', async () => {
    const ev = (await get(`/api/covenants/${fx.vault}/events`)).body as { events: unknown[] };
    const events = ev.events.map((e) => LedgerEvent.parse(e));
    expect(events.map((e) => e.event)).toEqual(expect.arrayContaining(['TreasuryFunded', 'Observed']));
    const funded = events.find((e) => e.event === 'TreasuryFunded')!;
    expect(funded.kind).toBe('raise');
    expect(funded.amountWei).toBe((375n * E18).toString());
    const h = History.parse((await get(`/api/covenants/${fx.vault}/history`)).body);
    expect(h.points.length).toBeGreaterThanOrEqual(1);
    expect(h.points[0]!.bnbUsd).toBe(600);
    expect(h.points[0]!.trusted).toBe(true);
  });

  it('downside and unsigned tx endpoints', async () => {
    const d = Downside.parse((await get(`/api/covenants/${fx.vault}/downside?tokens=${6_000_000n * E18}`)).body);
    expect(d.redeemableNow).toBe(false);
    expect(d.redeemNowBnb).toBeCloseTo(2.97, 2); // 6M * 0.0000005 * 0.99
    expect(d.floorPath[1]!.floorShareOfSale).toBeCloseTo(0.47, 2);
    const tx = UnsignedTx.parse((await get(`/api/covenants/${fx.vault}/tx/commit?amount=1.5`)).body);
    expect(tx.value).toBe((15n * E18 / 10n).toString());
    expect(tx.to.toLowerCase()).toBe(fx.launcher.toLowerCase());
    const hb = UnsignedTx.parse((await get(`/api/covenants/${fx.vault}/tx/heartbeat`)).body);
    expect(hb.from).not.toBeNull();
    const fin = UnsignedTx.parse((await get(`/api/covenants/${fx.vault}/tx/finalize`)).body);
    expect(fin.gas).toBe(FINALIZE_GAS.toString());
    expect(fin.to.toLowerCase()).toBe(fx.launcher.toLowerCase());
    expect(UnsignedTx.parse((await get(`/api/covenants/${fx.vault}/tx/release-team`)).body).functionName).toBe('releaseTeam');
    const over = await get(`/api/covenants/${fx.vault}/tx/commit?amount=500.5`); // decimal = BNB, over the 100 BNB local cap
    expect(over.status).toBe(400);
    expect((over.body as { error: string }).error).toMatch(/per-call cap/);
  });

  it('health never shows the RPC path or query, where hosted RPCs keep their key', async () => {
    const a = createApp({ cfg: fx.cfg({ rpcUrl: `${fx.rpcUrl}/secret-key?apikey=s3cret` }) });
    const h = (await (await a.request('/health')).json()) as { rpcUrl: string };
    expect(h.rpcUrl).not.toMatch(/secret|s3cret/);
  });

  it('rate-limits the routes that build transactions', async () => {
    process.env.API_TX_RATE_PER_MIN = '2';
    try {
      const a = createApp({ cfg: fx.cfg() });
      const codes = [];
      for (let i = 0; i < 3; i++) codes.push((await a.request(`/api/covenants/${fx.vault}/tx/claim-tokens`)).status);
      expect(codes).toEqual([200, 200, 429]);
      expect((await a.request('/health')).status).toBe(200); // reads are not limited
    } finally {
      delete process.env.API_TX_RATE_PER_MIN;
    }
  });

  it('CMC proxy keeps the key server-side and strips key-like params', async () => {
    const r = await app.request('/api/cmc/pair-quote?network_slug=bsc&contract_address=0xabc&api_key=leak');
    expect(r.headers.get('x-covenant-cmc-mode')).toBe('keyless-public-api');
    const body = (await r.json()) as { data: { echoed: string } };
    expect(body.data.echoed).toContain('/public-api/v4/dex/pairs/quotes/latest');
    expect(body.data.echoed).toContain('aux=holders%2Csecurity_scan');
    expect(body.data.echoed).not.toContain('leak');
  });

  it('simulator endpoint serves the job output when present', async () => {
    expect((await get('/api/simulator')).status).toBe(404);
    writeFileSync(path.join(fx.dataDir, 'sim.json'), JSON.stringify({ schemaVersion: 1, ok: true }));
    expect((await get('/api/simulator')).status).toBe(200);
  });

  it('sheet reflects a price slide below book', async () => {
    await fx.setPrice(POOL, 40n * E18);
    await fx.warp(3);
    const s = CovenantSheet.parse((await get(`/api/covenants/${fx.vault}?fresh=1`)).body);
    expect(s.premiumToBookPct!).toBeLessThan(0);
  });
});
