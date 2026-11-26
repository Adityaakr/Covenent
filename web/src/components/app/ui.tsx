"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { explorerAddress, explorerTx } from "@/lib/chain/chains";
import type { CovenantState } from "@/lib/covenant/types";
import { short } from "@/lib/format";
import { BnbCoin } from "@/components/app/bnb";
import { BotAvatar, seedHue } from "./bot";
import { Icon, type IconName } from "./icons";

export type Tone = "accent" | "good" | "warn" | "bad" | "agent" | "neutral";

export const STATE_META: Record<CovenantState, { label: string; tone: Tone; color: string; line: string }> = {
  RAISING: { label: "Raising", tone: "accent", color: "var(--accent)", line: "Commitments open" },
  FAILED: { label: "Failed", tone: "neutral", color: "var(--faint)", line: "Minimum missed. Full refunds" },
  ACTIVE: { label: "Active", tone: "good", color: "var(--good)", line: "Rules armed" },
  EXIT_ROUND: { label: "Exit round", tone: "warn", color: "var(--warn)", line: "Redemption open at book" },
  COOLDOWN: { label: "Cooldown", tone: "neutral", color: "var(--muted)", line: "Exit trigger disarmed" },
  WIND_DOWN: { label: "Wind-down", tone: "bad", color: "var(--bad)", line: "Treasury open to holders" },
};

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function StateBadge({ state, size, pulse }: { state: CovenantState; size?: "lg"; pulse?: boolean }) {
  const m = STATE_META[state];
  const live = pulse ?? (state === "RAISING" || state === "EXIT_ROUND");
  return <span className={cx("badge", m.tone !== "neutral" && m.tone, size === "lg" && "lg")}><span className={cx("dot", live && "pulse")} />{m.label}</span>;
}

export function StateDot({ state }: { state: CovenantState }) {
  return <span className="state-dot" style={{ background: STATE_META[state].color }} aria-hidden />;
}

/** A figure that says where it came from: hover shows the contract read or formula behind it; live figures link out. */
export function Fig({ children, src, href, className }: { children: ReactNode; src: string; href?: string | null; className?: string }) {
  const inner = <span className={cx("fig-src", className)} title={src}>{children}</span>;
  return href ? <a href={href} target="_blank" rel="noreferrer">{inner}</a> : inner;
}

export function Meter({ value, max, tone, marks, size, label }: { value: number; max: number; tone?: "good" | "warn" | "bad" | "agent" | "ink"; marks?: number[]; size?: "sm" | "lg"; label?: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx("meter", tone, size)} role="meter" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${w}%` }} />
      {marks?.map((m) => <span key={m} className="tickmark" style={{ left: `${Math.min(100, (m / max) * 100)}%` }} />)}
    </div>
  );
}

export function Addr({ a, chainId, kind = "address", copy = true, full }: { a?: string; chainId?: number; kind?: "address" | "tx"; copy?: boolean; full?: boolean }) {
  const [done, setDone] = useState(false);
  if (!a) return <span className="addr">–</span>;
  const href = chainId ? (kind === "tx" ? explorerTx(chainId, a) : explorerAddress(chainId, a)) : null;
  const text = full ? a : short(a);
  return (
    <span className="addr">
      {href ? <a href={href} target="_blank" rel="noreferrer" title={a}>{text}</a> : <span title={a}>{text}</span>}
      {copy ? (
        <button type="button" aria-label={done ? "Copied" : "Copy"} title={done ? "Copied" : "Copy"} onClick={() => { void navigator.clipboard?.writeText(a).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }} style={done ? { color: "var(--good)" } : undefined}>
          <Icon name={done ? "check" : "copy"} size={13} />
        </button>
      ) : null}
    </span>
  );
}

export function Kpi({ k, v, s, tip, icon }: { k: ReactNode; v: ReactNode; s?: ReactNode; tip?: string; icon?: IconName }) {
  return (
    <div className="kpi" title={tip}>
      <p className="k">{icon ? <Icon name={icon} size={14} /> : null}{k}</p>
      <div className="v">{v}</div>
      {s ? <div className="s">{s}</div> : null}
    </div>
  );
}

const NOTE_ICON: Record<string, IconName> = { accent: "info", warn: "alert", good: "check", agent: "agent" };

export function Note({ tone, icon, children }: { tone?: "accent" | "warn" | "good" | "agent"; icon?: IconName; children: ReactNode }) {
  return (
    <div className={cx("note", tone)}>
      <Icon name={icon ?? (tone ? NOTE_ICON[tone]! : "info")} size={16} />
      <div>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; size?: "sm" }) {
  return (
    <div className={cx("seg", size)} role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Empty({ title, icon = "search", children, action }: { title: string; icon?: IconName; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="icon-tile"><Icon name={icon} size={20} /></span>
      <p className="h-card">{title}</p>
      {children ? <div className="t-s muted w5">{children}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", r, style }: { h?: number; w?: number | string; r?: number; style?: CSSProperties }) {
  return <div className="skel" aria-hidden style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function SecHead({ title, sub, right, id }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div className="sec-head" id={id}>
      <div style={{ minWidth: 0 }}>
        <h2 className="h-sec">{title}</h2>
        {sub ? <p className="t-s muted w5">{sub}</p> : null}
      </div>
      {right ? <div className="row wrap-ok" style={{ gap: 8 }}>{right}</div> : null}
    </div>
  );
}

/** "BNB" after an amount, with the token glyph (a wallet-style coin). */
export function BnbUnit({ className = "u" }: { className?: string }) {
  return <span className={cx(className, "bnb-u")}><BnbCoin size="0.95em" />BNB</span>;
}

/* ---------- Identity: a procedural bot per token or wallet address, and a cover hue from the same seed ---------- */

/** The seed for a covenant's identity: its token address once launched, else its launcher. */
export function seedOf(v: { token?: string; launcher?: string; id: string }): string {
  return (v.token ?? v.launcher ?? v.id).toLowerCase();
}

export function TokenAvatar({ seed, size = 40, issuer, style, label }: { seed: string; size?: number; issuer?: "agent" | "human"; style?: CSSProperties; label?: string }) {
  return (
    <span className="avatar bot" style={{ width: size, height: size, ...style }} title={label}>
      <BotAvatar seed={seed} size={size} />
      {issuer ? <span className={cx("badge-mini", issuer === "human" && "human")} aria-label={issuer === "agent" ? "Agent issuer" : "Human team"}><Icon name={issuer === "agent" ? "agent" : "user"} size={Math.max(9, Math.round(size * 0.2))} strokeWidth={1.8} /></span> : null}
    </span>
  );
}

export function coverVars(seed: string): CSSProperties {
  const h = seedHue(seed);
  return { ["--h" as string]: String(h), ["--h2" as string]: String((h + 42) % 360), ["--h3" as string]: String((h + 320) % 360) };
}

/** The curved cut the avatar sits in at the bottom-left of a cover. */
export function CoverCut({ className = "cover-cut" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 74" preserveAspectRatio="none" aria-hidden>
      <path d="M0 74V30C0 13.4 13.4 0 30 0h186c34 0 48 18 62 38s30 36 62 36Z" fill="currentColor" />
    </svg>
  );
}

/* ---------- Motion ---------- */

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A number that eases to its new value (count-up on mount, ~650 ms ease-out). Static under reduced motion. */
export function Ticker({ value, format, duration = 650, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [shown, setShown] = useState(Number.isFinite(value) ? 0 : value);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const end = value;
    const d = reducedMotion() || !Number.isFinite(start) || !Number.isFinite(end) ? 0 : duration;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = d === 0 ? 1 : Math.min(1, (t - t0) / d);
      const e = 1 - Math.pow(1 - k, 3);
      const v = k >= 1 ? end : start + (end - start) * e;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={cx("num", className)}>{format(shown)}</span>;
}

const subscribeClock = (cb: () => void) => { const id = setInterval(cb, 1000); return () => clearInterval(id); };
const clockNow = () => Math.floor(Date.now() / 1000);

/** Seconds left, ticking down once a second from the value the view computed (chain time for live, scene time for demo). */
export function useCountdown(seconds: number): number {
  const now = useSyncExternalStore(subscribeClock, clockNow, () => 0);
  const [anchor, setAnchor] = useState<{ s: number; at: number } | null>(null);
  if (now && (!anchor || anchor.s !== seconds)) setAnchor({ s: seconds, at: now });
  if (!anchor || !now) return Math.max(0, seconds);
  return Math.max(0, anchor.s - (now - anchor.at));
}

export function Countdown({ seconds, format }: { seconds: number; format: (s: number) => string }) {
  const left = useCountdown(seconds);
  return <span className="num">{format(left)}</span>;
}
