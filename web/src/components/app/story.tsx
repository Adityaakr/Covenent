"use client";

/*
 * The covenant told as pictures, numbers first: where the money goes (money map), how the raise closed, the unlock
 * ladder since the raise, who holds the supply, the treasury's health at the tap limit, and an interactive unlock
 * curve. Every figure is read from the chain (CovenantView) and run through the doc's formulas; nothing is sampled.
 */
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Derived } from "@/lib/covenant/derive";
import { amt, halvingMonths, launchAt, moneyFlow, runway, supplyShares, todayMultiple, unlocksAt, usdAmt, type Flow } from "@/lib/covenant/story";
import { date, duration, span } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { useActions } from "@/lib/data/actions";
import { bps, multiple, pct, price, short, tokens } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { Segmented, cx } from "./ui";

const who = (v: CovenantView) => (v.issuer.kind === "agent" ? "agent" : "team");
const launchedOf = (v: CovenantView) => v.state !== "RAISING" && v.state !== "FAILED";

/** A section block: a short title with an underline accent, one plain line, then the picture. */
export function Story({ id, title, sub, right, children }: { id?: string; title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="story" id={id} aria-label={title}>
      <header className="story-head">
        <div style={{ minWidth: 0 }}><h2 className="story-t">{title}</h2>{sub ? <p className="story-sub">{sub}</p> : null}</div>
        {right ? <div className="story-right">{right}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** A number with its one plain-language line underneath. */
export function Stat({ k, v, s, tone, size }: { k: ReactNode; v: ReactNode; s?: ReactNode; tone?: "good" | "warn" | "bad" | "accent" | "agent"; size?: "lg" | "xl" }) {
  return (
    <div className={cx("stat", size)}>
      <span className="stat-k">{k}</span>
      <span className={cx("stat-v", tone && `t-${tone}`)}>{v}</span>
      {s ? <span className="stat-s">{s}</span> : null}
    </div>
  );
}

/** A tiny per-token price with its run of zeros folded: 0.0₈530 reads faster than 0.00000000530. */
export function Tiny({ n }: { n: number }) {
  if (!Number.isFinite(n) || n <= 0) return <span className="mono">0</span>;
  if (n >= 0.0001) return <span className="mono">{price(n)}</span>;
  const zeros = Math.ceil(-Math.log10(n)) - 1; // zeros between the point and the first digit
  const digits = Math.round(n * Math.pow(10, zeros + 3)).toString().replace(/0+$/, "") || "0";
  return <span className="mono tiny" title={`${price(n)} BNB`}>0.0<sub>{zeros}</sub>{digits}</span>;
}

/* ---------- Money map ---------- */

type Scenario = "now" | "met" | "missed" | "settled" | "today";

export function MoneyMap({ v, d }: { v: CovenantView; d: Derived }) {
  const raising = v.state === "RAISING";
  const failed = v.state === "FAILED";
  const [tab, setTab] = useState<Scenario>(raising ? "now" : "settled");
  const t = v.terms;
  const opts: { value: Scenario; label: string }[] = raising
    ? [{ value: "now", label: "Right now" }, { value: "met", label: "If the minimum is met" }, { value: "missed", label: "If the minimum is missed" }]
    : failed ? [{ value: "settled", label: "How it ended" }]
    : [{ value: "settled", label: "At launch" }, { value: "today", label: "Today" }];
  const lead = raising
    ? <>The minimum is <b className="num">{amt(t.minRaise)} BNB</b> and the cap <b className="num">{amt(t.cap)} BNB</b>. At close the launcher accepts an amount in that range, or everything goes back.</>
    : failed ? <>The raise closed under its <b className="num">{amt(t.minRaise)} BNB</b> minimum. Nothing launched; every backer claims their own back.</>
    : tab === "today" ? <>What has moved through the vault since launch, read from its events and balance.</>
    : <>One transaction settled the raise: the pool and the vault were funded at the sale price and the excess went back.</>;
  return (
    <Story id="money-map" title="Money map" sub={raising ? "Every BNB, from a backer's wallet to the treasury, and both ways this can end." : "Every BNB, from a backer's wallet to the treasury and the pool."}
      right={opts.length > 1 ? <Segmented size="sm" label="Scenario" value={tab} onChange={setTab} options={opts} /> : null}>
      <p className="story-lead">{lead}</p>
      {tab === "today" ? <TreasuryFlow v={v} d={d} /> : <FlowMap v={v} flow={moneyFlow(v, tab)} scenario={tab} />}
      <div className="mm-key" aria-hidden><span><i className="solid" />moved</span><span><i className="dash" />would move</span></div>
    </Story>
  );
}

function rangeText(lo: number, hi?: number) {
  if (hi === undefined || Math.abs(hi - lo) < 1e-12) return `${amt(lo)} BNB`;
  return `${amt(lo)}–${amt(hi)} BNB`;
}

function FlowMap({ v, flow, scenario }: { v: CovenantView; flow: Flow; scenario: Scenario }) {
  const w = who(v);
  const raising = v.state === "RAISING";
  const dashed = flow.conditional;
  const target = (k: Flow["to"][number]): { icon: IconName; title: string; tone: string; line: string } => {
    if (k.key === "treasury") return { icon: "vault", title: "Vault treasury", tone: "agent", line: raising ? `if the minimum is met: the ${w}'s only access is the tap, ${bps(v.terms.tapCapBps)} of the treasury a month at most` : `backs every token at book value; the ${w} draws only the capped tap` };
    if (k.key === "pool") return { icon: "swap", title: "Trading liquidity", tone: "good", line: `${k.tokens ? `${tokens(k.tokens)} ${v.terms.symbol} + ` : ""}BNB seeds the PancakeSwap pool at the sale price, LP locked` };
    return { icon: "redeem", title: "Back to backers", tone: "", line: scenario === "missed" || v.state === "FAILED" ? "below the minimum every backer claims their own, all of it" : raising ? "anything above the cap goes back pro rata; each backer claims it" : "the excess above the cap, pro rata; each backer claims it" };
  };
  const hidden = scenario === "missed" ? ["treasury", "pool"] : [];
  const targets = flow.to.filter((x) => !hidden.includes(x.key));
  return (
    <div className={cx("mm", dashed && "is-cond")}>
      <div className="mm-node src">
        <span className="mm-k"><Icon name="users" size={14} />{v.raise.contributors || 0} backer{v.raise.contributors === 1 ? "" : "s"}</span>
        <b className="mm-v num">{amt(flow.committed)} BNB</b>
        <span className="mm-s">committed {raising ? "so far" : "in the raise"}</span>
      </div>
      <div className="mm-edge"><span className={cx("mm-line", !raising && "solid")} /><span className="mm-chip">{raising ? "Held" : "Settled"}</span></div>
      <div className={cx("mm-node mid", raising && "live")}>
        <span className="mm-k"><Icon name="lock" size={14} />Launcher escrow</span>
        <b className="mm-v num">{amt(flow.held)} BNB</b>
        <span className="mm-s">{raising ? `neither the ${w} nor Covenant can touch it` : "empty: one finalize paid it all out"}</span>
      </div>
      <div className="mm-fork" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {targets.map((x, i) => {
            const y = ((i + 0.5) / targets.length) * 100;
            return <path key={x.key} d={`M0 50 C 55 50, 45 ${y}, 100 ${y}`} className={cx(dashed ? "dash" : "solid", x.bnb <= 0 && x.hi === undefined && "dim")} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
      </div>
      <div className="mm-targets" style={{ gridTemplateRows: `repeat(${targets.length}, minmax(0, 1fr))` }}>
        {targets.map((x) => {
          const m = target(x);
          const zero = x.bnb <= 0 && (x.hi === undefined || x.hi <= 0);
          return (
            <div key={x.key} className={cx("mm-node tgt", m.tone, zero && "zero")}>
              <span className="mm-k"><Icon name={m.icon} size={14} />{m.title}</span>
              <b className="mm-v num">{rangeText(x.bnb, x.hi)}</b>
              <span className="mm-s">{m.line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** After launch: everything that came into the vault on the left, where it went on the right. */
function TreasuryFlow({ v, d }: { v: CovenantView; d: Derived }) {
  const s = d.sums;
  const ins = [
    { k: "Raise, treasury share", n: s.raise, icon: "coins" as IconName },
    { k: "Trading tax", n: s.tax, icon: "swap" as IconName },
    { k: v.issuer.kind === "agent" ? "Agent revenue" : "Issuer revenue", n: s.revenue, icon: "bolt" as IconName },
  ];
  const outs = [
    { k: `Tap paid to the ${who(v)} wallet`, n: -s.tap, icon: "wallet" as IconName, tone: "warn" },
    { k: "Redeemed by holders", n: -s.redeem, icon: "redeem" as IconName, tone: "" },
    { k: "Still in the vault", n: v.treasury, icon: "vault" as IconName, tone: "agent" },
  ];
  const total = Math.max(1e-18, ins.reduce((a, x) => a + Math.max(0, x.n), 0));
  if (v.ledger.length === 0) {
    return <p className="t-s muted w5">The vault holds <b className="num ink">{amt(v.treasury)} BNB</b>. Its sources appear once the ledger reads them from contract logs.</p>;
  }
  return (
    <div className="tf">
      <div className="tf-col">
        {ins.map((x) => (
          <div key={x.k} className={cx("tf-row", x.n <= 0 && "zero")}>
            <span className="tf-ic"><Icon name={x.icon} size={14} /></span><span className="tf-k">{x.k}</span><b className="num">+{amt(x.n)}</b>
            <span className="tf-bar"><i style={{ width: `${Math.max(0, x.n / total) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <div className="tf-mid" aria-hidden><span className="tf-vault"><Icon name="vault" size={18} /></span><span className="t-xs muted w5">vault</span></div>
      <div className="tf-col">
        {outs.map((x) => (
          <div key={x.k} className={cx("tf-row", x.tone, x.n <= 0 && "zero")}>
            <span className="tf-ic"><Icon name={x.icon} size={14} /></span><span className="tf-k">{x.k}</span><b className="num">{amt(x.n)}</b>
            <span className="tf-bar"><i style={{ width: `${Math.max(0, x.n / total) * 100}%` }} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Raise history ---------- */

export function RaiseClosed({ v, d }: { v: CovenantView; d: Derived }) {
  const r = d.raise;
  const C = v.raise.committed;
  const failed = v.state === "FAILED" || r.failed;
  const usdSale = v.usdSalePrice ?? null;
  const val = d.salePrice * v.terms.totalSupply;
  const acc = C > 0 ? r.Q / C : 0;
  return (
    <div className="rc">
      <div className="rc-main">
        <h3 className="story-h3">How the raise closed</h3>
        <div className="stackbar lg" role="img" aria-label={failed ? "Everything went back" : `Accepted ${pct(acc, 1)}, went back ${pct(1 - acc, 1)}`}>
          {failed ? <i style={{ flexGrow: 1, background: "var(--line-strong)" }} /> : <>
            <i style={{ flexGrow: (r.Q / Math.max(C, 1e-18)) * 1000, background: "var(--accent)" }} />
            {r.refunded > 0 ? <i style={{ flexGrow: (r.refunded / Math.max(C, 1e-18)) * 1000, background: "var(--line-strong)" }} /> : null}
          </>}
        </div>
        <div className="legend-inline">
          {failed ? <span><i style={{ background: "var(--line-strong)" }} />Went back <b>100%</b> · {amt(C)} BNB</span> : <>
            <span><i style={{ background: "var(--accent)" }} />Accepted <b>{pct(acc, 1)}</b> · {amt(r.Q)} BNB</span>
            <span><i style={{ background: "var(--line-strong)" }} />Went back <b>{pct(1 - acc, 1)}</b> · {amt(r.refunded)} BNB</span>
          </>}
        </div>
        <p className="story-lead" style={{ marginTop: 14 }}>
          {failed ? <>Backers committed <b className="num">{amt(C)} BNB</b> against a <b className="num">{amt(v.terms.minRaise)} BNB</b> minimum. It was missed, so nothing launched and every commitment refunds in full.</>
            : <>Backers committed <b className="num">{amt(C)} BNB</b> against a <b className="num">{amt(v.terms.minRaise)} BNB</b> minimum and a <b className="num">{amt(v.terms.cap)} BNB</b> cap. <b className="num">{amt(r.Q)} BNB</b> was accepted: <span className="num">{amt(r.T0)}</span> to the vault and <span className="num">{amt(r.qPool)}</span> to trading liquidity.{r.refunded > 0 ? <> <span className="num">{amt(r.refunded)} BNB</span> went back: backers committed <span className="num">{r.oversubscription.toFixed(2)}×</span> the cap.</> : null}</>}
        </p>
      </div>
      {!failed ? (
        <div className="rc-side">
          <Stat k="Sale price" v={<><Tiny n={d.salePrice} /> <small>BNB</small></>} s={<>{usdSale ? <>{usdAmt(usdSale)} at launch · </> : null}what every backer paid</>} />
          <Stat k="Valuation at the raise" v={<span className="num">{amt(val)} <small>BNB</small></span>} s={<>{usdSale ? <>{usdAmt(usdSale * v.terms.totalSupply)} · </> : null}the sale price times every token</>} />
          <Stat k="Floor at launch" v={<span className="num">{pct(d.startRatio, 0)}</span>} s="of the sale price, backed by treasury BNB" />
        </div>
      ) : null}
    </div>
  );
}

/** "Since the raise": the unlock ladder, highest multiple on top, with today's price slotted where it stands. */
export function UnlockLadder({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const t = v.terms;
  const launched = launchedOf(v);
  const sale = d.salePrice;
  const usdSale = v.usdSalePrice ?? null;
  const today = todayMultiple(v, sale, d.bnbUsd);
  const la = launchAt(v);
  const cliffEnd = la !== null ? la + t.cliff : null;
  const ended = v.state === "WIND_DOWN";
  const rows = v.tranches.map((tr, k) => ({ ...tr, k, amount: (t.totalSupply * tr.bps) / 10_000 })).sort((a, b) => b.multiple - a.multiple);
  const todayM = today.usd ?? today.bnb;
  const items: ReactNode[] = [];
  let placed = false;
  const todayRow = (
    <li key="today" className="lad-row today">
      <span className="lad-m">{todayM >= 10 ? todayM.toFixed(0) : todayM.toFixed(2)}x</span>
      <span className="lad-dot" />
      <span className="lad-p"><span><b>Today</b> <Tiny n={v.poolPrice} /> BNB</span>{d.bnbUsd > 0 ? <small>{usdAmt(v.poolPrice * d.bnbUsd)}</small> : null}</span>
      <span className="lad-a">{todayM < 1 ? "under the sale price" : "above the sale price"}</span>
    </li>
  );
  for (const r of rows) {
    if (!placed && launched && todayM * 100 >= r.multiple) { items.push(todayRow); placed = true; }
    const status = r.unlocked ? "Unlocked" : ended ? "Burned" : cliffEnd !== null && v.now < cliffEnd ? "Cliff" : r.progress > 0 ? "Counting" : "Locked";
    items.push(
      <li key={r.k} className={cx("lad-row", r.unlocked && "done", ended && !r.unlocked && "burned")}>
        <span className="lad-m">{multiple(r.multiple)}</span>
        <span className="lad-dot" />
        <span className="lad-p"><span><Tiny n={(sale * r.multiple) / 100} /> BNB</span>{usdSale ? <small>{usdAmt((usdSale * r.multiple) / 100)}</small> : null}</span>
        <span className="lad-a"><span className="num">{tokens(r.amount)} {t.symbol}</span> · {bps(r.bps)}</span>
        <span className={cx("tag", status === "Unlocked" ? "good" : status === "Counting" ? "agent" : status === "Burned" ? "bad" : "")}>{status}{status === "Counting" ? <>&nbsp;<span className="num">{duration(r.progress)} / {duration(t.unlockWindow)}</span></> : null}</span>
      </li>,
    );
  }
  if (launched && !placed) items.push(todayRow);
  items.push(
    <li key="sale" className="lad-row base">
      <span className="lad-m">1x</span><span className="lad-dot" />
      <span className="lad-p"><span><Tiny n={sale} /> BNB</span>{usdSale ? <small>{usdAmt(usdSale)}</small> : null}</span>
      <span className="lad-a">Sale price</span>
    </li>,
  );
  const next = rows.filter((r) => !r.unlocked).sort((a, b) => a.multiple - b.multiple)[0];
  const releasable = v.tranches.some((x) => x.unlocked);
  return (
    <div className="lad-wrap">
      <div className="row between wrap-ok" style={{ gap: 10 }}>
        <div><h3 className="story-h3">Since the raise</h3><p className="story-sub">{ended ? "Wound down: tranches still locked were burned." : cliffEnd !== null ? `Team tokens locked until at least ${date(cliffEnd)}` : `Team tokens locked${t.cliff ? ` for a ${span(t.cliff)} cliff` : ""}, then unlock in steps`}</p></div>
        {launched && !ended ? <button className="btn btn-secondary btn-sm" disabled={!releasable} onClick={() => void run("releaseTeam")}>Release unlocked</button> : null}
      </div>
      <ol className="lad">{items}</ol>
      <p className="story-foot">
        {ended ? <>No tranche can unlock any more. The redeemable supply excludes nothing but burned tokens.</>
          : next ? <>Next: <b className="num">{tokens(next.amount)} {t.symbol}</b> at <b>{multiple(next.multiple)}</b>{usdSale ? <> ({usdAmt((usdSale * next.multiple) / 100)})</> : null}{cliffEnd !== null && v.now < cliffEnd ? <>, not before {date(cliffEnd)}</> : null}, and only once the price holds there for {span(t.unlockWindow)}, in dollars and in the pool&apos;s own BNB price.</>
          : <>Every tranche has unlocked.</>}
      </p>
    </div>
  );
}

export function SupplyBar({ v }: { v: CovenantView }) {
  const s = supplyShares(v);
  const launched = launchedOf(v);
  const S = Math.max(1e-18, s.total);
  const sym = v.terms.symbol;
  const seg = (n: number, c: string, label: string, extra?: string) => n > 0 ? <i key={label} title={`${label}: ${tokens(n)} ${sym}`} className={extra} style={{ flexGrow: (n / S) * 1000, background: c }} /> : null;
  return (
    <div className="sup">
      <h3 className="story-h3">Who holds the supply</h3>
      <p className="story-lead"><b className="num">{tokens(s.sale)}</b> of <b className="num">{tokens(s.total)}</b> {sym} went to backers, <b className="num">{tokens(s.pool)}</b> to trading liquidity. <b className="num">{tokens(s.team)}</b> are the {who(v)}&apos;s, {launched ? (s.locked > 0 ? <>with <span className="num">{tokens(s.locked)}</span> still locked</> : v.state === "WIND_DOWN" ? "none locked any more" : "all unlocked") : "locked from launch"}.</p>
      <div className="sup-row">
        <span className="sup-k">At launch</span>
        <div className="stackbar" role="img" aria-label="Allocation at launch">{seg(s.sale, "var(--accent)", "Backers")}{seg(s.pool, "var(--good)", "Trading liquidity")}{seg(s.team, "var(--line-strong)", "Team", "hatch")}</div>
      </div>
      {launched ? (
        <div className="sup-row">
          <span className="sup-k">Today</span>
          <div className="stackbar" role="img" aria-label="Supply today">{seg(s.free, "var(--ink-2)", "Redeemable")}{seg(s.locked, "var(--line-strong)", "Team, locked", "hatch")}{seg(s.burned, "var(--bad)", "Burned")}</div>
        </div>
      ) : null}
      <div className="legend-inline">
        <span><i style={{ background: "var(--accent)" }} />Backers <b>{pct(s.sale / S, 1)}</b> · {tokens(s.sale)}</span>
        <span><i style={{ background: "var(--good)" }} />Trading liquidity <b>{pct(s.pool / S, 1)}</b> · {tokens(s.pool)}</span>
        <span><i className="hatch" style={{ background: "var(--line-strong)" }} />Team <b>{pct(s.team / S, 1)}</b> · {tokens(s.team)}</span>
        {launched ? <>
          <span><i style={{ background: "var(--ink-2)" }} />Redeemable today <b>{pct(s.free / S, 1)}</b> · {tokens(s.free)}</span>
          <span><i style={{ background: "var(--bad)" }} />Burned <b>{pct(s.burned / S, 1)}</b> · {tokens(s.burned)}</span>
        </> : null}
      </div>
    </div>
  );
}

/* ---------- Health ---------- */

export function Health({ v, d, compact }: { v: CovenantView; d: Derived; compact?: boolean }) {
  const t = v.terms;
  const ended = v.state === "WIND_DOWN";
  const steps = useMemo(() => runway(v.treasury, v.owedTeam, t.tapUsdPer30d, d.bnbUsd, t.tapCapBps, 12), [v.treasury, v.owedTeam, t.tapUsdPer30d, d.bnbUsd, t.tapCapBps]);
  const free = Math.max(0, v.treasury - v.owedTeam);
  const end = steps[steps.length - 1]!;
  const half = halvingMonths(steps);
  const first = steps[1];
  return (
    <div className={cx("health", compact && "compact")}>
      <div className="health-run">
        <h3 className="story-h3">Runway at the limit</h3>
        {ended ? (
          <>
            <div className="health-figs">
              <Stat size="xl" k="Tap" v="Ended" s="It stopped at wind-down. The treasury now leaves only through redemptions at book, with no fee." />
              <Stat k="Tap paid in total" v={<span className="num">{amt(-d.sums.tap)} <small>BNB</small></span>} s={`to the fixed ${who(v)} wallet`} />
              <Stat k="Redeemed so far" v={<span className="num">{amt(-d.sums.redeem)} <small>BNB</small></span>} s="paid to holders at book" />
            </div>
            {v.ledger.length > 1 ? <><span className="stat-k">Treasury since launch, from the vault&apos;s events</span><StepChart steps={history(v)} labels="date" /></> : null}
          </>
        ) : (
          <>
            <div className="health-figs">
              <Stat size="xl" k="After 12 months" v={<span className="num">{amt(end.treasury)} <small>BNB</small></span>} s={<>{pct(free > 0 ? end.treasury / free : 0, 0)} of today, if the {who(v)} draws its full limit every month and nothing comes in</>} />
              <Stat k="Draw this month" v={<span className="num">{amt(first?.draw ?? 0)} <small>BNB</small></span>} s={first?.binding === "usd" ? <>the {usdAmt(t.tapUsdPer30d)} budget at {usdAmt(d.bnbUsd)} per BNB</> : <>{bps(t.tapCapBps)} of the treasury: the cap binds</>} />
              <Stat k="Halves in" v={half ? <span className="num">{half} months</span> : "Over 12 months"} s="the cap is a share of what is left, so the tap alone never empties it" />
            </div>
            <StepChart steps={steps} />
          </>
        )}
      </div>
      <div className="health-side">
        <div>
          <h3 className="story-h3">Treasury</h3>
          <div className="stat-v" style={{ fontSize: 26 }}><span className="num">{amt(v.treasury)}</span> <small className="muted">BNB in the vault</small></div>
          {d.bnbUsd > 0 ? <p className="stat-s">{usdAmt(v.treasury * d.bnbUsd)} at Atlas BNB/USD {usdAmt(d.bnbUsd)}</p> : null}
          <div className="stackbar" style={{ marginTop: 12 }} role="img" aria-label="Treasury composition">
            <i style={{ flexGrow: (free / Math.max(v.treasury, 1e-18)) * 1000 || 1, background: "var(--agent)" }} />
            {v.owedTeam > 0 ? <i style={{ flexGrow: (v.owedTeam / Math.max(v.treasury, 1e-18)) * 1000, background: "var(--warn)" }} /> : null}
          </div>
          <div className="legend-inline">
            <span><i style={{ background: "var(--agent)" }} />Backs every token <b>{pct(v.treasury > 0 ? free / v.treasury : 0, 1)}</b> · {amt(free)}</span>
            <span><i style={{ background: "var(--warn)" }} />Owed to the {who(v)} <b>{pct(v.treasury > 0 ? v.owedTeam / v.treasury : 0, 1)}</b> · {amt(v.owedTeam)}</span>
          </div>
          <p className="stat-s" style={{ marginTop: 6 }}>All BNB: Flap&apos;s pools are BNB-quoted, so the dollar value moves with BNB.</p>
        </div>
        <div>
          <h3 className="story-h3">Spending rules</h3>
          <ul className="rules-list">
            <li><div><b>Monthly limit</b><span>{ended ? "Ended at wind-down" : `Above it, nothing: the vault refuses`}</span></div><em className="num">{usdAmt(t.tapUsdPer30d)}</em></li>
            <li><div><b>Hard cap</b><span>Even if the BNB/USD rate is wrong</span></div><em className="num">{bps(t.tapCapBps)} / 30d</em></li>
            <li><div><b>Who can draw it</b><span>Paid only to the fixed team wallet</span></div><em className="mono">{short(t.teamWallet)}</em></li>
            <li><div><b>Can it go up?</b><span>Only lowered, never raised, by anyone</span></div><em>Never</em></li>
            <li><div><b>Pauses when</b><span>An exit round runs, the {who(v)} winds down, or no fresh Atlas rate</span></div><em>{d.tapPaused ? "Paused" : "Accruing"}</em></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/** The vault's balance after each ledger entry, oldest first (real events only). */
function history(v: CovenantView): { month: number; treasury: number; at?: number }[] {
  const rows = [...v.ledger].sort((a, b) => a.at - b.at);
  let bal = 0;
  return rows.map((r, i) => { bal += r.amount; return { month: i, treasury: Math.max(0, bal), at: r.at }; });
}

export function StepChart({ steps, labels = "month" }: { steps: { month: number; treasury: number; at?: number }[]; labels?: "month" | "date" }) {
  const W = 560, H = 170, L = 44, B = 22, T = 10, R = 8;
  const max = Math.max(1e-18, ...steps.map((s) => s.treasury));
  const x = (m: number) => L + (m / Math.max(1, steps.length - 1)) * (W - L - R);
  const y = (n: number) => T + (1 - n / max) * (H - T - B);
  let dPath = `M ${x(0)} ${y(steps[0]!.treasury)}`;
  for (let i = 1; i < steps.length; i++) dPath += ` H ${x(steps[i]!.month)} V ${y(steps[i]!.treasury)}`;
  const area = `${dPath} V ${H - B} H ${x(0)} Z`;
  const ticks = [0, max / 2, max];
  return (
    <svg className="stepchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Treasury month by month at the tap limit">
      {ticks.map((tk) => <g key={tk}><line x1={L} x2={W - R} y1={y(tk)} y2={y(tk)} className="grid" /><text x={L - 6} y={y(tk) + 3} textAnchor="end">{amt(tk)}</text></g>)}
      <path d={area} className="area" />
      <path d={dPath} className="line" />
      {labels === "month" ? steps.map((s) => <text key={s.month} x={x(s.month)} y={H - 6} textAnchor="middle">{s.month}</text>)
        : steps.map((s, i) => (i === 0 || i === steps.length - 1) && s.at ? <text key={s.month} x={x(s.month)} y={H - 6} textAnchor={i === 0 ? "start" : "end"}>{date(s.at)}</text> : null)}
    </svg>
  );
}

/* ---------- Unlock curve ---------- */

export function UnlockCurve({ v, d }: { v: CovenantView; d: Derived }) {
  const t = v.terms;
  const id = useId();
  const pos = v.position;
  const start = pos && pos.accepted > 0 ? String(+pos.accepted.toFixed(4)) : "";
  const [stake, setStake] = useState(start);
  const maxMult = Math.max(400, ...t.trancheMultiple) * 2; // x100
  const lo = Math.log(50), hi = Math.log(maxMult);
  const [pos01, setPos] = useState(() => (Math.log(100) - lo) / (hi - lo));
  const m100 = Math.exp(lo + pos01 * (hi - lo));
  const amount = Number(stake) > 0 ? Number(stake) : 1;
  const value = amount * (m100 / 100);
  const u = unlocksAt(v, m100);
  const la = launchAt(v);
  const today = todayMultiple(v, d.salePrice, d.bnbUsd);
  const todayM = launchedOf(v) ? (today.usd ?? today.bnb) * 100 : null;
  const W = 640, H = 200, L = 52, B = 26, T = 12, R = 10;
  const x = (m: number) => L + ((Math.log(m) - lo) / (hi - lo)) * (W - L - R);
  const y = (val: number) => T + (1 - val / (amount * (maxMult / 100))) * (H - T - B);
  const pts = Array.from({ length: 64 }, (_, i) => Math.exp(lo + (i / 63) * (hi - lo)));
  const line = pts.map((m, i) => `${i ? "L" : "M"} ${x(m).toFixed(1)} ${y(amount * (m / 100)).toFixed(1)}`).join(" ");
  const axis: number[] = [50];
  for (let m = 100; m <= maxMult; m *= 2) axis.push(m);
  return (
    <div className="curve">
      <div className="row between wrap-ok" style={{ gap: 10 }}>
        <h3 className="story-h3">Token unlock schedule</h3>
        <span className="t-xs muted w5">{t.cliff ? `locked ${span(t.cliff)}, then ` : ""}unlocks from {multiple(t.trancheMultiple[0] ?? 200)}</span>
      </div>
      <div className="curve-top">
        <div className="curve-fig"><span className="num">{amt(amount)} BNB</span><Icon name="arrow" size={18} /><span className="num">{amt(value)} BNB</span><small>at {(m100 / 100).toFixed(2)}x</small></div>
        <label className="curve-in" htmlFor={`${id}-amt`}>Stake at the sale price
          <span className="ig"><input id={`${id}-amt`} className="field" inputMode="decimal" placeholder="1" value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))} /><span className="unit">BNB</span></span>
        </label>
      </div>
      <p className="story-sub" style={{ marginTop: 2 }}>At this price, <b className="ink">{u.count} of {u.of}</b> team unlocks would apply{t.cliff && la !== null ? ` after ${date(la + t.cliff)}` : t.cliff ? " after the cliff" : ""}: <b className="ink">{bps(u.bps)}</b> of supply.</p>
      <svg className="curvechart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Value of the stake against the price multiple">
        {[0, 0.5, 1].map((f) => { const val = f * amount * (maxMult / 100); return <g key={f}><line x1={L} x2={W - R} y1={y(val)} y2={y(val)} className="grid" /><text x={L - 6} y={y(val) + 3} textAnchor="end">{amt(val)}</text></g>; })}
        {t.trancheMultiple.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={T} y2={H - B} className={cx("tr", m100 >= m && "on")} />)}
        {todayM && todayM > 50 && todayM < maxMult ? <g><line x1={x(todayM)} x2={x(todayM)} y1={T} y2={H - B} className="today" /><text x={x(todayM) + 4} y={T + 10} className="today-t">today</text></g> : null}
        <path d={line} className="line" />
        <circle cx={x(m100)} cy={y(value)} r={5} className="dot" />
        {axis.map((m) => <text key={m} x={x(m)} y={H - 8} textAnchor="middle" className={cx(t.trancheMultiple.includes(m) && "trl")}>{(m / 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}x</text>)}
      </svg>
      <div className="curve-team" aria-hidden>
        <span>Team</span>
        <div style={{ position: "relative", height: 16 }}>
          {t.trancheMultiple.map((m, k) => <span key={m} className={cx("sq", m100 >= m && "on")} style={{ left: `calc(${((x(m) - L) / (W - L - R)) * 100}% - 5px)` } as CSSProperties} title={`${bps(t.trancheBps[k] ?? 0)} at ${multiple(m)}`} />)}
        </div>
      </div>
      <input className="curve-range" type="range" min={0} max={1000} value={Math.round(pos01 * 1000)} onChange={(e) => setPos(Number(e.target.value) / 1000)} aria-label="Price as a multiple of the sale price" aria-valuetext={`${(m100 / 100).toFixed(2)}x the sale price`} />
      <p className="story-foot">Team tokens stay locked{t.cliff ? ` for ${span(t.cliff)}` : ""}, then unlock in {t.trancheMultiple.length} step{t.trancheMultiple.length === 1 ? "" : "s"} ({t.trancheMultiple.map((m, k) => `${bps(t.trancheBps[k] ?? 0)} at ${multiple(m)}`).join(", ")}) once the price holds each multiple for {span(t.unlockWindow)}, in dollars and in the pool&apos;s own BNB price. Type an amount, then slide or use the arrow keys.</p>
    </div>
  );
}
