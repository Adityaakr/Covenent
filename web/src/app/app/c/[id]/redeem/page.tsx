"use client";

import Link from "next/link";
import { useState } from "react";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { BnbCoin } from "@/components/app/bnb";
import { ThinkingMark } from "@/components/app/mark";
import { Stat, Tiny } from "@/components/app/story";
import { Empty, Meter, Ticker, TokenAvatar, cx, seedOf, useCountdown } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { explorerAddress } from "@/lib/chain/chains";
import type { Derived } from "@/lib/covenant/derive";
import { bookAfterRedeem, poolSellQuote, redeemQuote } from "@/lib/covenant/math";
import { amt } from "@/lib/covenant/story";
import { duration } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { useActions } from "@/lib/data/actions";
import { bps, pct, signedPct, tokens, tokensFull } from "@/lib/format";

export default function RedeemPage() {
  return <CovenantPage>{(v, d) => <Redeem v={v} d={d} />}</CovenantPage>;
}

/** Digits for a token amount typed or picked: whole tokens, grouped. */
const clean = (s: string) => s.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

function Redeem({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const wallet = useWallet();
  const connected = Boolean(wallet.address);
  const bal = v.position?.balance ?? 0;
  const sym = v.terms.symbol;
  // default: the whole balance when there is one, else empty (never a placeholder above a zero balance)
  // until the holder types or picks, the amount follows the balance (it loads after the wallet connects)
  const [touched, setTouched] = useState(false);
  const [typed, setTyped] = useState("");
  const [allPicked, setAllPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = touched ? typed : bal > 0 ? String(Math.floor(bal)) : "";
  const all = touched ? allPicked : bal > 0;
  const setInput = (s: string) => { setTouched(true); setTyped(s); };
  const setAll = (b: boolean) => { setTouched(true); setAllPicked(b); };
  const amount = all ? bal : Math.max(0, Number(input) || 0);
  const open = v.state === "EXIT_ROUND" || v.state === "WIND_DOWN";
  const wind = v.state === "WIND_DOWN";
  const q = redeemQuote(amount, d.book, v.terms.exitFeeBps, wind);
  const poolTokens = v.poolPrice > 0 ? v.poolBnb / v.poolPrice : 0;
  const pool = poolSellQuote(amount, v.poolBnb, poolTokens, v.terms.sellTaxBps);
  const after = bookAfterRedeem(v.treasury, v.owedTeam, d.R, amount, q.out);
  const edge = pool.out > 0 ? q.out / pool.out - 1 : 0;
  const tooMuch = connected && amount > bal + 1e-9;
  const roundLeft = useCountdown(Math.max(0, (v.exit.roundEndsAt ?? v.now) - v.now));
  const top = Math.max(q.out, pool.out, 1e-18);
  const pair = v.pair && v.source === "live" ? explorerAddress(v.chainId, v.pair) : null;
  // per 1M tokens when nothing is typed, so the quote never reads as a zero
  const unit = amount > 0 ? amount : 0;

  const pick = (f: number) => { if (f === 1) { setAll(true); setInput(String(Math.floor(bal))); } else { setAll(false); setInput(String(Math.floor(bal * f))); } };
  const go = async () => {
    if (!connected) { wallet.connect(); return; }
    setBusy(true);
    const ok = await run("redeem", amount, { all });
    setBusy(false);
    if (ok) { setAll(false); setInput(""); }
  };

  const cta = !connected ? <><Icon name="wallet" size={16} />Connect a wallet to redeem</>
    : !open ? <><Icon name="clock" size={16} />Redeem opens in an exit round</>
    : bal <= 0 ? <>No {sym} in this wallet</>
    : busy ? <><ThinkingMark size={16} />Confirm in your wallet…</>
    : amount <= 0 ? <>Enter an amount</>
    : tooMuch ? <>More than your balance</>
    : <><Icon name="redeem" size={16} />Burn {tokens(amount)} {sym} for {amt(q.out)} BNB</>;
  const disabled = connected && (!open || bal <= 0 || amount <= 0 || tooMuch || busy);

  if (v.state === "RAISING" || v.state === "FAILED") {
    const failed = v.state === "FAILED";
    return (
      <div className="card">
        <Empty title={failed ? "Nothing to redeem: the raise failed" : "Redemption starts after launch"} icon={failed ? "info" : "clock"}
          action={<Link className="btn btn-primary btn-sm" href={`/app/c/${v.id}/${failed ? "settle" : "raise"}`}>{failed ? "Claim your refund" : "Back to the raise"}</Link>}>
          {failed ? "Nothing launched, so there is no token or treasury. Every commitment refunds in full on the Settlement tab." : `There is no ${sym} or treasury yet. Once the raise settles, holders can redeem at book value in an exit round or at wind-down.`}
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid-side" style={{ columnGap: 28 }}>
      <div className="stack" style={{ gap: 18 }}>
        {!open ? (
          <div className="rd-state">
            <span className="icon-tile"><Icon name="clock" size={18} /></span>
            <div><b>Redemption is closed right now</b><span>{d.eta !== null ? `It opens in an exit round. At this price one opens in ${duration(d.eta)}: the pool has traded under book for ${duration(v.exit.streak)} of the ${duration(v.terms.exitStreak)} it needs.` : v.state === "COOLDOWN" ? `A round just closed. The exit trigger re-arms in ${duration((v.exit.cooldownEndsAt ?? v.now) - v.now)}.` : "The pool trades above book, so nothing counts toward an exit. You can sell on the pool at any time."}</span></div>
            {pair ? <a className="btn btn-secondary btn-sm" href={pair} target="_blank" rel="noreferrer">Pool<Icon name="arrowUpRight" size={13} /></a> : null}
          </div>
        ) : wind ? (
          <div className="rd-state good">
            <span className="icon-tile good"><Icon name="redeem" size={18} /></span>
            <div><b>Open for good, no fee</b><span>Wound down: every holder can burn {sym} for book value, with no deadline and no exit fee.</span></div>
          </div>
        ) : (
          <div className="rd-state warn">
            <span className="icon-tile warn"><Icon name="exit" size={18} /></span>
            <div><b>Exit round open · ends in <span className="num">{duration(roundLeft, 2)}</span></b><span>Burn {sym} for book value, less the {bps(v.terms.exitFeeBps)} exit fee, which stays in the treasury for everyone who stays.</span></div>
          </div>
        )}

        <div className="card">
          <div className="card-head ruled">
            <div><h3 className="h-card">Redeem at book value</h3><p className="t-xs muted w5">Burn {sym}, receive treasury BNB</p></div>
            <span className="t-xs muted w5">Book <span className="ink"><Tiny n={d.book} /></span> BNB per token</span>
          </div>
          <div className="card-body ruled stack" style={{ gap: 18 }}>
            {connected && bal <= 0 ? (
              <div className="rd-state" style={{ padding: "12px 14px" }}>
                <span className="icon-tile sm"><Icon name="wallet" size={15} /></span>
                <div><b style={{ fontSize: 13.5 }}>This wallet holds no {sym}</b><span>Claim your sale tokens on Settlement{pair ? ", or buy on the pool" : ""}. Quotes below still work for any amount.</span></div>
                <Link className="btn btn-secondary btn-sm" href={`/app/c/${v.id}/settle`}>Settlement</Link>
              </div>
            ) : null}
            <div className="swap">
              <div className="swap-box">
                <div className="row between t-s w5"><span className="muted">You burn</span><span className="muted">{connected ? <>Balance <span className="num ink">{tokensFull(bal)}</span></> : "Not connected"}</span></div>
                <div className="row" style={{ gap: 12 }}>
                  <input className="amt" inputMode="decimal" value={input} placeholder="0" onChange={(e) => { setAll(false); setInput(clean(e.target.value)); }} aria-label={`Tokens to redeem, ${sym}`} aria-invalid={tooMuch} />
                  <span className="tokchip"><TokenAvatar seed={seedOf(v)} size={28} />{sym}</span>
                </div>
                <div className="row between wrap-ok">
                  <div className="quick" style={{ marginTop: 0 }}>{[0.25, 0.5, 1].map((f) => <button key={f} type="button" disabled={bal <= 0} aria-pressed={f === 1 ? all : undefined} onClick={() => pick(f)}>{f === 1 ? "Max" : pct(f, 0)}</button>)}</div>
                  {tooMuch ? <span className="t-xs w5 down"><Icon name="alert" size={12} /> Over your balance</span> : null}
                </div>
              </div>
              <span className="swap-arrow" aria-hidden><Icon name="down" size={16} /></span>
              <div className="swap-box">
                <div className="row between t-s w5"><span className="muted">You receive</span>{unit > 0 && pool.out > 0 ? <span className={cx("badge", edge >= 0 ? "good" : "warn")}>{signedPct(edge)} vs selling</span> : null}</div>
                <div className="row" style={{ gap: 12 }}>
                  <span className="amt" style={{ display: "block" }}><Ticker value={q.out} format={(n) => amt(n)} duration={400} /></span>
                  <span className="tokchip"><BnbCoin size={28} />BNB</span>
                </div>
                {unit <= 0 ? <span className="t-xs muted w5">1M {sym} pays <span className="num ink">{amt(redeemQuote(1e6, d.book, v.terms.exitFeeBps, wind).out)} BNB</span> at book{wind ? "" : `, after the ${bps(v.terms.exitFeeBps)} fee`}</span> : null}
              </div>
            </div>
            <div className="rd-break">
              <div><span>Gross at book</span><b>{amt(q.gross)} BNB</b></div>
              <div><span>{wind ? "Exit fee (none at wind-down)" : `Exit fee ${bps(v.terms.exitFeeBps)}, kept by the treasury`}</span><b>{q.fee > 0 ? `−${amt(q.fee)}` : "0"} BNB</b></div>
              <div className="tot"><span>You receive at least</span><b>{amt(q.out * 0.995)} BNB</b></div>
            </div>
            <button className={cx("btn btn-xl btn-block", connected ? "btn-accent" : "btn-primary")} disabled={disabled} onClick={() => void go()}>{cta}</button>
            <ol className="rd-steps" aria-label="What happens">
              <li><span><b>Approve exactly this amount</b>, only if the vault is not already allowed to take it. Never an open-ended allowance.</span></li>
              <li><span><b>Redeem.</b> Your {sym} goes to the burn address and the vault pays BNB from the treasury, at book value read before the burn. It reverts if it would pay under 99.5% of this quote.</span></li>
              <li><span><b>Done.</b> Balances refresh, and the Redeemed event shows in Activity and the treasury ledger.</span></li>
            </ol>
          </div>
        </div>
      </div>

      <div className="sections sticky">
        <div className="card card-pad stack" style={{ gap: 16 }}>
          <h3 className="h-card">Redeem or sell on the pool</h3>
          <div className="rd-vs">
            <div className="rd-vs-row"><div className="row between"><span className="ink">Redeem at book</span><span className="num ink">{amt(q.out)} BNB</span></div><Meter value={q.out} max={top} tone="good" label="Redeem at book" /></div>
            <div className="rd-vs-row"><div className="row between"><span className="ink">Sell on the pool</span><span className="num ink">{amt(pool.out)} BNB</span></div><Meter value={pool.out} max={top} tone="ink" label="Sell on the pool" /></div>
          </div>
          <p className="t-xs muted w5">{unit <= 0 ? "Type an amount to compare." : pool.out <= 0 ? "The pool has no liquidity to sell into." : edge >= 0 ? `Redeeming pays ${pct(edge, 1)} more than selling this amount.` : `Selling pays ${pct(-edge / (1 + edge), 1)} more: the pool trades above book.`} Selling costs the {bps(v.terms.sellTaxBps)} sell tax, the 0.25% swap fee and slippage; pool price <Tiny n={v.poolPrice} /> BNB.</p>
        </div>
        <div className="card card-pad stack" style={{ gap: 14 }}>
          <h3 className="h-card">For everyone who stays</h3>
          <div className="grid2" style={{ gap: 14 }}>
            <Stat k="Book value now" v={<Tiny n={d.book} />} s="BNB per token" />
            <Stat k="After this" v={<Tiny n={after} />} s={d.book > 0 ? <span className="up">{after >= d.book ? "+" : ""}{((after / d.book - 1) * 100).toFixed(4)}%</span> : "–"} />
          </div>
          <p className="t-xs muted w5">A redemption never lowers book value for the holders who remain.{wind ? "" : " The exit fee stays in the vault, so it rises slightly."}</p>
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
