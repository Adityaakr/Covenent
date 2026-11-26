import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import "./app.css";
import { AppShell } from "@/components/app/shell";
import { Providers } from "@/components/providers";
import type { LocalChainInfo } from "@/lib/chain/chains";

export const metadata: Metadata = {
  title: { default: "App", template: "%s · Covenant" },
  description: "The operating stack for autonomous ventures. Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain.",
};
// The wallet's local chain comes from contracts/deployments/local.json, which changes on every dev-up run.
export const dynamic = "force-dynamic";

async function localChain(): Promise<LocalChainInfo | null> {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.COVENANT_CONTRACTS_DIR ?? "../contracts");
  try {
    const d = JSON.parse(await readFile(path.join(dir, "deployments", "local.json"), "utf8"));
    const id = Number(d.chainId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return { id, rpcUrl: typeof d.rpcUrl === "string" ? d.rpcUrl : process.env.NEXT_PUBLIC_LOCAL_RPC || "http://127.0.0.1:8545", mode: d.mode };
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers localChain={await localChain()}>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
