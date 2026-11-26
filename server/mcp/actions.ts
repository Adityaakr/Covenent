import { formatEther, type Address } from 'viem';
import type { Position } from '../src/covenant/read.js';
import type { CovenantSheet } from '../src/schema.js';
import { FINALIZE_GAS } from '../src/covenant/gas.js';

export type Signer = 'anyone' | 'this wallet' | 'team wallet';

export interface ActionOption {
  /** the MCP tool that builds this transaction */
  tool: string;
  available: boolean;
  signer: Signer;
  /** why it is or is not available now, in one sentence */
  why: string;
  /** arguments to pass to the tool, when the plan can fill them in */
  args?: Record<string, string | number | boolean>;
}

export interface RaiseView {
  launcher: Address;
  state: string;
  committedWei: string | null;
  minRaiseWei: string | null;
  capWei: string | null;
  deadline: number | null;
}

export interface PlanInput {
  covenant: string;
  now: number;
  wallet: Address | null;
  raise: RaiseView | null;
  sheet: CovenantSheet | null;
  position: Position | null;
  /** CovenantOracle.nextPokeAt(vault), when the oracle has it: the next poke without a rate */
  nextPokeAt: number | null;
  /** CovenantOracle.nextRatePokeAt(vault), when the oracle has it: the next poke with a rate (plain pokes never move it) */
  nextRatePokeAt?: number | null;
  /** CovenantVault.unlockedUnreleased(), wei */
  unlockedUnreleasedWei: string | null;
}

const bnb = (wei: string | bigint | null | undefined) => (wei === null || wei === undefined ? '?' : `${formatEther(BigInt(wei))} BNB`);
const tok = (wei: string | bigint) => `${formatEther(BigInt(wei))} tokens`;
const when = (t: number, now: number) => {
  const s = t - now;
  if (s <= 0) return 'now';
  return s >= 86_400 ? `in ${(s / 86_400).toFixed(1)} days` : s >= 3600 ? `in ${(s / 3600).toFixed(1)} hours` : `in ${s} s`;
};

/**
 * Every action a wallet could take on a covenant right now, each with a yes or no and the reason, from on-chain
 * reads only. It is the same rule set the contracts enforce, so an agent can plan without trial and error; the write
 * tools still simulate each transaction before anyone signs.
 */
export function planActions(p: PlanInput): { actions: ActionOption[]; summary: string } {
  const out: ActionOption[] = [];
  const c = { covenant: p.covenant };
  const pos = p.position;
  const big = (v: string | null | undefined) => (v ? BigInt(v) : 0n);

  // the raise
  if (p.raise) {
    const r = p.raise;
    const open = r.state === 'RAISING' && r.deadline !== null && p.now < r.deadline;
    const due = r.state === 'RAISING' && r.deadline !== null && p.now >= r.deadline;
    out.push({
      tool: 'commit',
      available: open,
      signer: 'this wallet',
      why: open
        ? `The raise is open until ${new Date(r.deadline! * 1000).toISOString()} (${when(r.deadline!, p.now)}): ${bnb(r.committedWei)} committed of a ${bnb(r.capWei)} cap, minimum ${bnb(r.minRaiseWei)}. Commitments over the cap are refunded pro rata.`
        : r.state === 'RAISING'
          ? 'The sale deadline has passed: no more commitments; the raise waits for finalize.'
          : `The raise is closed (launcher state ${r.state}).`,
      ...(open ? { args: { ...c, amount_bnb: '0.01' } } : {}),
    });
    out.push({
      tool: 'finalize',
      available: due,
      signer: 'anyone',
      why: due
        ? `The deadline passed with ${bnb(r.committedWei)} committed (minimum ${bnb(r.minRaiseWei)}): anyone can finalize now, which ${big(r.committedWei) >= big(r.minRaiseWei) ? 'launches the token and funds the vault' : 'marks the raise failed and opens full refunds'}. It needs a ${FINALIZE_GAS} gas limit.`
        : r.state === 'RAISING'
          ? `Finalize opens at the sale deadline, ${r.deadline === null ? 'unknown' : when(r.deadline, p.now)}.`
          : 'Already finalized.',
    });
    const refundable = big(pos?.refundableWei);
    const closed = r.state === 'FAILED' || r.state === 'LAUNCHED';
    out.push({
      tool: 'claim_refund',
      available: closed && refundable > 0n && pos?.refunded !== true,
      signer: 'this wallet',
      why: !pos
        ? 'Pass wallet to check this wallet’s refund.'
        : pos.refunded
          ? 'This wallet already took its refund.'
          : !closed
            ? 'Refunds open after finalize.'
            : refundable > 0n
              ? `${bnb(refundable)} of this wallet’s commitment was not accepted and is refundable now.`
              : 'This wallet has nothing to refund.',
    });
  }

  const s = p.sheet;
  if (s) {
    const state = s.state;
    const terminal = state === 'WIND_DOWN';
    const live = state === 'ACTIVE' || state === 'EXIT_ROUND' || state === 'COOLDOWN';
    const claimable = big(pos?.claimableTokensWei);
    out.push({
      tool: 'claim_tokens',
      available: claimable > 0n,
      signer: 'this wallet',
      why: !pos ? 'Pass wallet to check this wallet’s sale allocation.' : claimable > 0n ? `${tok(claimable)} of sale allocation are waiting in the vault.` : pos.tokensClaimed ? 'Already claimed.' : 'No sale allocation to claim for this wallet.',
    });
    const held = big(pos?.tokenBalanceWei);
    const redeemOpen = state === 'EXIT_ROUND' || terminal;
    out.push({
      tool: 'redeem',
      available: redeemOpen && held > 0n,
      signer: 'this wallet',
      why: !redeemOpen
        ? state === 'ACTIVE'
          ? `Redemption opens only in an exit round: the pool must trade below book for ${s.exit.targetSeconds ?? '?'} s of observed time; the streak is at ${s.exit.streakSeconds ?? '?'} s.`
          : `Redemption is not open in state ${state}${state === 'COOLDOWN' && s.exit.cooldownEndsAt ? ` (cooldown ends ${when(s.exit.cooldownEndsAt, p.now)})` : ''}.`
        : !pos
          ? 'Redemption is open: pass wallet to size this wallet’s redemption.'
          : held > 0n
            ? `Redemption is open${terminal ? ' with no fee (wound down)' : ` until ${s.exit.roundEndsAt ? new Date(s.exit.roundEndsAt * 1000).toISOString() : '?'}`}: this wallet holds ${tok(held)}. Compare get_downside redeemNowWei with sellOnPoolWei first.`
            : 'Redemption is open, but this wallet holds no tokens.',
      ...(redeemOpen && held > 0n && p.wallet ? { args: { ...c, wallet: p.wallet } } : {}),
    });
    const plainReady = p.nextPokeAt === null || p.now >= p.nextPokeAt;
    const rateReady = p.nextRatePokeAt !== undefined && p.nextRatePokeAt !== null && p.now >= p.nextRatePokeAt;
    const pokeReady = live && (plainReady || rateReady);
    out.push({
      tool: 'poke',
      available: pokeReady,
      signer: 'anyone',
      why: !live
        ? terminal
          ? 'The covenant is wound down: observations no longer change anything.'
          : `No observations in state ${state}.`
        : plainReady
          ? 'A price observation can be recorded now; it steps the exit streak (and, with a fresh BNB/USD rate, the tap rate and unlocks).'
          : pokeReady
            ? `A poke with a BNB/USD rate (Atlas report or fresh push round) can be recorded now; a plain poke waits until ${when(p.nextPokeAt!, p.now)}.`
            : `The oracle accepts the next poke ${when(p.nextPokeAt!, p.now)}.`,
    });
    out.push({
      tool: 'declare_abandoned',
      available: s.heartbeat.abandonable,
      signer: 'anyone',
      why: s.heartbeat.abandonable
        ? `The team has been silent past its heartbeat window (due ${s.heartbeat.dueAt ? new Date(s.heartbeat.dueAt * 1000).toISOString() : '?'}): anyone can open the treasury to holders, fee-free, for good.`
        : terminal
          ? 'Already wound down.'
          : `The team’s heartbeat is current; abandonment becomes possible ${s.heartbeat.dueAt === null ? 'at an unknown time' : when(s.heartbeat.dueAt + 1, p.now)} if no heartbeat arrives.`,
    });
    const unlocked = big(p.unlockedUnreleasedWei);
    out.push({
      tool: 'release_team',
      available: unlocked > 0n,
      signer: 'anyone',
      why: unlocked > 0n ? `${tok(unlocked)} of team tokens have unlocked and can be released to the team wallet.` : 'No unlocked team tokens are waiting.',
    });
    out.push({
      tool: 'deposit_revenue',
      available: true,
      signer: 'anyone',
      why: terminal
        ? 'Anyone can still send revenue to the vault: it raises what every holder redeems for at book.'
        : 'Anyone can send revenue to the vault; it raises book value for every holder (from the team wallet it is also a heartbeat).',
    });

    // issuer side
    const isTeam = pos?.isTeamWallet === true;
    const teamWhy = (ok: boolean, yes: string, no: string) => (p.wallet && !isTeam ? `Team wallet only (${s.issuer.teamWallet ?? 'unknown'}); this wallet is not it.` : ok ? yes : no);
    const accrued = big(s.tap.accruedWei);
    const tapOk = accrued > 0n;
    out.push({
      tool: 'claim_tap',
      available: tapOk && (isTeam || !p.wallet),
      signer: 'team wallet',
      why: teamWhy(
        tapOk,
        `${bnb(accrued)} of tap is owed to the team${s.tap.paused ? ` (accrual is paused in ${state}, what accrued stays claimable)` : ''}; claiming${terminal ? '' : ' also counts as a heartbeat'}.`,
        'Nothing has accrued yet.',
      ),
    });
    for (const [tool, yes] of [
      ['heartbeat', `Resets the abandonment clock (window ${s.heartbeat.windowSeconds ?? '?'} s; last ${s.heartbeat.ageSeconds ?? '?'} s ago).`],
      ['lower_tap', `Lowers the tap below $${s.terms.tapUsdPer30d ?? '?'} per 30 days, for good.`],
      ['wind_down', 'Closes the covenant for good: holders redeem at book with no fee.'],
    ] as const) {
      out.push({ tool, available: !terminal && (isTeam || !p.wallet), signer: 'team wallet', why: teamWhy(!terminal, yes, 'The covenant is wound down.') });
    }
    // postReport has no state check: disclosure stays possible after wind-down (it is just no longer a heartbeat)
    out.push({
      tool: 'post_report',
      available: isTeam || !p.wallet,
      signer: 'team wallet',
      why: teamWhy(true, `Posts the next period report pointer and hash${terminal ? ' (after wind-down it is no longer a heartbeat)' : ''}.`, ''),
    });
  }

  const now = out.filter((a) => a.available);
  const summary = now.length
    ? `Available now: ${now.map((a) => `${a.tool} (${a.signer})`).join(', ')}.`
    : 'Nothing is available to this wallet right now; each action below says why and when that changes.';
  return { actions: out, summary };
}
