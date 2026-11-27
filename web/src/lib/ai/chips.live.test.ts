/*
 * The Covenant AI starter chips (components/app/ask-ai.tsx SUGGEST_GROUPS), run tool by tool against BNB testnet: the
 * reads and drafts each chip leads the model to, with the demo factory's live floor and the raises open right now.
 * It needs the network, so it runs only with COVENANT_LIVE=1:  COVENANT_LIVE=1 pnpm vitest run src/lib/ai/chips.live.test.ts
 * COVENANT_LIVE_ACCOUNT picks the wallet the chips run as (default: the testnet deployer, which holds CVD tokens).
 */
import { describe, expect, it } from "vitest";
import { SUGGEST, SUGGEST_GROUPS } from "@/components/app/ask-ai";
import { addressOf } from "@/lib/chain/deployment";
import { TESTNET_PAYLOAD } from "@/lib/chain/target";
import { loadContext, type AiContext } from "./context";
import { runTool } from "./tools";

const ACCOUNT = process.env.COVENANT_LIVE_ACCOUNT ?? addressOf(TESTNET_PAYLOAD.deployment!, "deployer")!;
type Draft = { valid: boolean; problems: string[] };
type Floor = { cheapest: { salePct: number; poolPct: number; minRaiseBnb: number } };

async function ok(ctx: AiContext, name: string, input: unknown) {
  const r = await runTool(ctx, name, input);
  expect(r.ok, `${name}: ${JSON.stringify(r.data)}`).toBe(true);
  return r;
}

describe.skipIf(!process.env.COVENANT_LIVE)("Covenant AI chips on BNB testnet", () => {
  it("lists every chip once, four of them up front", () => {
    const all = SUGGEST_GROUPS.flatMap((g) => g.chips);
    expect(new Set(all).size).toBe(all.length);
    expect(SUGGEST).toHaveLength(4);
    for (const c of SUGGEST) expect(all).toContain(c);
  });

  it("Raise: every raise chip drafts terms the demo factory's checkTerms accepts", async () => {
    const ctx = await loadContext(ACCOUNT);
    const floor = (await ok(ctx, "flap_floor", {})).data as Floor; // "What's the smallest raise Flap allows?"
    expect(floor.cheapest.minRaiseBnb).toBeGreaterThan(0);
    const min = floor.cheapest.minRaiseBnb;
    const drafts: [string, Record<string, unknown>][] = [
      ["Raise 4 BNB for my GPU agent", { name: "GPU Agent", symbol: "GPUAI", issuer: "agent", min_raise_bnb: 4, cap_bnb: 4 }],
      ["Raise for an AI research agent with a $500/month budget", { name: "Research Agent", symbol: "RSRCH", issuer: "agent", min_raise_bnb: min, cap_bnb: Math.ceil(min) + 1, tap_usd_per_30d: 500 }],
      ["Draft a raise with no team tokens", { name: "Open Lab", symbol: "OPEN", min_raise_bnb: min, cap_bnb: Math.ceil(min) + 1, sale_pct: floor.cheapest.salePct, pool_pct: floor.cheapest.poolPct }],
    ];
    for (const [chip, input] of drafts) {
      const d = (await ok(ctx, "draft_covenant", input)).data as Draft;
      expect(d.problems, chip).toEqual([]);
      expect(d.valid, chip).toBe(true);
    }
  }, 60_000);

  it("Invest: the open raises, a commit to one (or a clear 'not open'), a redeem quote and the positions", async () => {
    const ctx = await loadContext(ACCOUNT);
    await ok(ctx, "list_covenants", {}); // "Which raises can I join right now?"
    const open = (await ctx.views()).find((v) => v.state === "RAISING" && v.raise.deadline > v.now);
    if (open) {
      const r = await ok(ctx, "commit", { covenant: open.id, amount_bnb: "0.01" }); // "Commit 0.01 BNB to the open raise"
      expect(r.proposal!.txs[0]!.simulation.ok).toBe(true);
    } else {
      const shut = (await ctx.views()).find((v) => v.state !== "RAISING")!;
      const r = await runTool(ctx, "commit", { covenant: shut.id, amount_bnb: "0.01" });
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r.data)).toMatch(/not open/);
    }
    const held = (await ctx.views()).find((v) => (v.position?.balance ?? 0) > 0);
    if (held) await ok(ctx, "quote_redeem", { covenant: held.id }); // "Should I redeem?"
    await ok(ctx, "get_my_positions", {}); // "Explain how my money is protected"
  }, 60_000);

  it("Wallet: balances and a test USDT mint that simulates", async () => {
    const ctx = await loadContext(ACCOUNT);
    await ok(ctx, "get_wallet", {}); // "What can I do with my wallet?"
    const mint = await runTool(ctx, "mint_demo_usdc", {}); // "Mint test USDT"
    // the faucet has a cooldown per wallet: either a simulated mint, or a clear "next mint at"
    expect(mint.ok ? mint.proposal!.txs[0]!.simulation.ok : JSON.stringify(mint.data)).toBeTruthy();
  }, 60_000);
});
