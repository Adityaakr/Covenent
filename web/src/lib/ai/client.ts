"use client";

/*
 * The browser half of Ask AI: one conversation held in module state (it survives moving between pages), sent to
 * /api/ask and read back as NDJSON. The route keeps no state; the opaque `messages` it returns are sent back with the
 * next question. Wallet activity on proposals (sent, confirmed, failed) is queued as notes for the next question.
 */
import { useSyncExternalStore } from "react";
import type { AskEvent, Proposal } from "./types";

export interface ToolRow { id: string; name: string; summary?: string; ok?: boolean }
export type ChatItem =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "ai"; text: string; tools: ToolRow[]; proposals: Proposal[]; pending: boolean; error?: string };

interface State { items: ChatItem[]; busy: boolean; messages: unknown[]; notes: string[] }

let state: State = { items: [], busy: false, messages: [], notes: [] };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((s) => s()); };
const patchAi = (id: number, f: (x: Extract<ChatItem, { kind: "ai" }>) => Extract<ChatItem, { kind: "ai" }>) =>
  set({ items: state.items.map((x) => (x.id === id && x.kind === "ai" ? f(x) : x)) });

let nextId = 1;
let ctl: AbortController | null = null;

/** Apply one streamed event to the answer being written. Exported for tests. */
export function applyEvent(item: Extract<ChatItem, { kind: "ai" }>, e: AskEvent): Extract<ChatItem, { kind: "ai" }> {
  switch (e.t) {
    case "text": return { ...item, text: item.text + e.d };
    case "tool": return { ...item, tools: [...item.tools, { id: e.id, name: e.name }] };
    case "tool_done": return { ...item, tools: item.tools.map((t) => (t.id === e.id ? { ...t, ok: e.ok, summary: e.summary } : t)) };
    // a corrected draft of the same action replaces the earlier card in this answer
    case "proposal": return { ...item, proposals: [...item.proposals.filter((p) => p.kind !== e.p.kind || p.covenant?.id !== e.p.covenant?.id), e.p] };
    case "error": return { ...item, pending: false, error: e.message };
    case "done": return { ...item, pending: false };
  }
}

/** Read an NDJSON body line by line. */
export async function* ndjson(body: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) { try { yield JSON.parse(line) as AskEvent; } catch { /* partial or foreign line */ } }
    }
  }
  if (buf.trim()) { try { yield JSON.parse(buf) as AskEvent; } catch { /* ignore */ } }
}

export async function ask(q: string, account?: string) {
  const text = q.trim();
  if (!text || state.busy) return;
  const uid = nextId++;
  const aid = nextId++;
  const notes = state.notes;
  set({ busy: true, notes: [], items: [...state.items, { id: uid, kind: "user", text }, { id: aid, kind: "ai", text: "", tools: [], proposals: [], pending: true }] });
  ctl = new AbortController();
  try {
    const res = await fetch("/api/ask", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ q: text, messages: state.messages, account, notes }),
    });
    if (!res.ok || !res.body) {
      const e = (await res.json().catch(() => null)) as { message?: string } | null;
      patchAi(aid, (x) => ({ ...x, pending: false, error: e?.message ?? `Ask AI answered ${res.status}.` }));
      set({ notes: [...notes, ...state.notes] });
      return;
    }
    for await (const ev of ndjson(res.body)) {
      if (ev.t === "done") set({ messages: ev.messages });
      patchAi(aid, (x) => applyEvent(x, ev));
    }
    patchAi(aid, (x) => ({ ...x, pending: false }));
  } catch (e) {
    patchAi(aid, (x) => ({ ...x, pending: false, error: (e as Error).name === "AbortError" ? "Stopped." : "Ask AI did not answer. Check the connection and try again." }));
  } finally {
    ctl = null;
    set({ busy: false });
  }
}

export function stop() { ctl?.abort(); }
export function reset() { stop(); set({ items: [], messages: [], notes: [], busy: false }); }
/** Something the wallet did with a proposal; the next question carries it so the model knows. */
export function note(n: string) { set({ notes: [...state.notes, n].slice(-8) }); }

export function useAskAI() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state, () => state);
}
