/*
 * Agent decisions, read from the chain. The issuer agent (server/agents/issuer) posts each decision it acts on as a
 * report on its vault: postReport(period, uri, hash) where uri is a data URI holding the decision record and hash is
 * keccak256 of that JSON, so the record is on-chain, needs no server to read and can be checked against its hash. The
 * period's full written report is posted the same way (an http(s) URI when the agent hosts it). Every action the
 * team wallet takes (claimTap, lowerTap, heartbeat, depositRevenue) is an event too; the timeline merges both.
 *
 * Record format (v1), produced by server/agents/issuer/decision.ts:
 *   { v: 1, kind: "covenant.decision", action, reason, author: { kind: "llm", model } | { kind: "rule", why },
 *     inputs: { ...the numbers the decision read }, tx?: "0x…" (the action's own transaction), at: unix seconds }
 */
import { formatEther, keccak256, toBytes, type Abi, type PublicClient } from "viem";
import type { Address, Hash } from "@/lib/covenant/types";
import { abiFor, type DeploymentPayload } from "./deployment";
import { contractLogs, snapshotTime } from "./logs";
import { LOCAL_MODE } from "./target";

export const DECISION_KIND = "covenant.decision";

export interface DecisionRecord {
  v: 1;
  kind: typeof DECISION_KIND;
  action: string;
  reason: string;
  author: { kind: "llm"; model: string } | { kind: "rule"; why: string };
  inputs: Record<string, unknown>;
  tx?: string;
  at: number;
}

export type TimelineEntry =
  | { type: "decision"; at: number; period: number; tx: Hash; record: DecisionRecord; verified: boolean }
  | { type: "report"; at: number; period: number; tx: Hash; uri: string; hash: string; text?: string; verified?: boolean }
  | { type: "action"; at: number; tx: Hash; name: "TapClaimed" | "TapLowered" | "Heartbeat" | "RevenueDeposited"; detail: string };

const B64 = /^data:application\/json(?:;charset=utf-8)?;base64,([A-Za-z0-9+/=]+)$/;
const PLAIN = /^data:application\/json(?:;charset=utf-8)?,(.*)$/s;

function b64decode(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64").toString("utf8");
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}

/** The JSON text inside a data URI, or null when the URI is not one. */
export function dataUriText(uri: string): string | null {
  const b = uri.match(B64);
  if (b) { try { return b64decode(b[1]!); } catch { return null; } }
  const p = uri.match(PLAIN);
  if (p) { try { return decodeURIComponent(p[1]!); } catch { return null; } }
  return null;
}

/** A decision record from a report URI. verified: keccak256 of the JSON text equals the hash posted with it. */
export function decodeDecision(uri: string, hash: string): { record: DecisionRecord; verified: boolean } | null {
  const text = dataUriText(uri);
  if (text === null) return null;
  let o: unknown;
  try { o = JSON.parse(text); } catch { return null; }
  const r = o as Partial<DecisionRecord>;
  if (!r || r.kind !== DECISION_KIND || typeof r.action !== "string" || typeof r.reason !== "string") return null;
  const record: DecisionRecord = {
    v: 1, kind: DECISION_KIND, action: r.action.slice(0, 40), reason: r.reason.slice(0, 1200),
    author: r.author && typeof r.author === "object" && (r.author.kind === "llm" || r.author.kind === "rule") ? r.author : { kind: "rule", why: "unspecified" },
    inputs: r.inputs && typeof r.inputs === "object" ? r.inputs : {}, tx: typeof r.tx === "string" ? r.tx : undefined, at: Number(r.at) || 0,
  };
  return { record, verified: keccak256(toBytes(text)).toLowerCase() === hash.toLowerCase() };
}

const eth = (v: unknown) => (typeof v === "bigint" ? Number(formatEther(v)) : 0);

/** The decision timeline for one vault, newest first. Reads logs from the deployment's start block. */
export async function readDecisions(client: PublicClient, payload: DeploymentPayload, vault: Address, limit = 60): Promise<TimelineEntry[]> {
  const V = abiFor(payload.abis, "CovenantVault", "Vault") as Abi | undefined;
  if (!V) return [];
  const fromBlock = BigInt(payload.deployment?.startBlock ?? 0);
  const chainId = payload.deployment?.chainId ?? 0;
  // chunked, cached, and seeded from the baked snapshot on BNB testnet (public RPCs cap and prune log ranges)
  const logs = await contractLogs(client, chainId, vault, V, fromBlock, LOCAL_MODE);
  const times = new Map<bigint, number>();
  const ts = async (bn: bigint) => {
    if (!times.has(bn)) times.set(bn, snapshotTime(chainId, bn) ?? Number((await client.getBlock({ blockNumber: bn })).timestamp));
    return times.get(bn)!;
  };
  const out: TimelineEntry[] = [];
  for (const raw of logs) {
    const l = raw as unknown as { eventName: string; args: Record<string, unknown>; blockNumber: bigint; transactionHash: Hash };
    const a = l.args ?? {};
    switch (l.eventName) {
      case "ReportPosted": {
        const uri = String(a.uri ?? "");
        const hash = String(a.hash ?? "");
        const period = Number(a.period ?? 0);
        const at = await ts(l.blockNumber);
        const d = decodeDecision(uri, hash);
        if (d) out.push({ type: "decision", at: d.record.at || at, period, tx: l.transactionHash, record: d.record, verified: d.verified });
        else {
          const text = dataUriText(uri) ?? undefined;
          out.push({ type: "report", at, period, tx: l.transactionHash, uri: text !== undefined ? "data URI" : uri, hash, text, verified: text !== undefined ? keccak256(toBytes(text)).toLowerCase() === hash.toLowerCase() : undefined });
        }
        break;
      }
      case "TapClaimed": out.push({ type: "action", at: await ts(l.blockNumber), tx: l.transactionHash, name: "TapClaimed", detail: `${eth(a.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })} BNB to the team wallet` }); break;
      case "TapLowered": out.push({ type: "action", at: await ts(l.blockNumber), tx: l.transactionHash, name: "TapLowered", detail: `$${eth(a.oldUsdPer30d).toLocaleString("en-US")} to $${eth(a.newUsdPer30d).toLocaleString("en-US")} per 30 days` }); break;
      case "Heartbeat": out.push({ type: "action", at: await ts(l.blockNumber), tx: l.transactionHash, name: "Heartbeat", detail: `from ${String(a.by ?? "").slice(0, 10)}…` }); break;
      case "RevenueDeposited": out.push({ type: "action", at: await ts(l.blockNumber), tx: l.transactionHash, name: "RevenueDeposited", detail: `${eth(a.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })} BNB into the treasury` }); break;
    }
  }
  // A heartbeat emitted inside a report or claim transaction is the same act: keep the richer row.
  const richTx = new Set(out.filter((e) => e.type !== "action" || e.name !== "Heartbeat").map((e) => e.tx));
  // An action a decision record names (its `tx`) is already told by that decision: keep the decision row only.
  const explained = new Set(out.flatMap((e) => (e.type === "decision" && e.verified && e.record.tx ? [e.record.tx.toLowerCase()] : [])));
  return out
    .filter((e) => !(e.type === "action" && ((e.name === "Heartbeat" && richTx.has(e.tx)) || explained.has(e.tx.toLowerCase()))))
    .sort((x, y) => y.at - x.at)
    .slice(0, limit);
}
