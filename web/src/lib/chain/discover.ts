/*
 * Which covenants exist: the launchers the deployment names, plus every launcher the launcher factories have created
 * (allLaunchers()). Shared by the browser (lib/data/hooks) and the Ask AI route (lib/ai), so both see the same list.
 */
import type { PublicClient } from "viem";
import type { Address } from "@/lib/covenant/types";
import { abiFor, addressOf, hasFn, launchersOf, type DeploymentPayload } from "./deployment";

export async function discoverLaunchers(client: PublicClient, payload: DeploymentPayload): Promise<Address[]> {
  const d = payload.deployment!;
  const found = new Set(launchersOf(d).map((a) => a.toLowerCase()));
  const out: Address[] = [...launchersOf(d)];
  const F = abiFor(payload.abis, "CovenantLauncherFactory", "LauncherFactory");
  // every factory at once (the transport batches them), not one round trip after another
  const factories = ["launcherFactory", "covenantLauncherFactory", "demoLauncherFactory"].map((k) => addressOf(d, k)).filter((f): f is Address => Boolean(f) && hasFn(F, "allLaunchers"));
  const lists = await Promise.all(factories.map((f) => client.readContract({ address: f, abi: F!, functionName: "allLaunchers" }).then((x) => x as Address[], () => [] as Address[])));
  for (const all of lists) for (const a of all) if (!found.has(a.toLowerCase())) { found.add(a.toLowerCase()); out.push(a); }
  return out;
}
