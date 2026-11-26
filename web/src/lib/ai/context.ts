/*
 * What one Ask AI request reads from: the deployment (baked BNB testnet record, or the local dev chain's file when a
 * developer opted in), a public client for that chain, and a per-request cache of covenant views. The chain is
 * allowlisted: BNB testnet (97) always; a local chain (31337, or a BNB Chain fork reporting 56) only in local mode and
 * only through a loopback RPC. Nothing here can sign.
 */
import { createPublicClient, fallback, http, isAddress, type PublicClient } from "viem";
import { bscTestnet } from "viem/chains";
import { LOCAL_RPC, makeLocalChain } from "@/lib/chain/chains";
import type { DeploymentPayload } from "@/lib/chain/deployment";
import { discoverLaunchers } from "@/lib/chain/discover";
import { readCovenant } from "@/lib/chain/reader";
import { LOCAL_MODE, TESTNET_PAYLOAD, TESTNET_RPCS } from "@/lib/chain/target";
import type { Address, CovenantView } from "@/lib/covenant/types";

export class ChainUnavailable extends Error {}

const loopback = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);

export interface AiContext {
  client: PublicClient;
  payload: DeploymentPayload;
  chainId: number;
  account?: Address;
  /** every covenant on the chain, read once per request (with the account's positions) */
  views(): Promise<CovenantView[]>;
  /** a covenant by launcher or vault address, symbol or name */
  find(ref: string): Promise<CovenantView>;
}

/*
 * Provenance: a covenant is only ever a launcher the deployment record names or one our launcher factories list in
 * allLaunchers() (and whose terms() reads). find() resolves only among those, so an address the model or a user
 * types never becomes a covenant, and a transfer target (pay_agent_usdc) is always such a covenant's team wallet.
 */

/** The chain ids Ask AI will read and build transactions for, given the build's mode. */
export function allowedChain(chainId: number, rpcUrl: string | undefined): boolean {
  if (chainId === 97) return true;
  return LOCAL_MODE && (chainId === 31337 || chainId === 56) && loopback(rpcUrl || LOCAL_RPC);
}

export async function loadContext(account?: string, opts: { payload?: DeploymentPayload; client?: PublicClient } = {}): Promise<AiContext> {
  let payload = opts.payload;
  if (!payload) {
    if (!LOCAL_MODE) payload = TESTNET_PAYLOAD;
    else {
      const { loadLocalDeployment } = await import("@/lib/chain/load-deployment");
      payload = await loadLocalDeployment();
    }
  }
  const d = payload.deployment;
  if (payload.status !== "ok" || !d) throw new ChainUnavailable(payload.problems[0] ?? "No deployment");
  if (!allowedChain(d.chainId, d.rpcUrl)) throw new ChainUnavailable(`Chain ${d.chainId} is not one Ask AI serves`);
  const client = opts.client ?? (createPublicClient({
    chain: d.chainId === 97 ? bscTestnet : makeLocalChain({ id: d.chainId, rpcUrl: d.rpcUrl || LOCAL_RPC }),
    transport: d.chainId === 97
      ? fallback(TESTNET_RPCS.map((u) => http(u, { timeout: 8000, retryCount: 1, batch: { batchSize: 32, wait: 16 } })))
      : http(d.rpcUrl || LOCAL_RPC, { timeout: 4000, retryCount: 0 }),
  }) as PublicClient);
  const acct = account && isAddress(account) ? (account as Address) : undefined;

  let all: Promise<CovenantView[]> | null = null;
  const ctx: AiContext = {
    client, payload, chainId: d.chainId, account: acct,
    views() {
      all ??= (async () => {
        // readCovenant throws for an address that does not answer as a covenant launcher: keep only the ones that do
        const launchers = await discoverLaunchers(client, payload!);
        const read = await Promise.allSettled(launchers.map((l) => readCovenant({ client, payload: payload!, account: acct }, l)));
        return read.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      })();
      return all;
    },
    async find(ref: string) {
      const r = ref.trim().toLowerCase().replace(/^\$/, "");
      const list = await ctx.views();
      const hit = list.find((v) => v.id.toLowerCase() === r || v.launcher?.toLowerCase() === r || v.vault?.toLowerCase() === r || v.token?.toLowerCase() === r)
        ?? list.find((v) => v.terms.symbol.toLowerCase() === r)
        ?? list.find((v) => v.terms.name.toLowerCase() === r)
        ?? list.find((v) => v.terms.name.toLowerCase().includes(r) && r.length >= 3);
      if (!hit) throw new Error(`No covenant matches "${ref}". Call list_covenants for the ids.`);
      return hit;
    },
  };
  return ctx;
}
