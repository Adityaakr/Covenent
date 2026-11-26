/*
 * Pure figures behind the covenant's visual sections (money map, raise history, supply, health, unlock curve).
 * Every number comes from a CovenantView read from the chain and the doc's formulas in math.ts; nothing is sampled.
 */
import { settleRaise, split, type RaiseResult } from "./math";
import { MONTH } from "./math";
import type { CovenantView } from "./types";

/** BNB with as many digits as the size needs: 12.35, 0.2513, 0.000279. */
export function amt(n: number): string {
  if (!Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a >= 100) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (a >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  if (a >= 0.01) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumSignificantDigits: 3 });
}

/** A dollar figure that can be a tiny per-token price: $1,240, $0.52, $0.00000154. */
export function usdAmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const a = Math.abs(n);
  if (a >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (a >= 1) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toLocaleString("en-US", { maximumSignificantDigits: 3 });
}

/** When the raise settled: the launcher's launch time, else the vault's TreasuryFunded or Finalized event. */
export function launchAt(v: CovenantView): number | null {
  if (v.raise.launchedAt) return v.raise.launchedAt;
  const funded = v.ledger.filter((r) => r.kind === "raise").map((r) => r.at);
  const fin = v.events.filter((e) => e.name === "Finalized" || e.name === "TreasuryFunded").map((e) => e.at);
  const all = [...funded, ...fin];
  return all.length ? Math.min(...all) : null;
}

export interface Flow {
  /** where the money goes, as labelled destinations */
  to: { key: "pool" | "treasury" | "refund"; bnb: number; hi?: number; tokens?: number }[];
  held: number; // in the launcher (escrow) right now
  committed: number;
  conditional: boolean; // dashed (would happen) or solid (happened)
}

/** The money map for one scenario. "now" during a raise shows the range from the minimum to the cap. */
export function moneyFlow(v: CovenantView, scenario: "now" | "met" | "missed" | "settled"): Flow {
  const t = v.terms;
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);
  const C = v.raise.committed;
  if (scenario === "missed") return { to: [{ key: "refund", bnb: C }], held: C, committed: C, conditional: true };
  if (scenario === "settled") {
    const r = settleRaise(C, t.minRaise, t.cap, sp);
    if (r.failed || v.state === "FAILED") return { to: [{ key: "refund", bnb: C }], held: 0, committed: C, conditional: false };
    return { to: [{ key: "treasury", bnb: r.T0 }, { key: "pool", bnb: r.qPool, tokens: sp.P }, { key: "refund", bnb: r.refunded }], held: 0, committed: C, conditional: false };
  }
  if (scenario === "met") {
    const r = settleRaise(Math.max(C, t.minRaise), t.minRaise, t.cap, sp);
    return { to: [{ key: "treasury", bnb: r.T0 }, { key: "pool", bnb: r.qPool, tokens: sp.P }, { key: "refund", bnb: Math.max(0, C - t.cap) }], held: C, committed: C, conditional: true };
  }
  const lo = settleRaise(t.minRaise, t.minRaise, t.cap, sp);
  const hi = settleRaise(t.cap, t.minRaise, t.cap, sp);
  return {
    to: [
      { key: "treasury", bnb: lo.T0, hi: hi.T0 },
      { key: "pool", bnb: lo.qPool, hi: hi.qPool, tokens: sp.P },
      { key: "refund", bnb: Math.max(0, C - t.cap), hi: C },
    ],
    held: C, committed: C, conditional: true,
  };
}

/** Who holds the supply: the launch allocation, and today (redeemable, team still locked, burned). */
export function supplyShares(v: CovenantView) {
  const t = v.terms;
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);
  const launched = v.state !== "RAISING" && v.state !== "FAILED";
  const locked = launched ? Math.min(v.lockedTeam, sp.E) : sp.E;
  const burned = Math.max(0, Math.min(v.deadTokens, t.totalSupply - locked));
  const free = Math.max(0, t.totalSupply - locked - burned);
  return { total: t.totalSupply, sale: sp.A, pool: sp.P, team: sp.E, locked, burned, free };
}

/** Today's price as a multiple of the sale price, in BNB (pool) and in dollars (when the vault knows both). */
export function todayMultiple(v: CovenantView, salePriceBnb: number, bnbUsd: number): { bnb: number; usd: number | null } {
  const bnbM = salePriceBnb > 0 ? v.poolPrice / salePriceBnb : 0;
  const usdM = v.usdSalePrice && bnbUsd > 0 ? (v.poolPrice * bnbUsd) / v.usdSalePrice : null;
  return { bnb: bnbM, usd: usdM };
}

export interface RunwayStep { month: number; treasury: number; draw: number; binding: "usd" | "cap" }

/**
 * The treasury month by month if the team draws its full limit every 30 days and nothing else moves:
 * draw = min(dollar budget at today's rate, cap bps of the free treasury). The cap is a share of what is left, so the
 * treasury never reaches zero from the tap alone.
 */
export function runway(treasury: number, owedTeam: number, tapUsd: number, bnbUsd: number, capBps: number, months = 12): RunwayStep[] {
  const out: RunwayStep[] = [];
  let T = Math.max(0, treasury - owedTeam);
  out.push({ month: 0, treasury: T, draw: 0, binding: "cap" });
  for (let m = 1; m <= months; m++) {
    const cap = (T * capBps) / 10_000;
    const usdBnb = bnbUsd > 0 ? tapUsd / bnbUsd : Infinity;
    const draw = Math.min(cap, usdBnb);
    T = Math.max(0, T - draw);
    out.push({ month: m, treasury: T, draw, binding: usdBnb <= cap ? "usd" : "cap" });
  }
  return out;
}

/** Months until the free treasury halves at the full limit (Infinity when the tap draws nothing). */
export function halvingMonths(steps: RunwayStep[]): number | null {
  const start = steps[0]?.treasury ?? 0;
  if (start <= 0) return null;
  const hit = steps.find((s) => s.treasury <= start / 2);
  return hit ? hit.month : null;
}

/** Tranches that would apply at price multiple `m` (x100 units in terms), and the share of supply they carry. */
export function unlocksAt(v: CovenantView, m100: number) {
  const hits = v.terms.trancheMultiple.map((mult, k) => ({ mult, bps: v.terms.trancheBps[k] ?? 0 })).filter((x) => m100 >= x.mult);
  return { count: hits.length, of: v.terms.trancheMultiple.length, bps: hits.reduce((a, x) => a + x.bps, 0) };
}

export { MONTH };
export type { RaiseResult };
