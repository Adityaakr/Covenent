import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseEther, type Address, type Hex, type PublicClient } from 'viem';
import { Faucet, FaucetError } from '../../src/api/faucet.js';
import { loadConfig } from '../../src/config.js';
import { scratchDir } from './scratch.js';

const ANVIL0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ANVIL1 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const FAUCET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address; // address of ANVIL0
const TESTER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const client = {} as PublicClient;
const prev = { local: process.env.FAUCET_PRIVATE_KEY, testnet: process.env.TESTNET_FAUCET_PRIVATE_KEY };
afterEach(() => {
  for (const [k, v] of [['FAUCET_PRIVATE_KEY', prev.local], ['TESTNET_FAUCET_PRIVATE_KEY', prev.testnet]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('local test-funds faucet', () => {
  it('refuses on any RPC that is not a loopback node, except the BNB testnet drip on chain 97', async () => {
    process.env.FAUCET_PRIVATE_KEY = ANVIL0;
    delete process.env.TESTNET_FAUCET_PRIVATE_KEY;
    for (const rpcUrl of ['https://bsc-dataseed.bnbchain.org', 'http://10.0.0.5:8545', 'https://example.org/rpc']) {
      for (const chainId of [56, 97, 31337]) {
        const f = new Faucet(loadConfig({ deployments: null, rpcUrl, chainId }), client);
        expect((await f.status()).enabled).toBe(false);
        await expect(f.send('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).rejects.toMatchObject({ status: 403 });
      }
    }
  });

  it('is off without a faucet key, and rejects a bad address before sending anything', async () => {
    delete process.env.FAUCET_PRIVATE_KEY;
    const off = new Faucet(loadConfig({ deployments: null, rpcUrl: 'http://127.0.0.1:8545', chainId: 31337 }), client);
    expect((await off.status()).reason).toMatch(/FAUCET_PRIVATE_KEY/);
    process.env.FAUCET_PRIVATE_KEY = ANVIL0;
    const on = new Faucet(loadConfig({ deployments: null, rpcUrl: 'http://127.0.0.1:8545', chainId: 56 }), client);
    expect((await on.status()).enabled).toBe(true);
    await expect(on.send('not-an-address')).rejects.toBeInstanceOf(FaucetError);
  });
});

/** A chain 97 stand-in: balances by address, and a signer that records what it sent. */
function testnetRig(opts: { chainId?: number; faucetBalance?: string; balances?: Record<string, string> } = {}) {
  const balances = new Map<string, bigint>(Object.entries(opts.balances ?? {}).map(([a, v]) => [a.toLowerCase(), parseEther(v)]));
  balances.set(FAUCET.toLowerCase(), parseEther(opts.faucetBalance ?? '0.05'));
  const sent: { to: string; value: bigint }[] = [];
  const fake = {
    getChainId: async () => opts.chainId ?? 97,
    getBalance: async ({ address }: { address: string }) => balances.get(address.toLowerCase()) ?? 0n,
    waitForTransactionReceipt: async () => ({ status: 'success' }),
  } as unknown as PublicClient;
  let n = 0;
  const wallet = () => ({
    account: { address: FAUCET },
    chain: undefined,
    sendTransaction: async ({ to, value }: { to: string; value: bigint }) => {
      sent.push({ to, value });
      balances.set(to.toLowerCase(), (balances.get(to.toLowerCase()) ?? 0n) + value);
      return `0x${(++n).toString(16).padStart(64, '0')}` as Hex;
    },
    writeContract: async () => '0x' as Hex,
  });
  const dir = scratchDir('faucet');
  let t = Date.parse('2026-11-26T10:00:00Z');
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const make = () =>
    new Faucet(loadConfig({ deployments: null, rpcUrl: 'https://bsc-testnet-rpc.publicnode.com', chainId: 97 }), fake, {
      testnet: { drip: '0.003', dailyCap: '0.009', enough: '0.01', reserve: '0.001', cooldownMs: 24 * 3_600_000, stateFile: path.join(dir, 'faucet-97.json') },
      now: clock.now,
      wallet: wallet as never,
    });
  return { make, sent, clock, dir };
}

describe('BNB testnet drip (chain 97)', () => {
  it('needs its own key: FAUCET_PRIVATE_KEY (the local one) never pays on testnet', async () => {
    process.env.FAUCET_PRIVATE_KEY = ANVIL0;
    delete process.env.TESTNET_FAUCET_PRIVATE_KEY;
    const { make } = testnetRig();
    const f = make();
    expect(f.mode()).toBe('testnet');
    expect((await f.status()).reason).toMatch(/TESTNET_FAUCET_PRIVATE_KEY/);
  });

  it('pays one drip per address and per IP every 24 hours, and the limits survive a restart', async () => {
    process.env.TESTNET_FAUCET_PRIVATE_KEY = ANVIL0;
    const { make, sent, clock } = testnetRig();
    const f = make();
    const r = await f.send(TESTER, '203.0.113.7');
    expect(r.bnbWei).toBe(parseEther('0.003').toString());
    expect(r.bnbTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sent).toHaveLength(1);

    await expect(f.send(TESTER, '198.51.100.1')).rejects.toMatchObject({ status: 429 });
    await expect(f.send(OTHER, '203.0.113.7')).rejects.toMatchObject({ status: 429 });
    const restarted = make();
    await expect(restarted.send(TESTER, '198.51.100.1')).rejects.toMatchObject({ status: 429 });
    const s = await restarted.status(TESTER, '198.51.100.1');
    expect(s.testnet?.eligible).toMatchObject({ ok: false });

    clock.advance(24 * 3_600_000 + 1);
    await restarted.send(TESTER, '203.0.113.7');
    expect(sent).toHaveLength(2);
  });

  it('stops at the daily cap, refuses a wallet that already has enough, and refuses on a wrong RPC chain', async () => {
    process.env.TESTNET_FAUCET_PRIVATE_KEY = ANVIL0;
    const { make, sent } = testnetRig({ balances: { [OTHER]: '0.5' } });
    const f = make();
    await expect(f.send(OTHER, '10.0.0.9')).rejects.toMatchObject({ status: 409 });
    const wallets = ['0x90F79bf6EB2c4f870365E785982E1f101E93b906', '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', '0x976EA74026E726554dB657fA54763abd0C3a0aa9'];
    for (const [i, w] of wallets.slice(0, 3).entries()) await f.send(w, `10.0.0.${i}`);
    await expect(f.send(wallets[3]!, '10.0.0.200')).rejects.toThrow(/used up/);
    expect(sent).toHaveLength(3);

    process.env.TESTNET_FAUCET_PRIVATE_KEY = ANVIL1;
    const wrong = testnetRig({ chainId: 56 }).make();
    await expect(wrong.send(TESTER, '10.0.0.1')).rejects.toMatchObject({ status: 403 });
  });

  it('refuses with public faucet links when its own balance is low, and releases nothing it did not send', async () => {
    process.env.TESTNET_FAUCET_PRIVATE_KEY = ANVIL0;
    const { make, sent, dir } = testnetRig({ faucetBalance: '0.0035' });
    const f = make();
    const s = await f.status(TESTER);
    expect(s.enabled).toBe(false);
    expect(s.testnet?.dry).toBe(true);
    const err = await f.send(TESTER, '10.0.0.1').catch((e: FaucetError) => e);
    expect(err).toBeInstanceOf(FaucetError);
    expect((err as FaucetError).status).toBe(503);
    expect(((err as FaucetError).extra.publicFaucets as { url: string }[])[0]!.url).toMatch(/bnbchain\.org/);
    expect(sent).toHaveLength(0);
    // a refusal before sending leaves the ledger clean: the address may try again once the faucet is topped up
    expect(() => readFileSync(path.join(dir, 'faucet-97.json'), 'utf8')).toThrow();
  });
});
