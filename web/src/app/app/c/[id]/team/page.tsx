"use client";

import { useState, type ReactNode } from "react";
import { AgentChat } from "@/components/app/agent-console";
import { ConfirmAction } from "@/components/app/confirm";
import { EventFeed } from "@/components/app/covenant";
import { CovenantPage } from "@/components/app/covenant-page";
import { Health, Story } from "@/components/app/story";
import { Icon, type IconName } from "@/components/app/icons";
import { Addr, Meter, Note, Ticker, cx } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { useActions } from "@/lib/data/actions";
import { useCovenants } from "@/lib/data/hooks";
import type { Derived } from "@/lib/covenant/derive";
import { DAY, duration, relative, span } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, bps, multiple, usd } from "@/lib/format";

export default function TeamPage() {
  return <CovenantPage>{(v, d) => <Console v={v} d={d} />}</CovenantPage>;
}

function Console({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const w = useWallet();
  const { list } = useCovenants();
  const agent = v.issuer.kind === "agent";
  const [newTap, setNewTap] = useState("");
  const [rev, setRev] = useState("");
  const [confirmWind, setConfirmWind] = useState(false);
  const isTeam = Boolean(w.address && w.address.toLowerCase() === v.terms.teamWallet.toLowerCase());
  const ended = v.state === "WIND_DOWN" || v.state === "FAILED" || v.state === "RAISING";
  const launched = v.state !== "RAISING" && v.state !== "FAILED";
  const hbUsed = Math.max(0, v.now - v.lastHeartbeat);
  const hbLow = d.hbLeft < 7 * DAY;

  const controls = (
    <div className="ctl">
      <Ctl icon="coins" title="Budget" tag="Rule 1">
        <div className="row base between"><span className="fig-md"><Ticker value={v.tap.accrued} format={(n) => bnb(n, 3)} /><span className="u">BNB claimable</span></span></div>
        <p className="t-xs muted w5">{d.tapPaused ? (v.state === "EXIT_ROUND" ? "Accrual is paused during the exit round." : "No accrual in this state.") : `${usd(v.terms.tapUsdPer30d)} / 30d, cap ${bps(v.terms.tapCapBps)}. Claiming pays the fixed team wallet and counts as a heartbeat.`}</p>
        <button className="btn btn-primary btn-block" disabled={!isTeam || v.tap.accrued <= 0} onClick={() => void run("claimTap")}><Icon name="coins" size={15} />Claim {bnb(v.tap.accrued, 3)} BNB</button>
        <div className="hr" />
        <label className="label" htmlFor="tap" style={{ margin: 0 }}>Lower the tap <span className="hint">now {usd(v.terms.tapUsdPer30d)}</span></label>
        <div className="row" style={{ gap: 8 }}>
          <div className="ig grow"><input id="tap" className="field" inputMode="numeric" placeholder={String(Math.round(v.terms.tapUsdPer30d))} value={newTap} onChange={(e) => setNewTap(e.target.value.replace(/[^0-9]/g, ""))} /><span className="unit">USD / 30d</span></div>
          <button className="btn btn-secondary" disabled={!isTeam || ended || newTap === "" || !(Number(newTap) < v.terms.tapUsdPer30d)} onClick={() => void run("lowerTap", Number(newTap))}>Lower</button>
        </div>
        <p className="help" style={{ marginTop: 0 }}>Only downwards. Nobody can raise it.</p>
      </Ctl>

      <Ctl icon="heart" title="Stay present" tag="Rule 4" tone={d.hbLeft <= 0 ? "bad" : hbLow ? "warn" : undefined}>
        <Meter value={hbUsed} max={v.terms.heartbeat} tone={d.hbLeft <= 0 ? "bad" : hbLow ? "warn" : undefined} label="Heartbeat window used" />
        <p className="t-xs muted w5"><span className="num">{duration(hbUsed)}</span> of <span className="num">{span(v.terms.heartbeat)}</span> since the last {agent ? "agent" : "team"} action. Claiming, lowering the tap and posting a report all count.</p>
        <button className="btn btn-secondary btn-block" disabled={!isTeam || ended} onClick={() => void run("heartbeat")}><Icon name="heart" size={15} />Send heartbeat</button>
      </Ctl>

      <Ctl icon="doc" title="Report" tag="Rule 5">
          <p className="t-xs muted w5">Posts the period&apos;s report URI and its hash on-chain.{agent ? " The agent's model writes it from its ledger; it never decides a rule." : ""}</p>
          <button className="btn btn-secondary btn-block" disabled={!isTeam || ended} onClick={() => void run("postReport")}><Icon name="doc" size={15} />Post the period {v.disclosure.passed + 1} report</button>
      </Ctl>

      <Ctl icon="bolt" title={agent ? "Route revenue" : "Send revenue"} tag="Raises book value">
        <p className="t-xs muted w5">{agent ? "An agent paid on-chain sends what it earns straight to the vault, and every holder's book value rises with it." : "BNB sent to the vault is recognised as revenue and raises book value for every holder."}</p>
        <div className="row" style={{ gap: 8 }}>
          <div className="ig grow"><input className="field" inputMode="decimal" placeholder="0" value={rev} onChange={(e) => setRev(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Revenue in BNB" /><span className="unit">BNB</span></div>
          <button className="btn btn-primary" disabled={ended || !(Number(rev) > 0)} onClick={() => void run("revenue", Number(rev))}>Send</button>
        </div>
      </Ctl>

      <Ctl icon="unlock" title="Tranches" tag="Rule 2 · strict gate">
        {v.tranches.map((t) => (
          <div key={t.multiple} style={{ display: "grid", gap: 6 }}>
            <div className="row between t-s w5"><span className="ink">{bps(t.bps)} at {multiple(t.multiple)}</span><span className="num muted t-xs">{t.unlocked ? "unlocked" : `${duration(t.progress)} / ${duration(v.terms.unlockWindow)}`}</span></div>
            <Meter size="sm" value={t.unlocked ? 1 : t.progress} max={t.unlocked ? 1 : v.terms.unlockWindow} tone={t.unlocked ? "good" : "agent"} label={`${multiple(t.multiple)} tranche`} />
          </div>
        ))}
        <button className="btn btn-secondary btn-block" disabled={!v.tranches.some((t) => t.unlocked)} onClick={() => void run("releaseTeam")}>Release unlocked tranches</button>
      </Ctl>

      <Ctl icon="vault" title="Close honestly" tag="Rule 4" tone="bad">
        <p className="t-xs muted w5">Winding down ends the tap, burns locked team tokens and opens redemption at book with no fee, forever. Tap accrued until now stays claimable.</p>
        <button className="btn btn-danger-soft btn-block" disabled={!isTeam || ended} onClick={() => setConfirmWind(true)}>Wind down…</button>
        <ConfirmAction open={confirmWind} onClose={() => setConfirmWind(false)} onConfirm={() => { setConfirmWind(false); void run("windDown"); }}
          title={`Wind down ${v.terms.name}?`} confirmLabel="Wind down for good" icon="vault"
          lead={<>Closing honestly: the vault switches to wind-down and stays there.</>}
          points={[
            { icon: "coins", text: <>The tap ends. Tap accrued until now (<span className="num">{bnb(v.tap.accrued, 3)}</span> BNB) stays claimable.</> },
            { icon: "burn", text: <>Locked team tokens burn.</> },
            { icon: "redeem", text: <>Every holder can redeem at book with no fee, forever.</> },
            ...(agent ? [{ icon: "agent" as const, text: <>The wind-down is written to agent #{v.issuer.agentId}&apos;s ERC-8004 record.</> }] : []),
            { icon: "lock", text: <>It cannot be undone.</> },
          ]}
          gas={<>Only the team wallet can send this, and it pays the network fee (gas).</>} />
      </Ctl>
    </div>
  );

  return (
    <div className="stack stack-lg">
      <div className="console-top" style={{ padding: 0 }}>
        <div className="who">
          <span className={cx("icon-tile", agent && "agent")} style={{ width: 44, height: 44, borderRadius: 13 }}><Icon name={agent ? "agent" : "team"} size={20} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="h-card trunc">{v.issuer.name ?? (agent ? `Agent #${v.issuer.agentId}` : "Team")}</div>
            <div className="t-xs muted w5 row" style={{ gap: 6 }}>{agent ? `ERC-8004 #${v.issuer.agentId} ·` : "Team wallet"} <Addr a={v.terms.teamWallet} chainId={v.source === "live" ? v.chainId : undefined} /></div>
          </div>
        </div>
        <span className="chip-stat"><Icon name="coins" size={14} />Tap <b>{bnb(v.tap.accrued, 2)} BNB</b></span>
        <span className={cx("chip-stat", hbLow && "warn")}><Icon name="heart" size={14} />Heartbeat <b>{d.hbLeft > 0 ? duration(d.hbLeft, 1) : "lapsed"}</b></span>
        <span className="chip-stat hide-sm"><Icon name="doc" size={14} />Report <b>{v.disclosure.nextDueAt ? relative(v.disclosure.nextDueAt, v.now) : "–"}</b></span>
        {!isTeam ? <span className="badge warn lg">Read only: connect the team wallet</span> : <span className="badge good lg">Team wallet connected</span>}
      </div>

      {v.state === "RAISING" ? <Note tone="accent" icon="clock"><b>No vault yet.</b> The {agent ? "agent" : "team"}&apos;s controls (tap, heartbeat, reports, revenue, tranches, wind-down) act on the vault, which the raise creates when it settles. Until then nothing here can be sent.</Note>
        : v.state === "FAILED" ? <Note icon="info"><b>The raise failed.</b> No vault was created, so there is nothing to run. Backers claim their refunds on Settlement.</Note> : null}

      {launched ? (
        <Story id="health" title="Health" sub={`The treasury if the ${agent ? "agent" : "team"} draws its full limit, what it holds, and the rules on spending it.`}>
          <Health v={v} d={d} />
        </Story>
      ) : null}

      {agent ? (
        <div className="grid-side console-grid">
          <AgentChat v={v} all={list} />
          <div className="stack">{controls}</div>
        </div>
      ) : (
        <div className="grid-side">
          <div className="stack">{controls}</div>
          <div className="stack">
            <EventFeed v={v} limit={8} />
            <Note icon="shield">A human team is bound the same way as an agent issuer: the tap only goes down, unlocks need the price to hold, and silence opens the treasury to holders.</Note>
          </div>
        </div>
      )}
    </div>
  );
}

function Ctl({ icon, title, tag, tone, children }: { icon: IconName; title: string; tag: string; tone?: "warn" | "bad"; children: ReactNode }) {
  return (
    <div className="card card-pad stack-sm" style={{ display: "grid", gap: 12 }}>
      <div className="row between"><span className="row" style={{ gap: 10 }}><span className={cx("icon-tile sm", tone)}><Icon name={icon} size={15} /></span><span className="h-card" style={{ fontSize: 15 }}>{title}</span></span><span className="tag">{tag}</span></div>
      {children}
    </div>
  );
}
