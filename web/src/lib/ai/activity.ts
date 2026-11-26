/*
 * Covenant AI's activity log, as plain data: each tool the model ran becomes one row with a human label, and repeated
 * calls of the same tool fold into one row with a count ("Checked Flap's floor for 4 splits"). The chat renders these
 * rows in AgentActivity; keeping the folding here makes it testable without a DOM.
 */
import type { ToolRow } from "./client";

export type ActivityKind = "read" | "check" | "build" | "ask";
export interface ToolLabel { active: string; done: string; kind: ActivityKind; unit?: [string, string] }

export const TOOL_LABELS: Record<string, ToolLabel> = {
  list_covenants: { active: "Listing covenants", done: "Listed covenants", kind: "read" },
  get_covenant: { active: "Reading the covenant", done: "Read the covenant", kind: "read", unit: ["covenant", "covenants"] },
  get_my_positions: { active: "Reading your positions", done: "Read your positions", kind: "read" },
  get_wallet: { active: "Reading your wallet", done: "Read your wallet", kind: "read" },
  quote_redeem: { active: "Quoting a redemption", done: "Quoted a redemption", kind: "check", unit: ["amount", "amounts"] },
  flap_floor: { active: "Checking Flap's floor", done: "Checked Flap's floor", kind: "check", unit: ["split", "splits"] },
  get_agent_decisions: { active: "Reading the agent's decisions", done: "Read the agent's decisions", kind: "read" },
  offer_choices: { active: "Laying out the options", done: "Laid out the options", kind: "ask" },
  draft_covenant: { active: "Drafting the covenant", done: "Drafted the covenant", kind: "build", unit: ["draft", "drafts"] },
  commit: { active: "Building the commitment", done: "Built the commitment", kind: "build" },
  finalize: { active: "Building finalize", done: "Built finalize", kind: "build" },
  claim_tokens: { active: "Building the claim", done: "Built the claim", kind: "build" },
  claim_refund: { active: "Building the refund", done: "Built the refund", kind: "build" },
  redeem: { active: "Building the redemption", done: "Built the redemption", kind: "build" },
  poke: { active: "Building a poke", done: "Built a poke", kind: "build" },
  deposit_revenue: { active: "Building the deposit", done: "Built the deposit", kind: "build" },
  claim_tap: { active: "Building the tap claim", done: "Built the tap claim", kind: "build" },
  heartbeat: { active: "Building a heartbeat", done: "Built a heartbeat", kind: "build" },
  lower_tap: { active: "Building the tap cut", done: "Built the tap cut", kind: "build" },
  mint_demo_usdc: { active: "Building the USDT mint", done: "Built the USDT mint", kind: "build" },
  pay_agent_usdc: { active: "Building the agent payment", done: "Built the agent payment", kind: "build" },
};

const labelOf = (name: string): ToolLabel => TOOL_LABELS[name] ?? { active: `Running ${name}`, done: `Ran ${name}`, kind: "read" };

export interface ActivityRow {
  id: string;
  name: string;
  kind: ActivityKind;
  label: string;
  /** a short result: the last call's summary, or what went wrong */
  meta?: string;
  count: number;
  status: "active" | "complete" | "error";
}

/** Fold tool calls into rows, one per tool in first-call order. */
export function activityRows(tools: ToolRow[]): ActivityRow[] {
  const groups = new Map<string, ToolRow[]>();
  for (const t of tools) groups.set(t.name, [...(groups.get(t.name) ?? []), t]);
  return [...groups.entries()].map(([name, calls]) => {
    const l = labelOf(name);
    const running = calls.some((c) => c.ok === undefined);
    const failed = calls.filter((c) => c.ok === false);
    const n = calls.length;
    const counted = (verb: string) => (n > 1 ? (l.unit ? `${verb} for ${n} ${l.unit[1]}` : `${verb} (${n}×)`) : verb);
    const status: ActivityRow["status"] = running ? "active" : failed.length === n ? "error" : "complete";
    const last = [...calls].reverse().find((c) => c.ok !== undefined);
    const meta = status === "error" ? failed.at(-1)?.summary : n > 1 && failed.length ? `${failed.length} of ${n} failed` : last?.summary;
    return { id: calls[0]!.id, name, kind: l.kind, label: counted(running ? l.active : l.done), ...(meta ? { meta } : {}), count: n, status };
  });
}

/** The live line while the agent works: the running tool's label ("Checking Flap's floor…"), else "Thinking…". */
export function activeLabel(tools: ToolRow[]): string {
  const cur = tools.filter((t) => t.ok === undefined).at(-1);
  return cur ? `${labelOf(cur.name).active}…` : "Thinking…";
}

/** "Done in 4s", "Done in 1m 12s". */
export function doneIn(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `Done in ${s}s` : `Done in ${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`;
}
