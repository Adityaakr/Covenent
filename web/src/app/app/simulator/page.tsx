"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/app/icons";
import { CopyCode } from "@/components/app/live";
import { Empty, Segmented, Skeleton, Ticker, TokenAvatar, cx } from "@/components/app/ui";
import { API_BASE, sample, simulator, type SimulatorResult } from "@/lib/api/server";
import { floorAfterMonths, startingFloorRatio } from "@/lib/covenant/math";
import { DAY, date } from "@/lib/covenant/time";
import { replay, type TokenReplay } from "@/lib/sim/replay";
import { bps, pct } from "@/lib/format";

const SPLITS = [
  { value: "7000-1000", label: "70 / 10" },
  { value: "6000-1500", label: "60 / 15" },
  { value: "6000-2000", label: "60 / 20" },
  { value: "5000-2000", label: "50 / 20" },
];

export default function SimulatorPage() {
  const q = useQuery({ queryKey: ["sim-sample"], queryFn: () => sample(), retry: 1, staleTime: 5 * 60_000 });
  const real = useQuery({ queryKey: ["sim-real"], queryFn: simulator, staleTime: 5 * 60_000 });
  const [splitKey, setSplit] = useState("6000-1500");
  const [cap, setCap] = useState(400);
  const [exitDays, setExitDays] = useState(3);
  const [saleBps, poolBps] = splitKey.split("-").map(Number) as [number, number];
  // Only real candles from the Covenant server are replayed; the synthetic fallback is never shown.
  const realSample = q.data?.source === "server";
  const result = useMemo(() => (q.data && realSample ? replay(q.data.data, { saleBps, poolBps, tapCapBps: cap, exitDays }) : null), [q.data, realSample, saleBps, poolBps, cap, exitDays]);
  const [filter, setFilter] = useState<"all" | "hit" | "held">("all");
  const rows = result ? result.tokens.filter((r) => filter === "all" || (filter === "hit" ? r.triggered : !r.triggered)).sort((a, b) => (a.triggerDay ?? 1e9) - (b.triggerDay ?? 1e9)) : [];
  const rv = real.data ? (real.data.result.variants.find((x) => x.rule === "decay") ?? real.data.result.variants[0]!) : null;

  return (
    <main className="page">
      <section className="dhero rise">
        <div className="stack-sm" style={{ display: "grid", maxWidth: 760 }}>
          <span className="eyebrow">Launch simulator</span>
          <h1 className="h-hero">What if recent BNB launches <span className="soft">had carried a covenant?</span></h1>
          <p className="lede">Daily candles for each launch, replayed against a floor of {pct(startingFloorRatio(saleBps, poolBps), 0)} of the opening price that falls by the tap cap each month. A token triggers when it closes under the floor for {exitDays} days, counted with the decaying streak.</p>
        </div>
        {rv && real.data ? (
          <div className="kpis">
            <div className="kpi"><p className="k">Would have opened an exit</p><div className="v" style={{ fontSize: 30 }}>{rv.triggeredShare === null ? "–" : <Ticker value={rv.triggeredShare * 100} format={(n) => `${n.toFixed(1)}%`} />}</div><div className="s">{rv.triggered} of {real.data.result.sample.withCandles} launches</div></div>
            <div className="kpi"><p className="k">Median time to trigger</p><div className="v">{rv.medianDaysToTrigger === null ? "–" : `${rv.medianDaysToTrigger} days`}</div><div className="s">After launch</div></div>
            <div className="kpi"><p className="k">Redeemable at that point</p><div className="v">{rv.medianRedeemableShareOfRaise === null ? "–" : pct(rv.medianRedeemableShareOfRaise, 0)}</div><div className="s">Of the raise, median, still in the vault</div></div>
            <div className="kpi"><p className="k">Data</p><div className="v" style={{ fontSize: 16 }}>{real.data.result.computedFromRealData ? "Real BNB Chain launches" : "Not real data"}</div><div className="s">{real.data.result.source.candles.split(" ")[0]} daily candles</div></div>
          </div>
        ) : q.isLoading || real.isLoading ? <Skeleton h={104} r={18} /> : !result ? null : (
          <div className="kpis">
            <div className="kpi"><p className="k">Would have opened an exit</p><div className="v" style={{ fontSize: 30 }}><Ticker value={result.share * 100} format={(n) => `${n.toFixed(0)}%`} /></div><div className="s">{result.triggered} of {result.sampled} launches</div></div>
            <div className="kpi"><p className="k">Median time to trigger</p><div className="v">{result.medianDays === null ? "–" : `${result.medianDays.toFixed(0)} days`}</div><div className="s">From the first candle</div></div>
            <div className="kpi"><p className="k">Redeemable at that point</p><div className="v">{result.medianRedeemable === null ? "–" : pct(result.medianRedeemable, 0)}</div><div className="s">Of the raise, median, still in the vault</div></div>
            <div className="kpi"><p className="k">Data</p><div className="v" style={{ fontSize: 16 }}>CoinMarketCap DEX</div><div className="s">{result.sampled} tokens · up to {result.daysCovered.toFixed(0)} days</div></div>
          </div>
        )}
      </section>

      {real.data ? <RealResult r={real.data.result} from={real.data.from} /> : null}

      <section className="stack">
        <div className="sec-head"><div><h2 className="h-sec">Try other terms</h2><p className="t-s muted w5">The same method, rerun in your browser on the server&apos;s daily candles. Use it to see how terms move the result, not to quote a number.</p></div></div>
        {!realSample ? (
          <div className="card">
            <Empty title={q.isLoading ? "Loading the server's candles" : "Rerunning needs the Covenant server"} icon="flask" action={q.isLoading ? undefined : <CopyCode text="scripts/dev-all.sh" />}>
              {q.isLoading ? "Fetching daily candles for recent BNB Chain launches." : <>The server at <span className="mono">{API_BASE}</span> did not return candles{q.error ? ` (${(q.error as Error).message})` : ""}. It serves the launch candles from CoinMarketCap&apos;s DEX data; this page never replays made-up curves. Run <span className="mono">pnpm --dir server sim</span> to store them.</>}
            </Empty>
          </div>
        ) : (<>
        <div className="hgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="hcell"><span className="label" style={{ margin: 0 }}>Sale / pool split</span><Segmented label="Split" value={splitKey} onChange={setSplit} options={SPLITS} /></div>
          <div className="hcell">
            <span className="label" style={{ margin: 0 }}>Tap cap <span className="hint num">{bps(cap)} / 30d</span></span>
            <input className="range" type="range" min={100} max={1000} step={50} value={cap} onChange={(e) => setCap(Number(e.target.value))} aria-label="Tap cap" style={{ ["--fill" as string]: `${((cap - 100) / 900) * 100}%` }} />
          </div>
          <div className="hcell">
            <span className="label" style={{ margin: 0 }}>Exit streak <span className="hint num">{exitDays} days</span></span>
            <input className="range" type="range" min={1} max={14} step={1} value={exitDays} onChange={(e) => setExitDays(Number(e.target.value))} aria-label="Exit streak days" style={{ ["--fill" as string]: `${((exitDays - 1) / 13) * 100}%` }} />
          </div>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-head">
            <div><h3 className="h-card">Launches</h3><p className="t-xs muted w5">{result ? `${result.triggered} of ${result.sampled} would have opened an exit with these terms` : "Loading the sample"}</p></div>
            <Segmented size="sm" label="Filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "hit", label: "Triggered" }, { value: "held", label: "Held" }]} />
          </div>
          {q.isLoading ? <div className="card-body"><Skeleton h={240} /></div> : rows.length === 0 ? <Empty title="No launches in this filter" icon="flask" /> : (
            <div className="table-wrap" style={{ borderTop: "1px solid var(--line)" }}>
              <table className="table">
                <thead><tr><th>Token</th><th>Launched</th><th>Price against the covenant floor</th><th className="r">Lowest</th><th className="r">Now</th><th className="r">Exit</th></tr></thead>
                <tbody>
                  {rows.slice(0, 60).map((r, i) => (
                    <tr key={r.token.address + r.token.symbol} className="rise" style={{ ["--i" as string]: Math.min(i, 12) } as CSSProperties}>
                      <td><span className="row" style={{ gap: 10 }}><TokenAvatar seed={r.token.address || r.token.symbol} size={28} /><span style={{ display: "grid" }}><span className="ink">{r.token.symbol}</span><span className="t-xs muted">{r.token.name}</span></span></span></td>
                      <td className="t-s muted" style={{ whiteSpace: "nowrap" }}>{date(r.token.launchedAt || r.token.candles[0]?.t || 0)}</td>
                      <td><FloorChart r={r} saleBps={saleBps} poolBps={poolBps} cap={cap} /></td>
                      <td className="r">{pct(r.minRatio, 0)}</td>
                      <td className={cx("r", r.lastRatio < 1 ? "down" : "up")}>{pct(r.lastRatio, 0)}</td>
                      <td className="r">{r.triggered ? <span className="tag warn">day {r.triggerDay!.toFixed(0)} · {pct(r.redeemableShare!, 0)}</span> : <span className="tag">held</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>)}
        <p className="t-xs muted w5 row top" style={{ gap: 6 }}><Icon name="info" size={13} style={{ marginTop: 2 }} /><span>Ratios are against each token&apos;s opening price. The redeemable share is the treasury left as a share of the raise on the trigger day: {pct((saleBps - poolBps) / saleBps, 0)} at launch, falling by the cap each month. Tax income and earlier redemptions would only raise it.</span></p>
      </section>
    </main>
  );
}

function FloorChart({ r, saleBps, poolBps, cap }: { r: TokenReplay; saleBps: number; poolBps: number; cap: number }) {
  const W = 180, H = 34;
  const cs = r.token.candles;
  if (cs.length < 2 || r.open <= 0) return null;
  const t0 = cs[0]!.t, t1 = cs[cs.length - 1]!.t;
  const ratio = startingFloorRatio(saleBps, poolBps);
  const ys = cs.map((c) => Math.log(Math.max(1e-6, c.c / r.open)));
  const fl = cs.map((c) => Math.log(floorAfterMonths((c.t - t0) / (30 * DAY), cap, ratio)));
  const lo = Math.min(...ys, ...fl), hi = Math.max(...ys, ...fl, 0.2);
  const sx = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (W - 2) + 1;
  const sy = (v: number) => H - 2 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 4);
  const p = cs.map((c, i) => `${i ? "L" : "M"}${sx(c.t).toFixed(1)} ${sy(ys[i]!).toFixed(1)}`).join(" ");
  const f = cs.map((c, i) => `${i ? "L" : "M"}${sx(c.t).toFixed(1)} ${sy(fl[i]!).toFixed(1)}`).join(" ");
  const tx = r.triggerDay !== null ? sx(t0 + r.triggerDay * DAY) : null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="Price against the floor, log scale" style={{ display: "block" }}>
      <path d={f} fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeDasharray="3 2" />
      <path d={p} fill="none" stroke={r.triggered ? "var(--bad)" : "var(--ink)"} strokeWidth="1.3" strokeLinejoin="round" />
      {tx !== null ? <line x1={tx} x2={tx} y1={1} y2={H - 1} stroke="var(--warn)" strokeWidth="1.5" /> : null}
    </svg>
  );
}

const RULE_LABEL: Record<string, string> = { reset: "Original: reset", decay: "Fixed: decaying streak", twap72: "Fixed: 72-hour average" };

function RealResult({ r, from }: { r: SimulatorResult; from: "server" | "snapshot" }) {
  const hits = r.tokens.filter((t) => t.triggers.decay).sort((a, b) => a.triggers.decay!.day - b.triggers.decay!.day);
  return (
    <section className="stack">
      <div className="card card-pad stack">
        <div className="row wrap-ok between">
          <span className={cx("badge", r.computedFromRealData ? "good" : "warn")}><span className="dot" />{r.computedFromRealData ? "Computed from real market data" : "Not real data"}</span>
          <span className="t-xs muted w5">{from === "server" ? "Live from the Covenant server" : "Snapshot committed by the server package"} · generated {new Date(r.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</span>
        </div>
        {r.headline.text ? <p className="h-sec">{r.headline.text}</p> : <p className="t-s muted w5">{r.headline.reason}</p>}
        <div className="grid3">
          {r.variants.map((v) => (
            <div key={v.rule} className={cx("variant", v.rule === "decay" && "on")}>
              <div className="row between"><span className="t-s ink w5">{RULE_LABEL[v.rule] ?? v.rule}</span>{v.rule === "decay" ? <span className="tag accent">shipped</span> : null}</div>
              <div className="fig-lg">{v.triggeredShare === null ? "–" : pct(v.triggeredShare, 1)}</div>
              <div className="t-xs muted w5">{v.triggered} launches · median day {v.medianDaysToTrigger ?? "–"} · {v.medianRedeemableShareOfRaise === null ? "–" : pct(v.medianRedeemableShareOfRaise, 0)} of the raise left</div>
              <p className="t-xs muted w5">{v.description}</p>
            </div>
          ))}
        </div>
        <div className="t-xs muted w5" style={{ display: "grid", gap: 4 }}>
          <span>Sample: {r.sample.withCandles} of {r.sample.requested} pools with at least {r.sample.minDays} days of candles{r.sample.windowStart ? `, created ${new Date(r.sample.windowStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${new Date(r.sample.windowEnd!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Terms: floor {pct(r.terms.floorShareOfOpen, 0)} of the open, tap cap {bps(r.terms.tapCapBpsPer30d)} / 30d, {r.terms.exitStreakDays}-day streak.</span>
          {r.source.notes.map((n) => <span key={n}>· {n}</span>)}
        </div>
      </div>
      {hits.length ? (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Launch that would have opened an exit</th><th className="r">Days traded</th><th className="r">Lowest</th><th className="r">Now</th><th className="r">Round opens (decay rule)</th></tr></thead>
            <tbody>
              {hits.map((t) => (
                <tr key={t.token}>
                  <td><span className="ink">{t.symbol ?? "?"}</span><span className="t-xs mono muted" style={{ display: "block" }}>{t.token.slice(0, 10)}…{t.token.slice(-4)}</span></td>
                  <td className="r">{t.days}</td>
                  <td className="r">{pct(t.minPriceShareOfOpen, 0)}</td>
                  <td className={cx("r", t.lastPriceShareOfOpen < 1 ? "down" : "up")}>{pct(t.lastPriceShareOfOpen, 0)}</td>
                  <td className="r"><span className="tag warn">day {t.triggers.decay!.day}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
