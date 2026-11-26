"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Icon } from "@/components/app/icons";
import { Note, Segmented, Skeleton } from "@/components/app/ui";
import { API_BASE, sample } from "@/lib/api/server";
import { floorAfterMonths, startingFloorRatio } from "@/lib/covenant/math";
import { DAY, date } from "@/lib/covenant/time";
import { replay, syntheticSample, type TokenReplay } from "@/lib/sim/replay";
import { bps, pct } from "@/lib/format";

const SPLITS = [
  { value: "7000-1000", label: "70 / 10" },
  { value: "6000-1500", label: "60 / 15" },
  { value: "6000-2000", label: "60 / 20" },
  { value: "5000-2000", label: "50 / 20" },
];

export default function SimulatorPage() {
  const q = useQuery({ queryKey: ["sim-sample"], queryFn: () => sample(() => syntheticSample(50)), staleTime: 5 * 60_000 });
  const [splitKey, setSplit] = useState("6000-1500");
  const [cap, setCap] = useState(400);
  const [exitDays, setExitDays] = useState(3);
  const [saleBps, poolBps] = splitKey.split("-").map(Number) as [number, number];
  const result = useMemo(() => (q.data ? replay(q.data.data, { saleBps, poolBps, tapCapBps: cap, exitDays }) : null), [q.data, saleBps, poolBps, cap, exitDays]);
  const [filter, setFilter] = useState<"all" | "hit" | "held">("all");
  const rows = result ? result.tokens.filter((r) => filter === "all" || (filter === "hit" ? r.triggered : !r.triggered)).sort((a, b) => (a.triggerDay ?? 1e9) - (b.triggerDay ?? 1e9)) : [];

  return (
    <main className="page">
      <section className="sky">
        <div className="sky-inner" style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gap: 10, maxWidth: 780 }}>
            <p className="eyebrow">Launch simulator</p>
            <h1 className="d1">What if recent BNB launches <span className="soft">had carried a covenant?</span></h1>
            <p className="lede">Daily candles for each launch, replayed against a floor of {pct(startingFloorRatio(saleBps, poolBps), 0)} of the opening price that falls by the tap cap each month. A token triggers when it closes under the floor for {exitDays} days, counted with the decaying streak.</p>
          </div>
          {q.isLoading || !result ? <Skeleton h={110} /> : (
            <div className="stats glass" style={{ ["--n" as string]: 4 }}>
              <div className="stat"><p className="k">Would have opened an exit</p><div className="v" style={{ fontSize: 34 }}>{pct(result.share, 0)}</div><div className="s">{result.triggered} of {result.sampled} launches</div></div>
              <div className="stat"><p className="k">Median time to trigger</p><div className="v">{result.medianDays === null ? "–" : `${result.medianDays.toFixed(0)} days`}</div><div className="s">From the first candle</div></div>
              <div className="stat"><p className="k">Redeemable at that point</p><div className="v">{result.medianRedeemable === null ? "–" : pct(result.medianRedeemable, 0)}</div><div className="s">Of the raise, median, still in the vault</div></div>
              <div className="stat"><p className="k">Data</p><div className="v" style={{ fontSize: 16 }}>{q.data!.source === "server" ? "CoinMarketCap DEX" : "Synthetic sample"}</div><div className="s">{result.sampled} tokens · up to {result.daysCovered.toFixed(0)} days</div></div>
            </div>
          )}
        </div>
      </section>

      {q.data?.source === "mock" ? (
        <Note tone="warn" icon="alert"><b>Synthetic sample.</b> The Covenant server at <span className="mono">{API_BASE}</span> did not answer ({q.data.error}), so this run uses 50 generated launch curves to show the method. Do not quote this number: the real one comes from CoinMarketCap&apos;s new-launch list and daily candles once the server runs.</Note>
      ) : null}

      <div className="card card-pad">
        <div className="grid3" style={{ alignItems: "end" }}>
          <div><span className="label">Sale / pool split</span><Segmented label="Split" value={splitKey} onChange={setSplit} options={SPLITS} /></div>
          <div>
            <span className="label">Tap cap <span className="hint mono">{bps(cap)} / 30d</span></span>
            <input className="range" type="range" min={100} max={1000} step={50} value={cap} onChange={(e) => setCap(Number(e.target.value))} aria-label="Tap cap" />
          </div>
          <div>
            <span className="label">Exit streak <span className="hint mono">{exitDays} days</span></span>
            <input className="range" type="range" min={1} max={14} step={1} value={exitDays} onChange={(e) => setExitDays(Number(e.target.value))} aria-label="Exit streak days" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="d4">Launches</h3>
          <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "hit", label: "Triggered" }, { value: "held", label: "Held" }]} />
        </div>
        {q.isLoading ? <div className="card-body"><Skeleton h={240} /></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Token</th><th>Launched</th><th>Price against the covenant floor</th><th className="r">Lowest close</th><th className="r">Now</th><th className="r">Exit</th></tr></thead>
              <tbody>
                {rows.slice(0, 60).map((r) => (
                  <tr key={r.token.address + r.token.symbol}>
                    <td><span className="ink" style={{ fontWeight: 550 }}>{r.token.symbol}</span><span className="tiny muted" style={{ display: "block" }}>{r.token.name}</span></td>
                    <td className="small muted" style={{ whiteSpace: "nowrap" }}>{date(r.token.launchedAt || r.token.candles[0]?.t || 0)}</td>
                    <td><FloorChart r={r} saleBps={saleBps} poolBps={poolBps} cap={cap} /></td>
                    <td className="r mono">{pct(r.minRatio, 0)}</td>
                    <td className={`r mono ${r.lastRatio < 1 ? "down" : "up"}`}>{pct(r.lastRatio, 0)}</td>
                    <td className="r">{r.triggered ? <span className="chip chip-warn">day {r.triggerDay!.toFixed(0)} · {pct(r.redeemableShare!, 0)}</span> : <span className="chip">held</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}><Icon name="info" size={13} style={{ verticalAlign: -2 }} /> Ratios are against each token&apos;s opening price. The redeemable share is the treasury left as a share of the raise on the trigger day: {pct((saleBps - poolBps) / saleBps, 0)} at launch, falling by the cap each month. Tax income and earlier redemptions would only raise it.</p>
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
      <path d={p} fill="none" stroke="var(--ink)" strokeWidth="1.2" />
      {tx !== null ? <line x1={tx} x2={tx} y1={1} y2={H - 1} stroke="var(--warn)" strokeWidth="1.5" /> : null}
    </svg>
  );
}
