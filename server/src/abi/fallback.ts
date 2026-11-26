import { parseAbi } from 'viem';

/**
 * Fallback ABIs written from docs/DESIGN.md "Smart contract specification".
 * At runtime src/abi/index.ts merges these with contracts/abi/<Contract>.json when that file
 * exists; entries from the real ABI win by name, so nothing here is authoritative once the
 * contracts publish their artifacts. Views marked "extra" are not named in the doc but are the
 * surface the covenant sheet needs; every read of them is tolerant (missing -> null).
 */

export const vaultAbi = parseAbi([
  // doc views
  'function state() view returns (uint8)',
  'function bookValue() view returns (uint256)',
  'function redeemableSupply() view returns (uint256)',
  'function exitStreak() view returns (uint256)',
  'function trancheProgress(uint256 k) view returns (uint256)',
  'function tapAccrued() view returns (uint256)',
  'function description() view returns (string)',
  // extra views
  'function token() view returns (address)',
  'function launcher() view returns (address)',
  'function oracle() view returns (address)',
  'function teamWallet() view returns (address)',
  'function pair() view returns (address)',
  'function agentId() view returns (uint256)',
  'function salePriceBnb() view returns (uint256)',
  'function usdSalePrice() view returns (uint256)',
  'function tapUsdPer30d() view returns (uint256)',
  'function tapCapBps() view returns (uint16)',
  'function exitStreakTarget() view returns (uint32)',
  'function roundLength() view returns (uint32)',
  'function cooldown() view returns (uint32)',
  'function exitFeeBps() view returns (uint16)',
  'function heartbeatWindow() view returns (uint32)',
  'function unlockWindow() view returns (uint32)',
  'function roundEnd() view returns (uint256)',
  'function cooldownEnd() view returns (uint256)',
  'function lastHeartbeat() view returns (uint256)',
  'function owedTeam() view returns (uint256)',
  'function lockedTeam() view returns (uint256)',
  'function totalRedeemed() view returns (uint256)',
  'function totalTapPaid() view returns (uint256)',
  'function lastObservedAt() view returns (uint256)',
  'function lastTrusted() view returns (bool)',
  'function lastStrict() view returns (bool)',
  'function trancheCount() view returns (uint256)',
  'function trancheMultiple(uint256 k) view returns (uint16)',
  'function trancheAmount(uint256 k) view returns (uint256)',
  'function trancheUnlocked(uint256 k) view returns (bool)',
  // writes
  'function tokensClaimed(address) view returns (bool)',
  'function claimTokens()',
  'function claimTap()',
  'function lowerTap(uint256 newUsd)',
  'function heartbeat()',
  'function releaseTeam()',
  'function redeem(uint256 amount, uint256 minOut)',
  'function declareAbandoned()',
  'function windDown()',
  'function postReport(uint256 period, string uri, bytes32 hash)',
  'function sync()',
  // events (doc list)
  'event TreasuryFunded(uint256 amount, address pool)',
  'event RevenueRecognized(uint256 amount)',
  'event Observed(uint256 twapBnb, uint256 bnbUsd, uint256 bookValue, bool trusted, uint8 state)',
  'event TapClaimed(address indexed to, uint256 amount)',
  'event TapLowered(uint256 oldUsd, uint256 newUsd)',
  'event ExitRoundOpened(uint256 endsAt)',
  'event ExitRoundClosed(uint256 cooldownEndsAt)',
  'event Redeemed(address indexed holder, uint256 tokens, uint256 out, uint256 bookValue)',
  'event TrancheUnlocked(uint256 indexed index, uint256 amount)',
  'event Heartbeat(uint256 at)',
  'event WoundDown(uint8 reason)',
  'event ReportPosted(uint256 indexed period, string uri, bytes32 hash)',
  'error NotRedeemable()',
  'error Slippage()',
  'error NotTeam()',
  'error NotOracle()',
  'error NotDue()',
  'error OnlyDown()',
  'error BadState()',
]);

export const launcherAbi = parseAbi([
  'function state() view returns (uint8)',
  'function launching() view returns (bool)',
  'function token() view returns (address)',
  'function vault() view returns (address)',
  'function committed() view returns (uint256)',
  'function minRaise() view returns (uint256)',
  'function cap() view returns (uint256)',
  'function deadline() view returns (uint256)',
  'function contributions(address) view returns (uint256)',
  'function acceptedOf(address) view returns (uint256)',
  'function allocationOf(address) view returns (uint256)',
  'function refundOf(address) view returns (uint256)',
  'function saleDeadline() view returns (uint64)',
  'function contributorCount() view returns (uint256)',
  'function description() view returns (string)',
  'function contribute() payable',
  'function finalize()',
  'function claimRefund()',
  'event Contributed(address indexed who, uint256 amount)',
  'event Finalized(uint8 state, uint256 accepted)',
  'event Refunded(address indexed who, uint256 amount)',
]);

export const oracleAbi = parseAbi([
  'function poke(address vault)',
  'function lastPokeAt(address vault) view returns (uint256)',
  'function minInterval() view returns (uint256)',
  'function bnbUsdFeed() view returns (bytes4)',
  'function atlasSigner() view returns (address)',
  'error TooSoon()',
  'error UnknownVault()',
]);

export const pairAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
]);

export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
]);

/** Flap tax tokens route trading tax through a processor whose dispatch() anyone can call. */
export const taxTokenAbi = parseAbi([
  'function taxProcessor() view returns (address)',
  'function dispatch()',
  // Flap's tax processor: balances it keeps for itself (not dispatched to the vault)
  'function feeQuoteBalance() view returns (uint256)',
  'function marketQuoteBalance() view returns (uint256)',
  'function lpQuoteBalance() view returns (uint256)',
  'function pendingDividendQuoteTokenBalance() view returns (uint256)',
]);

/** ERC-8004 registries (docs/DESIGN.md "Optional contract changes"). */
export const identityRegistryAbi = parseAbi([
  'function ownerOf(uint256 agentId) view returns (address)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function register(string agentURI) returns (uint256 agentId)',
]);

export const reputationRegistryAbi = parseAbi([
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
]);
