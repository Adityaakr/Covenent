/**
 * Gas limits the off-chain side attaches to transactions it builds. One place, so the MCP server, the HTTP API and
 * the agents agree, and the web app's copy (web/src/lib/data/actions.ts FINALIZE_GAS) is checked against it in
 * test/unit/gas.test.ts.
 *
 * finalize() refuses to try the Flap launch with less than CovenantLauncher.LAUNCH_GAS_FLOOR (12M) left, so a starved
 * launch cannot fail a healthy raise, and a wallet's estimate does not see that check. The limit is 15,000,000: the
 * most Flap's vault SDK and flap.sh send on BNB Chain, about 2.9M over the floor at the check, and under BNB testnet's
 * 16,777,216 per-transaction cap (2^24, "-32003: gas limit too high", chain 97). Only the gas used is paid (5.5M on
 * BNB testnet, 7M on a BNB Chain fork).
 */
export const FINALIZE_GAS = 15_000_000n;

/** Flap's cap on a gas override (vault SDK, flap.sh) on BNB Chain: FINALIZE_GAS must not exceed it. */
export const FLAP_GAS_OVERRIDE_CAP = 15_000_000n;

/** The node-side ceiling FINALIZE_GAS must stay under on BNB testnet. */
export const TESTNET_TX_GAS_CEILING = 16_777_216n;
