"use client";

/*
 * Two cards for a covenant's issuer, read from the chain only (they work on the hosted site with no server):
 * - AgentDecisions: the issuer agent's decision log. Each decision it acted on is a ReportPosted data URI holding the
 *   action, its reasoning, who decided (the model or the fixed rule) and the numbers it read, checked against the hash
 *   posted with it; tap claims, tap cuts, heartbeats and revenue deposits are merged in from the vault's events.
 * - AgentEconomy: the agent's dollar revenue in test USDT (test funds) beside its BNB treasury, and a button to pay it
 *   for a service. USDT never enters the vault: treasuries are BNB because Flap's pools are BNB-quoted.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWallet } from "@/components/providers";
import { explorerTx } from "@/lib/chain/chains";
import { readDecisions, type TimelineEntry } from "@/lib/chain/decisions";
import { relative } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { useSource } from "@/lib/data/hooks";
import { useDemoUsdc, useUsdcRevenue, useUsdcWrite } from "@/lib/data/usdc";
import { short } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { ThinkingMark } from "./mark";
import { cx } from "./ui";

const ACTION: Record<string, { label: string; icon: IconName; tone: string }> = {
  claim_tap: { label: "Claimed the tap", icon: "coins", tone: "agent" },
  lower_tap: { label: "Cut its own pay", icon: "trendDown", tone: "good" },
  heartbeat: { label: "Heartbeat", icon: "heart", tone: "" },
  wait: { label: "Waited", icon: "clock", tone: "" },
};
const EVENT: Record<string, { label: string; icon: IconName }> = {
  TapClaimed: { label: "Tap claimed", icon: "coins" }, TapLowered: { label: "Tap lowered", icon: "trendDown" },
  Heartbeat: { label: "Heartbeat", icon: "heart" }, RevenueDeposited: { label: "Revenue deposited", icon: "vault" },
};

function TxLink({ chainId, hash }: { chainId: number; hash: string }) {
  const href = explorerTx(chainId, hash);
  return href ? <a className="mono link t-xs" href={href} target="_blank" rel="noreferrer">{short(hash, 8, 4)}</a> : <span className="mono t-xs faint">{short(hash, 8, 4)}</span>;
}

const num = (v: unknown, d = 4) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: d }) : null);

function Inputs({ inputs }: { inputs: Record<string, unknown> }) {
  const rows = [
    ["Treasury", num(inputs.treasuryBnb) && `${num(inputs.treasuryBnb)} BNB`],
    ["Pool vs book", typeof inputs.premiumToBookPct === "number" ? `${inputs.premiumToBookPct > 0 ? "+" : ""}${num(inputs.premiumToBookPct, 1)}%` : null],
    ["Tap accrued", num(inputs.tapAccruedBnb, 6) && `${num(inputs.tapAccruedBnb, 6)} BNB`],
    ["Tap", num(inputs.tapUsdPer30d, 0) && `$${num(inputs.tapUsdPer30d, 0)}/30d`],
    ["Last beat", typeof inputs.heartbeatAgeSeconds === "number" && inputs.heartbeatAgeSeconds >= 0 ? `${Math.round(inputs.heartbeatAgeSeconds)}s ago` : null],
    ["USDT in", typeof inputs.usdcRevenue === "number" && inputs.usdcRevenue > 0 ? `${num(inputs.usdcRevenue, 2)}` : null],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  if (!rows.length) return null;
  return <div className="dec-inputs">{rows.map(([k, v]) => <span key={k}><span className="faint">{k}</span> {v}</span>)}</div>;
}

function Row({ e, chainId, now }: { e: TimelineEntry; chainId: number; now: number }) {
  if (e.type === "decision") {
    const parts = e.record.action.split("+");
    const main = ACTION[parts[0]!] ?? { label: e.record.action, icon: "sparkle" as IconName, tone: "agent" };
    return (
      <li className="dec">
        <span className={cx("feed-ic", main.tone)}><Icon name={main.icon} size={14} /></span>
        <div className="dec-body">
          <div className="row between wrap-ok" style={{ gap: 8 }}>
            <span className="ev">{parts.map((p) => ACTION[p]?.label ?? p).join(", ")}</span>
            <span className="t-xs faint w5" style={{ whiteSpace: "nowrap" }}>{relative(e.at, now)}</span>
          </div>
          <blockquote className="dec-reason" title="Written by the agent; posted on-chain">{e.record.reason}</blockquote>
          <Inputs inputs={e.record.inputs} />
          <div className="row wrap-ok" style={{ gap: 8 }}>
            <span className={cx("badge", e.record.author.kind === "llm" ? "agent" : "plain")}>{e.record.author.kind === "llm" ? `Decided by ${e.record.author.model}` : `Fixed rule: ${e.record.author.why}`}</span>
            <span className={cx("badge", e.verified ? "good" : "warn")} title="keccak256 of the record equals the hash posted with it">{e.verified ? <><Icon name="shieldCheck" size={12} />Hash verified</> : <><Icon name="alert" size={12} />Hash mismatch</>}</span>
            <TxLink chainId={chainId} hash={e.tx} />
          </div>
        </div>
      </li>
    );
  }
  if (e.type === "report") {
    return (
      <li className="dec">
        <span className="feed-ic"><Icon name="doc" size={14} /></span>
        <div className="dec-body">
          <div className="row between" style={{ gap: 8 }}><span className="ev">Period {e.period} report</span><span className="t-xs faint w5">{relative(e.at, now)}</span></div>
          {e.text ? <details><summary className="t-xs muted">Read it ({e.verified ? "hash verified" : "hash mismatch"})</summary><pre className="ai-raw">{e.text.slice(0, 4000)}</pre></details>
            : /^https?:\/\//.test(e.uri) ? <a className="tlink t-xs" href={e.uri} target="_blank" rel="noreferrer">Hosted by the issuer<Icon name="arrowUpRight" size={12} /></a> : <span className="t-xs faint mono">{e.uri.slice(0, 60)}</span>}
          <TxLink chainId={chainId} hash={e.tx} />
        </div>
      </li>
    );
  }
  const ev = EVENT[e.name]!;
  return (
    <li className="dec small">
      <span className="feed-ic"><Icon name={ev.icon} size={13} /></span>
      <div className="dec-body"><div className="row between" style={{ gap: 8 }}><span className="t-s ink2 w5">{ev.label} <span className="t-xs muted">{e.detail}</span></span><span className="row" style={{ gap: 8 }}><TxLink chainId={chainId} hash={e.tx} /><span className="t-xs faint w5">{relative(e.at, now)}</span></span></div></div>
    </li>
  );
}

export function AgentDecisions({ v, limit = 12 }: { v: CovenantView; limit?: number }) {
  const src = useSource();
  const q = useQuery({
    queryKey: ["decisions", src.chainId, v.vault],
    enabled: src.mode === "live" && Boolean(v.vault),
    refetchInterval: 15_000,
    queryFn: () => readDecisions(src.client!, src.payload!, v.vault!, 60),
  });
  const rows = q.data ?? [];
  const decisions = rows.filter((r) => r.type === "decision").length;
  return (
    <div className="card" id="decisions">
      <div className="card-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="h-card">Agent decisions</h3>
          <p className="t-xs muted w5">{v.issuer.kind === "agent" ? "What the issuer agent decided and why, posted on-chain with a hash" : "Team actions on the vault, from its events"}</p>
        </div>
        {decisions ? <span className="badge agent">{decisions} on-chain</span> : null}
      </div>
      {q.isLoading ? <p className="loading-line" style={{ padding: "0 22px 18px" }}><ThinkingMark size={15} />Reading the vault&apos;s reports…</p>
        : q.isError ? <p className="t-s muted w5" style={{ padding: "0 22px 18px" }}>The vault&apos;s logs could not be read just now.</p>
        : rows.length === 0 ? <p className="t-s muted w5" style={{ padding: "0 22px 18px" }}>No decisions or team actions on-chain yet. An issuer agent running <span className="mono">pnpm --dir server issuer</span> posts one each time it claims, cuts its pay or sends a heartbeat.</p>
        : <ol className="dec-list">{rows.slice(0, limit).map((e, i) => <Row key={`${e.tx}-${i}`} e={e} chainId={v.chainId ?? src.chainId ?? 97} now={v.now} />)}</ol>}
    </div>
  );
}

export function AgentEconomy({ v }: { v: CovenantView }) {
  const wallet = useWallet();
  const rev = useUsdcRevenue(v.issuer.teamWallet);
  const mine = useDemoUsdc(wallet.address);
  const w = useUsdcWrite();
  const [amount, setAmount] = useState("25");
  if (!w.token) return null;
  const who = v.issuer.kind === "agent" ? `Agent #${v.issuer.agentId}` : "The team";
  const amt = Number(amount);
  const balance = mine.data?.deployed ? mine.data.balance : 0;
  return (
    <div className="card" id="agent-economy">
      <div className="card-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="h-card">Agent revenue</h3>
          <p className="t-xs muted w5">{who} sells its service for test USDT (test funds)</p>
        </div>
        <span className="badge plain">USDT</span>
      </div>
      <div style={{ padding: "0 22px 18px", display: "grid", gap: 12 }}>
        <dl className="kv">
          <dt>Paid by customers</dt><dd>{rev.data ? `${rev.data.total.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT in ${rev.data.payments} payment${rev.data.payments === 1 ? "" : "s"}` : rev.isLoading ? "…" : "–"}</dd>
          <dt>In the agent wallet</dt><dd>{rev.data ? `${rev.data.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT` : "–"}</dd>
          <dt>Treasury (BNB)</dt><dd>{v.treasury.toLocaleString("en-US", { maximumFractionDigits: 4 })} BNB</dd>
        </dl>
        <p className="t-xs muted w5">The treasury stays BNB because Flap&apos;s pools are BNB-quoted; USDT goes to the agent&apos;s wallet, never into the vault. A USDC-quoted treasury is on the roadmap.</p>
        <div className="row wrap-ok" style={{ gap: 8 }}>
          <input className="field mono" style={{ width: 96 }} inputMode="decimal" value={amount} aria-label="USDT to pay" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          <button className="btn btn-primary btn-sm" disabled={w.busy || !(amt > 0) || (Boolean(wallet.address) && amt > balance)} onClick={() => void w.run({ kind: "pay", to: v.issuer.teamWallet, amount: amt })}>
            {w.busy ? <><ThinkingMark size={14} />Paying…</> : !wallet.address ? <><Icon name="wallet" size={14} />Connect to pay</> : <><Icon name="send" size={14} />Pay {amt > 0 ? amt : ""} USDT for a service</>}
          </button>
          {wallet.address && mine.data?.deployed && balance < Math.max(amt, 1) ? <button className="btn btn-secondary btn-sm" disabled={w.busy || mine.data.nextAt > 0} onClick={() => void w.run({ kind: "mint" })}><Icon name="drop" size={14} />{mine.data.nextAt > 0 ? "Minted today" : "Mint 1,000 test USDT"}</button> : null}
        </div>
        {wallet.address && mine.data?.deployed ? <p className="t-xs faint w5">Your wallet: {balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT</p> : null}
        {w.hash ? <p className="t-xs good w5"><Icon name="check" size={12} /> Sent <TxLink chainId={v.chainId ?? 97} hash={w.hash} /></p> : null}
        {w.error ? <p className="t-xs warn w5">{w.error}</p> : null}
      </div>
    </div>
  );
}
