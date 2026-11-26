import { NextResponse } from "next/server";
import { loadLocalDeployment } from "@/lib/chain/load-deployment";

/* The local chain's deployment record and ABIs for the browser (lib/chain/load-deployment.ts reads them). */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadLocalDeployment(), { headers: { "cache-control": "no-store" } });
}
