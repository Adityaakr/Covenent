"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { explorerAddress } from "@/lib/chain/chains";
import { derive, type Derived } from "@/lib/covenant/derive";
import { settleRaise } from "@/lib/covenant/math";
import { DAY, date, dateTime, duration, relative, span } from "@/lib/covenant/time";
import type { CovenantView, FeedEvent, LedgerKind } from "@/lib/covenant/types";
import { useActions } from "@/lib/data/actions";
import { bnb, bps, multiple, pct, price, short, signedPct, tokens, usd } from "@/lib/format";
import { BookTrend, PriceBookChart, Sparkline } from "./chart";
import { ConfirmAction } from "./confirm";
import { Icon, type IconName } from "./icons";
import { Addr, BnbUnit, CoverCut, Fig, Meter, Note, Segmented, StateBadge, Ticker, TokenAvatar, coverVars, cx, seedOf, useCountdown } from "./ui";
import { BnbChain } from "@/components/app/bnb";

export { derive };

const launchedOf = (v: CovenantView) => v.state !== "RAISING" && v.state !== "FAILED";
const who = (v: CovenantView) => (v.issuer.kind === "agent" ? "agent" : "team");
const liveChain = (v: CovenantView) => (v.source === "live" ? v.chainId : undefined);

/* ---------- Identity ---------- */

export function IssuerChip({ v, size }: { v: CovenantView; size?: "lg" }) {
  return v.issuer.kind === "agent"
    ? <span className={cx("badge agent", size === "lg" && "lg")} title="Issuer with an ERC-8004 agent identity"><Icon name="agent" size={13} />Agent #{v.issuer.agentId}</span>
    : <span className={cx("badge", size === "lg" && "lg")}><Icon name="user" size={13} />Human team</span>;
}

/** Kept for screens that still import it: the token's round avatar. */
export function TokenMark({ symbol, size = 48 }: { symbol: string; size?: number }) {
  return <TokenAvatar seed={symbol} size={size} />;
}

function PrimaryActions({ v, d, size = "lg" }: { v: CovenantView; d: Derived; size?: "lg" | "sm" }) {
  const base = `/app/c/${v.id}`;
  const b = size === "lg" ? "btn" : "btn btn-sm";
  const pair = v.pair ? explorerAddress(v.chainId, v.pair) : null;
  if (v.state === "RAISING") return <><Link className={`${b} btn-primary`} href={`${base}/raise`}><Icon name="plus" size={15} />Commit BNB</Link><Link className={`${b} btn-secondary hide-xs`} href="/app/simulator">Run the simulator</Link></>;
  if (v.state === "FAILED") return <Link className={`${b} btn-primary`} href={`${base}/settle`}>Claim refund<Icon name="arrow" size={15} /></Link>;
  const open = v.state === "EXIT_ROUND" || v.state === "WIND_DOWN";
  return (
    <>
      {open ? <Link className={`${b} btn-accent`} href={`${base}/redeem`}><Icon name="redeem" size={15} />Redeem at book</Link> : null}
      {pair && v.source === "live"
        ? <a className={`${b} ${open ? "btn-secondary" : "btn-primary"}`} href={pair} target="_blank" rel="noreferrer">Buy ${v.terms.symbol}<Icon name="arrowUpRight" size={14} /></a>
        : <span className={`${b} ${open ? "btn-secondary" : "btn-primary"}`} title="Trades on the PancakeSwap pool seeded at launch" aria-disabled>Buy ${v.terms.symbol}<Icon name="arrowUpRight" size={14} /></span>}
      {!open ? <Link className={`${b} btn-secondary`} href={`${base}/redeem`}><Icon name="clock" size={15} />{d.eta !== null ? `Exit opens in ${duration(d.eta, 1)}` : "Redeem"}</Link> : null}
    </>
  );
}

function IconLinks({ v }: { v: CovenantView }) {
  const vault = v.vault ? explorerAddress(v.chainId, v.vault) : null;
  return (
    <>
      <span className="sep" aria-hidden />
      {vault && v.source === "live" ? <a className="icon-btn bordered round" href={vault} target="_blank" rel="noreferrer" title="Vault on the explorer" aria-label="Vault on the explorer"><Icon name="vault" size={17} /></a> : <span className="icon-btn bordered round" title={v.vault ? `Vault ${v.vault}` : "No vault yet"}><Icon name="vault" size={17} /></span>}
      <Link className="icon-btn bordered round" href="/features" title="How the five rules work" aria-label="How the five rules work"><Icon name="book" size={17} /></Link>
      <Link className="icon-btn bordered round" href={`/app/c/${v.id}/team`} title={v.issuer.kind === "agent" ? "Agent console" : "Team console"} aria-label="Console"><Icon name={v.issuer.kind === "agent" ? "agent" : "team"} size={17} /></Link>
    </>
  );
}

/** Umia-style cover: a wide gradient banner in the token's hue, the avatar sitting in a cut at the bottom left. */
export function CovenantHero({ v, d }: { v: CovenantView; d: Derived }) {
  return (
    <section aria-label={`${v.terms.name} covenant`}>
      <div className="cover rise" style={coverVars(seedOf(v))}>
        <CoverCut />
        <div className="cover-meta">
          <span className="badge"><Icon name="shieldCheck" size={13} />Five rules on-chain</span>
          <span className="badge"><BnbChain /></span>
        </div>
      </div>
      <div className="wrap">
        <div className="hero-av" style={{ marginLeft: 0 }}><TokenAvatar seed={seedOf(v)} size={92} issuer={v.issuer.kind} /></div>
        <div className="head">
          <div className="head-title">
            <div className="head-name"><h1 className="h-name">{v.terms.name}</h1><span className="tick">${v.terms.symbol}</span></div>
            <div className="head-actions"><PrimaryActions v={v} d={d} /><IconLinks v={v} /></div>
          </div>
          <p className="head-desc">{v.terms.meta || "No description."}</p>
          <div className="head-chips"><StateBadge state={v.state} size="lg" /><IssuerChip v={v} size="lg" />{v.source === "mock" ? <span className="badge lg plain">Demo data</span> : null}</div>
        </div>
      </div>
    </section>
  );
}

export function CompactHeader({ v, d }: { v: CovenantView; d: Derived }) {
  return (
    <div className="chead">
      <Link href={`/app/c/${v.id}`} className="chead-id">
        <TokenAvatar seed={seedOf(v)} size={48} issuer={v.issuer.kind} />
        <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
          <div className="name"><span className="h-page">{v.terms.name}</span><span className="muted w5">${v.terms.symbol}</span></div>
          <div className="row wrap-ok" style={{ gap: 6 }}><StateBadge state={v.state} /><IssuerChip v={v} /></div>
        </div>
      </Link>
      <div className="head-actions"><PrimaryActions v={v} d={d} size="sm" /></div>
    </div>
  );
}

export function CovenantTabs({ v }: { v: CovenantView }) {
  const path = usePathname();
  const base = `/app/c/${v.id}`;
  const open = v.state === "EXIT_ROUND" || v.state === "WIND_DOWN";
  const tabs: { href: string; label: string; icon: IconName; dot?: boolean }[] = [
    { href: base, label: "Overview", icon: "sheet" },
    { href: `${base}/raise`, label: "Raise", icon: "coins", dot: v.state === "RAISING" },
    { href: `${base}/settle`, label: "Settlement", icon: "check" },
    { href: `${base}/redeem`, label: "Redeem", icon: "redeem", dot: open },
    { href: `${base}/team`, label: v.issuer.kind === "agent" ? "Agent console" : "Team console", icon: v.issuer.kind === "agent" ? "agent" : "team" },
  ];
  return (
    <nav className="ptabs" aria-label="Covenant pages">
      {tabs.map((t) => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}><Icon name={t.icon} size={15} />{t.label}{t.dot ? <span className="dot" aria-label="open" /> : null}</Link>)}
    </nav>
  );
}

/* ---------- Status strip ---------- */

export function StatusStrip({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const [confirm, setConfirm] = useState(false);
  const t = v.terms;
  const base = `/app/c/${v.id}`;
  const raiseLeft = useCountdown(Math.max(0, v.raise.deadline - v.now));
  const roundLeft = useCountdown(Math.max(0, (v.exit.roundEndsAt ?? v.now) - v.now));
  let tone = "good", icon: IconName = "shieldCheck", title: ReactNode, sub: ReactNode, meter: ReactNode = null, action: ReactNode = null;

  if (v.state === "RAISING") {
    tone = "accent"; icon = "clock";
    title = <>Raise open · closes in <span className="num">{duration(raiseLeft, 3)}</span></>;
    sub = <><span className="num">{bnb(v.raise.committed, 0)}</span> of a <span className="num">{bnb(t.cap, 0)}</span> BNB cap from {v.raise.contributors || "–"} wallets. Above the cap everyone is scaled back pro rata.</>;
    meter = <Bar value={v.raise.committed} max={Math.max(t.cap, v.raise.committed)} label={`${pct(v.raise.committed / t.cap, 0)} of cap`} marks={[t.minRaise]} />;
    action = <Link className="btn btn-primary btn-sm" href={`${base}/raise`}>Commit BNB</Link>;
  } else if (v.state === "FAILED") {
    tone = "neutral"; icon = "info";
    title = "The raise missed its minimum";
    sub = "Nothing launched. Every commitment refunds in full.";
    action = <Link className="btn btn-primary btn-sm" href={`${base}/settle`}>Claim refund</Link>;
  } else if (v.state === "WIND_DOWN") {
    const abandoned = v.issuer.outcomes.some((o) => o.outcome === "abandoned" && (o.vault ? o.vault.toLowerCase() === v.vault?.toLowerCase() : o.covenant === t.symbol));
    const ev = v.events.find((e) => /abandon|wound|winddown/i.test(e.name));
    tone = "bad"; icon = abandoned ? "heart" : "vault";
    title = abandoned ? "Abandoned: treasury open to holders, no fee" : "Wound down: treasury open to holders, no fee";
    sub = <>Redeem at <span className="mono">{price(d.book)}</span> BNB per token, no deadline. {v.deadTokens > 0 ? <><span className="num">{tokens(v.deadTokens)}</span> {t.symbol} burned{v.lockedTeam === 0 ? ", locked team tokens included" : ""}. </> : null}{ev ? <>{relative(ev.at, v.now)[0]!.toUpperCase() + relative(ev.at, v.now).slice(1)}{ev.tx ? <> · <Addr a={ev.tx} chainId={liveChain(v)} kind="tx" copy={false} /></> : null}</> : null}</>;
    action = <Link className="btn btn-accent btn-sm" href={`${base}/redeem`}><Icon name="redeem" size={14} />Redeem at book</Link>;
  } else if (v.state === "EXIT_ROUND") {
    tone = "warn"; icon = "exit";
    title = <>Exit round open · ends in <span className="num">{duration(roundLeft, 3)}</span></>;
    sub = <>Any holder can burn tokens for <span className="num">{price(d.book)}</span> BNB each, less the {bps(t.exitFeeBps)} fee kept by the treasury. The tap is paused.</>;
    meter = <Bar value={t.roundLength - roundLeft} max={t.roundLength} tone="warn" label="Round elapsed" />;
    action = <Link className="btn btn-accent btn-sm" href={`${base}/redeem`}>Redeem at book</Link>;
  } else if (d.hbLeft <= 0) {
    tone = "warn"; icon = "heart";
    title = "Abandonment is due";
    sub = <>The keeper will open the treasury to holders within minutes. No heartbeat from the {who(v)} for <span className="num">{duration(v.now - v.lastHeartbeat)}</span>, past its {span(t.heartbeat)} window.</>;
    action = <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Declare now</button>;
  } else if (v.state === "COOLDOWN") {
    tone = "neutral"; icon = "clock";
    title = <>Cooldown · the exit trigger re-arms {relative(v.exit.cooldownEndsAt ?? v.now, v.now)}</>;
    sub = "A round just closed. The streak starts counting again after the cooldown.";
    action = <button className="btn btn-secondary btn-sm" onClick={() => void run("poke")}><Icon name="pulse" size={14} />Poke</button>;
  } else if (d.prem < 0) {
    tone = "warn"; icon = "trendDown";
    title = <>Exit streak building · <span className="num">{duration(v.exit.streak)}</span> of <span className="num">{duration(t.exitStreak)}</span></>;
    sub = <>The pool trades <span className="num">{pct(-d.prem, 1)}</span> under book. {d.eta !== null ? <>At this price a round opens in <span className="num">{duration(d.eta)}</span>.</> : null}</>;
    meter = <Bar value={v.exit.streak} max={t.exitStreak} tone="warn" label="Streak" />;
    action = <button className="btn btn-secondary btn-sm" onClick={() => void run("poke")} title="Record the pool's time-weighted price and step every counter"><Icon name="pulse" size={14} />Poke</button>;
  } else {
    tone = "good"; icon = "shieldCheck";
    title = <>Rules armed · trading <span className="num">{signedPct(d.prem)}</span> against book</>;
    sub = v.exit.streak > 0 ? <>Above book, so the exit streak decays an hour per hour (<span className="num">{duration(v.exit.streak)}</span> left). Heartbeat due in <span className="num">{duration(d.hbLeft)}</span>.</> : <>Nothing is counting toward an exit. Heartbeat due in <span className="num">{duration(d.hbLeft)}</span>.</>;
    action = <button className="btn btn-secondary btn-sm" onClick={() => void run("poke")} title="Record the pool's time-weighted price and step every counter"><Icon name="pulse" size={14} />Poke</button>;
  }

  return (
    <div className={`strip ${tone}`} role="status">
      <span className="strip-ic"><Icon name={icon} size={19} /></span>
      <div className="strip-txt"><b>{title}</b><span>{sub}</span></div>
      {meter ? <div className="strip-meter">{meter}</div> : null}
      {action}
      <ConfirmAction open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void run("declareAbandoned"); }}
        title={`Declare ${v.terms.name} abandoned?`} confirmLabel="Declare abandoned"
        lead={<>The {who(v)} has sent no heartbeat for <span className="num">{duration(v.now - v.lastHeartbeat)}</span>, past its {span(t.heartbeat)} window. This switches the vault to wind-down for good.</>}
        points={[
          { icon: "coins", text: <>The tap stops. The {who(v)} draws nothing more.</> },
          { icon: "burn", text: <>Locked team tokens burn (<span className="num">{tokens(v.lockedTeam)}</span> {t.symbol}).</> },
          { icon: "vault", text: <>The treasury opens to holders: redeem at book (<span className="mono">{price(d.book)}</span> BNB per token) with no fee and no deadline.</> },
          ...(v.issuer.kind === "agent" ? [{ icon: "agent" as const, text: <>The outcome is written to agent #{v.issuer.agentId}&apos;s ERC-8004 record, where its next raise will show it.</> }] : []),
          { icon: "lock", text: <>It cannot be undone, by anyone.</> },
        ]}
        gas={<>Anyone can send this. The wallet you send it from pays the network fee (gas); nothing comes out of the treasury.</>} />
    </div>
  );
}

function Bar({ value, max, tone, label, marks }: { value: number; max: number; tone?: "warn" | "good"; label: string; marks?: number[] }) {
  return (
    <>
      <div className="row between t-xs w5"><span className="muted">{label}</span><span className="num ink">{pct(max > 0 ? Math.min(1, value / max) : 0, 0)}</span></div>
      <Meter value={value} max={max} tone={tone} marks={marks} label={label} />
    </>
  );
}

/* ---------- Overview grid ---------- */

const SEG = { raise: "var(--accent)", tax: "var(--good)", revenue: "var(--agent)", owed: "var(--warn)" };

export function Overview({ v, d }: { v: CovenantView; d: Derived }) {
  return launchedOf(v) ? (
    <div className="hgrid ov">
      <div className="hcell a-t rise" style={{ ["--i" as string]: 0 } as CSSProperties}><TreasuryCell v={v} d={d} /></div>
      <div className="hcell a-p rise" style={{ ["--i" as string]: 1 } as CSSProperties}><PriceCell v={v} d={d} /></div>
      <div className="hcell a-b rise" style={{ ["--i" as string]: 2 } as CSSProperties}><BudgetCell v={v} d={d} /></div>
      <div className="hcell a-l rise" style={{ ["--i" as string]: 3 } as CSSProperties}><LiquidityCell v={v} /></div>
    </div>
  ) : (
    <div className="hgrid ov">
      <div className="hcell a-t rise"><RaiseCell v={v} /></div>
      <div className="hcell a-p rise" style={{ ["--i" as string]: 1 } as CSSProperties}><ProjectionCell v={v} d={d} /></div>
      <div className="hcell a-b rise" style={{ ["--i" as string]: 2 } as CSSProperties}><BudgetCell v={v} d={d} /></div>
      <div className="hcell a-l rise" style={{ ["--i" as string]: 3 } as CSSProperties}><FloorCell v={v} d={d} /></div>
    </div>
  );
}

function TreasuryCell({ v, d }: { v: CovenantView; d: Derived }) {
  const s = d.sums;
  const inflow = Math.max(1e-9, s.raise + s.tax + s.revenue);
  const held = Math.max(0, Math.min(1, v.treasury / inflow));
  // Until the ledger has rows (read from contract logs), only the vault's own balance is shown, never estimated sources.
  const hasLedger = v.ledger.length > 0;
  const vault = v.vault ? explorerAddress(v.chainId, v.vault) : null;
  return (
    <>
      <div className="row between"><span className="lbl">Treasury</span>{v.vault ? <Addr a={v.vault} chainId={liveChain(v)} /> : null}</div>
      <div className="fig-xl"><Fig src={`vault balance ${v.vault ?? ""}`} href={v.source === "live" ? vault : null}><Ticker value={v.treasury} format={(n) => bnb(n)} /></Fig><BnbUnit /></div>
      <p className="t-s muted w5">{d.bnbUsd ? <><span className="num">{usd(d.treasuryUsd)}</span> at Atlas BNB/USD <span className="num">{usd(d.bnbUsd, 2)}</span></> : "BNB held by the vault"}</p>
      {hasLedger ? <div>
        <div className="segbar" aria-hidden>
          <i style={{ flex: s.raise / inflow, background: SEG.raise }} />
          <i style={{ flex: s.tax / inflow, background: SEG.tax, animationDelay: "60ms" }} />
          {s.revenue > 0 ? <i style={{ flex: s.revenue / inflow, background: SEG.revenue, animationDelay: "120ms" }} /> : null}
        </div>
        <div className="subbar" style={{ width: `${held * 100}%` }} title={`${pct(held, 0)} of everything that came in is still in the vault`} />
      </div> : <div className="segbar" aria-hidden><i style={{ flex: 1, background: SEG.raise }} /></div>}
      {hasLedger ? <div className="legend">
        <LegendRow c={SEG.raise} k="Raise, treasury share" val={`+${bnb(s.raise)}`} />
        <LegendRow c={SEG.tax} k="Trading tax" val={`+${bnb(s.tax)}`} />
        <LegendRow c={SEG.revenue} k={v.issuer.kind === "agent" ? "Agent revenue" : "Issuer revenue"} val={`+${bnb(s.revenue)}`} />
        <LegendRow c="var(--line-strong)" k="Tap paid out" val={bnb(s.tap)} out />
        {s.redeem !== 0 ? <LegendRow c="var(--line-strong)" k="Redeemed by holders" val={bnb(s.redeem)} out /> : null}
        <LegendRow c={SEG.owed} k={`Owed to the ${who(v)} (accrued tap)`} val={bnb(v.owedTeam || v.tap.accrued)} out />
      </div> : (
        <div className="legend">
          <LegendRow c={SEG.raise} k="Held by the vault" val={bnb(v.treasury)} />
          <LegendRow c={SEG.owed} k={`Owed to the ${who(v)} (accrued tap)`} val={bnb(v.owedTeam || v.tap.accrued)} out />
          <p className="t-xs muted w5">Sources (raise, tax, revenue, tap) appear as the ledger reads them from contract logs.</p>
        </div>
      )}
      {hasLedger && Math.abs(s.raise + s.tax + s.revenue + s.tap + s.redeem - v.treasury) > 0.005 ? <p className="t-xs warn-t w5">Ledger and vault balance differ by {bnb(v.treasury - (s.raise + s.tax + s.revenue + s.tap + s.redeem), 4)} BNB; forced sends count as revenue on the next sync.</p> : null}
      <div className="nav-line">
        <span className="ink2"><span className="muted">—</span> Book value per token</span>
        <span className="mono ink"><Fig src="vault.bookValue() = (balance − owedTeam) / redeemableSupply">{price(d.book)}</Fig></span>
      </div>
      <p className="t-xs muted w5" style={{ marginTop: -4 }}>Across <span className="num">{tokens(d.R)}</span> redeemable {v.terms.symbol} · <span className="num">{pct(d.floorRatioNow, 1)}</span> of the sale price</p>
      {v.history.length > 1 ? (
        <div style={{ marginTop: "auto", display: "grid", gap: 6, paddingTop: 8 }}>
          <div className="row between t-xs muted w5"><span>Book value over time</span><span className="num">{date(v.history[0]!.t)} to {date(v.history[v.history.length - 1]!.t)}</span></div>
          <BookTrend points={v.history} />
        </div>
      ) : null}
    </>
  );
}

function LegendRow({ c, k, val, out }: { c: string; k: string; val: string; out?: boolean }) {
  return <div className={cx("legend-row", out && "out")}><span className="sw" style={{ background: c }} /><span className="trunc">{k}</span><span className="v num">{val}</span></div>;
}

function PriceCell({ v, d }: { v: CovenantView; d: Derived }) {
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const from = range === "all" ? 0 : v.now - (range === "7d" ? 7 : 30) * DAY;
  const pts = v.history.filter((p) => p.t >= from);
  const vsSale = d.salePrice > 0 ? v.poolPrice / d.salePrice - 1 : 0;
  const ratio = d.book > 0 ? v.poolPrice / d.book : 0;
  const pair = v.pair ? explorerAddress(v.chainId, v.pair) : null;
  return (
    <>
      <div className="row between wrap-ok"><span className="lbl">Token price against book</span><Segmented size="sm" label="Range" value={range} onChange={setRange} options={[{ value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "all", label: "All" }]} /></div>
      <div className="price-row">
        <span className="fig-lg"><Fig src="pair cumulative price, last poke" href={v.source === "live" ? pair : null}>{price(v.poolPrice)}</Fig><BnbUnit /></span>
        <span className={cx("chg", vsSale < 0 ? "down" : "up")}>{signedPct(vsSale)}</span>
      </div>
      <p className="t-s muted w5">vs <span className="num">{price(d.salePrice)}</span> sale price · <span className="ink">—</span> Book <span className="num ink">{price(d.book)}</span> · <span className={cx("num", ratio < 1 ? "down" : "up")}>{ratio.toFixed(2)}×</span>{d.twap72 ? <> · 72h TWAP <span className="num">{signedPct(d.twap72.price / d.twap72.book - 1)}</span></> : null}</p>
      <PriceBookChart key={range} points={pts} bands={v.bands} salePrice={d.salePrice} now={v.now} height={220} />
      <div className="cell-foot">
        {pair && v.source === "live" ? <a className="tlink" href={pair} target="_blank" rel="noreferrer"><Icon name="swap" size={15} />Trade on PancakeSwap<Icon name="chevronRight" size={14} /></a> : <span className="tlink" style={{ textDecoration: "none" }}><Icon name="swap" size={15} />PancakeSwap pool, seeded at the sale price</span>}
        <Link className="tlink" href={`/app/c/${v.id}/redeem`}><Icon name="redeem" size={15} />Compare redeeming<Icon name="chevronRight" size={14} /></Link>
      </div>
    </>
  );
}

function BudgetCell({ v, d }: { v: CovenantView; d: Derived }) {
  const t = v.terms;
  const used = v.tap.claimedThisPeriod + v.tap.accrued;
  const runway = d.budget.bnb > 0 ? v.treasury / d.budget.bnb : 0;
  const launched = launchedOf(v);
  return (
    <>
      <div className="row between"><span className="lbl">Operating budget</span><span className={cx("tag", d.tapPaused ? "warn" : "good")}>{!launched ? "Starts at launch" : d.tapPaused ? "Paused" : "Accruing"}</span></div>
      <div className="fig-md"><span className="num">{usd(t.tapUsdPer30d)}</span><span className="u">/ 30 days</span></div>
      <p className="t-s muted w5">≈ <span className="num">{bnb(d.budget.bnb)}</span> BNB at the Atlas rate · capped at {bps(t.tapCapBps)} of the treasury ({d.budget.binding === "cap" ? "cap binds" : "dollar budget binds"})</p>
      {launched ? (
        <>
          <Meter value={used} max={Math.max(d.cap30, used)} label="Tap drawn or owed this period against the cap" />
          <dl className="kv">
            <dt>Claimable now</dt><dd className="num">{bnb(v.tap.accrued)} BNB</dd>
            <dt>Runway at this draw</dt><dd className="num">{runway > 0 ? `${runway.toFixed(0)} months` : "–"}</dd>
          </dl>
        </>
      ) : <p className="t-xs muted w5">It can be lowered at any time, never raised.</p>}
    </>
  );
}

function LiquidityCell({ v }: { v: CovenantView }) {
  const share = v.poolSeedBnb > 0 ? v.poolBnb / v.poolSeedBnb : 0;
  return (
    <>
      <div className="row between"><span className="lbl">Spot liquidity</span><span className="tag"><Icon name="lock" size={11} />LP locked</span></div>
      <div className="fig-md"><span className="num">{bnb(v.poolBnb)}</span><BnbUnit /></div>
      <p className="t-s muted w5">{v.terms.symbol}/WBNB on PancakeSwap, seeded with <span className="num">{bnb(v.poolSeedBnb)}</span> BNB</p>
      <Meter value={v.poolBnb} max={Math.max(v.poolSeedBnb, v.poolBnb)} marks={[v.poolSeedBnb / 2]} tone={share < 0.5 ? "warn" : undefined} label="Pool BNB against the launch seed" />
      <p className="t-xs muted w5">{share < 0.5 ? "Under half the seed: team unlock counters pause. The exit never waits on depth." : <><span className="num">{pct(share, 0)}</span> of the seed. The depth gate guards team unlocks only.</>}</p>
    </>
  );
}

function RaiseCell({ v }: { v: CovenantView }) {
  const t = v.terms;
  const C = v.raise.committed;
  return (
    <>
      <span className="lbl">{v.state === "FAILED" ? "Committed, refunding" : "Committed"}</span>
      <div className="fig-xl"><Ticker value={C} format={(n) => bnb(n, C >= 100 ? 0 : 2)} /><BnbUnit /></div>
      <p className="t-s muted w5">From {v.raise.contributors || "–"} wallets · minimum <span className="num">{bnb(t.minRaise, 0)}</span> · cap <span className="num">{bnb(t.cap, 0)}</span></p>
      <Meter value={C} max={Math.max(t.cap * 1.05, C)} marks={[t.minRaise, t.cap]} tone={C >= t.minRaise ? "good" : undefined} size="lg" label="Committed against minimum and cap" />
      <div className="row between t-xs muted w5"><span>{C >= t.cap ? `${(C / t.cap).toFixed(2)}× oversubscribed` : C >= t.minRaise ? "Minimum met" : `${bnb(t.minRaise - C, 1)} BNB to the minimum`}</span><span className="num">{pct(C / t.cap, 0)} of cap</span></div>
      <div className="nav-line" style={{ marginTop: "auto" }}><span className="ink2">Closes</span><span className="num ink">{date(v.raise.deadline)}</span></div>
    </>
  );
}

function ProjectionCell({ v, d }: { v: CovenantView; d: Derived }) {
  const r = settleRaise(v.raise.committed, v.terms.minRaise, v.terms.cap, d.sp);
  return (
    <>
      <span className="lbl">If the raise closed now</span>
      {r.failed ? <div className="fig-md">Full refunds</div> : <div className="fig-md"><span className="num">{bnb(r.T0)}</span><span className="u">BNB to the vault</span></div>}
      <dl className="kv">
        <dt>Accepted into the sale</dt><dd className="num">{bnb(r.Q)} BNB</dd>
        <dt>Refunded pro rata</dt><dd className="num">{bnb(r.refunded)} BNB</dd>
        <dt>Seeds the pool</dt><dd className="num">{bnb(r.qPool)} BNB + {tokens(d.sp.P)}</dd>
        <dt>Sale price</dt><dd className="mono">{r.failed ? "–" : price(r.salePrice)}</dd>
      </dl>
      <p className="t-xs muted w5" style={{ marginTop: "auto" }}>One transaction refunds the excess, launches on Flap, seeds the pool at the sale price and moves the rest into the vault.</p>
    </>
  );
}

function FloorCell({ v, d }: { v: CovenantView; d: Derived }) {
  return (
    <>
      <span className="lbl">Starting floor</span>
      <div className="fig-md"><span className="num">{pct(d.startRatio, 0)}</span><span className="u">of the sale price</span></div>
      <p className="t-s muted w5">Each token is backed by treasury BNB from day one. The floor falls as the {who(v)} spends and rises with tax and revenue.</p>
      <Meter value={d.startRatio} max={1} label="Starting floor" />
    </>
  );
}

/* ---------- The five rules: one module ---------- */

type RuleTone = "good" | "warn" | "bad" | "agent" | "accent" | "";
interface RuleRow {
  key: string; icon: IconName; name: string; terms: string;
  state: string; tone: RuleTone; figure: ReactNode; figSub?: string;
  meter?: { value: number; max: number; tone?: "good" | "warn" | "bad" | "agent" };
  next: ReactNode; detail: ReactNode; attention: number;
}

function useRuleRows(v: CovenantView, d: Derived): RuleRow[] {
  const t = v.terms;
  const launched = launchedOf(v);
  const ended = v.state === "WIND_DOWN";
  const inRound = v.state === "EXIT_ROUND";
  const hbLeft = useCountdown(Math.max(0, d.hbLeft));
  const etaLeft = useCountdown(Math.max(0, d.eta ?? 0));
  const roundLeft = useCountdown(Math.max(0, (v.exit.roundEndsAt ?? v.now) - v.now));
  const reportLeft = useCountdown(Math.max(0, (v.disclosure.nextDueAt ?? v.now) - v.now));
  const used = v.tap.claimedThisPeriod + v.tap.accrued;
  const hbUsed = Math.max(0, v.now - v.lastHeartbeat);
  const cliffEnd = (v.raise.launchedAt ?? v.now) + t.cliff;
  const unlocked = v.tranches.filter((x) => x.unlocked).length;
  const bestTr = v.tranches.filter((x) => !x.unlocked).reduce((a, x) => Math.max(a, x.progress / Math.max(1, t.unlockWindow)), 0);
  const w = who(v);

  if (!launched) {
    return [
      { key: "tap", icon: "coins", name: "Tap", terms: `${usd(t.tapUsdPer30d)} per 30 days, capped at ${bps(t.tapCapBps)} of the treasury`, state: "", tone: "", figure: <span className="num">{usd(t.tapUsdPer30d)}</span>, figSub: "per 30 days", next: "Only ever lowered", detail: `The ${w} draws a dollar budget at the Atlas rate, never more than ${bps(t.tapCapBps)} of the treasury in any 30 days. It can lower the tap, never raise it.`, attention: 0 },
      { key: "unlock", icon: "unlock", name: "Performance unlock", terms: `${t.trancheMultiple.map(multiple).join(", ")} held for ${span(t.unlockWindow)}`, state: "", tone: "", figure: <span className="num">{bps(d.teamBps)}</span>, figSub: "team tokens", next: t.cliff > 0 ? `${span(t.cliff)} cliff first` : "No cliff", detail: `Team tokens unlock in tranches only after the dollar price holds each multiple of the sale price for ${span(t.unlockWindow)} of trusted observations.`, attention: 0 },
      { key: "exit", icon: "exit", name: "Book-value exit", terms: `${span(t.exitStreak)} under book opens a ${span(t.roundLength)} round`, state: "", tone: "", figure: <span className="num">{span(t.exitStreak)}</span>, figSub: "under book", next: `${bps(t.exitFeeBps)} fee, none at wind-down`, detail: "The streak decays instead of resetting and compares on-chain numbers only: the pool's time-weighted price against book value. No vote, no oracle, no depth gate.", attention: 0 },
      { key: "heartbeat", icon: "heart", name: "Abandonment switch", terms: `Silence for ${span(t.heartbeat)} opens the treasury`, state: "", tone: "", figure: <span className="num">{span(t.heartbeat)}</span>, figSub: "window", next: "Anyone can flip it", detail: `If the ${w} stops for ${span(t.heartbeat)}, anyone can switch the vault to wind-down: the tap stops, locked team tokens burn and holders redeem at book with no fee.`, attention: 0 },
      { key: "report", icon: "doc", name: "Disclosure", terms: "A report every 30 days", state: "", tone: "", figure: <span className="num">30 days</span>, figSub: "cadence", next: "A miss pauses the tap", detail: "The report URI and its hash go on-chain each period. A missed or failed report pauses the tap until a passing one lands.", attention: 0 },
    ];
  }

  const tapState = ended ? ["Ended", "bad"] : inRound ? ["Paused for the round", "warn"] : d.tapPaused ? ["Paused", "warn"] : v.tap.accrued > 0 ? ["Accruing", "good"] : ["Holding", "good"];
  const unlockState = ended ? ["Burned at wind-down", "bad"] : unlocked === v.tranches.length && unlocked > 0 ? ["All unlocked", "good"] : unlocked > 0 ? [`${unlocked} of ${v.tranches.length} unlocked`, "agent"] : v.now < cliffEnd ? ["In cliff", ""] : bestTr > 0 ? ["Counting", "agent"] : ["Below every multiple", ""];
  const exitState = ended ? ["Open for good", "bad"] : inRound ? ["Round open", "warn"] : v.state === "COOLDOWN" ? ["Cooldown", ""] : d.prem < 0 ? ["Counting under book", "warn"] : v.exit.streak > 0 ? ["Decaying above book", "good"] : ["Above book", "good"];
  const hbState = ended ? ["Switched", "bad"] : d.hbLeft <= 0 ? ["Due: the keeper opens it", "warn"] : d.hbLeft < 0.25 * t.heartbeat ? ["Going quiet", "warn"] : ["Present", "good"];
  const behind = v.disclosure.due > v.disclosure.passed;
  const repState = ended ? ["Closed", ""] : behind ? ["Behind", "warn"] : ["On time", "good"];

  return [
    {
      key: "tap", icon: "coins", name: "Tap", terms: `${usd(t.tapUsdPer30d)} / 30 days · cap ${bps(t.tapCapBps)} of treasury`,
      state: tapState[0]!, tone: tapState[1] as RuleTone,
      figure: <><span className="num">{bnb(v.tap.accrued)}</span><BnbUnit /></>, figSub: "claimable",
      meter: d.cap30 > 0 ? { value: used, max: Math.max(d.cap30, used) } : undefined,
      next: ended ? "Ended at wind-down" : d.cap30 > 0 ? <><span className="num">{bnb(used)}</span> of <span className="num">{bnb(d.cap30)}</span> BNB cap this period</> : "Cap follows the treasury",
      detail: <>The {w} draws {usd(t.tapUsdPer30d)} per 30 days at the Atlas rate (about <span className="num">{bnb(d.budget.bnb)}</span> BNB today), never more than {bps(t.tapCapBps)} of the treasury. The {d.budget.binding === "cap" ? "cap" : "dollar budget"} binds today. It can lower the tap, never raise it, and it pauses during an exit round.</>,
      attention: 0,
    },
    {
      key: "unlock", icon: "unlock", name: "Performance unlock", terms: `${t.trancheMultiple.map(multiple).join(" · ")} held ${span(t.unlockWindow)}`,
      state: unlockState[0]!, tone: unlockState[1] as RuleTone,
      figure: <><span className="num">{unlocked}</span><span className="u">of {v.tranches.length}</span></>, figSub: "tranches",
      meter: { value: unlocked === v.tranches.length ? 1 : bestTr, max: 1, tone: unlocked === v.tranches.length ? "good" : "agent" },
      next: ended ? "Locked tranches were burned" : v.now < cliffEnd ? <>Cliff ends {date(cliffEnd)}</> : bestRunLine(v) || "Counting on the strict gate",
      detail: (
        <div className="stack-sm" style={{ display: "grid" }}>
          <span>Team tokens unlock only after the dollar price holds each multiple for {span(t.unlockWindow)} of trusted observations{t.cliff > 0 ? `, after a ${span(t.cliff)} cliff` : ""}. The strict gate counts: fresh Atlas report, pool at least half its seed.</span>
          {v.tranches.map((tr) => (
            <span key={tr.multiple} style={{ display: "grid", gap: 4 }}>
              <span className="row between t-xs w5"><span className="ink">{multiple(tr.multiple)} <span className="muted">· {bps(tr.bps)} of supply</span></span><span className="num muted">{tr.unlocked ? "unlocked" : `${duration(tr.progress)} of ${duration(t.unlockWindow)}`}</span></span>
              <Meter size="sm" value={tr.unlocked ? 1 : tr.progress} max={tr.unlocked ? 1 : t.unlockWindow} tone={tr.unlocked ? "good" : "agent"} label={`${multiple(tr.multiple)} tranche`} />
            </span>
          ))}
        </div>
      ),
      attention: 0,
    },
    {
      key: "exit", icon: "exit", name: "Book-value exit", terms: `${span(t.exitStreak)} under book · ${span(t.roundLength)} round`,
      state: exitState[0]!, tone: exitState[1] as RuleTone,
      figure: ended ? <span className="num">Open</span> : inRound ? <span className="num">{duration(roundLeft, 2)}</span> : <><span className="num">{pct(Math.min(1, v.exit.streak / Math.max(1, t.exitStreak)), 0)}</span><span className="u">streak</span></>, figSub: ended ? "no fee, no deadline" : inRound ? "left in the round" : `${duration(v.exit.streak)} of ${duration(t.exitStreak)}`,
      meter: ended ? { value: 1, max: 1, tone: "bad" } : { value: inRound ? t.roundLength - roundLeft : v.exit.streak, max: inRound ? t.roundLength : t.exitStreak, tone: "warn" },
      next: ended ? "Redemption open forever, no fee" : inRound ? <>Redeem at <span className="mono">{price(d.book)}</span> BNB per token</> : v.state === "COOLDOWN" ? <>Re-arms {relative(v.exit.cooldownEndsAt ?? v.now, v.now)}</> : d.eta !== null ? <>Opens in <span className="num">{duration(etaLeft, 3)}</span> at this price</> : v.exit.streak > 0 ? "Decays an hour per hour above book" : "Nothing counting",
      detail: <>If the pool trades under book for {span(t.exitStreak)}, a {span(t.roundLength)} round opens and any holder can burn tokens for book value, less a {bps(t.exitFeeBps)} fee kept by the treasury. Fixed after review: the streak <b>decays</b> instead of resetting, and it compares <b>on-chain numbers only</b> (pool TWAP against book), with no depth gate and no Atlas.</>,
      attention: inRound ? 3 : d.prem < 0 && v.state === "ACTIVE" ? 2 : 0,
    },
    {
      key: "heartbeat", icon: "heart", name: "Abandonment switch", terms: `Silence for ${span(t.heartbeat)} opens the treasury`,
      state: hbState[0]!, tone: hbState[1] as RuleTone,
      figure: ended ? <span className="num">Switched</span> : <span className="num">{d.hbLeft > 0 ? duration(hbLeft, 2) : "Now"}</span>, figSub: ended ? "wound down" : d.hbLeft > 0 ? "until it can flip" : "keeper declares within minutes",
      meter: { value: ended ? t.heartbeat : hbUsed, max: t.heartbeat, tone: ended ? "bad" : d.hbLeft <= 0 || d.hbLeft < 0.25 * t.heartbeat ? "warn" : "good" },
      next: ended ? "Redemption is open with no fee" : <>Last heartbeat {relative(v.lastHeartbeat, v.now)}</>,
      detail: <>If the {w} stops for {span(t.heartbeat)}, the vault switches to wind-down: the keeper declares it within minutes, and anyone can as a backup. The tap stops, locked team tokens burn and holders redeem at book with no fee and no deadline. Claiming the tap, lowering it and posting a report all count as a heartbeat.{v.issuer.lastAction ? <> Last action: {v.issuer.lastAction.what.toLowerCase()}.</> : null}</>,
      attention: !ended && d.hbLeft <= 0 ? 4 : 0,
    },
    {
      key: "report", icon: "doc", name: "Disclosure", terms: "A report every 30 days",
      state: repState[0]!, tone: repState[1] as RuleTone,
      figure: <><span className="num">{v.disclosure.passed}</span><span className="u">of {Math.max(v.disclosure.due, v.disclosure.passed)}</span></>, figSub: "reports",
      meter: { value: v.disclosure.passed, max: Math.max(1, v.disclosure.due, v.disclosure.passed), tone: "good" },
      next: ended ? "No reports after wind-down" : v.disclosure.nextDueAt ? <>Next due in <span className="num">{duration(reportLeft, 2)}</span></> : "First due 30 days after launch",
      detail: <>The report URI and its hash go on-chain each period. A missed or failed report pauses the tap until a passing one lands.{v.disclosure.lastUri ? <> Last: <span className="mono anywhere">{v.disclosure.lastUri}</span></> : null}</>,
      attention: behind && !ended ? 1 : 0,
    },
  ];
}

/** The five rules as one module: a summary, the rule that needs attention featured, then a status row per rule. */
export function RulesModule({ v, d }: { v: CovenantView; d: Derived }) {
  const rows = useRuleRows(v, d);
  const launched = launchedOf(v);
  const [open, setOpen] = useState<string | null>(null);
  const feat = launched ? [...rows].sort((a, b) => b.attention - a.attention)[0]! : null;
  const featured = feat && feat.attention > 0 ? feat : null;
  const holding = rows.filter((r) => r.tone === "good" || r.tone === "agent" || r.tone === "").length;
  const flagged = rows.length - holding;

  return (
    <section className="rbox rise" aria-label="The five rules">
      <header className="rbox-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="h-sec">The five rules</h2>
          <p className="t-s muted w5">{launched ? "Read from the vault on every poke. Each figure links back to the contract read behind it." : "Fixed at creation. They arm with the vault, in the transaction that launches the token."}</p>
        </div>
        {v.state === "WIND_DOWN" ? (
          <div className="rbox-sum"><span className="pips">{rows.map((r) => <i key={r.key} className="pip bad" />)}</span><span className="t-s w5 muted">Wound down: <span className="ink">redemption open for good</span></span></div>
        ) : launched ? (
          <div className="rbox-sum" aria-label={`${holding} of 5 rules holding`}>
            <span className="pips">{rows.map((r) => <i key={r.key} className={cx("pip", r.tone || "neutral")} title={`${r.name}: ${r.state}`} />)}</span>
            <span className="t-s w5"><b className="num ink">{holding}</b> <span className="muted">holding</span>{flagged ? <> · <b className={cx("num", rows.some((r) => r.tone === "bad") ? "down" : "warn-t")}>{flagged}</b> <span className="muted">need{flagged === 1 ? "s" : ""} attention</span></> : null}</span>
          </div>
        ) : <span className="badge lg"><Icon name="lock" size={13} />Arm at launch</span>}
      </header>

      {featured ? (
        <div className={cx("rfeat", featured.tone)}>
          <div className="rfeat-l">
            <span className="eyebrow rfeat-eb">Needs attention</span>
            <div className="row" style={{ gap: 12 }}><span className={cx("icon-tile", featured.tone)}><Icon name={featured.icon} size={18} /></span><h3 className="h-sec" style={{ fontSize: 22 }}>{featured.name}</h3></div>
            <p className="t-s ink2 w5" style={{ maxWidth: "60ch" }}>{featured.detail}</p>
          </div>
          <div className="rfeat-r">
            <span className={cx("rstate", featured.tone)}><i />{featured.state}</span>
            <div className="rfeat-fig">{featured.figure}</div>
            <span className="t-s muted w5">{featured.next}</span>
            {featured.meter ? <Meter size="lg" value={featured.meter.value} max={featured.meter.max} tone={featured.meter.tone} label={featured.name} /> : null}
          </div>
        </div>
      ) : null}

      <div className="rrows" role="list">
        {rows.map((r, i) => {
          const isOpen = open === r.key;
          return (
            <div key={r.key} role="listitem" className={cx("rrow rise", isOpen && "open")} style={{ ["--i" as string]: i + 1 } as CSSProperties}>
              <button type="button" className="rrow-main" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)}>
                <span className={cx("icon-tile sm", r.tone)}><Icon name={r.icon} size={15} /></span>
                <span className="rrow-name"><b>{r.name}</b><span>{r.terms}</span></span>
                {launched ? <span className="rrow-state"><span className={cx("rstate", r.tone)}><i />{r.state}</span><span className="t-xs muted w5 trunc">{r.next}</span></span> : <span className="rrow-state"><span className="t-xs muted w5">{r.next}</span></span>}
                <span className="rrow-meter">{r.meter ? <Meter value={r.meter.value} max={r.meter.max} tone={r.meter.tone} label={r.name} /> : null}</span>
                <span className="rrow-fig"><span className="fig">{r.figure}</span>{r.figSub ? <span className="t-xs muted w5">{r.figSub}</span> : null}</span>
                <Icon name="chevronDown" size={16} className="rrow-chev" />
              </button>
              <div className="rrow-detail" aria-hidden={!isOpen}><div><div className="t-s muted w5 rrow-detail-in">{r.detail}</div></div></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Kept for screens that import the old name. */
export const RuleCards = RulesModule;

function bestRunLine(v: CovenantView) {
  const best = Math.max(0, ...v.tranches.map((t) => (t.unlocked ? 0 : t.bestRun ?? 0)));
  return best > 0 ? `Longest run so far: ${duration(best)} at 2x; a strict reading below resets it.` : "";
}

/** One line for lists: what happens next on this covenant. */
export function nextEvent(v: CovenantView, d: Derived): { text: string; tone: "accent" | "warn" | "bad" | "good" | "" } {
  if (v.state === "RAISING") return v.raise.deadline <= v.now ? { text: `Sale closed · anyone can finalize · ${pct(v.raise.committed / v.terms.cap, 0)} of cap`, tone: "accent" } : { text: `Closes in ${duration(v.raise.deadline - v.now)} · ${pct(v.raise.committed / v.terms.cap, 0)} of cap`, tone: "accent" };
  if (v.state === "FAILED") return { text: "Refunds open", tone: "" };
  if (v.state === "EXIT_ROUND") return { text: `Exit round ends in ${duration(v.exit.roundEndsAt! - v.now)}`, tone: "warn" };
  if (v.state === "WIND_DOWN") return { text: "Redemption open, no fee", tone: "bad" };
  if (d.hbLeft <= 0) return { text: "Abandonment due: the keeper opens it", tone: "warn" };
  if (d.eta !== null) return { text: `Exit opens in ${duration(d.eta)}`, tone: "warn" };
  return { text: `Heartbeat due in ${duration(d.hbLeft)}`, tone: "good" };
}

/* ---------- Tranches ---------- */

export function Tranches({ v }: { v: CovenantView }) {
  const t = v.terms;
  // One cell per day of the window; short demo windows get a fixed 30-cell bar.
  const cells = t.unlockWindow >= 2 * DAY ? Math.min(45, Math.round(t.unlockWindow / DAY)) : 30;
  const cliffEnd = (v.raise.launchedAt ?? v.now) + t.cliff;
  const { run } = useActions(v);
  return (
    <div className="card">
      <div className="card-head">
        <div><h3 className="h-card">Unlock tranches</h3><p className="t-xs muted w5">Rule 2 · counted on the strict gate (Atlas fresh, pool deep, prices agree)</p></div>
        <button className="btn btn-secondary btn-sm" disabled={!v.tranches.some((x) => x.unlocked)} onClick={() => void run("releaseTeam")}>Release unlocked</button>
      </div>
      {v.tranches.map((tr) => {
        const f = tr.unlocked ? 1 : Math.min(1, tr.progress / Math.max(1, t.unlockWindow));
        const filled = f * cells;
        return (
          <div key={tr.multiple} className="tr-row">
            <span className="tr-mult">{multiple(tr.multiple)}</span>
            <div className="tr-bar">
              <div className="row between t-s w5"><span className="ink">{bps(tr.bps)} of supply <span className="muted">· {tokens((t.totalSupply * tr.bps) / 10_000)} {t.symbol}</span></span><span className="num muted t-xs">{tr.unlocked ? "unlocked" : `${duration(tr.progress)} of ${duration(t.unlockWindow)}`}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))`, gap: 2 }} aria-label={`${pct(f, 0)} of the window held`}>
                {Array.from({ length: cells }, (_, k) => (
                  <span key={k} style={{ height: 10, borderRadius: 2, background: k < Math.floor(filled) ? (tr.unlocked ? "var(--good)" : "var(--agent)") : k < filled ? "color-mix(in srgb, var(--agent) 45%, var(--track))" : "var(--track)" }} />
                ))}
              </div>
            </div>
            <span className={cx("tag", tr.unlocked ? "good" : tr.progress > 0 ? "agent" : "")}>{tr.unlocked ? "Unlocked" : v.now < cliffEnd ? "Cliff" : tr.progress > 0 ? "Counting" : "Locked"}</span>
          </div>
        );
      })}
      <div className="card-foot"><span className="t-xs muted w5">{v.now < cliffEnd ? `Cliff ends ${date(cliffEnd)}. ` : ""}{bestRunLine(v) || "A strict reading under the multiple resets that tranche's count."}</span></div>
    </div>
  );
}

/* ---------- Treasury ledger ---------- */

const KIND: Record<LedgerKind, { label: string; tone: string }> = {
  raise: { label: "Raised", tone: "accent" },
  tax: { label: "Tax in", tone: "good" },
  revenue: { label: "Revenue in", tone: "agent" },
  tap: { label: "Tap out", tone: "warn" },
  redeem: { label: "Redeemed", tone: "bad" },
};

export function TreasuryLedger({ v, d }: { v: CovenantView; d: Derived }) {
  const [all, setAll] = useState(false);
  const sorted = [...v.ledger].sort((a, b) => b.at - a.at);
  const rows = all ? sorted : sorted.slice(0, 7);
  const agent = v.issuer.kind === "agent";
  return (
    <div className="card" id="ledger">
      <div className="card-head"><div><h3 className="h-card">Treasury ledger</h3><p className="t-xs muted w5">Every BNB in and out of the vault</p></div><span className="badge plain num">{`${v.ledger.length} entries`}</span></div>
      <div className="flow">
        {([["Raised", d.sums.raise, "ink"], ["Trading tax", d.sums.tax, "up"], [agent ? "Agent revenue" : "Revenue", d.sums.revenue, "agent-t"], ["Tap out", d.sums.tap, "muted"], ["Redeemed", d.sums.redeem, "muted"]] as const).map(([k, n, c]) => (
          <div key={k}><span className="t-xs muted w5">{k}</span><span className={cx("num w5", c)} style={{ fontSize: 15 }}>{n > 0 && k !== "Raised" ? "+" : ""}{bnb(n)}</span></div>
        ))}
      </div>
      {rows.length === 0 ? <p className="t-s muted w5" style={{ padding: 22 }}>No treasury movements yet.</p> : rows.map((r, i) => (
        <div key={i} className="ledger-row">
          <span className="when t-xs muted num">{date(r.at)}</span>
          <span><span className={cx("tag", KIND[r.kind].tone)}>{KIND[r.kind].label}</span></span>
          <span className="t-s muted trunc note-col" title={r.note}>{r.note}</span>
          <span className="ledger-amt">
            <span className={cx("num", r.amount >= 0 ? "ink" : "muted")}>{r.amount >= 0 ? "+" : "−"}{bnb(Math.abs(r.amount), 3)}</span>
            {r.tx ? <Addr a={r.tx} chainId={liveChain(v)} kind="tx" copy={false} /> : null}
          </span>
        </div>
      ))}
      {sorted.length > 7 ? <div className="card-foot"><span className="t-xs muted w5">{d.sums.revenue > 0 ? (agent ? "The agent routes what it earns to the vault, so revenue raises book value for every holder." : "Revenue sent to the vault raises book value for every holder.") : "Trading tax is dispatched to the vault and raises book value."}</span><button className="btn btn-ghost btn-sm" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${sorted.length}`}<Icon name={all ? "up" : "down"} size={14} /></button></div> : null}
    </div>
  );
}

/* ---------- Trust panel ---------- */

export function TrustPanel({ v }: { v: CovenantView }) {
  const g = v.trust;
  return (
    <div className="card" id="trust">
      <div className="card-head"><div><h3 className="h-card">Trust panel</h3><p className="t-xs muted w5">{g.lastPoke ? `Last poke ${relative(g.lastPoke, v.now)}` : "No poke yet"}</p></div><span className="badge good"><Icon name="shieldCheck" size={13} />No admin keys</span></div>
      <div className="card-body stack">
        <div className="grid2" style={{ gap: 12 }}>
          <Gate title="Exit gate" sub="Protects holders. Counts the exit streak." checks={g.exitGate} good />
          <Gate title="Strict gate" sub="Pays the team. Counts unlocks and prices the tap." checks={g.strictGate} />
        </div>
        <dl className="kv">
          <dt>Atlas BNB/USD</dt><dd className="num">{g.bnbUsd ? usd(g.bnbUsd, 2) : "–"}</dd>
          <dt>Atlas report age at last poke</dt><dd className="num">{g.atlasReportAge === null ? "–" : g.atlasReportAge <= 180 ? `${g.atlasReportAge} s` : duration(g.atlasReportAge)}</dd>
          <dt>Pool-only fallback</dt><dd>{g.poolOnlyMode ? "On" : "Off"}</dd>
        </dl>
        <Note icon="shield"><b>What you are trusting.</b> Flap&apos;s Guardian can upgrade the vault (the only upgrade path). Atlas is trusted for BNB/USD: a wrong rate misprices the tap and unlocks, but it cannot open or block an exit, because book value and pool price are both read on-chain. The PancakeSwap pair is the price, with liquidity locked at launch. No Covenant admin keys: no owner, no pause, no fee switch.</Note>
        <Note tone="warn"><b>What it does not cover.</b> The floor starts below the sale price and falls as the {who(v)} spends. The treasury is BNB, so its dollar value moves. Nothing off-chain (company, IP, revenue not sent to the vault) is protected.</Note>
      </div>
    </div>
  );
}

function Gate({ title, sub, checks, good }: { title: string; sub: string; checks: CovenantView["trust"]["exitGate"]; good?: boolean }) {
  return (
    <div className={cx("gate", good && "good")}>
      <div><div className="h-card" style={{ fontSize: 15 }}>{title}</div><p className="t-xs muted w5">{sub}</p></div>
      {checks.map((c) => (
        <div key={c.label} className="check">
          <span className={cx("ic", c.pass === null ? "na" : c.pass ? "ok" : "no")}><Icon name={c.pass === null ? "info" : c.pass ? "check" : "x"} size={12} strokeWidth={2} /></span>
          <div><div className="t-s ink w5">{c.label}</div><div className="t-xs muted w5">{c.detail}</div></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Issuer ---------- */

const OUTCOME_TONE: Record<string, string> = { active: "good", unlocked: "accent", "wound-down": "", abandoned: "bad", failed: "" };

export function IssuerBadge({ v }: { v: CovenantView }) {
  const i = v.issuer;
  const agent = i.kind === "agent";
  return (
    <div className="card" id="issuer">
      <div className="card-head"><h3 className="h-card">Issuer</h3>{agent ? <span className="badge agent">ERC-8004 agent</span> : <span className="badge">Human team</span>}</div>
      <div className="card-body stack">
        <div className="issuer">
          <span className={cx("icon-tile", agent && "agent")} style={{ width: 48, height: 48, borderRadius: 14 }}><Icon name={agent ? "agent" : "team"} size={22} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="h-card">{i.name ?? (agent ? `Agent #${i.agentId}` : "Team")}</div>
            <div className="t-xs muted w5 row" style={{ gap: 6 }}>Team wallet <Addr a={i.teamWallet} chainId={liveChain(v)} /></div>
          </div>
        </div>
        {agent ? (
          <dl className="kv">
            <dt>Agent id</dt><dd className="num">#{i.agentId}</dd>
            <dt>Identity registry</dt><dd><Addr a={i.registry} chainId={97} copy={false} /></dd>
            <dt>Registration file</dt><dd className="t-xs trunc" title={i.registrationUri}>{i.registrationUri ? i.registrationUri.replace(/^https?:\/\//, "") : "–"}</dd>
            {i.services?.length ? <><dt>Services</dt><dd className="t-xs">{i.services.map((s) => s.name).join(", ")}</dd></> : null}
            {i.supportedTrust?.length ? <><dt>Supported trust</dt><dd className="t-xs">{i.supportedTrust.join(", ")}</dd></> : null}
            {i.lastAction ? <><dt>Last action</dt><dd className="t-xs">{i.lastAction.what}, {relative(i.lastAction.at, v.now)}</dd></> : null}
          </dl>
        ) : (
          <p className="t-s muted w5">No agent identity. The rules bind the team wallet the same way; outcomes are not written to an ERC-8004 record.</p>
        )}
        <div>
          <div className="lbl" style={{ marginBottom: 2 }}>{agent ? "Track record" : "Covenant history"}</div>
          {i.outcomes.length === 0 ? <p className="t-xs muted w5" style={{ paddingTop: 8 }}>No history yet. A fresh identity carries no record; reputation helps from the second covenant.</p> : i.outcomes.map((o, k) => (
            <div key={k} className="outcome">
              <span className={cx("tag", OUTCOME_TONE[o.outcome])}>{o.outcome}</span>
              <span className="mono ink t-xs">{o.covenant}</span>
              <span className="muted trunc t-xs" title={o.detail}>{o.detail}</span>
              <span className="t-xs faint num">{date(o.at)}</span>
            </div>
          ))}
        </div>
        {agent ? <p className="t-xs muted w5">The vault writes abandonment, wind-down and unlocks to the agent&apos;s ERC-8004 reputation record. Only feedback from vaults this factory created counts here.</p> : null}
      </div>
    </div>
  );
}

/* ---------- Activity ---------- */

const EVT: Record<string, { tone: string; icon: IconName }> = {
  ExitRoundOpened: { tone: "warn", icon: "exit" }, ExitRoundClosed: { tone: "", icon: "exit" }, Redeemed: { tone: "warn", icon: "redeem" },
  TapClaimed: { tone: "accent", icon: "wallet" }, TapLowered: { tone: "good", icon: "trendDown" }, WoundDown: { tone: "bad", icon: "vault" },
  OutcomeRecorded: { tone: "agent", icon: "agent" }, RevenueRecognized: { tone: "good", icon: "coins" }, Heartbeat: { tone: "", icon: "heart" },
  ReportPosted: { tone: "good", icon: "doc" }, Observed: { tone: "accent", icon: "pulse" }, TreasuryFunded: { tone: "accent", icon: "vault" },
  Finalized: { tone: "accent", icon: "check" }, TrancheUnlocked: { tone: "agent", icon: "unlock" }, Contributed: { tone: "accent", icon: "plus" },
  Abandoned: { tone: "bad", icon: "heart" },
};
export function eventStyle(name: string) { return EVT[name] ?? { tone: "", icon: "activity" as IconName }; }
/** Event details with full addresses and hashes shortened, so a line reads at a glance. */
export function tidyDetail(s: string) { return s.replace(/0x[0-9a-fA-F]{40,64}/g, (a) => short(a)); }

export function EventFeed({ v, limit = 10 }: { v: CovenantView; limit?: number }) {
  const shown: FeedEvent[] = [];
  let beats = 0;
  for (const e of v.events) {
    if (e.name === "Heartbeat" && ++beats > 2) continue;
    shown.push(e);
    if (shown.length >= limit) break;
  }
  return (
    <div className="card" id="activity">
      <div className="card-head"><h3 className="h-card">Activity</h3><span className="t-xs muted w5">{v.source === "live" ? "From contract logs" : "Demo events"}</span></div>
      <div className="feed" style={{ paddingBottom: 12 }}>
        {shown.length === 0 ? <p className="t-s muted w5" style={{ padding: "0 22px 10px" }}>No events yet.</p> : shown.map((e, i) => {
          const s = eventStyle(e.name);
          return (
            <div key={i} className="feed-item">
              <span className={cx("feed-ic", s.tone)}><Icon name={s.icon} size={14} /></span>
              <div style={{ minWidth: 0, paddingTop: 3 }}>
                <div className="row between" style={{ gap: 8 }}><span className="ev">{e.name.replace(/([a-z])([A-Z])/g, "$1 $2")}</span><span className="t-xs faint w5" style={{ whiteSpace: "nowrap" }} title={dateTime(e.at)}>{relative(e.at, v.now)}</span></div>
                <div className="det" title={e.detail}>{tidyDetail(e.detail)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Terms and contracts ---------- */

export function TermsCard({ v, d }: { v: CovenantView; d: Derived }) {
  const t = v.terms;
  return (
    <div className="card" id="terms">
      <div className="card-head"><div><h3 className="h-card">Terms</h3><p className="t-xs muted w5">Fixed at creation. Only the tap can go down.</p></div></div>
      <div className="card-body">
        <dl className="kv">
          <dt>Supply</dt><dd className="num">{tokens(t.totalSupply)}</dd>
          <dt>Sale / pool / team</dt><dd className="num">{bps(t.saleBps)} / {bps(t.poolBps)} / {bps(d.teamBps)}</dd>
          <dt>Minimum and cap</dt><dd className="num">{bnb(t.minRaise, 0)} / {bnb(t.cap, 0)} BNB</dd>
          <dt>Sale price</dt><dd className="mono">{price(d.salePrice)}</dd>
          <dt>Starting floor</dt><dd className="num">{pct(d.startRatio, 0)} of sale price</dd>
          <dt>Trading tax</dt><dd className="num">{bps(t.buyTaxBps)} buy, {bps(t.sellTaxBps)} sell</dd>
          <dt>Tap</dt><dd className="num">{usd(t.tapUsdPer30d)} / 30d, cap {bps(t.tapCapBps)}</dd>
          <dt>Unlock tranches</dt><dd className="num">{t.trancheMultiple.map((m, k) => `${bps(t.trancheBps[k] ?? 0)} at ${multiple(m)}`).join(", ")}</dd>
          <dt>Exit</dt><dd className="num">{span(t.exitStreak)} streak · {span(t.roundLength)} round · {span(t.cooldown)} cooldown · {bps(t.exitFeeBps)} fee</dd>
          <dt>Heartbeat</dt><dd className="num">{span(t.heartbeat)}</dd>
        </dl>
      </div>
    </div>
  );
}

export function Contracts({ v }: { v: CovenantView }) {
  const rows: [string, string, string | undefined][] = [
    ["Launcher", "Raise and settlement", v.launcher],
    ["Vault", "Treasury and the five rules", v.vault],
    ["Token", v.terms.symbol, v.token],
    ["Pool", "PancakeSwap pair", v.pair],
    ["Oracle", "Observations and Atlas reports", v.oracle],
  ];
  return (
    <div className="card" id="contracts">
      <div className="card-head"><div><h3 className="h-card">Contracts</h3><p className="t-xs muted w5">{v.source === "live" ? `Deployed on chain ${v.chainId}` : "Demo addresses"}</p></div></div>
      <div className="alist" style={{ borderTop: "1px solid var(--line)" }}>
        {rows.map(([k, s, a]) => (
          <div key={k}>
            <div className="who"><b>{k}</b><span>{s}</span></div>
            {a ? <span className="addr-pill"><Addr a={a} chainId={liveChain(v)} /></span> : <span className="t-xs faint w5">Not deployed yet</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Covenant card (discover grids) ---------- */

export function CovenantCard({ v, i = 0 }: { v: CovenantView; i?: number }) {
  const d = derive(v);
  const launched = launchedOf(v);
  const nx = nextEvent(v, d);
  return (
    <Link href={`/app/c/${v.id}`} className="ccard lift rise" style={{ ["--i" as string]: i } as CSSProperties}>
      <div className="ccard-cover cover" style={coverVars(seedOf(v))}>
        <CoverCut />
        <div className="cover-meta" style={{ display: "flex", top: 10, bottom: "auto", right: 10 }}><StateBadge state={v.state} /></div>
      </div>
      <TokenAvatar seed={seedOf(v)} size={52} issuer={v.issuer.kind} />
      <div className="ccard-body">
        <div style={{ display: "grid", gap: 6 }}>
          <div className="row base" style={{ gap: 8 }}><span className="h-card trunc">{v.terms.name}</span><span className="mono t-xs muted">${v.terms.symbol}</span></div>
          <p className="t-xs muted w5" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>{v.terms.meta}</p>
        </div>
        {launched ? (
          <div className="ccard-figs">
            <div><div className="k">Treasury</div><div className="v">{bnb(v.treasury, 1)}</div></div>
            <div><div className="k">Book</div><div className="v mono" style={{ fontSize: 12.5 }}>{price(d.book)}</div></div>
            <div><div className="k">vs book</div><div className={cx("v", d.prem < 0 ? "down" : "up")}>{signedPct(d.prem)}</div></div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="ccard-figs">
              <div><div className="k">Committed</div><div className="v">{bnb(v.raise.committed, 0)}</div></div>
              <div><div className="k">Cap</div><div className="v">{bnb(v.terms.cap, 0)}</div></div>
              <div><div className="k">Wallets</div><div className="v">{v.raise.contributors || "–"}</div></div>
            </div>
            <Meter size="sm" value={v.raise.committed} max={Math.max(v.terms.cap, v.raise.committed)} marks={[v.terms.minRaise]} tone={v.state === "FAILED" ? undefined : v.raise.committed >= v.terms.minRaise ? "good" : undefined} label="Committed against cap" />
          </div>
        )}
        <div className="ccard-foot">
          <span className={cx("row", nx.tone === "warn" && "warn-t", nx.tone === "bad" && "down", nx.tone === "accent" && "accent")} style={{ gap: 6, minWidth: 0 }}><Icon name="clock" size={13} /><span className="trunc">{nx.text}</span></span>
          {launched ? <Sparkline points={v.history.filter((p) => p.t > v.now - 30 * DAY)} width={72} height={22} /> : <IssuerChip v={v} />}
        </div>
      </div>
    </Link>
  );
}
