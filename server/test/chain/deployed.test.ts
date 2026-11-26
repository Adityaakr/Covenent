import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/api/app.js';
import { fetchBnbUsdReport, pokeCalldata } from '../../src/atlas/report.js';
import { deploymentsPath, loadConfig } from '../../src/config.js';
import { CovenantService } from '../../src/covenant/read.js';
import { CovenantSheet, CovenantSummary, History, PokeReport } from '../../src/schema.js';

/**
 * Runs against the real contracts once contracts/ has published deployments/local.json and its
 * dev script has a local node up. Skipped (not failed) until then. Run with:
 *   (cd contracts && ./scripts/dev-*)   # whatever the contracts lane ships
 *   pnpm test:chain
 */
const file = deploymentsPath();
const present = existsSync(file);

describe.skipIf(!present)(`deployed contracts (${file})`, () => {
  const cfg = loadConfig();
  const svc = new CovenantService({ cfg });

  it('the local node answers on the published chain id', async () => {
    expect(await svc.client.getChainId()).toBe(cfg.chainId);
    expect(cfg.covenants.length).toBeGreaterThan(0);
  });

  it('every covenant sheet parses against the published schema', async () => {
    for (const c of cfg.covenants) {
      const s = CovenantSheet.parse(await svc.sheet(c.vault));
      CovenantSummary.parse(await svc.summary(c.vault));
      History.parse(await svc.history(c.vault));
      // report which views the real ABI lacks, so integration can align names
      if (s.reads.missing.length) console.warn(`[deployed] ${c.vault} missing views: ${s.reads.missing.join(', ')}`);
    }
  });

  it('a poke with a signed report simulates against the real oracle (or names its revert)', async () => {
    if (!cfg.oracle) return;
    const rep = await fetchBnbUsdReport(cfg.atlas, svc.client);
    const app = createApp({ cfg, svc });
    const res = await app.request(`/api/poke-report?vault=${cfg.covenants[0]!.vault}`);
    PokeReport.parse(await res.json());
    try {
      await svc.client.call({ to: cfg.oracle, data: pokeCalldata(svc.abis.oracle, cfg.covenants[0]!.vault, rep.extraData) });
    } catch (e) {
      // TooSoon or an unauthorized local signer are integration facts, not server bugs: print them
      console.warn(`[deployed] poke simulation reverted: ${(e as Error).message.split('\n')[0]}`);
    }
  });
});

describe.skipIf(present)('deployed contracts', () => {
  it('skipped: contracts/deployments/local.json does not exist yet', () => {
    expect(present).toBe(false);
  });
});
