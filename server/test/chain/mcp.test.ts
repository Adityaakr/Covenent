import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { InvestorAgent } from '../../agents/investor/investor.js';
import { SERVER_ROOT } from '../../src/config.js';
import { Keeper } from '../../src/keeper/keeper.js';
import { Downside, UnsignedTx } from '../../src/schema.js';
import { createMcpServer, TOOL_NAMES } from '../../mcp/tools.js';
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
  it('exposes every tool in the design table', async () => {
    const { tools } = await mcp.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('read tools: list, terms with a plain summary, status, downside, issuer, market', async () => {
    const list = await call('list_covenants');
    expect((list.body.covenants as unknown[]).length).toBe(1);
    expect(((await call('list_covenants', { under_book_only: true })).body.covenants as unknown[]).length).toBe(0);
    const terms = await call('get_terms', { vault: fx.vault });
    expect(terms.body.summary).toMatch(/if the team or agent stops/);
    expect(terms.body.summary).toMatch(/decays above book/);
    expect((terms.body.terms as { roundLengthSeconds: number }).roundLengthSeconds).toBe(300);
    const st = await call('get_status', { vault: fx.vault });
    expect(st.body.state).toBe('ACTIVE');
    Downside.parse((await call('get_downside', { vault: fx.vault, holder: addr(KEYS.buyer1) })).body);
    expect((await call('get_issuer', { vault: fx.vault })).body.teamWallet).toBe(addr(KEYS.team));
    expect((await call('get_market', { vault: fx.vault })).body.note).toMatch(/not BNB Chain mainnet/);
  });

  it('write tools return unsigned transactions and never sign', async () => {
    const before = await fx.client.getBlockNumber({ cacheTime: 0 });
    for (const [name, args] of [
      ['commit', { vault: fx.vault, amount_bnb: '2' }],
      ['claim_tokens', { vault: fx.vault }],
      ['claim_refund', { vault: fx.vault }],
      ['poke', { vault: fx.vault }],
      ['declare_abandoned', { vault: fx.vault }],
      ['claim_tap', { vault: fx.vault }],
      ['heartbeat', { vault: fx.vault }],
      ['lower_tap', { vault: fx.vault, usd_per_30d: '20000' }],
      ['post_report', { vault: fx.vault, period: 1, uri: 'http://x/1', report_text: 'hello' }],
      ['redeem', { vault: fx.vault, holder: addr(KEYS.buyer2) }],
    ] as const) {
      const r = await call(name, args);
      expect(r.isError, `${name}: ${r.text}`).toBe(false);
      const tx = UnsignedTx.parse(r.body.unsignedTransaction);
      expect(tx.chainId).toBe(31337);
    }
    expect(await fx.client.getBlockNumber({ cacheTime: 0 })).toBe(before); // nothing was sent
    const team = await call('heartbeat', { vault: fx.vault });
    expect((team.body.unsignedTransaction as { from: string }).from).toBe(addr(KEYS.team));
    const da = await call('declare_abandoned', { vault: fx.vault });
    expect(da.body.note).toMatch(/Not due/);
    expect((await call('get_terms', { vault: '0x123' })).isError).toBe(true);
  });

  it('the poke tool tx lands when any wallet sends it', async () => {
    const r = await call('poke', { vault: fx.vault });
    const tx = UnsignedTx.parse(r.body.unsignedTransaction);
    const w = createWalletClient({ account: privateKeyToAccount(KEYS.buyer3), chain: foundry, transport: http(fx.rpcUrl) });
    const hash = await w.sendTransaction({ to: tx.to, data: tx.data });
    expect((await fx.client.waitForTransactionReceipt({ hash })).status).toBe('success');
    expect(await fx.client.readContract({ address: fx.vault, abi: fx.abis.vault, functionName: 'lastTrusted' })).toBe(true);
  });

  it('tells the client how to use it, and pokes plainly where no pull report exists (BNB testnet, no Atlas key)', async () => {
    expect(mcp.getInstructions()).toMatch(/never sign/);
    const base = fx.cfg();
    const feed = '0x3957d289ee9C38272377786787ea34F9dd29788D' as const;
    const server = createMcpServer({ cfg: { ...base, atlas: { ...base.atlas, apiKey: undefined, localSignerAllowed: false, pushFeed: feed } } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: 'push-feed', version: '0' });
    await c.connect(b);
    const r = (await c.callTool({ name: 'poke', arguments: { vault: fx.vault } })) as ToolResult;
    expect(r.isError ?? false, r.content[0]!.text).toBe(false);
    const body = JSON.parse(r.content[0]!.text) as { unsignedTransaction: unknown; note: string };
    const tx = UnsignedTx.parse(body.unsignedTransaction);
    expect(tx.data.length).toBe(2 + 8 + 64); // poke(vault) with no report appended
    expect(body.note).toMatch(/push feed/);
    await c.close();
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
