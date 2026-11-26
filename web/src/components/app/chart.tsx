"use client";

/*
 * Price against book: the pool's time-weighted price and book value per token over time, exit rounds shaded.
 * Ported from Roster's hover-readout line chart (no chart library), measured to its container so it stays sharp
 * from 360px phones to wide screens. Points are hourly or two-hourly; long ranges are thinned for drawing only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Band, PricePoint } from "@/lib/covenant/types";
import { price as fmtPrice, signedPct } from "@/lib/format";
import { dateTime } from "@/lib/covenant/time";

export function PriceBookChart({ points, bands, salePrice, height = 280, now }: { points: PricePoint[]; bands: Band[]; salePrice?: number; height?: number; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = W < 520 ? Math.min(height, 220) : height;
  const pad = { l: 12, r: W < 520 ? 12 : 92, t: 16, b: 28 };
  const pts = useMemo(() => {
    if (points.length <= 600) return points;
    const step = Math.ceil(points.length / 600);
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }, [points]);

  if (pts.length < 2) return <div ref={box} className="chart-empty">No observations yet. The first poke after launch records the sale price.</div>;

  const x0 = pts[0]!.t, x1 = pts[pts.length - 1]!.t;
  const ys = pts.flatMap((p) => [p.price, p.book]).concat(salePrice ? [salePrice] : []);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const py = (y1 - y0) * 0.1 || y1 * 0.1;
  y0 = Math.max(0, y0 - py); y1 += py;
  const sx = (t: number) => pad.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const path = (k: "price" | "book") => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(p[k]).toFixed(1)}`).join(" ");
  const below = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(Math.min(p.price, p.book)).toFixed(1)}`).join(" ") + " " + [...pts].reverse().map((p) => `L${sx(p.t).toFixed(1)} ${sy(p.book).toFixed(1)}`).join(" ") + " Z";
  const ticks = [0, 0.33, 0.66, 1].map((f) => y0 + f * (y1 - y0));
  const xt = W < 520 ? [x0, x1] : [x0, x0 + (x1 - x0) / 2, x1];
  const hp = hover === null ? null : pts[Math.round(hover * (pts.length - 1))]!;
  const last = pts[pts.length - 1]!;
  const date = (t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Pool price against book value per token"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; setHover(Math.min(1, Math.max(0, (x - pad.l) / (W - pad.l - pad.r)))); }}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.touches[0]!.clientX - r.left) / r.width) * W; setHover(Math.min(1, Math.max(0, (x - pad.l) / (W - pad.l - pad.r)))); }}>
        {bands.filter((b) => b.to > x0 && b.from < x1).map((b, i) => (
          <rect key={i} x={sx(Math.max(b.from, x0))} y={pad.t} width={Math.max(2, sx(Math.min(b.to, x1)) - sx(Math.max(b.from, x0)))} height={H - pad.t - pad.b} fill={b.kind === "round" ? "var(--warn-bg)" : "var(--neutral-bg)"} opacity={b.kind === "round" ? 1 : 0.7} />
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            {W >= 520 ? <text x={W - pad.r + 8} y={sy(t) + 4} className="chart-tick">{fmtPrice(t)}</text> : null}
          </g>
        ))}
        {xt.map((t, i) => <text key={t} x={sx(t)} y={H - 8} className="chart-tick" textAnchor={i === 0 ? "start" : i === xt.length - 1 ? "end" : "middle"}>{date(t)}</text>)}
        <path d={below} fill="var(--bad)" opacity={0.08} />
        {salePrice ? <line x1={pad.l} x2={W - pad.r} y1={sy(salePrice)} y2={sy(salePrice)} stroke="var(--faint)" strokeDasharray="3 4" /> : null}
        <path d={path("book")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path("price")} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={sx(last.t)} cy={sy(last.price)} r={3.5} fill="var(--ink)" stroke="var(--card)" strokeWidth={1.5} />
        <circle cx={sx(last.t)} cy={sy(last.book)} r={3.5} fill="var(--accent)" stroke="var(--card)" strokeWidth={1.5} />
        {hp ? (
          <g>
            <line x1={sx(hp.t)} x2={sx(hp.t)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="2 3" />
            <circle cx={sx(hp.t)} cy={sy(hp.price)} r={4} fill="var(--ink)" stroke="var(--card)" strokeWidth={1.5} />
            <circle cx={sx(hp.t)} cy={sy(hp.book)} r={4} fill="var(--accent)" stroke="var(--card)" strokeWidth={1.5} />
          </g>
        ) : null}
      </svg>
      {hp ? (
        <div className="chart-tip glass" style={{ left: `${(sx(hp.t) / W) * 100}%`, top: sy(Math.max(hp.price, hp.book)) }}>
          <div className="tiny muted" style={{ marginBottom: 4 }}>{dateTime(hp.t)}</div>
          <div className="row between tiny"><span>Pool TWAP</span><span className="mono ink">{fmtPrice(hp.price)}</span></div>
          <div className="row between tiny"><span style={{ color: "var(--accent)" }}>Book value</span><span className="mono ink">{fmtPrice(hp.book)}</span></div>
          <div className="row between tiny"><span>vs book</span><span className={`mono ${hp.price < hp.book ? "down" : "up"}`}>{signedPct(hp.price / hp.book - 1)}</span></div>
        </div>
      ) : null}
      <div className="chart-legend">
        <span><i style={{ borderColor: "var(--ink)" }} />Pool TWAP <b className="mono ink">{fmtPrice(last.price)}</b></span>
        <span><i style={{ borderColor: "var(--accent)" }} />Book value <b className="mono ink">{fmtPrice(last.book)}</b></span>
        {salePrice ? <span><i style={{ borderColor: "var(--faint)", borderTopStyle: "dashed" }} />Sale price <b className="mono ink">{fmtPrice(salePrice)}</b></span> : null}
        {bands.some((b) => b.kind === "round") ? <span><span className="swatch" style={{ background: "var(--warn-bg)", border: "1px solid color-mix(in srgb, var(--warn) 40%, transparent)" }} />Exit round</span> : null}
        <span className="faint">BNB per token · {now - x1 < 7200 ? "live" : `to ${date(x1)}`}</span>
      </div>
    </div>
  );
}

export function Sparkline({ points, width = 120, height = 32 }: { points: PricePoint[]; width?: number; height?: number }) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden><line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--line-strong)" strokeDasharray="2 3" /></svg>;
  const step = Math.max(1, Math.floor(points.length / 80));
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const ys = pts.flatMap((p) => [p.price, p.book]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const x0 = pts[0]!.t, x1 = pts[pts.length - 1]!.t;
  const sx = (t: number) => ((t - x0) / Math.max(1, x1 - x0)) * (width - 2) + 1;
  const sy = (v: number) => height - 2 - ((v - y0) / Math.max(1e-30, y1 - y0)) * (height - 4);
  const d = (k: "price" | "book") => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(p[k]).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ display: "block" }}>
      <path d={d("book")} fill="none" stroke="var(--accent)" strokeWidth="1.3" opacity={0.8} />
      <path d={d("price")} fill="none" stroke="var(--ink)" strokeWidth="1.3" />
    </svg>
  );
}
