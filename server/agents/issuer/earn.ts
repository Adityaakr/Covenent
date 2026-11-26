import { getAddress, isAddress, parseEther, type Hex } from 'viem';
import { assertLocalNodeIfLoopback, assertSigningAllowed, publicClient, walletClient } from '../../src/chain.js';
import { loadConfig } from '../../src/config.js';

/**
 * Revenue scene for the demo: a customer pays the issuer agent for its work. The agent's next tick
 * sees BNB it did not cause and forwards it to the vault, which raises book value for every holder.
 *   CUSTOMER_PRIVATE_KEY=0x.. pnpm issuer:earn <agent address> [bnb]
 */
const cfg = loadConfig();
const key = process.env.CUSTOMER_PRIVATE_KEY as Hex | undefined;
const to = process.argv[2];
const amount = parseEther(process.argv[3] ?? '1');
if (!key || !to || !isAddress(to)) {
  console.error('usage: CUSTOMER_PRIVATE_KEY=0x.. pnpm issuer:earn <agent address> [bnb]');
  process.exit(2);
}
assertSigningAllowed(cfg.chainId, cfg.rpcUrl);
await assertLocalNodeIfLoopback(publicClient(cfg), cfg.chainId, cfg.rpcUrl);
const w = walletClient(cfg, key);
const hash = await w.sendTransaction({ account: w.account!, chain: w.chain, to: getAddress(to), value: amount });
const r = await publicClient(cfg).waitForTransactionReceipt({ hash });
console.log(`customer paid the agent ${process.argv[3] ?? '1'} BNB (${hash}, ${r.status}); the issuer forwards it to the vault on its next tick`);
