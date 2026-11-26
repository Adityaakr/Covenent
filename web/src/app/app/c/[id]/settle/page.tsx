"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { BnbUnit, Empty, Note, Ticker } from "@/components/app/ui";
import { useActions } from "@/lib/data/actions";
import type { Derived } from "@/lib/covenant/derive";
import { buyerOutcome } from "@/lib/covenant/math";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, pct, price, tokens, tokensFull } from "@/lib/format";

export default function SettlePage() {
  return <CovenantPage>{(v, d) => <Settle v={v} d={d} />}</CovenantPage>;
}

function Settle({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const r = d.raise;
  const failed = v.state === "FAILED" || r.failed;
  const pos = v.position;
  const mine = pos ? buyerOutcome(pos.committed, v.raise.committed, r, d.sp) : null;
  const accepted = pos?.accepted || mine?.kept || 0;
  const refund = failed ? pos?.committed ?? 0 : pos?.refund || mine?.refund || 0;
  const alloc = pos?.allocation || mine?.tokens || 0;

  if (v.state === "RAISING") {
    return (
      <div className="card"><Empty title="The raise has not settled yet" icon="clock" action={<Link className="btn btn-primary btn-sm" href={`/app/c/${v.id}/raise`}>Back to the raise</Link>}>Once the sale window ends, anyone can finalize it. Your tokens and refund appear here.</Empty></div>
    );
  }

  const C = Math.max(v.raise.committed, 1e-9);
  const steps: [string, string][] = failed ? [
    ["Committed by buyers", `${bnb(v.raise.committed)} BNB`],
    ["Minimum", `${bnb(v.terms.minRaise, 0)} BNB`],
    ["Result", "Failed: every commitment refunds in full"],
  ] : [
    ["Committed by buyers", `${bnb(v.raise.committed, 0)} BNB (${r.oversubscription.toFixed(1)}× the cap)`],
    ["Accepted", `${bnb(r.Q, 0)} BNB`],
    ["Refunded pro rata", `${bnb(r.refunded, 0)} BNB (each buyer keeps ${pct(r.keptShare, 1)})`],
    ["Sale price", `${bnb(r.Q, 0)} / ${tokens(d.sp.A)} = ${price(r.salePrice)} BNB`],
    ["Pool seed", `${bnb(r.qPool, 0)} BNB + ${tokens(d.sp.P)} tokens, at the sale price`],
    ["Treasury", `${bnb(r.T0, 0)} BNB, held by the vault`],
    ["Book value per token", `${bnb(r.T0, 0)} / ${tokens(d.sp.A + d.sp.P)} = ${price(r.T0 / (d.sp.A + d.sp.P))} BNB (${pct(d.startRatio, 0)} of the sale price)`],
  ];
  const seg = (n: number, c: string, label: string, i: number) => n > 0 ? <div key={label} title={`${label}: ${bnb(n)} BNB`} style={{ flexGrow: n / C, flexBasis: 0, background: c, animation: `grow 600ms var(--ease) both ${i * 80}ms`, transformOrigin: "left" }}>{n / C > 0.12 ? label : ""}</div> : null;

  return (
    <div className="grid-side">
      <div className="stack">
        <div className="card">
          <div className="card-head"><div><h3 className="h-card">Result of the raise</h3><p className="t-xs muted w5">{failed ? "The minimum was missed" : "One transaction settled all of this"}</p></div><span className={failed ? "badge" : "badge good"}>{failed ? "Failed" : "Launched"}</span></div>
          <div className="card-body stack">
            {failed ? (
              <div className="split-bar">{seg(v.raise.committed, "var(--faint)", "Refunded in full", 0)}</div>
            ) : (
              <>
                <div className="split-bar" aria-label="Commitments: accepted and refunded">{seg(r.Q, "var(--accent-strong)", `Accepted ${bnb(r.Q, 0)}`, 0)}{seg(r.refunded, "var(--line-strong)", `Refunded ${bnb(r.refunded, 0)}`, 1)}</div>
                <div className="split-bar" style={{ width: `${(r.Q / C) * 100}%`, minWidth: 220 }} aria-label="Accepted: pool and treasury">{seg(r.qPool, "var(--good)", `Pool ${bnb(r.qPool, 0)}`, 2)}{seg(r.T0, "var(--agent)", `Vault ${bnb(r.T0, 0)}`, 3)}</div>
              </>
            )}
          </div>
          <div className="table-wrap" style={{ borderTop: "1px solid var(--line)" }}>
            <table className="table">
              <tbody>{steps.map(([k, val], i) => <tr key={k} className="rise" style={{ ["--i" as string]: i } as CSSProperties}><td className="muted">{k}</td><td className="r ink" style={{ whiteSpace: "normal" }}>{val}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        {!failed ? <Note icon="shield">It refunded the excess, launched the token on Flap with the pool at the sale price, created the vault and moved <span className="num">{bnb(r.T0, 0)}</span> BNB into it. The {v.issuer.kind === "agent" ? "agent" : "team"} never held the raise.</Note> : null}
      </div>

      <div className="stack sticky">
        <div className="card">
          <div className="card-head ruled"><h3 className="h-card">Your settlement</h3>{pos ? <span className="t-xs muted w5">Connected wallet</span> : null}</div>
          <div className="card-body ruled stack">
            {!pos || pos.committed === 0 ? <Empty title="Nothing to settle here" icon="wallet">Connect the wallet you committed from to see your tokens and refund.</Empty> : (
              <>
                <div style={{ display: "grid", gap: 4 }}>
                  <span className="lbl">{failed ? "Refund" : "Your tokens"}</span>
                  <span className="fig-lg">{failed ? <><Ticker value={refund} format={(n) => bnb(n, 4)} /><BnbUnit /></> : <><Ticker value={alloc} format={(n) => tokensFull(n)} /><span className="u">{v.terms.symbol}</span></>}</span>
                </div>
                <dl className="kv">
                  <dt>You committed</dt><dd className="num">{bnb(pos.committed, 4)} BNB</dd>
                  {!failed ? <><dt>Kept in the sale</dt><dd className="num">{bnb(accepted, 4)} BNB</dd></> : null}
                  <dt>Refund</dt><dd className="num">{bnb(refund, 4)} BNB</dd>
                  {!failed ? <><dt className="total">Backed by the treasury</dt><dd className="total num">{bnb(accepted * d.startRatio, 4)} BNB</dd></> : null}
                </dl>
                <div className="stack-sm" style={{ display: "grid" }}>
                  {!failed ? <button className="btn btn-primary btn-lg btn-block" disabled={pos.tokensClaimed} onClick={() => void run("claimTokens")}>{pos.tokensClaimed ? <><Icon name="check" size={15} />Tokens claimed</> : `Claim ${tokens(alloc)} ${v.terms.symbol}`}</button> : null}
                  <button className={`btn ${failed ? "btn-primary btn-lg" : "btn-secondary"} btn-block`} disabled={pos.refundClaimed || refund <= 0} onClick={() => void run("claimRefund")}>{pos.refundClaimed ? <><Icon name="check" size={15} />Refund claimed</> : refund > 0 ? `Claim ${bnb(refund, 4)} BNB refund` : "No refund due"}</button>
                </div>
              </>
            )}
          </div>
        </div>
        {!failed ? <Link href={`/app/c/${v.id}`} className="btn btn-secondary btn-lg btn-block">Open the covenant sheet<Icon name="arrow" size={15} /></Link> : null}
      </div>
    </div>
  );
}
