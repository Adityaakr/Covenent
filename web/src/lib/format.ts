/** Number formats used everywhere. Figures render in the mono face; these only decide digits. */

export function bnb(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A per-token price in BNB, written out like the doc does: 0.000000427. */
export function price(n: number, sig = 3): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 0.001) return n.toLocaleString("en-US", { maximumSignificantDigits: 6 });
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const digits = Math.min(18, -exp + sig - 1);
  return n.toFixed(digits);
}

export function usd(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "–";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function tokens(n: number): string {
  if (!Number.isFinite(n)) return "–";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function tokensFull(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "–";
  return `${(n * 100).toFixed(digits)}%`;
}

export function signedPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "–";
  return `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(digits)}%`;
}

export function bps(n: number): string {
  return `${(n / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/**
 * An address or hash cut to its ends. A vanity run at either end (Flap's 0x00004210…49060000) is kept whole plus four
 * more characters, so the part that tells two addresses apart is never cut away and 0x0000…0000 never shows.
 */
export function short(a?: string, left = 6, right = 4): string {
  if (!a) return "–";
  const pre = a.startsWith("0x") ? 2 : 0;
  const lead = /^(.)\1{2,}/.exec(a.slice(pre))?.[0].length ?? 0;
  const trail = /(.)\1{2,}$/.exec(a)?.[0].length ?? 0;
  const l = lead ? Math.max(left, pre + lead + 4) : left;
  const r = trail ? Math.max(right, trail + 4) : right;
  return a.length > l + r + 1 ? `${a.slice(0, l)}…${a.slice(-r)}` : a;
}

export function multiple(m100: number): string {
  return `${(m100 / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}x`;
}
