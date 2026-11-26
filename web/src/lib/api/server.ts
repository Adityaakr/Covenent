/*
 * Typed client for the Covenant server (server/): keeper status, CoinMarketCap-backed market data, the simulator's
 * launch sample and a signed Atlas report for the public poke button. The base URL comes from
 * NEXT_PUBLIC_COVENANT_API (default http://localhost:8787). Every call reports where its data came from, and the
 * screens fall back to the mock layer, clearly labelled, when the server does not answer.
 */
import type { Candle, SampleToken } from "@/lib/sim/replay";

export const API_BASE = (process.env.NEXT_PUBLIC_COVENANT_API || "http://localhost:8787").replace(/\/$/, "");

/** One place for the server's routes, so aligning with server/ is a one-line change. */
export const ROUTES = {
  health: "/health",
  market: (token: string) => `/api/market/${token}`,
  candles: (token: string) => `/api/candles/${token}`,
  sample: "/api/simulator/sample",
  simulator: "/api/simulator",
  pokeReport: (vault?: string) => `/api/poke-report${vault ? `?vault=${vault}` : ""}`,
  keeper: "/api/keeper/status",
};

/** A server answer. Nothing stands in for it: when the server cannot answer, the call throws and the screen says so. */
export interface Sourced<T> { data: T; source: "server" }

export interface Market {
  priceBnb: number;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  holders: number;
  securityFlags: string[];
  updatedAt: number;
  provider: string; // "CoinMarketCap DEX API" or similar
}

export interface KeeperStatus { lastPoke: number | null; nextPoke: number | null; pokes24h: number; healthy: boolean }
export interface AtlasReport { bnbUsd: number; timestamp: number; payload: `0x${string}`; signer: string }

async function get<T>(path: string, timeoutMs = 2500): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function sourced<T>(path: string, pick: (raw: unknown) => T | null): Promise<Sourced<T>> {
  const raw = await get<unknown>(path, 8000);
  const v = pick(raw);
  if (v === null) throw new Error(`unexpected response shape from ${path}`);
  return { data: v, source: "server" };
}

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const n = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN);

export async function health(): Promise<boolean> {
  try { await get(ROUTES.health, 1500); return true; } catch { return false; }
}

export function market(token: string): Promise<Sourced<Market>> {
  return sourced(ROUTES.market(token), (raw) => {
    const o = obj(raw); const d = obj(o?.data) ?? o;
    if (!d) return null;
    return {
      priceBnb: n(d.priceBnb ?? d.price_bnb), priceUsd: n(d.priceUsd ?? d.price_usd ?? d.price), liquidityUsd: n(d.liquidityUsd ?? d.liquidity), volume24hUsd: n(d.volume24hUsd ?? d.volume_24h),
      holders: n(d.holders ?? d.holder_count), securityFlags: Array.isArray(d.securityFlags) ? (d.securityFlags as string[]) : [], updatedAt: n(d.updatedAt ?? Date.now() / 1000), provider: String(d.provider ?? "CoinMarketCap DEX API"),
    };
  });
}

function toCandles(raw: unknown): Candle[] | null {
  const o = obj(raw);
  const arr = Array.isArray(raw) ? raw : Array.isArray(o?.candles) ? o!.candles : Array.isArray(o?.data) ? o!.data : null;
  if (!arr) return null;
  return (arr as unknown[]).map((c) => {
    if (Array.isArray(c)) return { t: n(c[0]) > 1e12 ? n(c[0]) / 1000 : n(c[0]), o: n(c[1]), h: n(c[2]), l: n(c[3]), c: n(c[4]), v: n(c[5]) };
    const k = obj(c)!;
    const t = n(k.t ?? k.time ?? k.timestamp);
    return { t: t > 1e12 ? t / 1000 : t, o: n(k.o ?? k.open), h: n(k.h ?? k.high), l: n(k.l ?? k.low), c: n(k.c ?? k.close), v: n(k.v ?? k.volume) };
  }).filter((c) => Number.isFinite(c.t) && Number.isFinite(c.c));
}

export function candles(token: string): Promise<Sourced<Candle[]>> {
  return sourced(ROUTES.candles(token), toCandles);
}

export function sample(): Promise<Sourced<SampleToken[]>> {
  return sourced(ROUTES.sample, (raw) => {
    const o = obj(raw);
    const arr = Array.isArray(raw) ? raw : Array.isArray(o?.tokens) ? o!.tokens : null;
    if (!arr) return null;
    return (arr as unknown[]).map((t) => {
      const k = obj(t)!;
      return { address: String(k.address ?? ""), symbol: String(k.symbol ?? "?"), name: String(k.name ?? k.symbol ?? ""), launchedAt: n(k.launchedAt ?? k.created_at ?? 0), candles: toCandles(k.candles) ?? [] };
    });
  });
}

export function keeper(): Promise<Sourced<KeeperStatus>> {
  return sourced(ROUTES.keeper, (raw) => {
    const o = obj(raw); if (!o) return null;
    return { lastPoke: o.lastPoke == null ? null : n(o.lastPoke), nextPoke: o.nextPoke == null ? null : n(o.nextPoke), pokes24h: n(o.pokes24h ?? 0), healthy: Boolean(o.healthy ?? true) };
  });
}

/** A signed Atlas BNB/USD report for the poke button, with the ready-to-send poke(vault) call when the server knows it. */
export interface PokeReport { mode: "atlas" | "local-test-signer"; bnbUsd: string; timestamp: number; signer: string; extraData: `0x${string}`; note: string; tx: { to: `0x${string}`; data: `0x${string}`; value: string } | null }

export async function pokeReport(vault?: string): Promise<PokeReport | null> {
  try {
    const o = obj(await get<unknown>(ROUTES.pokeReport(vault), 5000));
    if (!o || typeof o.extraData !== "string") return null;
    return o as unknown as PokeReport;
  } catch {
    return null;
  }
}

/** The server's simulator result (server/src/schema.ts SimulatorResult), computed from fetched market data. */
export interface SimVariant { rule: "reset" | "decay" | "twap72"; description: string; triggered: number; triggeredShare: number | null; medianDaysToTrigger: number | null; medianRedeemableShareOfRaise: number | null; medianRedeemVsMarket: number | null }
export interface SimToken { token: string; pair: string; symbol: string | null; createdAt: number | null; days: number; openPrice: number; minPriceShareOfOpen: number; lastPriceShareOfOpen: number; triggers: Record<string, { day: number; price: number; floor: number } | null> }
export interface SimulatorResult {
  schemaVersion: 1; computedFromRealData: boolean; generatedAt: string;
  source: { sample: string; candles: string; notes: string[] };
  terms: { floorShareOfOpen: number; tapCapBpsPer30d: number; exitStreakDays: number; priceProxy: string };
  sample: { requested: number; withCandles: number; minDays: number; windowStart: string | null; windowEnd: string | null };
  headline: { text: string | null; rule: string; value: number | null; reason: string | null };
  variants: SimVariant[];
  tokens: SimToken[];
}

/** The running server first, then the snapshot the server package commits (read by this app's /api/simulator). */
export async function simulator(): Promise<{ result: SimulatorResult; from: "server" | "snapshot" } | null> {
  const ok = (o: Record<string, unknown> | null) => (o && o.schemaVersion === 1 && Array.isArray(o.variants) ? (o as unknown as SimulatorResult) : null);
  try {
    const r = ok(obj(await get<unknown>(ROUTES.simulator, 3000)));
    if (r) return { result: r, from: "server" };
  } catch { /* server not running */ }
  try {
    const res = await fetch("/api/simulator", { cache: "no-store" });
    const r = res.ok ? ok(obj(await res.json())) : null;
    if (r) return { result: r, from: "snapshot" };
  } catch { /* no snapshot */ }
  return null;
}
