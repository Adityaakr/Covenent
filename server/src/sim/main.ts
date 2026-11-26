import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { SimulatorResult } from '../schema.js';
import type { ExitRule } from './replay.js';
import { runSimulation } from './run.js';
import { CmcSource, GeckoTerminalSource, type MarketSource } from './sources.js';

const cfg = loadConfig();
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : (process.env[`SIM_${name.toUpperCase().replace(/-/g, '_')}`] ?? dflt);
};
const opts = {
  maxPools: Number(arg('max-pools', '80')),
  minAgeDays: Number(arg('min-age-days', '14')),
  maxAgeDays: Number(arg('max-age-days', '180')),
  minSample: Number(arg('min-sample', '20')),
  headlineRule: arg('headline-rule', 'decay') as ExitRule,
  log: (m: string) => console.log(`[sim] ${m}`),
};
const out = arg('out', cfg.simulatorFile);

let source: MarketSource = cfg.cmc.apiKey ? new CmcSource(cfg.cmc.apiKey, cfg.cmc.baseUrl) : new GeckoTerminalSource();
let result = await runSimulation(source, opts);
if (source.name === 'coinmarketcap' && result.sample.withCandles === 0) {
  console.log('[sim] CoinMarketCap returned nothing usable; falling back to GeckoTerminal');
  source = new GeckoTerminalSource();
  result = await runSimulation(source, opts);
  result.source.notes.unshift('CoinMarketCap was tried first and returned no usable rows; GeckoTerminal served this run.');
}
SimulatorResult.parse(result);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(`[sim] wrote ${out}`);
console.log(`[sim] headline: ${result.headline.text ?? `none (${result.headline.reason})`}`);
for (const v of result.variants) console.log(`[sim]   ${v.rule}: ${v.triggered}/${result.sample.withCandles}, median day ${v.medianDaysToTrigger}`);
