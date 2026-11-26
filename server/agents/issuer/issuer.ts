import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { encodeFunctionData, keccak256, parseEther, toBytes, type Address, type Hex, type WalletClient } from 'viem';
import { hasFunction } from '../../src/abi/index.js';
import { assertSigningAllowed, walletClient } from '../../src/chain.js';
import type { ServerConfig } from '../../src/config.js';
import { CovenantService } from '../../src/covenant/read.js';
import { revertReason } from '../../src/keeper/keeper.js';
import { JsonStore } from '../../src/keeper/store.js';
import type { CovenantSheet } from '../../src/schema.js';
import { Reporter, type LedgerEntry, type PeriodReport } from './report.js';

export interface IssuerPolicy {
  /** claim the tap once at least this much has accrued */
  minClaimWei: bigint;
  /** send a heartbeat when the last team action is older than this (and nothing else was sent) */
  heartbeatEverySeconds: number;
  /** "price close to book": pool premium to book at or below this percent */
  payCutBelowPremiumPct: number;
  /** each pay cut lowers the tap by this share */
  payCutShare: number;
  /** never cut below this many dollars per 30 days */
  minTapUsdPer30d: bigint;
  /** a balance increase at least this large between ticks is revenue to forward */
  minRevenueWei: bigint;
  /** BNB kept in the agent wallet for gas */
  gasReserveWei: bigint;
  periodSeconds: number;
}

export const DEFAULT_POLICY: IssuerPolicy = {
  minClaimWei: parseEther('0.01'),
  heartbeatEverySeconds: 7 * 86_400,
  payCutBelowPremiumPct: 10,
  payCutShare: 0.2,
  minTapUsdPer30d: parseEther('5000'),
  minRevenueWei: parseEther('0.001'),
  gasReserveWei: parseEther('0.05'),
  periodSeconds: 30 * 86_400,
};

interface IssuerState {
  period: number;
  periodStartedAt: number;
  lastActionAt: number;
  lastPayCutPeriod: number;
  recordedBalance: string | null;
  ledger: LedgerEntry[];
  reports: { period: number; uri: string; hash: Hex; author: PeriodReport['author']; tx?: Hex }[];
}

export interface TickOutcome {
  actions: LedgerEntry[];
  state: CovenantSheet['state'];
  report?: { period: number; uri: string; author: PeriodReport['author'] };
}

/**
 * The reference issuer agent from docs/DESIGN.md "Issuer agent loop". It holds the team wallet and
 * runs on its tap as a compute budget. Every money decision is a fixed rule in this file (claim
 * above a minimum, heartbeat on a schedule, cut its own pay when the pool trades close to book,
 * forward any revenue it earns to the vault). The LLM only writes the period report and the
 * explanation in it. Kill the process and nothing else keeps the covenant alive: after the
 * heartbeat window anyone can declare it abandoned and the treasury opens to holders.
 */
export class IssuerAgent {
  readonly svc: CovenantService;
  readonly wallet: WalletClient;
  readonly store: JsonStore<IssuerState>;
  private reporter: Reporter;
  private log: (m: string) => void;

  constructor(
    readonly cfg: ServerConfig,
    readonly vault: Address,
    opts: { privateKey?: Hex; wallet?: WalletClient; svc?: CovenantService; policy?: Partial<IssuerPolicy>; reporter?: Reporter; log?: (m: string) => void } = {},
    readonly policy: IssuerPolicy = { ...DEFAULT_POLICY, ...(opts.policy ?? {}) },
  ) {
    this.svc = opts.svc ?? new CovenantService({ cfg });
    if (!opts.wallet) {
      if (!opts.privateKey) throw new Error('ISSUER_PRIVATE_KEY is not set (the team wallet key, local chain only)');
      assertSigningAllowed(cfg.chainId);
    }
    this.wallet = opts.wallet ?? walletClient(cfg, opts.privateKey!);
    this.store = new JsonStore<IssuerState>(path.join(cfg.dataDir, 'issuer', `${vault.toLowerCase()}.json`), {
      period: 1,
      periodStartedAt: 0,
      lastActionAt: 0,
      lastPayCutPeriod: 0,
      recordedBalance: null,
      ledger: [],
      reports: [],
    });
    this.reporter = opts.reporter ?? new Reporter(cfg.anthropic.apiKey, cfg.anthropic.model);
    this.log = opts.log ?? ((m) => console.log(`[issuer ${new Date().toISOString()}] ${m}`));
  }

  get address(): Address {
    return this.wallet.account!.address;
  }

  private async send(to: Address, data: Hex, value = 0n): Promise<Hex> {
    const account = this.wallet.account!;
    await this.svc.client.call({ account: account.address, to, data, value });
    const hash = await this.wallet.sendTransaction({ account, chain: this.wallet.chain, to, data, value });
    const r = await this.svc.client.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') throw new Error(`tx ${hash} reverted`);
    return hash;
  }

  private call(fn: string, args: unknown[] = []): Promise<Hex> {
    return this.send(this.vault, encodeFunctionData({ abi: this.svc.abis.vault, functionName: fn, args }));
  }

  private record(e: LedgerEntry) {
    this.store.update((d) => {
      d.ledger.push(e);
      if (e.kind !== 'note' && e.kind !== 'revenue-forwarded') d.lastActionAt = e.at;
    });
    this.log(`${e.kind}${e.amountWei ? ` ${e.amountWei} wei` : ''}: ${e.reason}${e.tx ? ` (${e.tx})` : ''}`);
  }

  async tick(): Promise<TickOutcome> {
    const { timestamp: now } = await this.svc.chainNow();
    const st = this.store.get();
    if (!st.periodStartedAt) this.store.update((d) => (d.periodStartedAt = now));
    const before = this.store.get().ledger.length;
    let s = await this.svc.sheet(this.vault);
    if (s.issuer.teamWallet && s.issuer.teamWallet.toLowerCase() !== this.address.toLowerCase()) {
      throw new Error(`this key (${this.address}) is not the covenant's team wallet (${s.issuer.teamWallet})`);
    }

    // 1. revenue earned since the last tick (anything that arrived that we did not cause)
    const bal = await this.svc.client.getBalance({ address: this.address });
    const recorded = st.recordedBalance === null ? null : BigInt(st.recordedBalance);
    if (recorded !== null && bal > recorded + this.policy.minRevenueWei && s.state !== 'FAILED') {
      const earned = bal - recorded;
      const sendable = bal - this.policy.gasReserveWei;
      const amount = earned < sendable ? earned : sendable;
      if (amount > 0n) {
        try {
          const tx = await this.send(this.vault, '0x', amount);
          this.record({ at: now, kind: 'revenue-forwarded', amountWei: amount.toString(), tx, reason: 'Revenue the agent earned goes to the vault, raising book value for every holder.' });
        } catch (e) {
          this.record({ at: now, kind: 'note', reason: `revenue forward failed: ${revertReason(e)}` });
        }
      }
    }

    const live = s.state === 'ACTIVE' || s.state === 'COOLDOWN' || s.state === 'EXIT_ROUND';
    const accrued = BigInt(s.tap.accruedWei ?? '0');
    let beat = false;

    // 2. claim the tap (also a heartbeat), or heartbeat on schedule
    if ((live || s.state === 'WIND_DOWN') && accrued >= this.policy.minClaimWei) {
      try {
        const tx = await this.call('claimTap');
        beat = true;
        this.record({ at: now, kind: 'tap-claimed', amountWei: accrued.toString(), tx, reason: `Claimed the accrued tap as this period's compute budget (minimum claim ${this.policy.minClaimWei} wei).` });
      } catch (e) {
        this.record({ at: now, kind: 'note', reason: `claimTap failed: ${revertReason(e)}` });
      }
    }
    if (live && !beat) {
      const age = s.heartbeat.ageSeconds ?? Infinity;
      const every = Math.min(this.policy.heartbeatEverySeconds, s.heartbeat.windowSeconds ? Math.floor(s.heartbeat.windowSeconds / 3) : Infinity);
      if (age >= every) {
        try {
          const tx = await this.call('heartbeat');
          beat = true;
          this.record({ at: now, kind: 'heartbeat', tx, reason: `Last team action ${age}s ago; heartbeat every ${every}s keeps the abandonment switch closed.` });
        } catch (e) {
          this.record({ at: now, kind: 'note', reason: `heartbeat failed: ${revertReason(e)}` });
        }
      }
    }

    // 3. a pay cut when the pool trades close to book (once per period)
    const cur = s.tap.tapUsdPer30d === null ? null : parseEther(String(s.tap.tapUsdPer30d));
    if (
      s.state === 'ACTIVE' &&
      cur !== null &&
      s.premiumToBookPct !== null &&
      s.premiumToBookPct <= this.policy.payCutBelowPremiumPct &&
      this.store.get().lastPayCutPeriod < this.store.get().period
    ) {
      const target = (cur * BigInt(Math.round((1 - this.policy.payCutShare) * 10_000))) / 10_000n;
      const next = target < this.policy.minTapUsdPer30d ? this.policy.minTapUsdPer30d : target;
      if (next < cur) {
        try {
          const tx = await this.call('lowerTap', [next]);
          this.store.update((d) => (d.lastPayCutPeriod = d.period));
          this.record({
            at: now,
            kind: 'tap-lowered',
            usdPer30d: next.toString(),
            tx,
            reason: `Pool is ${s.premiumToBookPct.toFixed(1)}% vs book (rule: cut at or below ${this.policy.payCutBelowPremiumPct}%). Lowered the tap from $${Number(cur / 10n ** 18n)} to $${Number(next / 10n ** 18n)} per 30 days to protect the floor; it can never be raised again.`,
          });
        } catch (e) {
          this.record({ at: now, kind: 'note', reason: `lowerTap failed: ${revertReason(e)}` });
        }
      }
    }

    // 4. period report
    let report: TickOutcome['report'];
    if (now >= this.store.get().periodStartedAt + this.policy.periodSeconds && s.state !== 'FAILED') {
      s = await this.svc.sheet(this.vault);
      report = await this.postPeriodReport(now, s);
    }

    const after = await this.svc.client.getBalance({ address: this.address });
    this.store.update((d) => (d.recordedBalance = after.toString()));
    return { actions: this.store.get().ledger.slice(before), state: s.state, report };
  }

  private async postPeriodReport(now: number, s: CovenantSheet): Promise<TickOutcome['report']> {
    const st = this.store.get();
    const period = st.period;
    const ledger = st.ledger.filter((e) => e.at >= st.periodStartedAt);
    const r = await this.reporter.write(period, ledger, s);
    const dir = path.join(this.cfg.dataDir, 'reports', this.vault.toLowerCase());
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${period}.md`), r.markdown);
    const uri = `${this.cfg.apiBaseUrl}/reports/${this.vault.toLowerCase()}/${period}`;
    const hash = keccak256(toBytes(r.markdown));
    let tx: Hex | undefined;
    if (hasFunction(this.svc.abis.vault, 'postReport')) {
      try {
        tx = await this.call('postReport', [BigInt(period), uri, hash]);
        this.record({ at: now, kind: 'report-posted', tx, reason: `Period ${period} report posted (${r.author.kind === 'llm' ? `written with ${r.author.model}` : `fixed template: ${r.author.why}`}).` });
      } catch (e) {
        this.record({ at: now, kind: 'note', reason: `postReport failed: ${revertReason(e)}` });
      }
    }
    this.store.update((d) => {
      d.reports.push({ period, uri, hash, author: r.author, tx });
      d.period += 1;
      d.periodStartedAt = now;
    });
    return { period, uri, author: r.author };
  }

  run(tickSeconds: number): () => void {
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;
    const loop = async () => {
      if (stopped) return;
      try {
        const o = await this.tick();
        if (o.actions.length === 0) this.log(`state ${o.state}: nothing to do`);
      } catch (e) {
        this.log(`tick failed: ${(e as Error).message}`);
      }
      if (!stopped) timer = setTimeout(loop, tickSeconds * 1000);
    };
    void loop();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }
}
