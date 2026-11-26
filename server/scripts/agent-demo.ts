/**
 * An AI agent's first session with Covenant on BNB testnet, end to end through the MCP server over stdio: the same
 * calls an agent in Claude Code, Claude Desktop or Cursor makes. Read-only plus unsigned, simulated writes; nothing is
 * signed or sent and no key is needed.
 *
 *   pnpm --dir server demo:agent                       # BNB testnet (contracts/deployments/97.json), public RPC
 *   pnpm --dir server demo:agent -- --markdown > out.md
 *   DEMO_COVENANT=0x... DEMO_WALLET=0x... pnpm --dir server demo:agent
 *
 * The covenant defaults to the first one list_covenants returns; the wallet defaults to the deployer named in
 * 97.json. docs/AGENT-DEMO.md is a recorded run.
 */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(here, '..');
const markdown = process.argv.includes('--markdown');
const record = JSON.parse(readFileSync(path.resolve(SERVER, '..', 'contracts', 'deployments', '97.json'), 'utf8')) as { deployer?: string };

type Result = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, unknown> };

const out: string[] = [];
const say = (s: string) => {
  out.push(s);
  if (!markdown) console.log(s);
};

function trim(v: unknown, depth = 0): unknown {
  // keep the transcript readable: long arrays shortened, long hex kept whole (it is the point)
  if (Array.isArray(v)) return v.length > 6 && depth > 0 ? [...v.slice(0, 6).map((x) => trim(x, depth + 1)), `… ${v.length - 6} more`] : v.map((x) => trim(x, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]));
  return v;
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(SERVER, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(SERVER, 'mcp', 'main.ts')],
    env: { ...(process.env as Record<string, string>), COVENANT_NETWORK: process.env.COVENANT_NETWORK ?? 'testnet' },
    stderr: 'ignore',
  });
  const mcp = new Client({ name: 'covenant-agent-demo', version: '1.0.0' });
  await mcp.connect(transport);

  const call = async (name: string, args: Record<string, unknown> = {}, why = '') => {
    const t0 = Date.now();
    const r = (await mcp.callTool({ name, arguments: args })) as Result;
    const ms = Date.now() - t0;
    say(`\n### \`${name}\`${why ? ` — ${why}` : ''}\n`);
    say('```json');
    say(`// request\n${JSON.stringify({ name, arguments: args })}`);
    say(`// response (${ms} ms${r.isError ? ', isError' : ''})`);
    say(r.isError ? r.content[0]!.text : JSON.stringify(trim(r.structuredContent ?? JSON.parse(r.content[0]!.text)), null, 2));
    say('```');
    return (r.isError ? {} : (r.structuredContent ?? JSON.parse(r.content[0]!.text))) as Record<string, any>;
  };

  const { tools } = await mcp.listTools();
  const { prompts } = await mcp.listPrompts();
  const { resources } = await mcp.listResources();
  say(`# Covenant MCP: a recorded agent session on BNB testnet\n`);
  say(`Recorded ${new Date().toISOString()} with \`pnpm --dir server demo:agent\` (server/scripts/agent-demo.ts). Every value below came from BNB testnet (chain 97) through the public RPC at the time of the run; nothing was signed or sent.\n`);
  say(`The server lists ${tools.length} tools (${tools.map((t) => `\`${t.name}\``).join(', ')}), ${prompts.length} prompts (${prompts.map((p) => `\`${p.name}\``).join(', ')}) and ${resources.length} resources (${resources.map((r) => `\`${r.uri}\``).join(', ')}).`);

  const net = await call('get_network', {}, 'which chain and which contracts');
  const list = await call('list_covenants', {}, 'what exists');
  const first = (list.covenants as { vault: string; token: string | null }[] | undefined)?.[0];
  const covenant = process.env.DEMO_COVENANT ?? first?.token ?? first?.vault;
  if (!covenant) {
    say('\nNo launched covenant on this deployment yet; stopping after the network read.');
  } else {
    const wallet = process.env.DEMO_WALLET ?? record.deployer;
    await call('get_covenant', { covenant }, 'the overview, by the token address');
    await call('get_terms', { covenant }, 'the five rules in numbers and words');
    await call('get_status', { covenant }, 'live state');
    await call('get_raise', { covenant }, 'the raise behind it');
    await call('get_issuer', { covenant }, 'who runs it');
    if (wallet) {
      await call('get_position', { covenant, wallet }, "one wallet's place in it");
      await call('get_actions', { covenant, wallet }, 'what that wallet can do now, and why');
    }
    await call('get_downside', { covenant, tokens: '1000' }, 'worst case for 1,000 tokens');
    await call('get_events', { covenant, limit: 5 }, 'the latest ledger entries');
    await call('commit', { covenant, amount_bnb: '0.01', ...(wallet ? { from: wallet } : {}) }, 'an unsigned write, simulated before signing');
    await call('poke', { covenant }, 'anyone may record a price observation');
    await call('get_terms', { covenant: '0x0000000000000000000000000000000000000001' }, 'an error an agent can act on');

    const p = await mcp.getPrompt({ name: 'explain_covenant', arguments: { covenant } });
    const text = (p.messages[0]!.content as { text: string }).text;
    say('\n### prompt `explain_covenant` — live data fenced as untrusted\n');
    say('```text');
    say(text.split('\n').slice(0, 12).join('\n') + '\n…');
    say('```');
  }
  say(`\n---\nChain ${net.chainId}, block ${net.blockNumber}, RPC ${net.rpc}.`);
  await mcp.close();
  if (markdown) process.stdout.write(out.join('\n') + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
