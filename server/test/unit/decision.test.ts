import type Anthropic from '@anthropic-ai/sdk';
import { keccak256, toBytes } from 'viem';
import { describe, expect, it } from 'vitest';
import { actionLabel, boundPlan, Decider, decodeDecision, encodeDecision, nothingToDecide, ruleDecision, type DecisionFacts, type DecisionOptions } from '../../agents/issuer/decision.js';

const facts: DecisionFacts = {
  state: 'ACTIVE', period: 1, treasuryBnb: 10, bookValueBnb: 1e-8, poolPriceBnb: 1.05e-8, premiumToBookPct: 5, tapUsdPer30d: 30_000, tapCapBps: 400,
  exitStreakSeconds: 0, exitTargetSeconds: 180, revenueForwardedThisPeriodBnb: 0, usdcRevenue: { balance: 50, sinceLastTick: 25 },
};
const opts: DecisionOptions = {
  claim: { accruedWei: '1000000000000000' },
  heartbeat: { ageSeconds: 30, windowSeconds: 600, required: false },
  lowerTap: { currentUsd: 30_000, minUsd: 5_000, ruleSuggestsUsd: 24_000 },
};

function mockClient(reply: unknown, opts: { refuse?: boolean; throws?: Error } = {}) {
  const calls: unknown[] = [];
  const client = {
    beta: {
      messages: {
        create: async (req: unknown) => {
          calls.push(req);
          if (opts.throws) throw opts.throws;
          return { model: 'claude-opus-5-5', stop_reason: opts.refuse ? 'refusal' : 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }] };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe('issuer decisions', () => {
  it('skips the model when there is nothing to decide', () => {
    expect(nothingToDecide({ claim: null, lowerTap: null, heartbeat: { ageSeconds: 5, windowSeconds: 600, required: false } })).toBe(true);
    expect(nothingToDecide({ ...opts, claim: null, lowerTap: null, heartbeat: { ageSeconds: 500, windowSeconds: 600, required: true } })).toBe(false);
  });

  it('fixed rules: claim and cut together, no separate heartbeat', () => {
    const d = ruleDecision(opts, facts, 'ANTHROPIC_API_KEY not set');
    expect(d).toMatchObject({ claimTap: true, lowerTapToUsd: 24_000, heartbeat: false, author: { kind: 'rule', why: 'ANTHROPIC_API_KEY not set' } });
    expect(actionLabel(d)).toBe('claim_tap+lower_tap');
  });

  it('bounds a proposed plan by the policy', () => {
    expect(boundPlan({ claimTap: true, heartbeat: false, lowerTapToUsd: 1_000, reason: 'x' }, { ...opts, claim: null })).toEqual({
      plan: { claimTap: false, heartbeat: false, lowerTapToUsd: 5_000, reason: 'x' },
      overrides: ['nothing claimable, claim dropped', 'cut raised to the policy floor $5000'],
    });
    expect(boundPlan({ claimTap: false, heartbeat: false, lowerTapToUsd: 40_000, reason: 'x' }, opts).plan.lowerTapToUsd).toBeNull();
    const due = { ...opts, claim: null, lowerTap: null, heartbeat: { ageSeconds: 300, windowSeconds: 600, required: true } };
    expect(boundPlan({ claimTap: false, heartbeat: false, lowerTapToUsd: null, reason: 'x' }, due)).toMatchObject({ plan: { heartbeat: true }, overrides: ['heartbeat was due: sent anyway'] });
  });

  it('asks Claude for a structured plan and keeps its reasoning', async () => {
    const { client, calls } = mockClient({ claim_tap: false, heartbeat: false, lower_tap_to_usd: 20_000.4, reason: 'Pool is 5% over book; cutting to $20k protects the floor.' });
    const d = await new Decider('k', 'claude-opus-5-5', client).decide(opts, facts);
    expect(d).toMatchObject({ claimTap: false, lowerTapToUsd: 20_000, author: { kind: 'llm', model: 'claude-opus-5-5' }, reason: 'Pool is 5% over book; cutting to $20k protects the floor.' });
    const req = calls[0] as { model: string; output_config: { format: { type: string } }; messages: { content: string }[] };
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.output_config.format.type).toBe('json_schema');
    expect(req.messages[0]!.content).toContain('"usdcRevenue"');
  });

  it('falls back to the rules when Claude refuses or fails, and says why', async () => {
    const refused = await new Decider('k', 'm', mockClient({}, { refuse: true }).client).decide(opts, facts);
    expect(refused.author).toEqual({ kind: 'rule', why: 'Claude API unavailable (model declined)' });
    expect(refused.claimTap).toBe(true);
    const none = await new Decider(undefined).decide(opts, facts);
    expect(none.author).toEqual({ kind: 'rule', why: 'ANTHROPIC_API_KEY not set' });
  });

  it('encodes a record as a data URI whose hash is keccak256 of the JSON', () => {
    const r = { v: 1 as const, kind: 'covenant.decision' as const, action: 'claim_tap', reason: 'r', author: { kind: 'rule' as const, why: 'w' }, inputs: { treasuryBnb: 1 }, at: 1 };
    const e = encodeDecision(r);
    expect(e.uri.startsWith('data:application/json;base64,')).toBe(true);
    expect(e.hash).toBe(keccak256(toBytes(e.json)));
    expect(decodeDecision(e.uri)).toEqual(r);
    expect(decodeDecision('https://example.invalid/x')).toBeNull();
  });
});
