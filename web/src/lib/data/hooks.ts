"use client";

/*
 * One source switch for every screen. Live when contracts/deployments/local.json and the ABIs load and the chain
 * they name answers; otherwise the mock layer, with the reason shown in the app's status chip.
 */
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type PublicClient } from "viem";
import { anvil, bscTestnet, LOCAL_RPC, makeLocalChain } from "@/lib/chain/chains";
import { abiFor, addressOf, hasFn, launchersOf, type DeploymentPayload } from "@/lib/chain/deployment";
import { readCovenant } from "@/lib/chain/reader";
import type { Address, CovenantView } from "@/lib/covenant/types";
import { useWallet } from "@/components/providers";
import { useMock } from "./mock-store";

export interface SourceStatus {
  mode: "checking" | "live" | "mock";
  reason: string;
  payload?: DeploymentPayload;
  client?: PublicClient;
  chainId?: number;
  launchers?: Address[];
}

/** Launchers the deployment names, plus every launcher the launcher factory has created (allLaunchers()). */
async function discover(client: PublicClient, payload: DeploymentPayload): Promise<Address[]> {
  const d = payload.deployment!;
  const found = new Set(launchersOf(d).map((a) => a.toLowerCase()));
  const out: Address[] = [...launchersOf(d)];
  const F = abiFor(payload.abis, "CovenantLauncherFactory", "LauncherFactory");
  for (const key of ["launcherFactory", "covenantLauncherFactory", "demoLauncherFactory"]) {
    const f = addressOf(d, key);
    if (!f || !hasFn(F, "allLaunchers")) continue;
    try {
      const all = (await client.readContract({ address: f, abi: F!, functionName: "allLaunchers" })) as Address[];
      for (const a of all) if (!found.has(a.toLowerCase())) { found.add(a.toLowerCase()); out.push(a); }
    } catch { /* factory not deployed at this address */ }
  }
  return out;
}

async function probe(): Promise<SourceStatus> {
  let payload: DeploymentPayload;
  try {
    payload = await (await fetch("/api/deployment", { cache: "no-store" })).json();
  } catch {
    return { mode: "mock", reason: "Deployment loader unavailable" };
  }
  if (payload.status !== "ok" || !payload.deployment) {
    return { mode: "mock", reason: payload.problems[0] ?? "No local deployment yet", payload };
  }
  const d = payload.deployment;
  const chain = d.chainId === anvil.id ? anvil : d.chainId === 97 ? bscTestnet : makeLocalChain({ id: d.chainId, rpcUrl: d.rpcUrl || LOCAL_RPC });
  const client = createPublicClient({ chain, transport: http(d.rpcUrl || LOCAL_RPC, { timeout: 4000, retryCount: 0 }) }) as PublicClient;
  try {
    const id = await client.getChainId();
    if (id !== d.chainId) return { mode: "mock", reason: `RPC answers chain ${id}, deployment is for ${d.chainId}`, payload };
    const launchers = await discover(client, payload);
    if (launchers.length === 0) return { mode: "mock", reason: "Deployment names no launcher yet", payload };
    const code = await client.getCode({ address: launchers[0]! });
    if (!code || code === "0x") return { mode: "mock", reason: "Launcher has no code: the local chain was reset", payload };
    return { mode: "live", reason: `${launchers.length} covenant${launchers.length > 1 ? "s" : ""} on chain ${id}`, payload, client, chainId: id, launchers };
  } catch {
    return { mode: "mock", reason: `Local chain not reachable at ${d.rpcUrl || LOCAL_RPC}`, payload };
  }
}

export function useSource(): SourceStatus {
  const q = useQuery({ queryKey: ["source"], queryFn: probe, refetchInterval: 15_000, staleTime: 10_000 });
  return q.data ?? { mode: "checking", reason: "Checking for a local deployment" };
}

function useLiveCovenants(src: SourceStatus, account?: Address) {
  return useQuery({
    queryKey: ["covenants", src.mode, src.chainId, account],
    enabled: src.mode === "live",
    refetchInterval: 6_000,
    queryFn: async () => {
      const launchers = src.launchers ?? launchersOf(src.payload!.deployment!);
      const views = await Promise.all(launchers.map((l) => readCovenant({ client: src.client!, payload: src.payload!, account }, l)));
      // An agent's record spans its covenants: show every outcome written for the same ERC-8004 id on each sheet.
      return views.map((v) => {
        if (!v.issuer.agentId) return v;
        const all = views.filter((x) => x.issuer.agentId === v.issuer.agentId).flatMap((x) => x.issuer.outcomes);
        return { ...v, issuer: { ...v.issuer, outcomes: all.sort((p, q) => q.at - p.at) } };
      });
    },
  });
}

export interface CovenantsResult { list: CovenantView[]; source: SourceStatus; loading: boolean; error?: string }

export function useCovenants(): CovenantsResult {
  const src = useSource();
  const { address } = useWallet();
  const mock = useMock();
  const live = useLiveCovenants(src, address);
  if (src.mode === "live") {
    return { list: live.data ?? [], source: src, loading: live.isLoading, error: live.error ? (live.error as Error).message : undefined };
  }
  const order = ["lumen", "scout", "harbor", "moss", "fern"];
  const extra = Object.keys(mock.views).filter((k) => !order.includes(k));
  return { list: [...extra, ...order].map((id) => mock.views[id]!).filter(Boolean), source: src, loading: false };
}

export function useCovenant(id: string): { view?: CovenantView; source: SourceStatus; loading: boolean; error?: string } {
  const r = useCovenants();
  const view = r.list.find((v) => v.id.toLowerCase() === id.toLowerCase());
  // A live deployment still lets the demo flagship open at /app/c/lumen for the stage script.
  const mock = useMock();
  if (!view && r.source.mode === "live" && mock.views[id]) return { view: mock.views[id], source: { ...r.source, mode: "mock", reason: "Demo covenant (mock data)" }, loading: false };
  return { view, source: r.source, loading: r.loading, error: r.error };
}
