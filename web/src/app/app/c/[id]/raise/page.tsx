"use client";

import Link from "next/link";
import { useState } from "react";
import { IssuerBadge, TermsCard } from "@/components/app/covenant";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { Meter, Note } from "@/components/app/ui";
import { useActions } from "@/lib/data/actions";
import type { Derived } from "@/lib/covenant/derive";
import { buyerOutcome, settleRaise, startingFloorRatio } from "@/lib/covenant/math";
import { date, duration, span } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, bps, multiple, pct, price, tokens, usd } from "@/lib/format";

export default function RaisePage() {
  return <CovenantPage>{(v, d) => <Raise v={v} d={d} />}</CovenantPage>;
}

function Raise({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const [amt, setAmt] = useState("14");
  const t = v.terms;
  const open = v.state === "RAISING";
  const C = v.raise.committed;
  const a = Number(amt) || 0;
  const pos = v.position;
  const mine = (pos?.committed ?? 0) + (open ? a : 0);
  const C2 = C + (open ? a : 0);
  const r2 = settleRaise(C2, t.minRaise, t.cap, d.sp);
  const out = buyerOutcome(mine, C2, r2, d.sp);
  const floor = startingFloorRatio(t.saleBps, t.poolBps);
  const closed = v.now >= v.raise.deadline;
  const max = Math.max(t.cap * 1.05, C2);

  return (
    <div className="grid-main">
      <div className="stack">
        <div className="card">
          <div className="card-head">
            <h3 className="d4">The raise</h3>
            <span className="tiny muted">{open ? (closed ? "Sale window closed" : `Closes ${date(v.raise.deadline)} · ${duration(v.raise.deadline - v.now)} left`) : `Settled ${v.raise.launchedAt ? date(v.raise.launchedAt) : ""}`}</span>
          </div>
          <div className="card-body stack">
            <div className="row between wrap" style={{ alignItems: "baseline" }}>
              <div><span className="mono" style={{ fontSize: 32, letterSpacing: "-0.03em" }}>{bnb(C, C >= 100 ? 0 : 2)}</span> <span className="muted">BNB committed by {v.raise.contributors || "–"} wallets</span></div>
              <span className={`chip ${C >= t.cap ? "chip-accent" : C >= t.minRaise ? "chip-good" : "chip-warn"}`}>{C >= t.cap ? `${(C / t.cap).toFixed(1)}x oversubscribed` : C >= t.minRaise ? "Minimum met" : `${bnb(t.minRaise - C, 1)} BNB to the minimum`}</span>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <Meter value={C} max={max} marks={[t.minRaise, t.cap]} tone={C >= t.minRaise ? "good" : undefined} label="Committed against minimum and cap" />
              <div className="row between tiny muted"><span>0</span><span>minimum {bnb(t.minRaise, 0)}</span><span>cap {bnb(t.cap, 0)} BNB</span></div>
            </div>
            <Note tone="accent">
              <b>Commitments are not capped.</b> Above the cap, every commitment is scaled down pro rata and the rest is refunded. Below the minimum, everyone is refunded in full. A launch that reverts also refunds in full.
            </Note>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="d4">The terms in plain words</h3><span className="tiny muted">Fixed at creation</span></div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            {[
              ["coins", `${pct(t.saleBps / 10_000, 0)} of the supply is sold to buyers at one price. ${pct(t.poolBps / 10_000, 0)} seeds the pool at that same price, so ${pct(d.raise.qPool / Math.max(d.raise.Q, 1e-18) || t.poolBps / t.saleBps, 0)} of the raise goes to liquidity and the rest stays in the vault.`],
              ["shield", `From day one, each token is backed by ${pct(floor, 0)} of its sale price in treasury BNB. That floor falls as the ${v.issuer.kind === "agent" ? "agent" : "team"} spends and rises with trading tax and revenue.`],
              ["wallet", `The ${v.issuer.kind === "agent" ? "agent" : "team"} draws at most ${usd(t.tapUsdPer30d)} a month, capped at ${bps(t.tapCapBps)} of the treasury. It can lower that, never raise it.`],
              ["unlock", `Team tokens (${pct(d.teamBps / 10_000, 0)}) unlock only at ${t.trancheMultiple.map(multiple).join(", ")} the sale price held for ${span(t.unlockWindow)}.`],
              ["exit", `If the price sits under book value for ${span(t.exitStreak)}, any holder can redeem at book. No vote.`],
              ["heart", `If the ${v.issuer.kind === "agent" ? "agent" : "team"} stops for ${span(t.heartbeat)}, anyone can open the treasury to holders.`],
            ].map(([icon, line]) => (
              <div key={line} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: 10 }}>
                <Icon name={icon as "coins"} size={18} style={{ color: "var(--accent)", marginTop: 1 }} /><span className="small ink-2" style={{ color: "var(--ink-2)" }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
        <TermsCard v={v} d={d} />
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head"><h3 className="d4">{open ? "Commit BNB" : "Your position"}</h3>{pos?.committed ? <span className="chip chip-accent">You committed {bnb(pos.committed, 2)}</span> : null}</div>
          <div className="card-body stack">
            {open ? (
              <div>
                <label className="label" htmlFor="amt">Amount <span className="hint">BNB</span></label>
                <div className="input-group">
                  <input id="amt" className="field field-lg mono" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
                  <span className="unit">BNB</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  {["1", "5", "14", "50"].map((x) => <button key={x} className="btn btn-ghost btn-sm" onClick={() => setAmt(x)}>{x}</button>)}
                </div>
              </div>
            ) : null}
            <dl className="kv">
              <dt>If the raise closed now</dt><dd>{r2.failed ? "refund in full" : `${pct(r2.keptShare, 1)} kept`}</dd>
              <dt>Kept in the sale</dt><dd>{bnb(out.kept, 4)} BNB</dd>
              <dt>Refunded</dt><dd>{bnb(out.refund, 4)} BNB</dd>
              <dt>Tokens</dt><dd>{tokens(out.tokens)}</dd>
              <dt>Sale price</dt><dd>{price(r2.salePrice || d.salePrice)}</dd>
              <dt className="total ink">Backed by the treasury at launch</dt><dd className="total">{bnb(out.kept * floor, 4)} BNB</dd>
            </dl>
            <p className="tiny muted" style={{ margin: 0 }}>The worst case before you commit: of what you keep in the sale, {pct(floor, 0)} sits in the vault and can only leave through the five rules.</p>
            {open ? (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={!(a > 0) || closed} onClick={() => void run("commit", a)}>Commit {a > 0 ? `${a} BNB` : ""}</button>
                <button className="btn btn-ghost btn-lg" onClick={() => void run("finalize")} title={closed ? "Anyone can finalize after the deadline" : v.source === "mock" ? "Demo data: skips to the deadline" : "Available after the deadline"} disabled={!closed && v.source !== "mock"}>Finalize</button>
              </div>
            ) : (
              <Link className="btn btn-primary btn-lg btn-block" href={`/app/c/${v.id}/settle`}>See the settlement<Icon name="arrow" size={16} /></Link>
            )}
            {open && !closed ? <p className="tiny muted" style={{ margin: 0 }}>Anyone can call finalize once the sale window ends. One transaction refunds the excess, launches the token on Flap and creates the vault.</p> : null}
          </div>
        </div>
        <IssuerBadge v={v} />
      </div>
    </div>
  );
}
