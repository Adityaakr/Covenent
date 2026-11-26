/**
 * Gas limits the off-chain side attaches to transactions it builds. One place, so the MCP server, the HTTP API and
 * the agents agree, and the web app's copy (web/src/lib/data/actions.ts FINALIZE_GAS) is checked against it in
 * test/unit/gas.test.ts.
 *
 * finalize() refuses less than CovenantLauncher.LAUNCH_GAS_FLOOR (15M) before the Flap launch, so a starved launch
 * cannot fail a healthy raise. BNB testnet refuses any transaction above 16,777,216 gas (2^24, "-32003: gas limit too
 * high", seen on chain 97 on 26 Nov 2026), so the limit sits between the two.
 */
export const FINALIZE_GAS = 16_700_000n;

/** The node-side ceiling FINALIZE_GAS must stay under on BNB testnet. */
export const TESTNET_TX_GAS_CEILING = 16_777_216n;
