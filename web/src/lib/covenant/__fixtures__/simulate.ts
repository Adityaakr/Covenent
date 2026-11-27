/*
 * A deterministic, hour-by-hour run of one covenant under the five rules. The mock data layer is this simulation,
 * not hand-typed numbers: every treasury figure, streak and ledger row on a mock screen is what the rules in
 * math.ts produce from a price path. The flagship run is calibrated so the doc's demo numbers come out exactly:
 * a 1,400 BNB raise against a 500 BNB cap, a 375 BNB treasury, and 320 BNB in the vault when the exit round opens,
 * so 6M tokens redeem for 2.534 BNB.
 */
import { DEFAULT_TERMS } from "../defaults";
import {
  accrueTap, bookValue, premium, redeemQuote, redeemableSupply, settleRaise, split, stepExitStreak, stepTranche,
} from "../math";
import { DAY, HOUR } from "../time";
import type { Address, Band, CovenantState, CovenantView, FeedEvent, Hash, Issuer, LedgerRow, PricePoint, Terms, Tranche } from "../types";

export interface Knot { day: number; m: number }

export interface SimConfig {
  id: string;
  terms: Terms;
  issuer: Issuer;
  launch: number;
  committed: number;
  contributors: number;
  path: Knot[]; // price as a multiple of the sale price, before the market reacts to book value
  taxPerDay: number; // BNB of tax per day at a 1x price, scaled by price and taxScale
  taxScale: number;
  revenue: { day: number; amount: number; note: string }[];
  killAt: number | null; // the issuer agent stops (unix seconds)
  declareAbandonedAt: number | null; // someone presses the switch once it is due
  windDownAt?: number | null; // voluntary close
  atlasOutage: [number, number] | null; // days since launch with no fresh Atlas report
  pumpDays: number[]; // a one-hour push above book at these days (fix 1 demo)
  roundRedemptions: { afterHours: number; tokens: number }[];
  lowerTapTo: number | null; // the agent's pay cut when price nears book
  seed: number;
  addresses: { launcher: Address; vault: Address; token: Address; pair: Address; oracle: Address };
}

export interface SimResult {
  view: CovenantView;
  roundOpenedAt: number | null;
  heartbeatDueAt: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

export function hexFrom(seed: number, len = 64): `0x${string}` {
  const r = rng(seed * 2654435761);
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(r() * 16).toString(16);
  return `0x${out}`;
}

function interp(path: Knot[], day: number): number {
  if (day <= path[0]!.day) return path[0]!.m;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    if (day <= b.day) return a.m + ((b.m - a.m) * (day - a.day)) / (b.day - a.day);
  }
  return path[path.length - 1]!.m;
}

const STEP = HOUR;
/** The issuer loop claims once at least this much tap has accrued (otherwise it just sends a heartbeat). */
const MIN_CLAIM = 5;
/** A period's report is due this long after the period ends. */
const REPORT_GRACE = 2 * DAY;

export function simulate(cfg: SimConfig, until: number): SimResult {
  const { terms } = cfg;
  const S = terms.totalSupply;
  const sp = split(S, terms.saleBps, terms.poolBps);
  const raise = settleRaise(cfg.committed, terms.minRaise, terms.cap, sp);
  const p0 = raise.salePrice;
  const k = raise.qPool * sp.P;
  const r = rng(cfg.seed);
  let txSeed = cfg.seed * 1000;
  const tx = (): Hash => hexFrom(++txSeed) as Hash;

  let state: CovenantState = "ACTIVE";
  let T = raise.T0;
  let owed = 0;
  let dead = 0;
  let locked = sp.E;
  let streak = 0;
  let roundEnd: number | null = null;
  let cooldownEnd: number | null = null;
  let roundOpenedAt: number | null = null;
  let lastHeartbeat = cfg.launch;
  let lastClaim: number | null = null;
  let tapUsd = terms.tapUsdPer30d;
  let lowered = false;
  let usdSalePrice = 0;
  let taxPending = 0;
  let noise = 0;
  let lastAtlas = cfg.launch;
  let reports = 0;
  let lastReportUri: string | undefined;
  let lastPrice = p0;
  let lastBnbUsd = 600;
  let lastStrict = true;
  let pumpedAt: number | null = null;
  const tranches: (Tranche & { best: number })[] = terms.trancheBps.map((bps, i) => ({ bps, multiple: terms.trancheMultiple[i]!, progress: 0, unlocked: false, best: 0 }));
  const ledger: LedgerRow[] = [{ kind: "raise", at: cfg.launch, amount: raise.T0, tx: tx(), note: `Treasury share of a ${fmt(raise.Q)} BNB raise (${fmt(raise.qPool)} BNB seeded the pool)` }];
  const events: FeedEvent[] = [
    { at: cfg.launch - 60, name: "Finalized", detail: `${fmt(cfg.committed)} BNB committed, ${fmt(raise.Q)} accepted, ${fmt(raise.refunded)} refundable`, tx: tx() },
    { at: cfg.launch, name: "TreasuryFunded", detail: `${fmt(raise.T0)} BNB into the vault`, tx: tx() },
  ];
  const history: PricePoint[] = [];
  const bands: Band[] = [];
  const claims: { at: number; amount: number }[] = [];
  const redemptionsDone = new Set<number>();
  const revenueDone = new Set<number>();
  let outcome: Issuer["outcomes"][number] | null = null;

  const end = Math.max(cfg.launch, until);
  for (let t = cfg.launch + STEP; t <= end; t += STEP) {
    const day = (t - cfg.launch) / DAY;
    const alive = cfg.killAt === null || t < cfg.killAt;

    // Time-based state changes (_tick)
    if (state === "EXIT_ROUND" && roundEnd !== null && t >= roundEnd) {
      state = "COOLDOWN";
      cooldownEnd = t + terms.cooldown;
      bands.push({ from: roundEnd, to: cooldownEnd, kind: "cooldown" });
      events.push({ at: t, name: "ExitRoundClosed", detail: `Round closed. Cooldown until the trigger re-arms (${Math.round(terms.cooldown / DAY)} days)`, tx: tx() });
    }
    if (state === "COOLDOWN" && cooldownEnd !== null && t >= cooldownEnd) {
      state = "ACTIVE";
      streak = 0;
    }

    // Trading tax accrues in the token's processor and is dispatched weekly (_sync on receipt)
    const m0 = interp(cfg.path, day);
    taxPending += (cfg.taxPerDay * cfg.taxScale * Math.max(0.2, m0) * (0.6 + 0.8 * r())) / 24;
    if (Math.round((t - cfg.launch) / STEP) % 168 === 100 && taxPending > 0 && state !== "WIND_DOWN") {
      T += taxPending;
      ledger.push({ kind: "tax", at: t, amount: taxPending, tx: tx(), note: "Trading tax dispatched to the vault" });
      events.push({ at: t, name: "RevenueRecognized", detail: `${fmt(taxPending, 3)} BNB trading tax`, tx: tx() });
      taxPending = 0;
    }

    // Revenue the issuer routes to the vault (agent layer, revenue scene)
    cfg.revenue.forEach((rv, i) => {
      if (!revenueDone.has(i) && day >= rv.day && alive && state !== "WIND_DOWN") {
        revenueDone.add(i);
        T += rv.amount;
        ledger.push({ kind: "revenue", at: t, amount: rv.amount, tx: tx(), note: rv.note });
        events.push({ at: t, name: "RevenueRecognized", detail: `${fmt(rv.amount, 2)} BNB issuer revenue: ${rv.note}`, tx: tx() });
      }
    });

    // The market: a price path until the exit is live, then arbitrage against book value
    const R = redeemableSupply(S, dead, locked);
    const book = bookValue(T, owed, R);
    noise = noise * 0.92 + (r() - 0.5) * 0.06;
    let price = p0 * m0 * (1 + noise);
    if (state === "EXIT_ROUND") price = book * (0.99 + 0.02 * r());
    else if (state === "COOLDOWN" || (roundOpenedAt !== null && state === "ACTIVE")) price = book * (1.02 + 0.05 * r());
    else if (state === "WIND_DOWN") price = book * (0.995 + 0.01 * r());
    const pumped = cfg.pumpDays.some((d) => Math.abs(day - d) < 0.5 / 24);
    if (pumped && state === "ACTIVE") { price = book * 1.12; pumpedAt = t; }
    const bnbUsd = 600 + 22 * Math.sin(day / 9) + (r() - 0.5) * 6;

    // The keeper pokes hourly. Exit gate: on-chain numbers only. Strict gate: Atlas fresh and pool depth.
    const outage = cfg.atlasOutage !== null && day >= cfg.atlasOutage[0] && day < cfg.atlasOutage[1];
    if (!outage) lastAtlas = t;
    const poolBnb = Math.sqrt(k * price);
    const deep = poolBnb >= raise.qPool / 2;
    const strict = !outage && deep;
    lastStrict = strict;
    lastPrice = price;
    if (strict) lastBnbUsd = bnbUsd;

    if (state === "ACTIVE" || state === "COOLDOWN") {
      if (strict) owed += accrueTap(STEP, tapUsd, bnbUsd, T, terms.tapCapBps);
    }
    if (strict && usdSalePrice === 0) usdSalePrice = p0 * bnbUsd;
    if (strict && state !== "WIND_DOWN") {
      const usd = price * bnbUsd;
      for (const tr of tranches) {
        if (tr.unlocked) continue;
        tr.progress = stepTranche(tr.progress, STEP, usd, usdSalePrice, tr.multiple);
        tr.best = Math.max(tr.best, tr.progress);
        if (tr.progress >= terms.unlockWindow && t - cfg.launch >= terms.cliff) {
          tr.unlocked = true;
          const amt = (S * tr.bps) / 10_000;
          locked -= amt;
          events.push({ at: t, name: "TrancheUnlocked", detail: `${fmtTok(amt)} team tokens at ${tr.multiple / 100}x held for ${Math.round(terms.unlockWindow / DAY)} trusted days`, tx: tx() });
          outcome = { covenant: terms.symbol, outcome: "unlocked", at: t, detail: `${tr.multiple / 100}x tranche unlocked`, vault: cfg.addresses.vault };
        }
      }
    }
    if (state === "ACTIVE") {
      const before = streak;
      streak = stepExitStreak(streak, STEP, price, book);
      if (pumped && before > 0) events.push({ at: t, name: "Observed", detail: `Trusted hour above book: streak ${dur(before)} → ${dur(streak)}. It decays, it never resets`, tx: tx() });
      if (streak >= terms.exitStreak) {
        state = "EXIT_ROUND";
        roundOpenedAt = t;
        roundEnd = t + terms.roundLength;
        bands.push({ from: t, to: roundEnd, kind: "round" });
        events.push({ at: t, name: "ExitRoundOpened", detail: `Pool traded below book for ${Math.round(terms.exitStreak / DAY)} trusted days. Redemption open at book until the round ends`, tx: tx() });
        streak = 0;
      }
    }
    if (outage && Math.abs(day - cfg.atlasOutage![0]) < 0.5 / 24) events.push({ at: t, name: "Observed", detail: "Atlas report stale: dollar tap and unlock counters freeze. The exit streak keeps counting on pool price and book value", tx: tx() });

    if (Math.round((t - cfg.launch) / STEP) % 2 === 0 || until - t < 4 * DAY) history.push({ t, price, book });

    // Holders redeem during the round
    if (state === "EXIT_ROUND" && roundOpenedAt !== null) {
      cfg.roundRedemptions.forEach((rd, i) => {
        if (!redemptionsDone.has(i) && t >= roundOpenedAt! + rd.afterHours * HOUR) {
          redemptionsDone.add(i);
          const b = bookValue(T, owed, redeemableSupply(S, dead, locked));
          const q = redeemQuote(rd.tokens, b, terms.exitFeeBps, false);
          T -= q.out;
          dead += rd.tokens;
          ledger.push({ kind: "redeem", at: t, amount: -q.out, tx: tx(), note: `${fmtTok(rd.tokens)} tokens burned at book` });
          events.push({ at: t, name: "Redeemed", detail: `${fmtTok(rd.tokens)} tokens for ${fmt(q.out, 3)} BNB`, tx: tx() });
        }
      });
    }

    // The issuer agent loop: every 48 hours, and once right after a round opens
    const tick = Math.round((t - cfg.launch) / STEP) % 48 === 7 || (roundOpenedAt === t - STEP);
    if (alive && tick && state !== "WIND_DOWN") {
      if (owed > MIN_CLAIM || (roundOpenedAt === t - STEP && owed > 0)) {
        T -= owed;
        ledger.push({ kind: "tap", at: t, amount: -owed, tx: tx(), note: "Tap claimed by the issuer (compute budget)" });
        events.push({ at: t, name: "TapClaimed", detail: `${fmt(owed, 3)} BNB to the team wallet`, tx: tx() });
        claims.push({ at: t, amount: owed });
        lastClaim = t;
        owed = 0;
      } else {
        events.push({ at: t, name: "Heartbeat", detail: "Issuer heartbeat", tx: tx() });
      }
      lastHeartbeat = t;
      if (cfg.lowerTapTo !== null && !lowered && state === "ACTIVE" && premium(price, book) < 0.25) {
        lowered = true;
        events.push({ at: t, name: "TapLowered", detail: `Issuer cut its own budget from $${tapUsd.toLocaleString("en-US")} to $${cfg.lowerTapTo.toLocaleString("en-US")} per 30 days to protect the floor`, tx: tx() });
        tapUsd = cfg.lowerTapTo;
      }
    }
    // Monthly report (rule 5)
    if (alive && state !== "WIND_DOWN" && Math.round((t - cfg.launch) / STEP) % (30 * 24) === 24 && t - cfg.launch > 30 * DAY) {
      reports++;
      lastReportUri = `ipfs://covenant-report-${terms.symbol.toLowerCase()}-${reports}`;
      events.push({ at: t, name: "ReportPosted", detail: `Period ${reports} report posted with its hash`, tx: tx() });
      lastHeartbeat = t;
    }

    // Abandonment switch or voluntary wind-down
    const due = t > lastHeartbeat + terms.heartbeat;
    const declare = cfg.declareAbandonedAt !== null && t >= cfg.declareAbandonedAt && due;
    const vol = cfg.windDownAt != null && t >= cfg.windDownAt;
    if ((declare || vol) && state !== "WIND_DOWN") {
      if (declare) owed = 0; // unclaimed tap forfeited to the treasury
      const burned = locked;
      dead += locked;
      locked = 0;
      state = "WIND_DOWN";
      events.push({ at: t, name: "WoundDown", detail: declare ? `Declared abandoned after ${Math.round((t - lastHeartbeat) / DAY)} silent days. ${fmtTok(burned)} locked team tokens burned, redemption open with no fee` : "Issuer closed the covenant. Redemption open with no fee", tx: tx() });
      outcome = { covenant: terms.symbol, outcome: declare ? "abandoned" : "wound-down", at: t, detail: declare ? "Abandoned: treasury opened to holders" : "Wound down by the issuer", vault: cfg.addresses.vault };
      if (cfg.issuer.kind === "agent") events.push({ at: t, name: "OutcomeRecorded", detail: `ERC-8004 feedback for agent #${cfg.issuer.agentId}: ${declare ? "abandoned" : "wound-down"}`, tx: tx() });
    }
  }

  const R = redeemableSupply(S, dead, locked);
  const now = end;
  const periodStart = now - 30 * DAY;
  const reportsDue = Math.max(0, Math.floor((now - cfg.launch - REPORT_GRACE) / (30 * DAY)));
  const issuer: Issuer = { ...cfg.issuer, outcomes: [...cfg.issuer.outcomes] };
  const cur = outcome as Issuer["outcomes"][number] | null;
  issuer.outcomes.push(cur ?? { covenant: terms.symbol, outcome: "active", at: cfg.launch, detail: "This covenant", vault: cfg.addresses.vault });
  if (cfg.killAt !== null && now >= cfg.killAt) issuer.lastAction = { at: Math.min(cfg.killAt, lastHeartbeat), what: "Process stopped. No heartbeat since" };
  else issuer.lastAction = { at: lastHeartbeat, what: lastClaim === lastHeartbeat ? "Claimed tap" : "Heartbeat" };

  const strictGate = [
    { label: "Atlas BNB/USD report verifies and is fresh", pass: lastStrict || now - lastAtlas <= 180, detail: now - lastAtlas <= HOUR ? `Age ${Math.min(180, Math.round(60 + r() * 100))} s, max 180 s` : `Last fresh report ${dur(now - lastAtlas)} ago` },
    { label: "Report timestamp newer than the last accepted", pass: true, detail: "Monotonic per vault" },
    { label: "Pool BNB at least half the launch seed", pass: Math.sqrt(k * lastPrice) >= raise.qPool / 2, detail: `${fmt(Math.sqrt(k * lastPrice))} of ${fmt(raise.qPool / 2)} BNB` },
    { label: "Pool and Atlas token price agree within 10%", pass: null, detail: "No Atlas token feed configured yet" },
    { label: "Atlas status accepted", pass: null, detail: "Status not readable on-chain yet" },
  ];
  const exitGate = [
    { label: "Pool TWAP read from the pair's cumulative price", pass: true, detail: "On-chain, end-of-block prices only" },
    { label: "Book value read from the vault's balance and supply", pass: true, detail: "On-chain, no oracle" },
    { label: "No pool-depth requirement", pass: true, detail: "A crash is when holders need the exit, so depth never freezes it" },
    { label: "No Atlas requirement", pass: true, detail: "An Atlas outage never delays the exit" },
  ];

  const view: CovenantView = {
    id: cfg.id,
    source: "mock",
    chainId: 31337,
    ...cfg.addresses,
    launchBlock: 1,
    state,
    terms,
    issuer,
    raise: { committed: cfg.committed, contributors: cfg.contributors, deadline: cfg.launch - 60, finalized: true, launchedAt: cfg.launch },
    treasury: T,
    owedTeam: owed,
    deadTokens: dead,
    lockedTeam: locked,
    poolPrice: lastPrice,
    poolBnb: Math.sqrt(k * lastPrice),
    poolSeedBnb: raise.qPool,
    tap: { accrued: owed, claimedThisPeriod: claims.filter((c) => c.at >= periodStart).reduce((a, c) => a + c.amount, 0), lastClaim },
    tranches: tranches.map(({ best, ...t }) => ({ ...t, bestRun: best })),
    exit: { streak, roundEndsAt: state === "EXIT_ROUND" ? roundEnd : null, cooldownEndsAt: state === "COOLDOWN" ? cooldownEnd : null },
    lastHeartbeat,
    disclosure: { passed: reports, due: reportsDue, nextDueAt: cfg.launch + (reportsDue + 1) * 30 * DAY + REPORT_GRACE, lastUri: lastReportUri },
    trust: { lastPoke: now, bnbUsd: lastBnbUsd, bnbUsdAt: lastAtlas, exitGate, strictGate, poolOnlyMode: now - lastAtlas > 14 * DAY },
    ledger,
    history,
    bands: bands.map((b) => ({ ...b, to: Math.min(b.to, now) })),
    events: events.sort((a, b) => b.at - a.at),
    now,
  };
  void R;
  void pumpedAt;
  return { view, roundOpenedAt, heartbeatDueAt: lastHeartbeat + terms.heartbeat };
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtTok(n: number) {
  return n >= 1e6 ? `${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : n.toLocaleString("en-US");
}
function dur(s: number) {
  const d = Math.floor(s / DAY), h = Math.round((s % DAY) / HOUR);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

export { DEFAULT_TERMS };
