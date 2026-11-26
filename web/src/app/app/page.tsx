"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { CovenantCard, nextEvent } from "@/components/app/covenant";
import { Sparkline } from "@/components/app/chart";
import { Icon } from "@/components/app/icons";
import { ConnectChain } from "@/components/app/live";
import { IntentPicker } from "@/components/app/onboarding";
import { BnbChain, BnbCoin } from "@/components/app/bnb";
import { seedHue } from "@/components/app/bot";
import { ThinkingMark } from "@/components/app/mark";
import { duration } from "@/lib/covenant/time";
import { reopenOnboarding, useIntents, useOnboarded, type Intent } from "@/components/app/prefs";
import { Empty, SecHead, Skeleton, StateBadge, Ticker, TokenAvatar, cx, seedOf } from "@/components/app/ui";
import { derive } from "@/lib/covenant/derive";
import { DAY } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { useCovenants } from "@/lib/data/hooks";
import { bnb, price, signedPct } from "@/lib/format";

const subscribeNoop = () => () => {};
const hourNow = () => new Date().getHours();

function greeting(h: number) {
  if (h < 0) return "Welcome back.";
  return h < 5 ? "Good evening." : h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

export default function DiscoverPage() {
  const { list: all, source, loading: reading } = useCovenants();
  const online = source.mode === "live";
  const list = online ? all.filter((v) => v.source === "live") : [];
  const loading = source.mode === "checking" || (online && reading);
  const onboarded = useOnboarded();
  const intents = useIntents();
  const hour = useSyncExternalStore(subscribeNoop, hourNow, () => -1);
  const launched = list.filter((v) => v.state !== "RAISING" && v.state !== "FAILED");
  const under = launched.filter((v) => v.state === "ACTIVE" && derive(v).prem < 0);
  const rounds = list.filter((v) => v.state === "EXIT_ROUND" || v.state === "WIND_DOWN");
  const raising = list.filter((v) => v.state === "RAISING");
  const agents = list.filter((v) => v.issuer.kind === "agent");
  const order: Intent[] = intents.length ? intents : ["invest", "watch", "agent", "raise"];

  const sections: Record<Intent, ReactNode> = {
    invest: (
      <section key="invest" className="stack sect">
        <SecHead title="Raising now" sub="Commitments are uncapped and scale back pro rata above the cap. Under the minimum, everyone is refunded in full." right={<Link className="btn btn-secondary btn-sm" href="/app/covenants">All covenants<Icon name="arrow" size={14} /></Link>} />
        {raising.length ? <div className="cgrid">{raising.map((v, i) => <CovenantCard key={v.id} v={v} i={i} />)}</div>
          : <div className="card"><Empty title="Nothing is raising right now" icon="coins" action={<Link className="btn btn-primary btn-sm" href="/app/create">Launch your autonomous venture</Link>}>New covenants appear here the moment their raise opens.</Empty></div>}
      </section>
    ),
    watch: (
      <section key="watch" className="stack sect">
        <SecHead title="Under book and in exit rounds" sub="Where the pool trades below what the treasury holds per token. Exit streaks count on-chain numbers only." />
        {under.length + rounds.length ? <WatchList list={[...rounds, ...under]} /> : <div className="card"><Empty title="Every covenant trades above book" icon="shieldCheck">No exit streak is counting and no round is open.</Empty></div>}
      </section>
    ),
    agent: (
      <section key="agent" className="stack sect">
        <SecHead title="Agent issuers" sub="Ventures run by an ERC-8004 agent: a budget it is held to, with outcomes written to its record." />
        {agents.length ? <div className="cgrid">{agents.map((v, i) => <CovenantCard key={v.id} v={v} i={i} />)}</div> : <div className="card"><Empty title="No agent issuers yet" icon="agent" /></div>}
      </section>
    ),
    raise: <RaiseInvite key="raise" />,
  };

  return (
    <main className="page">
      {onboarded === "no" ? <IntentPicker seeds={list.map(seedOf)} /> : null}
      <section className="home-head rise">
        <div className="home-top">
          <div style={{ display: "grid", maxWidth: 640 }}>
            <span className="eyebrow"><ThinkingMark size={15} label="Covenant" />The operating stack for autonomous ventures</span>
            <h1 className="home-hello">{greeting(hour)}</h1>
            <p className="t-s muted w5">Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on <BnbChain />.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={reopenOnboarding}><Icon name="sparkle" size={15} />Personalise</button>
            <Link className="btn btn-primary" href="/app/create"><Icon name="plus" size={15} />Create a covenant</Link>
          </div>
        </div>
        {!online && !loading ? null : loading ? <Skeleton h={132} r={18} /> : <Overview list={list} />}
      </section>

      {loading ? <div className="cgrid">{[0, 1, 2].map((k) => <Skeleton key={k} h={300} r={18} />)}</div>
        : !online ? <ConnectChain source={source} />
        : list.length === 0 ? (
          <div className="card"><Empty title="No covenants on this deployment yet" icon="layers" action={<Link className="btn btn-primary btn-sm" href="/app/create">Create the first one</Link>}>{source.reason}. The operating stack for autonomous ventures starts with a raise.</Empty></div>
        ) : order.map((k) => sections[k])}

    </main>
  );
}


function WatchList({ list }: { list: CovenantView[] }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {list.map((v, i) => {
        const d = derive(v);
        const nx = nextEvent(v, d);
        return (
          <Link key={v.id} href={`/app/c/${v.id}`} className="ledger-row rise" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) auto", borderTop: i ? undefined : 0, ["--i" as string]: i } as CSSProperties}>
            <span className="row" style={{ gap: 12 }}>
              <TokenAvatar seed={seedOf(v)} size={36} issuer={v.issuer.kind} />
              <span style={{ display: "grid", minWidth: 0 }}><span className="ink trunc">{v.terms.name} <span className="mono t-xs muted">${v.terms.symbol}</span></span><span className={cx("t-xs w5", nx.tone === "warn" ? "warn-t" : nx.tone === "bad" ? "down" : "muted")}>{nx.text}</span></span>
            </span>
            <span className="row hide-sm" style={{ gap: 12 }}><StateBadge state={v.state} /><Sparkline points={v.history.filter((p) => p.t > v.now - 14 * DAY)} width={96} height={26} /></span>
            <span className="ledger-amt"><span className={cx("num", d.prem < 0 ? "down" : "up")}>{signedPct(d.prem)}</span><span className="t-xs muted mono">book {price(d.book)}</span></span>
          </Link>
        );
      })}
    </div>
  );
}

function RaiseInvite() {
  const steps = [
    { icon: "sheet" as const, t: "Write the terms", s: "Split, tap, exit and heartbeat, inside the factory's bounds." },
    { icon: "sparkle" as const, t: "Mine the address", s: "Flap needs the token to end in 7777; a worker finds it." },
    { icon: "coins" as const, t: "Raise with refunds", s: "Uncapped commitments, pro rata above the cap." },
    { icon: "vault" as const, t: "Launch and hold", s: "One transaction seeds the pool and funds the vault." },
  ];
  return (
    <section className="stack sect">
      <SecHead title="Launch your autonomous venture" sub="A raise your buyers can price: the five rules are fixed at creation, and only the tap can go down." />
      <div className="hgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {steps.map((x, i) => (
          <div key={x.t} className="hcell rise" style={{ ["--i" as string]: i } as CSSProperties}>
            <span className="row between"><span className="icon-tile"><Icon name={x.icon} size={17} /></span><span className="mono t-xs faint">0{i + 1}</span></span>
            <p className="h-card">{x.t}</p>
            <p className="t-s muted w5">{x.s}</p>
          </div>
        ))}
      </div>
      <div className="row wrap-ok" style={{ gap: 8 }}>
        <Link className="btn btn-primary" href="/app/create">Start a covenant<Icon name="arrow" size={15} /></Link>
        <Link className="btn btn-secondary" href="/app/simulator"><Icon name="flask" size={15} />Test terms in the simulator</Link>
      </div>
    </section>
  );
}

/** Four overview tiles, each a door to a filtered list. Every figure is a chain read; bars and pips are per covenant. */
function Overview({ list }: { list: CovenantView[] }) {
  const launched = list.filter((v) => v.state !== "RAISING" && v.state !== "FAILED");
  const held = launched.reduce((a, v) => a + v.treasury, 0);
  const prem = (v: CovenantView) => derive(v).prem;
  const under = launched.filter((v) => (v.state === "ACTIVE" || v.state === "COOLDOWN") && prem(v) < 0).sort((a, b) => prem(a) - prem(b));
  const raising = list.filter((v) => v.state === "RAISING");
  const agents = list.filter((v) => v.issuer.kind === "agent");
  const first = raising[0];
  const worst = under[0];
  return (
    <div className="ovw">
      <Link href="/app/covenants" className="ovw-tile rise" style={{ ["--i" as string]: 1 } as CSSProperties}>
        <span className="ovw-k">BNB under covenant<Icon name="arrowUpRight" size={14} /></span>
        <span className="ovw-v"><BnbCoin size="0.8em" /><Ticker value={held} format={(n) => bnb(n)} /></span>
        <span className="ovw-bar" aria-label="Share of BNB held by each vault">{launched.map((v, i) => <i key={v.id} title={`${v.terms.symbol}: ${bnb(v.treasury)} BNB`} style={{ flex: v.treasury / Math.max(held, 1e-9), background: `hsl(${seedHue(seedOf(v))} 70% 56%)`, animationDelay: `${i * 60}ms` }} />)}</span>
        <span className="ovw-s">Held by {launched.length} vault{launched.length === 1 ? "" : "s"}</span>
      </Link>
      <Link href="/app/covenants?state=under" className="ovw-tile rise" style={{ ["--i" as string]: 2 } as CSSProperties}>
        <span className="ovw-k">Under book<Icon name="arrowUpRight" size={14} /></span>
        <span className={cx("ovw-v", under.length > 0 && "warn")}><Ticker value={under.length} format={(n) => n.toFixed(0)} /></span>
        <span className="ovw-pips" aria-label="Each launched covenant against its book value">{launched.map((v, i) => <i key={v.id} className={v.state === "WIND_DOWN" ? "closed" : prem(v) < 0 ? "under" : ""} title={`${v.terms.symbol}: ${signedPct(prem(v))} against book`} style={{ animationDelay: `${i * 50}ms` }} />)}</span>
        <span className="ovw-s trunc">{worst ? <><span className="ink">{worst.terms.symbol}</span> {signedPct(prem(worst))} · {nextEvent(worst, derive(worst)).text}</> : "Every live covenant trades above book"}</span>
      </Link>
      <Link href="/app/covenants?state=raising" className="ovw-tile rise" style={{ ["--i" as string]: 3 } as CSSProperties}>
        <span className="ovw-k">Raising now<Icon name="arrowUpRight" size={14} /></span>
        <span className="ovw-v"><Ticker value={raising.length} format={(n) => n.toFixed(0)} /></span>
        <span className="ovw-bar" aria-label="Committed against the cap">{first ? <i style={{ width: `${Math.min(100, (first.raise.committed / Math.max(first.terms.cap, 1e-9)) * 100)}%`, background: "var(--accent)" }} /> : null}</span>
        <span className="ovw-s trunc">{first ? <><span className="ink">{first.terms.symbol}</span> {bnb(first.raise.committed, 0)} of {bnb(first.terms.cap, 0)} BNB · closes in {duration(Math.max(0, first.raise.deadline - first.now), 1)}</> : "No raise open right now"}</span>
      </Link>
      <Link href="/app/covenants?issuer=agent" className="ovw-tile rise" style={{ ["--i" as string]: 4 } as CSSProperties}>
        <span className="ovw-k">Agent issuers<Icon name="arrowUpRight" size={14} /></span>
        <span className="ovw-v"><Ticker value={agents.length} format={(n) => n.toFixed(0)} /></span>
        <span className="ovw-bots">{agents.slice(0, 7).map((v) => <TokenAvatar key={v.id} seed={seedOf(v)} size={22} />)}</span>
        <span className="ovw-s">of {list.length} covenant{list.length === 1 ? "" : "s"} · ERC-8004 identities</span>
      </Link>
    </div>
  );
}
