"use client";

/*
 * Ask AI's confirmation cards, as views with plain props (ask-cards.tsx wires them to the wallet, the chain and the
 * chat store). Built on ToolApproval: a transaction card shows the call, every number the model's tool computed
 * (addresses short, with copy and BscScan), the eth_call simulation from the user's wallet, the risks as a callout
 * and the raw call behind a disclosure; the footer has Cancel and Sign in your wallet (or Connect wallet). A covenant
 * draft shows its terms as a summary table with Edit (the Create page, pre-filled).
 */
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Callout, ToolApproval, ToolApprovalCode, type ToolApprovalStatus } from "@/components/agents/tool-approval";
import { TodoList, type TodoItem } from "@/components/agents/todo-list";
import type { CardState } from "@/lib/ai/client";
import type { Proposal } from "@/lib/ai/types";
import { explorerTx } from "@/lib/chain/chains";
import { span } from "@/lib/covenant/time";
import type { Terms } from "@/lib/covenant/types";
import { short } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { ThinkingMark } from "./mark";
import { Addr } from "./ui";

/* ---------- shared bits ---------- */

const ADDRESS = /0x[0-9a-fA-F]{40}\b/g;

/** A fact's text with each address drawn as a short, copyable BscScan link. */
export function FactValue({ text, chainId }: { text: string; chainId: number }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(ADDRESS)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push(<Addr key={m.index} a={m[0]} chainId={chainId} />);
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

function SimValue({ sim }: { sim: Proposal["txs"][number]["simulation"] }) {
  if (sim.ok === true) return <span className="ag-sim is-ok"><Icon name="shieldCheck" size={14} />Succeeds{sim.gas ? <span className="faint"> · gas ≈ {Number(sim.gas).toLocaleString("en-US")}</span> : null}</span>;
  if (sim.ok === false) return <span className="ag-sim is-bad"><Icon name="alert" size={14} />{sim.detail.replace(/^Would revert: /, "Would revert: ")}</span>;
  return <span className="ag-sim"><Icon name="info" size={14} />{sim.detail}</span>;
}

function HashLinks({ hashes, chainId }: { hashes: string[]; chainId: number }) {
  return <>{hashes.map((h) => { const href = explorerTx(chainId, h); return href ? <a key={h} className="mono link" href={href} target="_blank" rel="noreferrer">{short(h, 8, 4)}</a> : <span key={h} className="mono">{short(h, 8, 4)}</span>; })}</>;
}

const STATUS: Record<CardState["status"], ToolApprovalStatus> = { pending: "pending", signing: "approving", submitted: "running", confirmed: "complete", rejected: "denied", cancelled: "denied", error: "error" };

function cardLabels(c: CardState, needsWallet: boolean): Partial<Record<ToolApprovalStatus, string>> {
  return { pending: needsWallet ? "Needs a wallet" : "Needs your signature", approving: "Waiting for wallet", running: "Submitted", complete: "Confirmed", denied: c.status === "rejected" ? "Rejected" : "Cancelled", error: "Failed" };
}

function iconFor(p: Proposal): IconName {
  if (p.kind === "create") return "rocket";
  if (p.kind === "mint_demo_usdc" || p.kind === "pay_agent_usdc" || p.kind === "deposit_revenue") return "coins";
  if (p.kind === "redeem" || p.kind === "claim_refund") return "redeem";
  if (p.kind === "heartbeat" || p.kind === "poke") return "pulse";
  return "wallet";
}

export interface CardActions {
  card: CardState;
  /** the connected wallet, if any */
  account?: string;
  onSign: () => void;
  onCancel: () => void;
  onConnect: () => void;
}

/** The footer every card shares: status on the left, Cancel and the primary action on the right. */
function CardFooter({ p, a, primary, primaryIcon, disabled, disabledWhy, extra }: { p: Proposal; a: CardActions; primary: string; primaryIcon: IconName; disabled?: boolean; disabledWhy?: string; extra?: ReactNode }) {
  const c = a.card;
  if (c.status === "confirmed") {
    return (
      <div className="ag-foot-row">
        <span className="ag-foot-status good"><Icon name="check" size={15} />Confirmed <HashLinks hashes={c.hashes} chainId={p.chainId} /></span>
        {c.launcher ? <Link className="btn btn-secondary btn-sm" href={`/app/c/${c.launcher}/raise`}>Open the raise<Icon name="chevronRight" size={13} /></Link> : null}
      </div>
    );
  }
  if (c.status === "cancelled") return <div className="ag-foot-row"><span className="ag-foot-status">Cancelled. Nothing was sent.</span></div>;
  const busy = c.status === "signing" || c.status === "submitted";
  return (
    <div className="ag-foot-row">
      <span className="ag-foot-status">
        {busy ? <><ThinkingMark size={14} />{c.detail}</> : c.status === "rejected" ? "You rejected it in your wallet. Nothing was sent." : !a.account ? "Connect a wallet to sign this." : "Nothing is sent until you sign."}
      </span>
      <span className="ag-foot-actions">
        {extra}
        {!busy ? <button type="button" className="btn btn-secondary btn-sm" onClick={a.onCancel}>Cancel</button> : null}
        {!a.account ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={a.onConnect}><Icon name="wallet" size={15} />Connect wallet</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || disabled} title={disabledWhy} onClick={a.onSign}>
            {busy ? <><ThinkingMark size={14} />Working</> : <><Icon name={primaryIcon} size={15} />{c.status === "rejected" || c.status === "error" ? "Try again" : primary}</>}
          </button>
        )}
      </span>
    </div>
  );
}

/* ---------- transaction card ---------- */

function stepItems(p: Proposal, c: CardState): TodoItem[] {
  const at = c.status === "signing" || c.status === "submitted" ? c.step : c.status === "confirmed" ? p.txs.length : -1;
  return p.txs.map((t, i) => ({
    id: String(i),
    title: t.description,
    detail: `${t.functionName}() → ${short(t.to)}`,
    status: i < at ? "completed" : i === at ? "in-progress" : "pending",
  }));
}

export function TxCardView({ p, a, wrongSigner }: { p: Proposal; a: CardActions; wrongSigner: boolean }) {
  const c = a.card;
  const fns = p.txs.map((t) => `${t.functionName}()`).join(" then ");
  const named = p.facts.map((f) => f.value.toLowerCase()).join(" ");
  const contracts = [...new Set(p.txs.map((t) => t.to))].filter((x) => !named.includes(x.toLowerCase()));
  const params = [
    ...p.facts.map((f, i) => ({ id: `f${i}`, label: f.label, value: <FactValue text={f.value} chainId={p.chainId} /> })),
    // the contracts called, unless a fact already names them
    ...(contracts.length ? [{ id: "to", label: contracts.length > 1 ? "Contracts" : "Contract", value: <span className="ag-addrs">{contracts.map((x) => <Addr key={x} a={x} chainId={p.chainId} />)}</span> }] : []),
    ...(p.signer ? [{ id: "signer", label: "Signer", value: <Addr a={p.signer} chainId={p.chainId} /> }] : []),
    ...p.txs.map((t, i) => ({ id: `s${i}`, label: p.txs.length > 1 ? `Simulation ${i + 1}` : "Simulation", value: <SimValue sim={t.simulation} /> })),
  ];
  return (
    <ToolApproval
      title={p.title}
      tool={fns}
      description={p.summary}
      icon={iconFor(p)}
      status={STATUS[c.status]}
      labels={cardLabels(c, !a.account)}
      parameters={params}
      footer={<CardFooter p={p} a={a} primary="Sign in your wallet" primaryIcon="wallet" disabled={wrongSigner} disabledWhy={wrongSigner ? "Only the named signer can send this" : undefined} />}
    >
      {p.txs.length > 1 ? <TodoList title="Steps" items={stepItems(p, c)} /> : null}
      {wrongSigner && a.account ? <Callout tone="bad">Only <span className="mono">{short(p.signer!)}</span> can send this; your wallet is <span className="mono">{short(a.account)}</span>.</Callout> : null}
      {p.risks.length ? <Callout tone="warn">{p.risks.length === 1 ? p.risks[0] : <ul>{p.risks.map((r) => <li key={r}>{r}</li>)}</ul>}</Callout> : null}
      {c.status === "error" ? <Callout tone="bad">{c.message}</Callout> : null}
      <ToolApprovalCode code={JSON.stringify(p.txs.map((t) => ({ ...t, simulation: undefined })), null, 2)} />
    </ToolApproval>
  );
}

/* ---------- covenant draft card ---------- */

const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const num = (n: number, d = 4) => n.toLocaleString("en-US", { maximumFractionDigits: d });

function SplitBar({ sale, pool, team }: { sale: number; pool: number; team: number }) {
  return (
    <span className="ag-split">
      <span className="ag-split-bar" aria-hidden="true">
        <span style={{ width: pct(sale), background: "var(--accent)" }} />
        <span style={{ width: pct(pool), background: "var(--good)" }} />
        <span style={{ width: pct(team), background: "var(--agent)" }} />
      </span>
      <span className="ag-split-legend">
        <span><i style={{ background: "var(--accent)" }} />Sale {pct(sale)}</span>
        <span><i style={{ background: "var(--good)" }} />Pool {pct(pool)}</span>
        <span><i style={{ background: "var(--agent)" }} />Team {pct(team)}</span>
      </span>
    </span>
  );
}

export function termsRows(t: Terms, factory: "demo" | "production", chainId: number): { id: string; label: string; value: ReactNode }[] {
  const team = 10_000 - t.saleBps - t.poolBps;
  return [
    { id: "token", label: "Token", value: <><b>{t.name}</b> <span className="mono">{t.symbol}</span><span className="faint"> · {num(t.totalSupply, 0)} supply</span></> },
    { id: "raise", label: "Raise", value: <><b className="num">{num(t.minRaise)}</b> min <span className="faint">→</span> <b className="num">{num(t.cap)}</b> cap BNB</> },
    { id: "split", label: "Split", value: <SplitBar sale={t.saleBps} pool={t.poolBps} team={team} /> },
    { id: "budget", label: "Budget", value: <><b className="num">${num(t.tapUsdPer30d, 0)}</b> per 30 days<span className="faint">, capped at {pct(t.tapCapBps)} of the treasury</span></> },
    { id: "unlocks", label: "Unlocks", value: t.trancheBps.length ? <>{t.trancheBps.map((b, i) => <span key={i} className="ag-chip">{pct(b)} at {(t.trancheMultiple[i] ?? 0) / 100}x</span>)}<span className="faint"> held for {span(t.unlockWindow)}</span></> : <span className="faint">No team tokens</span> },
    { id: "exit", label: "Exit", value: <>{span(t.exitStreak)} below book opens a redemption round of {span(t.roundLength)}<span className="faint">, {pct(t.exitFeeBps)} fee</span></> },
    { id: "timing", label: "Timing", value: <>Sale {span(t.saleDuration)} · heartbeat {span(t.heartbeat)}<span className="faint"> · {factory === "demo" ? "demo timers" : "production timers"}</span></> },
    { id: "issuer", label: "Issuer", value: <>{t.agentId > 0 ? `ERC-8004 agent #${t.agentId}` : "Human team"} <Addr a={t.teamWallet} chainId={chainId} /></> },
  ];
}

export function CreateCardView({ p, a, editHref }: { p: Proposal; a: CardActions; editHref: string }) {
  const d = p.create!;
  const problems = d.problems ?? (d.checkTerms ? [d.checkTerms] : []);
  const invalid = d.checkTerms !== null;
  const c = a.card;
  return (
    <ToolApproval
      title={p.title}
      tool={`Portal.newLauncher · ${d.factory} factory`}
      description={invalid ? "This draft has problems to fix before it can be created." : "The terms pass the factory's own check. Your browser mines a token address ending in 7777, then you sign."}
      icon="rocket"
      status={invalid && c.status === "pending" ? "error" : STATUS[c.status]}
      labels={{ ...cardLabels(c, !a.account), ...(invalid && c.status === "pending" ? { error: "Needs changes" } : {}) }}
      parameters={termsRows(d.terms, d.factory, p.chainId)}
      footer={<CardFooter p={p} a={a} primary="Mine salt and create" primaryIcon="rocket" disabled={invalid} disabledWhy={invalid ? "Fix the draft's problems first" : undefined}
        extra={<Link className="btn btn-ghost btn-sm" href={editHref}><Icon name="sliders" size={14} />Edit</Link>} />}
    >
      {problems.length ? <Callout tone="bad">{problems.length === 1 ? problems[0] : <ul>{problems.map((x) => <li key={x}>{x}</li>)}</ul>}</Callout> : null}
      {p.risks.length ? <Callout tone="warn">{p.risks.length === 1 ? p.risks[0] : <ul>{p.risks.map((r) => <li key={r}>{r}</li>)}</ul>}</Callout> : null}
      {c.status === "error" ? <Callout tone="bad">{c.message}</Callout> : null}
      <ToolApprovalCode label="Show raw terms" openLabel="Hide raw terms" code={JSON.stringify({ factory: d.factory, terms: d.terms }, null, 2)} />
    </ToolApproval>
  );
}

