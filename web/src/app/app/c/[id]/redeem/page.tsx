"use client";

import { useState } from "react";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { Meter, Note } from "@/components/app/ui";
import { useActions } from "@/lib/data/actions";
import type { Derived } from "@/lib/covenant/derive";
import { bookAfterRedeem, poolSellQuote, redeemQuote } from "@/lib/covenant/math";
import { duration } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, bps, pct, price, signedPct, tokens, tokensFull } from "@/lib/format";

export default function RedeemPage() {
  return <CovenantPage>{(v, d) => <Redeem v={v} d={d} />}</CovenantPage>;
}

function Redeem({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const bal = v.position?.balance ?? 0;
  const [input, setInput] = useState(() => (bal >= 6_000_000 ? "6000000" : bal > 0 ? String(Math.floor(bal)) : "6000000"));
  const amount = Math.max(0, Number(input) || 0);
  const open = v.state === "EXIT_ROUND" || v.state === "WIND_DOWN";
  const wind = v.state === "WIND_DOWN";
  const q = redeemQuote(amount, d.book, v.terms.exitFeeBps, wind);
  const poolTokens = v.poolPrice > 0 ? v.poolBnb / v.poolPrice : 0;
  const pool = poolSellQuote(amount, v.poolBnb, poolTokens, v.terms.sellTaxBps);
  const after = bookAfterRedeem(v.treasury, v.owedTeam, d.R, amount, q.out);
  const edge = pool.out > 0 ? q.out / pool.out - 1 : 0;
  const tooMuch = amount > bal + 1e-6;

  return (
    <div className="grid-main">
      <div className="card">
        <div className="card-head">
          <h3 className="d4">Redeem at book value</h3>
          {open ? <span className="chip chip-warn"><span className="dot" />{wind ? "Open forever, no fee" : `Round ends in ${duration(v.exit.roundEndsAt! - v.now)}`}</span> : <span className="chip">Closed</span>}
        </div>
        <div className="card-body stack">
          {!open ? (
            <Note tone="accent" icon="clock">
              <b>Redemption opens only in an exit round or at wind-down.</b>{" "}
              {d.eta !== null ? `At this price a round opens in ${duration(d.eta)}: the pool has traded under book for ${duration(v.exit.streak)} of the ${duration(v.terms.exitStreak)} it needs.` : v.state === "COOLDOWN" ? `The exit trigger re-arms in ${duration((v.exit.cooldownEndsAt ?? v.now) - v.now)}.` : "The pool trades above book, so nothing is counting. You can sell on the pool at any time."}
            </Note>
          ) : null}
          <div>
            <label className="label" htmlFor="tok">Tokens in <span className="hint">Balance {tokensFull(bal)}</span></label>
            <div className="input-group">
              <input id="tok" className="field field-lg mono" inputMode="numeric" value={input} onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ""))} />
              <span className="unit">${v.terms.symbol}</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              {[0.25, 0.5, 1].map((f) => <button key={f} className="btn btn-ghost btn-sm" disabled={bal <= 0} onClick={() => setInput(String(Math.floor(bal * f)))}>{f === 1 ? "Max" : pct(f, 0)}</button>)}
            </div>
            {tooMuch ? <p className="err">More than your balance.</p> : null}
          </div>
          <div className="sky-soft" style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, display: "grid", gap: 10 }}>
            <div className="row between"><span className="small muted">You receive</span><span className="chip chip-good">{signedPct(edge)} vs the pool</span></div>
            <div className="mono" style={{ fontSize: 34, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{bnb(q.out, 4)} <span className="muted" style={{ fontSize: 18 }}>BNB</span></div>
            <dl className="kv">
              <dt>{tokens(amount)} × book {price(d.book)}</dt><dd>{bnb(q.gross, 4)}</dd>
              <dt>Exit fee {wind ? "(none at wind-down)" : `${bps(v.terms.exitFeeBps)}, kept by the treasury`}</dt><dd>−{bnb(q.fee, 4)}</dd>
            </dl>
          </div>
          <button className="btn btn-accent btn-lg btn-block" disabled={!open || amount <= 0 || tooMuch} onClick={() => void run("redeem", amount)}>
            <Icon name="redeem" size={16} />{open ? `Burn ${tokens(amount)} and receive ${bnb(q.out, 3)} BNB` : "Redeem opens in an exit round"}
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>Your tokens go to the burn address and the vault pays you from the treasury. Payout uses the tokens actually received, and the transaction reverts if it would pay less than 99.5% of this quote.</p>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head"><h3 className="d4">Against selling on the pool</h3></div>
          <div className="card-body stack">
            <Bar label="Redeem at book" value={q.out} max={Math.max(q.out, pool.spot)} tone="good" />
            <Bar label="Sell on the pool" value={pool.out} max={Math.max(q.out, pool.spot)} />
            <dl className="kv">
              <dt>Pool price</dt><dd>{price(v.poolPrice)}</dd>
              <dt>At spot, before tax and slippage</dt><dd>{bnb(pool.spot, 4)} BNB</dd>
              <dt>After {bps(v.terms.sellTaxBps)} sell tax, 0.25% swap fee and slippage</dt><dd>{bnb(pool.out, 4)} BNB</dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3 className="d4">For everyone who stays</h3></div>
          <div className="card-body stack">
            <dl className="kv">
              <dt>Book value now</dt><dd>{price(d.book)}</dd>
              <dt>After this redemption</dt><dd>{price(after)}</dd>
              <dt>Change</dt><dd className="up">{after >= d.book ? "+" : ""}{((after / d.book - 1) * 100).toFixed(4)}%</dd>
            </dl>
            <p className="small muted" style={{ margin: 0 }}>A redemption never lowers book value for the holders who remain. The fee stays in the vault, so it rises slightly.</p>
          </div>
        </div>
        {open && !wind ? (
          <div className="card card-pad">
            <div className="row between tiny muted" style={{ marginBottom: 6 }}><span>Round time left</span><span className="mono">{duration(v.exit.roundEndsAt! - v.now)}</span></div>
            <Meter value={v.terms.roundLength - (v.exit.roundEndsAt! - v.now)} max={v.terms.roundLength} tone="warn" label="Exit round elapsed" />
            <p className="tiny muted" style={{ margin: "8px 0 0" }}>A {duration(v.terms.cooldown)} cooldown follows, then the trigger can arm again. The tap is paused until the round ends.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone?: "good" }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="row between small"><span className="ink">{label}</span><span className="mono">{bnb(value, 4)} BNB</span></div>
      <Meter value={value} max={max} tone={tone} label={label} />
    </div>
  );
}
