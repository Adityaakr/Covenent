import { getAddress, parseEventLogs, type Abi, type Address, type Log, type PublicClient } from 'viem';
import type { LedgerEvent } from '../schema.js';

const KIND: Record<string, LedgerEvent['kind']> = {
  TreasuryFunded: 'raise',
  Contributed: 'raise',
  Finalized: 'raise',
  Refunded: 'raise',
  RevenueRecognized: 'tax',
  TapClaimed: 'tap',
  Redeemed: 'redeem',
  Observed: 'observation',
  ExitRoundOpened: 'state',
  ExitRoundClosed: 'state',
  TrancheUnlocked: 'state',
  WoundDown: 'state',
  Heartbeat: 'team',
  TapLowered: 'team',
  ReportPosted: 'team',
};

/** Which argument carries the BNB amount for ledger rows. */
const AMOUNT_ARG: Record<string, string[]> = {
  TreasuryFunded: ['amount', 'value', 'treasury'],
  RevenueRecognized: ['amount', 'value', 'delta'],
  TapClaimed: ['amount', 'value', 'paid'],
  Redeemed: ['out', 'paid', 'bnbOut', 'amountOut'],
  Contributed: ['amount', 'value'],
  Refunded: ['amount', 'value'],
  Finalized: ['accepted'],
};

function serialize(v: unknown): string | number | boolean | null {
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  if (v === null || v === undefined) return null;
  return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));
}

interface Source {
  address: Address;
  abi: Abi;
  contract: LedgerEvent['contract'];
}

interface Cursor {
  next: bigint;
  events: LedgerEvent[];
}

/**
 * In-memory log index, fetched by filter from the launch block (no indexer, as the doc's build
 * notes say). Incremental: each sync() reads only blocks after the last one seen. Re-orgs are not
 * a concern on a local chain; on a real chain set CONFIRMATIONS to stay behind the head.
 */
export class EventIndex {
  private cursors = new Map<string, Cursor>();
  private blockTimes = new Map<bigint, number>();
  constructor(
    private client: PublicClient,
    private startBlock: bigint = 0n,
    private chunk: bigint = 5_000n,
    private confirmations: bigint = BigInt(process.env.CONFIRMATIONS ?? 0),
  ) {}

  async sync(sources: Source[]): Promise<void> {
    const head = (await this.client.getBlockNumber()) - this.confirmations;
    await Promise.all(sources.map((s) => this.syncOne(s, head)));
  }

  private async syncOne(s: Source, head: bigint) {
    const key = `${s.contract}:${s.address.toLowerCase()}`;
    const cur = this.cursors.get(key) ?? { next: this.startBlock, events: [] };
    this.cursors.set(key, cur);
    while (cur.next <= head) {
      const to = cur.next + this.chunk - 1n > head ? head : cur.next + this.chunk - 1n;
      const logs = await this.client.getLogs({ address: s.address, fromBlock: cur.next, toBlock: to });
      const decoded = parseEventLogs({ abi: s.abi, logs: logs as Log[], strict: false });
      const blocks = [...new Set(decoded.map((l) => l.blockNumber!))];
      await Promise.all(blocks.map((b) => this.blockTime(b)));
      for (const l of decoded) {
        const name = (l as { eventName?: string }).eventName;
        if (!name) continue;
        const args = ((l as { args?: Record<string, unknown> }).args ?? {}) as Record<string, unknown>;
        const amountKey = (AMOUNT_ARG[name] ?? []).find((k) => typeof args[k] === 'bigint');
        cur.events.push({
          contract: s.contract,
          event: name,
          kind: KIND[name] ?? 'other',
          blockNumber: l.blockNumber!.toString(),
          txHash: l.transactionHash!,
          logIndex: l.logIndex!,
          timestamp: this.blockTimes.get(l.blockNumber!) ?? null,
          amountWei: amountKey ? (args[amountKey] as bigint).toString() : null,
          args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, serialize(v)])),
        });
      }
      cur.next = to + 1n;
    }
  }

  private async blockTime(b: bigint): Promise<number> {
    const hit = this.blockTimes.get(b);
    if (hit !== undefined) return hit;
    const block = await this.client.getBlock({ blockNumber: b });
    const t = Number(block.timestamp);
    this.blockTimes.set(b, t);
    return t;
  }

  events(address: Address, contract: LedgerEvent['contract'] = 'vault'): LedgerEvent[] {
    return this.cursors.get(`${contract}:${getAddress(address).toLowerCase()}`)?.events ?? [];
  }

  /** forget everything, e.g. after the local chain was restarted */
  reset(): void {
    this.cursors.clear();
    this.blockTimes.clear();
  }
}

export function ledgerTotals(events: LedgerEvent[]) {
  const sum = (name: string) =>
    events.filter((e) => e.event === name && e.amountWei).reduce((n, e) => n + BigInt(e.amountWei!), 0n);
  return {
    raisedWei: sum('TreasuryFunded').toString(),
    taxInWei: sum('RevenueRecognized').toString(),
    tapOutWei: sum('TapClaimed').toString(),
    redeemedOutWei: sum('Redeemed').toString(),
  };
}

export function lastBnbUsd(events: LedgerEvent[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.event === 'Observed' && typeof e.args.bnbUsd === 'string' && e.args.bnbUsd !== '0') {
      return Number(BigInt(e.args.bnbUsd)) / 1e18;
    }
  }
  return null;
}
