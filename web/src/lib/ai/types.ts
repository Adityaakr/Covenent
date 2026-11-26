/*
 * Covenant AI wire types, shared by the route handler (app/api/ask) and the chat panel. The route streams one JSON object
 * per line (NDJSON). Nothing here signs: a Proposal carries unsigned transactions that the user's own wallet signs
 * after reading the confirmation card.
 */
import type { Address, Hex } from "viem";
import type { Terms } from "@/lib/covenant/types";

/** One unsigned transaction, in the shape the Covenant MCP server returns (server/src/schema.ts UnsignedTx). */
export interface UnsignedTx {
  chainId: number;
  to: Address;
  data: Hex;
  /** wei, decimal string */
  value: string;
  /** the wallet expected to sign, when only one can (team-only calls, a holder's own tokens) */
  from: Address | null;
  functionName: string;
  description: string;
  /** explicit gas limit when the call needs one (finalize() is sent with 15M; it needs 12M left at its check) */
  gas?: string;
}

/** eth_call of the transaction from the user's wallet before they sign. ok null = not simulated (no wallet, or it
 *  depends on an earlier step in the same proposal). */
export interface Simulation {
  ok: boolean | null;
  detail: string;
  gas?: string;
}

export type ProposalKind =
  | "create" | "commit" | "finalize" | "claim_tokens" | "claim_refund" | "redeem" | "poke" | "deposit_revenue"
  | "claim_tap" | "heartbeat" | "lower_tap" | "mint_demo_usdc" | "pay_agent_usdc";

/** A covenant draft for the create card: the card mines the 7777 salt in the browser, then sends Portal.newLauncher. */
export interface CreateDraft {
  factory: "demo" | "production";
  terms: Terms;
  /** null when the factory's checkTerms passed with these terms (salt aside), else its reason */
  checkTerms: string | null;
  /** what must change before it can be created (empty when valid) */
  problems?: string[];
}

export interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  summary: string;
  facts: { label: string; value: string }[];
  risks: string[];
  chainId: number;
  /** who must sign (null: any wallet) */
  signer: Address | null;
  covenant?: { id: Address; name: string; symbol: string };
  /** sent in order; each waits for the previous receipt */
  txs: (UnsignedTx & { simulation: Simulation })[];
  create?: CreateDraft;
}

/** One option the model offers as a button (offer_choices). Clicking it sends `reply` as the user's next message. */
export interface ChoiceOption {
  label: string;
  description?: string;
  reply: string;
}

/** A question with options, shown as a choice card instead of a list in prose. */
export interface ChoiceSet {
  id: string;
  question: string;
  options: ChoiceOption[];
  /** also show a free-text field */
  allowCustom: boolean;
}

export type AskEvent =
  | { t: "text"; d: string }
  | { t: "tool"; id: string; name: string; input: unknown }
  /** need "wallet": the tool needs a connected wallet; the chat shows a Connect wallet button */
  | { t: "tool_done"; id: string; name: string; ok: boolean; summary: string; need?: "wallet" }
  | { t: "proposal"; p: Proposal }
  | { t: "choices"; c: ChoiceSet }
  /** the conversation to send back with the next question (opaque to the browser), and why the turn ended */
  | { t: "done"; messages: unknown[]; stop: string }
  | { t: "error"; message: string; code?: "not_configured" | "rate_limited" | "bad_request" | "chain" | "api" | "timeout" };

export interface AskRequest {
  /** the conversation so far, exactly as the last "done" event returned it */
  messages?: unknown[];
  /** the new question */
  q: string;
  /** the connected wallet, if any: reads its positions and simulates from it */
  account?: Address;
  /** what the wallet did with earlier proposals since the last question, e.g. "Sent commit: 0xabc… (success)" */
  notes?: string[];
}
