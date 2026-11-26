"use client";

/*
 * "Ask Covenant": answers questions about one covenant the way the Covenant MCP server's read tools do
 * (list_covenants, get_terms, get_status, get_downside, get_issuer, get_market in server/mcp/tools.ts).
 * Each answer names the tool it stands in for. get_downside goes to the running server for a live vault
 * (/api/covenants/:vault/downside); everything else is computed from the CovenantView the screen already holds,
 * with the same formulas as the vault (lib/covenant/math). Read-only: it never builds or signs a transaction.
 */
import { useState } from "react";
import { parseEther } from "viem";
import { API_BASE } from "@/lib/api/server";
import { derive } from "@/lib/covenant/derive";
import { poolSellQuote, redeemQuote } from "@/lib/covenant/math";
import { duration, relative, span } from "@/lib/covenant/time";
import type { CovenantView } from "@/lib/covenant/types";
import { bnb, bps, multiple, pct, price, signedPct, tokens, usd } from "@/lib/format";

export interface AskTurn { id: number; role: "user" | "covenant"; text: string; tool?: string; source?: "server" | "local"; pending?: boolean }

function amountIn(q: string): number | null {
  const m = q.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m|mm|million|b|bn)?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = (m[2] ?? "").toLowerCase();
  return n * (u === "k" ? 1e3 : u === "m" || u === "mm" || u === "million" ? 1e6 : u === "b" || u === "bn" ? 1e9 : 1);
}

async function serverDownside(v: CovenantView, amount: number): Promise<string | null> {
  if (v.source !== "live" || !v.vault) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${API_BASE}/api/covenants/${v.vault}/downside?tokens=${parseEther(String(Math.floor(amount)))}`, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const o = (await res.json()) as { explanation?: string };
    return typeof o.explanation === "string" && o.explanation ? o.explanation : null;
  } catch {
    return null;
  }
}

/** One answer: the tool it stands in for and the text. */
export async function answer(q: string, v: CovenantView, all: CovenantView[]): Promise<{ tool: string; text: string; source: "server" | "local" }> {
  const d = derive(v);
  const t = v.terms;
  const s = q.toLowerCase();
  const sym = t.symbol;
  const who = v.issuer.kind === "agent" ? "the agent" : "the team";

  if (/(redeem|exit|burn|downside|worth|sell)/.test(s) && amountIn(s) !== null) {
    const n = amountIn(s)!;
    const srv = await serverDownside(v, n);
    if (srv) return { tool: `get_downside(${sym}, tokens=${tokens(n)})`, text: srv, source: "server" };
    const r = redeemQuote(n, d.book, t.exitFeeBps, v.state === "WIND_DOWN");
    const pool = poolSellQuote(n, v.poolBnb, v.poolPrice > 0 ? v.poolBnb / v.poolPrice : 0, t.sellTaxBps);
    const open = v.state === "EXIT_ROUND" || v.state === "WIND_DOWN";
    return {
      tool: `get_downside(${sym}, tokens=${tokens(n)})`, source: "local",
      text: `${tokens(n)} ${sym} redeem for ${bnb(r.out, 4)} BNB at book (${price(d.book)} per token${v.state === "WIND_DOWN" ? ", no fee at wind-down" : `, after the ${bps(t.exitFeeBps)} exit fee`}). Selling the same amount on the pool pays about ${bnb(pool.out, 4)} BNB after tax and slippage. ${open ? "Redemption is open now." : d.eta !== null ? `Redemption is not open yet: at this price an exit round opens in ${duration(d.eta)}.` : "Redemption opens only in an exit round; the pool trades above book, so nothing is counting."}`,
    };
  }
  if (/(list|other covenants|under book|which covenants|all covenants|market)/.test(s)) {
    const rows = all.filter((x) => x.state !== "RAISING" && x.state !== "FAILED").map((x) => ({ x, p: derive(x).prem })).sort((a, b) => a.p - b.p);
    return {
      tool: `list_covenants(${/under/.test(s) ? "under_book_only=true" : ""})`, source: "local",
      text: rows.length ? rows.map(({ x, p }) => `${x.terms.symbol} ${x.state.replace("_", " ").toLowerCase()}, ${signedPct(p)} against book, treasury ${bnb(x.treasury, 1)} BNB`).join(" · ") : "No launched covenants yet.",
    };
  }
  if (/(agent|issuer|reputation|track|history|8004|who)/.test(s)) {
    const i = v.issuer;
    const past = i.outcomes.filter((o) => o.covenant !== sym);
    return {
      tool: `get_issuer(${sym})`, source: "local",
      text: i.kind === "agent"
        ? `${i.name ?? `Agent #${i.agentId}`} is ERC-8004 agent #${i.agentId}, paid through team wallet ${i.teamWallet.slice(0, 6)}…${i.teamWallet.slice(-4)}. ${past.length ? `Past covenants: ${past.map((o) => `${o.covenant} ${o.outcome} (${o.detail})`).join("; ")}.` : "No past covenants on record."}${i.lastAction ? ` Last action: ${i.lastAction.what.toLowerCase()}, ${relative(i.lastAction.at, v.now)}.` : ""} Outcomes are written by covenant vaults only.`
        : `A human team behind wallet ${i.teamWallet.slice(0, 6)}…${i.teamWallet.slice(-4)}, with no agent identity. The rules bind that wallet the same way.`,
    };
  }
  if (/(tap|budget|pay|runway|salary|spend|compute)/.test(s)) {
    const runway = d.budget.bnb > 0 ? v.treasury / d.budget.bnb : 0;
    return {
      tool: `get_status(${sym})`, source: "local",
      text: `The tap is ${usd(t.tapUsdPer30d)} per 30 days at the Atlas rate (about ${bnb(d.budget.bnb)} BNB), capped at ${bps(t.tapCapBps)} of the treasury; the ${d.budget.binding === "cap" ? "cap" : "dollar budget"} binds today. ${bnb(v.tap.accrued, 3)} BNB is claimable now${d.tapPaused ? " but accrual is paused" : ""}. At this draw the treasury lasts about ${runway.toFixed(0)} months. ${who[0]!.toUpperCase() + who.slice(1)} can lower the tap, never raise it.`,
    };
  }
  if (/(heartbeat|alive|abandon|stopp|switch|present)/.test(s)) {
    return {
      tool: `get_status(${sym})`, source: "local",
      text: d.hbLeft <= 0 ? `No heartbeat for ${duration(v.now - v.lastHeartbeat)}, past the ${span(t.heartbeat)} window. Anyone can declare it abandoned: the tap stops, locked team tokens burn and redemption opens with no fee.` : `Last heartbeat ${relative(v.lastHeartbeat, v.now)}. The switch can be flipped by anyone if ${who} stays silent for another ${duration(d.hbLeft)}. Claims, tap cuts and reports all count as heartbeats.`,
    };
  }
  if (/(unlock|tranche|team token|vest|cliff)/.test(s)) {
    return {
      tool: `get_status(${sym})`, source: "local",
      text: v.tranches.map((tr) => `${bps(tr.bps)} at ${multiple(tr.multiple)}: ${tr.unlocked ? "unlocked" : `${duration(tr.progress)} of ${span(t.unlockWindow)} trusted`}`).join(" · ") + `. Counters run on the strict gate (fresh Atlas report, pool at least half its seed), ${t.cliff > 0 ? `after a ${span(t.cliff)} cliff` : "with no cliff"}.`,
    };
  }
  if (/(exit|round|streak|when|open)/.test(s)) {
    return {
      tool: `get_status(${sym})`, source: "local",
      text: v.state === "EXIT_ROUND" ? `An exit round is open and ends ${relative(v.exit.roundEndsAt!, v.now)}. Any holder can redeem at ${price(d.book)} BNB per token.` : v.state === "WIND_DOWN" ? "Wound down: redemption at book is open forever with no fee." : d.eta !== null ? `The pool trades ${pct(-d.prem, 1)} under book. The streak stands at ${duration(v.exit.streak)} of ${span(t.exitStreak)}; at this price a round opens in ${duration(d.eta)}. It compares on-chain numbers only and decays, never resets.` : `The pool trades ${signedPct(d.prem)} against book, so nothing is counting${v.exit.streak > 0 ? ` (the streak decays from ${duration(v.exit.streak)})` : ""}.`,
    };
  }
  if (/(term|split|fee|tax|rule)/.test(s)) {
    return {
      tool: `get_terms(${sym})`, source: "local",
      text: `${bps(t.saleBps)} sold, ${bps(t.poolBps)} in the pool, ${bps(d.teamBps)} to the team in tranches at ${t.trancheMultiple.map(multiple).join(", ")}. Tap ${usd(t.tapUsdPer30d)}/30d capped at ${bps(t.tapCapBps)}. Exit after ${span(t.exitStreak)} under book, ${span(t.roundLength)} rounds, ${bps(t.exitFeeBps)} fee. Heartbeat ${span(t.heartbeat)}. Trading tax ${bps(t.buyTaxBps)} buy, ${bps(t.sellTaxBps)} sell.`,
    };
  }
  return {
    tool: `get_status(${sym})`, source: "local",
    text: `${t.name} holds ${bnb(v.treasury)} BNB, ${price(d.book)} BNB of book value per token across ${tokens(d.R)} redeemable ${sym}. The pool trades at ${price(v.poolPrice)} (${signedPct(d.prem)} against book). State: ${v.state.replace("_", " ").toLowerCase()}. Ask about redeeming an amount, the exit streak, the tap, unlocks, the heartbeat or the issuer.`,
  };
}

/** Conversation state for the Ask Covenant box. */
export function useAsk(v: CovenantView, all: CovenantView[]) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    const id = Date.now();
    setTurns((x) => [...x, { id, role: "user", text }, { id: id + 1, role: "covenant", text: "", pending: true }]);
    setBusy(true);
    const [a] = await Promise.all([answer(text, v, all), new Promise((r) => setTimeout(r, 450))]);
    setTurns((x) => x.map((m) => (m.id === id + 1 ? { ...m, text: a.text, tool: a.tool, source: a.source, pending: false } : m)));
    setBusy(false);
  }
  return { turns, ask, busy, clear: () => setTurns([]) };
}
