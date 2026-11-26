/*
 * Which covenants exist: the launchers the deployment names, plus every launcher the launcher factories have created
 * (allLaunchers()), on every launcher factory the record names, current and earlier. Shared by the browser (lib/data/hooks) and the Ask AI route (lib/ai), so both see the same list.
 */
import type { PublicClient } from "viem";
import type { Address } from "@/lib/covenant/types";
import { abiFor, hasFn, launchersOf, type DeploymentPayload } from "./deployment";

export async function discoverLaunchers(client: PublicClient, payload: DeploymentPayload): Promise<Address[]> {
  const d = payload.deployment!;
  const found = new Set(launchersOf(d).map((a) => a.toLowerCase()));
  const out: Address[] = [...launchersOf(d)];
  const F = abiFor(payload.abis, "CovenantLauncherFactory", "LauncherFactory");
  // every factory at once (the transport batches them), not one round trip after another
  // Every covenant launcher factory the record names, current and earlier (previous*, round1*): a covenant created on
  // any of them is ours. Not the Four.meme path's factories (they make Lite vaults).
  const factories = [...new Set(Object.entries(d.addresses)
    .filter(([k, v]) => /launcherfactory$/i.test(k) && !/four|lite/i.test(k) && typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v))
    .map(([, v]) => (v as string).toLowerCase()))] as Address[];
  if (!hasFn(F, "allLaunchers")) return out;
  const lists = await Promise.all(factories.map((f) => client.readContract({ address: f, abi: F!, functionName: "allLaunchers" }).then((x) => x as Address[], () => [] as Address[])));
  for (const all of lists) for (const a of all) if (!found.has(a.toLowerCase())) { found.add(a.toLowerCase()); out.push(a); }
  return out;
}
