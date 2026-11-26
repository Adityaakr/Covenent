/*
 * A simple per-IP rate limit for Ask AI: a sliding window held in this server instance's memory. On Vercel each
 * function instance keeps its own window, so this caps a burst from one visitor, not global spend; the Anthropic
 * console's spend limit is the backstop.
 */
export const RATE = { windowMs: 10 * 60_000, max: 20 };

const hits = new Map<string, number[]>();

/** Record one request from `key`; returns the seconds to wait when over the limit, else 0. */
export function rateLimit(key: string, now = Date.now(), rate = RATE): number {
  const from = now - rate.windowMs;
  const list = (hits.get(key) ?? []).filter((t) => t > from);
  if (list.length >= rate.max) {
    hits.set(key, list);
    return Math.ceil((list[0]! + rate.windowMs - now) / 1000);
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => t > from)) hits.delete(k);
  return 0;
}

export function resetRateLimit() {
  hits.clear();
}

/** The caller's IP from the proxy headers Vercel (and most hosts) set. */
export function clientIp(h: Headers): string {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
