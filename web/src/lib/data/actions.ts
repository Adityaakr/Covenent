"use client";

/*
 * Every user action on a covenant, one hook. On mock data it runs the mock store (same formulas as the vault); on a
 * live deployment it sends the transaction with the loaded ABI through wagmi, waits for the receipt and refreshes
 * the reads. Progress goes to the toast stack (components/app/toasts.tsx).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { concatHex, encodeFunctionData, keccak256, parseEther, toHex, type Abi, type Hex } from "viem";
import { useConfig } from "wagmi";
import { sendTransaction, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { atlasReport } from "@/lib/api/server";
import { abiFor, pickFn } from "@/lib/chain/deployment";
import { bookValue, redeemQuote, redeemableSupply } from "@/lib/covenant/math";
import type { Address, CovenantView, Hash } from "@/lib/covenant/types";
import { useWallet } from "@/components/providers";
import { useSource } from "./hooks";
import { mockAct } from "./mock-store";

export type ActionName =
  | "commit" | "finalize" | "claimTokens" | "claimRefund" | "poke" | "redeem"
  | "claimTap" | "heartbeat" | "lowerTap" | "postReport" | "revenue" | "windDown" | "declareAbandoned" | "releaseTeam";

export const ACTION_LABEL: Record<ActionName, string> = {
  commit: "Commit BNB", finalize: "Finalize the raise", claimTokens: "Claim tokens", claimRefund: "Claim refund", poke: "Poke",
  redeem: "Redeem at book", claimTap: "Claim tap", heartbeat: "Send heartbeat", lowerTap: "Lower the tap", postReport: "Post report",
  revenue: "Send revenue to the vault", windDown: "Wind down", declareAbandoned: "Declare abandoned", releaseTeam: "Release unlocked tranches",
};

/* ---------- Toast store ---------- */
export interface Toast { id: number; title: string; status: "pending" | "done" | "error"; detail?: string; hash?: Hash; chainId?: number; mock?: boolean }
let toasts: Toast[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
function pushToast(t: Omit<Toast, "id">) { const id = nextId++; toasts = [{ ...t, id }, ...toasts].slice(0, 4); emit(); return id; }
function patchToast(id: number, p: Partial<Toast>) { toasts = toasts.map((t) => (t.id === id ? { ...t, ...p } : t)); emit(); if (p.status && p.status !== "pending") setTimeout(() => dismissToast(id), p.status === "error" ? 9000 : 5000); }
export function dismissToast(id: number) { toasts = toasts.filter((t) => t.id !== id); emit(); }
export function useToasts(): Toast[] {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => toasts, () => toasts);
}

function errorText(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/User rejected|denied/i.test(m)) return "You rejected the request in your wallet.";
  return m.split("\n")[0]!.slice(0, 220);
}

/** Tokens and BNB use 18 decimals; a number from an input becomes wei without float drift. */
const wei = (n: number) => parseEther(n.toFixed(18).replace(/\.?0+$/, "") || "0");

export function useActions(view?: CovenantView) {
  const src = useSource();
  const wallet = useWallet();
  const config = useConfig();
  const qc = useQueryClient();

  async function run(action: ActionName, arg?: number): Promise<boolean> {
    if (!view) return false;
    const title = ACTION_LABEL[action];
    if (view.source === "mock") {
      const id = pushToast({ title, status: "pending", mock: true });
      await new Promise((r) => setTimeout(r, 650));
      try {
        const hash = mockAct(view.id, action, arg);
        patchToast(id, { status: "done", hash, detail: "Mock transaction on demo data" });
        return true;
      } catch (e) {
        patchToast(id, { status: "error", detail: (e as Error).message });
        return false;
      }
    }

    if (!wallet.address) { wallet.connect(); return false; }
    const payload = src.payload;
    if (!payload?.deployment) return false;
    const L = abiFor(payload.abis, "CovenantLauncher", "Launcher");
    const V = abiFor(payload.abis, "CovenantVault", "Vault");
    const O = abiFor(payload.abis, "CovenantOracle", "Oracle");
    const chainId = payload.deployment.chainId;
    const id = pushToast({ title, status: "pending", detail: "Confirm in your wallet", chainId });

    const write = async (address: Address | undefined, abi: Abi | undefined, names: string[], args: unknown[] = [], value?: bigint): Promise<Hash> => {
      const fn = pickFn(abi, ...names);
      if (!address || !abi || !fn) throw new Error(`${names[0]} is not in the loaded ABI`);
      return writeContract(config, { address, abi, functionName: fn, args, value, chainId } as Parameters<typeof writeContract>[1]);
    };

    try {
      let hash: Hash;
      switch (action) {
        case "commit": hash = await write(view.launcher, L, ["contribute", "commit"], [], wei(arg ?? 0)); break;
        case "finalize": hash = await write(view.launcher, L, ["finalize"]); break;
        case "claimRefund": hash = await write(view.launcher, L, ["claimRefund"]); break;
        case "claimTokens": hash = await write(view.vault, V, ["claimTokens"]); break;
        case "claimTap": hash = await write(view.vault, V, ["claimTap"]); break;
        case "heartbeat": hash = await write(view.vault, V, ["heartbeat"]); break;
        case "lowerTap": hash = await write(view.vault, V, ["lowerTap"], [wei(arg ?? 0)]); break;
        case "windDown": hash = await write(view.vault, V, ["windDown"]); break;
        case "declareAbandoned": hash = await write(view.vault, V, ["declareAbandoned"]); break;
        case "releaseTeam": hash = await write(view.vault, V, ["releaseTeam"]); break;
        case "postReport": {
          const period = BigInt(view.disclosure.passed + 1);
          const uri = `ipfs://covenant-report-${view.terms.symbol.toLowerCase()}-${period}`;
          hash = await write(view.vault, V, ["postReport"], [period, uri, keccak256(toHex(uri))]);
          break;
        }
        case "revenue": {
          if (!view.vault) throw new Error("No vault yet");
          hash = await sendTransaction(config, { to: view.vault, value: wei(arg ?? 0), chainId });
          break;
        }
        case "redeem": {
          const amount = wei(arg ?? 0);
          const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;
          patchToast(id, { detail: "Approve the vault to take your tokens" });
          const ah = await writeContract(config, { address: view.token!, abi: erc20, functionName: "approve", args: [view.vault!, amount], chainId });
          await waitForTransactionReceipt(config, { hash: ah, chainId });
          const b = bookValue(view.treasury, view.owedTeam, redeemableSupply(view.terms.totalSupply, view.deadTokens, view.lockedTeam));
          const q = redeemQuote(arg ?? 0, b, view.terms.exitFeeBps, view.state === "WIND_DOWN");
          patchToast(id, { detail: "Confirm the redemption" });
          hash = await write(view.vault, V, ["redeem"], [amount, wei(q.out * 0.995)]);
          break;
        }
        case "poke": {
          const fn = pickFn(O, "poke");
          if (!view.oracle || !O || !fn) throw new Error("Oracle not in the deployment");
          const report = await atlasReport();
          let data: Hex = encodeFunctionData({ abi: O, functionName: fn, args: [view.vault] });
          if (report) data = concatHex([data, report.payload]);
          patchToast(id, { detail: report ? "Signed Atlas report attached" : "No signed report from the server: plain poke" });
          hash = await sendTransaction(config, { to: view.oracle, data, chainId });
          break;
        }
      }
      patchToast(id, { detail: "Waiting for the block", hash });
      const rc = await waitForTransactionReceipt(config, { hash, chainId });
      if (rc.status !== "success") throw new Error("Transaction reverted");
      patchToast(id, { status: "done", detail: `Included in block ${rc.blockNumber}`, hash });
      await qc.invalidateQueries({ queryKey: ["covenants"] });
      return true;
    } catch (e) {
      patchToast(id, { status: "error", detail: errorText(e) });
      return false;
    }
  }

  return { run, live: view?.source === "live", connected: Boolean(wallet.address) };
}
