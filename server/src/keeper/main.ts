import { loadConfig } from '../config.js';
import { Keeper } from './keeper.js';

const cfg = loadConfig();
const once = process.argv.includes('--once');
const force = process.argv.includes('--force');
const keeper = new Keeper({ cfg });

console.log(
  `[keeper] chain ${cfg.chainId} at ${cfg.rpcUrl}; ${keeper.svc.covenants().length} covenant(s); oracle ${cfg.oracle ?? 'unknown'}; ` +
    `Atlas ${cfg.atlas.apiKey ? 'pull API (SDK)' : cfg.atlas.localSignerAllowed ? 'LOCAL TEST SIGNER' : cfg.atlas.pushFeed ? `push feed ${cfg.atlas.pushFeed} (pokes carry no report)` : 'none (pokes carry no report)'}; poke every ${cfg.keeper.pokeIntervalSeconds}s, tick ${cfg.keeper.tickSeconds}s`,
);

if (once) {
  const rs = await keeper.tick({ force });
  console.log(JSON.stringify(rs, null, 2));
  process.exit(rs.some((r) => r.action === 'failed') ? 1 : 0);
} else {
  const stop = keeper.run();
  const quit = () => {
    console.log('[keeper] stopping');
    stop();
    process.exit(0);
  };
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
}
