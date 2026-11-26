/**
 * Live read smoke test against BNB testnet through the MCP server, with the committed deployment record. Skipped when
 * the public RPC does not answer within a few seconds, or when COVENANT_OFFLINE=1.
 */
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadConfig, loadDeployments, deploymentFile, TESTNET_PUBLIC_RPC } from '../../src/config.js';
import { createMcpServer } from '../../mcp/tools.js';

async function reachable(): Promise<boolean> {
  if (process.env.COVENANT_OFFLINE === '1') return false;
  try {
    const r = await fetch(TESTNET_PUBLIC_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    return ((await r.json()) as { result?: string }).result === '0x61';
  } catch {
    return false;
  }
}
const online = await reachable();

describe.skipIf(!online)('BNB testnet read smoke (live RPC)', () => {
  it('finds the live covenant from the deployment and reads it by its token address', async () => {
    const d = loadDeployments(deploymentFile('97.json'));
    const base = loadConfig({ deployments: d });
    const cfg = { ...base, chainId: 97, rpcUrl: TESTNET_PUBLIC_RPC, covenants: [] };
    const server = createMcpServer({ cfg });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: 'smoke', version: '0' });
    await c.connect(b);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
      expect(r.isError ?? false, `${name}: ${r.content[0]!.text}`).toBe(false);
      return JSON.parse(r.content[0]!.text);
    };
    const net = await call('get_network');
    expect(net).toMatchObject({ chainId: 97, rpcMatches: true });
    const list = await call('list_covenants');
    expect(list.covenants.length).toBeGreaterThan(0);
    const token = list.covenants[0].token as string;
    expect(token.toLowerCase().endsWith('7777')).toBe(true);
    const o = await call('get_covenant', { covenant: token });
    expect(o.resolved.matchedAs).toBe('token');
    expect(o.resolved.vault).toBe(list.covenants[0].vault);
    const acts = await call('get_actions', { covenant: token });
    expect(acts.actions.length).toBeGreaterThan(5);
    await c.close();
  }, 90_000);

  it('reads the legacy CVT covenant (97.json legacyCovenantVault): its ledger, token and pool', async () => {
    const d = loadDeployments(deploymentFile('97.json'));
    const vault = (d!.addresses as Record<string, string>).legacyCovenantVault!;
    const cfg = { ...loadConfig({ deployments: d }), chainId: 97, rpcUrl: TESTNET_PUBLIC_RPC, covenants: [] };
    const server = createMcpServer({ cfg });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: 'smoke', version: '0' });
    await c.connect(b);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
      expect(r.isError ?? false, `${name}: ${r.content[0]!.text}`).toBe(false);
      return JSON.parse(r.content[0]!.text);
    };
    const ev = await call('get_events', { covenant: vault, limit: 200 });
    expect(ev.covenant.token.toLowerCase().endsWith('7777')).toBe(true);
    expect(ev.covenant.pair).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(ev.total).toBeGreaterThan(10);
    const byToken = await call('get_covenant', { covenant: ev.covenant.token });
    expect(byToken.resolved).toMatchObject({ vault, matchedAs: 'token' });
    await c.close();
  }, 180_000);
});
