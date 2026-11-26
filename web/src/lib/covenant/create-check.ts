/*
 * The Create form's checks, one for one with what the launcher factory refuses (CovenantTermsLib.validate and
 * CovenantLauncherFactory._check), so a problem shows next to its field before anything is sent:
 *   - text: name 1..64 bytes, symbol 1..16 (the form keeps Flap's 2..10 capitals or digits), meta at most 512 bytes
 *   - split: sale >= 40%, pool >= 5% and <= sale, team <= 30%; tranches sum to the team share, each above 1x, <= 100x
 *   - raise: minimum > 0, cap >= minimum, cap <= 100,000 BNB; sale window inside the profile's bounds
 *   - Flap's floor: the pool seed of the minimum raise must clear Flap's floor with the factory's safety margin
 *   - tax: each rate <= 10%, the higher one >= 1%; it runs 30 days to 100 years and outlasts the anti-farmer window
 *   - rules: tap cap <= 10% a month; cliff, unlock window, exit streak, round, cooldown and heartbeat in the profile
 * The profile (the factory's time bounds) is read from the chain; the two built-in ones are CovenantProfiles.sol.
 * The name screen and the agent's ownership are the chain's to answer: the page runs the factory's own checkTerms.
 */
import { DAY } from "./time";
import type { Terms } from "./types";

export interface ProfileBounds {
  minSaleDuration: number;
  maxSaleDuration: number;
  minExitStreak: number;
  maxExitStreak: number;
  minRoundLength: number;
  minCooldown: number;
  minHeartbeat: number;
  maxHeartbeat: number;
  minUnlockWindow: number;
  maxCliff: number;
  antiFarmerDuration: number;
  requireGraduation: boolean;
}

/** CovenantProfiles.production() */
export const PRODUCTION_PROFILE: ProfileBounds = {
  minSaleDuration: 1 * DAY, maxSaleDuration: 30 * DAY, minExitStreak: 1 * DAY, maxExitStreak: 14 * DAY, minRoundLength: 3 * DAY,
  minCooldown: 1 * DAY, minHeartbeat: 14 * DAY, maxHeartbeat: 90 * DAY, minUnlockWindow: 7 * DAY, maxCliff: 730 * DAY,
  antiFarmerDuration: 1 * DAY, requireGraduation: true,
};

/** CovenantProfiles.demo(): the same rules with time in minutes */
export const DEMO_PROFILE: ProfileBounds = {
  minSaleDuration: 60, maxSaleDuration: 30 * DAY, minExitStreak: 60, maxExitStreak: 14 * DAY, minRoundLength: 60,
  minCooldown: 60, minHeartbeat: 60, maxHeartbeat: 90 * DAY, minUnlockWindow: 60, maxCliff: 730 * DAY,
  antiFarmerDuration: 1 * DAY, requireGraduation: false,
};

/** CovenantTermsLib's constants */
export const LIMITS = {
  minSupply: 1_000_000, maxSupply: 1_000_000_000_000, maxCap: 100_000, maxTranches: 8, maxMultiple: 10_000,
  maxTaxBps: 1_000, minTaxBps: 100, minTaxDuration: 30 * DAY, maxTaxDuration: 100 * 365 * DAY, maxTapCapBps: 1_000,
  maxExitFeeBps: 300, minSaleBps: 4_000, minPoolBps: 500, maxTeamBps: 3_000, maxRound: 90 * DAY, maxCooldown: 365 * DAY,
  maxUnlockWindow: 365 * DAY, maxTapUsd: 1e9, maxName: 64, maxSymbol: 16, maxMeta: 512,
} as const;

export type Field =
  | "name" | "symbol" | "meta" | "teamWallet" | "agentId"
  | "minRaise" | "cap" | "saleDuration"
  | "saleBps" | "poolBps" | "tranches" | "cliff" | "unlockWindow"
  | "tapUsdPer30d" | "tapCapBps" | "exitStreak" | "roundLength" | "cooldown" | "exitFeeBps" | "heartbeat" | "tax" | "taxDuration";

/** The step each field is on: 0 token and issuer, 1 raise, 2 supply and unlocks, 3 treasury rules. */
export const FIELD_STEP: Record<Field, number> = {
  name: 0, symbol: 0, meta: 0, teamWallet: 0, agentId: 0,
  minRaise: 1, cap: 1, saleDuration: 1,
  saleBps: 2, poolBps: 2, tranches: 2, cliff: 2, unlockWindow: 2,
  tapUsdPer30d: 3, tapCapBps: 3, exitStreak: 3, roundLength: 3, cooldown: 3, exitFeeBps: 3, heartbeat: 3, tax: 3, taxDuration: 3,
};

export interface Issue {
  field: Field;
  step: number;
  msg: string;
  /** a one-click change that clears it */
  fix?: { label: string; patch: Partial<Terms> };
}

/** Flap's floor for this split as the factory reports it (minRaiseFor). */
export interface FloorInput { minRaise: number; graduation: boolean; marginBps: number }

export interface CheckContext {
  profile: ProfileBounds;
  /** null while it is unknown (offline, or still reading) */
  floor: FloorInput | null;
  issuer: "agent" | "human";
  agentId: string;
  /** seconds per unit the form shows time in (60 on the demo factory, a day on production) */
  unit: number;
}

const bytes = (s: string) => new TextEncoder().encode(s).length;
const pctOf = (b: number) => `${+(b / 100).toFixed(2)}%`;

/** Round a BNB amount up to 4 decimals, so a suggested minimum is never under the floor it came from. */
export function ceilBnb(n: number): number {
  return Math.ceil(n * 10_000 - 1e-9) / 10_000;
}

/** Tranches rescaled to a new team share, keeping their proportions (the last one takes the rounding). */
export function rescaleTranches(trancheBps: number[], teamBps: number): number[] {
  if (teamBps <= 0) return [];
  const sum = trancheBps.reduce((a, b) => a + b, 0);
  if (trancheBps.length === 0 || sum <= 0) return [teamBps];
  const out = trancheBps.map((b) => Math.max(1, Math.round((b * teamBps) / sum)));
  out[out.length - 1] = teamBps - out.slice(0, -1).reduce((a, b) => a + b, 0);
  return out[out.length - 1]! > 0 ? out : [teamBps];
}

export function checkCreate(t: Terms, c: CheckContext): Issue[] {
  const out: Issue[] = [];
  const add = (field: Field, msg: string, fix?: Issue["fix"]) => out.push({ field, step: FIELD_STEP[field], msg, fix });
  const p = c.profile;
  const span = (s: number) => (c.unit === 60 ? `${+(s / 60).toFixed(2)} min` : `${+(s / DAY).toFixed(2)} days`);
  const range = (lo: number, hi: number) => `${span(lo)} to ${span(hi)}`;

  // token and issuer
  if (!t.name.trim()) add("name", "Name the token");
  else if (bytes(t.name) > LIMITS.maxName) add("name", `The name is at most ${LIMITS.maxName} bytes`);
  if (!/^[A-Z0-9]{2,10}$/.test(t.symbol)) add("symbol", "The symbol is 2 to 10 capital letters or digits");
  if (bytes(t.meta) > LIMITS.maxMeta) add("meta", `The description is at most ${LIMITS.maxMeta} bytes (${bytes(t.meta)} now)`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(t.teamWallet) || /^0x0{40}$/.test(t.teamWallet)) add("teamWallet", "The team wallet must be an address");
  if (c.issuer === "agent" && !(Number(c.agentId) > 0)) add("agentId", "An agent issuer needs its ERC-8004 agent id");

  // raise
  if (!(t.minRaise > 0)) add("minRaise", "Set a minimum raise above zero");
  if (t.cap < t.minRaise) add("cap", "The cap must be at least the minimum", t.minRaise > 0 ? { label: `Set the cap to ${+t.minRaise.toFixed(4)} BNB`, patch: { cap: t.minRaise } } : undefined);
  if (t.cap > LIMITS.maxCap) add("cap", `The cap is at most ${LIMITS.maxCap.toLocaleString("en-US")} BNB`);
  if (c.floor && t.minRaise > 0 && t.minRaise < c.floor.minRaise) {
    const need = ceilBnb(c.floor.minRaise);
    const margin = c.floor.marginBps > 10_000 ? ` with the factory's ${c.floor.marginBps / 10_000}x margin` : "";
    add("minRaise", `Flap's ${c.floor.graduation ? "graduation" : "launch"} floor${margin} needs a minimum raise of at least ${need} BNB at a ${pctOf(t.poolBps)} pool`,
      { label: `Use the minimum, ${need} BNB`, patch: { minRaise: need, cap: Math.max(t.cap, need) } });
  }
  if (t.saleDuration < p.minSaleDuration || t.saleDuration > p.maxSaleDuration) add("saleDuration", `The sale window runs ${range(p.minSaleDuration, p.maxSaleDuration)}`);

  // supply and unlocks
  const team = 10_000 - t.saleBps - t.poolBps;
  if (t.saleBps < LIMITS.minSaleBps) add("saleBps", "The sale share is at least 40%");
  if (t.poolBps < LIMITS.minPoolBps || t.poolBps > t.saleBps) add("poolBps", "The pool share runs from 5% up to the sale share");
  if (team < 0 || team > LIMITS.maxTeamBps) add("saleBps", "The team share is at most 30%");
  const sum = t.trancheBps.reduce((a, b) => a + b, 0);
  const n = t.trancheBps.length;
  if (team >= 0 && team <= LIMITS.maxTeamBps && sum !== team) {
    add("tranches", `The tranches add to ${pctOf(sum)}; the team share is ${pctOf(team)}`, { label: `Rescale them to ${pctOf(team)}`, patch: { trancheBps: rescaleTranches(t.trancheBps, team), trancheMultiple: rescaleMultiples(t.trancheBps, t.trancheMultiple, team) } });
  }
  if (n !== t.trancheMultiple.length || n > LIMITS.maxTranches || t.trancheBps.some((b) => b <= 0 && team > 0)) add("tranches", "Each tranche needs a share above zero");
  if (t.trancheMultiple.some((m) => m <= 100 || m > LIMITS.maxMultiple)) add("tranches", "Each tranche unlocks above 1x and at most 100x the sale price");
  if (t.cliff > p.maxCliff) add("cliff", `The cliff is at most ${span(p.maxCliff)}`);
  if (t.unlockWindow < p.minUnlockWindow || t.unlockWindow > LIMITS.maxUnlockWindow) add("unlockWindow", `The unlock window runs ${range(p.minUnlockWindow, LIMITS.maxUnlockWindow)}`);

  // treasury rules
  if (t.tapCapBps > LIMITS.maxTapCapBps) add("tapCapBps", "The tap cap is at most 10% of the treasury a month", { label: "Set it to 10%", patch: { tapCapBps: LIMITS.maxTapCapBps } });
  if (t.tapUsdPer30d > LIMITS.maxTapUsd) add("tapUsdPer30d", "The tap budget is at most $1B a month");
  if (t.exitStreak < p.minExitStreak || t.exitStreak > p.maxExitStreak) add("exitStreak", `The exit streak runs ${range(p.minExitStreak, p.maxExitStreak)}`);
  if (t.roundLength < p.minRoundLength || t.roundLength > LIMITS.maxRound) add("roundLength", `The exit round runs ${range(p.minRoundLength, LIMITS.maxRound)}`);
  if (t.cooldown < p.minCooldown || t.cooldown > LIMITS.maxCooldown) add("cooldown", `The cooldown runs ${range(p.minCooldown, LIMITS.maxCooldown)}`);
  if (t.exitFeeBps > LIMITS.maxExitFeeBps) add("exitFeeBps", "The exit fee is at most 3%", { label: "Set it to 3%", patch: { exitFeeBps: LIMITS.maxExitFeeBps } });
  if (t.heartbeat < p.minHeartbeat || t.heartbeat > p.maxHeartbeat) add("heartbeat", `The heartbeat runs ${range(p.minHeartbeat, p.maxHeartbeat)}`);
  if (t.buyTaxBps > LIMITS.maxTaxBps || t.sellTaxBps > LIMITS.maxTaxBps) add("tax", "Each tax rate is at most 10%");
  if (Math.max(t.buyTaxBps, t.sellTaxBps) < LIMITS.minTaxBps) add("tax", "The higher of the buy and sell tax must be at least 1%: Flap refuses less", { label: "Use 1% buy and sell", patch: { buyTaxBps: 100, sellTaxBps: 100 } });
  const tdMin = Math.max(LIMITS.minTaxDuration, p.antiFarmerDuration);
  if (t.taxDuration < tdMin || t.taxDuration > LIMITS.maxTaxDuration) add("taxDuration", "The tax runs from 30 days to 100 years");
  return out;
}

/** Multiples follow the tranche list when a rescale collapses it to one tranche. */
function rescaleMultiples(trancheBps: number[], trancheMultiple: number[], team: number): number[] {
  const next = rescaleTranches(trancheBps, team);
  return next.length === trancheMultiple.length ? trancheMultiple : next.length === 0 ? [] : [trancheMultiple[0] ?? 200];
}

/** The first issue for a field, for the message under it. */
export function issueFor(list: Issue[], field: Field): Issue | undefined {
  return list.find((x) => x.field === field);
}

/**
 * The question "Fill with Covenant AI" sends: the form as it stands, in words, and what is still wrong. Ask AI answers
 * with draft_covenant (the factory's checkTerms, Flap's floor) and a create card whose Edit link opens this page
 * pre-filled with its draft.
 */
export function askToFill(t: Terms, o: { issuer: "agent" | "human"; agentId: string; factory: "demo" | "production"; unit: number; problems: string[] }): string {
  const time = (s: number) => (o.unit === 60 ? `${+(s / 60).toFixed(2)} minutes` : `${+(s / DAY).toFixed(2)} days`);
  const team = 10_000 - t.saleBps - t.poolBps;
  const lines = [
    "Help me finish the covenant I am writing on the Create page, then draft it with draft_covenant so it passes the factory's checkTerms and Flap's floor.",
    "What I have so far:",
    `- Token: ${t.name.trim() ? `"${t.name.trim()}"` : "name not chosen yet"}, ${t.symbol ? `symbol ${t.symbol}` : "symbol not chosen yet"}${t.meta.trim() ? `; what it does: ${t.meta.trim().slice(0, 240)}` : ""}`,
    `- Issuer: ${o.issuer === "agent" ? (Number(o.agentId) > 0 ? `AI agent #${o.agentId}` : "an AI agent (no ERC-8004 id yet)") : "a human team"}${/^0x[0-9a-fA-F]{40}$/.test(t.teamWallet) ? `, team wallet ${t.teamWallet}` : ""}`,
    `- Factory: ${o.factory === "demo" ? "demo timers (minutes)" : "production (days)"}`,
    `- Raise: ${+t.minRaise.toFixed(4)} BNB minimum, ${+t.cap.toFixed(4)} BNB cap, sale window ${time(t.saleDuration)}`,
    `- Split: ${t.saleBps / 100}% sale, ${t.poolBps / 100}% pool, ${team / 100}% team in tranches ${t.trancheBps.map((b, k) => `${b / 100}% at ${(t.trancheMultiple[k] ?? 0) / 100}x`).join(", ")}`,
    `- Treasury: tap $${t.tapUsdPer30d.toLocaleString("en-US")} per 30 days capped at ${t.tapCapBps / 100}% of the treasury, exit fee ${t.exitFeeBps / 100}%, tax ${t.buyTaxBps / 100}% buy and ${t.sellTaxBps / 100}% sell`,
  ];
  if (o.problems.length) lines.push(`Still to fix: ${o.problems.join("; ")}.`);
  lines.push("Suggest anything missing, keep what I chose unless it breaks a rule, and explain any change in one line.");
  return lines.join("\n");
}
