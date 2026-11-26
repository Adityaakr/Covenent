/** Figures every screen shows, derived from a CovenantView with the doc's formulas in one place. */
import {
  bookValue, dilutionAfterUnlock, exitEta, floorAfterMonths, heartbeatLeft, premium, redeemableSupply, settleRaise, split,
  startingFloorRatio, tapCap30d, tapPer30d, trailingTwap,
} from "./math";
import type { CovenantView } from "./types";

export function derive(v: CovenantView) {
  const t = v.terms;
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);
  const raise = settleRaise(v.raise.committed, t.minRaise, t.cap, sp);
  const R = redeemableSupply(t.totalSupply, v.deadTokens, v.lockedTeam);
  const book = bookValue(v.treasury, v.owedTeam, R);
  const prem = premium(v.poolPrice, book);
  const startRatio = startingFloorRatio(t.saleBps, t.poolBps);
  const salePrice = raise.salePrice;
  const bnbUsd = v.trust.bnbUsd || 0;
  const budget = tapPer30d(t.tapUsdPer30d, bnbUsd || null, v.treasury, t.tapCapBps);
  const cap30 = tapCap30d(v.treasury, t.tapCapBps);
  const tapPaused = v.state === "EXIT_ROUND" || v.state === "WIND_DOWN" || v.state === "FAILED" || v.state === "RAISING";
  const eta = v.state === "ACTIVE" ? exitEta(v.exit.streak, t.exitStreak, v.poolPrice, book) : null;
  const hbLeft = heartbeatLeft(v.lastHeartbeat, t.heartbeat, v.now);
  const twap72 = trailingTwap(v.history, v.now);
  const unlockedBps = v.tranches.filter((x) => x.unlocked).reduce((a, x) => a + x.bps, 0);
  const lockedBps = v.tranches.filter((x) => !x.unlocked).reduce((a, x) => a + x.bps, 0);
  const sums = { raise: 0, tax: 0, revenue: 0, tap: 0, redeem: 0 };
  for (const r of v.ledger) sums[r.kind] += r.amount;
  return {
    sp, raise, R, book, prem, startRatio, salePrice, bnbUsd, budget, cap30, tapPaused, eta, hbLeft, twap72, sums,
    floorRatioNow: salePrice > 0 ? book / salePrice : 0,
    treasuryUsd: v.treasury * bnbUsd,
    floor6: floorAfterMonths(6, t.tapCapBps, startRatio),
    dilutionAll: dilutionAfterUnlock(t.saleBps, t.poolBps, unlockedBps + lockedBps),
    teamBps: 10_000 - t.saleBps - t.poolBps,
  };
}

export type Derived = ReturnType<typeof derive>;
