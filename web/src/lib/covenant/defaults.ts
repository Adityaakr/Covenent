import { DAY, HOUR, MINUTE } from "./time";
import type { Terms } from "./types";

/** Appendix A defaults: the terms used in every example in docs/DESIGN.md. */
export const DEFAULT_TERMS: Terms = {
  name: "Lumen",
  symbol: "LUMEN",
  meta: "An AI research agent that sells market briefs to other agents and routes its revenue to the vault.",
  totalSupply: 1_000_000_000,
  saleBps: 6000,
  poolBps: 1500,
  trancheBps: [500, 1000, 1000],
  trancheMultiple: [200, 400, 800],
  minRaise: 200,
  cap: 500,
  saleDuration: 4 * DAY,
  buyTaxBps: 100,
  sellTaxBps: 100,
  teamWallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  tapUsdPer30d: 30_000,
  tapCapBps: 400,
  cliff: 180 * DAY,
  unlockWindow: 30 * DAY,
  exitStreak: 3 * DAY,
  roundLength: 7 * DAY,
  cooldown: 14 * DAY,
  exitFeeBps: 100,
  heartbeat: 45 * DAY,
  agentId: 0,
};

/** The short-timer demo factory from Appendix A (stage only). */
export const DEMO_TIMERS = {
  saleDuration: 2 * MINUTE,
  unlockWindow: 2 * MINUTE,
  exitStreak: 3 * MINUTE,
  roundLength: 5 * MINUTE,
  cooldown: 2 * MINUTE,
  heartbeat: 10 * MINUTE,
  minPokeGap: 20,
  maxStep: MINUTE,
};

/** Launcher factory bounds (Smart contract specification, Terms). */
export const BOUNDS = {
  saleBpsMin: 4000,
  poolBpsMin: 500,
  teamBpsMax: 3000,
  tapCapBpsMax: 1000,
  exitStreakMin: 1 * DAY,
  exitStreakMax: 14 * DAY,
  roundLengthMin: 3 * DAY,
  exitFeeBpsMax: 300,
  heartbeatMin: 14 * DAY,
  heartbeatMax: 90 * DAY,
  minPokeGap: HOUR,
};

/** Flap and ERC-8004 addresses from the doc, same on BNB Chain and testnet unless noted. */
export const FLAP = {
  portal: "0x000042108465206185A077Edc3F3fd2b49060000",
  tokenDockRouter: "0x000048E888aBf09f690a952E1b386b2D031a0000",
  guardianMainnet: "0x9e27098dcD8844bcc6287a557E0b4D09C86B8a4b",
  guardianTestnet: "0x00004d58290854c5E9880F4b5B1993c6Ad8b0000",
  taxTokenImpl: "0x7777c57ff7dc441c1715b2e36fa581c48B782222",
} as const;

export const ERC8004 = {
  56: { identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" },
  97: { identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e", reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
} as const;

export const ATLAS_SIGNER = "0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600";
