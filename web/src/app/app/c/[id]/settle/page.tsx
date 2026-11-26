"use client";

import Link from "next/link";
import { Fragment } from "react";
import { MoneyMap, RaiseClosed, Story, SupplyBar } from "@/components/app/story";
import { amt } from "@/lib/covenant/story";
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

  const steps: [string, string][] = failed ? [
    ["Committed by buyers", `${bnb(v.raise.committed)} BNB`],
    ["Minimum", `${amt(v.terms.minRaise)} BNB`],
    ["Result", "Failed: every commitment refunds in full"],
  ] : [
    ["Committed by buyers", `${amt(v.raise.committed)} BNB (${r.oversubscription.toFixed(1)}× the cap)`],
    ["Accepted", `${amt(r.Q)} BNB`],
    ["Refunded pro rata", `${amt(r.refunded)} BNB (each buyer keeps ${pct(r.keptShare, 1)})`],
    ["Sale price", `${amt(r.Q)} / ${tokens(d.sp.A)} = ${price(r.salePrice)} BNB`],
    ["Pool seed", `${amt(r.qPool)} BNB + ${tokens(d.sp.P)} tokens, at the sale price`],
    ["Treasury", `${amt(r.T0)} BNB, held by the vault`],
    ["Book value per token", `${amt(r.T0)} / ${tokens(d.sp.A + d.sp.P)} = ${price(r.T0 / (d.sp.A + d.sp.P))} BNB (${pct(d.startRatio, 0)} of the sale price)`],
  ];

  return (
    <div className="grid-side">
      <div className="stack" style={{ gap: 20 }}>
        <Story id="result" title="Result of the raise" sub={failed ? "The minimum was missed" : "One transaction settled all of this"} right={<span className={failed ? "badge lg" : "badge good lg"}>{failed ? "Failed" : "Launched"}</span>}>
          <RaiseClosed v={v} d={d} />
          <details className="more">
            <summary>Show the math<Icon name="chevronDown" size={13} /></summary>
            <dl className="kv" style={{ marginTop: 12 }}>
              {steps.map(([k, val]) => <Fragment key={k}><dt>{k}</dt><dd>{val}</dd></Fragment>)}
            </dl>
          </details>
        </Story>
        <MoneyMap v={v} d={d} />
        {!failed ? <Story id="supply" title="Who holds the supply"><SupplyBar v={v} /></Story> : null}
        {!failed ? <Note icon="shield">It refunded the excess, launched the token on Flap with the pool at the sale price, created the vault and moved <span className="num">{bnb(r.T0, 4)}</span> BNB into it. The {v.issuer.kind === "agent" ? "agent" : "team"} never held the raise.</Note> : null}
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
