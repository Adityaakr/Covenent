export const MINUTE = 60;
export const HOUR = 3_600;
export const DAY = 86_400;

/** "2d 4h", "3h 12m", "45s". Negative durations read as zero. */
export function duration(seconds: number, parts = 2): string {
  let s = Math.max(0, Math.round(seconds));
  const units: [string, number][] = [["d", DAY], ["h", HOUR], ["m", MINUTE], ["s", 1]];
  const out: string[] = [];
  for (const [u, n] of units) {
    if (s >= n || (out.length === 0 && u === "s")) {
      const v = Math.floor(s / n);
      s -= v * n;
      if (v > 0 || u === "s") out.push(`${v}${u}`);
    }
    if (out.length >= parts) break;
  }
  return out.join(" ") || "0s";
}

/**
 * A term's length in words, in the largest unit that reads well: "3 days", "36 hours", "5 minutes". The demo factory
 * runs the same rules in minutes, so a term is never assumed to be whole days.
 */
export function span(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s === 0) return "0 seconds";
  const pick: [string, number][] = [["day", DAY], ["hour", HOUR], ["minute", MINUTE], ["second", 1]];
  for (const [u, n] of pick) {
    if (s >= n && (s % n === 0 || s / n >= 10 || u === "second")) {
      const v = s % n === 0 ? s / n : Math.round((s / n) * 10) / 10;
      return `${v} ${u}${v === 1 ? "" : "s"}`;
    }
  }
  return `${s} seconds`;
}

/** Days with one decimal: "11.4". */
export function days(seconds: number, digits = 1): string {
  return (Math.max(0, seconds) / DAY).toFixed(digits);
}

/** "6 days ago", "in 12 days", relative to `now`. */
export function relative(t: number, now: number): string {
  const d = t - now;
  if (Math.abs(d) < 60) return "just now";
  const s = duration(Math.abs(d), 1);
  const words = s.replace(/(\d+)d/, (_, n) => `${n} day${n === "1" ? "" : "s"}`).replace(/(\d+)h/, (_, n) => `${n} hour${n === "1" ? "" : "s"}`).replace(/(\d+)m$/, (_, n) => `${n} min`).replace(/(\d+)s$/, (_, n) => `${n} s`);
  return d >= 0 ? `in ${words}` : `${words} ago`;
}

export function dateTime(t: number): string {
  return new Date(t * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function date(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Like span, but a year or more reads in years ("100 years", "1.5 years"): for the trading tax window. */
export function longSpan(seconds: number): string {
  const y = seconds / (365 * DAY);
  if (y < 1) return span(seconds);
  const v = Math.round(y * 10) / 10;
  return `${v} year${v === 1 ? "" : "s"}`;
}
