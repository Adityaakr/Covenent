import { formatEther, getAddress, isAddress, zeroAddress, type Abi, type Address, type PublicClient } from 'viem';
import { erc20Abi, hasFunction, identityRegistryAbi, loadAbis, pairAbi, reputationRegistryAbi, type CovenantAbis } from '../abi/index.js';
import { publicClient } from '../chain.js';
import type { CovenantRef, ServerConfig } from '../config.js';
import {
  STATE_ORDER,
  type CovenantSheet,
  type CovenantState,
  type CovenantSummary,
  type History,
  type IssuerInfo,
  type LedgerEvent,
} from '../schema.js';
import { EventIndex, lastBnbUsd, ledgerTotals } from './events.js';
import { exitEta, toNum, WAD } from './math.js';

const LAUNCHER_STATES = ['RAISING', 'FAILED', 'LAUNCHED'] as const;

export function stateName(v: unknown): CovenantState {
  if (typeof v === 'number' || typeof v === 'bigint') return STATE_ORDER[Number(v)] ?? 'UNKNOWN';
  return 'UNKNOWN';
}

type Raw = Record<string, unknown>;

/** Tolerant reader: every view is optional, a missing or reverting view yields null and is recorded. */
class Reader {
  missing: string[] = [];
  constructor(
    private client: PublicClient,
    private address: Address,
    private abi: Abi,
    private label: string,
  ) {}
  async get<T = unknown>(fn: string, args: unknown[] = []): Promise<T | null> {
    if (!hasFunction(this.abi, fn)) {
      this.missing.push(`${this.label}.${fn}`);
      return null;
    }
    try {
      return (await this.client.readContract({ address: this.address, abi: this.abi, functionName: fn, args })) as T;
    } catch {
      this.missing.push(`${this.label}.${fn}`);
      return null;
    }
  }
  /** First name the ABI has, so the real contracts' names and the design doc's names both read. */
  async first<T = unknown>(fns: string[], args: unknown[] = []): Promise<T | null> {
    const fn = fns.find((f) => hasFunction(this.abi, f));
    if (!fn) {
      this.missing.push(`${this.label}.${fns[0]}`);
      return null;
    }
    return this.get<T>(fn, args);
  }
}

/** Views whose name differs between docs/DESIGN.md (first) and the real contracts (aliases). */
const VAULT_ALIASES: Record<string, string[]> = {
  exitStreakTarget: ['exitStreakTarget', 'exitStreakNeeded'],
  totalTapPaid: ['totalTapPaid', 'tapPaid'],
};

const big = (v: unknown): bigint | null => (typeof v === 'bigint' ? v : typeof v === 'number' ? BigInt(v) : null);
const num = (v: unknown): number | null => (typeof v === 'bigint' || typeof v === 'number' ? Number(v) : null);
const str = (v: bigint | null): string | null => (v === null ? null : v.toString());

export interface ServiceOptions {
  cfg: ServerConfig;
  client?: PublicClient;
  abis?: CovenantAbis;
}

/** Shared read model for the API, MCP server and agents. */
export class CovenantService {
  readonly cfg: ServerConfig;
  readonly client: PublicClient;
  readonly abis: CovenantAbis;
  readonly index: EventIndex;
  private refs = new Map<string, CovenantRef>();

  constructor(opts: ServiceOptions) {
    this.cfg = opts.cfg;
    this.client = opts.client ?? publicClient(opts.cfg);
    this.abis = opts.abis ?? loadAbis();
    this.index = new EventIndex(this.client, opts.cfg.startBlock);
    for (const c of opts.cfg.covenants) this.refs.set(c.vault.toLowerCase(), c);
  }

  covenants(): CovenantRef[] {
    return [...this.refs.values()];
  }

  /**
   * Add every launched covenant from the deployment's launcher factories (allLaunchers() -> launcher.vault()), so
   * covenants created after the server started (from the web's Create screen) show up without a restart.
   */
  async discover(): Promise<CovenantRef[]> {
    const factoryAbi = [
      { type: 'function', name: 'allLaunchers', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
    ] as const;
    for (const f of this.cfg.launcherFactories ?? []) {
      let launchers: readonly Address[] = [];
      try {
        launchers = await this.client.readContract({ address: f, abi: factoryAbi, functionName: 'allLaunchers' });
      } catch {
        continue;
      }
      await Promise.all(
        launchers.map(async (l) => {
          if ([...this.refs.values()].some((r) => r.launcher && getAddress(r.launcher) === getAddress(l))) return;
          try {
            const [vault, token, pool] = await Promise.all(
              ['vault', 'token', 'pool'].map((fn) =>
                this.client.readContract({ address: l, abi: this.abis.launcher, functionName: fn }).catch(() => zeroAddress),
              ),
            );
            if (!vault || vault === zeroAddress) return; // still raising, or failed
            this.addCovenant({
              vault: getAddress(vault as Address),
              launcher: getAddress(l),
              token: token && token !== zeroAddress ? getAddress(token as Address) : undefined,
              pair: pool && pool !== zeroAddress ? getAddress(pool as Address) : undefined,
            });
          } catch {
            /* not a covenant launcher */
          }
        }),
      );
    }
    return this.covenants();
  }

  addCovenant(ref: CovenantRef): void {
    this.refs.set(ref.vault.toLowerCase(), { ...this.refs.get(ref.vault.toLowerCase()), ...ref });
  }

  ref(vault: string): CovenantRef {
    if (!isAddress(vault)) throw new Error(`not an address: ${vault}`);
    const hit = this.refs.get(vault.toLowerCase());
    return hit ?? { vault: getAddress(vault) };
  }

  async chainNow(): Promise<{ timestamp: number; blockNumber: bigint }> {
    const b = await this.client.getBlock({ blockTag: 'latest' });
    return { timestamp: Number(b.timestamp), blockNumber: b.number! };
  }

  async syncEvents(ref: CovenantRef): Promise<void> {
    const sources: { address: Address; abi: Abi; contract: 'vault' | 'launcher' }[] = [
      { address: ref.vault, abi: this.abis.vault, contract: 'vault' },
    ];
    if (ref.launcher) sources.push({ address: ref.launcher, abi: this.abis.launcher, contract: 'launcher' as const });
    await this.index.sync(sources);
  }

  events(ref: CovenantRef): LedgerEvent[] {
    const v = this.index.events(ref.vault, 'vault');
    const l = ref.launcher ? this.index.events(ref.launcher, 'launcher') : [];
    return [...l, ...v].sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || a.logIndex - b.logIndex);
  }

  /** Read everything the covenant sheet shows. */
  async sheet(vaultAddr: string): Promise<CovenantSheet> {
    const ref = this.ref(vaultAddr);
    const v = new Reader(this.client, ref.vault, this.abis.vault, 'vault');
    const [now, , treasury] = await Promise.all([
      this.chainNow(),
      this.syncEvents(ref).catch(() => undefined),
      this.client.getBalance({ address: ref.vault }),
    ]);
    const names = [
      'state', 'bookValue', 'redeemableSupply', 'exitStreak', 'tapAccrued', 'token', 'launcher', 'teamWallet', 'pair',
      'agentId', 'salePriceBnb', 'usdSalePrice', 'tapUsdPer30d', 'tapCapBps', 'exitStreakTarget', 'roundLength', 'cooldown',
      'exitFeeBps', 'heartbeatWindow', 'unlockWindow', 'roundEnd', 'cooldownEnd', 'lastHeartbeat', 'owedTeam', 'lockedTeam',
      'totalRedeemed', 'totalTapPaid', 'lastObservedAt', 'lastTrusted', 'lastStrict', 'trancheCount',
    ] as const;
    const vals = await Promise.all(names.map((n) => (VAULT_ALIASES[n] ? v.first(VAULT_ALIASES[n]!) : v.get(n))));
    const r: Raw = Object.fromEntries(names.map((n, i) => [n, vals[i]]));

    // A terms() / getTerms() struct, when the real contract exposes one, fills gaps.
    const termsFn = hasFunction(this.abis.vault, 'getTerms') ? 'getTerms' : hasFunction(this.abis.vault, 'terms') ? 'terms' : null;
    if (termsFn) {
      const t = await v.get<Raw>(termsFn);
      if (t && typeof t === 'object') {
        const map: Record<string, string> = {
          exitStreak: 'exitStreakTarget', roundLength: 'roundLength', cooldown: 'cooldown', exitFeeBps: 'exitFeeBps',
          heartbeat: 'heartbeatWindow', tapCapBps: 'tapCapBps', tapUsdPer30d: 'tapUsdPer30d', unlockWindow: 'unlockWindow',
          teamWallet: 'teamWallet', agentId: 'agentId',
        };
        for (const [from, to] of Object.entries(map)) if (r[to] === null && from in t) r[to] = t[from];
      }
    }

    const token = (r.token as Address | null) ?? ref.token ?? null;
    const launcher = (r.launcher as Address | null) ?? ref.launcher ?? null;
    if (launcher && launcher !== zeroAddress && !ref.launcher) this.addCovenant({ vault: ref.vault, launcher });
    const pair = (r.pair as Address | null) ?? ref.pair ?? null;

    // token and pool
    const t = token ? new Reader(this.client, token, erc20Abi, 'token') : null;
    const [name, symbol, totalSupply] = t
      ? await Promise.all([t.get<string>('name'), t.get<string>('symbol'), t.get<bigint>('totalSupply')])
      : [null, null, null];
    let reserveBnb: bigint | null = null;
    let reserveToken: bigint | null = null;
    if (pair && pair !== zeroAddress && token) {
      try {
        const [t0, res] = await Promise.all([
          this.client.readContract({ address: pair, abi: pairAbi, functionName: 'token0' }),
          this.client.readContract({ address: pair, abi: pairAbi, functionName: 'getReserves' }),
        ]);
        const tokenIs0 = getAddress(t0) === getAddress(token);
        reserveToken = BigInt(tokenIs0 ? res[0] : res[1]);
        reserveBnb = BigInt(tokenIs0 ? res[1] : res[0]);
      } catch {
        v.missing.push('pair.getReserves');
      }
    }
    const poolPrice = reserveBnb !== null && reserveToken ? (reserveBnb * WAD) / reserveToken : null;

    const book = big(r.bookValue);
    const state = stateName(r.state);
    const events = this.events({ ...ref, launcher: launcher ?? undefined });
    const bnbUsd = lastBnbUsd(events);
    const treasuryBnb = toNum(treasury)!;
    const premium = book && poolPrice !== null && book > 0n ? (Number(poolPrice) / Number(book) - 1) * 100 : null;
    const salePrice = big(r.salePriceBnb);

    // tranches
    const count = num(r.trancheCount) ?? 0;
    const tranches = await Promise.all(
      Array.from({ length: count }, async (_, k) => {
        if (!hasFunction(this.abis.vault, 'trancheMultiple')) {
          // real contracts: trancheProgress(k) -> (amount, multiple x100, progress seconds, unlocked, targetUsd)
          const t = await v.get<readonly [bigint, bigint, bigint, boolean, bigint]>('trancheProgress', [BigInt(k)]);
          return {
            index: k,
            multiple: t ? Number(t[1]) / 100 : null,
            amountWei: t ? t[0].toString() : null,
            progressSeconds: t ? Number(t[2]) : null,
            windowSeconds: num(r.unlockWindow),
            unlocked: t ? t[3] : null,
          };
        }
        const [m, amt, prog, unl] = await Promise.all([
          v.get('trancheMultiple', [BigInt(k)]),
          v.get('trancheAmount', [BigInt(k)]),
          v.get('trancheProgress', [BigInt(k)]),
          v.get<boolean>('trancheUnlocked', [BigInt(k)]),
        ]);
        return {
          index: k,
          multiple: num(m) === null ? null : num(m)! / 100,
          amountWei: str(big(amt)),
          progressSeconds: num(prog),
          windowSeconds: num(r.unlockWindow),
          unlocked: unl,
        };
      }),
    );

    const streak = num(r.exitStreak);
    const target = num(r.exitStreakTarget);
    const lastHb = num(r.lastHeartbeat);
    const hbWindow = num(r.heartbeatWindow);
    const owed = big(r.owedTeam) ?? big(r.tapAccrued);
    const capBps = num(r.tapCapBps);
    const net = owed !== null && treasury > owed ? treasury - owed : treasury;
    const terminal = state === 'WIND_DOWN' || state === 'FAILED';

    const launcherInfo = launcher && launcher !== zeroAddress ? await this.launcherInfo(launcher) : null;
    const issuer = await this.issuer((r.teamWallet as Address | null) ?? null, big(r.agentId));

    return {
      vault: ref.vault,
      launcher,
      token,
      name: name ?? ref.name ?? null,
      symbol,
      state,
      treasuryWei: treasury.toString(),
      treasuryBnb,
      treasuryUsd: bnbUsd === null ? null : treasuryBnb * bnbUsd,
      bookValueWei: str(book),
      bookValueBnb: toNum(book),
      poolPriceWei: str(poolPrice),
      poolPriceBnb: toNum(poolPrice),
      premiumToBookPct: premium,
      bnbUsd,
      agentId: str(big(r.agentId)),
      chainId: this.cfg.chainId,
      blockNumber: now.blockNumber.toString(),
      readAt: now.timestamp,
      totalSupplyWei: str(totalSupply),
      redeemableSupplyWei: str(big(r.redeemableSupply)),
      lockedTeamWei: str(big(r.lockedTeam)),
      owedTeamWei: str(owed),
      salePriceWei: str(salePrice),
      floorShareOfSale: book !== null && salePrice ? Number(book) / Number(salePrice) : null,
      terms: {
        exitStreakSeconds: target,
        roundLengthSeconds: num(r.roundLength),
        cooldownSeconds: num(r.cooldown),
        exitFeeBps: num(r.exitFeeBps),
        heartbeatSeconds: hbWindow,
        tapUsdPer30d: toNum(big(r.tapUsdPer30d)),
        tapCapBps: capBps,
        unlockWindowSeconds: num(r.unlockWindow),
      },
      exit: {
        rule: 'decaying-streak-onchain',
        streakSeconds: streak,
        targetSeconds: target,
        progress: streak !== null && target ? Math.min(1, streak / target) : null,
        etaSeconds:
          state === 'ACTIVE' ? exitEta(streak, target, book !== null && poolPrice !== null && poolPrice < book) : null,
        open: state === 'EXIT_ROUND',
        roundEndsAt: state === 'EXIT_ROUND' ? num(r.roundEnd) : null,
        cooldownEndsAt: state === 'COOLDOWN' ? num(r.cooldownEnd) : null,
        exitFeeBps: num(r.exitFeeBps),
        roundsOpened: events.filter((e) => e.event === 'ExitRoundOpened').length,
      },
      tap: {
        accruedWei: str(big(r.tapAccrued) ?? owed),
        accruedBnb: toNum(big(r.tapAccrued) ?? owed),
        tapUsdPer30d: toNum(big(r.tapUsdPer30d)),
        capBps,
        capPer30dWei: capBps === null ? null : ((net * BigInt(capBps)) / 10_000n).toString(),
        totalPaidWei: str(big(r.totalTapPaid)),
        paused: state === 'EXIT_ROUND' || terminal,
      },
      tranches,
      heartbeat: {
        lastAt: lastHb,
        windowSeconds: hbWindow,
        ageSeconds: lastHb === null ? null : Math.max(0, now.timestamp - lastHb),
        dueAt: lastHb !== null && hbWindow !== null ? lastHb + hbWindow : null,
        abandonable: !terminal && lastHb !== null && hbWindow !== null && now.timestamp > lastHb + hbWindow,
      },
      trust: {
        lastObservedAt: num(r.lastObservedAt),
        lastTrusted: (r.lastTrusted as boolean | null) ?? null,
        lastStrict: (r.lastStrict as boolean | null) ?? null,
      },
      pool: { pair, reserveBnbWei: str(reserveBnb), reserveTokenWei: str(reserveToken) },
      ledger: ledgerTotals(events),
      issuer,
      launcherInfo,
      reads: { missing: [...new Set(v.missing)], abiSource: this.abis.published.length ? this.abis.published : ['fallback (docs/DESIGN.md)'] },
    };
  }

  async summary(vault: string): Promise<CovenantSummary> {
    const s = await this.sheet(vault);
    return {
      vault: s.vault, launcher: s.launcher, token: s.token, name: s.name, symbol: s.symbol, state: s.state,
      treasuryWei: s.treasuryWei, treasuryBnb: s.treasuryBnb, treasuryUsd: s.treasuryUsd, bookValueWei: s.bookValueWei,
      bookValueBnb: s.bookValueBnb, poolPriceWei: s.poolPriceWei, poolPriceBnb: s.poolPriceBnb,
      premiumToBookPct: s.premiumToBookPct, bnbUsd: s.bnbUsd, agentId: s.agentId,
    };
  }

  async list(): Promise<CovenantSummary[]> {
    await this.discover().catch(() => undefined);
    const out = await Promise.allSettled(this.covenants().map((c) => this.summary(c.vault)));
    return out.filter((o): o is PromiseFulfilledResult<CovenantSummary> => o.status === 'fulfilled').map((o) => o.value);
  }

  async history(vault: string): Promise<History> {
    const ref = this.ref(vault);
    await this.syncEvents(ref);
    const ev = this.index.events(ref.vault, 'vault');
    const points = ev
      .filter((e) => e.event === 'Observed')
      .map((e) => ({
        timestamp: e.timestamp,
        blockNumber: e.blockNumber,
        twapBnb: Number(BigInt(String(e.args.twapBnb ?? 0))) / 1e18,
        bookValueBnb: Number(BigInt(String(e.args.bookValue ?? 0))) / 1e18,
        bnbUsd: e.args.bnbUsd && e.args.bnbUsd !== '0' ? Number(BigInt(String(e.args.bnbUsd))) / 1e18 : null,
        trusted: e.args.trusted === true,
        state: stateName(typeof e.args.state === 'number' ? e.args.state : Number(e.args.state ?? 99)),
      }));
    const rounds: History['rounds'] = [];
    for (const e of ev) {
      if (e.event === 'ExitRoundOpened') {
        rounds.push({ openedAt: e.timestamp, endsAt: (e.args.endsAt ?? e.args.roundEnd) ? Number(e.args.endsAt ?? e.args.roundEnd) : null, closedAt: null });
      } else if (e.event === 'ExitRoundClosed' && rounds.length) {
        rounds[rounds.length - 1]!.closedAt = e.timestamp;
      }
    }
    return { vault: ref.vault, points, rounds };
  }

  async launcherInfo(launcher: Address): Promise<CovenantSheet['launcherInfo']> {
    const l = new Reader(this.client, launcher, this.abis.launcher, 'launcher');
    const real = hasFunction(this.abis.launcher, 'terms') && !hasFunction(this.abis.launcher, 'minRaise');
    const [state, committed, minRaise, cap, deadline] = real
      ? await Promise.all([l.get('state'), l.get('committed'), l.get<Raw>('terms'), null, l.get('saleDeadline')]).then(
          ([st, c, t, , d]) => [st, c, t?.minRaise ?? null, t?.cap ?? null, d] as const,
        )
      : await Promise.all([l.get('state'), l.get('committed'), l.get('minRaise'), l.get('cap'), l.get('deadline')]);
    return {
      state: state === null ? 'UNKNOWN' : (LAUNCHER_STATES[Number(state)] ?? 'UNKNOWN'),
      committedWei: str(big(committed)),
      minRaiseWei: str(big(minRaise)),
      capWei: str(big(cap)),
      deadline: num(deadline),
    };
  }

  /** ERC-8004 identity and reputation for the issuer, when an agent id is set and registries are configured. */
  async issuer(teamWallet: Address | null, agentId: bigint | null): Promise<IssuerInfo> {
    const info: IssuerInfo = {
      teamWallet,
      agentId: agentId ? agentId.toString() : null,
      identityRegistry: this.cfg.identityRegistry ?? null,
      registrationUri: null,
      ownerMatchesTeam: null,
      reputation: null,
    };
    if (!agentId || !this.cfg.identityRegistry) return info;
    try {
      const [owner, uri] = await Promise.all([
        this.client.readContract({ address: this.cfg.identityRegistry, abi: identityRegistryAbi, functionName: 'ownerOf', args: [agentId] }),
        this.client.readContract({ address: this.cfg.identityRegistry, abi: identityRegistryAbi, functionName: 'tokenURI', args: [agentId] }),
      ]);
      info.registrationUri = uri;
      info.ownerMatchesTeam = teamWallet ? getAddress(owner) === getAddress(teamWallet) : null;
    } catch {
      /* registry not deployed on this chain */
    }
    if (this.cfg.reputationRegistry) {
      // Count only feedback written by covenant vaults we know (ERC-8004 warns unfiltered summaries invite spam).
      const clients = this.covenants().map((c) => c.vault);
      try {
        const [count, value, decimals] = await this.client.readContract({
          address: this.cfg.reputationRegistry,
          abi: reputationRegistryAbi,
          functionName: 'getSummary',
          args: [agentId, clients, 'covenant', ''],
        });
        info.reputation = { count: count.toString(), summaryValue: value.toString(), decimals: Number(decimals), clientFilter: clients };
      } catch {
        /* no reputation registry */
      }
    }
    return info;
  }

  async tokenBalance(token: Address, holder: Address): Promise<bigint> {
    return this.client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [holder] });
  }
}

export { formatEther };
