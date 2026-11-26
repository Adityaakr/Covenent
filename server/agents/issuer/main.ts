import { getAddress, isAddress, parseEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadConfig } from '../../src/config.js';
import { CovenantService } from '../../src/covenant/read.js';
import { IssuerAgent, type IssuerPolicy } from './issuer.js';

const cfg = loadConfig();
const key = process.env.ISSUER_PRIVATE_KEY as Hex | undefined;
if (!key) {
  console.error('ISSUER_PRIVATE_KEY is required (the covenant team wallet; local chain only).');
  process.exit(2);
}
const me = privateKeyToAccount(key).address;
const svc = new CovenantService({ cfg });

let vault: Address | undefined = process.env.ISSUER_VAULT && isAddress(process.env.ISSUER_VAULT) ? getAddress(process.env.ISSUER_VAULT) : undefined;
if (!vault) {
  for (const c of svc.covenants()) {
    const s = await svc.sheet(c.vault).catch(() => null);
    if (s?.issuer.teamWallet?.toLowerCase() === me.toLowerCase()) vault = c.vault;
  }
}
if (!vault) {
  console.error(`No covenant found whose team wallet is ${me}. Set ISSUER_VAULT.`);
  process.exit(2);
}

const num = (n: string, d: number) => (process.env[n] ? Number(process.env[n]) : d);
const eth = (n: string): bigint | undefined => (process.env[n] ? parseEther(process.env[n]!) : undefined);
const policy: Partial<IssuerPolicy> = Object.fromEntries(
  Object.entries({
    minClaimWei: eth('ISSUER_MIN_CLAIM_BNB'),
    heartbeatEverySeconds: process.env.ISSUER_HEARTBEAT_EVERY_SECONDS ? num('ISSUER_HEARTBEAT_EVERY_SECONDS', 0) : undefined,
    payCutBelowPremiumPct: process.env.ISSUER_PAY_CUT_BELOW_PREMIUM_PCT ? num('ISSUER_PAY_CUT_BELOW_PREMIUM_PCT', 0) : undefined,
    periodSeconds: process.env.ISSUER_PERIOD_SECONDS ? num('ISSUER_PERIOD_SECONDS', 0) : undefined,
    gasReserveWei: eth('ISSUER_GAS_RESERVE_BNB'),
  }).filter(([, v]) => v !== undefined),
);

const agent = new IssuerAgent(cfg, vault, { privateKey: key, svc, policy });
const tickSeconds = num('ISSUER_TICK_SECONDS', 120);
console.log(
  `[issuer] team wallet ${me} on covenant ${vault}; tick ${tickSeconds}s; report author ${cfg.anthropic.apiKey ? cfg.anthropic.model : 'fixed template (no ANTHROPIC_API_KEY)'}.` +
    ' Kill this process to stop the agent: the covenant then has nothing sending heartbeats.',
);
if (process.argv.includes('--once')) {
  console.log(JSON.stringify(await agent.tick(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  process.exit(0);
}
const stop = agent.run(tickSeconds);
const quit = (sig: string) => {
  console.log(`[issuer] ${sig}: agent stopped. No more heartbeats will be sent.`);
  stop();
  process.exit(0);
};
process.on('SIGINT', () => quit('SIGINT'));
process.on('SIGTERM', () => quit('SIGTERM'));
