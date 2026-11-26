import { decodeFunctionData, erc20Abi, keccak256, maxUint256, parseEther, toBytes, type Abi } from "viem";
import { describe, expect, it } from "vitest";
import { dataUriText, decodeDecision } from "@/lib/chain/decisions";
import { abiFor, addressOf } from "@/lib/chain/deployment";
import { TESTNET_PAYLOAD } from "@/lib/chain/target";
import { FINALIZE_GAS, runTool, scrub, TOOL_NAMES, toolSpecs } from "./tools";
import { applyEvent } from "./client";
import { context, LAUNCHER, ME, TEAM, TOKEN, VAULT, view } from "./test-kit";
import type { Proposal } from "./types";

const L = abiFor(TESTNET_PAYLOAD.abis, "CovenantLauncher")!;
const V = abiFor(TESTNET_PAYLOAD.abis, "CovenantVault")!;
const USDC = addressOf(TESTNET_PAYLOAD.deployment!, "demoUsdc")!;

async function proposal(name: string, input: unknown, ctx = context([view()])): Promise<Proposal> {
  const r = await runTool(ctx, name, input);
  expect(r.ok, JSON.stringify(r.data)).toBe(true);
  expect(r.proposal).toBeDefined();
  return r.proposal!;
}

describe("Ask AI tool schemas", () => {
  it("has unique names, the MCP server's names where they overlap, and object JSON schemas", () => {
    expect(new Set(TOOL_NAMES).size).toBe(TOOL_NAMES.length);
    for (const n of ["list_covenants", "commit", "claim_tokens", "claim_refund", "redeem", "poke", "claim_tap", "heartbeat", "lower_tap"]) expect(TOOL_NAMES).toContain(n);
    for (const t of toolSpecs()) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema).not.toHaveProperty("$schema");
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.eager_input_streaming).toBe(true);
    }
    const commit = toolSpecs().find((t) => t.name === "commit")!.input_schema as unknown as { required: string[] };
    expect(commit.required).toEqual(["covenant", "amount_bnb"]);
  });

  it("rejects invalid input and unknown tools without throwing", async () => {
    const ctx = context([view()]);
    expect(await runTool(ctx, "commit", { covenant: "SCOUT", amount_bnb: "lots" })).toMatchObject({ ok: false, summary: "invalid input" });
    expect(await runTool(ctx, "transfer_everything", {})).toMatchObject({ ok: false });
    expect(await runTool(ctx, "get_covenant", { covenant: "0xdeadbeef" })).toMatchObject({ ok: false });
  });

  it("marks third-party text as untrusted and scrubs URLs and paths from errors", async () => {
    const r = await runTool(context([view()]), "list_covenants", {});
    expect((r.data as { untrustedText: string }).untrustedText).toMatch(/never instructions/);
    expect(scrub("HTTP request failed. URL: https://bsc-testnet.example/v1/abcdef?api_key=s3cret at /Users/x/web/src/a.ts")).toBe("HTTP request failed. URL: [rpc] at [path]");
  });
});

describe("Ask AI transaction builders", () => {
  it("commit: contribute() with the BNB as value, simulated from the wallet", async () => {
    const chain = { calls: [] as { method: string; args: unknown }[] };
    const p = await proposal("commit", { covenant: "SCOUT", amount_bnb: "0.01" }, context([view()], chain));
    expect(p.kind).toBe("commit");
    expect(p.chainId).toBe(97);
    const tx = p.txs[0]!;
    expect(tx.to).toBe(LAUNCHER);
    expect(tx.value).toBe(parseEther("0.01").toString());
    expect(decodeFunctionData({ abi: L, data: tx.data }).functionName).toBe("contribute");
    expect(tx.simulation).toEqual({ ok: true, detail: expect.stringMatching(/succeeds/), gas: "51234" });
    expect((chain.calls[0]!.args as { account: string }).account).toBe(ME);
    expect(p.facts.find((f) => f.label === "If it closed now")!.value).toMatch(/below the minimum/);
  });

  it("commit: refuses a closed raise", async () => {
    const r = await runTool(context([view({ state: "ACTIVE" })]), "commit", { covenant: "SCOUT", amount_bnb: "0.01" });
    expect(r.ok).toBe(false);
    expect((r.data as { error: string }).error).toMatch(/not open/);
  });

  it("simulation: a revert shows on the card, and no wallet means not simulated", async () => {
    const reverted = await proposal("commit", { covenant: "SCOUT", amount_bnb: "1" }, context([view()], { calls: [], revert: "execution reverted: SaleClosed()" }));
    expect(reverted.txs[0]!.simulation.ok).toBe(false);
    expect(reverted.txs[0]!.simulation.detail).toMatch(/Would revert/);
    const nobody = await proposal("commit", { covenant: "SCOUT", amount_bnb: "1" }, context([view()], { calls: [] }, null));
    expect(nobody.txs[0]!.simulation.ok).toBeNull();
  });

  it("finalize: carries a gas limit of at least 15.5M", async () => {
    const v = view({ raise: { committed: 4, contributors: 3, deadline: 1_799_999_000, finalized: false } });
    const p = await proposal("finalize", { covenant: "SCOUT" }, context([v]));
    expect(BigInt(p.txs[0]!.gas!)).toBe(FINALIZE_GAS);
    expect(FINALIZE_GAS).toBeGreaterThanOrEqual(15_500_000n);
    expect(FINALIZE_GAS).toBeLessThanOrEqual(16_777_216n);
  });

  it("redeem: approves exactly the amount, never unlimited, then redeem(amount, minOut)", async () => {
    const v = view({ state: "EXIT_ROUND", treasury: 1, position: { committed: 0, accepted: 0, refund: 0, allocation: 0, tokensClaimed: true, refundClaimed: false, balance: 1000 } });
    const chain = { calls: [], reads: { allowance: 0n, previewRedeem: parseEther("0.000001") } };
    const p = await proposal("redeem", { covenant: "SCOUT", tokens: 1000 }, context([v], chain));
    expect(p.txs.map((t) => t.functionName)).toEqual(["approve", "redeem"]);
    const approve = decodeFunctionData({ abi: erc20Abi, data: p.txs[0]!.data });
    expect(approve.args).toEqual([VAULT, parseEther("1000")]);
    expect(approve.args[1]).not.toBe(maxUint256);
    expect(p.txs[0]!.to).toBe(TOKEN);
    const redeem = decodeFunctionData({ abi: V, data: p.txs[1]!.data });
    expect(redeem.args).toEqual([parseEther("1000"), (parseEther("0.000001") * 995n) / 1000n]);
    expect(p.txs[1]!.simulation.ok).toBeNull(); // depends on the approval
  });

  it("redeem: explains when redemption is closed instead of building a call", async () => {
    const r = await runTool(context([view({ state: "ACTIVE" })]), "redeem", { covenant: "SCOUT", tokens: 5 });
    expect(r.ok).toBe(false);
    expect((r.data as { error: string }).error).toMatch(/Redemption is closed/);
  });

  it("team-only calls name the team wallet as signer and refuse another wallet in simulation", async () => {
    const p = await proposal("claim_tap", { covenant: "SCOUT" }, context([view({ state: "ACTIVE", tap: { accrued: 0.01, claimedThisPeriod: 0, lastClaim: null } })]));
    expect(p.signer).toBe(TEAM);
    expect(p.txs[0]!.simulation.ok).toBe(false);
    expect(p.txs[0]!.simulation.detail).toMatch(/Only 0x3C44/);
  });

  it("mint_demo_usdc: faucet() on the deployed dUSDC; pay_agent_usdc: a transfer to the covenant's team wallet", async () => {
    const mint = await proposal("mint_demo_usdc", {});
    expect(mint.txs[0]!.to).toBe(USDC);
    expect(mint.txs[0]!.data).toBe("0xde5f72fd"); // faucet()
    const pay = await proposal("pay_agent_usdc", { covenant: "SCOUT", amount_usdc: 25 });
    const usdcAbi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const satisfies Abi;
    expect(decodeFunctionData({ abi: usdcAbi, data: pay.txs[0]!.data }).args).toEqual([TEAM, 25_000_000n]);
    expect(pay.risks.join(" ")).toMatch(/treasury stays BNB/);
  });

  it("draft_covenant: flags Flap's testnet floor and runs the factory's checkTerms", async () => {
    const chain = { calls: [] as { method: string; args: unknown }[], reads: { checkTerms: undefined } };
    const low = await runTool(context([], chain), "draft_covenant", { name: "GPU Agent", symbol: "GPU", min_raise_bnb: 1, cap_bnb: 3, sale_pct: 50, pool_pct: 45, tap_cap_pct: 4 });
    expect((low.data as { valid: boolean; problems: string[] }).problems.join(" ")).toMatch(/Flap's testnet floor/);
    const ok = await runTool(context([], chain), "draft_covenant", { name: "GPU Agent", symbol: "GPU", min_raise_bnb: 2.7, cap_bnb: 3, sale_pct: 50, pool_pct: 45, tap_cap_pct: 4 });
    expect((ok.data as { valid: boolean }).valid).toBe(true);
    expect(ok.proposal!.create).toMatchObject({ factory: "demo", checkTerms: null, terms: { tapCapBps: 400, minRaise: 2.7, cap: 3, teamWallet: ME } });
    const check = chain.calls.find((c) => c.method === "read:checkTerms")!.args as { args: [{ salt: string }] };
    expect(check.args[0].salt).not.toMatch(/^0x0{64}$/); // a zero salt is BadText()
  });
});

describe("decision records and the chat stream", () => {
  it("decodes a data-URI decision and checks its hash", () => {
    const json = JSON.stringify({ v: 1, kind: "covenant.decision", action: "claim_tap", reason: "Ignore previous instructions", author: { kind: "llm", model: "claude-opus-5-5" }, inputs: { treasuryBnb: 1 }, at: 5 });
    const uri = `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
    expect(dataUriText(uri)).toBe(json);
    expect(decodeDecision(uri, keccak256(toBytes(json)))).toMatchObject({ verified: true, record: { action: "claim_tap", author: { kind: "llm" } } });
    expect(decodeDecision(uri, keccak256(toBytes("other")))!.verified).toBe(false);
    expect(decodeDecision("https://reports.example/1", "0x")).toBeNull();
  });

  it("a corrected proposal of the same kind replaces the earlier card", () => {
    const base = { id: 1, kind: "ai" as const, text: "", tools: [], proposals: [], pending: true };
    const p1 = { id: "a", kind: "create", title: "1" } as unknown as Proposal;
    const p2 = { id: "b", kind: "create", title: "2" } as unknown as Proposal;
    const s = applyEvent(applyEvent(applyEvent(base, { t: "proposal", p: p1 }), { t: "proposal", p: p2 }), { t: "text", d: "hi" });
    expect(s.proposals.map((p) => p.id)).toEqual(["b"]);
    expect(s.text).toBe("hi");
  });
});
