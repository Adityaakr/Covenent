"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CovenantView } from "@/lib/covenant/types";
import { relative } from "@/lib/covenant/time";
import { useAsk } from "@/lib/data/ask";
import { eventStyle } from "./covenant";
import { Icon } from "./icons";
import { cx } from "./ui";

/** Issuer-side events the agent itself causes, streamed oldest first like a chat log. */
const AGENT_EVENTS = new Set(["TapClaimed", "Heartbeat", "ReportPosted", "TapLowered", "RevenueRecognized", "TrancheUnlocked", "OutcomeRecorded", "WoundDown"]);

const SUGGEST = (sym: string) => [
  `What is ${sym}'s book value?`,
  "What do 6,000,000 tokens redeem for?",
  "When can an exit round open?",
  "Show the agent's track record",
  "How long is the runway?",
];

/**
 * The agent console in a chat layout: the issuer agent's own actions stream in as messages (heartbeats, tap
 * claims, pay cuts, reports, revenue), and the prompt asks Covenant about the vault through the MCP read tools.
 */
export function AgentChat({ v, all }: { v: CovenantView; all: CovenantView[] }) {
  const name = v.issuer.name ?? (v.issuer.kind === "agent" ? `Agent #${v.issuer.agentId}` : "The team");
  const stream = v.events.filter((e) => AGENT_EVENTS.has(e.name)).slice(0, 8).reverse();
  const { turns, ask, busy } = useAsk(v, all);
  const [q, setQ] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const live = v.state !== "WIND_DOWN" && v.state !== "FAILED";

  useEffect(() => {
    const el = log.current;
    if (el && turns.length) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const submit = (e?: FormEvent) => { e?.preventDefault(); if (!q.trim()) return; void ask(q); setQ(""); };

  return (
    <section className="chat" aria-label={`${name} console`}>
      <div className="chat-head">
        <span className="icon-tile sm agent"><Icon name="chat" size={15} /></span>
        <div style={{ minWidth: 0 }}><div className="t-s ink w5 trunc">Activity and Ask Covenant</div><div className="t-xs muted w5">The issuer loop&apos;s actions, and answers from the MCP read tools</div></div>
        <span className={cx("badge", live ? "good" : "bad")} style={{ marginLeft: "auto" }}><span className={cx("dot", live && "pulse")} />{live ? "Live" : "Stopped"}</span>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        <div className="chat-hello">
          <span className="icon-tile agent"><Icon name="sparkle" size={22} /></span>
          <h3>{live ? `${name} is live.` : `${name} has stopped.`}</h3>
          <p className="t-s muted w5" style={{ maxWidth: 440 }}>Its actions on the vault stream here. Ask Covenant anything about this covenant: answers come from the same read tools the MCP server gives other agents.</p>
        </div>
        {stream.map((e, i) => {
          const s = eventStyle(e.name);
          return (
            <div key={`${e.at}-${i}`} className="msg" style={{ animationDelay: `${i * 40}ms` }}>
              <span className={cx("msg-av", s.tone || "agent")}><Icon name={s.icon} size={14} /></span>
              <div className="msg-body">
                <div className="msg-meta"><b>{name}</b><span>{e.name.replace(/([a-z])([A-Z])/g, "$1 $2")}</span><span>·</span><span>{relative(e.at, v.now)}</span></div>
                <div className="bubble">{e.detail}</div>
              </div>
            </div>
          );
        })}
        {v.issuer.lastAction ? (
          <div className="msg">
            <span className="msg-av agent"><Icon name="pulse" size={14} /></span>
            <div className="msg-body"><div className="msg-meta"><b>{name}</b><span>Loop status</span><span>·</span><span>{relative(v.issuer.lastAction.at, v.now)}</span></div><div className="bubble">Last action: <b>{v.issuer.lastAction.what}</b>. Every few minutes it reads the vault, claims the tap when it has accrued (else sends a heartbeat), cuts its own pay near book and forwards revenue.</div></div>
          </div>
        ) : null}
        {turns.map((m) => m.role === "user" ? (
          <div key={m.id} className="msg me"><div className="bubble">{m.text}</div></div>
        ) : (
          <div key={m.id} className="msg">
            <span className="msg-av cov"><Icon name="shieldCheck" size={14} /></span>
            <div className="msg-body">
              <div className="msg-meta"><b>Covenant</b>{m.tool ? <span className="toolcall" title={m.source === "server" ? "Answered by the Covenant server" : "Computed from the vault reads on this page"}><Icon name="bolt" size={11} />{m.tool}</span> : null}</div>
              {m.pending ? <span className="typing" aria-label="Thinking"><i /><i /><i /></span> : <div className="bubble">{m.text}</div>}
            </div>
          </div>
        ))}
      </div>
      {turns.length === 0 ? <div className="sugg" style={{ padding: "0 16px 6px" }}>{SUGGEST(v.terms.symbol).map((s) => <button key={s} type="button" onClick={() => void ask(s)}>{s}</button>)}</div> : null}
      <form className="prompt" onSubmit={submit}>
        <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask Covenant about ${v.terms.symbol}…`} aria-label="Ask Covenant" />
        <span className="tools"><Icon name="bolt" size={12} />MCP read tools</span>
        <button className="send" type="submit" disabled={busy || !q.trim()} aria-label="Send"><Icon name="send" size={16} /></button>
      </form>
      <p className="prompt-note">Read-only. Covenant never signs: write tools return unsigned transactions for your wallet.</p>
    </section>
  );
}
