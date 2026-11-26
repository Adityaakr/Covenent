import { describe, expect, it } from 'vitest';
import { densify, floorOn, replay, summarize, type Candle } from '../../src/sim/replay.js';
import { runSimulation } from '../../src/sim/run.js';
import type { MarketSource } from '../../src/sim/sources.js';
import { SimulatorResult } from '../../src/schema.js';

const day = (i: number, p: number): Candle => ({ t: 1_790_000_000 + i * 86_400, o: p, h: p, l: p, c: p });
const series = (ps: number[]) => ps.map((p, i) => day(i, p));

describe('replay of default covenant terms', () => {
  it('floor starts at 60% of open and falls 4% a month', () => {
    expect(floorOn(1, 0, { floorShareOfOpen: 0.6, tapCapBps: 400, exitStreakDays: 3, treasuryShareOfRaise: 0.75 })).toBeCloseTo(0.6);
    expect(floorOn(1, 180, { floorShareOfOpen: 0.6, tapCapBps: 400, exitStreakDays: 3, treasuryShareOfRaise: 0.75 })).toBeCloseTo(0.47, 2);
  });

  it('a pump every third day blocks the original reset rule but not the fixed rules', () => {
    // below floor two days, one day back above, repeated: the attack from the design review
    const ps = [1, ...Array.from({ length: 30 }, (_, i) => (i % 3 === 2 ? 0.7 : 0.3))];
    const { triggers } = replay(series(ps));
    expect(triggers.reset).toBeNull();
    expect(triggers.decay).not.toBeNull();
    expect(triggers.twap72).not.toBeNull();
  });

  it('a steady token never triggers; a crash triggers on day 3 under every rule', () => {
    expect(replay(series(Array(40).fill(1))).triggers.decay).toBeNull();
    const crash = replay(series([1, 0.2, 0.2, 0.2, 0.2]));
    expect(crash.triggers.reset!.day).toBe(3);
    expect(crash.triggers.decay!.day).toBe(3);
    expect(crash.triggers.twap72!.day).toBeLessThanOrEqual(3);
  });

  it('fills days without trades with the previous close', () => {
    const d = densify([day(0, 1), day(3, 2)]);
    expect(d).toHaveLength(4);
    expect(d[2]!.c).toBe(1);
  });

  it('summarizes trigger share, timing and the treasury left for holders', () => {
    const outs = [replay(series([1, 0.2, 0.2, 0.2])), replay(series(Array(10).fill(1)))];
    const s = summarize(outs, 'decay');
    expect(s.triggered).toBe(1);
    expect(s.triggeredShare).toBe(0.5);
    expect(s.medianRedeemableShareOfRaise).toBeCloseTo(0.75 * Math.pow(0.96, 3 / 30), 6);
    expect(s.medianRedeemVsMarket).toBeCloseTo(floorOn(1, 3, { floorShareOfOpen: 0.6, tapCapBps: 400, exitStreakDays: 3, treasuryShareOfRaise: 0.75 }) / 0.2, 6);
  });
});

describe('simulation job', () => {
  const fake = (n: number): MarketSource => ({
    name: 'fake',
    sampleDescription: 'fake',
    candleDescription: 'fake',
    notes: [],
    sample: async () =>
      Array.from({ length: n }, (_, i) => ({
        pair: `0x${(i + 1).toString(16).padStart(40, '0')}` as `0x${string}`,
        token: `0x${(i + 100).toString(16).padStart(40, '0')}` as `0x${string}`,
        symbol: `T${i}`,
        createdAt: 1_790_000_000,
      })),
    dailyCandles: async (p) => series(Number(p.symbol!.slice(1)) % 2 ? [1, 0.1, 0.1, 0.1, ...Array(20).fill(0.1)] : Array(24).fill(1)),
  });

  it('reports a headline only with enough real data, and never invents one', async () => {
    const small = await runSimulation(fake(4), { maxPools: 4, minAgeDays: 14, maxAgeDays: 180, minSample: 20, headlineRule: 'decay' });
    SimulatorResult.parse(small);
    expect(small.headline.text).toBeNull();
    expect(small.headline.value).toBeNull();
    expect(small.computedFromRealData).toBe(false);

    const big = await runSimulation(fake(20), { maxPools: 20, minAgeDays: 14, maxAgeDays: 180, minSample: 20, headlineRule: 'decay' });
    expect(big.headline.value).toBe(50);
    expect(big.headline.text).toMatch(/^10 of 20 recent BNB Chain launches \(50%\)/);
  });

  it('records a failed sample fetch instead of failing silently', async () => {
    const broken: MarketSource = { ...fake(1), sample: async () => { throw new Error('rate limited'); } };
    const r = await runSimulation(broken, { maxPools: 5, minAgeDays: 14, maxAgeDays: 180, minSample: 1, headlineRule: 'decay' });
    expect(r.source.notes.join(' ')).toMatch(/rate limited/);
    expect(r.headline.text).toBeNull();
  });
});
