"use client";

/*
 * The Four.meme path: Covenant Lite (rules 1 and 4) as an OpenFour tax vault template behind Four.meme's ForwardVault.
 *
 * ForwardVault decodes its vault data as ONE struct, `(address template, bytes initData)`: the bytes must be
 * `abi.encode(InitParams(template, initData))`, not the flat `abi.encode(template, initData)` Four.meme's docs suggest
 * (checked against the live implementation on a BNB Chain fork). Lite's initData is
 * `abi.encode(uint16 tapBps, uint32 tapPeriod, uint32 heartbeat, uint16 redeemFeeBps)`. The server's
 * /api/fourmeme/encode returns the same bytes.
 *
 * On the dev chain, FourLiteLauncher (a local stand-in for Four.meme's token creation, which needs Four.meme's
 * backend) deploys a tax token, clones the live ForwardVault onto the Lite template and seeds a PancakeSwap pool in one
 * transaction, so the whole path runs locally. Everything after the token is the real contracts.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { encodeAbiParameters, formatEther, parseEther, type Abi, type Address, type Hash, type Hex } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { useWallet } from "@/components/providers";
import { useSource } from "@/lib/data/hooks";
import { addressOf } from "./deployment";

export interface LiteFields { tapBps: number; tapPeriod: number; heartbeat: number; redeemFeeBps: number }

/** CovenantLiteVault's own bounds: its initializer reverts outside them. */
export const LITE_BOUNDS: Record<keyof LiteFields, { min: number; max: number }> = {
  tapBps: { min: 1, max: 5000 },
  tapPeriod: { min: 86_400, max: 7_776_000 },
  heartbeat: { min: 604_800, max: 15_552_000 },
  redeemFeeBps: { min: 0, max: 300 },
};
export const LITE_DEFAULTS: LiteFields = { tapBps: 400, tapPeriod: 2_592_000, heartbeat: 3_888_000, redeemFeeBps: 100 };

export function liteProblems(f: LiteFields): string[] {
  return (Object.keys(LITE_BOUNDS) as (keyof LiteFields)[])
    .filter((k) => !Number.isInteger(f[k]) || f[k] < LITE_BOUNDS[k].min || f[k] > LITE_BOUNDS[k].max)
    .map((k) => `${k} must be ${LITE_BOUNDS[k].min} to ${LITE_BOUNDS[k].max}`);
}

export function encodeLiteInitData(f: LiteFields): Hex {
  return encodeAbiParameters([{ type: "uint16" }, { type: "uint32" }, { type: "uint32" }, { type: "uint16" }], [f.tapBps, f.tapPeriod, f.heartbeat, f.redeemFeeBps]);
}

/** ForwardVault's vaultData: the tuple (template, initData), exactly as the live ForwardVault decodes it. */
export function encodeForwardVaultData(template: Address, f: LiteFields): Hex {
  return encodeAbiParameters(
    [{ type: "tuple", components: [{ name: "template", type: "address" }, { name: "initData", type: "bytes" }] }],
    [{ template, initData: encodeLiteInitData(f) }],
  );
}

const LAUNCHER: Abi = [
  {
    type: "function", name: "launches", stateMutability: "view", inputs: [],
    outputs: [{ type: "tuple[]", components: [
      { name: "token", type: "address" }, { name: "forwardVault", type: "address" }, { name: "liteVault", type: "address" },
      { name: "pair", type: "address" }, { name: "founder", type: "address" }, { name: "at", type: "uint64" },
    ] }],
  },
  {
    type: "function", name: "launch", stateMutability: "payable",
    inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "supply", type: "uint256" }, { name: "taxBps", type: "uint16" }, { name: "vaultData", type: "bytes" }, { name: "poolTokens", type: "uint256" }],
    outputs: [{ type: "tuple", components: [
      { name: "token", type: "address" }, { name: "forwardVault", type: "address" }, { name: "liteVault", type: "address" },
      { name: "pair", type: "address" }, { name: "founder", type: "address" }, { name: "at", type: "uint64" },
    ] }],
  },
];
const v = (name: string, type = "uint256") => ({ type: "function" as const, name, stateMutability: "view" as const, inputs: [], outputs: [{ type }] });
const LITE: Abi = [
  v("open", "bool"), v("abandoned", "bool"), v("lastHeartbeat", "uint64"), v("heartbeatDeadline"), v("tapPaidNative"), v("tokensBurned"), v("redeemableSupply"), v("owner", "address"),
  { type: "function", name: "params", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }, { type: "uint32" }, { type: "uint32" }, { type: "uint16" }] },
  { type: "function", name: "tapAvailable", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "withdrawTap", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "heartbeat", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "windDown", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "declareAbandoned", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "minNative", type: "uint256" }, { name: "minQuote", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
];
const TOKEN: Abi = [
  v("name", "string"), v("symbol", "string"), v("taxDispatched"), v("totalSupply"),
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "dispatch", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
];

export interface LiteView {
  token: Address; forwardVault: Address; vault: Address; pair: Address; founder: Address; at: number;
  name: string; symbol: string; owner: Address;
  state: "ACTIVE" | "ABANDONED" | "WOUND_DOWN";
  treasury: number; taxDispatched: number; pendingTax: number; tapPaid: number; tapAvailable: number;
  tokensBurned: number; redeemableSupply: number; lastHeartbeat: number; heartbeatDeadline: number; now: number;
  params: LiteFields; balance?: number;
}

/** Every Lite covenant the dev chain's FourLiteLauncher created, read from the chain. */
export function useLiteCovenants() {
  const src = useSource();
  const { address } = useWallet();
  const launcher = src.payload?.deployment ? addressOf(src.payload.deployment, "fourLiteLauncher") : undefined;
  const q = useQuery({
    queryKey: ["lite", src.chainId, launcher, address],
    enabled: src.mode === "live" && Boolean(launcher),
    refetchInterval: 8_000,
    queryFn: async (): Promise<LiteView[]> => {
      const c = src.client!;
      const now = Number((await c.getBlock()).timestamp);
      const rows = (await c.readContract({ address: launcher!, abi: LAUNCHER, functionName: "launches" })) as { token: Address; forwardVault: Address; liteVault: Address; pair: Address; founder: Address; at: bigint }[];
      return Promise.all(rows.map(async (r) => {
        const rl = (fn: string) => c.readContract({ address: r.liteVault, abi: LITE, functionName: fn });
        const rt = (fn: string, args: unknown[] = []) => c.readContract({ address: r.token, abi: TOKEN, functionName: fn, args });
        const [open, abandoned, last, deadline, paid, burned, redeemable, owner, params, avail, name, symbol, dispatched, pending, treasury, bal] = await Promise.all([
          rl("open"), rl("abandoned"), rl("lastHeartbeat"), rl("heartbeatDeadline"), rl("tapPaidNative"), rl("tokensBurned"), rl("redeemableSupply"), rl("owner"), rl("params"), rl("tapAvailable"),
          rt("name"), rt("symbol"), rt("taxDispatched"), rt("balanceOf", [r.token]), c.getBalance({ address: r.liteVault }), address ? rt("balanceOf", [address]) : Promise.resolve(undefined),
        ]);
        const p = params as readonly [number, number, number, number];
        const e = (x: unknown) => Number(formatEther(x as bigint));
        return {
          token: r.token, forwardVault: r.forwardVault, vault: r.liteVault, pair: r.pair, founder: r.founder, at: Number(r.at),
          name: name as string, symbol: symbol as string, owner: owner as Address,
          state: open ? (abandoned ? "ABANDONED" : "WOUND_DOWN") : "ACTIVE",
          treasury: e(treasury), taxDispatched: e(dispatched), pendingTax: e(pending), tapPaid: e(paid), tapAvailable: e((avail as readonly [bigint, bigint])[0]),
          tokensBurned: e(burned), redeemableSupply: e(redeemable), lastHeartbeat: Number(last), heartbeatDeadline: Number(deadline), now,
          params: { tapBps: p[0], tapPeriod: p[1], heartbeat: p[2], redeemFeeBps: p[3] },
          balance: bal === undefined ? undefined : e(bal),
        } satisfies LiteView;
      }));
    },
  });
  return { launcher, list: q.data ?? [], loading: q.isLoading, error: q.error ? (q.error as Error).message : undefined, source: src };
}

export type LiteAction = "withdrawTap" | "heartbeat" | "windDown" | "declareAbandoned" | "dispatch" | "redeem";

/** Writes for a Lite covenant through the connected wallet. */
export function useLiteActions() {
  const src = useSource();
  const config = useConfig();
  const qc = useQueryClient();
  async function run(l: LiteView, action: LiteAction, tokens?: number): Promise<Hash> {
    const chainId = src.chainId!;
    let hash: Hash;
    if (action === "dispatch") {
      hash = await writeContract(config, { address: l.token, abi: TOKEN, functionName: "dispatch", chainId } as Parameters<typeof writeContract>[1]);
    } else if (action === "redeem") {
      const amount = parseEther(String(tokens ?? 0));
      const ah = await writeContract(config, { address: l.token, abi: TOKEN, functionName: "approve", args: [l.vault, amount], chainId } as Parameters<typeof writeContract>[1]);
      await waitForTransactionReceipt(config, { hash: ah, chainId });
      hash = await writeContract(config, { address: l.vault, abi: LITE, functionName: "redeem", args: [amount, 0n, 0n], chainId } as Parameters<typeof writeContract>[1]);
    } else {
      hash = await writeContract(config, { address: l.vault, abi: LITE, functionName: action, chainId } as Parameters<typeof writeContract>[1]);
    }
    const rc = await waitForTransactionReceipt(config, { hash, chainId });
    if (rc.status !== "success") throw new Error(`${action} reverted`);
    await qc.invalidateQueries({ queryKey: ["lite"] });
    return hash;
  }
  return { run };
}

/** Local stand-in for Four.meme's token creation: one transaction on the dev chain (FourLiteLauncher.launch). */
export async function launchLiteLocal(
  config: Parameters<typeof writeContract>[0], chainId: number, launcher: Address, template: Address,
  t: { name: string; symbol: string; supply: number; taxBps: number; poolTokens: number; poolBnb: number }, f: LiteFields,
): Promise<Hash> {
  const hash = await writeContract(config, {
    address: launcher, abi: LAUNCHER, functionName: "launch", chainId, value: parseEther(String(t.poolBnb)),
    args: [t.name, t.symbol, parseEther(String(t.supply)), t.taxBps, encodeForwardVaultData(template, f), parseEther(String(t.poolTokens))],
  } as unknown as Parameters<typeof writeContract>[1]);
  const rc = await waitForTransactionReceipt(config, { hash, chainId });
  if (rc.status !== "success") throw new Error("launch reverted");
  return hash;
}
