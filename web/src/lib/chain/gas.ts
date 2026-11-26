/**
 * Gas limit for CovenantLauncher.finalize(), the launcher's FINALIZE_GAS_LIMIT: 15,000,000, the most Flap's vault SDK
 * and flap.sh send on BNB Chain. finalize() refuses to try the launch with less than 12M gas left (LAUNCH_GAS_FLOOR),
 * so a wallet's estimate is not enough. Only the gas used is paid: about 5.5M on BNB testnet, 7M on BNB Chain.
 */
export const FINALIZE_GAS = 15_000_000n;
