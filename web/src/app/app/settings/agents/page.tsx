"use client";

import { Icon } from "@/components/app/icons";
import { CopyCode } from "@/components/app/live";
import { Addr } from "@/components/app/ui";
import { API_BASE } from "@/lib/api/server";
import { addressOf } from "@/lib/chain/deployment";
import { useSource } from "@/lib/data/hooks";

/** The Covenant MCP server's tools (server/mcp/tools.ts). Writes return unsigned transactions for the agent's wallet. */
const TOOLS: { group: string; names: string[] }[] = [
  { group: "Read", names: ["list_covenants", "get_terms", "get_status", "get_downside", "get_issuer", "get_market"] },
  { group: "Invest", names: ["commit", "claim_tokens", "claim_refund", "redeem"] },
  { group: "Keep the rules", names: ["poke", "declare_abandoned"] },
  { group: "Issuer only", names: ["claim_tap", "heartbeat", "lower_tap", "post_report"] },
];

/** Settings, Agents & MCP: how an AI agent reads covenants and acts on them, with the identities it is judged by. */
export default function AgentSettings() {
  const src = useSource();
  const d = src.payload?.deployment;
  const chainId = src.chainId ?? d?.chainId;
  const testnet = chainId === 97;
  const identity = d ? addressOf(d, "identityRegistry") : undefined;
  const reputation = d ? addressOf(d, "reputationRegistry") : undefined;
  const env = testnet
    ? `CHAIN_ID=97 RPC_URL=${d?.rpcUrl ?? "https://bsc-testnet-rpc.publicnode.com"} COVENANT_DEPLOYMENTS=$PWD/contracts/deployments/97.local.json`
    : "";
  const add = `claude mcp add covenant -- ${env ? `env ${env} ` : ""}pnpm --dir $PWD/server mcp`;

  return (
    <div className="set-body">
      <section className="set-sec" aria-labelledby="ag-mcp">
        <div className="set-intro">
          <h2 id="ag-mcp" className="h-sec">Connect an agent over MCP</h2>
          <p className="t-s muted w5">The Covenant MCP server gives any MCP client {TOOLS.reduce((a, g) => a + g.names.length, 0)} tools to read terms, price the downside and act. Writes come back as unsigned transactions for the agent&apos;s own wallet: the server never holds a key.</p>
        </div>
        <ol className="set-card set-steps">
          <li>
            <span className="n">1</span>
            <div>
              <p className="set-row-t">Get the server</p>
              <p className="set-row-s">From a checkout of the Covenant repository{testnet ? <>; <span className="mono">scripts/testnet-up.sh</span> writes the chain 97 record the server reads</> : null}.</p>
              <CopyCode text="pnpm --dir server install" />
            </div>
          </li>
          <li>
            <span className="n">2</span>
            <div>
              <p className="set-row-t">Add it to your client</p>
              <p className="set-row-s">Claude Code, from the repository root. Any MCP client runs the same stdio command.</p>
              <CopyCode text={add} wrap />
            </div>
          </li>
          <li>
            <span className="n">3</span>
            <div>
              <p className="set-row-t">Ask</p>
              <p className="set-row-s">&ldquo;Which covenants trade under book? Show my downside in the worst one.&rdquo; The agent signs anything it sends with its own key.</p>
            </div>
          </li>
        </ol>
        <div className="set-card tools">
          {TOOLS.map((g) => (
            <div key={g.group} className="tools-g">
              <p className="lbl">{g.group}</p>
              <div className="tools-n">{g.names.map((n) => <code key={n}>{n}</code>)}</div>
            </div>
          ))}
          <p className="t-xs muted w5">Skill-based agents read the same surface from <span className="mono">server/mcp/SKILL.md</span>.</p>
        </div>
      </section>

      <section className="set-sec" aria-labelledby="ag-http">
        <div className="set-intro">
          <h2 id="ag-http" className="h-sec">HTTP API and identities</h2>
          <p className="t-s muted w5">The same reads over HTTP, and the ERC-8004 registries an agent issuer is known by.</p>
        </div>
        <div className="set-card">
          <dl className="kv kv-wide">
            <dt>Covenants</dt><dd className="mono anywhere">GET {API_BASE}/api/covenants</dd>
            <dt>One covenant</dt><dd className="mono anywhere">GET {API_BASE}/api/covenants/:vault</dd>
            <dt>Unsigned tx</dt><dd className="mono anywhere">GET {API_BASE}/api/covenants/:vault/tx/:action</dd>
            <dt>Identity registry</dt><dd>{identity ? <Addr a={identity} chainId={chainId} /> : "–"}</dd>
            <dt>Reputation registry</dt><dd>{reputation ? <Addr a={reputation} chainId={chainId} /> : "–"}</dd>
          </dl>
        </div>
        <p className="t-xs muted w5 row" style={{ gap: 6 }}><Icon name="info" size={14} />Agents that issue covenants register an ERC-8004 identity; outcomes are written to its reputation by the vaults themselves.</p>
      </section>
    </div>
  );
}
