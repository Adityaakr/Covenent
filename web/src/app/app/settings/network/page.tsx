"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/app/icons";
import { ConnectChain } from "@/components/app/live";
import { Addr, Skeleton } from "@/components/app/ui";
import { API_BASE } from "@/lib/api/server";
import { chainName, explorerAddress } from "@/lib/chain/chains";
import { useSource } from "@/lib/data/hooks";

type Group = "covenant" | "integrations" | "roles";
/** What each address in the deployment record is, in the words a tester needs. Unknown keys still show, under Other. */
const KNOWN: Record<string, { label: string; what: string; group: Group }> = {
  launcherFactory: { label: "Launcher factory", what: "Creates each covenant's raise", group: "covenant" },
  vaultFactory: { label: "Vault factory", what: "Creates the vault that holds a treasury", group: "covenant" },
  demoLauncherFactory: { label: "Demo launcher factory", what: "Same rules, timers in minutes", group: "covenant" },
  demoVaultFactory: { label: "Demo vault factory", what: "Vaults for the demo launchers", group: "covenant" },
  oracle: { label: "Covenant oracle", what: "BNB/USD for the tap and exit streak", group: "covenant" },
  lens: { label: "Lens", what: "One-call reads for the app and agents", group: "covenant" },
  liteVaultTemplate: { label: "Lite vault template", what: "Four.meme tax vaults are cloned from it", group: "covenant" },
  portal: { label: "Flap Portal", what: "Launches the token and seeds its pool", group: "integrations" },
  taxTokenImpl: { label: "Flap tax token", what: "Implementation each launch clones", group: "integrations" },
  router: { label: "PancakeSwap router", what: "Pool trades", group: "integrations" },
  wbnb: { label: "WBNB", what: "Wrapped BNB", group: "integrations" },
  identityRegistry: { label: "ERC-8004 identities", what: "Agent issuers' on-chain identity", group: "integrations" },
  reputationRegistry: { label: "ERC-8004 reputation", what: "Outcomes written by covenant vaults", group: "integrations" },
  atlasPushBnbUsd: { label: "Atlas BNB/USD feed", what: "Push feed the oracle reads", group: "integrations" },
  dockRouter: { label: "Flap dock router", what: "Flap's launch router", group: "integrations" },
  guardian: { label: "Flap guardian", what: "Flap's launch guard", group: "integrations" },
  deployer: { label: "Deployer", what: "Deployed the contracts above", group: "roles" },
  atlasSigner: { label: "Atlas signer", what: "Signs pull-oracle reports", group: "roles" },
};
const GROUPS: { id: Group | "other"; title: string }[] = [
  { id: "covenant", title: "Covenant contracts" },
  { id: "integrations", title: "Integrations" },
  { id: "roles", title: "Roles" },
  { id: "other", title: "Other" },
];

/** Settings, Network: the chain this app reads, the server, and every address in the deployment record. */
export default function NetworkSettings() {
  const src = useSource();
  const d = src.payload?.deployment;
  const block = useQuery({ queryKey: ["block", src.chainId], enabled: Boolean(src.client), refetchInterval: 6_000, queryFn: async () => Number(await src.client!.getBlockNumber()) });
  const health = useQuery({
    queryKey: ["health"],
    retry: 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      return (await r.json()) as { ok: boolean; chainId: number; blockNumber: string | null; atlasMode: string; covenants: number };
    },
  });
  const entries = d ? Object.entries(d.addresses).filter((e): e is [string, string] => typeof e[1] === "string" && /^0x[0-9a-fA-F]{40}$/.test(e[1])) : [];
  const chainId = src.chainId ?? d?.chainId;
  const explorer = chainId === 97 ? "https://testnet.bscscan.com" : chainId === 56 ? "https://bscscan.com" : null;

  if (src.mode === "checking") return <div className="set-body"><Skeleton h={320} r={18} /></div>;
  if (!d) return <div className="set-body"><ConnectChain source={src} /></div>;

  return (
    <div className="set-body">
      <section className="set-sec" aria-labelledby="net-chain">
        <div className="set-intro">
          <h2 id="net-chain" className="h-sec">Chain and server</h2>
          <p className="t-s muted w5">Every figure in the app is read from these. Nothing is cached or stood in.</p>
        </div>
        <div className="set-card">
          <dl className="kv kv-wide">
            <dt>Network</dt><dd>{chainId ? chainName(chainId) : "–"}</dd>
            <dt>Chain id</dt><dd className="num">{chainId ?? "–"}</dd>
            <dt>Latest block</dt><dd className="num">{block.data !== undefined ? block.data.toLocaleString("en-US") : "–"}</dd>
            <dt>RPC</dt><dd className="mono anywhere">{d.rpcUrl ?? "–"}</dd>
            <dt>Explorer</dt><dd>{explorer ? <a className="tlink" href={explorer} target="_blank" rel="noreferrer">{explorer.replace("https://", "")}<Icon name="arrowUpRight" size={13} /></a> : "None for a local node"}</dd>
            <dt>Covenant server</dt><dd className="mono anywhere">{API_BASE}</dd>
            <dt>Server status</dt><dd>{health.isLoading ? "Checking" : health.data?.ok ? `Up · chain ${health.data.chainId} · oracle ${health.data.atlasMode}` : "Not answering"}</dd>
          </dl>
        </div>
      </section>

      <section className="set-sec" aria-labelledby="net-contracts">
        <div className="set-intro">
          <h2 id="net-contracts" className="h-sec">Contracts</h2>
          <p className="t-s muted w5">{chainId === 97 ? "Deployed to BNB testnet and source-verified. Open any of them on BscScan." : "From the deployment record this app loaded."}</p>
        </div>
        {GROUPS.map((g) => {
          const rows = entries.filter(([k]) => (KNOWN[k]?.group ?? "other") === g.id);
          if (!rows.length) return null;
          return (
            <div key={g.id} className="set-card contracts">
              <h3 className="set-card-t">{g.title}</h3>
              <ul>
                {rows.map(([k, a]) => {
                  const href = chainId ? explorerAddress(chainId, a) : null;
                  return (
                    <li key={k}>
                      <div style={{ minWidth: 0 }}>
                        <p className="set-row-t">{KNOWN[k]?.label ?? k}</p>
                        <p className="set-row-s">{KNOWN[k]?.what ?? "From the deployment record"}</p>
                      </div>
                      <div className="contracts-a">
                        <Addr a={a} />
                        {href ? <a className="icon-btn sm" href={href} target="_blank" rel="noreferrer" aria-label={`${KNOWN[k]?.label ?? k} on BscScan`} title="Open on BscScan"><Icon name="arrowUpRight" size={14} /></a> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
