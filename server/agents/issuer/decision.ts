import Anthropic from '@anthropic-ai/sdk';
import { keccak256, toBytes, type Hex } from 'viem';

/**
 * The issuer agent's periodic decision: whether to claim its tap, cut its own pay, or send a heartbeat. Claude
 * (ANTHROPIC_API_KEY) proposes a plan with its reasoning; the fixed policy then bounds it: it can only claim what the
 * vault says is claimable, only lower the tap within the policy's floor, and it cannot skip a heartbeat that is due.
 * Without a key, or when the call fails, the fixed rules decide and the record says why.
 *
 * Each decision the agent acts on is posted on-chain as a report on its vault: postReport(period, uri, hash) with
 * uri = data:application/json;base64,<record> and hash = keccak256(record JSON), so anyone (the web app on Vercel
 * included) can read the reasoning from the chain alone and check it against its hash. postReport from the team wallet
 * is also a heartbeat. Format v1, decoded by web/src/lib/chain/decisions.ts:
 *   { v: 1, kind: "covenant.decision", action, reason, author, inputs, tx?, at }
 */

export const DECISION_KIND = 'covenant.decision';

export interface DecisionOptions {
  /** the tap can be claimed now */
  claim: { accruedWei: string } | null;
  /** a heartbeat is due (required) or allowed */
  heartbeat: { ageSeconds: number; windowSeconds: number | null; required: boolean } | null;
  /** the tap can be lowered this period, to a value in [minUsd, currentUsd) */
  lowerTap: { currentUsd: number; minUsd: number; ruleSuggestsUsd: number | null } | null;
}

export interface DecisionFacts {
  state: string;
  period: number;
  treasuryBnb: number;
  bookValueBnb: number | null;
  poolPriceBnb: number | null;
  premiumToBookPct: number | null;
  tapUsdPer30d: number | null;
  tapCapBps: number | null;
  exitStreakSeconds: number | null;
  exitTargetSeconds: number | null;
  revenueForwardedThisPeriodBnb: number;
  usdcRevenue: { balance: number; sinceLastTick: number } | null;
}

export interface Plan {
  claimTap: boolean;
  heartbeat: boolean;
  lowerTapToUsd: number | null;
  reason: string;
}

export type Author = { kind: 'llm'; model: string } | { kind: 'rule'; why: string };

export interface Decision extends Plan {
  author: Author;
  /** where the policy changed the model's plan, in plain words */
  overrides: string[];
}

export interface DecisionRecord {
  v: 1;
  kind: typeof DECISION_KIND;
  action: string;
  reason: string;
  author: Author;
  inputs: Record<string, unknown>;
  tx?: string;
  at: number;
}

/** Nothing to decide: no claim, no cut, no heartbeat due. The model is not called and nothing is posted. */
export function nothingToDecide(o: DecisionOptions): boolean {
  return !o.claim && !o.lowerTap && !(o.heartbeat?.required ?? false);
}

/** The fixed rules (docs/DESIGN.md "Issuer agent loop"): claim when claimable, cut when the policy says, beat when due. */
export function ruleDecision(o: DecisionOptions, facts: DecisionFacts, why: string): Decision {
  const claimTap = Boolean(o.claim);
  const lowerTapToUsd = o.lowerTap?.ruleSuggestsUsd ?? null;
  const heartbeat = Boolean(o.heartbeat?.required) && !claimTap && lowerTapToUsd === null;
  const parts = [
    claimTap ? `Claimed the accrued tap as this period's compute budget.` : null,
    lowerTapToUsd !== null ? `The pool is ${facts.premiumToBookPct?.toFixed(1)}% against book, at or under the pay-cut line, so the tap goes from $${o.lowerTap!.currentUsd} to $${lowerTapToUsd} per 30 days to protect the floor.` : null,
    heartbeat ? `Last team action ${o.heartbeat!.ageSeconds}s ago: a heartbeat keeps the abandonment switch closed.` : null,
  ].filter(Boolean);
  return { claimTap, heartbeat, lowerTapToUsd, reason: parts.join(' ') || 'Nothing to do.', author: { kind: 'rule', why }, overrides: [] };
}

/** Bound a proposed plan by what the vault and the policy allow. */
export function boundPlan(p: Plan, o: DecisionOptions): { plan: Plan; overrides: string[] } {
  const overrides: string[] = [];
  let { claimTap, heartbeat, lowerTapToUsd } = p;
  if (claimTap && !o.claim) { claimTap = false; overrides.push('nothing claimable, claim dropped'); }
  if (lowerTapToUsd !== null) {
    const lt = o.lowerTap;
    if (!lt) { lowerTapToUsd = null; overrides.push('no tap cut allowed this period'); }
    else if (!(lowerTapToUsd < lt.currentUsd)) { lowerTapToUsd = null; overrides.push('the tap can only go down'); }
    else if (lowerTapToUsd < lt.minUsd) { overrides.push(`cut raised to the policy floor $${lt.minUsd}`); lowerTapToUsd = lt.minUsd; }
    else lowerTapToUsd = Math.round(lowerTapToUsd);
  }
  if (heartbeat && !o.heartbeat) { heartbeat = false; overrides.push('heartbeat not allowed in this state'); }
  // claimTap and lowerTap are heartbeats themselves; a due heartbeat is never skipped
  if (o.heartbeat?.required && !claimTap && lowerTapToUsd === null && !heartbeat) { heartbeat = true; overrides.push('heartbeat was due: sent anyway'); }
  return { plan: { claimTap, heartbeat, lowerTapToUsd, reason: p.reason }, overrides };
}

const SYSTEM = `You are the issuer agent of a token project. You hold the team wallet of a Covenant vault on BNB Chain and live on its tap: a dollar budget per 30 days, capped as a share of the treasury, that you may only ever lower. Each tick you decide three things:
- claim_tap: claim the accrued tap now (your compute budget). Claiming lowers the treasury and book value by what you take.
- lower_tap_to_usd: cut your own pay permanently (null for no cut). Holders can redeem at book if the pool trades under book long enough, so a cut protects the floor when the pool is close to book. Never below the floor you are given.
- heartbeat: prove you are alive. If you go silent past the heartbeat window anyone can open the treasury to holders. A claim or a cut also counts.
Decide like a careful operator: claim when you need budget and the treasury can take it, cut when the pool is near or under book, keep the covenant alive. Use only the numbers given. The vault enforces every rule; you cannot change them. Your reason is posted on-chain for holders: one or two plain sentences that cite the numbers, no hype, no promises.`;

const SCHEMA = {
  type: 'object',
  properties: {
    claim_tap: { type: 'boolean' },
    heartbeat: { type: 'boolean' },
    lower_tap_to_usd: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    reason: { type: 'string' },
  },
  required: ['claim_tap', 'heartbeat', 'lower_tap_to_usd', 'reason'],
  additionalProperties: false,
} as const;

export class Decider {
  private client: Anthropic | null;
  constructor(
    apiKey: string | undefined,
    readonly model = 'claude-opus-5-5',
    client?: Anthropic,
  ) {
    this.client = client ?? (apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 }) : null);
  }

  get usesLlm(): boolean {
    return this.client !== null;
  }

  async decide(o: DecisionOptions, facts: DecisionFacts): Promise<Decision> {
    if (!this.client) return ruleDecision(o, facts, 'ANTHROPIC_API_KEY not set');
    try {
      const res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 4000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: `Options the vault allows this tick:\n${JSON.stringify(o)}\n\nCovenant status:\n${JSON.stringify(facts)}` }],
      });
      if (res.stop_reason === 'refusal') throw new Error('model declined');
      const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
      const j = JSON.parse(text) as { claim_tap?: unknown; heartbeat?: unknown; lower_tap_to_usd?: unknown; reason?: unknown };
      const proposed: Plan = {
        claimTap: j.claim_tap === true,
        heartbeat: j.heartbeat === true,
        lowerTapToUsd: typeof j.lower_tap_to_usd === 'number' && Number.isFinite(j.lower_tap_to_usd) ? j.lower_tap_to_usd : null,
        reason: typeof j.reason === 'string' && j.reason.trim() ? j.reason.trim().slice(0, 600) : 'No reason given.',
      };
      const { plan, overrides } = boundPlan(proposed, o);
      return { ...plan, author: { kind: 'llm', model: res.model }, overrides };
    } catch (e) {
      const why =
        e instanceof Anthropic.AuthenticationError
          ? 'Claude API key rejected'
          : e instanceof Anthropic.RateLimitError
            ? 'Claude API rate limited'
            : e instanceof Anthropic.APIError
              ? `Claude API error ${e.status}`
              : `Claude API unavailable (${(e as Error).message.slice(0, 80)})`;
      return ruleDecision(o, facts, why);
    }
  }
}

/** The action label for a record: what the agent did, in the order it did it. */
export function actionLabel(d: Pick<Plan, 'claimTap' | 'heartbeat' | 'lowerTapToUsd'>): string {
  const a = [d.claimTap ? 'claim_tap' : null, d.lowerTapToUsd !== null ? 'lower_tap' : null, d.heartbeat ? 'heartbeat' : null].filter(Boolean);
  return a.length ? a.join('+') : 'wait';
}

/** The on-chain form of a decision: a data URI and the keccak256 of its JSON. */
export function encodeDecision(r: DecisionRecord): { uri: string; hash: Hex; json: string } {
  const json = JSON.stringify(r);
  return { uri: `data:application/json;base64,${Buffer.from(json, 'utf8').toString('base64')}`, hash: keccak256(toBytes(json)), json };
}

export function decodeDecision(uri: string): DecisionRecord | null {
  const m = uri.match(/^data:application\/json;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  try {
    const r = JSON.parse(Buffer.from(m[1]!, 'base64').toString('utf8')) as DecisionRecord;
    return r.kind === DECISION_KIND ? r : null;
  } catch {
    return null;
  }
}
