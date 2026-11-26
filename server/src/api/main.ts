import { serve } from '@hono/node-server';
import { loadConfig } from '../config.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const app = createApp({ cfg });
const host = process.env.API_HOST ?? '127.0.0.1';

serve({ fetch: app.fetch, port: cfg.apiPort, hostname: host }, (info) => {
  console.log(
    `[api] http://${host}:${info.port}  chain ${cfg.chainId} (${cfg.rpcUrl}); covenants ${cfg.covenants.length}; ` +
      `deployments ${cfg.deployments ? 'loaded' : 'NOT FOUND (contracts/deployments/local.json)'}; ` +
      `Atlas ${cfg.atlas.apiKey ? 'pull API' : 'local test signer'}; CMC ${cfg.cmc.apiKey ? 'key set' : 'keyless'}`,
  );
});
