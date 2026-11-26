import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { DeploymentPayload } from "@/lib/chain/deployment";

/*
 * The typed loader's server half. It reads contracts/deployments/local.json and every contracts/abi/<Contract>.json
 * on each request, so a fresh `scripts/dev-*` run shows up without rebuilding the app and nothing is hard-coded.
 * ABI files may be a bare ABI array or a Foundry artifact with an `abi` field.
 */
export const dynamic = "force-dynamic";

const CONTRACTS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.COVENANT_CONTRACTS_DIR ?? "../contracts");

/** COVENANT_DEPLOYMENTS (relative to web/) picks another record in the same shape, e.g. the BNB testnet one. */
const DEPLOYMENT_FILE = process.env.COVENANT_DEPLOYMENTS
  ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.COVENANT_DEPLOYMENTS)
  : path.join(CONTRACTS_DIR, "deployments", "local.json");

function isLoopbackUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

export async function GET() {
  const deploymentFile = DEPLOYMENT_FILE;
  const name = path.basename(deploymentFile);
  const abiDir = path.join(CONTRACTS_DIR, "abi");
  const payload: DeploymentPayload = { status: "missing", dir: path.relative(process.cwd(), CONTRACTS_DIR) || ".", abis: {}, problems: [] };

  try {
    const raw = JSON.parse(await readFile(deploymentFile, "utf8"));
    if (typeof raw !== "object" || raw === null || typeof raw.addresses !== "object") {
      payload.problems.push(`deployments/${name} has no addresses object`);
    } else {
      payload.deployment = {
        chainId: Number(raw.chainId ?? 31337),
        // Only a loopback dev-chain RPC is served to the browser: a hosted RPC URL can carry an API key in its path
        // or query, and the testnet build reads public RPCs (lib/chain/target.ts) anyway.
        rpcUrl: typeof raw.rpcUrl === "string" && isLoopbackUrl(raw.rpcUrl) ? raw.rpcUrl : undefined,
        addresses: raw.addresses,
        demo: typeof raw.demo === "object" && raw.demo !== null ? raw.demo : {},
        // First block worth reading logs from. On a fork, deployedAtBlock is the fork block itself, and any log range
        // that touches it makes anvil ask the upstream public RPC (which rate-limits), so start one block above it.
        startBlock: raw.startBlock ?? (typeof raw.deployedAtBlock === "number" ? raw.deployedAtBlock + (raw.mode === "fork" ? 1 : 0) : undefined),
        mode: typeof raw.mode === "string" ? raw.mode : undefined,
      };
    }
  } catch (e) {
    payload.problems.push(`deployments/${name}: ${(e as NodeJS.ErrnoException).code === "ENOENT" ? "not written yet" : (e as Error).message}`);
  }

  try {
    for (const f of await readdir(abiDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(await readFile(path.join(abiDir, f), "utf8"));
        const abi = Array.isArray(j) ? j : Array.isArray(j?.abi) ? j.abi : null;
        if (abi) payload.abis[f.replace(/\.json$/, "")] = abi;
        else payload.problems.push(`abi/${f}: no ABI array`);
      } catch (e) {
        payload.problems.push(`abi/${f}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    payload.problems.push(`abi/: ${(e as NodeJS.ErrnoException).code === "ENOENT" ? "not written yet" : (e as Error).message}`);
  }

  if (payload.deployment && Object.keys(payload.abis).length > 0) payload.status = "ok";
  else if (payload.deployment || Object.keys(payload.abis).length > 0) payload.status = "partial";
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
