import { getAddress, isAddress, type Address, type Hex } from 'viem';
import { assertLocalNodeIfLoopback, assertSigningAllowed, publicClient, walletClient } from '../../src/chain.js';
import { assertPublicUriBase } from '../../src/safety.js';
import { loadConfig } from '../../src/config.js';
import { registerAgent, registrationFile, writeRegistrationFile } from './identity.js';

/**
 * Register the issuer agent with ERC-8004 from its team wallet:
 *   ISSUER_PRIVATE_KEY=0x.. ISSUER_NAME="..." pnpm issuer:register
 * Writes the registration file under .data/agents/ (served by the API at
 * /agents/<owner>/registration.json) and calls register(agentURI). Use the printed agent id as
 * Terms.agentId when the contracts support the identity check.
 */
const cfg = loadConfig();
const key = process.env.ISSUER_PRIVATE_KEY as Hex | undefined;
if (!key) {
  console.error('ISSUER_PRIVATE_KEY is required');
  process.exit(2);
}
assertSigningAllowed(cfg.chainId, cfg.rpcUrl);
await assertLocalNodeIfLoopback(publicClient(cfg), cfg.chainId, cfg.rpcUrl);
// the agentURI goes on chain: it must resolve for everyone
assertPublicUriBase(cfg.chainId, cfg.rpcUrl, cfg.apiBaseUrl, 'API_BASE_URL (the base of the ERC-8004 agentURI)');
const wallet = walletClient(cfg, key);
const owner = wallet.account!.address;
const vaults: Address[] = (process.env.ISSUER_VAULTS ?? '').split(',').filter((v) => isAddress(v.trim())).map((v) => getAddress(v.trim()));
const input = {
  name: process.env.ISSUER_NAME ?? 'Covenant issuer agent',
  description: process.env.ISSUER_DESCRIPTION ?? 'An AI agent that raised its budget under a Covenant: capped tap, performance unlock, book-value exit and an abandonment switch.',
  mcpEndpoint: process.env.ISSUER_MCP_ENDPOINT ?? 'stdio: pnpm --dir server mcp',
  covenantVaults: vaults,
};
const first = writeRegistrationFile(cfg, owner, registrationFile(cfg, input));
const { agentId, tx } = await registerAgent(cfg, wallet, publicClient(cfg), first.uri);
writeRegistrationFile(cfg, owner, registrationFile(cfg, input, agentId));
console.log(JSON.stringify({ agentId: agentId.toString(), owner, agentURI: first.uri, file: first.file, tx }, null, 2));
