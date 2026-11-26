import { describe, expect, it } from "vitest";
import {
  DAY, HOUR, accrueTap, bookAfterRedeem, bookValue, buyerOutcome, dilutionAfterUnlock, exitEta, floorAfterMonths,
  poolSellQuote, redeemQuote, redeemableSupply, settleRaise, split, startingFloorRatio, stepExitStreak, stepTranche,
  tapCap30d, tapPer30d, trailingTwap,
} from "./math";

const S = 1_000_000_000;
const s = split(S, 6000, 1500);

describe("the worked example in docs/DESIGN.md", () => {
  const r = settleRaise(1400, 200, 500, s);

  it("splits supply 60 / 15 / 25", () => {
    expect(s).toEqual({ A: 600_000_000, P: 150_000_000, E: 250_000_000 });
  });

  it("accepts 500 of 1,400 BNB and refunds 900", () => {
    expect(r.failed).toBe(false);
    expect(r.Q).toBe(500);
    expect(r.refunded).toBe(900);
    expect(r.oversubscription).toBeCloseTo(2.8, 6);
    expect(r.keptShare).toBeCloseTo(0.357, 3);
  });

  it("prices the sale at 500 / 600M and seeds the pool with 125 BNB", () => {
    expect(r.salePrice).toBeCloseTo(0.000000833, 9);
    expect(r.qPool).toBe(125);
    expect(r.T0).toBe(375);
  });

  it("starts book value at 60% of the sale price", () => {
    const b = bookValue(r.T0, 0, redeemableSupply(S, 0, s.E));
    expect(b).toBeCloseTo(0.0000005, 12);
    expect(b / r.salePrice).toBeCloseTo(0.6, 9);
    expect(startingFloorRatio(6000, 1500)).toBeCloseTo(0.6, 9);
  });

  it("gives a 14 BNB buyer 6M tokens for 5 BNB and refunds 9", () => {
    const o = buyerOutcome(14, 1400, r, s);
    expect(o.kept).toBeCloseTo(5, 9);
    expect(o.refund).toBeCloseTo(9, 9);
    expect(o.tokens).toBeCloseTo(6_000_000, 3);
  });

  it("fails the raise below the minimum with full refunds", () => {
    const f = settleRaise(150, 200, 500, s);
    expect(f.failed).toBe(true);
    expect(buyerOutcome(14, 150, f, s).refund).toBe(14);
  });
});

describe("starting floor table", () => {
  it.each([
    [7000, 1000, 0.75],
    [6000, 1500, 0.6],
    [6000, 2000, 0.5],
    [5000, 2000, 0.43],
  ])("sale %i pool %i gives %f", (a, p, want) => {
    expect(startingFloorRatio(a, p)).toBeCloseTo(want, 2);
  });
});

describe("rule 1: tap", () => {
  it("caps at 4% of a 375 BNB treasury: 15 BNB in the first month", () => {
    expect(tapCap30d(375, 400)).toBe(15);
    expect(tapPer30d(30_000, 600, 375, 400)).toEqual({ bnb: 15, binding: "cap" });
  });
  it("pays nothing before any verified BNB/USD (no cap-only fallback)", () => {
    expect(tapPer30d(30_000, null, 375, 400)).toEqual({ bnb: 0, binding: "paused" });
  });
  it("pays the dollar budget when it is below the cap", () => {
    expect(tapPer30d(3_000, 600, 375, 400)).toEqual({ bnb: 5, binding: "usd" });
  });
  it("accrues at most six hours per observation", () => {
    expect(accrueTap(DAY, 30_000, 600, 375, 400)).toBeCloseTo((15 * 6 * HOUR) / (30 * DAY), 12);
  });
  it.each([
    [6, 0.47],
    [12, 0.368],
    [24, 0.225],
  ])("floor after %i months is %f of the sale price", (m, want) => {
    expect(floorAfterMonths(m, 400, 0.6)).toBeCloseTo(want, 3);
  });
});

describe("rule 3: book-value exit", () => {
  const T = 320, R = 750_000_000;
  const b = bookValue(T, 0, R);

  it("redeems 6M tokens for 2.534 BNB at a 1% fee", () => {
    expect(b).toBeCloseTo(0.000000427, 9);
    const q = redeemQuote(6_000_000, b, 100, false);
    expect(q.out).toBeCloseTo(2.534, 3);
    expect(redeemQuote(6_000_000, b, 100, true).fee).toBe(0);
  });

  it("raises book value for the holders who remain", () => {
    const q = redeemQuote(6_000_000, b, 100, false);
    const after = bookAfterRedeem(T, 0, R, 6_000_000, q.out);
    expect(after).toBeGreaterThan(b);
    expect(after).toBeCloseTo(0.0000004267, 10);
  });

  it("compares with about 2.1 BNB on the pool before tax and slippage", () => {
    const q = poolSellQuote(6_000_000, 52.5, 150_000_000, 100);
    expect(q.spot).toBeCloseTo(2.1, 6);
    expect(q.out).toBeLessThan(q.spot);
  });

  it("fix 1: an hour above book takes an hour off the streak instead of resetting it", () => {
    let streak = 0;
    for (let i = 0; i < 48; i++) streak = stepExitStreak(streak, HOUR, 0.8, 1);
    expect(streak).toBe(48 * HOUR);
    streak = stepExitStreak(streak, HOUR, 1.2, 1); // the pump
    expect(streak).toBe(47 * HOUR);
    for (let i = 0; i < 25; i++) streak = stepExitStreak(streak, HOUR, 0.8, 1);
    expect(streak).toBeGreaterThanOrEqual(3 * DAY);
  });

  it("fix 1: a pump every few days cannot hold the round off", () => {
    let streak = 0;
    let hours = 0;
    while (streak < 3 * DAY && hours < 10 * 24) {
      const pumped = hours % 48 === 47;
      streak = stepExitStreak(streak, HOUR, pumped ? 1.5 : 0.8, 1);
      hours++;
    }
    expect(streak).toBeGreaterThanOrEqual(3 * DAY);
    expect(hours).toBeLessThan(4 * 24);
  });

  it("decays to zero, never below", () => {
    expect(stepExitStreak(HOUR, 6 * HOUR, 2, 1)).toBe(0);
  });

  it("adds at most six hours per observation", () => {
    expect(stepExitStreak(0, DAY, 0.5, 1)).toBe(6 * HOUR);
  });

  it("gives an ETA only while the price is under book", () => {
    expect(exitEta(2 * DAY, 3 * DAY, 0.9, 1)).toBe(DAY);
    expect(exitEta(2 * DAY, 3 * DAY, 1.1, 1)).toBeNull();
  });

  it("computes a trailing 72-hour TWAP against book", () => {
    const pts = Array.from({ length: 97 }, (_, i) => ({ t: i * HOUR, price: i <= 72 ? 1.2 : 0.6, book: 1 })); // each point prices the hour that ends at it
    const w = trailingTwap(pts, 96 * HOUR)!;
    expect(w.covered).toBe(72 * HOUR);
    expect(w.price).toBeCloseTo((48 * 1.2 + 24 * 0.6) / 72, 9);
  });
});

describe("rule 2: performance unlock", () => {
  it("counts time at or above the multiple and resets below", () => {
    let p = stepTranche(0, HOUR, 2.1, 1, 200);
    expect(p).toBe(HOUR);
    p = stepTranche(p, HOUR, 1.9, 1, 200);
    expect(p).toBe(0);
  });
  it("dilutes book value to 0.75 after all three tranches", () => {
    expect(dilutionAfterUnlock(6000, 1500, 2500)).toBeCloseTo(0.75, 9);
  });
});
