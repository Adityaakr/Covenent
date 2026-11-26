"use client";

/*
 * The browser half of Covenant AI: one conversation held in module state (it survives moving between pages), sent to
 * /api/ask and read back as NDJSON. The route keeps no state; the opaque `messages` it returns are sent back with the
 * next question. Wallet activity on proposals (sent, confirmed, failed, cancelled) is queued as notes for the next
 * question. Finished conversations are kept in this browser's localStorage as recent chats (never sent anywhere).
 */
import { useSyncExternalStore } from "react";
import type { AskEvent, ChoiceSet, Proposal } from "./types";

export interface ToolRow { id: string; name: string; summary?: string; ok?: boolean; need?: "wallet" }
export type Choices = ChoiceSet & { picked?: string };
export interface AiItem {
  id: number;
  kind: "ai";
  text: string;
  tools: ToolRow[];
  proposals: Proposal[];
  choices: Choices[];
  pending: boolean;
  /** a tool needed a wallet: the answer shows a Connect wallet button */
  needWallet?: boolean;
  error?: string;
  /** ms epoch: question sent, and when the last tool step finished (the activity log's "Done in 4s") */
  at: number;
  workEnd?: number;
}
export type ChatItem = { id: number; kind: "user"; text: string; at: number } | AiItem;

/** What happened to a confirmation card, kept with the chat so a restored chat never offers to sign twice. */
export type CardState =
  | { status: "pending" }
  | { status: "signing" | "submitted"; detail: string; step: number }
  | { status: "confirmed"; hashes: string[]; launcher?: string }
  | { status: "rejected" | "cancelled" }
  | { status: "error"; message: string };

interface State { chatId: string | null; items: ChatItem[]; busy: boolean; messages: unknown[]; notes: string[]; cards: Record<string, CardState> }

const EMPTY: State = { chatId: null, items: [], busy: false, messages: [], notes: [], cards: {} };
let state: State = EMPTY;
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((s) => s()); };
const patchAi = (id: number, f: (x: AiItem) => AiItem) => set({ items: state.items.map((x) => (x.id === id && x.kind === "ai" ? f(x) : x)) });

let nextId = 1;
let ctl: AbortController | null = null;

/** Apply one streamed event to the answer being written. Exported for tests. */
export function applyEvent(item: AiItem, e: AskEvent, now = Date.now()): AiItem {
  switch (e.t) {
    case "text": return { ...item, text: item.text + e.d, workEnd: item.workEnd ?? now };
    case "tool": return { ...item, tools: [...item.tools, { id: e.id, name: e.name }], workEnd: undefined };
    case "tool_done": return {
      ...item, workEnd: now, needWallet: item.needWallet || e.need === "wallet",
      tools: item.tools.map((t) => (t.id === e.id ? { ...t, ok: e.ok, summary: e.summary, ...(e.need ? { need: e.need } : {}) } : t)),
    };
    // a corrected draft of the same action replaces the earlier card in this answer
    case "proposal": return { ...item, proposals: [...item.proposals.filter((p) => p.kind !== e.p.kind || p.covenant?.id !== e.p.covenant?.id), e.p] };
    case "choices": return { ...item, choices: [...item.choices, e.c] };
    case "error": return { ...item, pending: false, error: e.message, workEnd: item.workEnd ?? now };
    case "done": return { ...item, pending: false, workEnd: item.workEnd ?? now };
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
  const now = Date.now();
  set({
    busy: true, notes: [], chatId: state.chatId ?? newChatId(),
    items: [...state.items, { id: uid, kind: "user", text, at: now }, { id: aid, kind: "ai", text: "", tools: [], proposals: [], choices: [], pending: true, at: now }],
  });
  ctl = new AbortController();
  try {
    const res = await fetch("/api/ask", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ q: text, messages: state.messages, account, notes }),
    });
    if (!res.ok || !res.body) {
      const e = (await res.json().catch(() => null)) as { message?: string } | null;
      patchAi(aid, (x) => ({ ...x, pending: false, workEnd: Date.now(), error: e?.message ?? `Covenant AI answered ${res.status}.` }));
      set({ notes: [...notes, ...state.notes] });
      return;
    }
    for await (const ev of ndjson(res.body)) {
      if (ev.t === "done") set({ messages: ev.messages });
      patchAi(aid, (x) => applyEvent(x, ev));
    }
    patchAi(aid, (x) => ({ ...x, pending: false, workEnd: x.workEnd ?? Date.now() }));
  } catch (e) {
    const stopped = (e as Error).name === "AbortError";
    patchAi(aid, (x) => ({ ...x, pending: false, workEnd: x.workEnd ?? Date.now(), error: stopped ? "Stopped." : "Covenant AI did not answer. Check the connection and try again." }));
  } finally {
    ctl = null;
    set({ busy: false });
    saveChat();
  }
}

/** The user picked an option on a choice card: mark it and send its reply as the next question. */
export function pick(itemId: number, choiceId: string, reply: string, account?: string) {
  if (state.busy) return;
  set({ items: state.items.map((x) => (x.id === itemId && x.kind === "ai" ? { ...x, choices: x.choices.map((c) => (c.id === choiceId ? { ...c, picked: reply } : c)) } : x)) });
  void ask(reply, account);
}

export function stop() { ctl?.abort(); }
export function reset() { stop(); set({ ...EMPTY }); }
/** Something the wallet did with a proposal; the next question carries it so the model knows. */
export function note(n: string) { set({ notes: [...state.notes, n].slice(-8) }); }
export function setCard(proposalId: string, c: CardState) {
  set({ cards: { ...state.cards, [proposalId]: c } });
  if (c.status === "confirmed" || c.status === "rejected" || c.status === "cancelled" || c.status === "error") saveChat();
}

export function useAskAI() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state, () => EMPTY);
}

/* ---------- recent chats (this browser only) ---------- */

export interface SavedChat {
  id: string;
  title: string;
  updatedAt: number;
  items: ChatItem[];
  messages: unknown[];
  cards: Record<string, CardState>;
}

export const HISTORY_KEY = "covenant.ask.history.v1";
const MAX_CHATS = 12;
let history: SavedChat[] | null = null;
const hsubs = new Set<() => void>();
const NO_HISTORY: SavedChat[] = [];

const newChatId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c${Date.now()}`);

function readHistory(): SavedChat[] {
  if (history) return history;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    history = Array.isArray(parsed) ? parsed.filter((c): c is SavedChat => Boolean(c && typeof c === "object" && typeof (c as SavedChat).id === "string" && Array.isArray((c as SavedChat).items))) : [];
  } catch {
    history = [];
  }
  return history;
}

function writeHistory(list: SavedChat[]) {
  history = list;
  hsubs.forEach((s) => s());
  // localStorage is small: drop the oldest chats until the list fits
  for (let n = list.length; n >= 0; n--) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, n))); return; } catch { /* quota or blocked storage */ }
  }
}

/** A chat as it is stored: no half-written answer, nothing in flight. Exported for tests. */
export function snapshot(s: State, now = Date.now()): SavedChat | null {
  if (!s.chatId || s.items.length === 0) return null;
  const first = s.items.find((x) => x.kind === "user");
  const title = first && first.kind === "user" ? first.text.slice(0, 80) : "Chat";
  const items = s.items.map((x) => (x.kind === "ai" && x.pending ? { ...x, pending: false, error: x.error ?? "Stopped." } : x));
  const cards = Object.fromEntries(Object.entries(s.cards).map(([k, c]) => [k, c.status === "signing" || c.status === "submitted" ? { status: "pending" as const } : c]));
  return { id: s.chatId, title, updatedAt: now, items, messages: s.messages, cards };
}

function saveChat() {
  const snap = snapshot(state);
  if (!snap) return;
  writeHistory([snap, ...readHistory().filter((c) => c.id !== snap.id)].slice(0, MAX_CHATS));
}

export function openChat(id: string) {
  const c = readHistory().find((x) => x.id === id);
  if (!c || state.busy) return;
  nextId = Math.max(nextId, ...c.items.map((x) => x.id + 1));
  set({ chatId: c.id, items: c.items, messages: c.messages, cards: c.cards ?? {}, notes: [], busy: false });
}

export function deleteChat(id: string) {
  writeHistory(readHistory().filter((c) => c.id !== id));
  if (state.chatId === id) reset();
}

export function useAskHistory(): SavedChat[] {
  return useSyncExternalStore((cb) => { hsubs.add(cb); return () => hsubs.delete(cb); }, readHistory, () => NO_HISTORY);
}
