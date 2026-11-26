"use client";

/*
 * The Create page's live preview, drawn the way the covenant page will draw the covenant once it exists: Flap's
 * minimum raise up front, then the money map (backers to pool, treasury and refunds, at the minimum and at the cap),
 * the unlock ladder and supply, and the treasury's runway at the tap limit. Every figure comes from the form and the
 * doc's formulas, priced at Flap's live floor and Atlas BNB/USD when the chain answers; nothing is sampled.
 */
import { useState, type ReactNode } from "react";
import type { FlapFloor } from "@/lib/chain/create";
import { floorAfterMonths, startingFloorRatio, type RaiseResult, type Split } from "@/lib/covenant/math";
import { amt, halvingMonths, runway, usdAmt } from "@/lib/covenant/story";
import { longSpan, span } from "@/lib/covenant/time";
import type { Terms } from "@/lib/covenant/types";
import { bps, multiple, pct, tokens, usd } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { ThinkingMark } from "./mark";
import { StepChart, Stat, Story, Tiny } from "./story";
import { Meter, Segmented, cx } from "./ui";

export interface DraftModel {
  t: Terms;
  issuer: "agent" | "human";
  sp: Split;
  atMin: RaiseResult;
  atCap: RaiseResult;
  /** Atlas BNB/USD, or null while it is unknown */
  bnbUsd: number | null;
}

const whoOf = (d: DraftModel) => (d.issuer === "agent" ? "agent" : "team");

/* ---------- Flap's minimum raise ---------- */

export function FloorCallout({ floor, live, loading, minRaise, poolBps, onUseMin, compact }: {
  floor: FlapFloor | null; live: boolean; loading: boolean; minRaise: number; poolBps: number; onUseMin: () => void; compact?: boolean;
}) {
  if (!live) {
    return (
      <div className="cr-floor idle">
        <span className="cr-floor-k"><Icon name="drop" size={14} />Flap&apos;s minimum raise</span>
        <p className="t-s muted w5">Read live from Flap&apos;s Portal through the launcher factory once the chain answers.</p>
      </div>
    );
  }
  if (!floor) {
    return (
      <div className="cr-floor idle" aria-busy={loading}>
        <span className="cr-floor-k"><Icon name="drop" size={14} />Flap&apos;s minimum raise</span>
        <p className="t-s muted w5 row" style={{ gap: 8 }}>{loading ? <><ThinkingMark size={14} />Reading Flap&apos;s floor for a {bps(poolBps)} pool…</> : "The factory did not report a floor for this split."}</p>
      </div>
    );
  }
  const okNow = minRaise >= floor.minRaise;
  const need = Math.ceil(floor.minRaise * 10_000 - 1e-9) / 10_000;
  return (
    <div className={cx("cr-floor", okNow ? "ok" : "bad")}>
      <div className="row between" style={{ gap: 10, alignItems: "flex-start" }}>
        <span className="cr-floor-k"><Icon name="drop" size={14} />Flap&apos;s minimum raise</span>
        <span className={cx("tag", okNow ? "good" : "warn")}>{okNow ? <><Icon name="check" size={12} strokeWidth={2.2} />Clears it</> : "Under it"}</span>
      </div>
      <div className="cr-floor-v"><span className="num">{need.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span><small>BNB</small></div>
      <p className="cr-floor-s">
        At a <b className="num">{bps(poolBps)}</b> pool. Yours is <b className="num">{minRaise.toLocaleString("en-US", { maximumFractionDigits: 4 })} BNB</b>.{" "}
        {compact ? null : <>Flap&apos;s {floor.graduation ? "graduation" : "launch"} floor is <span className="num">{usd(floor.floorUsd)}</span> of pool seed at <span className="num">{usd(floor.priceUsd)}</span> per BNB{floor.marginBps > 10_000 ? <>, and the factory asks for <span className="num">{floor.marginBps / 10_000}x</span> that</> : null}: a seed of <span className="num">{amt(floor.minSeed)} BNB</span>. A larger pool share lowers it.</>}
      </p>
      {okNow ? null : <button type="button" className="btn btn-primary btn-sm cr-floor-btn" onClick={onUseMin}><Icon name="check" size={14} />Use the minimum, {need.toLocaleString("en-US", { maximumFractionDigits: 4 })} BNB</button>}
    </div>
  );
}

/* ---------- At a glance (the side panel) ---------- */

export function Glance({ d, check, children }: { d: DraftModel; check: ReactNode; children?: ReactNode }) {
  const { t, atMin, atCap } = d;
  const budget = d.bnbUsd ? Math.min(t.tapUsdPer30d / d.bnbUsd, (atCap.T0 * t.tapCapBps) / 10_000) : (atCap.T0 * t.tapCapBps) / 10_000;
  return (
    <div className="cr-glance">
      {children}
      <div className="cr-twocol" role="table" aria-label="The raise at the minimum and at the cap">
        <div role="row" className="cr-twocol-h"><span role="columnheader" /><span role="columnheader">At the minimum</span><span role="columnheader">At the cap</span></div>
        <Row k="Backers pay" a={<><Tiny n={atMin.salePrice} /> <small>BNB</small></>} b={<><Tiny n={atCap.salePrice} /> <small>BNB</small></>} s="per token" />
        <Row k="Vault treasury" a={<>{amt(atMin.T0)} <small>BNB</small></>} b={<>{amt(atCap.T0)} <small>BNB</small></>} s="backs book value" />
        <Row k="Pool seed" a={<>{amt(atMin.qPool)} <small>BNB</small></>} b={<>{amt(atCap.qPool)} <small>BNB</small></>} s={`+ ${tokens(d.sp.P)} tokens`} />
      </div>
      <dl className="kv">
        <dt>Starting floor</dt><dd className="num">{pct(startingFloorRatio(t.saleBps, t.poolBps), 1)} of the sale price</dd>
        <dt>Tap at the cap</dt><dd className="num">{amt(budget)} BNB / 30d{d.bnbUsd ? null : <span className="faint"> at most</span>}</dd>
        <dt>Sale window</dt><dd className="num">{span(t.saleDuration)}</dd>
      </dl>
      {check}
    </div>
  );
}

function Row({ k, a, b, s }: { k: string; a: ReactNode; b: ReactNode; s: string }) {
  return (
    <div role="row" className="cr-twocol-r">
      <span role="rowheader"><b>{k}</b><small>{s}</small></span>
      <span role="cell" className="num">{a}</span>
      <span role="cell" className="num">{b}</span>
    </div>
  );
}

/* ---------- Money map ---------- */

type Scenario = "met" | "missed";

export function DraftMoneyMap({ d }: { d: DraftModel }) {
  const [tab, setTab] = useState<Scenario>("met");
  const { t, atMin, atCap } = d;
  const w = whoOf(d);
  const missed = tab === "missed";
  const targets: { key: string; icon: IconName; title: string; tone: string; v: string; s: string }[] = missed
    ? [{ key: "back", icon: "redeem", title: "Back to backers", tone: "", v: "Everything", s: "below the minimum every backer claims their own, all of it; a launch Flap refuses refunds the same way" }]
    : [
      { key: "treasury", icon: "vault", title: "Vault treasury", tone: "agent", v: range(atMin.T0, atCap.T0), s: `backs every token at book; the ${w}'s only access is the tap, ${bps(t.tapCapBps)} of it a month at most` },
      { key: "pool", icon: "swap", title: "Trading liquidity", tone: "good", v: range(atMin.qPool, atCap.qPool), s: `${tokens(d.sp.P)} ${t.symbol || "tokens"} + BNB seed the pool at the sale price, LP locked` },
      { key: "back", icon: "redeem", title: "Back to backers", tone: "", v: `Over ${amt(t.cap)} BNB`, s: "anything committed above the cap goes back pro rata; each backer claims it" },
    ];
  return (
    <Story id="money-map" title="Money map" sub="Every BNB, from a backer's wallet to the treasury, and both ways the raise can end."
      right={<Segmented size="sm" label="Scenario" value={tab} onChange={setTab} options={[{ value: "met", label: "If the minimum is met" }, { value: "missed", label: "If it is missed" }]} />}>
      <p className="story-lead">
        {missed ? <>If backers commit less than <b className="num">{amt(t.minRaise)} BNB</b> by the deadline, nothing launches and nobody keeps anything: every commitment refunds in full.</>
          : <>The minimum is <b className="num">{amt(t.minRaise)} BNB</b> and the cap <b className="num">{amt(t.cap)} BNB</b>. At close one finalize pays the accepted amount out: <b className="num">{pct(d.sp.P / d.sp.A, 0)}</b> of it to the pool, the rest to the vault.</>}
      </p>
      <div className="mm is-cond">
        <div className="mm-node src">
          <span className="mm-k"><Icon name="users" size={14} />Backers commit</span>
          <b className="mm-v num">{missed ? `Under ${amt(t.minRaise)} BNB` : `${amt(t.minRaise)} BNB or more`}</b>
          <span className="mm-s">uncapped; above the cap everyone is scaled back pro rata</span>
        </div>
        <div className="mm-edge"><span className="mm-line" /><span className="mm-chip">Held</span></div>
        <div className="mm-node mid live">
          <span className="mm-k"><Icon name="lock" size={14} />Launcher escrow</span>
          <b className="mm-v num">{span(t.saleDuration)}</b>
          <span className="mm-s">the sale window; neither the {w} nor Covenant can touch it</span>
        </div>
        <div className="mm-fork" aria-hidden>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {targets.map((x, i) => { const y = ((i + 0.5) / targets.length) * 100; return <path key={x.key} d={`M0 50 C 55 50, 45 ${y}, 100 ${y}`} className="dash" vectorEffect="non-scaling-stroke" />; })}
          </svg>
        </div>
        <div className="mm-targets" style={{ gridTemplateRows: `repeat(${targets.length}, minmax(0, 1fr))` }}>
          {targets.map((x) => (
            <div key={x.key} className={cx("mm-node tgt", x.tone)}>
              <span className="mm-k"><Icon name={x.icon} size={14} />{x.title}</span>
              <b className="mm-v num">{x.v}</b>
              <span className="mm-s">{x.s}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mm-key" aria-hidden><span><i className="dash" />would move</span><span className="faint">ranges run from the minimum to the cap</span></div>
    </Story>
  );
}

function range(lo: number, hi: number) {
  return Math.abs(hi - lo) < 1e-12 ? `${amt(lo)} BNB` : `${amt(lo)}–${amt(hi)} BNB`;
}

/* ---------- Unlock ladder and supply ---------- */

export function DraftUnlocks({ d }: { d: DraftModel }) {
  const { t, atCap, sp } = d;
  const sale = atCap.salePrice;
  const usdSale = d.bnbUsd ? sale * d.bnbUsd : null;
  const team = Math.max(0, 10_000 - t.saleBps - t.poolBps);
  const rows = t.trancheMultiple.map((m, k) => ({ m, k, b: t.trancheBps[k] ?? 0 })).sort((a, b) => b.m - a.m);
  const S = Math.max(1e-18, t.totalSupply);
  const seg = (n: number, c: string, label: string, extra?: string) => (n > 0 ? <i key={label} title={`${label}: ${tokens(n)}`} className={extra} style={{ flexGrow: (n / S) * 1000, background: c }} /> : null);
  return (
    <Story id="unlocks" title="Unlocks and supply" sub={`Where the supply goes, and when the ${whoOf(d)}'s share can unlock.`}>
      <div className="story-split">
        <div className="lad-wrap">
          <div><h3 className="story-h3" style={{ marginBottom: 4 }}>Unlock ladder</h3><p className="story-sub">{t.cliff ? `Team tokens locked for a ${span(t.cliff)} cliff, then` : "Team tokens locked from launch, then"} unlock in steps. Prices at the cap&apos;s sale price.</p></div>
          <ol className="lad">
            {rows.map((r) => (
              <li key={r.k} className="lad-row">
                <span className="lad-m">{multiple(r.m)}</span>
                <span className="lad-dot" />
                <span className="lad-p"><span><Tiny n={(sale * r.m) / 100} /> BNB</span>{usdSale ? <small>{usdAmt((usdSale * r.m) / 100)}</small> : null}</span>
                <span className="lad-a"><span className="num">{tokens((t.totalSupply * r.b) / 10_000)}</span> · {bps(r.b)}</span>
                <span className="tag">{t.cliff ? "Cliff" : "Locked"}</span>
              </li>
            ))}
            <li className="lad-row base">
              <span className="lad-m">1x</span><span className="lad-dot" />
              <span className="lad-p"><span><Tiny n={sale} /> BNB</span>{usdSale ? <small>{usdAmt(usdSale)}</small> : null}</span>
              <span className="lad-a">Sale price</span>
            </li>
          </ol>
          <p className="story-foot">Each step unlocks once the price holds its multiple for <b>{span(t.unlockWindow)}</b>, in dollars and in the pool&apos;s own BNB price. Abandoned, the steps still locked are burned.</p>
        </div>
        <div className="sup">
          <h3 className="story-h3">Who holds the supply</h3>
          <p className="story-lead"><b className="num">{tokens(sp.A)}</b> of <b className="num">{tokens(t.totalSupply)}</b> {t.symbol || "tokens"} go to backers, <b className="num">{tokens(sp.P)}</b> to trading liquidity, <b className="num">{tokens(sp.E)}</b> to the {whoOf(d)}, locked from launch.</p>
          <div className="stackbar lg" role="img" aria-label="Allocation at launch">{seg(sp.A, "var(--accent)", "Backers")}{seg(sp.P, "var(--good)", "Trading liquidity")}{seg(sp.E, "var(--line-strong)", "Team", "hatch")}</div>
          <div className="legend-inline">
            <span><i style={{ background: "var(--accent)" }} />Backers <b>{bps(t.saleBps)}</b></span>
            <span><i style={{ background: "var(--good)" }} />Trading liquidity <b>{bps(t.poolBps)}</b></span>
            <span><i className="hatch" style={{ background: "var(--line-strong)" }} />Team <b>{bps(team)}</b></span>
          </div>
          <div className="cr-sup-stats">
            <Stat k="Starting floor" v={<span className="num">{pct(startingFloorRatio(t.saleBps, t.poolBps), 0)}</span>} s="of the sale price, backed by treasury BNB" />
            <Stat k="Valuation at the cap" v={<span className="num">{amt(sale * t.totalSupply)} <small>BNB</small></span>} s={usdSale ? `${usdAmt(usdSale * t.totalSupply)} at Atlas BNB/USD` : "the sale price times every token"} />
          </div>
        </div>
      </div>
    </Story>
  );
}

/* ---------- Budget runway ---------- */

export function DraftRunway({ d, rateLoading }: { d: DraftModel; rateLoading: boolean }) {
  const { t, atCap } = d;
  const steps = runway(atCap.T0, 0, t.tapUsdPer30d, d.bnbUsd ?? 0, t.tapCapBps, 12);
  const end = steps[steps.length - 1]!;
  const first = steps[1];
  const half = halvingMonths(steps);
  const ratio = startingFloorRatio(t.saleBps, t.poolBps);
  return (
    <Story id="runway" title="Budget runway" sub={`The treasury at the cap if the ${whoOf(d)} draws its full limit every month and nothing comes in.`}>
      <div className="health">
        <div className="health-run">
          <div className="health-figs">
            <Stat size="xl" k="After 12 months" v={<span className="num">{amt(end.treasury)} <small>BNB</small></span>} s={<>{pct(atCap.T0 > 0 ? end.treasury / atCap.T0 : 0, 0)} of the <span className="num">{amt(atCap.T0)} BNB</span> it starts with</>} />
            <Stat k="Draw in month one" v={<span className="num">{amt(first?.draw ?? 0)} <small>BNB</small></span>} s={d.bnbUsd ? (first?.binding === "usd" ? <>the {usdAmt(t.tapUsdPer30d)} budget at {usdAmt(d.bnbUsd)} per BNB</> : <>{bps(t.tapCapBps)} of the treasury: the cap binds</>) : rateLoading ? "reading BNB/USD from Atlas…" : "the cap; BNB/USD from Atlas is unavailable"} />
            <Stat k="Halves in" v={half ? <span className="num">{half} months</span> : "Over 12 months"} s="the cap is a share of what is left, so the tap alone never empties it" />
          </div>
          <StepChart steps={steps} />
        </div>
        <div className="health-side">
          <div>
            <h3 className="story-h3">Floor as a share of the sale price</h3>
            <div className="stack-sm" style={{ display: "grid" }}>
              {[0, 6, 12, 24].map((m) => (
                <div key={m} className="floor-row">
                  <span className="muted">{m === 0 ? "Launch" : `${m} months`}</span>
                  <Meter size="sm" value={floorAfterMonths(m, t.tapCapBps, ratio)} max={1} label={`Floor after ${m} months`} />
                  <span className="num ink" style={{ textAlign: "right" }}>{pct(floorAfterMonths(m, t.tapCapBps, ratio), 0)}</span>
                </div>
              ))}
            </div>
            <p className="stat-s" style={{ marginTop: 8 }}>The cap binding every month, no trading tax and no revenue: the worst case for holders.</p>
          </div>
          <div>
            <h3 className="story-h3">Spending rules</h3>
            <ul className="rules-list">
              <li><div><b>Monthly limit</b><span>Paid in BNB at the Atlas rate</span></div><em className="num">{usdAmt(t.tapUsdPer30d)}</em></li>
              <li><div><b>Hard cap</b><span>Even if the BNB/USD rate is wrong</span></div><em className="num">{bps(t.tapCapBps)} / 30d</em></li>
              <li><div><b>Trading tax</b><span>{bps(t.buyTaxBps)} buy · {bps(t.sellTaxBps)} sell, into the vault</span></div><em className="num">{longSpan(t.taxDuration)}</em></li>
              <li><div><b>Can it go up?</b><span>Only lowered, never raised, by anyone</span></div><em>Never</em></li>
            </ul>
          </div>
        </div>
      </div>
    </Story>
  );
}
