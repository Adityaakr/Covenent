"use client";

import Link from "next/link";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { Note } from "@/components/app/ui";
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
    return <Note tone="accent">The raise has not settled yet. <Link href={`/app/c/${v.id}/raise`} className="ink" style={{ textDecoration: "underline" }}>Back to the raise</Link>.</Note>;
  }

  const steps = failed ? [
    ["Committed by buyers", `${bnb(v.raise.committed)} BNB`],
    ["Minimum", `${bnb(v.terms.minRaise, 0)} BNB`],
    ["Result", "FAILED: every commitment refunds in full"],
  ] : [
    ["Committed by buyers", `${bnb(v.raise.committed, 0)} BNB (${r.oversubscription.toFixed(1)}x the cap)`],
    ["Accepted", `${bnb(r.Q, 0)} BNB`],
    ["Refunded pro rata", `${bnb(r.refunded, 0)} BNB (each buyer keeps ${pct(r.keptShare, 1)})`],
    ["Sale price", `${bnb(r.Q, 0)} / ${tokens(d.sp.A)} = ${price(r.salePrice)} BNB`],
    ["Pool seed", `${bnb(r.qPool, 0)} BNB + ${tokens(d.sp.P)} tokens, opening at the sale price`],
    ["Treasury", `${bnb(r.T0, 0)} BNB, held by the vault`],
    ["Book value per token", `${bnb(r.T0, 0)} / ${tokens(d.sp.A + d.sp.P)} = ${price(r.T0 / (d.sp.A + d.sp.P))} BNB (${pct(d.startRatio, 0)} of the sale price)`],
  ];

  return (
    <div className="grid-main">
      <div className="card">
        <div className="card-head"><h3 className="d4">Result of the raise</h3><span className={`chip ${failed ? "chip-bad" : "chip-good"}`}>{failed ? "Failed" : "Launched"}</span></div>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {steps.map(([k, val]) => <tr key={k}><td className="muted">{k}</td><td className="r mono ink" style={{ whiteSpace: "normal" }}>{val}</td></tr>)}
            </tbody>
          </table>
        </div>
        {!failed ? <div className="card-body"><Note icon="shield">One transaction did all of this: it refunded the excess, launched the token on Flap with the pool at the sale price, created the vault and moved {bnb(r.T0, 0)} BNB into it. The {v.issuer.kind === "agent" ? "agent" : "team"} never held the raise.</Note></div> : null}
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head"><h3 className="d4">Your settlement</h3>{pos ? <span className="tiny muted">Connected wallet</span> : null}</div>
          <div className="card-body stack">
            {!pos || pos.committed === 0 ? <p className="small muted" style={{ margin: 0 }}>Connect the wallet you committed from to see your tokens and refund.</p> : (
              <>
                <dl className="kv">
                  <dt>You committed</dt><dd>{bnb(pos.committed, 4)} BNB</dd>
                  {!failed ? <><dt>Kept in the sale</dt><dd>{bnb(accepted, 4)} BNB</dd></> : null}
                  <dt>Refund</dt><dd>{bnb(refund, 4)} BNB</dd>
                  {!failed ? <><dt>Tokens</dt><dd>{tokensFull(alloc)}</dd></> : null}
                  {!failed ? <><dt className="total ink">Backed by the treasury</dt><dd className="total">{bnb(accepted * d.startRatio, 4)} BNB</dd></> : null}
                </dl>
                <div className="grid2" style={{ gap: 8 }}>
                  {!failed ? <button className="btn btn-primary" disabled={pos.tokensClaimed} onClick={() => void run("claimTokens")}>{pos.tokensClaimed ? <><Icon name="check" size={15} />Tokens claimed</> : "Claim tokens"}</button> : null}
                  <button className={`btn ${failed ? "btn-primary" : "btn-ghost"}`} disabled={pos.refundClaimed || refund <= 0} onClick={() => void run("claimRefund")}>{pos.refundClaimed ? <><Icon name="check" size={15} />Refund claimed</> : `Claim ${bnb(refund, 2)} BNB refund`}</button>
                </div>
              </>
            )}
          </div>
        </div>
        {!failed ? <Link href={`/app/c/${v.id}`} className="btn btn-ghost btn-lg">Open the covenant sheet<Icon name="arrow" size={16} /></Link> : null}
      </div>
    </div>
  );
}
