"use client";

import { useState, type ReactNode } from "react";
import { explorerAddress, explorerTx } from "@/lib/chain/chains";
import type { CovenantState } from "@/lib/covenant/types";
import { short } from "@/lib/format";
import { Icon } from "./icons";

export const STATE_META: Record<CovenantState, { label: string; chip: string; color: string; line: string }> = {
  RAISING: { label: "Raising", chip: "chip-accent", color: "var(--accent)", line: "Commitments open" },
  FAILED: { label: "Failed", chip: "", color: "var(--faint)", line: "Minimum missed. Full refunds" },
  ACTIVE: { label: "Active", chip: "chip-good", color: "var(--good)", line: "Rules armed" },
  EXIT_ROUND: { label: "Exit round", chip: "chip-warn", color: "var(--warn)", line: "Redemption open at book" },
  COOLDOWN: { label: "Cooldown", chip: "", color: "var(--muted)", line: "Exit trigger disarmed" },
  WIND_DOWN: { label: "Wind-down", chip: "chip-bad", color: "var(--bad)", line: "Treasury open to holders" },
};

export function StateBadge({ state, size }: { state: CovenantState; size?: "lg" }) {
  const m = STATE_META[state];
  return <span className={`chip ${m.chip} ${size === "lg" ? "chip-lg" : ""}`}><span className="dot" />{m.label}</span>;
}

export function StateDot({ state }: { state: CovenantState }) {
  return <span className="state-dot" style={{ background: STATE_META[state].color }} aria-hidden />;
}

/**
 * A figure that says where it came from: hover shows the contract read or formula behind it, and a live figure
 * links to its address on the explorer. ("Every number is checkable.")
 */
export function Fig({ children, src, href, className }: { children: ReactNode; src: string; href?: string | null; className?: string }) {
  const inner = <span className={`mono fig ${className ?? ""}`} title={src}>{children}</span>;
  return href ? <a href={href} target="_blank" rel="noreferrer">{inner}</a> : inner;
}

export function Meter({ value, max, tone, marks, small, label }: { value: number; max: number; tone?: "good" | "warn" | "bad" | "agent"; marks?: number[]; small?: boolean; label?: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${tone ?? ""} ${small ? "meter-sm" : ""}`} role="meter" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${w}%` }} />
      {marks?.map((m) => <span key={m} className="tickmark" style={{ left: `${Math.min(100, (m / max) * 100)}%` }} />)}
    </div>
  );
}

export function Addr({ a, chainId, kind = "address", copy = true }: { a?: string; chainId?: number; kind?: "address" | "tx"; copy?: boolean }) {
  const [done, setDone] = useState(false);
  if (!a) return <span className="addr">–</span>;
  const href = chainId ? (kind === "tx" ? explorerTx(chainId, a) : explorerAddress(chainId, a)) : null;
  return (
    <span className="addr">
      {href ? <a href={href} target="_blank" rel="noreferrer" title={a}>{short(a)}</a> : <span title={a}>{short(a)}</span>}
      {copy ? (
        <button type="button" aria-label="Copy" title={done ? "Copied" : "Copy"} onClick={() => { void navigator.clipboard?.writeText(a).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }} style={{ color: done ? "var(--good)" : "var(--faint)", display: "inline-flex" }}>
          <Icon name={done ? "check" : "copy"} size={13} />
        </button>
      ) : null}
    </span>
  );
}

export function Stat({ k, v, s, tip }: { k: ReactNode; v: ReactNode; s?: ReactNode; tip?: string }) {
  return (
    <div className="stat" title={tip}>
      <p className="k">{k}</p>
      <div className="v">{v}</div>
      {s ? <div className="s">{s}</div> : null}
    </div>
  );
}

export function Note({ tone, icon = "info", children }: { tone?: "accent" | "warn" | "good" | "agent"; icon?: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  return (
    <div className={`note ${tone ?? ""}`}>
      <Icon name={icon} size={16} style={{ marginTop: 1, color: tone === "warn" ? "var(--warn)" : tone === "good" ? "var(--good)" : tone === "agent" ? "var(--agent)" : tone === "accent" ? "var(--accent)" : "var(--muted)" }} />
      <div>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
      <p className="d4">{title}</p>
      {children ? <div className="small muted" style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skel" style={{ height: h, width: w }} />;
}
