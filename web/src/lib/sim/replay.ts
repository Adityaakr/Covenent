/*
 * The launch simulator (docs/DESIGN.md "The launch simulator"): replay recent BNB Chain launches as if each had
 * carried a covenant. Floor = starting ratio x opening price, falling by the tap cap each month. A token triggers
 * when its daily close sits under the floor long enough for the exit streak, counted with the decaying streak
 * (fix 1). The redeemable share is the treasury left, as a share of the raise, on the trigger day.
 */
import { floorAfterMonths, startingFloorRatio, stepExitStreak } from "@/lib/covenant/math";
import { DAY } from "@/lib/covenant/time";

export interface Candle { t: number; o: number; h: number; l: number; c: number; v?: number }
export interface SampleToken { address: string; symbol: string; name: string; launchedAt: number; candles: Candle[] }

export interface ReplayTerms {
  saleBps: number;
  poolBps: number;
  tapCapBps: number;
  exitDays: number;
}

export interface TokenReplay {
  token: SampleToken;
  open: number;
  triggered: boolean;
  triggerDay: number | null;
  redeemableShare: number | null; // treasury / raise on the trigger day
  minRatio: number; // lowest close against the opening price
  lastRatio: number;
  floorAtTrigger: number | null;
}

export interface ReplaySummary {
  tokens: TokenReplay[];
  sampled: number;
  triggered: number;
  share: number;
  medianDays: number | null;
  medianRedeemable: number | null;
  daysCovered: number;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function replayToken(token: SampleToken, t: ReplayTerms): TokenReplay {
  const cs = token.candles.filter((c) => c.c > 0).sort((a, b) => a.t - b.t);
  const open = cs[0]?.o || cs[0]?.c || 0;
  const ratio = startingFloorRatio(t.saleBps, t.poolBps);
  let streak = 0;
  let triggerDay: number | null = null;
  let floorAtTrigger: number | null = null;
  let minRatio = Infinity;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    const months = (c.t - cs[0]!.t) / (30 * DAY);
    const floor = open * floorAfterMonths(months, t.tapCapBps, ratio);
    const dt = i === 0 ? DAY : Math.max(0, c.t - cs[i - 1]!.t);
    streak = stepExitStreak(streak, dt, c.c, floor, Infinity);
    minRatio = Math.min(minRatio, c.c / open);
    if (triggerDay === null && streak >= t.exitDays * DAY) {
      triggerDay = (c.t - cs[0]!.t) / DAY;
      floorAtTrigger = floor;
    }
  }
  const treasuryShare = (m: number) => ((t.saleBps - t.poolBps) / t.saleBps) * Math.pow(1 - t.tapCapBps / 10_000, m);
  return {
    token,
    open,
    triggered: triggerDay !== null,
    triggerDay,
    redeemableShare: triggerDay !== null ? treasuryShare(triggerDay / 30) : null,
    minRatio: Number.isFinite(minRatio) ? minRatio : 1,
    lastRatio: cs.length ? cs[cs.length - 1]!.c / open : 1,
    floorAtTrigger,
  };
}

export function replay(sample: SampleToken[], t: ReplayTerms): ReplaySummary {
  const tokens = sample.map((s) => replayToken(s, t)).filter((r) => r.open > 0);
  const hit = tokens.filter((r) => r.triggered);
  const daysCovered = Math.max(0, ...sample.map((s) => (s.candles.length ? (s.candles[s.candles.length - 1]!.t - s.candles[0]!.t) / DAY : 0)));
  return {
    tokens,
    sampled: tokens.length,
    triggered: hit.length,
    share: tokens.length ? hit.length / tokens.length : 0,
    medianDays: median(hit.map((r) => r.triggerDay!)),
    medianRedeemable: median(hit.map((r) => r.redeemableShare!)),
    daysCovered,
  };
}
