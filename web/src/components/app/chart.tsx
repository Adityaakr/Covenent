"use client";

/*
 * Price against book: the pool's time-weighted price (with a soft area under it) and book value per token over time,
 * exit rounds shaded as bands. No chart library; measured to its container so it stays sharp from 360px phones to
 * wide screens. Lines draw in on mount and whenever the range changes (the parent keys the chart by range).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Band, PricePoint } from "@/lib/covenant/types";
import { price as fmtPrice, signedPct } from "@/lib/format";
import { dateTime } from "@/lib/covenant/time";

export function PriceBookChart({ points, bands, salePrice, height = 260, now, axis = true }: { points: PricePoint[]; bands: Band[]; salePrice?: number; height?: number; now: number; axis?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const gid = useId().replace(/:/g, "");
  const [W, setW] = useState(760);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = W < 520;
  const H = narrow ? Math.min(height, 210) : height;
  const pad = { l: 2, r: axis && !narrow ? 100 : 2, t: 14, b: 26 };
  const pts = useMemo(() => {
    if (points.length <= 480) return points;
    const step = Math.ceil(points.length / 480);
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }, [points]);

  if (pts.length < 2) return <div ref={box} className="chart-empty">No observations yet.<br />The first poke after launch records the sale price.</div>;

  const x0 = pts[0]!.t, x1 = pts[pts.length - 1]!.t;
  const ys = pts.flatMap((p) => [p.price, p.book]).concat(salePrice ? [salePrice] : []);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const py = (y1 - y0) * 0.12 || y1 * 0.1;
  y0 = Math.max(0, y0 - py); y1 += py;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const sx = (t: number) => pad.l + ((t - x0) / Math.max(1, x1 - x0)) * iw;
  const sy = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * ih;
  const line = (k: "price" | "book") => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(p[k]).toFixed(1)}`).join(" ");
  const area = `${line("price")} L${sx(x1).toFixed(1)} ${(H - pad.b).toFixed(1)} L${sx(x0).toFixed(1)} ${(H - pad.b).toFixed(1)} Z`;
  const ticks = [0.15, 0.5, 0.85].map((f) => y0 + f * (y1 - y0));
  const xt = narrow ? [x0, x1] : [x0, x0 + (x1 - x0) / 3, x0 + (2 * (x1 - x0)) / 3, x1];
  const hp = hover === null ? null : pts[Math.round(hover * (pts.length - 1))]!;
  const last = pts[pts.length - 1]!;
  const under = last.price < last.book;
  const date = (t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const move = (clientX: number, r: DOMRect) => { const x = ((clientX - r.left) / r.width) * W; setHover(Math.min(1, Math.max(0, (x - pad.l) / iw))); };
  const priceColor = under ? "var(--bad)" : "var(--ink)";

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Pool price ${fmtPrice(last.price)} against book value ${fmtPrice(last.book)} BNB per token`}
        onMouseMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => move(e.touches[0]!.clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => move(e.touches[0]!.clientX, e.currentTarget.getBoundingClientRect())}
        onTouchEnd={() => setHover(null)}>
        <defs>
          <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={priceColor} stopOpacity={under ? 0.16 : 0.12} />
            <stop offset="100%" stopColor={priceColor} stopOpacity={0} />
          </linearGradient>
          <pattern id={`h${gid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--warn)" strokeOpacity="0.28" strokeWidth="2" />
          </pattern>
        </defs>
        {bands.filter((b) => b.to > x0 && b.from < x1).map((b, i) => {
          const bx = sx(Math.max(b.from, x0)), bw = Math.max(2, sx(Math.min(b.to, x1)) - bx);
          return (
            <g key={i} className="fade-in">
              <rect x={bx} y={pad.t} width={bw} height={ih} fill={b.kind === "round" ? "var(--warn-bg)" : "var(--neutral-bg)"} />
              {b.kind === "round" ? <rect x={bx} y={pad.t} width={bw} height={ih} fill={`url(#h${gid})`} /> : null}
              {b.kind === "round" && bw > 58 ? <text x={bx + 8} y={pad.t + 14} className="chart-tick" style={{ fill: "var(--warn)" }}>Exit round</text> : null}
            </g>
          );
        })}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeDasharray="2 4" />
            {axis && !narrow ? <text x={W - pad.r + 10} y={sy(t) + 4} className="chart-tick">{fmtPrice(t)}</text> : null}
          </g>
        ))}
        {xt.map((t, i) => <text key={t} x={sx(t)} y={H - 6} className="chart-tick" textAnchor={i === 0 ? "start" : i === xt.length - 1 ? "end" : "middle"}>{date(t)}</text>)}
        <path d={area} fill={`url(#a${gid})`} className="fade-in" />
        {salePrice ? <line x1={pad.l} x2={W - pad.r} y1={sy(salePrice)} y2={sy(salePrice)} stroke="var(--faint)" strokeDasharray="4 4" /> : null}
        <path d={line("book")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="draw" />
        <path d={line("price")} fill="none" stroke={priceColor} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="draw" />
        <circle cx={sx(last.t)} cy={sy(last.book)} r={3.5} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} className="fade-in" />
        <circle cx={sx(last.t)} cy={sy(last.price)} r={3.5} fill={priceColor} stroke="var(--card)" strokeWidth={2} className="fade-in" />
        {axis && !narrow ? (
          <g className="fade-in">
            <rect x={W - pad.r + 6} y={sy(last.book) - 10} width={pad.r - 8} height={20} rx={6} fill="var(--accent)" />
            <text x={W - pad.r + 12} y={sy(last.book) + 4} className="chart-tick" style={{ fill: "#fff" }}>{fmtPrice(last.book)}</text>
          </g>
        ) : null}
        {hp ? (
          <g>
            <line x1={sx(hp.t)} x2={sx(hp.t)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" />
            <circle cx={sx(hp.t)} cy={sy(hp.book)} r={4.5} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} />
            <circle cx={sx(hp.t)} cy={sy(hp.price)} r={4.5} fill={hp.price < hp.book ? "var(--bad)" : "var(--ink)"} stroke="var(--card)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
      {hp ? (
        <div className="chart-tip" style={{ left: `${Math.min(84, Math.max(16, (sx(hp.t) / W) * 100))}%`, top: sy(Math.max(hp.price, hp.book)) }}>
          <div className="t-xs muted w5">{dateTime(hp.t)}</div>
          <div className="row between t-xs w5"><span className="muted">Pool TWAP</span><span className="mono ink">{fmtPrice(hp.price)}</span></div>
          <div className="row between t-xs w5"><span className="accent">Book value</span><span className="mono ink">{fmtPrice(hp.book)}</span></div>
          <div className="row between t-xs w5"><span className="muted">Against book</span><span className={`mono ${hp.price < hp.book ? "down" : "up"}`}>{signedPct(hp.price / hp.book - 1)}</span></div>
        </div>
      ) : null}
      <div className="chart-legend" style={{ marginTop: 10 }}>
        <span><i style={{ borderColor: priceColor }} />Pool TWAP</span>
        <span><i style={{ borderColor: "var(--accent)" }} />Book value</span>
        {salePrice ? <span><i style={{ borderColor: "var(--faint)", borderTopStyle: "dashed" }} />Sale price</span> : null}
        {bands.some((b) => b.kind === "round" && b.to > x0) ? <span><span className="swatch" style={{ background: "var(--warn-bg)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--warn) 40%, transparent)" }} />Exit round</span> : null}
        <span className="faint" style={{ marginLeft: "auto" }}>BNB per token · {now - x1 < 7200 ? "live" : `to ${date(x1)}`}</span>
      </div>
    </div>
  );
}

/** Book value per token over time as a small accent area, for the treasury cell. */
export function BookTrend({ points, height = 64 }: { points: PricePoint[]; height?: number }) {
  const gid = useId().replace(/:/g, "");
  if (points.length < 2) return null;
  const step = Math.max(1, Math.floor(points.length / 120));
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const W = 300, H = height;
  const ys = pts.map((p) => p.book);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < y1 * 0.02) { y0 -= y1 * 0.02; y1 += y1 * 0.02; }
  const x0 = pts[0]!.t, x1 = pts[pts.length - 1]!.t;
  const sx = (t: number) => ((t - x0) / Math.max(1, x1 - x0)) * W;
  const sy = (v: number) => H - 4 - ((v - y0) / Math.max(1e-30, y1 - y0)) * (H - 10);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(p.book).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden style={{ display: "block" }} className="chart">
      <defs><linearGradient id={`bt${gid}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#bt${gid})`} className="fade-in" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" pathLength={1} className="draw" />
    </svg>
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
  const last = pts[pts.length - 1]!;
  const c = last.price < last.book ? "var(--bad)" : "var(--good)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ display: "block", maxWidth: "100%" }}>
      <path d={d("book")} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 2" opacity={0.85} />
      <path d={d("price")} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
