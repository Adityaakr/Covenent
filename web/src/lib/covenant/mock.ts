/*
 * The mock data layer: the doc's worked example and demo story, produced by sim.ts so every number follows the
 * rules. Screens render this until contracts/deployments/local.json exists and the local chain answers.
 */
import { DEFAULT_TERMS, ERC8004 } from "./defaults";
import { bookValue, buyerOutcome, redeemableSupply, settleRaise, split } from "./math";
import { simulate, type SimConfig } from "./sim";
import { DAY, HOUR, MINUTE } from "./time";
import type { Address, CovenantView, Issuer } from "./types";

/** Launch of the flagship covenant: 29 Jun 2026 12:00 UTC, so the exit streak fills on 26 Nov 2026. */
export const LAUNCH = Date.UTC(2026, 5, 29, 12) / 1000;
const A = (s: string) => s as Address;

/** anvil account #1: the demo buyer who commits 14 BNB in the doc's example. */
export const DEMO_BUYER = A("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

export const LUMEN_AGENT: Issuer = {
  kind: "agent",
  teamWallet: DEFAULT_TERMS.teamWallet,
  agentId: 4127,
  name: "Lumen Analyst",
  registrationUri: "https://lumen.example/.well-known/agent-registration.json",
  registry: ERC8004[97].identity as Address,
  services: [
    { name: "MCP", endpoint: "covenant-mcp (stdio)" },
    { name: "A2A", endpoint: "https://lumen.example/a2a" },
  ],
  supportedTrust: ["crypto-economic"],
  outcomes: [{ covenant: "SCOUT", outcome: "unlocked", at: LAUNCH - 140 * DAY, detail: "2x tranche unlocked after 30 trusted days", vault: A("0x5c0b2f6a1e8d4b9a7c3e1f0d2b4a6c8e0f1a2b3c") }],
};

const FLAGSHIP_BASE: SimConfig = {
  id: "lumen",
  terms: { ...DEFAULT_TERMS, agentId: 4127 },
  issuer: LUMEN_AGENT,
  launch: LAUNCH,
  committed: 1400,
  contributors: 3,
  path: [
    { day: 0, m: 1.0 }, { day: 6, m: 1.32 }, { day: 20, m: 1.58 }, { day: 44, m: 2.02 }, { day: 50, m: 2.24 },
    { day: 61, m: 2.18 }, { day: 66, m: 1.86 }, { day: 92, m: 1.42 }, { day: 118, m: 0.98 }, { day: 138, m: 0.7 },
    { day: 146, m: 0.62 }, { day: 148.5, m: 0.43 }, { day: 400, m: 0.42 },
  ],
  taxPerDay: 0.14,
  taxScale: 1,
  revenue: [
    { day: 18, amount: 0.62, note: "Agent revenue: 62 briefs sold over x402" },
    { day: 47, amount: 0.95, note: "Agent revenue: data subscription paid on-chain" },
    { day: 79, amount: 0.71, note: "Agent revenue: 71 briefs sold over x402" },
    { day: 111, amount: 0.48, note: "Agent revenue: 48 briefs sold over x402" },
    { day: 141, amount: 0.34, note: "Agent revenue: 34 briefs sold over x402" },
  ],
  killAt: null,
  declareAbandonedAt: null,
  atlasOutage: [148.7, 149.5],
  pumpDays: [149.75],
  roundRedemptions: [{ afterHours: 14, tokens: 12_000_000 }, { afterHours: 33, tokens: 31_000_000 }, { afterHours: 80, tokens: 8_500_000 }],
  lowerTapTo: 6_000,
  seed: 42,
  addresses: {
    launcher: A("0x8a1f6c3d2b4e5f60718293a4b5c6d7e8f9012345"),
    vault: A("0x4e2d9a7c1b3f5e6d8a0c2b4d6f8e0a1c3e5b7777"),
    token: A("0x9b3e1d5c7a2f4e6b8d0c1a3e5f7b9d2c4e6a7777"),
    pair: A("0x2f7c9e1b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3e"),
    oracle: A("0x6d1b3f5a7c9e2b4d6f8a0c2e4b6d8f0a2c4e6b8d"),
  },
};

/** Scale trading tax so the vault holds exactly 320 BNB once the round opens and the agent claims (doc example). */
function calibrate(): SimConfig {
  let lo = 0, hi = 6;
  let cfg = FLAGSHIP_BASE;
  const at = (scale: number) => {
    const c = { ...FLAGSHIP_BASE, taxScale: scale };
    const probe = simulate(c, LAUNCH + 200 * DAY);
    const open = probe.roundOpenedAt ?? LAUNCH + 150 * DAY;
    const after = simulate(c, open + 2 * HOUR);
    return { c, T: after.view.treasury };
  };
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const { c, T } = at(mid);
    cfg = c;
    if (T > 320) hi = mid; else lo = mid;
  }
  return cfg;
}

let calibrated: SimConfig | null = null;
let markers: { roundOpen: number; killAt: number } | null = null;
function flagship(): SimConfig {
  if (!calibrated) calibrated = calibrate();
  return calibrated;
}
export function flagshipMarkers() {
  if (!markers) {
    const cfg = flagship();
    const open = simulate(cfg, LAUNCH + 200 * DAY).roundOpenedAt!;
    markers = { roundOpen: open, killAt: open + 4 * HOUR };
  }
  return markers;
}

export type SceneId = "raise" | "settled" | "active" | "slide" | "exit" | "unplugged" | "abandoned";

export const SCENES: { id: SceneId; label: string; at: string }[] = [
  { id: "raise", label: "Raise", at: "0:20" },
  { id: "settled", label: "Settle", at: "0:40" },
  { id: "active", label: "Tap and tax", at: "0:50" },
  { id: "slide", label: "Slide under book", at: "1:20" },
  { id: "exit", label: "Exit round", at: "1:45" },
  { id: "unplugged", label: "Agent unplugged", at: "2:05" },
  { id: "abandoned", label: "Treasury opens", at: "2:15" },
];

/** The demo buyer: committed 14 BNB, kept 5, refunded 9, 6M tokens. */
function demoPosition(view: CovenantView, claimed: boolean) {
  const sp = split(view.terms.totalSupply, view.terms.saleBps, view.terms.poolBps);
  const r = settleRaise(view.raise.committed, view.terms.minRaise, view.terms.cap, sp);
  const o = buyerOutcome(14, view.raise.committed, r, sp);
  return { committed: 14, accepted: o.kept, refund: o.refund, allocation: o.tokens, tokensClaimed: claimed, refundClaimed: claimed, balance: claimed ? o.tokens : 0 };
}

export function flagshipScene(scene: SceneId): CovenantView {
  const cfg = flagship();
  const mk = flagshipMarkers();
  if (scene === "raise") return raisingView(cfg);
  if (scene === "settled") {
    const v = simulate(cfg, LAUNCH + 5 * MINUTE).view;
    return { ...v, position: demoPosition(v, false), now: LAUNCH + 5 * MINUTE };
  }
  if (scene === "active") {
    // Day 8.2: 4.10 BNB of tap accrued, a week of tax just arrived, the agent about to claim.
    const v = simulate({ ...cfg, killAt: null }, LAUNCH + Math.round(8.2 * DAY / HOUR) * HOUR).view;
    return { ...v, position: demoPosition(v, true) };
  }
  if (scene === "slide") {
    const v = simulate(cfg, mk.roundOpen - 13 * HOUR).view;
    return { ...v, position: demoPosition(v, true) };
  }
  if (scene === "exit") {
    const v = simulate({ ...cfg, killAt: mk.killAt }, mk.roundOpen + 2 * HOUR).view;
    return { ...v, position: demoPosition(v, true) };
  }
  const due = mk.killAt + cfg.terms.heartbeat;
  if (scene === "unplugged") {
    const v = simulate({ ...cfg, killAt: mk.killAt }, due + 2 * HOUR).view;
    return { ...v, position: demoPosition(v, true) };
  }
  const v = simulate({ ...cfg, killAt: mk.killAt, declareAbandonedAt: due + 3 * HOUR }, due + 4 * HOUR).view;
  return { ...v, position: demoPosition(v, true) };
}

function raisingView(cfg: SimConfig): CovenantView {
  const base = simulate(cfg, LAUNCH).view;
  const deadline = LAUNCH - MINUTE;
  const now = deadline - 4 * HOUR;
  return {
    ...base,
    state: "RAISING",
    vault: undefined,
    token: undefined,
    pair: undefined,
    raise: { committed: 1400, contributors: 3, deadline, finalized: false },
    treasury: 0,
    owedTeam: 0,
    poolPrice: 0,
    poolBnb: 0,
    ledger: [],
    history: [],
    bands: [],
    events: [
      { at: now - 2 * HOUR, name: "Contributed", detail: "0x9965…A4dc committed 700 BNB" },
      { at: now - 5 * HOUR, name: "Contributed", detail: "0x15d3…6A65 committed 686 BNB" },
      { at: now - 30 * HOUR, name: "Contributed", detail: "0x7099…79C8 committed 14 BNB" },
    ],
    lastHeartbeat: now,
    issuer: { ...cfg.issuer, outcomes: [...cfg.issuer.outcomes, { covenant: cfg.terms.symbol, outcome: "active", at: now, detail: "This covenant, raising" }] },
    position: { committed: 14, accepted: 0, refund: 0, allocation: 0, tokensClaimed: false, refundClaimed: false, balance: 0 },
    now,
  };
}

/* ---------- The other covenants on the explore list ---------- */

const NOW = Date.UTC(2026, 10, 26, 12) / 1000;

function harbor(): CovenantView {
  const terms = { ...DEFAULT_TERMS, name: "Harbor", symbol: "HRBR", meta: "A logistics app tokenizing its booking fees. Human team, public company in formation.", minRaise: 150, cap: 300, tapUsdPer30d: 18_000, teamWallet: A("0x90F79bf6EB2c4f870365E785982E1f101E93b906"), agentId: 0 };
  const deadline = NOW + 2 * DAY + 6 * HOUR;
  const base = simulate({ ...FLAGSHIP_BASE, id: "harbor", terms, committed: 212, seed: 7, issuer: { kind: "human", teamWallet: terms.teamWallet, name: "Harbor Labs", outcomes: [] } }, NOW).view;
  return {
    ...base, id: "harbor", state: "RAISING", vault: undefined, token: undefined, pair: undefined, launcher: A("0x1b8e2d4c6a8f0b2d4e6a8c0e2f4b6d8a0c2e4f61"),
    raise: { committed: 212.4, contributors: 41, deadline, finalized: false },
    treasury: 0, owedTeam: 0, poolPrice: 0, poolBnb: 0, ledger: [], history: [], bands: [],
    events: [{ at: NOW - 3 * HOUR, name: "Contributed", detail: "0x23a1…9f0e committed 12 BNB" }, { at: NOW - 9 * HOUR, name: "Contributed", detail: "0x8c4d…11b2 committed 3.5 BNB" }],
    issuer: { kind: "human", teamWallet: terms.teamWallet, name: "Harbor Labs", outcomes: [] },
    now: NOW,
  };
}

function moss(): CovenantView {
  const launch = NOW - 120 * DAY;
  const terms = { ...DEFAULT_TERMS, name: "Moss", symbol: "MOSS", meta: "A trading agent that went quiet in its second month.", minRaise: 80, cap: 160, tapUsdPer30d: 12_000, teamWallet: A("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"), agentId: 3310 };
  const issuer: Issuer = { kind: "agent", teamWallet: terms.teamWallet, agentId: 3310, name: "Moss Trader", registrationUri: "https://moss.example/agent.json", registry: ERC8004[97].identity as Address, services: [{ name: "MCP", endpoint: "https://moss.example/mcp" }], supportedTrust: ["crypto-economic"], outcomes: [] };
  const killAt = launch + 38 * DAY;
  return simulate({
    ...FLAGSHIP_BASE, id: "moss", terms, issuer, launch, committed: 131, contributors: 212, seed: 11, taxPerDay: 0.05, revenue: [],
    path: [{ day: 0, m: 1 }, { day: 10, m: 1.2 }, { day: 30, m: 0.9 }, { day: 60, m: 0.55 }, { day: 400, m: 0.5 }],
    killAt, declareAbandonedAt: killAt + 46 * DAY, atlasOutage: null, pumpDays: [], roundRedemptions: [], lowerTapTo: null,
    addresses: { launcher: A("0x3d5f7b9e1c3a5d7f9b1e3c5a7d9f1b3e5c7a9d1f"), vault: A("0x7e9c1a3b5d7f9e1c3a5b7d9f1e3c5a7b9d1f7777"), token: A("0x5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f7777"), pair: A("0x1c3e5a7b9d1f3c5e7a9b1d3f5c7e9a1b3d5f7c9e"), oracle: FLAGSHIP_BASE.addresses.oracle },
  }, NOW).view;
}

function scout(): CovenantView {
  const launch = NOW - 330 * DAY;
  const terms = { ...DEFAULT_TERMS, name: "Scout", symbol: "SCOUT", meta: "Lumen Analyst's first covenant: an on-chain research feed.", minRaise: 60, cap: 120, tapUsdPer30d: 9_000, agentId: 4127 };
  return simulate({
    ...FLAGSHIP_BASE, id: "scout", terms, issuer: { ...LUMEN_AGENT, outcomes: [] }, launch, committed: 188, contributors: 164, seed: 5, taxPerDay: 0.04,
    path: [{ day: 0, m: 1 }, { day: 40, m: 1.4 }, { day: 120, m: 1.8 }, { day: 160, m: 2.3 }, { day: 230, m: 2.5 }, { day: 300, m: 2.1 }, { day: 400, m: 2.0 }],
    revenue: [{ day: 60, amount: 0.3, note: "Agent revenue: research feed subscriptions" }, { day: 200, amount: 0.45, note: "Agent revenue: research feed subscriptions" }],
    killAt: null, declareAbandonedAt: null, atlasOutage: null, pumpDays: [], roundRedemptions: [], lowerTapTo: null,
    addresses: { launcher: A("0x2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d"), vault: A("0x5c0b2f6a1e8d4b9a7c3e1f0d2b4a6c8e0f1a2b3c"), token: A("0x8d0f2b4c6e8a0d2f4b6c8e0a2d4f6b8c0e2a7777"), pair: A("0x4f6b8d0a2c4e6f8b0d2a4c6e8f0b2d4a6c8e0f2b"), oracle: FLAGSHIP_BASE.addresses.oracle },
  }, NOW).view;
}

function fern(): CovenantView {
  const base = harbor();
  return {
    ...base, id: "fern", state: "FAILED", launcher: A("0x6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c"),
    terms: { ...base.terms, name: "Fern", symbol: "FERN", meta: "A game studio raise that missed its minimum. Every commitment refunds in full.", minRaise: 250, cap: 400 },
    issuer: { kind: "human", teamWallet: A("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"), name: "Fern Games", outcomes: [{ covenant: "FERN", outcome: "failed", at: NOW - 9 * DAY, detail: "Minimum missed, full refunds" }] },
    raise: { committed: 96.2, contributors: 58, deadline: NOW - 9 * DAY, finalized: true },
    events: [{ at: NOW - 9 * DAY, name: "Finalized", detail: "96.20 of a 250 BNB minimum. FAILED: every commitment refunds in full" }],
  };
}

let others: CovenantView[] | null = null;
export function otherCovenants(): CovenantView[] {
  if (!others) others = [scout(), harbor(), moss(), fern()];
  return others;
}

/** The book value a view implies, recomputed from its own fields (used to cross-check the sheet's header). */
export function viewBook(v: CovenantView): number {
  return bookValue(v.treasury, v.owedTeam, redeemableSupply(v.terms.totalSupply, v.deadTokens, v.lockedTeam));
}
