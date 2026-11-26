import { afterEach, describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { Faucet, FaucetError } from '../../src/api/faucet.js';
import { loadConfig } from '../../src/config.js';

const ANVIL0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const client = {} as PublicClient;
const prevKey = process.env.FAUCET_PRIVATE_KEY;
afterEach(() => {
  if (prevKey === undefined) delete process.env.FAUCET_PRIVATE_KEY;
  else process.env.FAUCET_PRIVATE_KEY = prevKey;
});

describe('local test-funds faucet', () => {
  it('refuses on any RPC that is not a loopback node, whatever the chain id', async () => {
    process.env.FAUCET_PRIVATE_KEY = ANVIL0;
    for (const rpcUrl of ['https://bsc-dataseed.bnbchain.org', 'http://10.0.0.5:8545', 'https://example.org/rpc']) {
      for (const chainId of [56, 97, 31337]) {
        const f = new Faucet(loadConfig({ deployments: null, rpcUrl, chainId }), client);
        expect(f.status().enabled).toBe(false);
        await expect(f.send('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).rejects.toMatchObject({ status: 403 });
      }
    }
  });

  it('is off without a faucet key, and rejects a bad address before sending anything', async () => {
    delete process.env.FAUCET_PRIVATE_KEY;
    const off = new Faucet(loadConfig({ deployments: null, rpcUrl: 'http://127.0.0.1:8545', chainId: 31337 }), client);
    expect(off.status().reason).toMatch(/FAUCET_PRIVATE_KEY/);
    process.env.FAUCET_PRIVATE_KEY = ANVIL0;
    const on = new Faucet(loadConfig({ deployments: null, rpcUrl: 'http://127.0.0.1:8545', chainId: 56 }), client);
    expect(on.status().enabled).toBe(true);
    await expect(on.send('not-an-address')).rejects.toBeInstanceOf(FaucetError);
  });
});
