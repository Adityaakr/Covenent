import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRange } from "./logs";

const ADDR = "0x524059B1424101D4CAFD33B9a1A8D332dD71193D" as const;
const hex = (n: number) => `0x${n.toString(16)}`;
const log = (block: number) => ({
  address: ADDR.toLowerCase(), blockNumber: hex(block), transactionHash: `0x${block.toString(16).padStart(64, "0")}`, logIndex: "0x0",
  blockHash: `0x${"1".padStart(64, "0")}`, transactionIndex: "0x0", removed: false, topics: [`0x${"a".repeat(64)}`], data: "0x",
});

/** A JSON-RPC endpoint stub: eth_getLogs with a range cap, optional failures, logs at the given blocks. */
function stub(endpoints: Record<string, { cap: number; failFirst?: number; at: number[] }>) {
  const calls: { url: string; from: number; to: number }[] = [];
  const failures = new Map(Object.entries(endpoints).map(([u, e]) => [u, e.failFirst ?? 0]));
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input).replace(/\/$/, "");
    const e = endpoints[url]!;
    const body = JSON.parse(String(init?.body));
    const one = (req: { id: number; params: [{ fromBlock: string; toBlock: string }] }) => {
      const from = Number(req.params[0].fromBlock), to = Number(req.params[0].toBlock);
      calls.push({ url, from, to });
      if ((failures.get(url) ?? 0) > 0) { failures.set(url, failures.get(url)! - 1); return { jsonrpc: "2.0", id: req.id, error: { code: -32000, message: "temporarily unavailable" } }; }
      if (to - from + 1 > e.cap) return { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: `exceed maximum block range ${e.cap}` } };
      return { jsonrpc: "2.0", id: req.id, result: e.at.filter((b) => b >= from && b <= to).map(log) };
    };
    const res = Array.isArray(body) ? body.map(one) : one(body);
    return new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchRange", () => {
  it("reads a long range in chunks no larger than the source allows, and finds every log", async () => {
    const calls = stub({ "https://full.test": { cap: 5000, at: [100, 7_000, 23_456] } });
    const logs = await fetchRange([{ url: "https://full.test", maxRange: 5000 }], ADDR, 0n, 24_999n, 30_000n);
    expect(logs.map((l) => Number(l.blockNumber))).toEqual([100, 7_000, 23_456]);
    expect(calls.every((c) => c.to - c.from + 1 <= 5000)).toBe(true);
    expect(calls).toHaveLength(5);
  });

  it("halves a chunk when the source's real limit is lower than declared", async () => {
    const calls = stub({ "https://tight.test": { cap: 2000, at: [4_999] } });
    const logs = await fetchRange([{ url: "https://tight.test", maxRange: 5000 }], ADDR, 0n, 4_999n, 5_000n);
    expect(logs.map((l) => Number(l.blockNumber))).toEqual([4_999]);
    expect(calls.some((c) => c.to - c.from + 1 > 2000)).toBe(true); // tried, refused
    expect(calls.filter((c) => c.to - c.from + 1 <= 2000).length).toBeGreaterThan(0);
  });

  it("retries a failing source and falls through to the next one", async () => {
    stub({ "https://flaky.test": { cap: 5000, failFirst: 10, at: [] }, "https://backup.test": { cap: 5000, at: [42] } });
    const logs = await fetchRange([{ url: "https://flaky.test", maxRange: 5000 }, { url: "https://backup.test", maxRange: 5000 }], ADDR, 0n, 999n, 1_000n);
    expect(logs.map((l) => Number(l.blockNumber))).toEqual([42]);
  });

  it("never asks a recent-only source for blocks it has pruned", async () => {
    const calls = stub({ "https://recent.test": { cap: 50_000, at: [] }, "https://full.test": { cap: 5000, at: [10] } });
    await fetchRange([{ url: "https://recent.test", maxRange: 50_000, recentOnly: 10_000 }, { url: "https://full.test", maxRange: 5000 }], ADDR, 0n, 4_999n, 100_000n);
    expect(calls.some((c) => c.url === "https://recent.test")).toBe(false);
  });
});
