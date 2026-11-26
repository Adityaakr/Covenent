"use client";

/*
 * Ask AI: a chat with Claude that reads the chain and drafts transactions. Answers stream in; each action the model
 * proposes arrives as a confirmation card (what it does, the numbers, the risks, an eth_call simulation from your
 * wallet). Nothing is signed anywhere but your own wallet, and only after you press Sign on the card. Before sending,
 * the card simulates each step again on the current block and refuses one that would revert.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import type { Address, Hash, Hex } from "viem";
import { useWallet } from "@/components/providers";
import { ask, note, reset, stop, useAskAI, type ChatItem } from "@/lib/ai/client";
import type { Proposal } from "@/lib/ai/types";
import { explorerTx } from "@/lib/chain/chains";
import { createCovenantLive, createTargets } from "@/lib/chain/create";
import { addressOf } from "@/lib/chain/deployment";
import type { MineMessage } from "@/lib/chain/salt";
import { FLAP } from "@/lib/covenant/defaults";
import { useSource } from "@/lib/data/hooks";
import { short } from "@/lib/format";
import { Icon } from "./icons";
import { ThinkingMark } from "./mark";
import { cx } from "./ui";

const SUGGEST = [
  "Raise 3 BNB for my GPU agent with a 4% monthly budget",
  "Which covenants trade under book value?",
  "Should I redeem my tokens?",
  "Commit 0.01 BNB to the open raise",
  "Mint me some test USDT",
  "What has the issuer agent been doing?",
];

const TOOL_LABEL: Record<string, string> = {
  list_covenants: "Listing covenants", get_covenant: "Reading the covenant", get_my_positions: "Reading your positions", get_wallet: "Reading your wallet",
  quote_redeem: "Quoting a redemption", flap_floor: "Checking Flap's floor", get_agent_decisions: "Reading the agent's decisions", draft_covenant: "Drafting the covenant",
  commit: "Building the commitment", finalize: "Building finalize", claim_tokens: "Building the claim", claim_refund: "Building the refund", redeem: "Building the redemption",
  poke: "Building a poke", deposit_revenue: "Building the deposit", claim_tap: "Building the tap claim", heartbeat: "Building a heartbeat", lower_tap: "Building the tap cut",
  mint_demo_usdc: "Building the USDT mint", pay_agent_usdc: "Building the agent payment",
};

function useAskStatus() {
  return useQuery({
    queryKey: ["ask-status"], staleTime: 60_000,
    queryFn: async () => (await (await fetch("/api/ask", { cache: "no-store" })).json()) as { configured: boolean; model: string | null; reason: string | null },
  });
}

/** Plain text with **bold** and line breaks; nothing from the model is rendered as HTML. */
function Prose({ text }: { text: string }) {
  return (
    <div className="bubble ai-prose">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{para.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((s, j) => s.startsWith("**") && s.endsWith("**") ? <b key={j}>{s.slice(2, -2)}</b> : s.startsWith("`") && s.endsWith("`") ? <code key={j}>{s.slice(1, -1)}</code> : s.split("\n").map((l, k, all) => <span key={`${j}-${k}`}>{l}{k < all.length - 1 ? <br /> : null}</span>))}</p>
      ))}
    </div>
  );
}

export function AskAI({ initial }: { initial?: string }) {
  const s = useAskAI();
  const status = useAskStatus();
  const wallet = useWallet();
  const src = useSource();
  const [q, setQ] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);
  const configured = status.data?.configured === true;

  useEffect(() => {
    if (initial && configured && !sentInitial.current && !s.busy) { sentInitial.current = true; void ask(initial, wallet.address); }
  }, [initial, configured, s.busy, wallet.address]);
  useEffect(() => { const el = log.current; if (el) el.scrollTop = el.scrollHeight; }, [s.items]);

  const submit = (e?: FormEvent, text = q) => { e?.preventDefault(); if (!text.trim() || !configured) return; void ask(text, wallet.address); setQ(""); };

  return (
    <section className="chat ask-ai" aria-label="Ask AI">
      <div className="chat-head">
        <span className="icon-tile sm accent"><Icon name="sparkle" size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="t-s ink w5 trunc">Ask AI</div>
          <div className="t-xs muted w5 trunc">{status.data?.model ? `${status.data.model} · reads ${src.chainId === 97 || !src.chainId ? "BNB testnet" : `chain ${src.chainId}`} · drafts transactions you sign` : "Reads the chain and drafts transactions you sign"}</div>
        </div>
        {s.items.length ? <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={reset}><Icon name="refresh" size={14} />New chat</button> : null}
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {s.items.length === 0 ? (
          <div className="chat-hello">
            <span className="icon-tile accent"><Icon name="sparkle" size={22} /></span>
            <h3>Say what you want in plain words.</h3>
            <p className="t-s muted w5" style={{ maxWidth: 520 }}>Ask AI reads covenants, positions and agent decisions from the chain, drafts a covenant or a transaction, simulates it from your wallet and shows you a card. You sign in your own wallet, or you don&apos;t: it never holds a key.</p>
            {status.isLoading ? null : !configured ? <div className="note warn" style={{ maxWidth: 520, textAlign: "left" }}><Icon name="alert" size={16} /><span>{status.data?.reason ?? "Ask AI is not configured on this site."} The rest of the app works without it.</span></div> : null}
            {!wallet.address && configured ? <p className="t-xs muted w5">Connect a wallet for answers about your positions and to simulate from your address.</p> : null}
          </div>
        ) : null}
        {s.items.map((m) => <Item key={m.id} m={m} />)}
      </div>
      {s.items.length === 0 && configured ? <div className="sugg" style={{ padding: "0 16px 10px" }}>{SUGGEST.map((x) => <button key={x} type="button" onClick={() => submit(undefined, x)}>{x}</button>)}</div> : null}
      <form className="prompt" onSubmit={submit}>
        <Icon name="sparkle" size={16} style={{ color: "var(--faint)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={2000} disabled={!configured} placeholder={configured ? "Raise, commit, redeem, explain… in plain words" : "Ask AI is not configured on this site"} aria-label="Ask AI" />
        {s.busy ? <button className="send" type="button" onClick={stop} aria-label="Stop"><Icon name="x" size={16} /></button>
          : <button className="send" type="submit" disabled={!q.trim() || !configured} aria-label="Send"><Icon name="send" size={16} /></button>}
      </form>
      <p className="prompt-note">Answers can be wrong: every card shows the raw call and a fresh simulation before you sign.</p>
    </section>
  );
}

function Item({ m }: { m: ChatItem }) {
  if (m.kind === "user") return <div className="msg me"><div className="bubble">{m.text}</div></div>;
  return (
    <div className="msg">
      <span className="msg-av cov"><Icon name="sparkle" size={14} /></span>
      <div className="msg-body" style={{ display: "grid", gap: 8 }}>
        <div className="msg-meta"><b>Ask AI</b>{m.pending ? <span>working</span> : null}</div>
        {m.tools.length ? (
          <div className="ai-tools">
            {m.tools.map((t) => (
              <span key={t.id} className={cx("toolcall", t.ok === false && "bad")} title={t.summary}>
                {t.ok === undefined ? <ThinkingMark size={11} /> : <Icon name={t.ok ? "check" : "alert"} size={11} />}{TOOL_LABEL[t.name] ?? t.name}{t.summary && t.ok !== undefined ? <span className="faint"> · {t.summary}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        {m.text ? <Prose text={m.text} /> : m.pending && !m.tools.length ? <span className="loading-line" style={{ padding: "4px 0" }}><ThinkingMark size={16} label="Thinking" />Thinking…</span> : null}
        {m.proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
        {m.error ? <div className="note warn"><Icon name="alert" size={16} /><span>{m.error}</span></div> : null}
      </div>
    </div>
  );
}

type Step = { state: "idle" } | { state: "busy"; i: number; detail: string } | { state: "done"; hashes: Hash[]; launcher?: Address } | { state: "error"; message: string };

const toB64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

const errText = (e: unknown) => {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  return /User rejected|denied/i.test(m) ? "You rejected the request in your wallet." : m.split("\n")[0]!.slice(0, 220);
};

export function ProposalCard({ p }: { p: Proposal }) {
  const wallet = useWallet();
  const src = useSource();
  const config = useConfig();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>({ state: "idle" });
  const [showRaw, setShowRaw] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);

  const wrongSigner = Boolean(p.signer && wallet.address && p.signer.toLowerCase() !== wallet.address.toLowerCase() && p.kind !== "create");
  const failedSim = p.txs.find((t) => t.simulation.ok === false);
  const invalidDraft = p.kind === "create" && p.create?.checkTerms !== null;
  const explorer = (h: string) => explorerTx(p.chainId, h);

  async function mineSalt(): Promise<Hex> {
    const d = src.payload!.deployment!;
    const portal = addressOf(d, "portal", "flapPortal", "mockPortal") || FLAP.portal;
    const impl = addressOf(d, "taxTokenImpl", "taxTokenImplementation", "tokenImpl") || FLAP.taxTokenImpl;
    return new Promise((resolve, reject) => {
      worker.current?.terminate();
      const w = new Worker(new URL("../../lib/chain/salt.worker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      w.onerror = () => reject(new Error("The salt miner failed to start"));
      w.onmessage = (e: MessageEvent<MineMessage>) => {
        if (e.data.type === "progress") setStep({ state: "busy", i: 0, detail: `Mining a token address ending in 7777: ${e.data.tries.toLocaleString("en-US")} tries` });
        else { w.terminate(); resolve(e.data.salt); }
      };
      w.postMessage({ deployer: portal, implementation: impl, seed: String(BigInt(Date.now()) * 1_000_003n), suffix: "7777" });
    });
  }

  async function sign() {
    if (!wallet.address) { wallet.connect(); return; }
    if (src.mode !== "live" || !src.client || !src.payload?.deployment) { setStep({ state: "error", message: `Not connected to the chain: ${src.reason}` }); return; }
    if (src.chainId !== p.chainId) { setStep({ state: "error", message: `This card is for chain ${p.chainId}; the app reads chain ${src.chainId}.` }); return; }
    try {
      if (p.kind === "create" && p.create) {
        const salt = await mineSalt();
        setStep({ state: "busy", i: 0, detail: "Confirm Portal.newLauncher in your wallet" });
        const tg = createTargets(src.payload, p.create.factory);
        const { hash, launcher } = await createCovenantLive(config, src.client, p.chainId, tg, p.create.terms, salt);
        note(`Signed and sent "${p.title}": ${hash} (success${launcher ? `, launcher ${launcher}` : ""})`);
        await qc.invalidateQueries({ queryKey: ["source"] });
        setStep({ state: "done", hashes: [hash], launcher });
        return;
      }
      const hashes: Hash[] = [];
      for (let i = 0; i < p.txs.length; i++) {
        const tx = p.txs[i]!;
        // simulate again on the current block, from the wallet that will sign
        setStep({ state: "busy", i, detail: `Simulating step ${i + 1} of ${p.txs.length}` });
        try {
          await src.client.call({ account: wallet.address as Address, to: tx.to, data: tx.data, value: BigInt(tx.value), ...(tx.gas ? { gas: BigInt(tx.gas) } : {}) });
        } catch (e) {
          throw new Error(`Step ${i + 1} (${tx.functionName}) would revert now, so it was not sent: ${errText(e)}`);
        }
        setStep({ state: "busy", i, detail: `Confirm ${tx.functionName} in your wallet${p.txs.length > 1 ? ` (step ${i + 1} of ${p.txs.length})` : ""}` });
        const hash = await sendTransaction(config, { to: tx.to, data: tx.data, value: BigInt(tx.value), chainId: p.chainId, ...(tx.gas ? { gas: BigInt(tx.gas) } : {}) });
        setStep({ state: "busy", i, detail: "Waiting for the block" });
        const rc = await waitForTransactionReceipt(config, { hash, chainId: p.chainId });
        if (rc.status !== "success") throw new Error(`${tx.functionName} reverted in block ${rc.blockNumber}`);
        hashes.push(hash);
      }
      note(`Signed and sent "${p.title}": ${hashes.join(", ")} (success)`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["covenants"] }), qc.invalidateQueries({ queryKey: ["native-balance"] }), qc.invalidateQueries({ queryKey: ["usdc"] })]);
      setStep({ state: "done", hashes });
    } catch (e) {
      const message = errText(e);
      note(`"${p.title}" was not completed: ${message}`);
      setStep({ state: "error", message });
    }
  }

  const draftHref = p.create ? `/app/create?draft=${encodeURIComponent(toB64(JSON.stringify({ factory: p.create.factory, terms: p.create.terms })))}` : null;

  return (
    <article className="ai-card rise" aria-label={p.title}>
      <header className="ai-card-head">
        <span className="icon-tile sm accent"><Icon name={p.kind === "create" ? "rocket" : p.kind === "mint_demo_usdc" || p.kind === "pay_agent_usdc" ? "coins" : "wallet"} size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <h4 className="h-card trunc" style={{ fontSize: 16 }}>{p.title}</h4>
          <p className="t-xs muted w5">{p.summary}</p>
        </div>
        <span className="badge plain" style={{ marginLeft: "auto" }}>Unsigned</span>
      </header>
      <dl className="kv kv-wide ai-facts">
        {p.facts.map((f) => <div key={f.label} style={{ display: "contents" }}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
      </dl>
      {p.risks.length ? <ul className="ai-risks">{p.risks.map((r) => <li key={r}><Icon name="alert" size={13} /><span>{r}</span></li>)}</ul> : null}
      {p.txs.length ? (
        <div className="ai-sims">
          {p.txs.map((t, i) => (
            <div key={i} className={cx("ai-sim", t.simulation.ok === true ? "good" : t.simulation.ok === false ? "bad" : "")}>
              <Icon name={t.simulation.ok === true ? "shieldCheck" : t.simulation.ok === false ? "alert" : "info"} size={14} />
              <span><b className="mono">{t.functionName}</b> to <span className="mono">{short(t.to)}</span>{BigInt(t.value) > 0n ? <> with <b>{(Number(BigInt(t.value)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })} BNB</b></> : null}: {t.simulation.detail}{t.simulation.gas ? ` Gas about ${Number(t.simulation.gas).toLocaleString("en-US")}.` : ""}</span>
            </div>
          ))}
        </div>
      ) : null}
      {wrongSigner ? <div className="note warn"><Icon name="alert" size={16} /><span>Only <span className="mono">{short(p.signer!)}</span> can send this; your wallet is <span className="mono">{short(wallet.address!)}</span>.</span></div> : null}
      {showRaw ? <pre className="ai-raw mono">{JSON.stringify(p.kind === "create" ? p.create : p.txs.map((t) => ({ ...t, simulation: undefined })), null, 2)}</pre> : null}
      <footer className="ai-card-foot">
        <button className="tlink" type="button" onClick={() => setShowRaw(!showRaw)}>{showRaw ? "Hide" : "Show"} the raw {p.kind === "create" ? "terms" : "call"}</button>
        {draftHref ? <Link className="tlink" href={draftHref}>Edit in Create<Icon name="chevronRight" size={13} /></Link> : null}
        <span style={{ flex: 1 }} />
        {step.state === "done" ? (
          <span className="ai-done"><Icon name="check" size={15} />Confirmed{step.hashes.map((h) => { const href = explorer(h); return href ? <a key={h} className="mono link" href={href} target="_blank" rel="noreferrer">{short(h, 8, 4)}</a> : <span key={h} className="mono">{short(h, 8, 4)}</span>; })}{step.launcher ? <Link className="tlink" href={`/app/c/${step.launcher}/raise`}>Open the raise<Icon name="chevronRight" size={13} /></Link> : null}</span>
        ) : (
          <button className="btn btn-primary" type="button" disabled={step.state === "busy" || wrongSigner || invalidDraft} onClick={() => void sign()}
            title={invalidDraft ? "Fix the draft's problems first" : failedSim ? "The simulation reverted; the card will simulate again before sending" : undefined}>
            {step.state === "busy" ? <><ThinkingMark size={15} />{step.detail}</> : !wallet.address ? <><Icon name="wallet" size={15} />Connect to sign</> : p.kind === "create" ? <><Icon name="rocket" size={15} />Mine salt and create</> : <><Icon name="wallet" size={15} />Sign in your wallet</>}
          </button>
        )}
      </footer>
      {step.state === "error" ? <div className="note warn"><Icon name="alert" size={16} /><span>{step.message}</span></div> : null}
    </article>
  );
}
