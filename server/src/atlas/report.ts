import {
  bytesToHex,
  concatHex,
  encodeFunctionData,
  formatUnits,
  hexToBytes,
  keccak256,
  parseUnits,
  recoverAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount, sign } from 'viem/accounts';

/**
 * Atlas pull report codec, byte-for-byte with oracle-atlas/pull-oracle-consumer and
 * @atlas-oracle/pull-oracle-consumer-sdk 1.0.2:
 *
 *   extraData = [package]*count ++ count:u8 ++ signature:65 (r ++ s ++ v) ++ marker:u16 (0x7096)
 *   package   = feedId:u32 ++ value:u80 (1e18 fixed point) ++ timestamp:u48 (unix seconds)
 *   signed    = keccak256([package]*count ++ count)   -- raw hash, no EIP-191 prefix, low-s
 *
 * The SDK parses packages from the end backwards, so the last package in the byte string is the
 * first one it reports. We encode in the order given and parse in byte order.
 */

export const MAGIC_MARKER = 0x7096;
export const PACKAGE_SIZE = 20;
export const FOOTER_SIZE = 68;
/** Reference consumer limits (PullOracleReferenceHooks). */
export const MAX_DELAY_SECONDS = 180;
export const MAX_FUTURE_DRIFT_SECONDS = 60;
/** Atlas's default authorized production signer, per the Atlas pull guide (docs/DESIGN.md). */
export const ATLAS_DEFAULT_SIGNER: Address = '0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600';

export interface FeedValue {
  feedId: string; // decimal string, e.g. "1"
  price: string; // decimal string with up to 18 fraction digits, e.g. "600.25"
  timestamp: number; // unix seconds
}

export interface ParsedReport {
  packages: FeedValue[];
  count: number;
  signature: Hex;
  signedHash: Hex;
  signer: Address;
}

function u(value: bigint, bytes: number): Uint8Array {
  if (value < 0n || value >= 1n << BigInt(bytes * 8)) throw new Error(`value ${value} does not fit in ${bytes} bytes`);
  const out = new Uint8Array(bytes);
  let v = value;
  for (let i = bytes - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function readUint(b: Uint8Array): bigint {
  let r = 0n;
  for (const x of b) r = (r << 8n) | BigInt(x);
  return r;
}

export function encodePackages(feeds: FeedValue[]): Hex {
  if (feeds.length === 0 || feeds.length > 255) throw new Error('need 1..255 feed packages');
  const parts: Uint8Array[] = [];
  for (const f of feeds) {
    parts.push(u(BigInt(f.feedId), 4), u(parseUnits(f.price, 18), 10), u(BigInt(f.timestamp), 6));
  }
  parts.push(u(BigInt(feeds.length), 1));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  return bytesToHex(buf);
}

/** Sign a report with a local key. Produces extraData the Atlas consumer accepts when that key is the authorized signer. */
export async function signReport(feeds: FeedValue[], privateKey: Hex): Promise<Hex> {
  const signed = encodePackages(feeds);
  const sig = await sign({ hash: keccak256(signed), privateKey, to: 'hex' });
  // viem returns r ++ s ++ v with v in {27, 28} and low-s, as the consumer requires.
  return concatHex([signed, sig, '0x7096']);
}

export async function parseReport(extraData: Hex): Promise<ParsedReport> {
  const bytes = hexToBytes(extraData);
  if (bytes.length < FOOTER_SIZE + PACKAGE_SIZE) throw new Error('extraData too short');
  const marker = Number(readUint(bytes.slice(bytes.length - 2)));
  if (marker !== MAGIC_MARKER) throw new Error(`bad magic marker 0x${marker.toString(16)}`);
  const sigStart = bytes.length - 67;
  const count = bytes[bytes.length - 68]!;
  const start = bytes.length - 68 - count * PACKAGE_SIZE;
  if (count === 0 || start < 0) throw new Error('bad package count');
  const packages: FeedValue[] = [];
  for (let i = 0; i < count; i++) {
    const p = bytes.slice(start + i * PACKAGE_SIZE, start + (i + 1) * PACKAGE_SIZE);
    packages.push({
      feedId: readUint(p.slice(0, 4)).toString(),
      price: formatUnits(readUint(p.slice(4, 14)), 18),
      timestamp: Number(readUint(p.slice(14, 20))),
    });
  }
  const signedHash = keccak256(bytes.slice(start, sigStart));
  const signature = bytesToHex(bytes.slice(sigStart, sigStart + 65));
  const signer = await recoverAddress({ hash: signedHash, signature });
  return { packages, count, signature, signedHash, signer };
}

/** Bytes that precede the report when it is the trailing part of a call. */
export function stripReport(calldata: Hex, extraData: Hex): Hex {
  if (!calldata.toLowerCase().endsWith(extraData.slice(2).toLowerCase())) throw new Error('report is not the calldata suffix');
  return calldata.slice(0, calldata.length - (extraData.length - 2)) as Hex;
}

export type ReportMode = 'atlas' | 'local-test-signer';

export interface AtlasReport {
  mode: ReportMode;
  extraData: Hex;
  feedId: string;
  bnbUsd: string;
  timestamp: number;
  signer: Address;
  /** human note shown by the API and web */
  note: string;
}

export interface ReportSourceConfig {
  apiKey?: string;
  bnbUsdFeedId: string;
  localSignerKey: Hex;
  localBnbUsd: string;
}

/**
 * Fetch a fresh signed BNB/USD report.
 * - With ATLAS_API_KEY: the Atlas SDK fetches a signed report over HTTPS and validates freshness.
 * - Without it: a local test signer (anvil account #9 by default) signs the same layout. The
 *   timestamp follows the chain's latest block so warped local chains still pass the 180 s check.
 */
export async function fetchBnbUsdReport(cfg: ReportSourceConfig, client?: PublicClient): Promise<AtlasReport> {
  if (cfg.apiKey) {
    const { PullOracleConsumerClient } = await import('@atlas-oracle/pull-oracle-consumer-sdk');
    const sdk = new PullOracleConsumerClient({
      http: { apiKey: cfg.apiKey, timeout: 10_000 },
      validate: true,
      maxDelay: MAX_DELAY_SECONDS,
      maxFutureDrift: MAX_FUTURE_DRIFT_SECONDS,
      maxPackageCount: 10,
    });
    const { extraData } = await sdk.fetchPrices([cfg.bnbUsdFeedId]);
    const parsed = await parseReport(extraData);
    const pkg = parsed.packages.find((p) => p.feedId === cfg.bnbUsdFeedId) ?? parsed.packages[0]!;
    return {
      mode: 'atlas',
      extraData,
      feedId: pkg.feedId,
      bnbUsd: pkg.price,
      timestamp: pkg.timestamp,
      signer: parsed.signer,
      note: 'Signed by Atlas (pull mode), fetched with @atlas-oracle/pull-oracle-consumer-sdk.',
    };
  }
  let ts = Math.floor(Date.now() / 1000);
  if (client) {
    const block = await client.getBlock({ blockTag: 'latest' });
    // A chain warped forward (anvil evm_increaseTime) is ahead of the wall clock; follow it.
    ts = Math.max(ts, Number(block.timestamp));
  }
  const feeds: FeedValue[] = [{ feedId: cfg.bnbUsdFeedId, price: cfg.localBnbUsd, timestamp: ts }];
  const extraData = await signReport(feeds, cfg.localSignerKey);
  return {
    mode: 'local-test-signer',
    extraData,
    feedId: cfg.bnbUsdFeedId,
    bnbUsd: cfg.localBnbUsd,
    timestamp: ts,
    signer: privateKeyToAccount(cfg.localSignerKey).address,
    note: 'LOCAL TEST SIGNER: not Atlas. The BNB/USD value is a fixed test price (ATLAS_LOCAL_BNB_USD). Only a local chain whose oracle authorizes this signer accepts it.',
  };
}

/** Full calldata for CovenantOracle.poke(vault) with the signed report appended. */
export function pokeCalldata(oracleAbi: Abi, vault: Address, extraData?: Hex): Hex {
  const base = encodeFunctionData({ abi: oracleAbi, functionName: 'poke', args: [vault] });
  return extraData ? concatHex([base, extraData]) : base;
}
