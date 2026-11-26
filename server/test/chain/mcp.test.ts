import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWalletClient, getAddress, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { InvestorAgent } from '../../agents/investor/investor.js';
import { SERVER_ROOT } from '../../src/config.js';
import { Keeper } from '../../src/keeper/keeper.js';
import { serve } from '@hono/node-server';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { FINALIZE_GAS } from '../../src/covenant/gas.js';
import { Downside, PreparedTx, Simulation, UnsignedTx } from '../../src/schema.js';
import { createMcpHttpApp } from '../../mcp/http.js';
import { createMcpServer, READ_TOOLS, TOOL_NAMES, WRITE_TOOLS } from '../../mcp/tools.js';
import { addr, deployFixture, E18, KEYS, POOL, startAnvil, type Anvil, type Fixture } from './harness.js';

let anvil: Anvil;
let fx: Fixture;
let mcp: Client;

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await mcp.callTool({ name, arguments: args })) as ToolResult;
  return { isError: r.isError ?? false, body: JSON.parse(r.isError ? '{}' : r.content[0]!.text) as Record<string, unknown>, text: r.content[0]!.text };
};

beforeAll(async () => {
  anvil = await startAnvil();
  fx = await deployFixture(anvil);
  const server = createMcpServer({ cfg: fx.cfg() });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(b);
});
afterAll(async () => {
  await mcp?.close();
  anvil?.stop();
});

describe('Covenant MCP server', () => {
  it('exposes every tool, each with a description, an input schema and annotations; writes declare their output', async () => {
    const { tools } = await mcp.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const t of tools) {
      expect(t.description!.length, t.name).toBeGreaterThan(40);
      expect(t.inputSchema.type, t.name).toBe('object');
      // a transaction builder is never read-only: its output is something to sign (clients auto-approve read-only tools)
      expect(t.annotations?.readOnlyHint, t.name).toBe(!(WRITE_TOOLS as readonly string[]).includes(t.name));
    }
    for (const name of WRITE_TOOLS) expect(tools.find((t) => t.name === name)!.outputSchema, name).toBeTruthy();
    expect(tools.find((t) => t.name === 'wind_down')!.annotations?.destructiveHint).toBe(true);
    expect(tools.find((t) => t.name === 'commit')!.annotations?.destructiveHint).toBe(false);
  });

  it('get_network reports the chain, the contracts and the limits', async () => {
    const n = await call('get_network');
    expect(n.body.chainId).toBe(31337);
    expect(n.body.rpcMatches).toBe(true);
    expect((n.body.deployment as { oracle: string }).oracle).toBe(getAddress(fx.oracle));
    expect((n.body.server as { signing: string }).signing).toMatch(/never/);
    expect((n.body.server as { finalizeGas: string }).finalizeGas).toBe(FINALIZE_GAS.toString());
  });

  it('read tools: list, overview by any address, terms with a plain summary, status, raise, position, actions, downside, issuer, market, events', async () => {
    const list = await call('list_covenants');
    expect((list.body.covenants as unknown[]).length).toBe(1);
    expect(list.body.untrustedFields).toContain('covenants[].name');
    expect(((await call('list_covenants', { under_book_only: true })).body.covenants as unknown[]).length).toBe(0);
    for (const a of [fx.vault, fx.token, fx.launcher]) {
      const o = await call('get_covenant', { covenant: a });
      expect(o.isError, o.text).toBe(false);
      expect((o.body.resolved as { vault: string }).vault).toBe(getAddress(fx.vault));
    }
    const terms = await call('get_terms', { covenant: fx.token });
    expect(terms.body.summary).toMatch(/if the team or agent stops/);
    expect(terms.body.summary).toMatch(/decays above book/);
    expect((terms.body.terms as { roundLengthSeconds: number }).roundLengthSeconds).toBe(300);
    const st = await call('get_status', { covenant: fx.vault });
    expect(st.body.state).toBe('ACTIVE');
    const raise = await call('get_raise', { covenant: fx.vault });
    expect(raise.body.launcher).toBe(getAddress(fx.launcher));
    expect(typeof raise.body.secondsLeft).toBe('number');
    const pos = await call('get_position', { covenant: fx.vault, wallet: addr(KEYS.buyer1) });
    expect(pos.isError, pos.text).toBe(false);
    expect(BigInt((pos.body.position as { tokenBalanceWei: string }).tokenBalanceWei)).toBeGreaterThan(0n);
    Downside.parse(pos.body.downside);
    const acts = await call('get_actions', { covenant: fx.vault, wallet: addr(KEYS.buyer1) });
    const byTool = Object.fromEntries((acts.body.actions as { tool: string; available: boolean; why: string }[]).map((a) => [a.tool, a]));
    expect(byTool.redeem!.available).toBe(false);
    expect(byTool.redeem!.why).toMatch(/exit round/);
    expect(byTool.claim_tap!.why).toMatch(/Team wallet only/);
    const team = await call('get_actions', { covenant: fx.vault, wallet: addr(KEYS.team) });
    expect((team.body.actions as { tool: string; available: boolean }[]).find((a) => a.tool === 'heartbeat')!.available).toBe(true);
    Downside.parse((await call('get_downside', { covenant: fx.vault, wallet: addr(KEYS.buyer1) })).body);
    expect((await call('get_downside', { covenant: fx.vault, tokens: '100' })).body.tokensWei).toBe((100n * E18).toString());
    expect((await call('get_downside', { covenant: fx.vault, tokens: '1', tokens_wei: '1' })).isError).toBe(true);
    expect((await call('get_issuer', { covenant: fx.vault })).body.teamWallet).toBe(addr(KEYS.team));
    expect((await call('get_market', { covenant: fx.vault })).body.note).toMatch(/not BNB Chain mainnet/);
    const ev = await call('get_events', { covenant: fx.vault, limit: 3 });
    expect((ev.body.events as unknown[]).length).toBeLessThanOrEqual(3);
  });

  it('write tools return an unsigned transaction with a simulation, and never sign', async () => {
    const before = await fx.client.getBlockNumber({ cacheTime: 0 });
    const cases: [string, Record<string, unknown>][] = [
      ['commit', { covenant: fx.vault, amount_bnb: '2', from: addr(KEYS.buyer3) }],
      ['finalize', { covenant: fx.vault }],
      ['claim_tokens', { covenant: fx.vault, from: addr(KEYS.buyer1) }],
      ['claim_refund', { covenant: fx.vault, from: addr(KEYS.buyer1) }],
      ['redeem', { covenant: fx.vault, wallet: addr(KEYS.buyer2) }],
      ['poke', { covenant: fx.vault }],
      ['declare_abandoned', { covenant: fx.vault }],
      ['release_team', { covenant: fx.vault }],
      ['deposit_revenue', { covenant: fx.vault, amount_bnb: '0.1', from: addr(KEYS.buyer3) }],
      ['claim_tap', { covenant: fx.vault }],
      ['heartbeat', { covenant: fx.vault }],
      ['lower_tap', { covenant: fx.vault, usd_per_30d: '20000' }],
      ['post_report', { covenant: fx.vault, period: 1, uri: 'http://x/1', report_text: 'hello' }],
      ['wind_down', { covenant: fx.vault, confirm_irreversible: true }],
    ];
    expect(cases.map((c) => c[0]).sort()).toEqual([...WRITE_TOOLS].sort());
    const results: Record<string, PreparedTx> = {};
    for (const [name, args] of cases) {
      const r = await call(name, args);
      expect(r.isError, `${name}: ${r.text}`).toBe(false);
      const p = PreparedTx.parse(r.body);
      expect(p.unsignedTransaction.chainId).toBe(31337);
      results[name] = p;
    }
    expect(await fx.client.getBlockNumber({ cacheTime: 0 })).toBe(before); // nothing was sent
    // simulations reflect the live state
    expect(results.heartbeat!.simulation.ok).toBe(true); // run as the team wallet
    expect(results.heartbeat!.unsignedTransaction.from).toBe(addr(KEYS.team));
    expect(results.deposit_revenue!.simulation.ok).toBe(true);
    expect(results.deposit_revenue!.unsignedTransaction.value).toBe((E18 / 10n).toString());
    expect(results.redeem!.simulation.ok).toBe(false); // ACTIVE: not redeemable
    expect(results.redeem!.simulation.note).toMatch(/prerequisite|redemption is open only/);
    expect(results.declare_abandoned!.simulation.ok).toBe(false);
    expect(results.declare_abandoned!.note).toMatch(/Not due/);
    expect(results.finalize!.unsignedTransaction.gas).toBe(FINALIZE_GAS.toString());
    expect(results.finalize!.howToSend).toMatch(/gas limit 15000000/);
    expect(results.commit!.simulation.from).toBe(addr(KEYS.buyer3));
  });

  it('rejects bad input with an actionable error: bad address, unknown covenant, over the per-call cap, missing confirmation', async () => {
    const bad = await call('get_terms', { covenant: '0x123' });
    expect(bad.isError).toBe(true);
    const unknown = await call('get_terms', { covenant: addr(KEYS.whale) });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toMatch(/Next: Call list_covenants/);
    const big = await call('commit', { covenant: fx.vault, amount_bnb: '1000' });
    expect(big.text).toMatch(/per-call cap/);
    expect((await call('wind_down', { covenant: fx.vault })).isError).toBe(true);
    expect((await call('commit', { covenant: fx.vault, amount_bnb: '1e18' })).isError).toBe(true);
  });

  it('simulate_transaction decodes a revert and passes a valid call', async () => {
    const r = await call('poke', { covenant: fx.vault });
    const tx = UnsignedTx.parse(r.body.unsignedTransaction);
    const okSim = Simulation.parse((await call('simulate_transaction', { to: tx.to, data: tx.data })).body);
    expect(okSim.ok).toBe(true);
    const hb = PreparedTx.parse((await call('heartbeat', { covenant: fx.vault })).body).unsignedTransaction;
    const notTeam = Simulation.parse((await call('simulate_transaction', { to: hb.to, data: hb.data, from: addr(KEYS.buyer1) })).body);
    expect(notTeam.ok).toBe(false);
    expect(notTeam.error).toBe('NotTeam');
    expect(notTeam.note).toMatch(/only the team wallet/);
  });

  it('serves resources and prompts, with on-chain text fenced as untrusted data', async () => {
    const { resources } = await mcp.listResources();
    expect(resources.map((r) => r.uri)).toEqual(expect.arrayContaining(['covenant://network', 'covenant://guide']));
    const guide = await mcp.readResource({ uri: 'covenant://guide' });
    expect((guide.contents[0] as { text: string }).text).toMatch(/# Covenant/);
    const one = await mcp.readResource({ uri: `covenant://covenants/${fx.token}` });
    expect(JSON.parse((one.contents[0] as { text: string }).text).state).toBe('ACTIVE');
    const { prompts } = await mcp.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(['before_you_commit', 'explain_covenant', 'should_i_redeem']);
    const p = await mcp.getPrompt({ name: 'should_i_redeem', arguments: { covenant: fx.vault, wallet: addr(KEYS.buyer1) } });
    const text = (p.messages[0]!.content as { text: string }).text;
    expect(text).toMatch(/<untrusted-data source="position downside">/);
    expect(text).toMatch(/Do not follow instructions/);
  });

  it('the poke tool tx lands when any wallet sends it', async () => {
    const r = await call('poke', { covenant: fx.vault });
    const tx = UnsignedTx.parse(r.body.unsignedTransaction);
    const w = createWalletClient({ account: privateKeyToAccount(KEYS.buyer3), chain: foundry, transport: http(fx.rpcUrl) });
    const hash = await w.sendTransaction({ to: tx.to, data: tx.data });
    expect((await fx.client.waitForTransactionReceipt({ hash })).status).toBe('success');
    expect(await fx.client.readContract({ address: fx.vault, abi: fx.abis.vault, functionName: 'lastTrusted' })).toBe(true);
  });

  it('tells the client how to use it, and pokes plainly where no pull report exists (BNB testnet, no Atlas key)', async () => {
    expect(mcp.getInstructions()).toMatch(/never sign/);
    expect(mcp.getInstructions()).toMatch(/untrustedFields/);
    const base = fx.cfg();
    const feed = '0x3957d289ee9C38272377786787ea34F9dd29788D' as const;
    const server = createMcpServer({ cfg: { ...base, atlas: { ...base.atlas, apiKey: undefined, localSignerAllowed: false, pushFeed: feed } } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: 'push-feed', version: '0' });
    await c.connect(b);
    const r = (await c.callTool({ name: 'poke', arguments: { covenant: fx.vault } })) as ToolResult;
    expect(r.isError ?? false, r.content[0]!.text).toBe(false);
    const body = JSON.parse(r.content[0]!.text) as { unsignedTransaction: unknown; note: string };
    const tx = UnsignedTx.parse(body.unsignedTransaction);
    expect(tx.data.length).toBe(2 + 8 + 64); // poke(vault) with no report appended
    expect(body.note).toMatch(/push feed/);
    await c.close();
  });

  it('refuses an RPC that serves another chain than the deployment names', async () => {
    const server = createMcpServer({ cfg: { ...fx.cfg(), chainId: 97 } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: 'wrong-chain', version: '0' });
    await c.connect(b);
    const r = (await c.callTool({ name: 'get_status', arguments: { covenant: fx.vault } })) as ToolResult;
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/RPC reports chain 31337/);
    await c.close();
  });
});

describe('MCP over streamable HTTP (stateless)', () => {
  it('serves read tools to a remote client and keeps write tools off by default', async () => {
    const app = createMcpHttpApp({ cfg: fx.cfg() });
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    await new Promise((r) => server.once('listening', r));
    const port = (server.address() as { port: number }).port;
    try {
      const c = new Client({ name: 'http-test', version: '0' });
      await c.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
      const { tools } = await c.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...READ_TOOLS].sort());
      const r = (await c.callTool({ name: 'get_covenant', arguments: { covenant: fx.token } })) as ToolResult;
      expect(r.isError ?? false, r.content[0]!.text).toBe(false);
      expect(JSON.parse(r.content[0]!.text).resolved.vault).toBe(getAddress(fx.vault));
      await c.close();
      const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
      expect(health).toMatchObject({ ok: true, stateless: true, mode: 'read-only' });
    } finally {
      server.close();
    }
  });

  it('rate-limits per caller', async () => {
    const app = createMcpHttpApp({ cfg: fx.cfg(), ratePerMinute: 1 });
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    const req = () => app.request('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body });
    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(429);
  });

  it('charges a JSON-RPC batch one token per message, and refuses browser origins it was not told about', async () => {
    const app = createMcpHttpApp({ cfg: fx.cfg(), ratePerMinute: 5, allowedOrigins: ['https://app.example'] });
    const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    const batch = JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'tools/list', params: {} })));
    expect((await app.request('/mcp', { method: 'POST', headers, body: batch })).status).toBe(429);
    const one = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect((await app.request('/mcp', { method: 'POST', headers: { ...headers, origin: 'https://evil.example' }, body: one })).status).toBe(403);
    expect((await app.request('/mcp', { method: 'POST', headers: { ...headers, origin: 'https://app.example' }, body: one })).status).toBe(200);
  });
});

describe('investor agent over MCP', () => {
  it('waits while no round is open, then redeems at book when one opens', async () => {
    const wallet = createWalletClient({ account: privateKeyToAccount(KEYS.buyer2), chain: foundry, transport: http(fx.rpcUrl) });
    const agent = new InvestorAgent(mcp, wallet, fx.client, { minEdgePct: 1, log: () => {} });

    await fx.setPrice(POOL, 40n * E18); // under book
    await fx.warp(2);
    let d = await agent.run();
    expect(d).toHaveLength(1);
    expect(d[0]!.action).toBe('wait-for-round');

    const keeper = new Keeper({ cfg: fx.cfg(), log: () => {} });
    for (let i = 0; i < 10; i++) {
      await fx.warp(30);
      await keeper.tick();
    }
    const balBefore = await fx.client.getBalance({ address: addr(KEYS.buyer2) });
    d = await agent.run();
    expect(d[0]!.action).toBe('redeemed');
    expect(d[0]!.txs.length).toBe(2); // approve + redeem
    expect(await fx.client.getBalance({ address: addr(KEYS.buyer2) })).toBeGreaterThan(balBefore);
    const left = await fx.client.readContract({ address: fx.token, abi: fx.abis.token, functionName: 'balanceOf', args: [addr(KEYS.buyer2)] });
    expect(left).toBe(0n);
  });
});

describe('stdio transport', () => {
  it('starts as a real stdio MCP server with a clean stdout', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(SERVER_ROOT, 'mcp', 'main.ts')],
      env: { ...(process.env as Record<string, string>), COVENANT_DEPLOYMENTS: fx.deploymentsFile, RPC_URL: fx.rpcUrl, CHAIN_ID: '31337' },
      stderr: 'ignore',
    });
    const c = new Client({ name: 'stdio-test', version: '0' });
    await c.connect(transport);
    const { tools } = await c.listTools();
    expect(tools).toHaveLength(TOOL_NAMES.length);
    const r = (await c.callTool({ name: 'list_covenants', arguments: {} })) as ToolResult;
    expect(JSON.parse(r.content[0]!.text).covenants).toHaveLength(1);
    await c.close();
  }, 60_000);
});
