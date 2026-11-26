import { serve } from '@hono/node-server';
import { loadConfig } from '../config.js';
import { redactUrl } from '../safety.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const app = createApp({ cfg });
const host = process.env.API_HOST ?? '127.0.0.1';

serve({ fetch: app.fetch, port: cfg.apiPort, hostname: host }, (info) => {
  console.log(
    `[api] http://${host}:${info.port}  chain ${cfg.chainId} (${redactUrl(cfg.rpcUrl)}); covenants ${cfg.covenants.length}; ` +
      `deployments ${cfg.deployments ? 'loaded' : 'NOT FOUND (contracts/deployments/local.json)'}; ` +
      `Atlas ${cfg.atlas.apiKey ? 'pull API' : cfg.atlas.localSignerAllowed ? 'local test signer' : cfg.atlas.pushFeed ? `push feed ${cfg.atlas.pushFeed}` : 'none'}; CMC ${cfg.cmc.apiKey ? 'key set' : 'keyless'}`,
  );
});
