"use client";

/*
 * Demo USDC (dUSDC): worthless test funds, deployed on BNB testnet (deployments/97.json demoUsdc) and by the local dev
 * stack. Anyone mints 1,000 a day from the contract's open faucet() with their own wallet; no server is involved. It
 * exists for the agent economy demo: a visitor pays an issuer agent for a service in dUSDC and sees the agent's
 * dollar revenue next to its BNB treasury. Covenant treasuries stay BNB because Flap's pools are BNB-quoted.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, parseAbiItem, parseUnits, type Abi, type Address, type Hash } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { useWallet } from "@/components/providers";
import { addressOf } from "@/lib/chain/deployment";
import { useSource } from "./hooks";

export const DEMO_USDC_ABI = [
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "faucetAvailableAt", stateMutability: "view", inputs: [{ name: "who", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const satisfies Abi;
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** The dUSDC address on the chain the app reads, if the deployment names one and it has code there. */
export function useDemoUsdcAddress(): Address | undefined {
  const src = useSource();
  return src.payload?.deployment ? addressOf(src.payload.deployment, "demoUsdc") : undefined;
}

/** A wallet's dUSDC balance and when it can mint again (0 = now). */
export function useDemoUsdc(owner?: string) {
  const src = useSource();
  const token = useDemoUsdcAddress();
  return useQuery({
    queryKey: ["usdc", src.chainId, token, owner],
    enabled: src.mode === "live" && Boolean(token) && Boolean(owner),
    refetchInterval: 12_000,
    queryFn: async () => {
      const c = src.client!;
      const code = await c.getCode({ address: token! });
      if (!code || code === "0x") return { deployed: false as const };
      const [bal, next, block] = await Promise.all([
        c.readContract({ address: token!, abi: DEMO_USDC_ABI, functionName: "balanceOf", args: [owner as Address] }),
        c.readContract({ address: token!, abi: DEMO_USDC_ABI, functionName: "faucetAvailableAt", args: [owner as Address] }).catch(() => 0n),
        c.getBlock(),
      ]);
      // seconds until this wallet can mint again, by chain time (0 = now)
      const waitSeconds = next > 0n ? Math.max(0, Number(next) - Number(block.timestamp)) : 0;
      return { deployed: true as const, balance: Number(formatUnits(bal, 6)), nextAt: Number(next), waitSeconds };
    },
  });
}

/** dUSDC paid to an address (an agent's team wallet): total and payments, from Transfer logs. */
export function useUsdcRevenue(to?: Address) {
  const src = useSource();
  const token = useDemoUsdcAddress();
  return useQuery({
    queryKey: ["usdc-revenue", src.chainId, token, to],
    enabled: src.mode === "live" && Boolean(token) && Boolean(to),
    refetchInterval: 15_000,
    queryFn: async () => {
      const c = src.client!;
      const fromBlock = BigInt(src.payload?.deployment?.startBlock ?? 0);
      const [logs, bal] = await Promise.all([
        c.getLogs({ address: token!, event: TRANSFER, args: { to }, fromBlock }),
        c.readContract({ address: token!, abi: DEMO_USDC_ABI, functionName: "balanceOf", args: [to!] }),
      ]);
      const paid = logs.filter((l) => l.args.from && !/^0x0{40}$/i.test(l.args.from));
      const total = paid.reduce((n, l) => n + (l.args.value ?? 0n), 0n);
      return { total: Number(formatUnits(total, 6)), payments: paid.length, balance: Number(formatUnits(bal, 6)), last: paid.at(-1)?.transactionHash as Hash | undefined };
    },
  });
}

/** Send one dUSDC call from the connected wallet and wait for it: faucet() or a transfer to an agent. */
export function useUsdcWrite() {
  const wallet = useWallet();
  const src = useSource();
  const token = useDemoUsdcAddress();
  const config = useConfig();
  const qc = useQueryClient();
  const [state, setState] = useState<{ busy: boolean; hash?: Hash; error?: string }>({ busy: false });
  async function run(call: { kind: "mint" } | { kind: "pay"; to: Address; amount: number }) {
    if (!wallet.address) { wallet.connect(); return false; }
    if (!token || !src.chainId) return false;
    setState({ busy: true });
    try {
      const hash = call.kind === "mint"
        ? await writeContract(config, { address: token, abi: DEMO_USDC_ABI, functionName: "faucet", args: [], chainId: src.chainId })
        : await writeContract(config, { address: token, abi: DEMO_USDC_ABI, functionName: "transfer", args: [call.to, parseUnits(String(call.amount), 6)], chainId: src.chainId });
      const rc = await waitForTransactionReceipt(config, { hash, chainId: src.chainId });
      if (rc.status !== "success") throw new Error("The transaction reverted");
      setState({ busy: false, hash });
      await Promise.all([qc.invalidateQueries({ queryKey: ["usdc"] }), qc.invalidateQueries({ queryKey: ["usdc-revenue"] })]);
      return true;
    } catch (e) {
      const m = (e as { shortMessage?: string })?.shortMessage ?? (e as Error).message;
      setState({ busy: false, error: /User rejected|denied/i.test(m) ? "You rejected the request in your wallet." : /FaucetCooldown/.test(m) ? "This wallet already minted today. Try again tomorrow." : m.split("\n")[0]!.slice(0, 200) });
      return false;
    }
  }
  return { ...state, run, token };
}
