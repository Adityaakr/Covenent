import { getAddress, isAddress, parseEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadConfig } from '../../src/config.js';
import { CovenantService } from '../../src/covenant/read.js';
import { IssuerAgent, type IssuerPolicy } from './issuer.js';
import { assertPublicUriBase } from '../../src/safety.js';

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
  // the newest live covenant this wallet runs (a wound-down one has nothing left to do)
  await svc.discover().catch(() => undefined);
  let fallback: Address | undefined;
  for (const c of svc.covenants()) {
    const s = await svc.sheet(c.vault).catch(() => null);
    if (s?.issuer.teamWallet?.toLowerCase() !== me.toLowerCase()) continue;
    if (s.state === 'WIND_DOWN' || s.state === 'FAILED') fallback = c.vault;
    else vault = c.vault;
  }
  vault ??= fallback;
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
    payCutConfirmTicks: process.env.ISSUER_PAY_CUT_CONFIRM_TICKS ? num('ISSUER_PAY_CUT_CONFIRM_TICKS', 3) : undefined,
    autoPayCut: process.env.ISSUER_AUTO_PAY_CUT === undefined ? undefined : process.env.ISSUER_AUTO_PAY_CUT === '1',
    postDecisions: process.env.ISSUER_POST_DECISIONS !== undefined ? process.env.ISSUER_POST_DECISIONS !== '0' : undefined,
  }).filter(([, v]) => v !== undefined),
);

// Report URIs go on chain: on a public chain they must be reachable by holders, not 127.0.0.1.
assertPublicUriBase(cfg.chainId, cfg.rpcUrl, cfg.apiBaseUrl, 'API_BASE_URL (the base of the report URIs posted on chain)');
const agent = new IssuerAgent(cfg, vault, { privateKey: key, svc, policy });
const tickSeconds = num('ISSUER_TICK_SECONDS', 120);
console.log(
  `[issuer] team wallet ${me} on covenant ${vault}; tick ${tickSeconds}s; decisions and report by ${cfg.anthropic.apiKey ? `${cfg.anthropic.model} within the fixed policy` : 'the fixed rules and template (no ANTHROPIC_API_KEY)'}` +
    `; decision records ${agent.policy.postDecisions ? 'posted on-chain' : 'kept locally (ISSUER_POST_DECISIONS=0)'}.` +
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
