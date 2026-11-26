"use client";

import { useState, type ReactNode } from "react";
import { chainName } from "@/lib/chain/chains";
import { LITE_DEFAULTS, usePrepareFour, type LiteParams } from "@/lib/data/four";
import { withBnb } from "./bnb";
import { Icon } from "./icons";
import { CopyCode } from "./live";
import { Meter, Note } from "./ui";

const DAY = 86_400;
const pctOf = (bps: number, d = 1) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: d })}%`;

/**
 * Covenant Lite for a Four.meme tax token: the template's four fields in plain words, a live preview of what the
 * founder can draw, then the template address and encoded params to paste on Four.meme, with the steps.
 */
export function FourLite() {
  const [p, setP] = useState<LiteParams>(LITE_DEFAULTS);
  const prep = usePrepareFour(p);
  const set = <K extends keyof LiteParams>(k: K, v: number) => setP((x) => ({ ...x, [k]: v }));
  const periods = (months: number) => (months * 30 * DAY) / p.tapPeriod;
  const left = (months: number) => Math.pow(1 - p.tapBps / 10_000, periods(months));
  const per30 = 1 - Math.pow(1 - p.tapBps / 10_000, (30 * DAY) / p.tapPeriod);

  return (
    <div className="grid-side">
      <div className="card">
        <div className="card-head ruled">
          <div className="row" style={{ gap: 12 }}><span className="icon-tile accent"><Icon name="shield" size={17} /></span><div><h2 className="h-card">Covenant Lite on Four.meme</h2><p className="t-xs muted w5">Rules 1 and 4: a budget cap and the abandonment switch, on the founder&apos;s share of trading tax.</p></div></div>
        </div>
        <div className="card-body ruled form-step">
          <Field label="Budget per period" hint="share of the treasury the founder can draw" value={pctOf(p.tapBps, 2)}>
            <input className="range" type="range" min={50} max={2000} step={50} value={Math.min(2000, p.tapBps)} onChange={(e) => set("tapBps", Number(e.target.value))} aria-label="Budget per period, basis points" style={{ ["--fill" as string]: `${((Math.min(2000, p.tapBps) - 50) / 1950) * 100}%` }} />
            <span className="help">Up to 50% is allowed; most founders keep it small. Template field <span className="mono">tapBps</span> = {p.tapBps}.</span>
          </Field>
          <div className="grid2">
            <Field label="Period length" hint="days, 1 to 90" value={`${p.tapPeriod / DAY} days`}>
              <Num value={p.tapPeriod / DAY} unit="days" onChange={(n) => set("tapPeriod", Math.round(n * DAY))} />
            </Field>
            <Field label="Heartbeat window" hint="days, 7 to 180" value={`${p.heartbeat / DAY} days`}>
              <Num value={p.heartbeat / DAY} unit="days" onChange={(n) => set("heartbeat", Math.round(n * DAY))} />
            </Field>
          </div>
          <Field label="Redeem fee" hint="kept by the treasury for those who stay, max 3%" value={pctOf(p.redeemFeeBps, 2)}>
            <Num value={p.redeemFeeBps / 100} unit="%" onChange={(n) => set("redeemFeeBps", Math.round(n * 100))} />
          </Field>
          <div className="tile stack-sm" style={{ display: "grid" }}>
            <span className="lbl">What the founder can draw</span>
            <p className="t-s ink2 w5">At most <b className="num ink">{pctOf(p.tapBps, 2)}</b> of the treasury every <b className="num ink">{p.tapPeriod / DAY} days</b>, about <b className="num ink">{(per30 * 100).toFixed(1)}%</b> a month. Each claim counts as a heartbeat.</p>
            {[3, 6, 12].map((m) => (
              <div key={m} className="floor-row"><span className="muted">{m} months</span><Meter size="sm" value={left(m)} max={1} /><span className="num ink" style={{ textAlign: "right" }}>{(left(m) * 100).toFixed(0)}%</span></div>
            ))}
            <p className="t-xs muted w5">Share of the treasury left if the founder draws the full budget every period and no tax comes in. If the founder is silent for {p.heartbeat / DAY} days, anyone opens the treasury; holders then burn tokens for a pro rata share, less the {pctOf(p.redeemFeeBps, 2)} fee.</p>
          </div>
          {prep.problems.length ? <ul className="problems">{prep.problems.map((x) => <li key={x}><Icon name="alert" size={13} />{x}</li>)}</ul> : null}
        </div>
      </div>

      <aside className="stack sticky" aria-label="Prepared for Four.meme">
        <div className="card">
          <div className="card-head ruled"><div><h2 className="h-card">Prepared for Four.meme</h2><p className="t-xs muted w5">{prep.live && prep.chainId ? <>Template on {withBnb(chainName(prep.chainId))}</> : "Connect to the local chain to read the template address"}</p></div>{prep.initParams && prep.template ? <span className="badge good"><Icon name="check" size={13} />Ready</span> : null}</div>
          <div className="card-body ruled stack">
            <Row k="Template address">{prep.template ? <CopyCode text={prep.template} /> : <span className="t-s muted w5">Not in this deployment</span>}</Row>
            <Row k="Encoded parameters">{prep.initParams ? <CopyCode text={prep.initParams} wrap /> : <span className="t-s muted w5">Fix the fields first</span>}</Row>
            <ol className="lite-steps">
              <li>Open Four.meme&apos;s create page and choose a <b>tax token</b>.</li>
              <li>For the founder&apos;s tax recipient, take the <b>Unverified Royalty</b> path and paste the template address.</li>
              <li>Paste the encoded parameters as the template&apos;s init data.</li>
              <li>Create the token. Four.meme&apos;s ForwardVault clones Covenant Lite as your recipient, so your share of trading tax lands in the vault, not your wallet.</li>
              <li>Claim within each heartbeat window to stay present; winding down early opens redemption to holders.</li>
            </ol>
            <Note icon="info">ForwardVault keeps a royalty of about 6% for the template author. Tokens still unsold on Four.meme&apos;s inner market count toward the redeemable supply until migration, which lowers the per-token payout.</Note>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, hint, value, children }: { label: string; hint: string; value: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <span className="label" style={{ margin: 0 }}>{label} <span className="hint">{hint}</span></span>
      <span className="fig num" style={{ fontSize: 20 }}>{value}</span>
      {children}
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return <div style={{ display: "grid", gap: 4, minWidth: 0 }}><span className="lbl">{k}</span>{children}</div>;
}

function Num({ value, onChange, unit }: { value: number; onChange: (n: number) => void; unit: string }) {
  const [s, setS] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); if (Number(s) !== value) setS(String(value)); }
  return <div className="ig"><input className="field mono" inputMode="decimal" value={s} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setS(v); onChange(Number(v) || 0); }} /><span className="unit">{unit}</span></div>;
}
