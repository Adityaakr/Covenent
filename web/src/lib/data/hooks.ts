"use client";

/*
 * One source for every screen: the contracts named by the deployment file (contracts/deployments/local.json, or
 * COVENANT_DEPLOYMENTS such as the BNB testnet record), read from the chain they name. There is no stand-in data. When the deployment or the chain is not there, screens show an empty state and
 * the app's status chip says why ("offline").
 */
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { anvil, bscTestnet, chainName, LOCAL_RPC, makeLocalChain } from "@/lib/chain/chains";
import { LOCAL_MODE, TESTNET_PAYLOAD, TESTNET_RPCS } from "@/lib/chain/target";
import { abiFor, addressOf, hasFn, launchersOf, type DeploymentPayload } from "@/lib/chain/deployment";
import { readCovenant } from "@/lib/chain/reader";
import type { Address, CovenantView } from "@/lib/covenant/types";
import { useWallet } from "@/components/providers";

export interface SourceStatus {
  mode: "checking" | "live" | "offline";
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
  if (!LOCAL_MODE) {
    payload = TESTNET_PAYLOAD; // baked at build time: no file, no server needed
  } else {
    try {
      payload = await (await fetch("/api/deployment", { cache: "no-store" })).json();
    } catch {
      return { mode: "offline", reason: "Deployment loader unavailable" };
    }
  }
  if (payload.status !== "ok" || !payload.deployment) {
    return { mode: "offline", reason: payload.problems[0] ?? "No local deployment yet", payload };
  }
  const d = payload.deployment;
  const chain = d.chainId === anvil.id ? anvil : d.chainId === 97 ? bscTestnet : makeLocalChain({ id: d.chainId, rpcUrl: d.rpcUrl || LOCAL_RPC });
  const transport = !LOCAL_MODE
    ? fallback(TESTNET_RPCS.map((u) => http(u, { timeout: 6000, retryCount: 1, batch: { batchSize: 32, wait: 16 } })))
    : http(d.rpcUrl || LOCAL_RPC, { timeout: 4000, retryCount: 0 });
  const client = createPublicClient({ chain, transport }) as PublicClient;
  try {
    const id = await client.getChainId();
    if (id !== d.chainId) return { mode: "offline", reason: `RPC answers chain ${id}, deployment is for ${d.chainId}`, payload };
    const launchers = await discover(client, payload);
    if (launchers.length === 0) {
      // A real deployment with no covenant yet (BNB testnet before the first create) is live and empty.
      const factory = addressOf(d, "demoLauncherFactory") ?? addressOf(d, "launcherFactory");
      const fcode = factory ? await client.getCode({ address: factory }) : undefined;
      if (fcode && fcode !== "0x") return { mode: "live", reason: `No covenant yet on chain ${id}`, payload, client, chainId: id, launchers };
      return { mode: "offline", reason: "Deployment names no launcher yet", payload };
    }
    const code = await client.getCode({ address: launchers[0]! });
    if (!code || code === "0x") return { mode: "offline", reason: `Launcher has no code on ${chainName(d.chainId)}${d.chainId === 31337 || d.mode === "fork" ? ": the local chain was reset" : ""}`, payload };
    return { mode: "live", reason: `${launchers.length} covenant${launchers.length > 1 ? "s" : ""} on chain ${id}`, payload, client, chainId: id, launchers };
  } catch {
    return { mode: "offline", reason: LOCAL_MODE ? `${chainName(d.chainId)} not reachable at ${d.rpcUrl || LOCAL_RPC}` : `${chainName(d.chainId)} did not answer; trying again shortly`, payload };
  }
}

export function useSource(): SourceStatus {
  const q = useQuery({ queryKey: ["source"], queryFn: probe, refetchInterval: 15_000, staleTime: 10_000 });
  return q.data ?? { mode: "checking", reason: "Checking for the deployment" };
}

function useLiveCovenants(src: SourceStatus, account?: Address) {
  return useQuery({
    queryKey: ["covenants", src.mode, src.chainId, account],
    enabled: src.mode === "live",
    refetchInterval: 6_000,
    queryFn: async () => {
      const launchers = src.launchers ?? launchersOf(src.payload!.deployment!);
      // only addresses that answer as covenant launchers (their terms() reads): never a view filled from defaults
      const L = abiFor(src.payload!.abis, "CovenantLauncher", "Launcher");
      const real = await Promise.all(launchers.map((l) => src.client!.readContract({ address: l, abi: L!, functionName: "terms" }).then(() => true, () => false)));
      const views = await Promise.all(launchers.filter((_, i) => real[i]).map((l) => readCovenant({ client: src.client!, payload: src.payload!, account }, l)));
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
  const live = useLiveCovenants(src, address);
  if (src.mode !== "live") return { list: [], source: src, loading: src.mode === "checking" };
  return { list: live.data ?? [], source: src, loading: live.isLoading, error: live.error ? (live.error as Error).message : undefined };
}

export function useCovenant(id: string): { view?: CovenantView; source: SourceStatus; loading: boolean; error?: string } {
  const r = useCovenants();
  const view = r.list.find((v) => v.id.toLowerCase() === id.toLowerCase() || v.vault?.toLowerCase() === id.toLowerCase());
  return { view, source: r.source, loading: r.loading, error: r.error };
}
