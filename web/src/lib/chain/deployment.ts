import type { Abi, AbiFunction } from "viem";
import type { Address } from "@/lib/covenant/types";

/** contracts/deployments/local.json, written by the contracts package's dev script. */
export interface Deployment {
  chainId: number;
  rpcUrl?: string;
  addresses: Record<string, unknown>;
  demo: Record<string, unknown>;
  startBlock?: number;
  /** "fork" (BNB Chain fork, chain id 56) or "mock" (offline stand-ins) */
  mode?: string;
}

export interface DeploymentPayload {
  status: "ok" | "partial" | "missing";
  dir: string;
  deployment?: Deployment;
  abis: Record<string, Abi>;
  problems: string[];
}

const isAddr = (v: unknown): v is Address => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

/** Find an address by key, case-insensitively, in `addresses` first and then in `demo`. */
export function addressOf(d: Deployment, ...keys: string[]): Address | undefined {
  for (const bag of [d.addresses, d.demo]) {
    for (const [k, v] of Object.entries(bag)) {
      if (keys.some((want) => k.toLowerCase() === want.toLowerCase()) && isAddr(v)) return v;
    }
  }
  return undefined;
}

/**
 * Every launcher the deployment names: keys that mention "launcher" but not "factory", single addresses or arrays,
 * at any depth of `demo` (for example demo.covenants[i].launcher).
 */
export function launchersOf(d: Deployment): Address[] {
  const out = new Set<string>();
  const walk = (v: unknown, key: string, depth: number) => {
    if (depth > 4) return;
    const k = key.toLowerCase();
    // covenant launchers only: not the factories, and not the Four.meme path's launcher (it creates Lite vaults)
    const wanted = k.includes("launcher") && !k.includes("factory") && !k.includes("four") && !k.includes("lite");
    if (isAddr(v)) { if (wanted) out.add(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key, depth + 1)); return; }
    if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) walk(vv, kk, depth + 1);
  };
  walk(d.addresses, "", 0);
  walk(d.demo, "", 0);
  return [...out] as Address[];
}

/** The ABI for a contract name, matched loosely (CovenantVault, covenantVault, Vault). */
export function abiFor(abis: Record<string, Abi>, ...names: string[]): Abi | undefined {
  for (const n of names) {
    const hit = Object.entries(abis).find(([k]) => k.toLowerCase() === n.toLowerCase());
    if (hit) return hit[1];
  }
  return undefined;
}

export function fn(abi: Abi | undefined, name: string): AbiFunction | undefined {
  return abi?.find((x): x is AbiFunction => x.type === "function" && x.name === name);
}

export function hasFn(abi: Abi | undefined, name: string): boolean {
  return fn(abi, name) !== undefined;
}

/** The first function name the ABI actually has, so one call site tolerates the spec name and a renamed one. */
export function pickFn(abi: Abi | undefined, ...names: string[]): string | undefined {
  return names.find((n) => hasFn(abi, n));
}

/** The contract names the app reads, and the functions it calls on each, for the ABI check in the trust panel. */
export const EXPECTED: Record<string, string[]> = {
  CovenantLauncher: ["contribute", "finalize", "claimRefund", "acceptedOf", "allocationOf", "terms", "state", "token", "vault"],
  CovenantVault: ["bookValue", "redeemableSupply", "state", "exitStreak", "owedTeam", "claimTokens", "claimTap", "lowerTap", "heartbeat", "redeem", "declareAbandoned", "windDown", "releaseTeam"],
  CovenantOracle: ["poke"],
};

export function abiDrift(abis: Record<string, Abi>): { contract: string; missing: string[] }[] {
  return Object.entries(EXPECTED).map(([c, fns]) => {
    const abi = abiFor(abis, c);
    return { contract: c, missing: abi ? fns.filter((f) => !hasFn(abi, f)) : ["(ABI file not found)"] };
  }).filter((x) => x.missing.length > 0);
}
