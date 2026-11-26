import { median, quantile } from '../covenant/math.js';

/** One daily candle priced in BNB per token. t = unix seconds at the start of the day. */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export type ExitRule = 'reset' | 'decay' | 'twap72';

export const RULE_TEXT: Record<ExitRule, string> = {
  reset: 'Original rule: 3 consecutive days below the floor; one day at or above resets the streak to zero.',
  decay: 'Fixed rule (decay): a day below adds one, a day at or above subtracts one instead of resetting; opens at 3.',
  twap72: 'Fixed rule (72h average): the 3-day average price is below the floor.',
};

export interface Terms {
  floorShareOfOpen: number; // 0.6 with the default 60/15/25 split
  tapCapBps: number; // 400 = 4% of treasury per 30 days
  exitStreakDays: number; // 3
  treasuryShareOfRaise: number; // 0.75 with the default split: (Q - Q_pool) / Q
}

export const DEFAULT_TERMS: Terms = { floorShareOfOpen: 0.6, tapCapBps: 400, exitStreakDays: 3, treasuryShareOfRaise: 0.75 };

export interface Trigger {
  day: number;
  price: number;
  floor: number;
}

/** Fill days with no trades with the previous close (no trade means the price did not move). */
export function densify(candles: Candle[]): Candle[] {
  const s = [...candles].sort((a, b) => a.t - b.t);
  if (s.length === 0) return [];
  const out: Candle[] = [s[0]!];
  for (let i = 1; i < s.length; i++) {
    const prev = out[out.length - 1]!;
    for (let t = prev.t + 86_400; t < s[i]!.t; t += 86_400) out.push({ t, o: prev.c, h: prev.c, l: prev.c, c: prev.c });
    out.push(s[i]!);
  }
  return out;
}

/** Day-average proxy for the time-weighted pool price: (o + h + l + c) / 4. */
export const dayPrice = (k: Candle) => (k.o + k.h + k.l + k.c) / 4;

export function floorOn(open: number, day: number, terms: Terms): number {
  return terms.floorShareOfOpen * open * Math.pow(1 - terms.tapCapBps / 10_000, day / 30);
}

/** Replay one token's daily history under a covenant with `terms`; returns the first trigger day per rule. */
export function replay(candles: Candle[], terms: Terms = DEFAULT_TERMS): { open: number; triggers: Record<ExitRule, Trigger | null> } {
  const days = densify(candles);
  const open = days[0]?.o ?? 0;
  const triggers: Record<ExitRule, Trigger | null> = { reset: null, decay: null, twap72: null };
  if (!open || days.length === 0) return { open, triggers };
  let reset = 0;
  let decay = 0;
  const n = terms.exitStreakDays;
  for (let d = 0; d < days.length; d++) {
    const p = dayPrice(days[d]!);
    const f = floorOn(open, d, terms);
    const below = p < f;
    reset = below ? reset + 1 : 0;
    decay = below ? decay + 1 : Math.max(0, decay - 1);
    if (!triggers.reset && reset >= n) triggers.reset = { day: d, price: p, floor: f };
    if (!triggers.decay && decay >= n) triggers.decay = { day: d, price: p, floor: f };
    if (!triggers.twap72 && d >= n - 1) {
      const avg = days.slice(d - n + 1, d + 1).reduce((s, k) => s + dayPrice(k), 0) / n;
      if (avg < f) triggers.twap72 = { day: d, price: avg, floor: f };
    }
  }
  return { open, triggers };
}

export interface TokenOutcome {
  triggers: Record<ExitRule, Trigger | null>;
}

export function summarize(outcomes: TokenOutcome[], rule: ExitRule, terms: Terms = DEFAULT_TERMS) {
  const hits = outcomes.map((o) => o.triggers[rule]).filter((t): t is Trigger => t !== null);
  const days = hits.map((h) => h.day);
  return {
    rule,
    description: RULE_TEXT[rule],
    triggered: hits.length,
    triggeredShare: outcomes.length ? hits.length / outcomes.length : null,
    medianDaysToTrigger: median(days),
    p25DaysToTrigger: quantile(days, 0.25),
    p75DaysToTrigger: quantile(days, 0.75),
    medianRedeemableShareOfRaise: median(days.map((d) => terms.treasuryShareOfRaise * Math.pow(1 - terms.tapCapBps / 10_000, d / 30))),
    medianRedeemVsMarket: median(hits.map((h) => h.floor / h.price)),
  };
}
