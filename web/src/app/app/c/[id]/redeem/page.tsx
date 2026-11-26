"use client";

import { useState } from "react";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { Meter, Note, Ticker, TokenAvatar, cx, seedOf, useCountdown } from "@/components/app/ui";
import { useActions } from "@/lib/data/actions";
import type { Derived } from "@/lib/covenant/derive";
import { bookAfterRedeem, poolSellQuote, redeemQuote } from "@/lib/covenant/math";
import { duration } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, bps, pct, price, signedPct, tokens, tokensFull } from "@/lib/format";
import { BnbCoin } from "@/components/app/bnb";

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
  const roundLeft = useCountdown(Math.max(0, (v.exit.roundEndsAt ?? v.now) - v.now));
  const top = Math.max(q.out, pool.spot, 1e-12);

  return (
    <div className="grid-side">
      <div className="stack">
        {!open ? (
          <Note tone="accent" icon="clock">
            <b>Redemption opens only in an exit round or at wind-down.</b>{" "}
            {d.eta !== null ? `At this price a round opens in ${duration(d.eta)}: the pool has traded under book for ${duration(v.exit.streak)} of the ${duration(v.terms.exitStreak)} it needs.` : v.state === "COOLDOWN" ? `The exit trigger re-arms in ${duration((v.exit.cooldownEndsAt ?? v.now) - v.now)}.` : "The pool trades above book, so nothing is counting. You can sell on the pool at any time."}
          </Note>
        ) : null}
        <div className="card">
          <div className="card-head ruled">
            <div><h3 className="h-card">Redeem at book value</h3><p className="t-xs muted w5">Burn tokens, receive treasury BNB</p></div>
            {open ? <span className="badge warn"><span className="dot pulse" />{wind ? "Open forever, no fee" : <>Round ends in <span className="num">&nbsp;{duration(roundLeft, 2)}</span></>}</span> : <span className="badge">Closed</span>}
          </div>
          <div className="card-body ruled stack">
            <div className="swap">
              <div className="swap-box">
                <div className="row between t-s w5"><span className="muted">You burn</span><span className="muted">Balance <span className="num ink">{tokensFull(bal)}</span></span></div>
                <div className="row" style={{ gap: 12 }}>
                  <input className="amt" inputMode="numeric" value={input} onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ""))} aria-label={`Tokens to redeem, ${v.terms.symbol}`} aria-invalid={tooMuch} placeholder="0" />
                  <span className="tokchip"><TokenAvatar seed={seedOf(v)} size={28} />{v.terms.symbol}</span>
                </div>
                <div className="row between wrap-ok">
                  <div className="quick" style={{ marginTop: 0 }}>{[0.25, 0.5, 1].map((f) => <button key={f} type="button" disabled={bal <= 0} onClick={() => setInput(String(Math.floor(bal * f)))}>{f === 1 ? "Max" : pct(f, 0)}</button>)}</div>
                  <span className="t-xs muted w5">≈ <span className="num">{tokens(amount)}</span> × <span className="mono">{price(d.book)}</span></span>
                </div>
              </div>
              <span className="swap-arrow" aria-hidden><Icon name="down" size={16} /></span>
              <div className="swap-box">
                <div className="row between t-s w5"><span className="muted">You receive</span>{pool.out > 0 ? <span className={cx("badge", edge >= 0 ? "good" : "warn")}>{signedPct(edge)} vs selling</span> : null}</div>
                <div className="row" style={{ gap: 12 }}>
                  <span className="amt" style={{ display: "block" }}><Ticker value={q.out} format={(n) => bnb(n, 4)} duration={400} /></span>
                  <span className="tokchip"><BnbCoin size={28} />BNB</span>
                </div>
              </div>
            </div>
            {tooMuch ? <p className="err"><Icon name="alert" size={13} />More than your balance of {tokensFull(bal)} {v.terms.symbol}.</p> : null}
            <dl className="kv">
              <dt>Book value per token</dt><dd className="mono">{price(d.book)}</dd>
              <dt>Gross at book</dt><dd className="num">{bnb(q.gross, 4)} BNB</dd>
              <dt>Exit fee {wind ? "(none at wind-down)" : `${bps(v.terms.exitFeeBps)}, kept by the treasury`}</dt><dd className="num">−{bnb(q.fee, 4)} BNB</dd>
              <dt className="total">Minimum received (99.5%)</dt><dd className="total num">{bnb(q.out * 0.995, 4)} BNB</dd>
            </dl>
            <button className="btn btn-accent btn-xl btn-block" disabled={!open || amount <= 0 || tooMuch} onClick={() => void run("redeem", amount)}>
              <Icon name="redeem" size={16} />{open ? `Burn ${tokens(amount)} and receive ${bnb(q.out, 3)} BNB` : "Redeem opens in an exit round"}
            </button>
            <p className="t-xs muted w5">Your tokens go to the burn address and the vault pays you from the treasury. Payout uses the tokens actually received, and the transaction reverts if it would pay less than 99.5% of this quote.</p>
          </div>
        </div>
      </div>

      <div className="sections sticky">
        <div className="card">
          <div className="card-head"><h3 className="h-card">Redeem or sell on the pool</h3></div>
          <div className="card-body cmp">
            <div className="cmp-row"><div className="row between t-s w5"><span className="ink">Redeem at book</span><span className="num ink">{bnb(q.out, 4)} BNB</span></div><Meter value={q.out} max={top} tone="good" label="Redeem at book" /></div>
            <div className="cmp-row"><div className="row between t-s w5"><span className="ink">Sell on the pool</span><span className="num ink">{bnb(pool.out, 4)} BNB</span></div><Meter value={pool.out} max={top} tone="ink" label="Sell on the pool" /></div>
            <dl className="kv" style={{ marginTop: 4 }}>
              <dt>Pool price</dt><dd className="mono">{price(v.poolPrice)}</dd>
              <dt>At spot, before costs</dt><dd className="num">{bnb(pool.spot, 4)} BNB</dd>
              <dt>After {bps(v.terms.sellTaxBps)} tax, 0.25% fee and slippage</dt><dd className="num">{bnb(pool.out, 4)} BNB</dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3 className="h-card">For everyone who stays</h3></div>
          <div className="card-body stack">
            <dl className="kv">
              <dt>Book value now</dt><dd className="mono">{price(d.book)}</dd>
              <dt>After this redemption</dt><dd className="mono">{price(after)}</dd>
              <dt>Change</dt><dd className="num up">{after >= d.book ? "+" : ""}{((after / d.book - 1) * 100).toFixed(4)}%</dd>
            </dl>
            <p className="t-xs muted w5">A redemption never lowers book value for the holders who remain. The fee stays in the vault, so it rises slightly.</p>
          </div>
        </div>
        {open && !wind ? (
          <div className="card card-pad stack-sm" style={{ display: "grid" }}>
            <div className="row between t-s w5"><span className="muted">Round time left</span><span className="num ink">{duration(roundLeft, 3)}</span></div>
            <Meter value={v.terms.roundLength - roundLeft} max={v.terms.roundLength} tone="warn" label="Exit round elapsed" />
            <p className="t-xs muted w5">A {duration(v.terms.cooldown)} cooldown follows, then the trigger can arm again. The tap is paused until the round ends.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
