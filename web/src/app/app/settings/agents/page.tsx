"use client";

import { useState } from "react";
import { Icon } from "@/components/app/icons";
import { CopyCode } from "@/components/app/live";
import { Addr } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { API_BASE, HAS_SERVER } from "@/lib/api/server";
import { addressOf } from "@/lib/chain/deployment";
import { useCovenants, useSource } from "@/lib/data/hooks";

/**
 * The Covenant MCP server's tools (server/mcp/tools.ts, READ_TOOLS and WRITE_TOOLS). Writes return an unsigned
 * transaction and its simulation for the agent's own wallet. server/test/unit/llms.test.ts checks this list.
 */
const TOOLS: { group: string; names: string[] }[] = [
  { group: "Find and read", names: ["get_network", "list_covenants", "get_covenant", "get_terms", "get_status", "get_raise", "get_issuer", "get_market", "get_events"] },
  { group: "Plan", names: ["get_actions", "get_position", "get_downside", "simulate_transaction"] },
  { group: "Invest", names: ["commit", "finalize", "claim_tokens", "claim_refund", "redeem"] },
  { group: "Keep the rules", names: ["poke", "declare_abandoned", "release_team", "deposit_revenue"] },
  { group: "Issuer only", names: ["claim_tap", "heartbeat", "lower_tap", "post_report", "wind_down"] },
];
const TOOL_COUNT = TOOLS.reduce((a, g) => a + g.names.length, 0);
const REPO = "https://github.com/Adityaakr/Covenent";
const DIR = "/absolute/path/to/Covenent";

type Client = "claude-code" | "claude-desktop" | "cursor" | "http";
const CLIENTS: { id: Client; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
  { id: "http", label: "Remote (HTTP)" },
];

/** One client's setup: where the config goes and what to paste. Network env follows the chain this build serves. */
function clientSetup(client: Client, testnet: boolean): { where: string; text: string } {
  const envKey = testnet ? "COVENANT_NETWORK" : "COVENANT_DEPLOYMENTS";
  const envVal = testnet ? "testnet" : `${DIR}/contracts/deployments/local.json`;
  const json = JSON.stringify({ mcpServers: { covenant: { command: "pnpm", args: ["--dir", `${DIR}/server`, "mcp"], env: { [envKey]: envVal } } } }, null, 2);
  switch (client) {
    case "claude-code":
      return { where: "Run once from any directory. The server starts when Claude Code needs it.", text: `claude mcp add covenant -e ${envKey}=${envVal} -- pnpm --dir ${DIR}/server mcp` };
    case "claude-desktop":
      return { where: "Add to claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/; Windows: %APPDATA%\\Claude\\), then restart Claude Desktop.", text: json };
    case "cursor":
      return { where: "Add to .cursor/mcp.json in a project, or ~/.cursor/mcp.json for every project.", text: json };
    case "http":
      return {
        where: "Stateless streamable HTTP, read tools only (MCP_HTTP_WRITES=1 adds the unsigned writes). Start it, then point any client that speaks HTTP MCP at the URL.",
        text: `${testnet ? "COVENANT_NETWORK=testnet " : ""}pnpm --dir ${DIR}/server mcp:http\nclaude mcp add --transport http covenant http://127.0.0.1:8788/mcp`,
      };
  }
}

/** A code block that keeps line breaks, with a copy button. */
function CopyBlock({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="code block">
      <span>{text}</span>
      <button type="button" aria-label={done ? "Copied" : "Copy"} title={done ? "Copied" : "Copy"} onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}>
        <Icon name={done ? "check" : "copy"} size={13} />
      </button>
    </span>
  );
}

/** Settings, Agents & MCP: how an AI agent reads covenants and acts on them, with the identities it is judged by. */
export default function AgentSettings() {
  const src = useSource();
  const { list } = useCovenants();
  const wallet = useWallet();
  const [client, setClient] = useState<Client>("claude-code");
  const d = src.payload?.deployment;
  const chainId = src.chainId ?? d?.chainId;
  const testnet = chainId === 97 || chainId === undefined;
  const identity = d ? addressOf(d, "identityRegistry") : undefined;
  const reputation = d ? addressOf(d, "reputationRegistry") : undefined;
  const setup = clientSetup(client, testnet);

  // The example session uses a covenant this page just read from the chain, and the connected wallet when there is one.
  const live = list.find((c) => c.token) ?? list[0];
  const covenant = live?.token ?? live?.vault ?? live?.launcher;
  const who = wallet.address;
  const session: { tool: string; args: string; gives: string }[] = [
    { tool: "get_network", args: "{}", gives: "chain 97, the RPC host, the oracle, lens and factories, the per-call cap" },
    { tool: "list_covenants", args: "{}", gives: "every launched covenant and every open raise" },
    ...(covenant
      ? [
          { tool: "get_covenant", args: `{ "covenant": "${covenant}" }`, gives: "vault, token, launcher and pool; state, treasury, book value, premium to book" },
          { tool: "get_terms", args: `{ "covenant": "${covenant}" }`, gives: "the five rules in numbers and a plain summary" },
          { tool: "get_actions", args: `{ "covenant": "${covenant}"${who ? `, "wallet": "${who}"` : ""} }`, gives: "each action with yes or no, who may sign, and why" },
          { tool: "get_downside", args: `{ "covenant": "${covenant}", "tokens": "1000" }`, gives: "redeem at book now vs. sell into the pool, and the floor path" },
          { tool: "commit", args: `{ "covenant": "${covenant}", "amount_bnb": "0.01"${who ? `, "from": "${who}"` : ""} }`, gives: "an unsigned contribute() with an eth_call simulation: a closed raise comes back as SaleClosed" },
        ]
      : []),
  ];

  return (
    <div className="set-body">
      <section className="set-sec" aria-labelledby="ag-mcp">
        <div className="set-intro">
          <h2 id="ag-mcp" className="h-sec">Connect an agent over MCP</h2>
          <p className="t-s muted w5">The Covenant MCP server gives any MCP client {TOOL_COUNT} tools, 3 prompts and 3 resources to read terms, see what a wallet can do now and why, price the downside and act. Writes come back as unsigned transactions with a simulation for the agent&apos;s own wallet: the server never holds a key. With no local chain it reads BNB testnet from the committed deployment record, so reads need no key and no setup beyond the install.</p>
        </div>
        <ol className="set-card set-steps">
          <li>
            <span className="n">1</span>
            <div>
              <p className="set-row-t">Get the server</p>
              <p className="set-row-s">Node 22 and pnpm. The server is a standalone package in the repository.</p>
              <CopyCode text={`git clone ${REPO} && pnpm --dir Covenent/server install`} wrap />
            </div>
          </li>
          <li>
            <span className="n">2</span>
            <div>
              <p className="set-row-t">Add it to your client</p>
              <div className="seg sm" role="group" aria-label="MCP client" style={{ marginTop: 8 }}>
                {CLIENTS.map((c) => (
                  <button key={c.id} type="button" aria-pressed={client === c.id} onClick={() => setClient(c.id)}>{c.label}</button>
                ))}
              </div>
              <p className="set-row-s" style={{ marginTop: 8 }}>{setup.where} Replace <span className="mono">{DIR}</span> with your checkout.</p>
              <CopyBlock text={setup.text} />
            </div>
          </li>
          <li>
            <span className="n">3</span>
            <div>
              <p className="set-row-t">Ask</p>
              <p className="set-row-s">&ldquo;Which covenants are on BNB testnet? Explain the first one, then tell me what my wallet can do with it now.&rdquo; The agent signs anything it sends with its own key; the server only builds and simulates.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="set-sec" aria-labelledby="ag-session">
        <div className="set-intro">
          <h2 id="ag-session" className="h-sec">An example session</h2>
          <p className="t-s muted w5">
            The calls an agent makes on a first look, in order{covenant ? ", filled in with a covenant this page just read from the chain" : ""}{who ? " and your connected wallet" : ""}.
            {" "}A full run with every response, recorded on BNB testnet, is in <a className="link" href={`${REPO}/blob/main/docs/AGENT-DEMO.md`} target="_blank" rel="noreferrer">docs/AGENT-DEMO.md</a>; <span className="mono">pnpm --dir server demo:agent</span> replays it live.
          </p>
        </div>
        <div className="set-card">
          <ol className="kv kv-wide" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {session.map((s, i) => (
              <li key={s.tool + i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : 0, minWidth: 0 }}>
                <p className="t-s ink w5"><span className="mono">{i + 1}. {s.tool}</span></p>
                <p className="mono t-xs anywhere muted" style={{ marginTop: 4 }}>{s.args}</p>
                <p className="t-xs muted w5" style={{ marginTop: 4 }}>{s.gives}</p>
              </li>
            ))}
          </ol>
          {!covenant ? <p className="t-xs muted w5" style={{ marginTop: 8 }}>{src.mode === "live" ? "No covenant on this chain yet, so the session stops after the list." : "The chain has not answered yet; the covenant-specific calls appear once it does."}</p> : null}
        </div>
      </section>

      <section className="set-sec" aria-labelledby="ag-tools">
        <div className="set-intro">
          <h2 id="ag-tools" className="h-sec">Tools, prompts and resources</h2>
          <p className="t-s muted w5">Every covenant tool takes any of its addresses: vault, token, launcher or pool. Units are in the argument names (<span className="mono">amount_bnb</span>, <span className="mono">tokens_wei</span>).</p>
        </div>
        <div className="set-card tools">
          {TOOLS.map((g) => (
            <div key={g.group} className="tools-g">
              <p className="lbl">{g.group}</p>
              <div className="tools-n">{g.names.map((n) => <code key={n}>{n}</code>)}</div>
            </div>
          ))}
          <div className="tools-g">
            <p className="lbl">Prompts</p>
            <div className="tools-n">{["explain_covenant", "should_i_redeem", "before_you_commit"].map((n) => <code key={n}>{n}</code>)}</div>
          </div>
          <div className="tools-g">
            <p className="lbl">Resources</p>
            <div className="tools-n">{["covenant://network", "covenant://guide", "covenant://covenants/{address}"].map((n) => <code key={n}>{n}</code>)}</div>
          </div>
          <p className="t-xs muted w5">Skill-based agents read the same surface from <span className="mono">server/mcp/SKILL.md</span>; crawlers from <a className="link" href="/llms.txt">/llms.txt</a> and <a className="link" href="/llms-full.txt">/llms-full.txt</a>.</p>
        </div>
        <div className="set-card">
          <dl className="kv kv-wide">
            <dt>Signing</dt><dd>Never. Writes return <span className="mono">unsignedTransaction</span>, <span className="mono">simulation</span> (eth_call with the revert decoded) and <span className="mono">howToSend</span>.</dd>
            <dt>Chains</dt><dd>31337, 56 on a loopback fork, and 97. The RPC&apos;s chain id must match the deployment record.</dd>
            <dt>Spend cap</dt><dd>At most 1 BNB per built transaction on testnet (<span className="mono">COVENANT_MAX_VALUE_BNB</span>).</dd>
            <dt>Untrusted text</dt><dd>Token names, descriptions, URIs and event args are sanitized and listed in <span className="mono">untrustedFields</span>; prompts fence them as data.</dd>
          </dl>
        </div>
      </section>

      <section className="set-sec" aria-labelledby="ag-http">
        <div className="set-intro">
          <h2 id="ag-http" className="h-sec">HTTP API and identities</h2>
          <p className="t-s muted w5">The same reads over HTTP from <span className="mono">pnpm --dir server api</span>{HAS_SERVER ? "" : " (this build has no Covenant server; run it locally on http://127.0.0.1:8787)"}, and the ERC-8004 registries an agent issuer is known by.</p>
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
