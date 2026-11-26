"use client";

/*
 * Local test funds: the server's faucet (test BNB from an anvil account plus Demo USDC) and the connected wallet's
 * balances, plus a dUSDC -> BNB swap on the local PancakeSwap pool scripts/dev-funds.sh seeds. Dev chain only: the
 * server refuses on anything but a loopback node, and the app shows its reason instead of a button.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEther, formatUnits, parseUnits, type Abi, type Address, type Hash } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { API_BASE } from "@/lib/api/server";
import { useWallet } from "@/components/providers";
import { useSource } from "./hooks";

export interface FaucetStatus {
  enabled: boolean;
  reason: string | null;
  bnb: string;
  usdc: string | null;
  demoUsdc: Address | null;
  demoUsdcPair: Address | null;
  router: Address | null;
  wbnb: Address | null;
  label: string;
}

const ERC20: Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
];
const ROUTER: Abi = [
  { type: "function", name: "getAmountsOut", stateMutability: "view", inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }], outputs: [{ type: "uint256[]" }] },
  {
    type: "function", name: "swapExactTokensForETHSupportingFeeOnTransferTokens", stateMutability: "nonpayable",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }],
    outputs: [],
  },
];

export function useFaucetStatus() {
  return useQuery({
    queryKey: ["faucet-status"],
    queryFn: async (): Promise<FaucetStatus> => {
      const res = await fetch(`${API_BASE}/api/faucet`, { cache: "no-store" });
      if (!res.ok) throw new Error(`server answered ${res.status}`);
      return res.json();
    },
    retry: 1,
    refetchInterval: 30_000,
  });
}

export function useBalances(usdc: Address | null | undefined) {
  const src = useSource();
  const { address } = useWallet();
  return useQuery({
    queryKey: ["balances", address, usdc, src.chainId],
    enabled: src.mode === "live" && Boolean(address),
    refetchInterval: 6_000,
    queryFn: async () => {
      const bnb = await src.client!.getBalance({ address: address! });
      const usdcRaw = usdc ? ((await src.client!.readContract({ address: usdc, abi: ERC20, functionName: "balanceOf", args: [address!] })) as bigint) : null;
      return { bnb: Number(formatEther(bnb)), usdc: usdcRaw === null ? null : Number(formatUnits(usdcRaw, 6)), usdcRaw };
    },
  });
}

export async function requestFunds(address: Address): Promise<{ bnbTx: Hash; usdcTx: Hash | null; bnbWei: string; usdc: string | null }> {
  const res = await fetch(`${API_BASE}/api/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `server answered ${res.status}`);
  return body;
}

export function useSwap(status?: FaucetStatus) {
  const src = useSource();
  const config = useConfig();
  const qc = useQueryClient();
  const { address } = useWallet();
  const path = status?.demoUsdc && status.wbnb ? [status.demoUsdc, status.wbnb] : null;

  async function quote(usdc: number): Promise<number | null> {
    if (!path || !status?.router || !src.client || !(usdc > 0)) return null;
    try {
      const out = (await src.client.readContract({ address: status.router, abi: ROUTER, functionName: "getAmountsOut", args: [parseUnits(String(usdc), 6), path] })) as bigint[];
      return Number(formatEther(out[out.length - 1]!));
    } catch {
      return null;
    }
  }

  async function swap(usdc: number): Promise<Hash> {
    if (!path || !status?.router || !address || !src.client || !src.chainId) throw new Error("Swap needs the local pool, a wallet and the chain");
    const amount = parseUnits(String(usdc), 6);
    const chainId = src.chainId;
    const ah = await writeContract(config, { address: status.demoUsdc!, abi: ERC20, functionName: "approve", args: [status.router, amount], chainId } as Parameters<typeof writeContract>[1]);
    await waitForTransactionReceipt(config, { hash: ah, chainId });
    const out = (await src.client.readContract({ address: status.router, abi: ROUTER, functionName: "getAmountsOut", args: [amount, path] })) as bigint[];
    const min = (out[out.length - 1]! * 98n) / 100n;
    const now = Number((await src.client.getBlock()).timestamp);
    const hash = await writeContract(config, {
      address: status.router, abi: ROUTER, functionName: "swapExactTokensForETHSupportingFeeOnTransferTokens",
      args: [amount, min, path, address, BigInt(now + 600)], chainId,
    } as Parameters<typeof writeContract>[1]);
    const rc = await waitForTransactionReceipt(config, { hash, chainId });
    if (rc.status !== "success") throw new Error("swap reverted");
    await qc.invalidateQueries({ queryKey: ["balances"] });
    return hash;
  }

  return { quote, swap, ready: Boolean(path && status?.router) };
}
