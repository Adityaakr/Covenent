import { describe, expect, it } from "vitest";
import { redeemQuote } from "./math";
import { flagshipMarkers, flagshipScene, LAUNCH, otherCovenants, viewBook } from "./mock";
import { DAY } from "./time";

describe("the mock demo story follows the doc", () => {
  it("raises 1,400 BNB against a 500 BNB cap", () => {
    const v = flagshipScene("raise");
    expect(v.state).toBe("RAISING");
    expect(v.raise.committed).toBe(1400);
  });

  it("settles the 14 BNB buyer to 5 BNB, a 9 BNB refund and 6M tokens", () => {
    const p = flagshipScene("settled").position!;
    expect(p.accepted).toBeCloseTo(5, 9);
    expect(p.refund).toBeCloseTo(9, 9);
    expect(p.allocation).toBeCloseTo(6_000_000, 2);
  });

  it("starts the treasury at 375 BNB", () => {
    expect(flagshipScene("settled").ledger[0]!.amount).toBe(375);
  });

  it("has about 4.1 BNB of tap claimable on day 8.2", () => {
    const v = flagshipScene("active");
    expect(v.state).toBe("ACTIVE");
    expect(v.tap.accrued + v.tap.claimedThisPeriod).toBeGreaterThan(3.5);
    expect(v.tap.accrued + v.tap.claimedThisPeriod).toBeLessThan(4.5);
  });

  it("fills the streak under book without a round yet, after a pump that only took an hour off", () => {
    const v = flagshipScene("slide");
    expect(v.state).toBe("ACTIVE");
    expect(v.poolPrice).toBeLessThan(viewBook(v));
    expect(v.exit.streak).toBeGreaterThan(2 * DAY);
    expect(v.exit.streak).toBeLessThan(v.terms.exitStreak);
    expect(v.events.some((e) => e.detail.includes("never resets"))).toBe(true);
    expect(v.events.some((e) => e.detail.includes("Atlas report stale"))).toBe(true);
  });

  it("opens the round with 320 BNB in the vault, so 6M tokens redeem for 2.534 BNB", () => {
    const v = flagshipScene("exit");
    expect(v.state).toBe("EXIT_ROUND");
    expect(v.treasury).toBeCloseTo(320, 2);
    expect(v.owedTeam).toBe(0);
    expect(redeemQuote(6_000_000, viewBook(v), 100, false).out).toBeCloseTo(2.534, 3);
  });

  it("lets anyone declare the agent abandoned 45 days after it stops", () => {
    const u = flagshipScene("unplugged");
    expect(u.now - u.lastHeartbeat).toBeGreaterThan(u.terms.heartbeat);
    expect(u.state).not.toBe("WIND_DOWN");
    const a = flagshipScene("abandoned");
    expect(a.state).toBe("WIND_DOWN");
    expect(a.lockedTeam).toBe(0);
    expect(a.issuer.outcomes.at(-1)!.outcome).toBe("abandoned");
    expect(a.events.some((e) => e.name === "OutcomeRecorded")).toBe(true);
  });

  it("keeps the ledger consistent with the treasury", () => {
    for (const id of ["active", "exit", "abandoned"] as const) {
      const v = flagshipScene(id);
      const sum = v.ledger.reduce((a, r) => a + r.amount, 0);
      expect(sum).toBeCloseTo(v.treasury, 6);
      expect(v.ledger.some((r) => r.kind === "revenue")).toBe(id !== "active" || v.now - LAUNCH > 18 * DAY);
    }
  });

  it("marks the round opening after the slide", () => {
    expect(flagshipMarkers().roundOpen).toBeGreaterThan(LAUNCH + 140 * DAY);
  });

  it("builds the other covenants", () => {
    const o = otherCovenants();
    expect(o.map((v) => v.state)).toEqual(["ACTIVE", "RAISING", "WIND_DOWN", "FAILED"]);
    expect(o[0]!.tranches[0]!.unlocked).toBe(true);
  });
});
