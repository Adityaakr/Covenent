/*
 * Every formula in docs/DESIGN.md "The rules in detail", as pure functions. The screens compute previews with these
 * and the mock layer runs the demo story with them, so a number on screen always comes from the doc's formula.
 * Symbols follow the doc: S supply, A sale tokens, P pool tokens, E team tokens, C committed, Q accepted,
 * T treasury, R redeemable supply, b book value per token, p pool price.
 */

import { DAY, HOUR } from "./time";

export { DAY, HOUR };
export const MONTH = 30 * DAY;
/** One observation adds at most this much time to any counter (doc: 6 hours). */
export const MAX_STEP = 6 * HOUR;
/** PancakeSwap V2 swap fee, 0.25%. */
export const PANCAKE_FEE_BPS = 25;

export interface Split {
  A: number; // sale tokens
  P: number; // pool tokens
  E: number; // team tokens
}

export function split(totalSupply: number, saleBps: number, poolBps: number): Split {
  const A = (totalSupply * saleBps) / 10_000;
  const P = (totalSupply * poolBps) / 10_000;
  return { A, P, E: totalSupply - A - P };
}

export interface RaiseResult {
  failed: boolean;
  Q: number; // accepted raise
  qPool: number; // BNB that seeds the pool
  T0: number; // starting treasury
  salePrice: number; // p0 = Q / A, BNB per token
  oversubscription: number; // C / cap
  refunded: number; // C - Q
  keptShare: number; // Q / C, the share of each commitment that stays in the sale
}

/** Settle a raise: Q = min(C, cap), pool seed Q*P/A, treasury Q - Qpool. Below the minimum, everything refunds. */
export function settleRaise(C: number, minRaise: number, cap: number, s: Split): RaiseResult {
  if (C < minRaise || C <= 0) {
    return { failed: true, Q: 0, qPool: 0, T0: 0, salePrice: 0, oversubscription: C / cap, refunded: C, keptShare: 0 };
  }
  const Q = Math.min(C, cap);
  const qPool = (Q * s.P) / s.A;
  return { failed: false, Q, qPool, T0: Q - qPool, salePrice: Q / s.A, oversubscription: C / cap, refunded: C - Q, keptShare: Q / C };
}

/** One buyer: q_i = c_i * Q / C kept in the sale, refund c_i - q_i, tokens a_i = A * q_i / Q. */
export function buyerOutcome(c: number, C: number, r: RaiseResult, s: Split): { kept: number; refund: number; tokens: number } {
  if (r.failed || C === 0) return { kept: 0, refund: c, tokens: 0 };
  const kept = (c * r.Q) / C;
  return { kept, refund: c - kept, tokens: (s.A * kept) / r.Q };
}

/** Starting floor as a share of the sale price: b0 / p0 = (A - P) / (A + P). */
export function startingFloorRatio(saleBps: number, poolBps: number): number {
  return (saleBps - poolBps) / (saleBps + poolBps);
}

/** R = S - dead - lockedTeam. Pool-held tokens count, so trading never moves book value. */
export function redeemableSupply(totalSupply: number, dead: number, lockedTeam: number): number {
  return Math.max(0, totalSupply - dead - lockedTeam);
}

/** b = (T - owedTeam) / R. */
export function bookValue(treasury: number, owedTeam: number, R: number): number {
  if (R <= 0) return 0;
  return Math.max(0, treasury - owedTeam) / R;
}

/** Premium (+) or discount (-) of the pool price to book. */
export function premium(price: number, book: number): number {
  if (book <= 0) return 0;
  return price / book - 1;
}

/** Tap cap per 30 days in BNB: capBps of the treasury. */
export function tapCap30d(treasury: number, capBps: number): number {
  return (treasury * capBps) / 10_000;
}

/**
 * Tap budget per 30 days in BNB: the dollar budget at the Atlas rate, capped as a share of the treasury.
 * With no trusted BNB/USD (pool-only mode) the tap falls back to its treasury cap alone.
 */
export function tapPer30d(tapUsd: number, bnbUsd: number | null, treasury: number, capBps: number): { bnb: number; binding: "usd" | "cap" } {
  const cap = tapCap30d(treasury, capBps);
  if (!bnbUsd || bnbUsd <= 0) return { bnb: cap, binding: "cap" };
  const usd = tapUsd / bnbUsd;
  return usd <= cap ? { bnb: usd, binding: "usd" } : { bnb: cap, binding: "cap" };
}

/** accrued(dt) = dt * min(tapUsd / (30d * bnbUsd), capBps/1e4 * T / 30d). */
export function accrueTap(dt: number, tapUsd: number, bnbUsd: number | null, treasury: number, capBps: number): number {
  return (Math.min(dt, MAX_STEP) * tapPer30d(tapUsd, bnbUsd, treasury, capBps).bnb) / MONTH;
}

/** Floor as a share of the sale price after `months` with the cap binding and no tax or redemptions. */
export function floorAfterMonths(months: number, capBps: number, startRatio: number): number {
  return startRatio * Math.pow(1 - capBps / 10_000, months);
}

/** BNB out for redeeming `amount` tokens at book: amount * b * (1 - fee), no fee at wind-down. */
export function redeemQuote(amount: number, book: number, exitFeeBps: number, windDown: boolean): { gross: number; fee: number; out: number } {
  const gross = amount * book;
  const fee = windDown ? 0 : (gross * exitFeeBps) / 10_000;
  return { gross, fee, out: gross - fee };
}

/** Book value for the holders who remain after a redemption. Never lower than before (the fee stays in the vault). */
export function bookAfterRedeem(treasury: number, owedTeam: number, R: number, amount: number, out: number): number {
  return bookValue(treasury - out, owedTeam, R - amount);
}

/** BNB from selling `amount` tokens into a V2 pool: sell tax, then the 0.25% swap fee and x*y=k slippage. */
export function poolSellQuote(amount: number, poolBnb: number, poolTokens: number, sellTaxBps: number): { out: number; spot: number; slippage: number } {
  const afterTax = amount * (1 - sellTaxBps / 10_000);
  const inWithFee = afterTax * (1 - PANCAKE_FEE_BPS / 10_000);
  const out = poolTokens + inWithFee > 0 ? (inWithFee * poolBnb) / (poolTokens + inWithFee) : 0;
  const spot = poolTokens > 0 ? amount * (poolBnb / poolTokens) : 0;
  return { out, spot, slippage: spot > 0 ? 1 - out / spot : 0 };
}

/*
 * Rule 3, with the exit-rule fixes from the design review applied:
 *
 * Fix 1. The streak decays instead of resetting. A trusted interval below book adds its time; an interval at or
 *        above book takes the same amount of time off, floored at zero. One hour pumped above book costs the streak
 *        one hour, not three days, so a team cannot hold the exit off by pushing the price up for an hour every few
 *        days. (Equivalent intent to a 72-hour time-weighted average against book.)
 * Fix 2. The pool-depth gate guards team unlocks only. A crash that drains the pool below half its seed is exactly
 *        when holders need the exit, so depth never freezes the exit streak.
 * Fix 3. The exit compares on-chain numbers only: the pair's TWAP against treasury per token. No Atlas report is
 *        required, so an Atlas outage never delays the exit.
 */
export function stepExitStreak(streak: number, elapsed: number, twap: number, book: number, maxStep = MAX_STEP): number {
  const dt = Math.min(elapsed, maxStep);
  return twap < book ? streak + dt : Math.max(0, streak - dt);
}

/** Time-weighted average of the pool price against book over the trailing window (default 72 hours). */
export function trailingTwap(history: { t: number; price: number; book: number }[], now: number, window = 3 * DAY): { price: number; book: number; covered: number } | null {
  const pts = history.filter((p) => p.t <= now).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const from = now - window;
  let wp = 0, wb = 0, covered = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const lo = Math.max(a.t, from), hi = Math.min(b.t, now);
    if (hi <= lo) continue;
    const w = hi - lo;
    wp += b.price * w; wb += b.book * w; covered += w;
  }
  if (covered === 0) return null;
  return { price: wp / covered, book: wb / covered, covered };
}

/** Seconds until a round would open if the price stays where it is; null when the price is at or above book. */
export function exitEta(streak: number, target: number, price: number, book: number): number | null {
  if (price >= book) return null;
  return Math.max(0, target - streak);
}

/** Rule 2 counter: adds strict-trusted time at or above the multiple; a strict observation below resets it. */
export function stepTranche(progress: number, elapsed: number, usdPrice: number, usdSalePrice: number, multiple: number, maxStep = MAX_STEP): number {
  const dt = Math.min(elapsed, maxStep);
  return usdPrice >= (usdSalePrice * multiple) / 100 ? progress + dt : 0;
}

/** Share of book value left after the given team tranches unlock (unlocked tokens join R). */
export function dilutionAfterUnlock(saleBps: number, poolBps: number, unlockedBps: number): number {
  const R0 = saleBps + poolBps;
  return R0 / (R0 + unlockedBps);
}

/** Seconds left before anyone may declare the covenant abandoned; negative once it is due. */
export function heartbeatLeft(lastHeartbeat: number, window: number, now: number): number {
  return lastHeartbeat + window - now;
}

/** Months of runway at the tap cap before the treasury falls to `share` of today (default: a quarter). */
export function runwayMonths(capBps: number, share = 0.25): number {
  const k = 1 - capBps / 10_000;
  if (k <= 0 || k >= 1) return Infinity;
  return Math.log(share) / Math.log(k);
}
