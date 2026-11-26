import path from 'node:path';
import { BaseError, ContractFunctionRevertedError, decodeErrorResult, encodeFunctionData, formatEther, type Abi, getAddress, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { erc20Abi, hasFunction, taxTokenAbi } from '../abi/index.js';
import { fetchBnbUsdReport, pokeCalldata, type AtlasReport } from '../atlas/report.js';
import { assertLocalNodeIfLoopback, assertSigningAllowed, walletClient } from '../chain.js';
import type { CovenantRef, ServerConfig } from '../config.js';
import { CovenantService } from '../covenant/read.js';
import { FINALIZE_GAS_LIMIT } from '../covenant/tx.js';
import { Alerter, alertsFor } from './alerts.js';
import { acquireLock, JsonStore } from './store.js';

interface VaultRecord {
  lastPokeAt?: number; // chain time of our last confirmed poke
  lastPokeTx?: Hex;
  pending?: { hash: Hex; sentAt: number; kind: 'poke' | 'dispatch' | 'sync' | 'declareAbandoned' | 'finalize' };
  lastDispatchAt?: number;
  lastSkip?: string;
  pokes?: number;
}

export interface KeeperState {
  vaults: Record<string, VaultRecord>;
}

export interface TickResult {
  vault: Address;
  action: 'poked' | 'skipped' | 'failed' | 'pending';
  reason?: string;
  tx?: Hex;
  reportMode?: AtlasReport['mode'] | 'none';
}

export interface KeeperOptions {
  cfg: ServerConfig;
  svc?: CovenantService;
  wallet?: WalletClient;
  log?: (m: string) => void;
  /** call declareAbandoned() when a covenant is past its heartbeat window (keeper agent role) */
  declareAbandoned?: boolean;
  /** call finalize() on raises past their sale deadline (anyone may; default on, KEEPER_FINALIZE=false turns it off) */
  finalize?: boolean;
}

export interface FinalizeResult {
  launcher: Address;
  action: 'finalized' | 'failed' | 'pending';
  tx?: Hex;
  reason?: string;
}

const LAUNCHER_LIST_ABI = [
  { type: 'function', name: 'allLaunchers', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
] as const;

export function revertReason(e: unknown, abi: Abi = []): string {
  if (e instanceof BaseError) {
    const withData = e.walk((x) => typeof (x as { data?: unknown }).data === 'string') as { data?: Hex } | null;
    if (withData?.data && withData.data.length >= 10) {
      try {
        return decodeErrorResult({ abi, data: withData.data }).errorName;
      } catch {
        /* unknown selector */
      }
    }
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (r?.data?.errorName) return r.data.errorName;
    return e.shortMessage;
  }
  return (e as Error).message ?? String(e);
}

/**
 * The keeper pokes each covenant about once an hour with a signed BNB/USD report appended to
 * calldata, dispatches pending trading tax, and raises alerts.
 *
 * Redundancy: the oracle refuses a second poke within its minimum interval, and every send is
 * simulated first, so any number of keepers (and the web's poke button) can run at once and the
 * extra ones skip without spending gas. Restarts: state is persisted after every send, a pending
 * transaction is resolved by receipt on the next tick, and "is a poke due" is decided from chain
 * state (oracle.lastPokeAt when exposed), not from memory.
 *
 * Exit-rule fix 3: if no Atlas report can be fetched, the keeper still pokes without one. The
 * observation is untrusted, so tap rate and unlock counters do not move, but the exit streak
 * steps on on-chain numbers.
 */
export class Keeper {
  readonly cfg: ServerConfig;
  readonly svc: CovenantService;
  readonly wallet: WalletClient;
  readonly store: JsonStore<KeeperState>;
  readonly alerter: Alerter;
  private log: (m: string) => void;
  private declare: boolean;
  private finalizeRaises: boolean;
  private get errorsAbi(): Abi {
    return [...this.svc.abis.oracle, ...this.svc.abis.vault].filter((i) => i.type === 'error') as Abi;
  }

  constructor(opts: KeeperOptions) {
    this.cfg = opts.cfg;
    this.svc = opts.svc ?? new CovenantService({ cfg: opts.cfg });
    if (!opts.wallet) {
      if (!opts.cfg.keeper.privateKey) throw new Error('KEEPER_PRIVATE_KEY is not set');
      assertSigningAllowed(opts.cfg.chainId, opts.cfg.rpcUrl);
    }
    this.wallet = opts.wallet ?? walletClient(opts.cfg, opts.cfg.keeper.privateKey!);
    this.store = new JsonStore<KeeperState>(opts.cfg.keeper.stateFile, { vaults: {} });
    this.log = opts.log ?? ((m) => console.log(`[keeper ${new Date().toISOString()}] ${m}`));
    this.alerter = new Alerter(opts.cfg.keeper.alertsFile, opts.cfg.keeper.alertWebhook, this.log);
    // On by default (owner decision): the keeper flips the abandonment switch on its first tick after it is due.
    // The anyone-can-press button (web, MCP declare_abandoned) stays as the fallback when no keeper runs.
    this.declare = opts.declareAbandoned ?? process.env.KEEPER_DECLARE_ABANDONED !== 'false';
    // On by default: a raise past its deadline is settled on the next tick, so refunds open without anyone pressing
    // the button. The web's finalize button and MCP finalize stay as the fallback.
    this.finalizeRaises = opts.finalize ?? process.env.KEEPER_FINALIZE !== 'false';
  }

  get client(): PublicClient {
    return this.svc.client;
  }

  private rec(vault: Address): VaultRecord {
    const k = vault.toLowerCase();
    if (!this.store.get().vaults[k]) this.store.update((d) => (d.vaults[k] = {}));
    return this.store.get().vaults[k]!;
  }

  private save(vault: Address, patch: Partial<VaultRecord>) {
    this.store.update((d) => {
      d.vaults[vault.toLowerCase()] = { ...d.vaults[vault.toLowerCase()], ...patch };
    });
  }

  /** Resolve a transaction left pending by a previous tick or a previous process. */
  private async resolvePending(vault: Address, now: number): Promise<boolean> {
    const p = this.rec(vault).pending;
    if (!p) return false;
    try {
      const r = await this.client.getTransactionReceipt({ hash: p.hash });
      if (p.kind === 'poke' && r.status === 'success') {
        const block = await this.client.getBlock({ blockNumber: r.blockNumber });
        this.save(vault, { lastPokeAt: Number(block.timestamp), lastPokeTx: p.hash, pending: undefined, pokes: (this.rec(vault).pokes ?? 0) + 1 });
      } else {
        this.save(vault, { pending: undefined, lastSkip: r.status === 'success' ? undefined : `${p.kind} reverted on-chain` });
      }
      return false;
    } catch {
      // not mined yet; give up on it after 10 minutes (dropped or replaced)
      if (now - p.sentAt > 600) {
        this.save(vault, { pending: undefined, lastSkip: `${p.kind} ${p.hash} dropped` });
        return false;
      }
      return true;
    }
  }

  private async lastPokeOnChain(vault: Address): Promise<number | null> {
    const oracle = this.cfg.oracle;
    if (oracle && !hasFunction(this.svc.abis.oracle, 'lastPokeAt') && hasFunction(this.svc.abis.oracle, 'points')) {
      // real CovenantOracle: points(vault) -> (cumulative, timestamp, atlasTimestamp, pokedAt, initialized)
      try {
        const p = (await this.client.readContract({ address: oracle, abi: this.svc.abis.oracle, functionName: 'points', args: [vault] })) as readonly unknown[];
        return p[4] ? Number(p[3]) : null;
      } catch {
        return null;
      }
    }
    if (!oracle || !hasFunction(this.svc.abis.oracle, 'lastPokeAt')) return null;
    try {
      return Number(
        await this.client.readContract({ address: oracle, abi: this.svc.abis.oracle, functionName: 'lastPokeAt', args: [vault] }),
      );
    } catch {
      return null;
    }
  }

  private async send(
    vault: Address,
    kind: NonNullable<VaultRecord['pending']>['kind'],
    to: Address,
    data: Hex,
    now: number,
    gas?: bigint,
  ): Promise<Hex> {
    const account = this.wallet.account!;
    // simulate first: a revert here costs nothing (TooSoon from a redundant keeper, NotDue, ...)
    await this.client.call({ account: account.address, to, data, ...(gas ? { gas } : {}) });
    const hash = await this.wallet.sendTransaction({ account, chain: this.wallet.chain, to, data, ...(gas ? { gas } : {}) });
    this.save(vault, { pending: { hash, sentAt: now, kind } });
    const r = await this.client.waitForTransactionReceipt({ hash, timeout: 60_000 }).catch(() => null);
    if (r) await this.resolvePending(vault, now);
    return hash;
  }

  async report(): Promise<AtlasReport | null> {
    try {
      return await fetchBnbUsdReport(this.cfg.atlas, this.client);
    } catch (e) {
      this.log(`Atlas report unavailable (${(e as Error).message}); poking without one: the exit rule still steps.`);
      return null;
    }
  }

  async pokeOne(ref: CovenantRef, now: number, force = false): Promise<TickResult> {
    const vault = ref.vault;
    if (!this.cfg.oracle) return { vault, action: 'skipped', reason: 'oracle address unknown' };
    if (await this.resolvePending(vault, now)) return { vault, action: 'pending', tx: this.rec(vault).pending?.hash };
    const last = (await this.lastPokeOnChain(vault)) ?? this.rec(vault).lastPokeAt ?? 0;
    if (!force && last && now - last < this.cfg.keeper.pokeIntervalSeconds) {
      return { vault, action: 'skipped', reason: `not due (${now - last}s since last poke, interval ${this.cfg.keeper.pokeIntervalSeconds}s)` };
    }
    const rep = await this.report();
    const data = pokeCalldata(this.svc.abis.oracle, vault, rep?.extraData);
    try {
      const tx = await this.send(vault, 'poke', this.cfg.oracle, data, now);
      this.log(`poked ${vault} (${rep ? rep.mode : 'no report'}) tx ${tx}`);
      return { vault, action: 'poked', tx, reportMode: rep?.mode ?? 'none' };
    } catch (e) {
      const reason = revertReason(e, this.errorsAbi);
      // TooSoon means another keeper or a user already poked: that is success for the system.
      if (/TooSoon/i.test(reason)) {
        this.save(vault, { lastSkip: reason });
        return { vault, action: 'skipped', reason, reportMode: rep?.mode ?? 'none' };
      }
      // A report the oracle refuses (wrong signer, feed id, replay, stale) must not stop the exit rule: it steps on
      // on-chain numbers alone, so send the bare poke.
      if (rep) {
        try {
          const tx = await this.send(vault, 'poke', this.cfg.oracle, pokeCalldata(this.svc.abis.oracle, vault), now);
          this.log(`poked ${vault} without a report (the ${rep.mode} report was refused: ${reason}) tx ${tx}`);
          return { vault, action: 'poked', tx, reportMode: 'none', reason: `report refused (${reason}); bare poke sent` };
        } catch (e2) {
          const r2 = revertReason(e2, this.errorsAbi);
          this.save(vault, { lastSkip: r2 });
          return { vault, action: /TooSoon/i.test(r2) ? 'skipped' : 'failed', reason: `with report: ${reason}; bare: ${r2}`, reportMode: 'none' };
        }
      }
      this.save(vault, { lastSkip: reason });
      return { vault, action: 'failed', reason, reportMode: 'none' };
    }
  }

  /**
   * BNB the processor holds beyond the balances it keeps for itself, i.e. what dispatch() would send on. null when the
   * processor's views or the quote token are unknown (then dispatch anyway, as before).
   */
  async dispatchableTax(processor: Address): Promise<bigint | null> {
    if (!this.cfg.wbnb) return null;
    try {
      const read = (functionName: 'feeQuoteBalance' | 'marketQuoteBalance' | 'lpQuoteBalance' | 'pendingDividendQuoteTokenBalance') =>
        this.client.readContract({ address: processor, abi: taxTokenAbi, functionName }) as Promise<bigint>;
      const [wbnb, native, fee, market, lp, dividend] = await Promise.all([
        this.client.readContract({ address: this.cfg.wbnb, abi: erc20Abi, functionName: 'balanceOf', args: [processor] }) as Promise<bigint>,
        this.client.getBalance({ address: processor }),
        read('feeQuoteBalance'), read('marketQuoteBalance'), read('lpQuoteBalance'), read('pendingDividendQuoteTokenBalance'),
      ]);
      return dispatchableQuote({ wbnb, native, reserved: [fee, market, lp, dividend] });
    } catch {
      return null;
    }
  }

  /**
   * Trading tax collects in the token as tokens. Flap's processor swaps it to BNB on a sell only once it is worth
   * enough (on BNB testnet about 0.714 BNB, $500 at the Portal's internal $700/BNB), and dispatch() then sends the
   * vault its share. Dispatching before that moves nothing and only costs gas, so the keeper waits for BNB to be there.
   */
  async dispatchTax(ref: CovenantRef, token: Address | null, now: number): Promise<Hex | null> {
    if (!this.cfg.keeper.dispatchTax || !token) return null;
    const r = this.rec(ref.vault);
    if (r.lastDispatchAt && now - r.lastDispatchAt < this.cfg.keeper.pokeIntervalSeconds) return null;
    this.save(ref.vault, { lastDispatchAt: now });
    let processor: Address | null = null;
    try {
      processor = getAddress(await this.client.readContract({ address: token, abi: taxTokenAbi, functionName: 'taxProcessor' }));
    } catch {
      return null; // not a Flap tax token (or no processor view): nothing to dispatch
    }
    const pending = await this.dispatchableTax(processor);
    if (pending === 0n) return null; // tax not liquidated yet: nothing would move
    try {
      const tx = await this.send(ref.vault, 'dispatch', processor, encodeFunctionData({ abi: taxTokenAbi, functionName: 'dispatch' }), now);
      this.log(`dispatched tax for ${ref.vault} tx ${tx}`);
      await this.alerter.emit({ id: `${ref.vault}:dispatch:${tx}`, kind: 'tax-dispatched', vault: ref.vault, at: now, message: `Dispatched pending trading tax (${tx}).`, data: { tx } });
      return tx;
    } catch {
      return null; // nothing pending
    }
  }

  private nodeChecked?: Promise<void>;
  /**
   * Settle every raise past its sale deadline that nobody has finalized yet. finalize() needs a gas limit above its
   * 15M launch guard and BNB testnet caps a transaction at 2^24, so it is sent with FINALIZE_GAS_LIMIT (16.7M); the
   * gas actually used is about 5 to 7M. A raise below its minimum settles as FAILED, which opens full refunds.
   */
  async finalizeDue(now: number): Promise<FinalizeResult[]> {
    if (!this.finalizeRaises) return [];
    const out: FinalizeResult[] = [];
    for (const f of this.cfg.launcherFactories ?? []) {
      let launchers: readonly Address[] = [];
      try {
        launchers = await this.client.readContract({ address: f, abi: LAUNCHER_LIST_ABI, functionName: 'allLaunchers' });
      } catch {
        continue;
      }
      for (const l of launchers) {
        const launcher = getAddress(l);
        if (await this.resolvePending(launcher, now)) {
          out.push({ launcher, action: 'pending', tx: this.rec(launcher).pending?.hash });
          continue;
        }
        const read = (functionName: string) =>
          this.client.readContract({ address: launcher, abi: this.svc.abis.launcher, functionName }).catch(() => null);
        const [state, deadline] = await Promise.all([read('state'), read('saleDeadline')]);
        if (state === null || Number(state) !== 0 || deadline === null || Number(deadline) > now) continue;
        const data = encodeFunctionData({ abi: this.svc.abis.launcher, functionName: 'finalize' });
        try {
          const tx = await this.send(launcher, 'finalize', launcher, data, now, FINALIZE_GAS_LIMIT);
          this.log(`finalized raise ${launcher} tx ${tx}`);
          await this.alerter.emit({
            id: `${launcher}:finalized`,
            kind: 'raise-finalized',
            vault: launcher,
            at: now,
            message: `Raise ${launcher} settled (${tx}). Contributors pull their refund with claimRefund() and, if it launched, their tokens with claimTokens().`,
            data: { tx, launcher },
          });
          out.push({ launcher, action: 'finalized', tx });
        } catch (e) {
          out.push({ launcher, action: 'failed', reason: revertReason(e, this.svc.abis.launcher.filter((i) => i.type === 'error') as Abi) });
        }
      }
    }
    return out;
  }

  /**
   * Refunds and sale tokens are pull payments: nothing is pushed to contributors. Raise one alert per covenant while
   * either is still waiting, so whoever watches the alerts (a webhook, the app) can remind contributors to claim.
   */
  async claimReminder(ref: CovenantRef, now: number): Promise<void> {
    if (!ref.launcher) return;
    const launcher = ref.launcher;
    const read = (address: Address, abi: Abi, functionName: string) =>
      this.client.readContract({ address, abi, functionName }).catch(() => null) as Promise<bigint | null>;
    const [held, contributors, saleAmount, saleClaimed] = await Promise.all([
      this.client.getBalance({ address: launcher }).catch(() => 0n),
      read(launcher, this.svc.abis.launcher, 'contributorCount'),
      read(ref.vault, this.svc.abis.vault, 'saleAmount'),
      read(ref.vault, this.svc.abis.vault, 'saleClaimed'),
    ]);
    // the launcher keeps at most one wei per contributor of rounding buffer; anything above that is refunds owed
    const refundsOpen = held > (contributors ?? 0n);
    const tokensOpen = saleAmount !== null && saleClaimed !== null && saleClaimed < saleAmount;
    if (!refundsOpen && !tokensOpen) return;
    const parts = [
      refundsOpen ? `${formatEther(held)} BNB of refunds (claimRefund() on the launcher)` : null,
      tokensOpen ? `${formatEther(saleAmount! - saleClaimed!)} sale tokens (claimTokens() on the vault)` : null,
    ].filter(Boolean);
    await this.alerter.emit({
      id: `${ref.vault}:claims-open`,
      kind: 'claims-open',
      vault: ref.vault,
      at: now,
      message: `Still unclaimed: ${parts.join(' and ')}. Nothing is pushed: each contributor claims with their own wallet (Claim buttons on the covenant page, or MCP get_position then claim_refund / claim_tokens).`,
      data: { launcher, refundsHeldWei: held.toString(), tokensUnclaimedWei: tokensOpen ? (saleAmount! - saleClaimed!).toString() : '0' },
    });
  }

  async tick(opts: { force?: boolean } = {}): Promise<TickResult[]> {
    this.nodeChecked ??= assertLocalNodeIfLoopback(this.client, this.cfg.chainId, this.cfg.rpcUrl);
    await this.nodeChecked;
    const { timestamp: now } = await this.svc.chainNow();
    const results: TickResult[] = [];
    await this.finalizeDue(now).catch((e) => this.log(`finalize scan failed: ${(e as Error).message}`));
    await this.svc.discover().catch(() => undefined);
    for (const ref of this.svc.covenants()) {
      // A wound-down or failed covenant has nothing left for an observation to move: poking it only burns gas.
      const st = await this.client
        .readContract({ address: ref.vault, abi: this.svc.abis.vault, functionName: 'state' })
        .then((v) => Number(v))
        .catch(() => null);
      if (st === 5 || st === 1) {
        results.push({ vault: ref.vault, action: 'skipped', reason: st === 5 ? 'wound down' : 'failed' });
        continue;
      }
      const res = await this.pokeOne(ref, now, opts.force);
      results.push(res);
      if (res.action === 'failed') {
        await this.alerter.emit({ id: `${ref.vault}:poke-failed:${now}`, kind: 'poke-failed', vault: ref.vault, at: now, message: `Poke failed: ${res.reason}`, data: {} });
      }
      try {
        const sheet = await this.svc.sheet(ref.vault);
        await this.dispatchTax(ref, sheet.token, now);
        for (const a of alertsFor(sheet, now)) await this.alerter.emit(a);
        await this.claimReminder(ref, now).catch(() => undefined);
        if (this.declare && sheet.heartbeat.abandonable) {
          const data = encodeFunctionData({ abi: this.svc.abis.vault, functionName: 'declareAbandoned' });
          try {
            const tx = await this.send(ref.vault, 'declareAbandoned', ref.vault, data, now);
            this.log(`declared ${ref.vault} abandoned tx ${tx}`);
          } catch (e) {
            this.log(`declareAbandoned skipped: ${revertReason(e, this.errorsAbi)}`);
          }
        }
      } catch (e) {
        this.log(`read failed for ${ref.vault}: ${(e as Error).message}`);
      }
    }
    return results;
  }

  lockFile(): string {
    return path.join(path.dirname(this.cfg.keeper.stateFile), 'keeper.lock');
  }

  /** Run until stopped. Returns a stop function. */
  run(): () => void {
    const release = acquireLock(this.lockFile());
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;
    const loop = async () => {
      if (stopped) return;
      try {
        const rs = await this.tick();
        for (const r of rs) if (r.action !== 'skipped') this.log(`${r.vault}: ${r.action}${r.reason ? ` (${r.reason})` : ''}`);
      } catch (e) {
        this.log(`tick failed: ${(e as Error).message}`);
      }
      if (!stopped) timer = setTimeout(loop, this.cfg.keeper.tickSeconds * 1000);
    };
    void loop();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      release();
    };
  }
}

/** BNB (native plus wrapped) a Flap tax processor holds beyond its own reserved balances; never below zero. */
export function dispatchableQuote(b: { wbnb: bigint; native: bigint; reserved: bigint[] }): bigint {
  const held = b.wbnb + b.native;
  const kept = b.reserved.reduce((a, x) => a + x, 0n);
  return held > kept ? held - kept : 0n;
}
