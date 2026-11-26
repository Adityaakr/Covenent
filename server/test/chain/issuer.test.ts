import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletClient, http, keccak256, parseEther, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { IssuerAgent } from '../../agents/issuer/issuer.js';
import { createApp } from '../../src/api/app.js';
import { CovenantService } from '../../src/covenant/read.js';
import { TxBuilder } from '../../src/covenant/tx.js';
import { Keeper } from '../../src/keeper/keeper.js';
import { addr, deployFixture, E18, KEYS, POOL, startAnvil, type Anvil, type Fixture } from './harness.js';

let anvil: Anvil;
let fx: Fixture;
let agent: IssuerAgent;
let keeper: Keeper;
const quiet = () => {};

beforeAll(async () => {
  anvil = await startAnvil();
  fx = await deployFixture(anvil);
  const cfg = fx.cfg();
  keeper = new Keeper({ cfg, log: quiet });
  agent = new IssuerAgent(cfg, fx.vault, {
    privateKey: KEYS.team,
    log: quiet,
    policy: { minClaimWei: parseEther('0.0001'), periodSeconds: 600, heartbeatEverySeconds: 60 },
  });
});
afterAll(() => anvil?.stop());

async function pokeFor(seconds: number) {
  for (let t = 0; t < seconds; t += 30) {
    await fx.warp(30);
    await keeper.tick();
  }
}

describe('issuer agent', () => {
  it('claims its tap as a compute budget (a claim is also a heartbeat)', async () => {
    await keeper.tick();
    await pokeFor(120);
    const before = await agent.svc.sheet(fx.vault);
    expect(BigInt(before.tap.accruedWei!)).toBeGreaterThan(0n);
    const o = await agent.tick();
    expect(o.actions.map((a) => a.kind)).toContain('tap-claimed');
    const after = await agent.svc.sheet(fx.vault);
    expect(after.tap.accruedWei).toBe('0');
    expect(after.heartbeat.ageSeconds).toBeLessThanOrEqual(2);
  });

  it('forwards revenue it earns to the vault, raising book value', async () => {
    const before = await agent.svc.sheet(fx.vault);
    const customer = createWalletClient({ account: privateKeyToAccount(KEYS.whale), chain: foundry, transport: http(fx.rpcUrl) });
    await fx.client.waitForTransactionReceipt({ hash: await customer.sendTransaction({ to: addr(KEYS.team), value: 2n * E18 }) });
    const o = await agent.tick();
    const fwd = o.actions.find((a) => a.kind === 'revenue-forwarded')!;
    expect(fwd).toBeDefined();
    expect(fwd.amountWei).toBe((2n * E18).toString());
    const after = await agent.svc.sheet(fx.vault);
    expect(BigInt(after.bookValueWei!)).toBeGreaterThan(BigInt(before.bookValueWei!));
    expect(BigInt(after.ledger.taxInWei)).toBe(2n * E18);
    // no double counting on the next tick
    expect((await agent.tick()).actions.find((a) => a.kind === 'revenue-forwarded')).toBeUndefined();
  });

  it('cuts its own pay only when spot and the observed TWAP stay close to book for several ticks', async () => {
    const s = await agent.svc.sheet(fx.vault);
    const book = BigInt(s.bookValueWei!);
    // a one-block push of the pool spot near book, with no observation of it: no cut
    await fx.setPrice(POOL, (POOL * book * 105n) / (100n * E18));
    await fx.warp(2);
    expect((await agent.tick()).actions.find((a) => a.kind === 'tap-lowered')).toBeUndefined();
    // the oracle observes it (TWAP near book too) and it holds: the third consecutive tick cuts
    await pokeFor(60);
    let o = await agent.tick();
    for (let i = 0; i < 3 && !o.actions.some((a) => a.kind === 'tap-lowered'); i++) o = await agent.tick();
    const cut = o.actions.find((a) => a.kind === 'tap-lowered')!;
    expect(cut).toBeDefined();
    expect(cut.reason).toMatch(/observed TWAP/);
    expect(cut.usdPer30d).toBe((24_000n * E18).toString());
    expect((await agent.svc.sheet(fx.vault)).tap.tapUsdPer30d).toBe(24_000);
    // once per period only
    expect((await agent.tick()).actions.find((a) => a.kind === 'tap-lowered')).toBeUndefined();
  });

  it('posts a period report: template without an API key, hash on-chain matches the served file', async () => {
    await fx.warp(601);
    const o = await agent.tick();
    expect(o.report).toBeDefined();
    expect(o.report!.author.kind).toBe('template');
    const file = path.join(fx.dataDir, 'reports', fx.vault.toLowerCase(), '1.md');
    const md = readFileSync(file, 'utf8');
    expect(md).toMatch(/^> Fixed template report \(no LLM: ANTHROPIC_API_KEY not set\)/);
    expect(md).toContain('revenue-forwarded');
    const onchain = await fx.client.readContract({ address: fx.vault, abi: fx.abis.vault, functionName: 'reportHash', args: [1n] });
    expect(onchain).toBe(keccak256(toBytes(md)));
    const app = createApp({ cfg: fx.cfg() });
    const res = await app.request(`/reports/${fx.vault}/1`);
    expect(res.status).toBe(200);
    expect(keccak256(toBytes(await res.text()))).toBe(onchain);
  });

  it('killed on stage: no more heartbeats, and anyone opens the treasury to holders', async () => {
    // the agent process is stopped: nothing calls agent.tick() any more
    await fx.warp(601);
    const svc = new CovenantService({ cfg: fx.cfg() });
    const s = await svc.sheet(fx.vault);
    expect(s.heartbeat.abandonable).toBe(true);
    const tx = new TxBuilder(svc).declareAbandoned(fx.vault);
    const anyone = createWalletClient({ account: privateKeyToAccount(KEYS.buyer3), chain: foundry, transport: http(fx.rpcUrl) });
    await fx.client.waitForTransactionReceipt({ hash: await anyone.sendTransaction({ to: tx.to, data: tx.data }) });
    const after = await svc.sheet(fx.vault);
    expect(after.state).toBe('WIND_DOWN');
    expect(after.lockedTeamWei).toBe('0');
    expect(after.tap.paused).toBe(true);
  });
});
