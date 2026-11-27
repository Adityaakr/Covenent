"use client";

/*
 * Covenant AI: a chat with Claude that reads the chain and drafts transactions, laid out on beUI's chat-app pattern
 * (components/agents). A header with the model and a status pill; recent chats in a collapsible sidebar (this
 * browser only); the conversation in a MessageScroller; a PromptInput with suggestion chips and Stop.
 *
 * Each answer shows, in order: a shimmering "Thinking…" until the first step, an activity log of the tools it ran
 * (one row per tool, repeats folded with a count), the answer as Markdown, then any structured UI the model asked
 * for: a choice card the user clicks (the click is their next message), a Connect wallet button when a tool needed
 * one, and confirmation cards for transactions and covenant drafts. Nothing is signed anywhere but the user's own
 * wallet, after they press Sign on a card.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgentActivity } from "@/components/agents/agent-activity";
import { ApprovalCard } from "@/components/agents/approval-card";
import { ChatApp, ChatSidebarTrigger, useChatSidebar } from "@/components/agents/chat-app";
import { Message, MessageAvatar, MessageBubble, MessageBubbleContent, MessageContent, MessageGroup, MessageHeader, messageTime } from "@/components/agents/message";
import { MessageScroller } from "@/components/agents/message-scroller";
import { PromptInput } from "@/components/agents/prompt-input";
import { StreamingResponse } from "@/components/agents/streaming-response";
import { ThinkingShimmer } from "@/components/agents/thinking-shimmer";
import { Callout } from "@/components/agents/tool-approval";
import { useWallet } from "@/components/providers";
import { activeLabel, activityRows, doneIn, type ActivityRow } from "@/lib/ai/activity";
import { ask, deleteChat, openChat, pick, reset, stop, useAskAI, useAskHistory, type AiItem, type ChatItem } from "@/lib/ai/client";
import { useSource } from "@/lib/data/hooks";
import { ProposalCard } from "./ask-cards";
import { Icon, type IconName } from "./icons";
import { ThinkingMark } from "./mark";
import { cx } from "./ui";

/**
 * Starter questions, grouped. Each one runs end to end on BNB testnet with the demo factory: the raise drafts clear
 * Flap's live floor (the smallest minimum raise on testnet is above 3 BNB), and the invest ones read the raises that
 * are open now (lib/ai/chips.live.test.ts checks them against the chain).
 */
export const SUGGEST_GROUPS: { label: string; chips: string[] }[] = [
  { label: "Raise", chips: ["Raise 4 BNB for my GPU agent", "Raise for an AI research agent with a $500/month budget", "What's the smallest raise Flap allows?", "Draft a raise with no team tokens"] },
  { label: "Invest", chips: ["Which raises can I join right now?", "Commit 0.01 BNB to the open raise", "Should I redeem?", "Explain how my money is protected"] },
  { label: "Wallet", chips: ["What can I do with my wallet?", "Mint test USDT"] },
];
/** The four shown before "More". */
export const SUGGEST = ["Raise 4 BNB for my GPU agent", "Which raises can I join right now?", "Should I redeem?", "Mint test USDT"];

function Suggestions({ onPick }: { onPick: (q: string) => void }) {
  const [more, setMore] = useState(false);
  const chip = (x: string) => <button key={x} type="button" className="ag-chip-btn" onClick={() => onPick(x)}>{x}</button>;
  return (
    <div className="ag-sugg" role="group" aria-label="Suggestions">
      {more ? SUGGEST_GROUPS.map((g) => (
        <div key={g.label} className="ag-sugg-group" role="group" aria-label={g.label}>
          <span className="ag-sugg-label">{g.label}</span>
          <div className="ag-chips">{g.chips.map(chip)}</div>
        </div>
      )) : <div className="ag-chips">{SUGGEST.map(chip)}</div>}
      <button type="button" className="ag-sugg-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Fewer ideas" : "More ideas"}<Icon name={more ? "up" : "down"} size={13} /></button>
    </div>
  );
}

function useAskStatus() {
  return useQuery({
    queryKey: ["ask-status"], staleTime: 60_000,
    queryFn: async () => (await (await fetch("/api/ask", { cache: "no-store" })).json()) as { configured: boolean; model: string | null; reason: string | null },
  });
}

/** "claude-opus-5-5" → "Claude Opus 5.5"; anything else as it is. */
export function modelName(id: string | null | undefined): string | null {
  if (!id) return null;
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id);
  return m ? `Claude ${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : id;
}

const KIND_ICON: Record<ActivityRow["kind"], IconName> = { read: "eye", check: "shieldCheck", build: "doc", ask: "sliders" };

export function AskAI({ initial }: { initial?: string }) {
  const s = useAskAI();
  const status = useAskStatus();
  const wallet = useWallet();
  const src = useSource();
  const [q, setQ] = useState("");
  const sentInitial = useRef(false);
  const configured = status.data?.configured === true;

  useEffect(() => {
    if (initial && configured && !sentInitial.current && !s.busy) { sentInitial.current = true; void ask(initial, wallet.address); }
  }, [initial, configured, s.busy, wallet.address]);

  const send = (text: string) => { if (!text.trim() || !configured || s.busy) return; void ask(text, wallet.address); setQ(""); };
  const chain = src.chainId === 97 || !src.chainId ? "BNB testnet" : `chain ${src.chainId}`;
  const model = modelName(status.data?.model);
  const pill = status.isLoading ? { t: "Checking", tone: "neutral" } : !configured ? { t: "Not configured", tone: "warn" } : s.busy ? { t: "Working", tone: "accent" } : { t: "Ready", tone: "good" };
  const userCount = s.items.filter((x) => x.kind === "user").length;
  const lastAi = [...s.items].reverse().find((x): x is AiItem => x.kind === "ai");

  return (
    <ChatApp className="ask-ai" sidebar={<History activeId={s.chatId} busy={s.busy} />}>
      <header className="ag-head">
        <ChatSidebarTrigger />
        <span className="ag-head-mark" aria-hidden="true"><ThinkingMark size={16} still /></span>
        <div className="ag-head-title">
          <h1>Covenant AI</h1>
          <p>Raise, run and exit autonomous ventures in plain words</p>
        </div>
        {/* the model and what Covenant AI touches stay out of the headline: a tooltip on the status */}
        <span className={cx("ag-pill", `tone-${pill.tone}`)} title={`${model ? `${model} · ` : ""}reads ${chain} · drafts transactions you sign`}>{pill.t}</span>
        {s.items.length ? <button type="button" className="btn btn-secondary btn-sm ag-head-new" onClick={reset}><Icon name="plus" size={14} /><span>New chat</span></button> : null}
      </header>

      <MessageScroller busy={s.busy} pinKey={userCount} contentClassName="ag-thread">
        {s.items.length === 0 ? (
          <div className="ag-hello">
            <span className="ag-hello-mark" aria-hidden="true"><ThinkingMark size={26} calm /></span>
            <h2>Say what you want in plain words.</h2>
            <p>Covenant AI reads covenants, positions and agent decisions from the chain, drafts a covenant or a transaction, simulates it from your wallet and shows you a card. You sign in your own wallet, or you don&apos;t: it never holds a key.</p>
            {status.isLoading ? null : !configured ? <Callout tone="warn">{status.data?.reason ?? "Covenant AI is not configured on this site."} The rest of the app works without it.</Callout> : null}
            {!wallet.address && configured ? <button type="button" className="btn btn-secondary btn-sm" onClick={wallet.connect}><Icon name="wallet" size={14} />Connect a wallet for answers about your positions</button> : null}
          </div>
        ) : (
          <MessageGroup>
            {s.items.map((m) => m.kind === "user" ? <UserTurn key={m.id} m={m} /> : <AiTurn key={m.id} m={m} latest={m.id === lastAi?.id} busy={s.busy} lastQuestion={lastQuestion(s.items, m.id)} />)}
          </MessageGroup>
        )}
      </MessageScroller>

      <div className="ag-composer">
        <PromptInput
          value={q}
          onValueChange={setQ}
          onSubmit={send}
          loading={s.busy}
          onStop={stop}
          disabled={!configured}
          maxLength={2000}
          label="Covenant AI"
          placeholder={configured ? "Raise, commit, redeem, explain… in plain words" : "Covenant AI is not configured on this site"}
          header={s.items.length === 0 && configured ? (
            <Suggestions onPick={send} />
          ) : null}
          footer={<p className="ag-composer-note">Answers can be wrong. Every card shows the raw call and simulates again before you sign.</p>}
        />
      </div>
    </ChatApp>
  );
}

const lastQuestion = (items: ChatItem[], aiId: number) => {
  const i = items.findIndex((x) => x.id === aiId);
  const u = items[i - 1];
  return u && u.kind === "user" ? u.text : "";
};

function UserTurn({ m }: { m: Extract<ChatItem, { kind: "user" }> }) {
  return (
    <Message from="user" animateIn>
      <MessageContent>
        <MessageHeader><span>You</span><span className="faint">{messageTime(m.at)}</span></MessageHeader>
        <MessageBubble variant="solid"><MessageBubbleContent>{m.text}</MessageBubbleContent></MessageBubble>
      </MessageContent>
    </Message>
  );
}

export function AiTurn({ m, latest, busy, lastQuestion: question }: { m: AiItem; latest: boolean; busy: boolean; lastQuestion: string }) {
  const wallet = useWallet();
  const running = m.tools.some((t) => t.ok === undefined);
  const working = m.pending && (running || !m.text);
  const rows = activityRows(m.tools);
  const steps = m.tools.length;
  return (
    <Message from="assistant" animateIn>
      <MessageAvatar><ThinkingMark size={14} still={!m.pending} /></MessageAvatar>
      <MessageContent className="ag-answer">
        <MessageHeader><b>Covenant AI</b><span className="faint">{messageTime(m.at)}</span></MessageHeader>
        {m.pending && !m.tools.length && !m.text ? <div className="ag-thinking" role="status"><ThinkingShimmer>Thinking…</ThinkingShimmer></div> : null}
        {m.tools.length ? (
          <AgentActivity
            status={working ? "working" : "complete"}
            activeLabel={running ? "Working…" : activeLabel(m.tools)}
            summary={<>{doneIn((m.workEnd ?? m.at) - m.at)}<span className="faint"> · {steps} step{steps === 1 ? "" : "s"}</span></>}
            items={rows.map((r) => ({ id: r.id, type: "step" as const, label: r.label, status: r.status, meta: r.meta, title: r.meta, icon: <Icon name={KIND_ICON[r.kind]} size={14} /> }))}
          />
        ) : null}
        {m.text ? <StreamingResponse status={m.pending ? "streaming" : "complete"} showActions={!m.pending}>{m.text}</StreamingResponse> : null}
        {m.needWallet ? (
          !wallet.address ? (
            <Callout tone="accent" icon="wallet">
              <div className="ag-callout-row"><span>Connect a wallet to continue. Covenant AI simulates from it; you sign in it.</span><button type="button" className="btn btn-primary btn-sm" onClick={wallet.connect}><Icon name="wallet" size={14} />Connect wallet</button></div>
            </Callout>
          ) : latest && !busy && question ? (
            <Callout tone="good" icon="check">
              <div className="ag-callout-row"><span>Wallet connected.</span><button type="button" className="btn btn-secondary btn-sm" onClick={() => void ask(question, wallet.address)}><Icon name="refresh" size={14} />Ask again</button></div>
            </Callout>
          ) : null
        ) : null}
        {m.choices.map((c) => {
          const custom = c.picked !== undefined && !c.options.some((o) => o.reply === c.picked);
          return (
            <ApprovalCard
              key={c.id}
              question={{ id: c.id, title: c.question, allowCustom: c.allowCustom, options: c.options.map((o) => ({ value: o.reply, label: o.label, description: o.description })) }}
              status={c.picked !== undefined ? "answered" : "pending"}
              answer={c.picked === undefined ? undefined : custom ? { selected: [], custom: c.picked } : { selected: [c.picked] }}
              disabled={busy || !latest}
              onSubmit={(a) => pick(m.id, c.id, a.custom ?? a.selected[0] ?? "", wallet.address)}
            />
          );
        })}
        {m.proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
        {m.error ? <Callout tone={m.error === "Stopped." ? "accent" : "bad"} icon={m.error === "Stopped." ? "info" : "alert"}>{m.error}</Callout> : null}
      </MessageContent>
    </Message>
  );
}

function History({ activeId, busy }: { activeId: string | null; busy: boolean }) {
  const chats = useAskHistory();
  const side = useChatSidebar();
  return (
    <div className="ag-side-inner">
      <button type="button" className="ag-side-new" onClick={() => { reset(); side.close(); }} disabled={busy}><Icon name="plus" size={15} />New chat</button>
      <div className="ag-side-label">Recent</div>
      {chats.length === 0 ? <p className="ag-side-empty">Your chats stay in this browser. Nothing here yet.</p> : (
        <ul className="ag-side-list">
          {chats.map((c) => (
            <li key={c.id} className={cx("ag-side-item", c.id === activeId && "is-active")}>
              <button type="button" className="ag-side-open" disabled={busy} onClick={() => { openChat(c.id); side.close(); }} title={c.title}>
                <span className="trunc">{c.title}</span>
                <span className="ag-side-time">{messageTime(c.updatedAt)}</span>
              </button>
              <button type="button" className="ag-side-del" aria-label={`Delete "${c.title}"`} onClick={() => deleteChat(c.id)}><Icon name="x" size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
