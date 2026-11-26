/*
 * Which chain this build of the app serves. The default, with no environment at all, is BNB testnet (chain 97): the
 * deployment record and the ABIs are baked into the bundle (src/generated/testnet.json, from
 * contracts/deployments/97.json by scripts/bake-testnet.mjs), reads go to public BNB testnet RPCs, and nothing about a
 * local chain is shown. A local dev chain is opt-in only: NEXT_PUBLIC_CHAIN_ID=31337 (anvil) or 56 with a loopback
 * NEXT_PUBLIC_LOCAL_RPC (a BNB Chain fork), which scripts/dev-all.sh sets; then the app reads
 * contracts/deployments/local.json through /api/deployment as before.
 */
import type { DeploymentPayload } from "./deployment";
import baked from "@/generated/testnet.json";

const RAW_ID = process.env.NEXT_PUBLIC_CHAIN_ID;

/** true only when a developer opted into a local chain; never true on a default (hosted) build. */
export const LOCAL_MODE = RAW_ID !== undefined && RAW_ID !== "" && RAW_ID !== "97";

/** The chain the app reads and asks wallets to use. */
export const TARGET_CHAIN_ID = LOCAL_MODE ? Number(RAW_ID) : 97;

/** BNB testnet public RPCs, tried in order (each answers CORS requests from a browser). */
export const TESTNET_RPCS = [
  process.env.NEXT_PUBLIC_BSC_TESTNET_RPC,
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  // BNB Chain's own endpoint; it also serves older receipts that publicnode answers with null. (Blast API shut down.)
  "https://bsc-testnet.bnbchain.org",
].filter((u): u is string => Boolean(u));

/** The baked BNB testnet deployment, in the same shape /api/deployment serves for a local chain. */
export const TESTNET_PAYLOAD = baked as unknown as DeploymentPayload;
