import { describe, expect, it } from 'vitest';
import { fetchBnbUsdReport, NoPullReport } from '../../src/atlas/report.js';
import { loadConfig, TESTNET_ATLAS_PUSH_BNB_USD } from '../../src/config.js';

const dep = (chainId: number) => ({ chainId, rpcUrl: 'http://127.0.0.1:8545', addresses: {} });

describe('Atlas on BNB testnet: the push feed, never the local test signer', () => {
  it('chain 97 uses the testnet BNB/USD push feed and refuses the local signer', async () => {
    const cfg = loadConfig({ deployments: dep(97) });
    expect(cfg.atlas.pushFeed).toBe(TESTNET_ATLAS_PUSH_BNB_USD);
    expect(cfg.atlas.localSignerAllowed).toBe(false);
    await expect(fetchBnbUsdReport({ ...cfg.atlas, apiKey: undefined })).rejects.toBeInstanceOf(NoPullReport);
  });

  it('the dev chain (and a BNB Chain fork) keep the local signer and have no push feed by default', async () => {
    for (const id of [31337, 56]) {
      const cfg = loadConfig({ deployments: dep(id) });
      expect(cfg.atlas.pushFeed).toBeUndefined();
      expect(cfg.atlas.localSignerAllowed).toBe(true);
      const rep = await fetchBnbUsdReport({ ...cfg.atlas, apiKey: undefined });
      expect(rep.mode).toBe('local-test-signer');
    }
  });
});
