/**
 * Gas limit for CovenantLauncher.finalize(), the launcher's FINALIZE_GAS_LIMIT. finalize() refuses to try the launch
 * with less than 15M gas left (LAUNCH_GAS_FLOOR), so a wallet's estimate is not enough; BNB testnet refuses any
 * transaction above 16,777,216 gas (2^24, "-32003: gas limit too high", chain 97, 26 Nov 2026). Only the gas used is
 * paid: about 5.3M on BNB testnet.
 */
export const FINALIZE_GAS = 16_700_000n;
