"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { explorerAddress } from "@/lib/chain/chains";
import { derive, type Derived } from "@/lib/covenant/derive";
import { DAY, HOUR, date, dateTime, days, duration, relative } from "@/lib/covenant/time";
import type { CovenantView, FeedEvent, LedgerKind } from "@/lib/covenant/types";
import { bnb, bps, multiple, pct, price, signedPct, tokens, usd } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { Addr, Fig, Meter, Note, Stat, StateBadge } from "./ui";

/* ---------- Header ---------- */

export function SheetHeader({ v, d }: { v: CovenantView; d: Derived }) {
  const href = (a?: string) => (a ? explorerAddress(v.chainId, a) : null);
  const launched = v.state !== "RAISING" && v.state !== "FAILED";
  return (
    <section className="sky">
      <div className="sky-inner" style={{ display: "grid", gap: 20 }}>
        <div className="row wrap between" style={{ alignItems: "flex-start", gap: 16 }}>
          <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
            <TokenMark symbol={v.terms.symbol} />
            <div style={{ minWidth: 0 }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <h1 className="d2">{v.terms.name}</h1>
                <span className="mono muted">${v.terms.symbol}</span>
                <StateBadge state={v.state} size="lg" />
                <IssuerChip v={v} />
              </div>
              <p className="small muted" style={{ margin: "6px 0 0", maxWidth: 640 }}>{v.terms.meta || "No description."}</p>
            </div>
          </div>
          <PrimaryAction v={v} d={d} />
        </div>
        {launched ? (
          <div className="stats glass" style={{ ["--n" as string]: 5 }}>
            <Stat k="Treasury" v={<Fig src={`vault balance ${v.vault ?? ""}`} href={href(v.vault)}>{bnb(v.treasury)} BNB</Fig>} s={d.bnbUsd ? `${usd(d.treasuryUsd)} at Atlas BNB/USD ${usd(d.bnbUsd, 2)}` : "BNB held by the vault"} />
            <Stat k="Book value per token" v={<Fig src="vault.bookValue() = (balance − owedTeam) / redeemableSupply">{price(d.book)}</Fig>} s={`${pct(d.floorRatioNow, 1)} of the sale price`} />
            <Stat k="Pool price (TWAP)" v={<Fig src="pair cumulative price, last poke" href={href(v.pair)}>{price(v.poolPrice)}</Fig>} s={`${multiple(Math.round((v.poolPrice / Math.max(d.salePrice, 1e-30)) * 100))} the sale price`} />
            <Stat k="Against book" v={<span className={`mono ${d.prem < 0 ? "down" : "up"}`}>{signedPct(d.prem)}</span>} s={d.prem < 0 ? "Trading under treasury value" : "Premium to treasury value"} />
            <Stat k="Redeemable supply" v={<Fig src="totalSupply − dead − lockedTeam">{tokens(d.R)}</Fig>} s={`${tokens(v.lockedTeam)} team tokens locked`} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TokenMark({ symbol, size = 48 }: { symbol: string; size?: number }) {
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: size * 0.28, flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display-stack)", fontWeight: 600, fontSize: size * 0.36, letterSpacing: "-0.03em", background: `linear-gradient(140deg, hsl(${h} 70% 62%), hsl(${(h + 50) % 360} 72% 48%))`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }}>
      {symbol.slice(0, 2)}
    </div>
  );
}

export function IssuerChip({ v }: { v: CovenantView }) {
  return v.issuer.kind === "agent"
    ? <span className="chip chip-agent chip-lg"><Icon name="agent" size={14} />Agent #{v.issuer.agentId}</span>
    : <span className="chip chip-lg"><Icon name="user" size={14} />Human team</span>;
}

function PrimaryAction({ v, d }: { v: CovenantView; d: Derived }) {
  const base = `/app/c/${v.id}`;
  if (v.state === "RAISING") return <Link className="btn btn-primary btn-lg" href={`${base}/raise`}>Commit BNB<Icon name="arrow" size={16} /></Link>;
  if (v.state === "FAILED") return <Link className="btn btn-primary btn-lg" href={`${base}/settle`}>Claim refund<Icon name="arrow" size={16} /></Link>;
  if (v.state === "EXIT_ROUND" || v.state === "WIND_DOWN") return <Link className="btn btn-accent btn-lg" href={`${base}/redeem`}>Redeem at book<Icon name="arrow" size={16} /></Link>;
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <Link className="btn btn-ghost" href={`${base}/redeem`}>Redeem<span className="chip" style={{ height: 20 }}>{d.eta !== null ? `opens in ${duration(d.eta)}` : "closed"}</span></Link>
    </div>
  );
}

export function SheetTabs({ v }: { v: CovenantView }) {
  const path = usePathname();
  const base = `/app/c/${v.id}`;
  const tabs = [
    { href: base, label: "Covenant sheet" },
    { href: `${base}/raise`, label: "Raise" },
    { href: `${base}/settle`, label: "Settle" },
    { href: `${base}/redeem`, label: "Redeem" },
    { href: `${base}/team`, label: v.issuer.kind === "agent" ? "Agent console" : "Team console" },
  ];
  return (
    <nav className="tabs" aria-label="Covenant pages">
      {tabs.map((t) => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>)}
    </nav>
  );
}

/* ---------- The five rule cards ---------- */

export function RuleCards({ v, d }: { v: CovenantView; d: Derived }) {
  const t = v.terms;
  const claimedPlusOwed = v.tap.claimedThisPeriod + v.tap.accrued;
  const hbUsed = Math.max(0, v.now - v.lastHeartbeat);
  const due = d.hbLeft <= 0;
  const inRound = v.state === "EXIT_ROUND";
  const ended = v.state === "WIND_DOWN";
  const cliffLeft = (v.raise.launchedAt ?? v.now) + t.cliff - v.now;
  const who = v.issuer.kind === "agent" ? "agent" : "team";

  return (
    <section className="rules" aria-label="The five rules">
      <article className={`card rule ${v.tap.accrued > 0 && !d.tapPaused ? "lit" : ""}`}>
        <RuleHead n={1} icon="coins" title="Tap" />
        <p className="line">The {who} draws {usd(t.tapUsdPer30d)} per 30 days at the Atlas rate, capped at {bps(t.tapCapBps)} of the treasury. It can only go down.</p>
        <div className="big">{bnb(v.tap.accrued, 2)} <span className="small muted">BNB claimable</span></div>
        <Meter value={claimedPlusOwed} max={Math.max(d.cap30, claimedPlusOwed)} label="Tap used this period against the cap" />
        <p className="tiny muted" style={{ margin: 0 }}><span className="mono">{bnb(claimedPlusOwed)}</span> BNB drawn or owed in 30 days · cap <span className="mono">{bnb(d.cap30)}</span> at today&apos;s treasury · {d.budget.binding === "cap" ? "cap binds" : "dollar budget binds"}</p>
        <p className="next">{ended ? "Ended at wind-down." : inRound ? "Paused during the exit round." : d.tapPaused ? "Starts at launch." : `${bnb(v.tap.accrued)} BNB claimable now.`}</p>
      </article>

      <article className="card rule">
        <RuleHead n={2} icon="unlock" title="Performance unlock" />
        <p className="line">Team tokens unlock only after the dollar price holds each multiple for {Math.round(t.unlockWindow / DAY)} trusted days, after a {Math.round(t.cliff / DAY)}-day cliff.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {v.tranches.map((tr) => (
            <div key={tr.multiple} style={{ display: "grid", gap: 4 }}>
              <div className="row between tiny"><span className="ink">{multiple(tr.multiple)} · {bps(tr.bps)}</span><span className="mono muted">{tr.unlocked ? "unlocked" : `${days(tr.progress)} of ${Math.round(t.unlockWindow / DAY)}d`}</span></div>
              <Meter small value={tr.unlocked ? 1 : tr.progress} max={tr.unlocked ? 1 : t.unlockWindow} tone={tr.unlocked ? "good" : "agent"} label={`${multiple(tr.multiple)} tranche`} />
            </div>
          ))}
        </div>
        <p className="next">{ended ? "Locked tranches were burned at wind-down." : cliffLeft > 0 ? `Cliff ends ${date((v.raise.launchedAt ?? v.now) + t.cliff)}. ${bestRunLine(v)}` : bestRunLine(v) || "Counting on the strict gate."}</p>
      </article>

      <article className={`card rule ${v.state === "ACTIVE" && v.exit.streak > 0 ? "alarm" : inRound ? "alarm" : ""}`}>
        <RuleHead n={3} icon="exit" title="Book-value exit" />
        <p className="line">If the pool trades under book for {Math.round(t.exitStreak / DAY)} days, a {Math.round(t.roundLength / DAY)}-day round opens and any holder can redeem at book.</p>
        {inRound ? (
          <div className="big">Open <span className="small muted">ends {relative(v.exit.roundEndsAt!, v.now)}</span></div>
        ) : (
          <div className="big">{duration(v.exit.streak)} <span className="small muted">of {Math.round(t.exitStreak / DAY)}d under book</span></div>
        )}
        <Meter value={inRound ? 1 : v.exit.streak} max={inRound ? 1 : t.exitStreak} tone="warn" label="Exit streak" />
        <div className="row wrap" style={{ gap: 4 }}>
          <span className="fix" title="Fix 1: the streak decays instead of resetting"><Icon name="check" size={11} />Decays, never resets</span>
          <span className="fix" title="Fixes 2 and 3: pool TWAP against book, both read on-chain; no depth gate, no Atlas"><Icon name="check" size={11} />On-chain only</span>
        </div>
        <p className="next">{exitNext(v, d)}</p>
      </article>

      <article className={`card rule ${due && !ended ? "alarm" : ""}`}>
        <RuleHead n={4} icon="heart" title="Abandonment switch" />
        <p className="line">If the {who} stops for {Math.round(t.heartbeat / DAY)} days, anyone can open the treasury to holders for good.</p>
        <div className="big">{ended ? "Switched" : relative(v.lastHeartbeat, v.now).replace(" ago", "")} <span className="small muted">{ended ? "" : "since last heartbeat"}</span></div>
        <Meter value={ended ? t.heartbeat : hbUsed} max={t.heartbeat} tone={due || ended ? "bad" : undefined} label="Days since last heartbeat" />
        <p className="tiny muted" style={{ margin: 0 }}><span className="mono">{days(hbUsed)}</span> of <span className="mono">{Math.round(t.heartbeat / DAY)}</span> days{v.issuer.lastAction ? ` · ${v.issuer.lastAction.what}` : ""}</p>
        <p className="next">{ended ? "Wound down. Redemption is open with no fee and no deadline." : due ? "Due now: anyone can declare it abandoned." : `Anyone can flip it in ${duration(d.hbLeft)} if the ${who} stops.`}</p>
      </article>

      <article className="card rule">
        <RuleHead n={5} icon="doc" title="Disclosure" stretch />
        <p className="line">A report each 30 days. A missed or failed report pauses the tap until a passing one lands.</p>
        <div className="big">{v.disclosure.passed} <span className="small muted">of {Math.max(v.disclosure.due, v.disclosure.passed)} reports</span></div>
        <Meter value={v.disclosure.passed} max={Math.max(1, v.disclosure.due, v.disclosure.passed)} tone="good" label="Reports passed against due" />
        <p className="tiny muted" style={{ margin: 0, overflowWrap: "anywhere" }}>{v.disclosure.lastUri ? <>Last: <span className="mono">{v.disclosure.lastUri}</span></> : "No report yet"}</p>
        <p className="next">{ended ? "No reports after wind-down." : v.disclosure.nextDueAt ? `Next report due ${relative(v.disclosure.nextDueAt, v.now)}.` : "First report due 30 days after launch."}</p>
      </article>
    </section>
  );
}

function bestRunLine(v: CovenantView) {
  const best = Math.max(0, ...v.tranches.map((t) => (t.unlocked ? 0 : t.bestRun ?? 0)));
  return best > 0 ? `Longest run so far: ${days(best)} days at 2x; a strict reading below resets it.` : "";
}

function exitNext(v: CovenantView, d: Derived) {
  if (v.state === "RAISING" || v.state === "FAILED") return "Arms at launch.";
  if (v.state === "WIND_DOWN") return "Redemption open forever, no fee.";
  if (v.state === "EXIT_ROUND") return `Redeem at ${price(d.book)} BNB per token, ${bps(v.terms.exitFeeBps)} fee kept by the treasury.`;
  if (v.state === "COOLDOWN") return `Cooldown: re-arms ${relative(v.exit.cooldownEndsAt!, v.now)}.`;
  if (d.eta !== null) return `Opens in ${duration(d.eta)} at this price.`;
  return v.exit.streak > 0 ? `Price is above book: the streak decays ${duration(HOUR)} per hour.` : "Price is above book. Nothing counting.";
}

function RuleHead({ n, icon, title, stretch }: { n: number; icon: IconName; title: string; stretch?: boolean }) {
  return (
    <div className="row between">
      <div className="row" style={{ gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--surface)", color: "var(--ink-2)" }}><Icon name={icon} size={16} /></span>
        <h4>{title}</h4>
      </div>
      <span className="num-tag">{stretch ? "stretch · " : ""}0{n}</span>
    </div>
  );
}

/* ---------- Treasury ledger ---------- */

const KIND: Record<LedgerKind, { label: string; tone: string; icon: IconName }> = {
  raise: { label: "Raised", tone: "chip-accent", icon: "coins" },
  tax: { label: "Tax in", tone: "chip-good", icon: "pulse" },
  revenue: { label: "Revenue in", tone: "chip-agent", icon: "bolt" },
  tap: { label: "Tap out", tone: "chip-warn", icon: "wallet" },
  redeem: { label: "Redeemed out", tone: "chip-bad", icon: "redeem" },
};

export function TreasuryLedger({ v, d }: { v: CovenantView; d: Derived }) {
  const rows = [...v.ledger].sort((a, b) => b.at - a.at).slice(0, 8);
  const sum = d.sums.raise + d.sums.tax + d.sums.revenue + d.sums.tap + d.sums.redeem;
  const agent = v.issuer.kind === "agent";
  return (
    <div className="card">
      <div className="card-head"><h3 className="d4">Treasury ledger</h3><span className="tiny muted">Every BNB in and out of the vault</span></div>
      <div className="card-body" style={{ paddingBottom: 8 }}>
        <dl className="kv">
          <dt>Raised (treasury share)</dt><dd>{bnb(d.sums.raise)}</dd>
          <dt>Trading tax in</dt><dd className="up">+{bnb(d.sums.tax)}</dd>
          <dt>{agent ? "Agent revenue in" : "Issuer revenue in"}</dt><dd style={{ color: "var(--agent)" }}>+{bnb(d.sums.revenue)}</dd>
          <dt>Tap out</dt><dd>{bnb(d.sums.tap)}</dd>
          <dt>Redeemed out</dt><dd>{bnb(d.sums.redeem)}</dd>
          <dt className="total ink" style={{ fontWeight: 550 }}>Treasury now</dt><dd className="total" style={{ fontWeight: 600 }}>{bnb(sum)} BNB</dd>
        </dl>
        {Math.abs(sum - v.treasury) > 0.005 ? <p className="tiny" style={{ color: "var(--warn)", marginTop: 8 }}>Ledger and vault balance differ by {bnb(v.treasury - sum, 4)} BNB (forced sends count as revenue on the next sync).</p> : null}
        {d.sums.revenue > 0 ? <p className="tiny muted" style={{ margin: "10px 0 0" }}>{agent ? "The agent routes what it earns to the vault, so revenue raises book value for every holder." : "Revenue sent to the vault raises book value for every holder."}</p> : null}
      </div>
      <div className="hr" />
      {rows.length === 0 ? <p className="small muted" style={{ padding: 20, margin: 0 }}>No treasury movements yet.</p> : rows.map((r, i) => (
        <div key={i} className="ledger-row">
          <span className="when tiny muted">{date(r.at)}</span>
          <span className="row" style={{ gap: 8, minWidth: 0 }}>
            <span className={`chip ${KIND[r.kind].tone}`}>{KIND[r.kind].label}</span>
            <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.note}>{r.note}</span>
          </span>
          <span style={{ textAlign: "right" }}>
            <span className={`mono small ${r.amount >= 0 ? "ink" : "muted"}`}>{r.amount >= 0 ? "+" : "−"}{bnb(Math.abs(r.amount), 3)}</span>
            {r.tx ? <span style={{ display: "block" }}><Addr a={r.tx} chainId={v.source === "live" ? v.chainId : undefined} kind="tx" copy={false} /></span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Trust panel ---------- */

export function TrustPanel({ v }: { v: CovenantView }) {
  const g = v.trust;
  return (
    <div className="card">
      <div className="card-head"><h3 className="d4">Trust panel</h3><span className="tiny muted">{g.lastPoke ? `Last poke ${relative(g.lastPoke, v.now)}` : "No poke yet"}</span></div>
      <div className="card-body stack">
        <div className="grid2" style={{ gap: 12 }}>
          <Gate title="Exit gate" sub="Protects holders. Counts the exit streak." checks={g.exitGate} tone="good" />
          <Gate title="Strict gate" sub="Pays the team. Counts unlocks and prices the tap." checks={g.strictGate} />
        </div>
        <dl className="kv">
          <dt>Atlas BNB/USD</dt><dd>{g.bnbUsd ? usd(g.bnbUsd, 2) : "–"}</dd>
          <dt>Atlas report age at last poke</dt><dd>{g.atlasReportAge === null ? "–" : g.atlasReportAge <= 180 ? `${g.atlasReportAge} s` : duration(g.atlasReportAge)}</dd>
          <dt>Pool-only fallback</dt><dd>{g.poolOnlyMode ? "On" : "Off"}</dd>
        </dl>
        <Note icon="shield">
          <b>What you are trusting.</b> Flap&apos;s Guardian can upgrade the vault (the only upgrade path). Atlas is trusted for BNB/USD: a wrong rate misprices the tap and unlocks, but it cannot open or block an exit, because book value and pool price are both read on-chain. The PancakeSwap pair is the price, with liquidity locked at launch. No Covenant admin keys: no owner, no pause, no fee switch.
        </Note>
        <Note icon="alert" tone="warn">
          <b>What it does not cover.</b> The floor starts below the sale price and falls as the {v.issuer.kind === "agent" ? "agent" : "team"} spends. The treasury is BNB, so its dollar value moves. Nothing off-chain (company, IP, revenue not sent to the vault) is protected.
        </Note>
      </div>
    </div>
  );
}

function Gate({ title, sub, checks, tone }: { title: string; sub: string; checks: CovenantView["trust"]["exitGate"]; tone?: "good" }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, background: tone === "good" ? "var(--good-bg)" : "var(--canvas)" }}>
      <div className="d4" style={{ fontSize: 14 }}>{title}</div>
      <p className="tiny muted" style={{ margin: "2px 0 10px" }}>{sub}</p>
      <div style={{ display: "grid", gap: 8 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: "grid", gridTemplateColumns: "16px minmax(0,1fr)", gap: 8 }}>
            <Icon name={c.pass === null ? "info" : c.pass ? "check" : "x"} size={15} style={{ color: c.pass === null ? "var(--faint)" : c.pass ? "var(--good)" : "var(--bad)", marginTop: 1 }} />
            <div><div className="tiny ink">{c.label}</div><div className="tiny muted">{c.detail}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Issuer badge ---------- */

const OUTCOME_TONE: Record<string, string> = { active: "chip-good", unlocked: "chip-accent", "wound-down": "", abandoned: "chip-bad", failed: "" };

export function IssuerBadge({ v }: { v: CovenantView }) {
  const i = v.issuer;
  const agent = i.kind === "agent";
  return (
    <div className="card">
      <div className="card-head"><h3 className="d4">Issuer</h3><span className={`chip ${agent ? "chip-agent" : ""}`}>{agent ? "ERC-8004 agent" : "Human team"}</span></div>
      <div className="card-body stack">
        <div className="issuer">
          <div className={`issuer-avatar ${agent ? "" : "human"}`}>{agent ? <Icon name="agent" size={22} /> : <Icon name="user" size={22} />}</div>
          <div style={{ minWidth: 0 }}>
            <div className="d4">{i.name ?? (agent ? `Agent #${i.agentId}` : "Team")}</div>
            <div className="tiny muted">Team wallet <Addr a={i.teamWallet} chainId={v.source === "live" ? v.chainId : undefined} /></div>
          </div>
        </div>
        {agent ? (
          <dl className="kv">
            <dt>Agent id</dt><dd>#{i.agentId}</dd>
            <dt>Identity registry</dt><dd><Addr a={i.registry} chainId={97} copy={false} /></dd>
            <dt>Registration file</dt><dd style={{ fontSize: 12 }}>{i.registrationUri ? <span title={i.registrationUri}>{i.registrationUri.replace(/^https?:\/\//, "").slice(0, 34)}{i.registrationUri.length > 42 ? "…" : ""}</span> : "–"}</dd>
            {i.services?.length ? <><dt>Services</dt><dd style={{ fontSize: 12 }}>{i.services.map((s) => s.name).join(", ")}</dd></> : null}
            {i.supportedTrust?.length ? <><dt>Supported trust</dt><dd style={{ fontSize: 12 }}>{i.supportedTrust.join(", ")}</dd></> : null}
            {i.lastAction ? <><dt>Last action</dt><dd style={{ fontSize: 12 }}>{i.lastAction.what}, {relative(i.lastAction.at, v.now)}</dd></> : null}
          </dl>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>No agent identity. The rules bind the team wallet the same way; outcomes are not written to an ERC-8004 record.</p>
        )}
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>{agent ? "Outcomes of its covenants" : "Covenant history"}</div>
          {i.outcomes.length === 0 ? <p className="tiny muted" style={{ margin: 0 }}>No history yet. A fresh identity carries no record; reputation helps from the second covenant.</p> : i.outcomes.map((o, k) => (
            <div key={k} className="outcome">
              <span className={`chip ${OUTCOME_TONE[o.outcome] ?? ""}`}>{o.outcome}</span>
              <span className="mono ink">{o.covenant}</span>
              <span className="muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.detail}</span>
              <span className="tiny faint" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{date(o.at)}</span>
            </div>
          ))}
        </div>
        {agent ? <p className="tiny muted" style={{ margin: 0 }}>The vault writes abandonment, wind-down and unlocks to the agent&apos;s ERC-8004 reputation record. Only feedback from vaults this factory created counts here.</p> : null}
      </div>
    </div>
  );
}

/* ---------- Event feed ---------- */

const EVT_TONE: Record<string, string> = {
  ExitRoundOpened: "warn", ExitRoundClosed: "", Redeemed: "warn", TapClaimed: "accent", TapLowered: "good", WoundDown: "bad", OutcomeRecorded: "agent",
  RevenueRecognized: "good", Heartbeat: "", ReportPosted: "good", Observed: "accent", TreasuryFunded: "accent", Finalized: "accent", TrancheUnlocked: "agent", Contributed: "accent",
};

export function EventFeed({ v, limit = 12 }: { v: CovenantView; limit?: number }) {
  const shown: FeedEvent[] = [];
  let beats = 0;
  for (const e of v.events) {
    if (e.name === "Heartbeat" && ++beats > 2) continue;
    shown.push(e);
    if (shown.length >= limit) break;
  }
  return (
    <div className="card">
      <div className="card-head"><h3 className="d4">Event feed</h3><span className="tiny muted">{v.source === "live" ? "From contract logs" : "Demo events"}</span></div>
      <div className="feed" style={{ padding: "8px 0" }}>
        {shown.length === 0 ? <p className="small muted" style={{ padding: "8px 20px", margin: 0 }}>No events yet.</p> : shown.map((e, i) => (
          <div key={i} className="feed-item">
            <span className={`pip ${EVT_TONE[e.name] ?? ""}`} />
            <div style={{ minWidth: 0 }}>
              <div className="row between" style={{ gap: 8 }}><span className="ev">{e.name}</span><span className="tiny faint" style={{ whiteSpace: "nowrap" }} title={dateTime(e.at)}>{relative(e.at, v.now)}</span></div>
              <div className="det">{e.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Terms ---------- */

export function TermsCard({ v, d }: { v: CovenantView; d: Derived }) {
  const t = v.terms;
  return (
    <div className="card">
      <div className="card-head"><h3 className="d4">Terms</h3><span className="tiny muted">Fixed at creation. Only the tap can go down.</span></div>
      <div className="card-body">
        <dl className="kv">
          <dt>Supply</dt><dd>{tokens(t.totalSupply)}</dd>
          <dt>Sale / pool / team</dt><dd>{bps(t.saleBps)} / {bps(t.poolBps)} / {bps(d.teamBps)}</dd>
          <dt>Minimum and cap</dt><dd>{bnb(t.minRaise, 0)} / {bnb(t.cap, 0)} BNB</dd>
          <dt>Sale price</dt><dd>{price(d.salePrice)} BNB</dd>
          <dt>Starting floor</dt><dd>{pct(d.startRatio, 0)} of sale price</dd>
          <dt>Trading tax</dt><dd>{bps(t.buyTaxBps)} buy, {bps(t.sellTaxBps)} sell</dd>
          <dt>Tap</dt><dd>{usd(t.tapUsdPer30d)} / 30d, cap {bps(t.tapCapBps)}</dd>
          <dt>Unlock tranches</dt><dd>{t.trancheMultiple.map((m, k) => `${bps(t.trancheBps[k] ?? 0)} at ${multiple(m)}`).join(", ")}</dd>
          <dt>Exit</dt><dd>{days(t.exitStreak, 0)}d streak, {days(t.roundLength, 0)}d round, {days(t.cooldown, 0)}d cooldown, {bps(t.exitFeeBps)} fee</dd>
          <dt>Heartbeat</dt><dd>{days(t.heartbeat, 0)} days</dd>
          <dt>Contracts</dt><dd style={{ display: "grid", gap: 4, justifyItems: "end" }}>
            <span className="row" style={{ gap: 6 }}><span className="tiny muted">launcher</span><Addr a={v.launcher} chainId={v.source === "live" ? v.chainId : undefined} /></span>
            {v.vault ? <span className="row" style={{ gap: 6 }}><span className="tiny muted">vault</span><Addr a={v.vault} chainId={v.source === "live" ? v.chainId : undefined} /></span> : null}
            {v.token ? <span className="row" style={{ gap: 6 }}><span className="tiny muted">token</span><Addr a={v.token} chainId={v.source === "live" ? v.chainId : undefined} /></span> : null}
          </dd>
        </dl>
      </div>
    </div>
  );
}

export { derive };
