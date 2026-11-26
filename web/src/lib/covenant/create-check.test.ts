import { describe, expect, it } from "vitest";
import { askToFill, ceilBnb, checkCreate, DEMO_PROFILE, PRODUCTION_PROFILE, rescaleTranches, type CheckContext } from "./create-check";
import { DEFAULT_TERMS, DEMO_TIMERS } from "./defaults";
import { DAY } from "./time";
import type { Terms } from "./types";

const prod: CheckContext = { profile: PRODUCTION_PROFILE, floor: null, issuer: "human", agentId: "", unit: DAY };
const ok: Terms = { ...DEFAULT_TERMS };
const fields = (t: Terms, c: CheckContext = prod) => checkCreate(t, c).map((x) => x.field);

describe("checkCreate mirrors the factory", () => {
  it("passes the design document's default terms on the production profile", () => {
    expect(checkCreate(ok, prod)).toEqual([]);
  });

  it("passes the demo timers on the demo profile and refuses them on production", () => {
    const demo = { ...ok, ...DEMO_TIMERS, cliff: 0 };
    expect(checkCreate(demo, { ...prod, profile: DEMO_PROFILE, unit: 60 })).toEqual([]);
    expect(fields(demo)).toEqual(expect.arrayContaining(["saleDuration", "exitStreak", "roundLength", "cooldown", "heartbeat", "unlockWindow"]));
  });

  it("checks the split: sale at least 40%, pool 5% up to the sale, team at most 30%", () => {
    expect(fields({ ...ok, saleBps: 3900, poolBps: 3000, trancheBps: [3100], trancheMultiple: [200] })).toContain("saleBps");
    expect(fields({ ...ok, poolBps: 400, trancheBps: [500, 1000, 2100] })).toContain("poolBps");
    expect(fields({ ...ok, saleBps: 5000, poolBps: 1500, trancheBps: [1000, 1000, 1500] })).toContain("saleBps"); // team 35%
  });

  it("offers to rescale tranches that do not add to the team share", () => {
    const t = { ...ok, saleBps: 6500 }; // team 20%, tranches still 25%
    const issue = checkCreate(t, prod).find((x) => x.field === "tranches")!;
    expect(issue.fix?.patch.trancheBps?.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(checkCreate({ ...t, ...issue.fix!.patch }, prod)).toEqual([]);
  });

  it("refuses tranche multiples at or below 1x and above 100x", () => {
    expect(fields({ ...ok, trancheMultiple: [100, 400, 800] })).toContain("tranches");
    expect(fields({ ...ok, trancheMultiple: [200, 400, 10_001] })).toContain("tranches");
  });

  it("checks Flap's floor and fixes it with the minimum, raising the cap when it has to", () => {
    const c = { ...prod, floor: { minRaise: 42.857142857142857, graduation: false, marginBps: 15_000 } };
    const issue = checkCreate({ ...ok, minRaise: 10, cap: 20 }, c).find((x) => x.field === "minRaise")!;
    expect(issue.msg).toContain("1.5x");
    expect(issue.fix?.patch).toEqual({ minRaise: 42.8572, cap: 42.8572 });
    expect(checkCreate({ ...ok, minRaise: 10, cap: 20, ...issue.fix!.patch }, c)).toEqual([]);
    expect(checkCreate({ ...ok, minRaise: 10, cap: 500 }, c).find((x) => x.field === "minRaise")!.fix?.patch).toEqual({ minRaise: 42.8572, cap: 500 });
  });

  it("checks the raise bounds", () => {
    expect(fields({ ...ok, minRaise: 0 })).toContain("minRaise");
    expect(fields({ ...ok, cap: 100 })).toContain("cap");
    expect(fields({ ...ok, minRaise: 200, cap: 100_001 })).toContain("cap");
  });

  it("checks the tax the way Flap does: each at most 10%, the higher at least 1%", () => {
    expect(fields({ ...ok, buyTaxBps: 0, sellTaxBps: 50 })).toContain("tax");
    expect(fields({ ...ok, buyTaxBps: 0, sellTaxBps: 100 })).not.toContain("tax");
    expect(fields({ ...ok, sellTaxBps: 1_001 })).toContain("tax");
    expect(fields({ ...ok, taxDuration: 29 * DAY })).toContain("taxDuration");
  });

  it("checks the rules: tap cap, exit fee, heartbeat", () => {
    expect(fields({ ...ok, tapCapBps: 1_001 })).toContain("tapCapBps");
    expect(fields({ ...ok, exitFeeBps: 301 })).toContain("exitFeeBps");
    expect(fields({ ...ok, heartbeat: 13 * DAY })).toContain("heartbeat");
  });

  it("checks the token text and the issuer", () => {
    expect(fields({ ...ok, name: " " })).toContain("name");
    expect(fields({ ...ok, symbol: "l" })).toContain("symbol");
    expect(fields({ ...ok, meta: "x".repeat(513) })).toContain("meta");
    expect(fields({ ...ok, teamWallet: "0x0000000000000000000000000000000000000000" })).toContain("teamWallet");
    expect(fields(ok, { ...prod, issuer: "agent", agentId: "" })).toContain("agentId");
  });
});

describe("helpers", () => {
  it("rounds a suggested minimum up, never under the floor", () => {
    expect(ceilBnb(42.857142857142857)).toBe(42.8572);
    expect(ceilBnb(3.9682)).toBe(3.9682);
  });

  it("rescales tranches to a team share, keeping proportions", () => {
    expect(rescaleTranches([500, 1000, 1000], 2000)).toEqual([400, 800, 800]);
    expect(rescaleTranches([500, 1000, 1000], 0)).toEqual([]);
  });

  it("asks Ask AI with the form's own state and its open problems", () => {
    const q = askToFill({ ...ok, name: "", symbol: "" }, { issuer: "agent", agentId: "12", factory: "demo", unit: 60, problems: ["Name the token"] });
    expect(q).toContain("draft_covenant");
    expect(q).toContain("not chosen yet");
    expect(q).toContain("AI agent #12");
    expect(q).toContain("200 BNB minimum, 500 BNB cap");
    expect(q).toContain("Name the token");
  });
});
