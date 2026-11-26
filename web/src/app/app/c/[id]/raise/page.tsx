"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { IssuerBadge } from "@/components/app/covenant";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon, type IconName } from "@/components/app/icons";
import { BnbUnit, Note, StateBadge, Ticker, cx, useCountdown } from "@/components/app/ui";
import { useActions } from "@/lib/data/actions";
import type { Derived } from "@/lib/covenant/derive";
import { buyerOutcome, settleRaise, startingFloorRatio } from "@/lib/covenant/math";
import { DAY, HOUR, MINUTE, date, span } from "@/lib/covenant/time";
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
  const left = useCountdown(Math.max(0, v.raise.deadline - v.now));
  const max = Math.max(t.cap * 1.08, C);
  const at = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  const rNow = settleRaise(C, t.minRaise, t.cap, d.sp);
  const whoW = v.issuer.kind === "agent" ? "agent" : "team";

  return (
    <div className="grid-side">
      <div className="stack">
        <div className="card card-pad stack" style={{ gap: 20 }}>
          <div className="row between wrap-ok">
            <span className="lbl">{open ? "Committed so far" : "Raise result"}</span>
            {open ? <StateBadge state={v.state} /> : <span className="badge">{v.raise.launchedAt ? `Settled ${date(v.raise.launchedAt)}` : "Closed"}</span>}
          </div>
          <div className="row base wrap-ok" style={{ gap: 12 }}>
            <span className="fig-xl" style={{ fontSize: 44 }}><Ticker value={C} format={(n) => bnb(n, C >= 100 ? 0 : 2)} /><BnbUnit /></span>
            <span className={cx("badge", C >= t.cap ? "agent" : C >= t.minRaise ? "good" : "warn")}>{C >= t.cap ? `${(C / t.cap).toFixed(2)}× oversubscribed` : C >= t.minRaise ? "Minimum met" : `${bnb(t.minRaise - C, 1)} BNB to the minimum`}</span>
          </div>
          <p className="t-s muted w5" style={{ marginTop: -12 }}>From {v.raise.contributors || "–"} wallets · minimum <span className="num">{bnb(t.minRaise, 0)}</span> · cap <span className="num">{bnb(t.cap, 0)}</span> BNB</p>
          <div>
            <div className="raise-meter" role="meter" aria-label="Committed against minimum and cap" aria-valuenow={Math.round((C / t.cap) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <i className={C > t.cap ? "over" : undefined} style={{ width: at(C) }} />
              <span className="raise-mark" style={{ left: at(t.minRaise) }} />
              <span className="raise-mark" style={{ left: at(t.cap) }} />
            </div>
            <div className="raise-labels">
              <span style={{ left: 0 }}>0</span>
              <span style={{ left: at(t.minRaise) }}><b className="ink num">{bnb(t.minRaise, 0)}</b>minimum</span>
              <span style={{ left: at(t.cap) }}><b className="ink num">{bnb(t.cap, 0)}</b>cap</span>
            </div>
          </div>
          {open && !closed ? (
            <div className="stack-sm" style={{ display: "grid" }}>
              <span className="lbl">Closes {date(v.raise.deadline)}</span>
              <div className="clock" aria-label="Time left in the sale">
                {[["Days", Math.floor(left / DAY)], ["Hours", Math.floor((left % DAY) / HOUR)], ["Minutes", Math.floor((left % HOUR) / MINUTE)], ["Seconds", left % MINUTE]].map(([k, n]) => (
                  <div key={k as string}><b>{String(n).padStart(2, "0")}</b><span>{k}</span></div>
                ))}
              </div>
            </div>
          ) : open ? <Note tone="accent" icon="clock"><b>The sale window has closed.</b> Anyone can call finalize: one transaction refunds the excess, launches the token on Flap and creates the vault.</Note> : null}
        </div>

        <div className="card">
          <div className="card-head"><div><h3 className="h-card">Where the money goes</h3><p className="t-xs muted w5">{open ? "If the raise closed at today's commitments" : "How this raise settled"}</p></div></div>
          <div className="card-body">
            {rNow.failed ? <Note>Below the minimum, nothing launches and every commitment refunds in full.</Note> : (
              <div className="wf">
                {([
                  ["Committed", C, 0, "var(--line-strong)"],
                  ["Accepted", rNow.Q, 0, "var(--accent)"],
                  ["Refunded pro rata", rNow.refunded, rNow.Q, "var(--faint)"],
                  ["Seeds the pool", rNow.qPool, 0, "var(--good)"],
                  ["Vault treasury", rNow.T0, rNow.qPool, "var(--agent)"],
                ] as [string, number, number, string][]).map(([k, n, off, c], i) => (
                  <div key={k} className="wf-row">
                    <span className={i === 0 ? "ink" : "ink2"}>{k}</span>
                    <span className="wf-bar"><i style={{ left: `${(off / Math.max(C, 1e-9)) * 100}%`, width: `${(n / Math.max(C, 1e-9)) * 100}%`, background: c, animationDelay: `${i * 70}ms` }} /></span>
                    <span className="v">{bnb(n, 1)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="t-xs muted w5" style={{ marginTop: 14 }}>The pool opens at the sale price ({price(rNow.salePrice || d.salePrice)} BNB). The {whoW} never holds the raise: the vault does.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h3 className="h-card">The terms in plain words</h3><p className="t-xs muted w5">Fixed at creation</p></div><Link className="tlink" href={`/app/c/${v.id}#terms`}>All terms<Icon name="chevronRight" size={14} /></Link></div>
          <div className="card-body plain">
            {([
              ["coins", `${pct(t.saleBps / 10_000, 0)} of the supply is sold to buyers at one price. ${pct(t.poolBps / 10_000, 0)} seeds the pool at that same price, and the rest of the raise stays in the vault.`],
              ["shield", `From day one, each token is backed by ${pct(floor, 0)} of its sale price in treasury BNB. That floor falls as the ${whoW} spends and rises with trading tax and revenue.`],
              ["wallet", `The ${whoW} draws at most ${usd(t.tapUsdPer30d)} a month, capped at ${bps(t.tapCapBps)} of the treasury. It can lower that, never raise it.`],
              ["unlock", `Team tokens (${pct(d.teamBps / 10_000, 0)}) unlock only at ${t.trancheMultiple.map(multiple).join(", ")} the sale price held for ${span(t.unlockWindow)}.`],
              ["exit", `If the price sits under book value for ${span(t.exitStreak)}, any holder can redeem at book. No vote.`],
              ["heart", `If the ${whoW} stops for ${span(t.heartbeat)}, anyone can open the treasury to holders.`],
            ] as [IconName, string][]).map(([icon, line], i) => (
              <div key={line} className="rise" style={{ ["--i" as string]: i } as CSSProperties}><span className="icon-tile sm accent"><Icon name={icon} size={15} /></span><span>{line}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="stack sticky">
        <div className="card">
          <div className="card-head ruled"><h3 className="h-card">{open ? "Commit BNB" : "Your position"}</h3>{pos?.committed ? <span className="badge accent">You: {bnb(pos.committed, 2)} BNB</span> : null}</div>
          <div className="card-body ruled stack">
            {open ? (
              <div>
                <label className="label" htmlFor="amt">Amount <span className="hint">Uncapped, scaled back above the cap</span></label>
                <div className="ig">
                  <input id="amt" className="field field-xl" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} aria-invalid={amt !== "" && !(a > 0)} />
                  <span className="unit">BNB</span>
                </div>
                <div className="quick">{["1", "5", "14", "50"].map((x) => <button key={x} type="button" aria-pressed={amt === x} onClick={() => setAmt(x)}>{x} BNB</button>)}</div>
              </div>
            ) : null}
            <dl className="kv">
              <dt>If the raise closed now</dt><dd>{r2.failed ? "Refund in full" : `${pct(r2.keptShare, 1)} kept`}</dd>
              <dt>Kept in the sale</dt><dd className="num">{bnb(out.kept, 4)} BNB</dd>
              <dt>Refunded</dt><dd className="num">{bnb(out.refund, 4)} BNB</dd>
              <dt>Tokens</dt><dd className="num">{tokens(out.tokens)} {t.symbol}</dd>
              <dt>Sale price</dt><dd className="mono">{price(r2.salePrice || d.salePrice)}</dd>
              <dt className="total">Backed by the treasury at launch</dt><dd className="total num">{bnb(out.kept * floor, 4)} BNB</dd>
            </dl>
            <p className="t-xs muted w5">The worst case before you commit: of what you keep in the sale, {pct(floor, 0)} sits in the vault and can only leave through the five rules.</p>
            {open ? (
              <div className="stack-sm" style={{ display: "grid" }}>
                <button className="btn btn-primary btn-xl btn-block" disabled={!(a > 0) || closed} onClick={() => void run("commit", a)}>{closed ? "Sale window closed" : `Commit ${a > 0 ? `${a} BNB` : ""}`}</button>
                <button className="btn btn-secondary btn-block" onClick={() => void run("finalize")} title={closed ? "Anyone can finalize after the deadline" : v.source === "mock" ? "Demo data: skips to the deadline" : "Available after the deadline"} disabled={!closed && v.source !== "mock"}>Finalize the raise</button>
              </div>
            ) : (
              <Link className="btn btn-primary btn-lg btn-block" href={`/app/c/${v.id}/settle`}>See the settlement<Icon name="arrow" size={15} /></Link>
            )}
            {open && !closed ? <p className="t-xs muted w5">Anyone can call finalize once the window ends. One transaction refunds the excess, launches the token on Flap and creates the vault.</p> : null}
          </div>
        </div>
        <IssuerBadge v={v} />
      </div>
    </div>
  );
}
