import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletClient, getAddress, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { CovenantService } from '../../src/covenant/read.js';
import { TxBuilder } from '../../src/covenant/tx.js';
import { readAlerts } from '../../src/keeper/alerts.js';
import { Keeper } from '../../src/keeper/keeper.js';
import { CovenantSheet } from '../../src/schema.js';
import { addr, deployFixture, E18, KEYS, POOL, startAnvil, TEAM, type Anvil, type Fixture } from './harness.js';

let anvil: Anvil;
let fx: Fixture;

beforeAll(async () => {
  anvil = await startAnvil();
  fx = await deployFixture(anvil);
});
afterAll(() => anvil?.stop());

const quiet = () => {};

async function sendUnsigned(key: Hex, tx: { to: `0x${string}`; data: `0x${string}`; value: string }) {
  const w = createWalletClient({ account: privateKeyToAccount(key), chain: foundry, transport: http(fx.rpcUrl) });
  const hash = await w.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
  const r = await fx.client.waitForTransactionReceipt({ hash });
  expect(r.status).toBe('success');
  return r;
}

describe('covenant sheet on the fake chain', () => {
  it('reads the worked example: 375 BNB treasury, book 60% of sale price', async () => {
    const svc = new CovenantService({ cfg: fx.cfg(), client: fx.client });
    const s = await svc.sheet(fx.vault);
    CovenantSheet.parse(s);
    expect(s.state).toBe('ACTIVE');
    expect(s.treasuryBnb).toBe(375);
    expect(s.bookValueWei).toBe(((375n * E18 * E18) / (750_000_000n * E18)).toString());
    expect(s.floorShareOfSale).toBeCloseTo(0.6, 6);
    expect(s.premiumToBookPct).toBeCloseTo((0.000000833333 / 0.0000005 - 1) * 100, 1);
    expect(s.launcher).toBe(getAddress(fx.launcher));
    expect(s.tranches).toHaveLength(3);
    expect(s.tranches[0]!.multiple).toBe(2);
    expect(s.ledger.raisedWei).toBe((375n * E18).toString());
    expect(s.reads.missing).toEqual([]);
  });
});

describe('keeper', () => {
  it('pokes with a signed local Atlas report that the oracle verifies, and refuses to double-poke', async () => {
    const keeper = new Keeper({ cfg: fx.cfg(), log: quiet });
    const [r1] = await keeper.tick();
    expect(r1!.action).toBe('poked');
    expect(r1!.reportMode).toBe('local-test-signer');
    const trusted = await fx.client.readContract({ address: fx.vault, abi: fx.abis.vault, functionName: 'lastTrusted' });
    expect(trusted).toBe(true); // signature, feed id and freshness all verified on-chain

    const [r2] = await keeper.tick();
    expect(r2!.action).toBe('skipped');
    expect(r2!.reason).toMatch(/not due/);

    // a restarted keeper reads the same state and still does not poke early
    const restarted = new Keeper({ cfg: fx.cfg(), log: quiet });
    const [r3] = await restarted.tick();
    expect(r3!.action).toBe('skipped');

    // a redundant keeper with its own state dir is stopped by the oracle's interval; simulation means no gas spent
    const other = new Keeper({
      cfg: fx.cfg({ keeper: { ...fx.cfg().keeper, stateFile: path.join(fx.dataDir, 'other', 'state.json'), alertsFile: path.join(fx.dataDir, 'other', 'alerts.jsonl') } }),
      log: quiet,
    });
    const before = await fx.client.getTransactionCount({ address: addr(KEYS.keeper) });
    const [r4] = await other.tick({ force: true });
    expect(r4!.action).toBe('skipped');
    expect(r4!.reason).toMatch(/TooSoon/);
    expect(await fx.client.getTransactionCount({ address: addr(KEYS.keeper) })).toBe(before);
  });

  it('exit fix 1: an observation at or above book decays the streak instead of resetting it', async () => {
    const keeper = new Keeper({ cfg: fx.cfg(), log: quiet });
    const streak = async () => Number(await fx.client.readContract({ address: fx.vault, abi: fx.abis.vault, functionName: 'exitStreak' }));
    await fx.setPrice(POOL, 40n * E18); // 0.000000267 BNB, under the 0.0000005 book
    await fx.warp(60);
    await keeper.tick();
    const s1 = await streak();
    expect(s1).toBeGreaterThanOrEqual(60);
    await fx.setPrice(POOL, 125n * E18); // the team pumps above book for one interval
    await fx.warp(25);
    await keeper.tick();
    const s2 = await streak();
    expect(s2).toBeGreaterThan(0); // the old rule would have reset to 0
    expect(s2).toBeLessThan(s1);
  });

  it('exit fixes 2 and 3: a thin pool and an Atlas outage still let the streak run and the round open', async () => {
    const keeper = new Keeper({ cfg: fx.cfg(), log: quiet });
    keeper.report = async () => null; // Atlas down: poke goes out with no report
    await fx.setPrice(POOL, 20n * E18); // pool BNB far below half the 125 BNB seed
    let state = 'ACTIVE';
    for (let i = 0; i < 8 && state === 'ACTIVE'; i++) {
      await fx.warp(30);
      const [r] = await keeper.tick();
      expect(r!.reportMode).toBe('none');
      state = (await keeper.svc.sheet(fx.vault)).state;
    }
    expect(state).toBe('EXIT_ROUND');
    expect(await fx.client.readContract({ address: fx.vault, abi: fx.abis.vault, functionName: 'lastTrusted' })).toBe(false);
    const alerts = readAlerts(fx.cfg().keeper.alertsFile, fx.vault).map((a) => a.kind);
    expect(alerts).toContain('exit-streak-building');
    expect(alerts).toContain('exit-round-open');
  });

  it('a holder redeems at book through the unsigned transaction (approval first)', async () => {
    const svc = new CovenantService({ cfg: fx.cfg(), client: fx.client });
    const txb = new TxBuilder(svc);
    const holder = addr(KEYS.buyer1);
    const amount = 6_000_000n * E18;
    const before = await svc.sheet(fx.vault);
    const tx = await txb.redeem(fx.vault, amount, holder);
    expect(tx.prerequisites).toHaveLength(1);
    await sendUnsigned(KEYS.buyer1, tx.prerequisites[0]!);
    const balBefore = await fx.client.getBalance({ address: holder });
    const r = await sendUnsigned(KEYS.buyer1, tx);
    const got = (await fx.client.getBalance({ address: holder })) - balBefore + r.gasUsed * r.effectiveGasPrice;
    const expected = (((amount * BigInt(before.bookValueWei!)) / E18) * 9_900n) / 10_000n;
    expect(got).toBe(expected);
    const after = await svc.sheet(fx.vault);
    expect(BigInt(after.bookValueWei!)).toBeGreaterThanOrEqual(BigInt(before.bookValueWei!)); // never lowers book for those who stay
  });

  it('the keeper agent declares abandonment when the team or agent stops', async () => {
    await fx.warp(700); // past the 600 s heartbeat window
    const keeper = new Keeper({ cfg: fx.cfg(), log: quiet, declareAbandoned: true });
    await keeper.tick();
    const s = await keeper.svc.sheet(fx.vault);
    expect(s.state).toBe('WIND_DOWN');
    expect(s.lockedTeamWei).toBe('0');
    const dead = await fx.client.readContract({ address: fx.token, abi: fx.abis.token, functionName: 'balanceOf', args: ['0x000000000000000000000000000000000000dEaD'] });
    expect(dead as bigint).toBeGreaterThanOrEqual(TEAM);
    expect(readAlerts(fx.cfg().keeper.alertsFile, fx.vault).map((a) => a.kind)).toContain('abandonable');
  });
});
