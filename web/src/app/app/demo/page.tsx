"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PriceBookChart } from "@/components/app/chart";
import { IssuerBadge, RuleCards } from "@/components/app/covenant";
import { Icon } from "@/components/app/icons";
import { Meter, StateBadge } from "@/components/app/ui";
import { derive } from "@/lib/covenant/derive";
import { poolSellQuote, redeemQuote } from "@/lib/covenant/math";
import type { SceneId } from "@/lib/covenant/mock";
import { DAY } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { setScene, useMock } from "@/lib/data/mock-store";
import { bnb, pct, price, tokens } from "@/lib/format";

interface Step { at: string; label: string; scene: SceneId | null; say: ReactNode; open?: string }

const STEPS: Step[] = [
  { at: "0:00", label: "The problem", scene: null, say: <>Most meme coins launched on this chain go quiet within two months. <span className="soft">The money buyers put in never comes back. We built the launch where it can.</span></> },
  { at: "0:20", label: "An agent raises", scene: "raise", open: "/app/c/lumen/raise", say: <>An AI agent raises with its ERC-8004 id on the page. Buyers commit 1,400 BNB against a 500 BNB cap. <span className="soft">Everyone is scaled back pro rata. One transaction refunds, launches on Flap and creates the vault.</span></> },
  { at: "0:50", label: "Tap and tax", scene: "active", open: "/app/c/lumen", say: <>Three quarters of the raise is in this vault, not in the agent&apos;s wallet. Trading tax adds to it. <span className="soft">The agent draws a dollar compute budget at the Atlas rate, capped at 4% a month. If its key is hijacked, that budget is all an attacker can reach.</span></> },
  { at: "1:20", label: "Slide under book", scene: "slide", open: "/app/c/lumen", say: <>Now the price falls below what the treasury is worth per token, and stays there. <span className="soft">An hour pumped above book takes an hour off the streak; it never resets. No vote. No proposal.</span></> },
  { at: "1:45", label: "Exit at book", scene: "exit", open: "/app/c/lumen/redeem", say: <>The round is open. This holder burns 6M tokens for 2.53 BNB, against 2.1 on the pool. <span className="soft">Everyone who stays keeps exactly the same book value.</span></> },
  { at: "2:05", label: "Unplug the agent", scene: "unplugged", open: "/app/c/lumen", say: <>Now we unplug the agent. There is nobody to sue, and nobody needs to be sued. <span className="soft">Its heartbeat runs out. Anyone can flip the switch.</span></> },
  { at: "2:15", label: "Treasury opens", scene: "abandoned", open: "/app/c/lumen", say: <>The budget stops, the locked tokens burn and the treasury opens to holders. <span className="soft">The outcome is written to the agent&apos;s ERC-8004 record, so it carries into its next raise.</span></> },
  { at: "2:25", label: "Agents read terms", scene: "exit", open: "/app/simulator", say: <>The terms are on-chain, so another agent can read them, price the downside and exit by itself. <span className="soft">The same rules ship as a Four.meme template, and CoinMarketCap data shows how many recent launches would have triggered an exit.</span></> },
  { at: "2:45", label: "Close", scene: null, say: <>MetaDAO showed the demand: $580M committed for raises that accepted about $45M. <span className="soft">Covenant brings that to BNB Chain, for human teams and for agents, with one vault, one rule and one price feed.</span></> },
];

export default function DemoPage() {
  const [i, setI] = useState(0);
  const mock = useMock();
  const step = STEPS[i]!;
  const go = (n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    setI(k);
    const s = STEPS[k]!.scene;
    if (s) setScene(s);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const v = mock.views.lumen!;

  return (
    <main className="page">
      <div className="row wrap between">
        <div>
          <p className="eyebrow">Demo · three minutes</p>
          <h1 className="d2">The covenant story, <span className="soft">scene by scene.</span></h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous scene"><Icon name="back" size={16} /></button>
          <button className="btn btn-primary" onClick={() => go(i + 1)} disabled={i === STEPS.length - 1}>Next scene<Icon name="arrow" size={16} /></button>
        </div>
      </div>

      <div className="stage-steps" style={{ ["--n" as string]: STEPS.length }}>
        {STEPS.map((s, k) => (
          <button key={k} className="stage-step" aria-pressed={k === i} onClick={() => go(k)}>
            <span className="t">{s.at}</span><span className="l">{s.label}</span>
          </button>
        ))}
      </div>

      <section className="sky">
        <div className="sky-inner stack" style={{ gap: 20 }}>
          <p className="say">{step.say}</p>
          <div className="glass" style={{ padding: 16 }}>
            <Scene step={step} v={v} />
          </div>
          {step.open ? <div><Link className="btn btn-ghost" href={step.open}>Open this screen<Icon name="ext" size={15} /></Link></div> : null}
        </div>
      </section>
      <p className="tiny muted" style={{ margin: 0 }}>Every scene is the flagship demo covenant on the mock layer, simulated hour by hour under the five rules. With a local deployment, the contracts&apos; demo script drives the same story on chain with short timers (exit streak 3 minutes, round 5 minutes, heartbeat 10 minutes). Use ← and → to step.</p>
    </main>
  );
}

function Scene({ step, v }: { step: Step; v: CovenantView }) {
  const d = derive(v);
  if (step.at === "0:00") {
    return (
      <div style={{ display: "grid", placeItems: "center", textAlign: "center", padding: "32px 8px", gap: 10 }}>
        <div className="big-number">80.96%</div>
        <p className="lede" style={{ textAlign: "center" }}>of BSC meme coins had gone inactive about two months in <span className="faint">(MemeChain, arXiv 2601.22185)</span></p>
      </div>
    );
  }
  if (step.at === "2:45") {
    return (
      <div style={{ display: "grid", gap: 16, padding: "12px 4px" }}>
        <div className="stats" style={{ ["--n" as string]: 3 }}>
          <div className="stat"><p className="k">Committed to MetaDAO&apos;s protected raises</p><div className="v">$580M</div><div className="s">92.2% refunded because raises were capped</div></div>
          <div className="stat"><p className="k">Covenant</p><div className="v">5 rules</div><div className="s">One vault, one rule, one price feed</div></div>
          <div className="stat"><p className="k">For</p><div className="v">Teams and agents</div><div className="s">A budget it is held to</div></div>
        </div>
        <p className="d3" style={{ textAlign: "center" }}>ClawPump lets an agent launch a token. <span className="soft">Covenant lets an agent raise a budget it can be held to.</span></p>
      </div>
    );
  }
  if (step.at === "2:25") {
    return (
      <div className="terminal" aria-label="An AI assistant using the Covenant MCP server">
        <span className="c"># An assistant with the Covenant MCP server</span>{"\n"}
        <span className="p">user ›</span> Which covenants trade under book? Exit the worst one if the round is open.{"\n"}
        <span className="p">tool ›</span> list_covenants() → LUMEN EXIT_ROUND book {price(d.book)} pool {price(v.poolPrice)} ({pct(d.prem, 1)}){"\n"}
        <span className="p">tool ›</span> get_downside(LUMEN, 6,000,000) → redeems {bnb(redeemQuote(6e6, d.book, 100, false).out, 3)} BNB at book · pool pays ~{bnb(poolSellQuote(6e6, v.poolBnb, v.poolBnb / Math.max(v.poolPrice, 1e-30), 100).out, 3)}{"\n"}
        <span className="p">tool ›</span> get_issuer(LUMEN) → agent #4127 · past: SCOUT unlocked 2x{"\n"}
        <span className="p">tool ›</span> redeem(LUMEN, 6,000,000) → unsigned tx for your wallet{"\n"}
        <span className="g">✓ signed by the user&apos;s wallet. The server never holds a key.</span>
      </div>
    );
  }
  if (step.scene === "raise") {
    const t = v.terms;
    return (
      <div className="grid2">
        <div className="card card-pad stack">
          <div className="row between"><span className="d4">{t.name} raise</span><StateBadge state={v.state} /></div>
          <div><span className="mono" style={{ fontSize: 34 }}>{bnb(v.raise.committed, 0)}</span> <span className="muted">BNB committed by 3 wallets</span></div>
          <Meter value={v.raise.committed} max={Math.max(v.raise.committed, t.cap * 1.05)} marks={[t.minRaise, t.cap]} tone="good" label="Committed" />
          <dl className="kv">
            <dt>Accepted</dt><dd>{bnb(d.raise.Q, 0)} BNB</dd>
            <dt>Refunded pro rata</dt><dd>{bnb(d.raise.refunded, 0)} BNB</dd>
            <dt>Treasury</dt><dd>{bnb(d.raise.T0, 0)} BNB</dd>
            <dt>Book value</dt><dd>{pct(d.startRatio, 0)} of sale price</dd>
          </dl>
        </div>
        <IssuerBadge v={v} />
      </div>
    );
  }
  if (step.scene === "exit") {
    const q = redeemQuote(6e6, d.book, v.terms.exitFeeBps, false);
    const pool = poolSellQuote(6e6, v.poolBnb, v.poolBnb / Math.max(v.poolPrice, 1e-30), v.terms.sellTaxBps);
    return (
      <div className="grid2">
        <div className="card card-pad stack">
          <div className="row between"><span className="d4">Redeem 6,000,000 {v.terms.symbol}</span><StateBadge state={v.state} /></div>
          <div className="mono" style={{ fontSize: 34 }}>{bnb(q.out, 3)} <span className="muted" style={{ fontSize: 18 }}>BNB</span></div>
          <dl className="kv"><dt>Treasury</dt><dd>{bnb(v.treasury)} BNB</dd><dt>Book value</dt><dd>{price(d.book)}</dd><dt>Selling on the pool</dt><dd>{bnb(pool.spot, 2)} before tax and slippage</dd></dl>
        </div>
        <div className="card"><div style={{ padding: "12px 8px 0" }}><PriceBookChart points={v.history.filter((p) => p.t > v.now - 14 * DAY)} bands={v.bands} now={v.now} height={240} /></div></div>
      </div>
    );
  }
  return (
    <div className="stack">
      <RuleCards v={v} d={d} />
      {step.scene === "slide" || step.scene === "active" ? (
        <div className="card"><div style={{ padding: "12px 8px 0" }}><PriceBookChart points={v.history.filter((p) => p.t > v.now - (step.scene === "active" ? 10 : 14) * DAY)} bands={v.bands} salePrice={d.salePrice} now={v.now} height={220} /></div></div>
      ) : (
        <div className="grid2">
          <IssuerBadge v={v} />
          <div className="card card-pad stack">
            <div className="row between"><span className="d4">Treasury</span><StateBadge state={v.state} /></div>
            <div className="mono" style={{ fontSize: 30 }}>{bnb(v.treasury)} BNB</div>
            <dl className="kv"><dt>Book value</dt><dd>{price(d.book)}</dd><dt>Locked team tokens</dt><dd>{tokens(v.lockedTeam)}</dd><dt>Burned</dt><dd>{tokens(v.deadTokens)}</dd><dt>Unclaimed tap</dt><dd>{bnb(v.owedTeam, 3)} BNB</dd></dl>
            {step.scene === "unplugged" ? <Link className="btn btn-danger" href="/app/c/lumen">Go to the sheet and declare abandoned</Link> : null}
          </div>
        </div>
      )}
    </div>
  );
}
