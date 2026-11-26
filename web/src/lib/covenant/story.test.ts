import { describe, expect, it } from "vitest";
import { planRedeem } from "@/lib/data/redeem-plan";
import { flagshipScene } from "./__fixtures__/worked-example";
import { settleRaise, split } from "./math";
import { amt, halvingMonths, moneyFlow, runway, supplyShares, todayMultiple, unlocksAt, usdAmt } from "./story";

const wei = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

describe("planRedeem: the redeem transactions the app sends", () => {
  it("approves exactly the amount when the allowance is short or unknown", () => {
    expect(planRedeem({ amount: wei(5), allowance: 0n, fallbackOut: wei(1) }).approve).toBe(wei(5));
    expect(planRedeem({ amount: wei(5), allowance: wei(4.9), fallbackOut: wei(1) }).approve).toBe(wei(5));
    expect(planRedeem({ amount: wei(5), fallbackOut: wei(1) }).approve).toBe(wei(5));
  });
  it("skips the approval when the vault may already take the amount", () => {
    expect(planRedeem({ amount: wei(5), allowance: wei(5), fallbackOut: wei(1) }).approve).toBeNull();
  });
  it("floors the payout at 99.5% of the vault's preview, else of the off-chain quote", () => {
    expect(planRedeem({ amount: wei(5), allowance: wei(5), preview: 1000n, fallbackOut: 9n }).minOut).toBe(995n);
    expect(planRedeem({ amount: wei(5), allowance: wei(5), preview: 0n, fallbackOut: 2000n }).minOut).toBe(1990n);
  });
});

describe("money map", () => {
  const raising = flagshipScene("raise");
  const t = raising.terms;
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);

  it("right now spans the minimum to the cap", () => {
    const f = moneyFlow(raising, "now");
    const lo = settleRaise(t.minRaise, t.minRaise, t.cap, sp);
    const hi = settleRaise(t.cap, t.minRaise, t.cap, sp);
    expect(f.conditional).toBe(true);
    expect(f.to.find((x) => x.key === "treasury")).toMatchObject({ bnb: lo.T0, hi: hi.T0 });
    expect(f.to.find((x) => x.key === "pool")).toMatchObject({ bnb: lo.qPool, hi: hi.qPool });
  });
  it("a missed minimum sends everything back", () => {
    const f = moneyFlow(raising, "missed");
    expect(f.to).toEqual([{ key: "refund", bnb: raising.raise.committed }]);
  });
  it("a settled raise adds up to what was committed", () => {
    const v = flagshipScene("settled");
    const f = moneyFlow(v, "settled");
    const sum = f.to.reduce((a, x) => a + x.bnb, 0);
    expect(f.conditional).toBe(false);
    expect(sum).toBeCloseTo(v.raise.committed, 9);
  });
});

describe("supply, unlocks and runway", () => {
  it("supply today splits into redeemable, locked and burned, summing to the total", () => {
    const v = flagshipScene("active");
    const s = supplyShares(v);
    expect(s.free + s.locked + s.burned).toBeCloseTo(s.total, 0);
    expect(s.sale + s.pool + s.team).toBeCloseTo(s.total, 0);
  });
  it("counts the tranches that apply at a multiple", () => {
    const v = flagshipScene("active");
    const m = v.terms.trancheMultiple;
    expect(unlocksAt(v, 100).count).toBe(0);
    expect(unlocksAt(v, m[0]!).count).toBe(1);
    expect(unlocksAt(v, Math.max(...m)).count).toBe(m.length);
  });
  it("draws the smaller of the dollar budget and the cap each month, never emptying the treasury", () => {
    const steps = runway(100, 0, 3000, 600, 400, 12); // $3,000 at $600 = 5 BNB; cap 4% of 100 = 4 BNB
    expect(steps[1]!.draw).toBeCloseTo(4, 9);
    expect(steps[1]!.binding).toBe("cap");
    expect(steps.at(-1)!.treasury).toBeGreaterThan(0);
    expect(halvingMonths(steps)).toBe(null); // 0.96^12 = 61% left after a year
    const cheap = runway(100, 0, 600, 600, 400, 3); // 1 BNB a month, under the cap
    expect(cheap[1]!.binding).toBe("usd");
    expect(cheap[3]!.treasury).toBeCloseTo(97, 9);
  });
  it("today's multiple uses the dollar sale price when the vault has one", () => {
    const v = { ...flagshipScene("active"), poolPrice: 2e-6, usdSalePrice: 1e-3 };
    const m = todayMultiple(v, 1e-6, 600);
    expect(m.bnb).toBeCloseTo(2, 9);
    expect(m.usd).toBeCloseTo(1.2, 9);
  });
});

describe("number formats", () => {
  it("gives BNB the digits its size needs", () => {
    expect(amt(2.65)).toBe("2.65");
    expect(amt(0.2511)).toBe("0.2511");
    expect(amt(0.000279)).toBe("0.000279");
    expect(amt(0)).toBe("0");
  });
  it("keeps tiny dollar prices readable", () => {
    expect(usdAmt(0.00000292)).toBe("$0.00000292");
    expect(usdAmt(2919.4)).toBe("$2,919");
  });
});
