/**
 * The agent-facing reference, rendered from the MCP server's own tool, prompt and resource lists so it cannot drift
 * from the code. `pnpm --dir server gen:llms` writes both renders into the web docs (web/src/docs/generated/): the
 * MCP reference page (/docs/mcp-reference, also in /llms-full.txt) and the tool list the "For agents" page and
 * /llms.txt read. test/unit/llms.test.ts checks that the committed files are the current render.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { deploymentFile, loadConfig, loadDeployments } from '../src/config.js';
import { createMcpServer, INSTRUCTIONS, TEAM_TOOLS, WRITE_TOOLS } from './tools.js';

interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  anyOf?: JsonSchema[];
}

function typeOf(s: JsonSchema): string {
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((e) => JSON.stringify(e)).join(' | ');
  if (s.anyOf) return s.anyOf.map(typeOf).join(' | ');
  const t = Array.isArray(s.type) ? s.type.join(' | ') : (s.type ?? 'any');
  const range = s.minimum !== undefined || s.maximum !== undefined ? ` ${s.minimum ?? ''}..${s.maximum ?? ''}` : '';
  return `${t}${range}`;
}

async function listSurface() {
  // Offline: with no covenants and no factories to discover, listing tools, prompts and resources makes no RPC call.
  const cfg = loadConfig({ deployments: loadDeployments(deploymentFile('97.json')), rpcUrl: 'https://bsc-testnet-rpc.publicnode.com', chainId: 97, covenants: [], launcherFactories: [] });
  const server = createMcpServer({ cfg });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const c = new Client({ name: 'reference', version: '0' });
  await c.connect(b);
  const [{ tools }, { prompts }, { resources }, { resourceTemplates }] = await Promise.all([c.listTools(), c.listPrompts(), c.listResources(), c.listResourceTemplates()]);
  await c.close();
  return { tools, prompts, resources: resources.filter((r) => !r.uri.startsWith('covenant://covenants/')), resourceTemplates };
}

/** Who signs a tool's output: nobody (read), any wallet, or the covenant's team wallet. */
function signerOf(name: string): 'read' | 'anyone' | 'team' {
  if ((TEAM_TOOLS as readonly string[]).includes(name)) return 'team';
  return (WRITE_TOOLS as readonly string[]).includes(name) ? 'anyone' : 'read';
}

/** The MCP surface as data (web/src/docs/generated/mcp-tools.json): every tool with its title, signer and arguments. */
export async function renderMcpTools(): Promise<string> {
  const { tools, prompts, resources, resourceTemplates } = await listSurface();
  const out = {
    source: 'server/mcp/tools.ts, rendered by `pnpm --dir server gen:llms` (server/mcp/reference.ts)',
    tools: tools.map((t) => {
      const schema = t.inputSchema as JsonSchema;
      const req = new Set(schema.required ?? []);
      return { name: t.name, title: t.title ?? t.name, signer: signerOf(t.name), args: Object.keys(schema.properties ?? {}).map((n) => ({ name: n, required: req.has(n) })) };
    }),
    prompts: prompts.map((p) => ({ name: p.name, args: (p.arguments ?? []).map((x) => ({ name: x.name, required: Boolean(x.required) })), description: p.description ?? '' })),
    resources: [...resources.map((r) => ({ uri: r.uri, description: r.description ?? r.name })), ...resourceTemplates.map((r) => ({ uri: r.uriTemplate, description: r.description ?? r.name }))],
  };
  return JSON.stringify(out, null, 2) + '\n';
}

/** The MCP reference page body (web/src/docs/generated/mcp-reference.md): instructions, tools, prompts, resources. */
export async function renderMcpReference(): Promise<string> {
  const { tools, prompts, resources, resourceTemplates } = await listSurface();
  const out: string[] = [];
  out.push('## Server instructions', '', 'Sent to every MCP client when it connects:', '', `> ${INSTRUCTIONS}`, '');
  out.push(`## Tools (${tools.length})`, '');
  for (const t of tools) {
    const signer = signerOf(t.name);
    const kind = signer === 'read' ? 'read' : signer === 'team' ? 'write, signed by the team wallet: returns an unsigned transaction and its simulation' : 'write: returns an unsigned transaction and its simulation';
    out.push(`### ${t.name}`, '', `${t.title ?? t.name} (${kind}). ${t.description ?? ''}`, '');
    const props = (t.inputSchema as JsonSchema).properties ?? {};
    const req = new Set((t.inputSchema as JsonSchema).required ?? []);
    const names = Object.keys(props);
    if (!names.length) out.push('Arguments: none.', '');
    else {
      out.push('Arguments:', '');
      for (const n of names) out.push(`- \`${n}\`${req.has(n) ? '' : ' (optional)'}: ${typeOf(props[n]!)}. ${props[n]!.description ?? ''}`.trimEnd());
      out.push('');
    }
  }
  out.push(`## Prompts (${prompts.length})`, '');
  for (const p of prompts) out.push(`- \`${p.name}\` (${(p.arguments ?? []).map((x) => `${x.name}${x.required ? '' : '?'}`).join(', ')}): ${p.description ?? ''}`);
  out.push('', '## Resources', '');
  for (const r of resources) out.push(`- \`${r.uri}\`: ${r.description ?? r.name}`);
  for (const r of resourceTemplates) out.push(`- \`${r.uriTemplate}\`: ${r.description ?? r.name}`);
  out.push('');
  return out.join('\n');
}
