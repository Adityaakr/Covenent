"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/app/icons";
import { CopyCode } from "@/components/app/live";
import { ThinkingMark } from "@/components/app/mark";
import { Empty, Segmented, TokenAvatar, cx } from "@/components/app/ui";
import { API_BASE, sample, simulator, type SimToken, type SimulatorResult } from "@/lib/api/server";
import { floorAfterMonths, startingFloorRatio } from "@/lib/covenant/math";
import { DAY, date } from "@/lib/covenant/time";
import { replay, type Candle, type SampleToken } from "@/lib/sim/replay";
import { LOCAL_MODE } from "@/lib/chain/target";
import { bps, pct } from "@/lib/format";

type Token = SimToken & { candles?: Candle[] };

const SPLITS = [
  { value: "7000-1000", label: "70 / 10" },
  { value: "6000-1500", label: "60 / 15" },
  { value: "6000-2000", label: "60 / 20" },
  { value: "5000-2000", label: "50 / 20" },
];

const RULES: Record<string, { name: string; note: string }> = {
  reset: { name: "Consecutive days, reset", note: "One day at or above the floor wipes the streak, so a brief pump holds the exit off indefinitely." },
  decay: { name: "Decaying streak", note: "A day above takes one day off instead of resetting, so a pump only delays the exit by as long as it lasts." },
  twap72: { name: "72-hour average", note: "Needs the 3-day average under the floor; a pump has to move the average, so it is slower to react." },
};

export default function SimulatorPage() {
  const real = useQuery({ queryKey: ["sim-real"], queryFn: simulator, staleTime: 5 * 60_000 });
  const q = useQuery({ queryKey: ["sim-sample"], queryFn: () => sample(), retry: 1, staleTime: 5 * 60_000 });
  const r = real.data?.result;

  return (
    <div className="set-body">
      <header className="phead rise">
        <span className="eyebrow">Launch simulator</span>
        {real.isLoading ? <p className="loading-line"><ThinkingMark size={16} />Loading the simulator result…</p>
          : <h2 className="h-page">{r?.headline.text ?? "What recent BNB Chain launches would have done under a covenant"}</h2>}
        {r ? <p className="t-s muted w5">{r.computedFromRealData ? "Real launches" : "Not real data"}: {r.sample.withCandles} BNB Chain pools with at least {r.sample.minDays} days of daily candles{r.sample.windowStart ? `, created ${new Date(r.sample.windowStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${new Date(r.sample.windowEnd!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Floor {pct(r.terms.floorShareOfOpen, 0)} of the opening price, tap cap {bps(r.terms.tapCapBpsPer30d)} a month, {r.terms.exitStreakDays}-day streak. {real.data?.from === "server" ? "From the Covenant server" : "From the server's committed snapshot"}, computed {new Date(r.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC.</p> : null}
      </header>

      {!real.isLoading && !r ? (
        <div className="card">{LOCAL_MODE
          ? <Empty title="No simulator result to show" icon="flask" action={<CopyCode text="pnpm --dir server sim" />}>The Covenant server at <span className="mono">{API_BASE}</span> did not answer and there is no committed snapshot. Run the stack with <span className="mono">scripts/dev-all.sh</span>, or compute the result once. Nothing is shown in its place.</Empty>
          : <Empty title="The simulator result did not load" icon="flask">The last result from real BNB Chain launches could not be loaded just now. Nothing is shown in its place; reload to try again.</Empty>}</div>
      ) : r ? (
        <>
          <Rules r={r} />
          <Launches r={r} />
          <Rerun r={r} sampleState={q} />
          <section className="sect" aria-label="Data and sample bias">
            <h2 className="h-sec" style={{ fontSize: 18 }}>Data and sample bias</h2>
            <ul className="notes-list">
              <li><b>Launches.</b> {r.source.sample}</li>
              <li><b>Prices.</b> {r.source.candles}. Price per day is {r.terms.priceProxy}.</li>
              {r.source.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <p className="t-xs muted w5" style={{ maxWidth: "76ch" }}>Method, briefly: each launch&apos;s floor starts at {pct(r.terms.floorShareOfOpen, 0)} of its opening price (the treasury per token under a 60 / 15 split) and falls by the tap cap each month. A round opens when the price stays under the floor for {r.terms.exitStreakDays} days under each rule. &ldquo;Raise left&rdquo; is the treasury on that day as a share of the raise; &ldquo;redeem vs market&rdquo; compares redeeming at book with the price then.</p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Rules({ r }: { r: SimulatorResult }) {
  const n = r.sample.withCandles;
  return (
    <section className="sect" aria-label="Exit rules compared">
      <div><h2 className="h-sec" style={{ fontSize: 18 }}>Three exit rules on the same launches</h2><p className="t-s muted w5">Covenant ships the decaying streak, the fix for the original rule&apos;s reset.</p></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Rule</th><th className="r">Would trigger</th><th className="r">Median day</th><th className="r">Raise left</th><th className="r">Redeem vs market</th><th>Against a pumped price</th></tr></thead>
          <tbody>
            {r.variants.map((v) => (
              <tr key={v.rule}>
                <td style={{ whiteSpace: "nowrap" }}><span className="row" style={{ gap: 8 }}>{v.rule === r.headline.rule ? <Icon name="check" size={14} style={{ color: "var(--good)" }} /> : <span style={{ width: 14 }} />}<span className={v.rule === r.headline.rule ? "ink" : ""}>{RULES[v.rule]?.name ?? v.rule}</span>{v.rule === r.headline.rule ? <span className="t-xs muted">shipped</span> : null}</span></td>
                <td className="r">{v.triggered} of {n}</td>
                <td className="r">{v.medianDaysToTrigger ?? "–"}</td>
                <td className="r">{v.medianRedeemableShareOfRaise === null ? "–" : pct(v.medianRedeemableShareOfRaise, 0)}</td>
                <td className="r">{v.medianRedeemVsMarket == null ? "–" : `${v.medianRedeemVsMarket.toFixed(2)}×`}</td>
                <td className="t-s muted" style={{ minWidth: 280, whiteSpace: "normal" }}>{RULES[v.rule]?.note ?? v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Price against the opening price and the falling floor, per day. */
function series(t: Token, floorShare: number, capBps: number) {
  const cs = t.candles ?? [];
  if (cs.length < 2 || t.openPrice <= 0) return null;
  const t0 = cs[0]!.t;
  return cs.map((c) => ({ d: (c.t - t0) / DAY, p: ((c.o + c.h + c.l + c.c) / 4) / t.openPrice, f: floorAfterMonths((c.t - t0) / (30 * DAY), capBps, floorShare) }));
}

function Launches({ r }: { r: SimulatorResult }) {
  const rule = r.headline.rule || "decay";
  const tokens = useMemo(() => [...(r.tokens as Token[])].sort((a, b) => (a.triggers[rule]?.day ?? 1e9) - (b.triggers[rule]?.day ?? 1e9) || a.lastPriceShareOfOpen - b.lastPriceShareOfOpen), [r.tokens, rule]);
  const [sel, setSel] = useState(0);
  const t = tokens[Math.min(sel, tokens.length - 1)];
  const hit = tokens.filter((x) => x.triggers[rule]).length;
  return (
    <section className="sect" aria-label="The launches">
      <div><h2 className="h-sec" style={{ fontSize: 18 }}>The {tokens.length} launches</h2><p className="t-s muted w5">{hit} would have opened an exit round under the shipped rule. Pick one to see its price against the floor.</p></div>
      <div className="sim-split">
        <div className="table-wrap sim-list">
          <table className="table">
            <thead><tr><th>Launch</th><th className="r">Days</th><th className="r">Lowest</th><th className="r">Now</th><th>Price vs floor</th><th className="r">Exit</th></tr></thead>
            <tbody>
              {tokens.map((x, i) => {
                const tr = x.triggers[rule];
                return (
                  <tr key={x.token} className={cx("click", i === sel && "sel")} onClick={() => setSel(i)} aria-selected={i === sel}>
                    <td><span className="row" style={{ gap: 10 }}><TokenAvatar seed={x.token} size={26} /><span style={{ display: "grid", minWidth: 0 }}><span className="ink trunc" style={{ maxWidth: 140 }}>{x.symbol ?? "?"}</span><span className="t-xs mono muted">{x.token.slice(0, 6)}…{x.token.slice(-4)}</span></span></span></td>
                    <td className="r">{x.days}</td>
                    <td className="r">{pct(x.minPriceShareOfOpen, 0)}</td>
                    <td className={cx("r", x.lastPriceShareOfOpen < 1 ? "down" : "up")}>{pct(x.lastPriceShareOfOpen, 0)}</td>
                    <td><MiniFloor t={x} r={r} /></td>
                    <td className="r">{tr ? <span className="warn-t">day {tr.day}</span> : <span className="faint">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {t ? <FloorDetail key={t.token} t={t} r={r} rule={rule} /> : null}
      </div>
    </section>
  );
}

function MiniFloor({ t, r }: { t: Token; r: SimulatorResult }) {
  const s = series(t, r.terms.floorShareOfOpen, r.terms.tapCapBpsPer30d);
  if (!s) return <span className="faint">–</span>;
  const W = 120, H = 28;
  const ys = s.flatMap((x) => [Math.log(Math.max(1e-6, x.p)), Math.log(x.f)]);
  const lo = Math.min(...ys), hi = Math.max(...ys, 0.1);
  const dmax = s[s.length - 1]!.d || 1;
  const sx = (d: number) => (d / dmax) * (W - 2) + 1;
  const sy = (v: number) => H - 2 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 4);
  const line = (k: "p" | "f") => s.map((x, i) => `${i ? "L" : "M"}${sx(x.d).toFixed(1)} ${sy(Math.log(Math.max(1e-6, x[k]))).toFixed(1)}`).join(" ");
  const tr = t.triggers[r.headline.rule || "decay"];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="Price against the floor, log scale" style={{ display: "block" }}>
      <path d={line("f")} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d={line("p")} fill="none" stroke={tr ? "var(--warn)" : "var(--ink)"} strokeWidth="1.3" strokeLinejoin="round" />
      {tr ? <line x1={sx(tr.day)} x2={sx(tr.day)} y1={1} y2={H - 1} stroke="var(--warn)" strokeWidth="1.2" /> : null}
    </svg>
  );
}

function FloorDetail({ t, r, rule }: { t: Token; r: SimulatorResult; rule: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(520);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, Math.round(el.clientWidth - 2))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = series(t, r.terms.floorShareOfOpen, r.terms.tapCapBpsPer30d);
  const tr = t.triggers[rule];
  const H = 240, pad = { l: 48, r: 8, t: 12, b: 24 };
  let chart = null;
  if (s) {
    const ys = s.flatMap((x) => [Math.log10(Math.max(1e-6, x.p)), Math.log10(x.f)]);
    const lo = Math.floor(Math.min(...ys) * 2) / 2, hi = Math.ceil(Math.max(...ys, 0.2) * 2) / 2;
    const dmax = s[s.length - 1]!.d || 1;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const sx = (d: number) => pad.l + (d / dmax) * iw;
    const sy = (v: number) => pad.t + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * ih;
    const line = (k: "p" | "f") => s.map((x, i) => `${i ? "L" : "M"}${sx(x.d).toFixed(1)} ${sy(Math.log10(Math.max(1e-6, x[k]))).toFixed(1)}`).join(" ");
    const ticks: number[] = [];
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) ticks.push(v);
    const fmt = (v: number) => { const x = Math.pow(10, v); return x >= 1 ? `${(x * 100).toLocaleString("en-US")}%` : `${+(x * 100).toPrecision(2)}%`; };
    const streakFrom = tr ? sx(Math.max(0, tr.day - r.terms.exitStreakDays)) : 0;
    chart = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.symbol ?? "Launch"}: price against the covenant floor, log scale`} className="chart" style={{ display: "block" }}>
        {ticks.map((v) => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeDasharray="2 4" /><text x={pad.l - 8} y={sy(v) + 4} textAnchor="end" className="chart-tick">{fmt(v)}</text></g>)}
        {[0, dmax / 2, dmax].map((d, i) => <text key={i} x={sx(d)} y={H - 6} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="chart-tick">day {Math.round(d)}</text>)}
        {tr ? <><rect x={streakFrom} y={pad.t} width={Math.max(2, sx(tr.day) - streakFrom)} height={ih} fill="var(--warn-bg)" /><line x1={sx(tr.day)} x2={sx(tr.day)} y1={pad.t} y2={H - pad.b} stroke="var(--warn)" strokeWidth="1.5" /></> : null}
        <path d={line("f")} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="5 4" />
        <path d={line("p")} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" pathLength={1} className="draw" />
      </svg>
    );
  }
  return (
    <div className="sim-detail" ref={box}>
      <div className="row between wrap-ok" style={{ gap: 8 }}>
        <span className="row" style={{ gap: 10 }}><TokenAvatar seed={t.token} size={30} /><span style={{ display: "grid" }}><span className="h-card" style={{ fontSize: 15 }}>{t.symbol ?? "?"}</span><span className="t-xs muted w5">{t.createdAt ? `Launched ${date(t.createdAt)}` : "Launch date unknown"} · {t.days} days traded</span></span></span>
        <span className={cx("t-s w5", tr ? "warn-t" : "muted")}>{tr ? `Exit round opens on day ${tr.day}` : "Never under the floor long enough"}</span>
      </div>
      {chart ?? <p className="t-s muted w5">The server&apos;s result has no candles for this launch.</p>}
      <div className="chart-legend"><span><i style={{ borderColor: "var(--ink)" }} />Price, share of the opening price</span><span><i style={{ borderColor: "var(--accent)", borderTopStyle: "dashed" }} />Covenant floor</span>{tr ? <span><span className="swatch" style={{ background: "var(--warn-bg)" }} />Streak before the round</span> : null}</div>
      <dl className="kv">
        <dt>Lowest</dt><dd className="num">{pct(t.minPriceShareOfOpen, 0)} of the open</dd>
        <dt>Latest</dt><dd className="num">{pct(t.lastPriceShareOfOpen, 0)} of the open</dd>
        <dt>Pair</dt><dd className="mono t-xs">{t.pair.slice(0, 8)}…{t.pair.slice(-6)}</dd>
      </dl>
    </div>
  );
}

function Rerun({ r, sampleState }: { r: SimulatorResult; sampleState: { data?: { data: SampleToken[] }; isLoading: boolean; error: unknown } }) {
  const [splitKey, setSplit] = useState("6000-1500");
  const [cap, setCap] = useState(r.terms.tapCapBpsPer30d);
  const [exitDays, setExitDays] = useState(r.terms.exitStreakDays);
  const [saleBps, poolBps] = splitKey.split("-").map(Number) as [number, number];
  const result = useMemo(() => (sampleState.data ? replay(sampleState.data.data, { saleBps, poolBps, tapCapBps: cap, exitDays }) : null), [sampleState.data, saleBps, poolBps, cap, exitDays]);
  return (
    <section className="sect" aria-label="Rerun with other terms">
      <div><h2 className="h-sec" style={{ fontSize: 18 }}>Rerun with other terms</h2><p className="t-s muted w5">The same launches&apos; candles, replayed in your browser. Use it to see how terms move the result; the headline is the server&apos;s run.</p></div>
      {sampleState.isLoading ? <p className="loading-line"><ThinkingMark size={16} />Loading the server&apos;s candles…</p> : !result ? (
        <p className="t-s muted w5">{LOCAL_MODE ? <>The server did not return candles{sampleState.error ? ` (${(sampleState.error as Error).message})` : ""}. Run <span className="mono">pnpm --dir server sim</span> to store them.</> : <>Rerunning with other terms needs the launches&apos; daily candles from the Covenant market-data server, which this site does not run. The result above is the full run on real launches.</>}</p>
      ) : (
        <>
          <div className="hgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", borderRadius: 14 }}>
            <div className="hcell"><span className="label" style={{ margin: 0 }}>Sale / pool split <span className="hint num">floor {pct(startingFloorRatio(saleBps, poolBps), 0)}</span></span><Segmented size="sm" label="Split" value={splitKey} onChange={setSplit} options={SPLITS} /></div>
            <div className="hcell"><span className="label" style={{ margin: 0 }}>Tap cap <span className="hint num">{bps(cap)} / 30d</span></span><input className="range" type="range" min={100} max={1000} step={50} value={cap} onChange={(e) => setCap(Number(e.target.value))} aria-label="Tap cap" style={{ ["--fill" as string]: `${((cap - 100) / 900) * 100}%` } as CSSProperties} /></div>
            <div className="hcell"><span className="label" style={{ margin: 0 }}>Exit streak <span className="hint num">{exitDays} days</span></span><input className="range" type="range" min={1} max={14} step={1} value={exitDays} onChange={(e) => setExitDays(Number(e.target.value))} aria-label="Exit streak days" style={{ ["--fill" as string]: `${((exitDays - 1) / 13) * 100}%` } as CSSProperties} /></div>
          </div>
          <p className="t-s ink2 w5">With these terms, <b className="num">{result.triggered} of {result.sampled}</b> launches would trigger{result.medianDays !== null ? <>, a median <b className="num">{result.medianDays.toFixed(0)} days</b> in</> : null}{result.medianRedeemable !== null ? <>, with <b className="num">{pct(result.medianRedeemable, 0)}</b> of the raise left</> : null}.</p>
        </>
      )}
    </section>
  );
}
