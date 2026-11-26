import { describe, expect, it } from 'vitest';
import { planActions, type PlanInput } from '../../mcp/actions.js';
import type { Position } from '../../src/covenant/read.js';
import type { CovenantSheet } from '../../src/schema.js';

const W = '0x00000000000000000000000000000000000000b2' as const;
const TEAM = '0x00000000000000000000000000000000000000c3' as const;
const L = '0x00000000000000000000000000000000000000a1' as const;
const now = 1_000_000;

function sheet(state: CovenantSheet['state'], over: Partial<CovenantSheet> = {}): CovenantSheet {
  return {
    state,
    exit: { targetSeconds: 180, streakSeconds: 40, roundEndsAt: now + 100, cooldownEndsAt: null },
    heartbeat: { abandonable: false, dueAt: now + 500, windowSeconds: 600, ageSeconds: 100 },
    tap: { accruedWei: '5', paused: false },
    terms: { tapUsdPer30d: 100 },
    issuer: { teamWallet: TEAM },
    ...over,
  } as unknown as CovenantSheet;
}
const pos = (p: Partial<Position> = {}): Position => ({
  wallet: W, bnbBalanceWei: '0', tokenBalanceWei: '0', contributedWei: '0', acceptedWei: '0', allocationTokensWei: '0',
  claimableTokensWei: '0', tokensClaimed: false, refundableWei: '0', refunded: false, isTeamWallet: false, ...p,
});
const plan = (p: Partial<PlanInput>) => {
  const r = planActions({ covenant: L, now, wallet: W, raise: null, sheet: null, position: null, nextPokeAt: null, unlockedUnreleasedWei: null, ...p });
  return { ...r, by: Object.fromEntries(r.actions.map((a) => [a.tool, a])) };
};
const raise = (state: string, deadline: number) => ({ launcher: L, state, committedWei: '10', minRaiseWei: '5', capWei: '20', deadline });

describe('planActions', () => {
  it('an open raise: commit yes, finalize not yet', () => {
    const { by } = plan({ raise: raise('RAISING', now + 60), position: pos() });
    expect(by.commit!.available).toBe(true);
    expect(by.commit!.args).toMatchObject({ covenant: L });
    expect(by.finalize!.available).toBe(false);
    expect(by.claim_refund!.why).toMatch(/after finalize/);
  });
  it('past the deadline: anyone can finalize, with the gas it needs', () => {
    const { by, summary } = plan({ raise: raise('RAISING', now - 1) });
    expect(by.commit!.available).toBe(false);
    expect(by.finalize!).toMatchObject({ available: true, signer: 'anyone' });
    expect(by.finalize!.why).toMatch(/16700000 gas/);
    expect(summary).toMatch(/finalize \(anyone\)/);
  });
  it('a failed raise: refunds', () => {
    const { by } = plan({ raise: raise('FAILED', now - 100), position: pos({ refundableWei: '7' }) });
    expect(by.claim_refund!.available).toBe(true);
  });
  it('active: no redemption, poke when the oracle allows, team actions only for the team', () => {
    const { by } = plan({ sheet: sheet('ACTIVE'), position: pos({ tokenBalanceWei: '100' }), nextPokeAt: now + 30 });
    expect(by.redeem!.available).toBe(false);
    expect(by.redeem!.why).toMatch(/40 s/);
    expect(by.poke!.available).toBe(false);
    expect(by.poke!.why).toMatch(/in 30 s/);
    expect(by.claim_tap!.available).toBe(false);
    expect(by.claim_tap!.why).toMatch(/Team wallet only/);
    const team = plan({ sheet: sheet('ACTIVE'), wallet: TEAM, position: pos({ wallet: TEAM, isTeamWallet: true }) });
    expect(team.by.claim_tap!.available).toBe(true);
    expect(team.by.heartbeat!.available).toBe(true);
  });
  it('exit round with tokens: redeem', () => {
    const { by } = plan({ sheet: sheet('EXIT_ROUND'), position: pos({ tokenBalanceWei: '100' }) });
    expect(by.redeem!.available).toBe(true);
    expect(by.redeem!.args).toMatchObject({ wallet: W });
  });
  it('abandoned team: anyone may declare it; wound down: redeem with no fee, nothing for the team', () => {
    expect(plan({ sheet: sheet('ACTIVE', { heartbeat: { abandonable: true, dueAt: now - 5 } } as Partial<CovenantSheet>) }).by.declare_abandoned!.available).toBe(true);
    const wd = plan({ sheet: sheet('WIND_DOWN'), position: pos({ tokenBalanceWei: '1' }) });
    expect(wd.by.redeem!.why).toMatch(/no fee/);
    expect(wd.by.poke!.available).toBe(false);
    expect(wd.by.heartbeat!.available).toBe(false);
    expect(wd.by.deposit_revenue!.available).toBe(true); // depositRevenue has no state check; it raises what redeemers get
    expect(wd.by.post_report!.why).toMatch(/Team wallet only/);
    const wdTeam = plan({ sheet: sheet('WIND_DOWN'), wallet: TEAM, position: pos({ wallet: TEAM, isTeamWallet: true }) });
    expect(wdTeam.by.post_report!.available).toBe(true); // disclosure stays possible after wind-down
    expect(wdTeam.by.heartbeat!.available).toBe(false);
  });
  it('accrued tap stays claimable by the team after a round opens or wind-down', () => {
    const team = plan({ sheet: sheet('WIND_DOWN', { tap: { accruedWei: '5', paused: true } } as Partial<CovenantSheet>), wallet: TEAM, position: pos({ wallet: TEAM, isTeamWallet: true }) });
    expect(team.by.claim_tap!.available).toBe(true);
    expect(team.by.claim_tap!.why).toMatch(/stays claimable/);
  });
  it('unlocked team tranches can be released by anyone', () => {
    expect(plan({ sheet: sheet('ACTIVE'), unlockedUnreleasedWei: '1000000000000000000' }).by.release_team!.available).toBe(true);
  });
});
