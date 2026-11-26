import { NextResponse } from "next/server";
import { loadLocalDeployment } from "@/lib/chain/load-deployment";
import { LOCAL_MODE, TESTNET_PAYLOAD } from "@/lib/chain/target";

/*
 * The deployment record the app reads. On a local chain: contracts/deployments/local.json and the ABIs, read on each
 * request (lib/chain/load-deployment.ts). On the default BNB testnet build the record is baked into the bundle from
 * contracts/deployments/97.json, so this says so and serves that record (without the ABIs, which are in contracts/abi/).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!LOCAL_MODE) {
    const d = TESTNET_PAYLOAD.deployment;
    return NextResponse.json(
      { status: "testnet", record: "baked 97.json", chainId: d?.chainId, startBlock: d?.startBlock, addresses: d?.addresses ?? {}, abis: Object.keys(TESTNET_PAYLOAD.abis) },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(await loadLocalDeployment(), { headers: { "cache-control": "no-store" } });
}
