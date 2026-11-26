/**
 * The agent-facing reference, rendered from the MCP server's own tool, prompt and resource lists so it cannot drift
 * from the code: web/public/llms-full.txt (written by `pnpm --dir server gen:llms`, checked by test/unit/llms.test.ts).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { deploymentFile, loadConfig, loadDeployments, REPO_ROOT } from '../src/config.js';
import { createMcpServer, INSTRUCTIONS, WRITE_TOOLS } from './tools.js';

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

export async function renderToolReference(): Promise<string> {
  // Offline: with no covenants and no factories to discover, listing tools, prompts and resources makes no RPC call.
  const cfg = loadConfig({ deployments: loadDeployments(deploymentFile('97.json')), rpcUrl: 'https://bsc-testnet-rpc.publicnode.com', chainId: 97, covenants: [], launcherFactories: [] });
  const server = createMcpServer({ cfg });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const c = new Client({ name: 'reference', version: '0' });
  await c.connect(b);
  const [{ tools }, { prompts }, { resources }, { resourceTemplates }] = await Promise.all([c.listTools(), c.listPrompts(), c.listResources(), c.listResourceTemplates()]);
  await c.close();

  const out: string[] = [];
  out.push(`## MCP tools (${tools.length})`, '');
  for (const t of tools) {
    const kind = (WRITE_TOOLS as readonly string[]).includes(t.name) ? 'write: returns an unsigned transaction and its simulation' : 'read';
    out.push(`### ${t.name}`, '', `${t.title ?? t.name} (${kind}). ${t.description ?? ''}`, '');
    const props = (t.inputSchema as JsonSchema).properties ?? {};
    const req = new Set((t.inputSchema as JsonSchema).required ?? []);
    const names = Object.keys(props);
    if (!names.length) out.push('Arguments: none.', '');
    else {
      out.push('Arguments:');
      for (const n of names) out.push(`- \`${n}\`${req.has(n) ? '' : ' (optional)'}: ${typeOf(props[n]!)}. ${props[n]!.description ?? ''}`.trimEnd());
      out.push('');
    }
  }
  out.push(`## MCP prompts (${prompts.length})`, '');
  for (const p of prompts) out.push(`- \`${p.name}\` (${(p.arguments ?? []).map((x) => `${x.name}${x.required ? '' : '?'}`).join(', ')}): ${p.description ?? ''}`);
  out.push('', `## MCP resources`, '');
  for (const r of resources.filter((r) => !r.uri.startsWith('covenant://covenants/'))) out.push(`- \`${r.uri}\`: ${r.description ?? r.name}`);
  for (const r of resourceTemplates) out.push(`- \`${r.uriTemplate}\`: ${r.description ?? r.name}`);
  out.push('');
  return out.join('\n');
}

export async function renderLlmsFull(): Promise<string> {
  const record = JSON.parse(readFileSync(deploymentFile('97.json'), 'utf8')) as Record<string, string | number>;
  const skill = readFileSync(path.join(REPO_ROOT, 'server', 'mcp', 'SKILL.md'), 'utf8').replace(/^---[\s\S]*?---\n+/, '');
  const addresses = Object.entries(record)
    .filter(([, v]) => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return [
    '# Covenant: full agent reference',
    '',
    '> The operating stack for autonomous ventures. Capital, budgets and exits for businesses run by AI agents, enforced by contracts on BNB Chain. Deployed on BNB testnet (chain 97); nothing on mainnet; not audited.',
    '',
    'This file is generated from the Covenant MCP server itself (server/mcp/reference.ts, `pnpm --dir server gen:llms`). The short version is /llms.txt. A recorded agent session on BNB testnet is docs/AGENT-DEMO.md in the repository: https://github.com/Adityaakr/Covenent/blob/main/docs/AGENT-DEMO.md',
    '',
    '## Server instructions (sent to every MCP client)',
    '',
    INSTRUCTIONS,
    '',
    skill.trim().replace(/^# Covenant\n/, '## The agent guide (server/mcp/SKILL.md)\n'),
    '',
    await renderToolReference(),
    '## BNB testnet deployment (contracts/deployments/97.json)',
    '',
    `Chain id ${record.chainId}. Explorer https://testnet.bscscan.com. Public RPC https://bsc-testnet-rpc.publicnode.com.`,
    '',
    addresses,
    '',
    'Launched covenants are discovered from launcherFactory.allLaunchers() and demoLauncherFactory.allLaunchers() (then launcher.vault()); list_covenants returns them live. The first testnet covenant, CVT (demo factory, taken through every stage and now wound down): token 0x40002FcB9983c46b299F13e2d64E2c9Cb3b07777, launcher 0x0f3Fe8a8d3e2862E6218f42D6376D28ba3EaDf5E, vault 0x524059B1424101D4CAFD33B9a1A8D332dD71193D.',
    '',
  ].join('\n');
}
