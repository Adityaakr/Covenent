"use client";

import { useState } from "react";
import { CovenantPage } from "@/components/app/covenant-page";
import { Icon } from "@/components/app/icons";
import { Meter, Note } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { useActions } from "@/lib/data/actions";
import type { Derived } from "@/lib/covenant/derive";
import { duration, relative } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, bps, multiple, usd } from "@/lib/format";

export default function TeamPage() {
  return <CovenantPage header={false}>{(v, d) => <Console v={v} d={d} />}</CovenantPage>;
}

function Console({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const w = useWallet();
  const agent = v.issuer.kind === "agent";
  const [newTap, setNewTap] = useState(String(Math.round(v.terms.tapUsdPer30d * 0.6)));
  const [rev, setRev] = useState("0.25");
  const [confirmWind, setConfirmWind] = useState(false);
  const isTeam = Boolean(w.address && w.address.toLowerCase() === v.terms.teamWallet.toLowerCase());
  const ended = v.state === "WIND_DOWN" || v.state === "FAILED" || v.state === "RAISING";
  const hbUsed = Math.max(0, v.now - v.lastHeartbeat);

  return (
    <div className="stack">
      <div className="row wrap between">
        <div>
          <p className="eyebrow">{agent ? `ERC-8004 agent #${v.issuer.agentId}` : "Team wallet"}</p>
          <h1 className="d2">{agent ? "Agent console." : "Team console."} <span className="soft">{agent ? "A budget it is held to." : "What the team can and cannot do."}</span></h1>
        </div>
        {!isTeam ? <span className="chip chip-warn">Read only: connect the team wallet to act</span> : <span className="chip chip-good">Team wallet connected</span>}
      </div>

      <div className="stats" style={{ ["--n" as string]: 4 }}>
        <div className="stat"><p className="k">Tap claimable</p><div className="v">{bnb(v.tap.accrued, 3)} BNB</div><div className="s">{d.tapPaused ? (v.state === "EXIT_ROUND" ? "Accrual paused in the round" : "No accrual") : `${usd(v.terms.tapUsdPer30d)} / 30d, cap ${bps(v.terms.tapCapBps)}`}</div></div>
        <div className="stat"><p className="k">Heartbeat</p><div className="v">{d.hbLeft > 0 ? duration(d.hbLeft) : "Lapsed"}</div><div className="s">Last {relative(v.lastHeartbeat, v.now)}</div></div>
        <div className="stat"><p className="k">Next report due</p><div className="v">{v.disclosure.nextDueAt ? duration(Math.max(0, v.disclosure.nextDueAt - v.now)) : "–"}</div><div className="s">{v.disclosure.passed} posted</div></div>
        <div className="stat"><p className="k">Budget per 30 days</p><div className="v">{bnb(d.budget.bnb, 2)} BNB</div><div className="s">{d.budget.binding === "cap" ? "Treasury cap binds" : "Dollar budget binds"}</div></div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3 className="d4">Budget</h3><span className="tiny muted">Rule 1</span></div>
            <div className="card-body stack">
              <div className="grid2">
                <div className="stack" style={{ gap: 10 }}>
                  <p className="small muted" style={{ margin: 0 }}>Claiming pays the fixed team wallet and counts as a heartbeat.</p>
                  <button className="btn btn-primary btn-lg" disabled={!isTeam || v.tap.accrued <= 0} onClick={() => void run("claimTap")}><Icon name="coins" size={16} />Claim {bnb(v.tap.accrued, 3)} BNB</button>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  <label className="label" htmlFor="tap" style={{ margin: 0 }}>Lower the tap <span className="hint">now {usd(v.terms.tapUsdPer30d)}</span></label>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="input-group" style={{ flex: 1 }}><input id="tap" className="field mono" inputMode="numeric" value={newTap} onChange={(e) => setNewTap(e.target.value.replace(/[^0-9]/g, ""))} /><span className="unit">USD/30d</span></div>
                    <button className="btn btn-ghost" disabled={!isTeam || ended || !(Number(newTap) < v.terms.tapUsdPer30d)} onClick={() => void run("lowerTap", Number(newTap))}>Lower</button>
                  </div>
                  <p className="help" style={{ margin: 0 }}>Only downwards. Nobody can raise it.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="d4">Tranches</h3><span className="tiny muted">Rule 2 · strict gate</span></div>
            <div className="card-body stack">
              {v.tranches.map((t) => (
                <div key={t.multiple} style={{ display: "grid", gap: 6 }}>
                  <div className="row between small"><span className="ink">{bps(t.bps)} of supply at {multiple(t.multiple)}</span><span className="mono muted">{t.unlocked ? "unlocked" : `${duration(t.progress)} / ${duration(v.terms.unlockWindow)}`}</span></div>
                  <Meter value={t.unlocked ? 1 : t.progress} max={t.unlocked ? 1 : v.terms.unlockWindow} tone={t.unlocked ? "good" : "agent"} label={`${multiple(t.multiple)} tranche`} />
                </div>
              ))}
              <button className="btn btn-ghost" disabled={!v.tranches.some((t) => t.unlocked)} onClick={() => void run("releaseTeam")}>Release unlocked tranches</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="d4">Close honestly</h3><span className="tiny muted">Rule 4</span></div>
            <div className="card-body stack">
              <p className="small muted" style={{ margin: 0 }}>Winding down ends the tap, burns locked team tokens and opens redemption at book with no fee, forever. Tap accrued until now stays claimable.</p>
              {!confirmWind ? (
                <button className="btn btn-ghost" disabled={!isTeam || ended} onClick={() => setConfirmWind(true)}>Wind down…</button>
              ) : (
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn btn-danger" onClick={() => { setConfirmWind(false); void run("windDown"); }}>Yes, wind down for good</button>
                  <button className="btn btn-quiet" onClick={() => setConfirmWind(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h3 className="d4">Stay present</h3><span className="tiny muted">Rule 4</span></div>
            <div className="card-body stack">
              <Meter value={hbUsed} max={v.terms.heartbeat} tone={d.hbLeft <= 0 ? "bad" : undefined} label="Heartbeat window used" />
              <p className="tiny muted" style={{ margin: 0 }}><span className="mono">{duration(hbUsed)}</span> of <span className="mono">{duration(v.terms.heartbeat)}</span> since the last team action. Claiming, lowering the tap and posting a report all count.</p>
              <button className="btn btn-ghost" disabled={!isTeam || ended} onClick={() => void run("heartbeat")}><Icon name="heart" size={16} />Send heartbeat</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="d4">Report</h3><span className="tiny muted">Rule 5 · stretch</span></div>
            <div className="card-body stack">
              <p className="small muted" style={{ margin: 0 }}>Posts the period&apos;s report URI and its hash on-chain.{agent ? " The agent's LLM writes the report from its ledger; it never decides a rule." : ""}</p>
              <button className="btn btn-ghost" disabled={!isTeam || ended} onClick={() => void run("postReport")}><Icon name="doc" size={16} />Post period {v.disclosure.passed + 1} report</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="d4">{agent ? "Route revenue" : "Send revenue"}</h3><span className="chip chip-agent">Raises book value</span></div>
            <div className="card-body stack">
              <p className="small muted" style={{ margin: 0 }}>{agent ? "An agent paid on-chain can send what it earns straight to the vault. Every holder's book value rises with it." : "BNB sent to the vault is recognised as revenue and raises book value for every holder."}</p>
              <div className="row" style={{ gap: 8 }}>
                <div className="input-group" style={{ flex: 1 }}><input className="field mono" inputMode="decimal" value={rev} onChange={(e) => setRev(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Revenue in BNB" /><span className="unit">BNB</span></div>
                <button className="btn btn-primary" disabled={ended || !(Number(rev) > 0)} onClick={() => void run("revenue", Number(rev))}>Send</button>
              </div>
            </div>
          </div>

          {agent ? (
            <Note tone="agent" icon="agent">
              <b>The issuer agent loop.</b> Every few minutes it reads the vault, claims the tap when it has accrued (else sends a heartbeat), cuts its own pay when the price nears book, forwards revenue and posts a report each period. {v.issuer.lastAction ? `Last action: ${v.issuer.lastAction.what.toLowerCase()}, ${relative(v.issuer.lastAction.at, v.now)}.` : ""} If its key leaks, an attacker reaches the accrued tap and nothing else.
            </Note>
          ) : null}
        </div>
      </div>
    </div>
  );
}
