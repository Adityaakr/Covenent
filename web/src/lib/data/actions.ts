"use client";

/*
 * Every user action on a covenant, one hook. It sends the transaction with the loaded ABI through wagmi, waits for the receipt and refreshes
 * the reads. Progress goes to the toast stack (components/app/toasts.tsx).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { concatHex, encodeFunctionData, keccak256, parseEther, toHex, type Abi, type Hex } from "viem";
import { hasFn } from "@/lib/chain/deployment";
import { FINALIZE_GAS } from "@/lib/chain/gas";
import { useConfig } from "wagmi";
import { sendTransaction, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { pokeReport } from "@/lib/api/server";
import { abiFor, pickFn } from "@/lib/chain/deployment";
import { bookValue, redeemQuote, redeemableSupply } from "@/lib/covenant/math";
import type { Address, CovenantView, Hash } from "@/lib/covenant/types";
import { useWallet } from "@/components/providers";
import { useSource } from "./hooks";
import { planRedeem } from "./redeem-plan";

// finalize() is sent with an explicit gas limit (lib/chain/gas.ts): an estimate can fall short of its 15M launch guard.

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

const ERC20_MIN = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/** Tokens and BNB use 18 decimals; a number from an input becomes wei without float drift. */
const wei = (n: number) => parseEther(n.toFixed(18).replace(/\.?0+$/, "") || "0");

export function useActions(view?: CovenantView) {
  const src = useSource();
  const wallet = useWallet();
  const config = useConfig();
  const qc = useQueryClient();

  async function run(action: ActionName, arg?: number, opts?: { all?: boolean }): Promise<boolean> {
    if (!view) return false;
    const title = ACTION_LABEL[action];
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
        // finalize() requires a 15M gas floor before the Flap launch (a starved launch must not fail a healthy raise)
        case "finalize": {
          const fn = pickFn(L, "finalize");
          if (!view.launcher || !L || !fn) throw new Error("finalize is not in the loaded ABI");
          hash = await writeContract(config, { address: view.launcher, abi: L, functionName: fn, args: [], chainId, gas: FINALIZE_GAS } as Parameters<typeof writeContract>[1]);
          break;
        }
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
          // depositRevenue(tag) marks it as issuer revenue (and a heartbeat from the team wallet); a plain send also counts.
          hash = hasFn(V, "depositRevenue")
            ? await write(view.vault, V, ["depositRevenue"], [keccak256(toHex("issuer-revenue"))], wei(arg ?? 0))
            : await sendTransaction(config, { to: view.vault, value: wei(arg ?? 0), chainId });
          break;
        }
        case "redeem": {
          if (!view.vault || !view.token) throw new Error("No vault yet");
          const account = wallet.address as Address;
          // "Max" redeems the exact on-chain balance (a number input would leave dust or overshoot by rounding)
          const balance = src.client ? await src.client.readContract({ address: view.token, abi: ERC20_MIN, functionName: "balanceOf", args: [account] }).catch(() => undefined) : undefined;
          const amount = opts?.all && balance !== undefined ? balance : wei(arg ?? 0);
          if (amount <= 0n) throw new Error("Enter an amount to redeem");
          if (balance !== undefined && amount > balance) throw new Error("More than your token balance");
          const allowance = src.client ? await src.client.readContract({ address: view.token, abi: ERC20_MIN, functionName: "allowance", args: [account, view.vault] }).catch(() => undefined) : undefined;
          const plan = planRedeem({ amount, allowance, preview: undefined, fallbackOut: 0n });
          if (plan.approve !== null) {
            // approve exactly what this redemption burns, never an open-ended allowance
            patchToast(id, { detail: "Approve the vault to take exactly these tokens (1 of 2)" });
            const ah = await writeContract(config, { address: view.token, abi: ERC20_MIN, functionName: "approve", args: [view.vault, plan.approve], chainId });
            patchToast(id, { detail: "Waiting for the approval", hash: ah });
            await waitForTransactionReceipt(config, { hash: ah, chainId });
          }
          // the vault's own quote (book read on-chain, fee applied), else the same formula off-chain
          let expected: bigint | undefined;
          if (src.client && hasFn(V, "previewRedeem")) {
            expected = await src.client.readContract({ address: view.vault, abi: V!, functionName: "previewRedeem", args: [amount] }).then((x) => x as bigint).catch(() => undefined);
          }
          const b = bookValue(view.treasury, view.owedTeam, redeemableSupply(view.terms.totalSupply, view.deadTokens, view.lockedTeam));
          const final = planRedeem({ amount, allowance: amount, preview: expected, fallbackOut: wei(redeemQuote(Number(amount) / 1e18, b, view.terms.exitFeeBps, view.state === "WIND_DOWN").out) });
          patchToast(id, { detail: plan.approve !== null ? "Confirm the redemption (2 of 2)" : "Confirm the redemption" });
          hash = await write(view.vault, V, ["redeem"], [amount, final.minOut]);
          break;
        }
        case "poke": {
          const fn = pickFn(O, "poke");
          if (!view.oracle || !O || !fn) throw new Error("Oracle not in the deployment");
          // The server returns the signed Atlas report and the full poke(vault) call; without it, poke plainly
          // (the exit streak still counts on on-chain numbers; dollar rules wait for a report).
          const report = await pokeReport(view.vault);
          let data: Hex = encodeFunctionData({ abi: O, functionName: fn, args: [view.vault] });
          if (report?.tx?.data) data = report.tx.data;
          else if (report?.extraData) data = concatHex([data, report.extraData]);
          patchToast(id, { detail: report ? `Atlas report attached (${report.mode === "atlas" ? "Atlas" : "local test signer"})` : "No report from the server: plain poke" });
          hash = await sendTransaction(config, { to: report?.tx?.to ?? view.oracle, data, chainId });
          break;
        }
      }
      patchToast(id, { detail: "Waiting for the block", hash });
      const rc = await waitForTransactionReceipt(config, { hash, chainId });
      if (rc.status !== "success") throw new Error("Transaction reverted");
      patchToast(id, { status: "done", detail: `Included in block ${rc.blockNumber}`, hash });
      // the covenant views, the issuer's decisions and the header's wallet balances (BNB moved, maybe USDT)
      await Promise.all([qc.invalidateQueries({ queryKey: ["covenants"] }), qc.invalidateQueries({ queryKey: ["decisions"] }), qc.invalidateQueries({ queryKey: ["native-balance"] }), qc.invalidateQueries({ queryKey: ["usdc"] })]);
      return true;
    } catch (e) {
      patchToast(id, { status: "error", detail: errorText(e) });
      return false;
    }
  }

  return { run, live: view?.source === "live", connected: Boolean(wallet.address) };
}
