"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/app/icons";
import { ConnectChain } from "@/components/app/live";
import { useWallet } from "@/components/providers";
import { BnbUnit, Empty, Skeleton, StateBadge, Ticker, TokenAvatar, cx, seedOf } from "@/components/app/ui";
import { derive } from "@/lib/covenant/derive";
import { buyerOutcome } from "@/lib/covenant/math";
import { useCovenants } from "@/lib/data/hooks";
import { bnb, price, signedPct, tokens } from "@/lib/format";

/** The connected wallet's positions across covenants, read from each view's `position` (no extra calls). */
export default function PortfolioPage() {
  const { list: all, source, loading: reading } = useCovenants();
  const online = source.mode === "live";
  const list = online ? all.filter((v) => v.source === "live") : [];
  const loading = source.mode === "checking" || (online && reading);
  const w = useWallet();
  const rows = list.filter((v) => v.position && (v.position.committed > 0 || v.position.balance > 0)).map((v) => {
    const d = derive(v);
    const p = v.position!;
    const launched = v.state !== "RAISING" && v.state !== "FAILED";
    const out = buyerOutcome(p.committed, v.raise.committed, d.raise, d.sp);
    const held = p.balance || (launched && !p.tokensClaimed ? p.allocation || out.tokens : 0);
    const refundDue = !p.refundClaimed && (v.state === "FAILED" ? p.committed : p.refund || (launched ? out.refund : 0));
    return { v, d, p, launched, held, atBook: held * d.book, atPool: held * v.poolPrice, refundDue, claimTokens: launched && !p.tokensClaimed && (p.allocation || out.tokens) > 0 };
  });
  const atBook = rows.reduce((a, r) => a + r.atBook, 0);
  const atPool = rows.reduce((a, r) => a + r.atPool, 0);
  const committed = rows.filter((r) => r.v.state === "RAISING").reduce((a, r) => a + r.p.committed, 0);
  const claims = rows.reduce((a, r) => a + (r.refundDue || 0), 0);
  const needsWallet = online && !w.address;

  return (
    <main className="page">
      <div className="sec-head">
        <div className="stack-sm" style={{ display: "grid" }}>
          <h1 className="h-page">Portfolio</h1>
          <p className="lede">What you hold in each covenant, valued at book (what the vault would pay in an exit round) and at the pool.</p>
        </div>
        {online && w.address ? <span className="badge lg good">Connected</span> : null}
      </div>

      {!online && !loading ? <ConnectChain source={source} /> : needsWallet ? (
        <div className="card"><Empty title="Connect a wallet to see your positions" icon="wallet" action={<button className="btn btn-primary btn-sm" onClick={w.connect}>Connect wallet</button>}>Positions are read from the launchers and vaults for the connected address.</Empty></div>
      ) : loading ? <Skeleton h={320} r={18} /> : (
        <>
          <div className="kpis">
            <div className="kpi"><p className="k">Value at book</p><div className="v"><Ticker value={atBook} format={(n) => bnb(n, 3)} /> <BnbUnit className="t-s muted" /></div><div className="s">Redeemable in an exit round</div></div>
            <div className="kpi"><p className="k">Value at the pool</p><div className="v"><Ticker value={atPool} format={(n) => bnb(n, 3)} /> <BnbUnit className="t-s muted" /></div><div className="s">At spot, before tax and slippage</div></div>
            <div className="kpi"><p className="k">Committed to raises</p><div className="v"><Ticker value={committed} format={(n) => bnb(n, 2)} /> <BnbUnit className="t-s muted" /></div><div className="s">Settles when each raise closes</div></div>
            <div className="kpi"><p className="k">Refunds to claim</p><div className={cx("v", claims > 0 && "accent")}><Ticker value={claims} format={(n) => bnb(n, 3)} /> <BnbUnit className="t-s muted" /></div><div className="s">Pro rata excess and failed raises</div></div>
          </div>

          {rows.length === 0 ? (
            <div className="card"><Empty title="No positions yet" icon="pie" action={<div className="row" style={{ gap: 8, justifyContent: "center" }}><Link className="btn btn-primary btn-sm" href="/app">Discover covenants</Link><Link className="btn btn-secondary btn-sm" href="/app/settings/funds"><Icon name="drop" size={14} />Get test funds</Link></div>}>Commit to a raise and your allocation, refund and book value show up here.</Empty></div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="card-head"><h2 className="h-card">Positions</h2><span className="t-xs muted w5">{rows.length} covenant{rows.length === 1 ? "" : "s"}</span></div>
              {rows.map((r, i) => (
                <div key={r.v.id} className="ledger-row rise" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto", ["--i" as string]: i } as CSSProperties}>
                  <Link href={`/app/c/${r.v.id}`} className="row" style={{ gap: 12 }}>
                    <TokenAvatar seed={seedOf(r.v)} size={36} issuer={r.v.issuer.kind} />
                    <span style={{ display: "grid", gap: 3, minWidth: 0 }}><span className="ink trunc">{r.v.terms.name} <span className="mono t-xs muted">${r.v.terms.symbol}</span></span><StateBadge state={r.v.state} /></span>
                  </Link>
                  <span style={{ display: "grid", gap: 2 }} className="hide-sm">
                    <span className="t-xs muted w5">{r.v.state === "RAISING" ? "Committed" : "Holding"}</span>
                    <span className="num ink">{r.v.state === "RAISING" ? `${bnb(r.p.committed)} BNB` : `${tokens(r.held)} ${r.v.terms.symbol}`}</span>
                  </span>
                  <span style={{ display: "grid", gap: 2 }} className="hide-sm">
                    <span className="t-xs muted w5">At book</span>
                    <span className="num ink">{r.launched ? `${bnb(r.atBook, 3)} BNB` : "–"} {r.launched ? <span className={cx("t-xs", r.d.prem < 0 ? "up" : "muted")}>{signedPct(r.v.poolPrice > 0 ? r.d.book / r.v.poolPrice - 1 : 0)} vs pool</span> : null}</span>
                  </span>
                  <span className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    {r.v.state === "RAISING" ? <Link className="btn btn-secondary btn-sm" href={`/app/c/${r.v.id}/raise`}>Add</Link>
                      : r.claimTokens || r.refundDue ? <Link className="btn btn-primary btn-sm" href={`/app/c/${r.v.id}/settle`}>Claim</Link>
                      : r.v.state === "EXIT_ROUND" || r.v.state === "WIND_DOWN" ? <Link className="btn btn-accent btn-sm" href={`/app/c/${r.v.id}/redeem`}>Redeem</Link>
                      : <Link className="btn btn-secondary btn-sm" href={`/app/c/${r.v.id}`}>View</Link>}
                  </span>
                  <span className="t-xs muted w5 note-col only-narrow" style={{ gridColumn: "1 / -1" }}>{r.v.state === "RAISING" ? `${bnb(r.p.committed)} BNB committed` : `${tokens(r.held)} ${r.v.terms.symbol} · ${r.launched ? `${bnb(r.atBook, 3)} BNB at book (${price(r.d.book)} each)` : "refund in full"}`}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
