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
  atlasReport: "/api/atlas/report",
  keeper: "/api/keeper/status",
};

export interface Sourced<T> { data: T; source: "server" | "mock"; error?: string }

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

async function sourced<T>(path: string, fallback: () => T, pick: (raw: unknown) => T | null): Promise<Sourced<T>> {
  try {
    const raw = await get<unknown>(path);
    const v = pick(raw);
    if (v === null) throw new Error("unexpected response shape");
    return { data: v, source: "server" };
  } catch (e) {
    return { data: fallback(), source: "mock", error: (e as Error).message };
  }
}

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const n = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN);

export async function health(): Promise<boolean> {
  try { await get(ROUTES.health, 1500); return true; } catch { return false; }
}

export function market(token: string, fallback: () => Market): Promise<Sourced<Market>> {
  return sourced(ROUTES.market(token), fallback, (raw) => {
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

export function candles(token: string, fallback: () => Candle[]): Promise<Sourced<Candle[]>> {
  return sourced(ROUTES.candles(token), fallback, toCandles);
}

export function sample(fallback: () => SampleToken[]): Promise<Sourced<SampleToken[]>> {
  return sourced(ROUTES.sample, fallback, (raw) => {
    const o = obj(raw);
    const arr = Array.isArray(raw) ? raw : Array.isArray(o?.tokens) ? o!.tokens : null;
    if (!arr) return null;
    return (arr as unknown[]).map((t) => {
      const k = obj(t)!;
      return { address: String(k.address ?? ""), symbol: String(k.symbol ?? "?"), name: String(k.name ?? k.symbol ?? ""), launchedAt: n(k.launchedAt ?? k.created_at ?? 0), candles: toCandles(k.candles) ?? [] };
    });
  });
}

export function keeper(fallback: () => KeeperStatus): Promise<Sourced<KeeperStatus>> {
  return sourced(ROUTES.keeper, fallback, (raw) => {
    const o = obj(raw); if (!o) return null;
    return { lastPoke: o.lastPoke == null ? null : n(o.lastPoke), nextPoke: o.nextPoke == null ? null : n(o.nextPoke), pokes24h: n(o.pokes24h ?? 0), healthy: Boolean(o.healthy ?? true) };
  });
}

/** A signed Atlas report for the poke button. No fallback: a poke without a report is sent as a plain call. */
export async function atlasReport(): Promise<AtlasReport | null> {
  try {
    const o = obj(await get<unknown>(ROUTES.atlasReport, 4000));
    if (!o || typeof o.payload !== "string") return null;
    return { bnbUsd: n(o.bnbUsd), timestamp: n(o.timestamp), payload: o.payload as `0x${string}`, signer: String(o.signer ?? "") };
  } catch {
    return null;
  }
}
