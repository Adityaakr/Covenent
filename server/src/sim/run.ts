import type { SimulatorResult } from '../schema.js';
import { DEFAULT_TERMS, replay, summarize, type ExitRule, type Terms } from './replay.js';
import type { MarketSource, SampledPool } from './sources.js';

export interface SimOptions {
  maxPools: number;
  minAgeDays: number;
  maxAgeDays: number;
  /** a headline needs at least this many tokens with candles */
  minSample: number;
  headlineRule: ExitRule;
  terms?: Terms;
  log?: (m: string) => void;
}

/**
 * Replay the default covenant terms over real launches. Every number in the result comes from the
 * fetched candles; when the sample is too small or the fetch failed, the headline is null with a
 * reason, never a placeholder.
 */
export async function runSimulation(source: MarketSource, opts: SimOptions): Promise<SimulatorResult> {
  const terms = opts.terms ?? DEFAULT_TERMS;
  const log = opts.log ?? (() => {});
  const notes = [...source.notes];
  let pools: SampledPool[] = [];
  try {
    pools = await source.sample(opts);
  } catch (e) {
    notes.push(`Sample fetch failed: ${(e as Error).message}`);
  }
  log(`sampled ${pools.length} pools from ${source.name}`);

  const tokens: SimulatorResult['tokens'] = [];
  let failures = 0;
  for (const [i, p] of pools.entries()) {
    try {
      const candles = await source.dailyCandles(p);
      if (candles.length < opts.minAgeDays / 2) {
        log(`${i + 1}/${pools.length} ${p.symbol}: only ${candles.length} candles, skipped`);
        continue;
      }
      const { open, triggers } = replay(candles, terms);
      const prices = candles.map((k) => k.c);
      tokens.push({
        token: p.token,
        pair: p.pair,
        symbol: p.symbol,
        createdAt: p.createdAt,
        days: candles.length,
        openPrice: open,
        minPriceShareOfOpen: Math.min(...candles.map((k) => k.l)) / open,
        lastPriceShareOfOpen: prices[prices.length - 1]! / open,
        triggers,
        candles: candles.map(({ t, o, h, l, c }) => ({ t, o, h, l, c })),
      });
      log(`${i + 1}/${pools.length} ${p.symbol}: ${candles.length}d, decay trigger ${triggers.decay ? `day ${triggers.decay.day}` : 'none'}`);
    } catch (e) {
      failures++;
      log(`${i + 1}/${pools.length} ${p.symbol}: candles failed (${(e as Error).message})`);
    }
  }
  if (failures) notes.push(`${failures} of ${pools.length} sampled pools failed to return candles and are excluded.`);

  const variants = (['reset', 'decay', 'twap72'] as ExitRule[]).map((r) => summarize(tokens, r, terms));
  const head = variants.find((v) => v.rule === opts.headlineRule)!;
  const enough = tokens.length >= opts.minSample;
  const created = tokens.map((t) => t.createdAt).filter((x): x is number => x !== null);
  const pct = head.triggeredShare === null ? null : Math.round(head.triggeredShare * 1000) / 10;
  return {
    schemaVersion: 1,
    computedFromRealData: enough && tokens.length > 0,
    generatedAt: new Date().toISOString(),
    source: { sample: source.sampleDescription, candles: source.candleDescription, notes },
    terms: {
      floorShareOfOpen: terms.floorShareOfOpen,
      tapCapBpsPer30d: terms.tapCapBps,
      exitStreakDays: terms.exitStreakDays,
      priceProxy: 'daily (open + high + low + close) / 4 in BNB, as a stand-in for the time-weighted pool price',
    },
    sample: {
      requested: opts.maxPools,
      withCandles: tokens.length,
      minDays: opts.minAgeDays,
      windowStart: created.length ? new Date(Math.min(...created) * 1000).toISOString() : null,
      windowEnd: created.length ? new Date(Math.max(...created) * 1000).toISOString() : null,
    },
    headline: enough
      ? {
          text: `${head.triggered} of ${tokens.length} ${source.sampleLabel} (${pct}%) would have opened a Covenant exit round${
            head.medianDaysToTrigger !== null ? `, a median ${Math.round(head.medianDaysToTrigger)} days after launch` : ''
          }, with ${head.medianRedeemableShareOfRaise !== null ? `${Math.round(head.medianRedeemableShareOfRaise * 100)}%` : 'n/a'} of the raise still in the treasury for holders.`,
          rule: head.rule,
          value: pct,
          reason: null,
        }
      : { text: null, rule: head.rule, value: null, reason: `only ${tokens.length} tokens with candles (need ${opts.minSample}); no headline is reported` },
    variants,
    tokens,
  };
}
