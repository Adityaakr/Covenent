/*
 * Contract logs that survive public BNB testnet RPCs.
 *
 * A single eth_getLogs from the deployment's first block to the head fails on every free endpoint, each in its own way
 * (measured on chain 97):
 *   - bsc-testnet-rpc.publicnode.com caps a range at 50,000 blocks and keeps logs for only a few hours: older ranges
 *     come back as an empty list, not an error, so it is used for the recent tail only;
 *   - bsc-prebsc-dataseed.bnbchain.org (BNB Chain's own) keeps the full history and allows CORS, but caps a range at
 *     5,000 blocks;
 *   - the data-seed-prebsc-* nodes refuse eth_getLogs ("limit exceeded").
 * So history is read in chunks of at most 5,000 blocks from the full-history endpoint, chunks that hit a range limit
 * are halved, each chunk is retried with backoff across the endpoints that can serve it, and results are cached for
 * the session (and in localStorage), so a refresh reads only the blocks after the last one read.
 *
 * Underneath sits a snapshot baked at build time (web/scripts/bake-testnet-logs.mjs, src/generated/testnet-logs.json)
 * of every known covenant's launcher and vault logs and test USDT transfers, with block times: the page shows the
 * history at once, server-free, and the browser reads only the blocks after the snapshot.
 *
 * On a local chain (anvil, or a fork) there is no range limit and the dev node is the only source: one query.
 */
import { createPublicClient, http, parseEventLogs, type Abi, type Log, type PublicClient } from "viem";
import type { Address, Hash } from "@/lib/covenant/types";
import snapshotJson from "@/generated/testnet-logs.json";

/** A log as stored: enough to decode it again with any ABI. */
export interface RawLog {
  address: Address;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: number;
  topics: [`0x${string}`, ...`0x${string}`[]] | [];
  data: `0x${string}`;
  /** block time (seconds), when known without another request */
  time?: number;
}

/** A decoded log: what getContractEvents returns, plus the block time when known. */
export interface DecodedLog {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: number;
  time?: number;
}

interface LogSource { url: string; maxRange: number; /** only blocks this close to the head (it prunes older logs) */ recentOnly?: number }

/** Endpoints that serve eth_getLogs on BNB testnet, best first. NEXT_PUBLIC_BSC_TESTNET_LOG_RPC goes first when set. */
export const TESTNET_LOG_SOURCES: LogSource[] = [
  ...(process.env.NEXT_PUBLIC_BSC_TESTNET_LOG_RPC ? [{ url: process.env.NEXT_PUBLIC_BSC_TESTNET_LOG_RPC, maxRange: 5_000 }] : []),
  { url: "https://bsc-prebsc-dataseed.bnbchain.org", maxRange: 5_000 },
  { url: "https://bsc-testnet-rpc.publicnode.com", maxRange: 50_000, recentOnly: 10_000 },
];

/* ---------- The baked snapshot ---------- */

interface Snapshot {
  chainId: number;
  toBlock: string;
  times: Record<string, number>;
  contracts: Record<string, { fromBlock: string; logs: [string, string, number, string[], string][] }>;
}
const SNAP = snapshotJson as unknown as Snapshot;

/** Block time from the snapshot, if it has it. */
export function snapshotTime(chainId: number, block: bigint): number | undefined {
  return SNAP.chainId === chainId ? SNAP.times[block.toString()] : undefined;
}

function fromSnapshot(chainId: number, address: Address, fromBlock: bigint): Entry | null {
  if (SNAP.chainId !== chainId) return null;
  const c = SNAP.contracts[address.toLowerCase()];
  if (!c || BigInt(c.fromBlock) > fromBlock) return null;
  const logs = c.logs
    .map(([bn, tx, li, topics, data]) => ({ address, blockNumber: BigInt(bn), transactionHash: tx as Hash, logIndex: li, topics: topics as RawLog["topics"], data: data as `0x${string}`, time: SNAP.times[bn] }))
    .filter((l) => l.blockNumber >= fromBlock);
  return { from: fromBlock, to: BigInt(SNAP.toBlock), logs };
}

/* ---------- Session cache (memory, then localStorage) ---------- */

interface Entry { from: bigint; to: bigint; logs: RawLog[] }
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const STORE_PREFIX = "cv-logs:v1:";

function load(key: string): Entry | null {
  try {
    const s = localStorage.getItem(STORE_PREFIX + key);
    if (!s) return null;
    const o = JSON.parse(s) as { from: string; to: string; logs: (Omit<RawLog, "blockNumber"> & { blockNumber: string })[] };
    return { from: BigInt(o.from), to: BigInt(o.to), logs: o.logs.map((l) => ({ ...l, blockNumber: BigInt(l.blockNumber) })) };
  } catch { return null; }
}
function save(key: string, e: Entry) {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify({ from: e.from.toString(), to: e.to.toString(), logs: e.logs.map((l) => ({ ...l, blockNumber: l.blockNumber.toString() })) }));
  } catch { /* full or blocked: memory only */ }
}

/* ---------- Chunked reads ---------- */

const clients = new Map<string, PublicClient>();
const clientFor = (url: string) => {
  let c = clients.get(url);
  if (!c) { c = createPublicClient({ transport: http(url, { timeout: 12_000, retryCount: 0 }) }) as PublicClient; clients.set(url, c); }
  return c;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRangeError = (e: unknown) => /range|limit exceeded|too many blocks|block range|ranges over|response size/i.test(String((e as { details?: string })?.details ?? (e as Error)?.message ?? e));

const toRaw = (l: Log): RawLog => ({ address: l.address as Address, blockNumber: l.blockNumber!, transactionHash: l.transactionHash! as Hash, logIndex: l.logIndex!, topics: l.topics as RawLog["topics"], data: l.data });

/** Logs of one address in [from, to] from the sources that can serve that range, chunked, with retry and backoff. */
export async function fetchRange(sources: LogSource[], address: Address, from: bigint, to: bigint, head: bigint): Promise<RawLog[]> {
  const out: RawLog[] = [];
  const range = new Map(sources.map((s) => [s.url, s.maxRange]));
  const chunks: [bigint, bigint][] = [];
  const step = BigInt(Math.max(...sources.map((s) => s.maxRange)));
  for (let a = from; a <= to; a += step) chunks.push([a, a + step - 1n > to ? to : a + step - 1n]);

  async function readChunk(a: bigint, b: bigint, depth = 0): Promise<RawLog[]> {
    const usable = sources.filter((s) => !s.recentOnly || head - a <= BigInt(s.recentOnly));
    let lastErr: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      const s = usable[attempt % usable.length];
      if (!s) break;
      const max = BigInt(range.get(s.url)!);
      if (b - a + 1n > max) {
        // split to this source's limit
        const parts: RawLog[] = [];
        for (let x = a; x <= b; x += max) parts.push(...(await readChunk(x, x + max - 1n > b ? b : x + max - 1n, depth + 1)));
        return parts;
      }
      try {
        return (await clientFor(s.url).getLogs({ address, fromBlock: a, toBlock: b })).map(toRaw);
      } catch (e) {
        lastErr = e;
        if (isRangeError(e) && max > 500n) { range.set(s.url, Number(max / 2n)); attempt--; continue; }
        await sleep(300 * 2 ** Math.min(attempt, 4));
      }
    }
    throw lastErr ?? new Error(`no log source for blocks ${a}-${b}`);
  }

  // a few chunks at a time: fast, and gentle on a free endpoint
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = await Promise.all(chunks.slice(i, i + 4).map(([a, b]) => readChunk(a, b)));
    for (const logs of batch) out.push(...logs);
  }
  return out;
}

/**
 * All logs of one contract from `fromBlock` to the head, decoded with `abi` (logs the ABI does not know are dropped).
 * `client` is the app's reader (it answers the head and, on a local chain, the logs themselves).
 */
export async function contractLogs(client: PublicClient, chainId: number, address: Address, abi: Abi, fromBlock: bigint, local: boolean): Promise<DecodedLog[]> {
  const raw = await rawLogs(client, chainId, address, fromBlock, local);
  return decode(abi, raw);
}

export function decode(abi: Abi, raw: RawLog[]): DecodedLog[] {
  const parsed = parseEventLogs({ abi, logs: raw.map((l) => ({ ...l, blockHash: null, transactionIndex: null, removed: false })) as unknown as Log[], strict: false });
  const time = new Map(raw.map((l) => [`${l.transactionHash}:${l.logIndex}`, l.time]));
  return parsed.map((p) => {
    const q = p as unknown as { eventName: string; args: Record<string, unknown>; blockNumber: bigint; transactionHash: Hash; logIndex: number };
    return { eventName: q.eventName, args: q.args ?? {}, blockNumber: q.blockNumber, transactionHash: q.transactionHash, logIndex: q.logIndex, time: time.get(`${q.transactionHash}:${q.logIndex}`) };
  });
}

/** Raw logs of one contract from `fromBlock` to the head: snapshot + cache + the blocks after them. */
export async function rawLogs(client: PublicClient, chainId: number, address: Address, fromBlock: bigint, local: boolean): Promise<RawLog[]> {
  if (local) return (await client.getLogs({ address, fromBlock })).map(toRaw);
  const key = `${chainId}:${address.toLowerCase()}:${fromBlock}`;
  const running = inflight.get(key);
  if (running) return (await running).logs;
  const p = (async () => {
    const cached = memory.get(key) ?? load(key);
    const snap = fromSnapshot(chainId, address, fromBlock);
    // the base: whichever of the cache and the snapshot reaches further
    let base: Entry = cached && (!snap || cached.to >= snap.to) ? cached : snap ?? { from: fromBlock, to: fromBlock - 1n, logs: [] };
    const head = await client.getBlockNumber().catch(() => base.to);
    if (head > base.to) {
      // Without the newest blocks the history so far is still right: keep it and try again on the next refresh.
      const fresh = await fetchRange(TESTNET_LOG_SOURCES, address, base.to + 1n, head, head).catch(() => null);
      if (!fresh) { if (base.logs.length || base.to >= base.from) return base; throw new Error("log sources unavailable"); }
      const seen = new Set(base.logs.map((l) => `${l.transactionHash}:${l.logIndex}`));
      base = { from: base.from, to: head, logs: [...base.logs, ...fresh.filter((l) => !seen.has(`${l.transactionHash}:${l.logIndex}`))] };
      base.logs.sort((x, y) => (x.blockNumber === y.blockNumber ? x.logIndex - y.logIndex : x.blockNumber < y.blockNumber ? -1 : 1));
      save(key, base);
    }
    memory.set(key, base);
    return base;
  })();
  inflight.set(key, p);
  try { return (await p).logs; } finally { inflight.delete(key); }
}
