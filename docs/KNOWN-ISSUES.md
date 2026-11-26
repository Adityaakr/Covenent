# Known issues

Every item raised so far by Flap's audit bot (review of `641afab`, 26 Nov 2026; its pre-audit verdict F1 to F8 on the
same commit, re-reviewed below) and by the independent AI pre-audit (`de0cd0c`, 26 Nov 2026), with its status, so
reviewers can check the fix or the reasoning instead of re-raising it.

Status: **Fixed** (code changed, regression test named), **Disclosed** (kept by design, documented on-chain and in the
app), **Accepted** (a known limit with a stated reason), **Server** (fixed in the server by the agentic review, not in
this list's contracts).

## Flap pre-audit re-review (F1 to F8)

Each fix has a unit test in `contracts/test/regression/FlapReReview.t.sol` (the bot's PoC with the assertion it asked
for) and a fork test against Flap's live Portal on BNB Chain and BNB testnet (`test_fork_F*` in
`contracts/test/fork/Covenant.BSC.fork.t.sol`).

| ID | Item | Status | Where |
|---|---|---|---|
| F1 | Pool-seed floor not checked against Flap's real floors | Fixed: the minimum raise's seed less a third must meet `graduationFloorV2(...).meetsFloor` (the Portal's own answer, live price, our vault factory's multiplier): `FLOOR_MARGIN_BPS` = 1.5x. The demo factory (minute timers, for the stage and testnet) needs Flap's creation floor (`meetsCreateFloor`) with the same 1.5x margin, so a testnet demo fits a few tBNB; its tokens launch but may not graduate (disclosed) | `CovenantLauncherFactory._checkFloor`, `minRaiseFor`; `test_F1_*`; fork `test_fork_F1_floorByPoolShare_5_15_50_graduatesAtTheMinimum`, `test_fork_F1_theMarginAbsorbsAFloorMoveDuringTheSale` |
| F2 | No name or symbol screen at creation (USDT / USDT) | Fixed: `isScamWord` on Flap's module at creation, fixed per chain, failing closed when the module does not answer | `CovenantLauncherFactory._checkName`, `FlapChain`; `test_F2_*`; fork `test_fork_F2_usdtUsdt_refusedAtCreate_andTheScreenCannotBeSkipped` |
| F3 | Portal tax rules not pre-checked | Fixed: max(buy, sell) >= 100 bps (probed: the Portal refuses 1/0, 50/0, 99/99 with `InvalidTaxBps`), each <= 1000, taxDuration >= `antiFarmerDuration` | `CovenantTermsLib.validate`; `test_F3_*`; fork `test_fork_F3_taxEdgeCases_areRefusedAtCreate_asThePortalRefusesThem` (also shows the Portal's own refusals) |
| F4 | A dip can be hidden from the unlock counter by a reportless poke | Fixed: a trusted observation without a rate values the TWAP at the last verified rate and resets each counter that misses its multiple (all of them when that rate is over `maxStep` old or the pool is shallow), never adds; a strict window must also hold since the last poke; unlock time is continuous strict time (an interval over `maxStep` resets) | `CovenantVault._observeTranches`, `CovenantVaultDisplay.observeTranches`; `test_F4_*`; fork `test_fork_F4_dipWithAReportlessPoke_resetsTheCounterOnTheLivePool` |
| F5 | A reportless poke blocks the strict poke (TooSoon); the tap fell back to the cap | Fixed: a poke with a verified rate waits only for the previous poke with a rate (`ratePoints`, `nextRatePokeAt`); the keeper decides it is due from that point; the tap prices the dollar budget at the last verified rate however old, never the cap alone | `CovenantOracle._observe`, `CovenantVault._accrueTap`, `server/src/keeper/keeper.ts`; `test_F5_*` (20 days with no report: 1.111 BNB accrued against a 1.111 BNB budget); fork `test_fork_F5_aReportlessPokeCannotBlockTheKeeper`; server `flap-rereview.test.ts` |
| F6 | Flap addresses are constructor arguments | Fixed: on chains 56 and 97 both factories revert `NotFlapAddress` unless hub, Guardian, Token Dock router and name screen are `LaunchVaultAddresses` / `FlapChain` | factory constructors; `test_F6_*`; fork `test_fork_F6_factoriesRefuseNonFlapAddresses` |
| F7 | 15M launch gas floor; callers must set the gas limit | Fixed: the floor is 12M left at the check (Flap's vault SDK and flap.sh cap a gas override at 15M, so a 15M floor could never pass through them); every client sends `FINALIZE_GAS_LIMIT` = 15,000,000; a starved call still reverts and leaves the raise open; the launcher's `description()` carries `finalizeGasLimit`; README says so | `CovenantLauncher`; `test_F7_aFifteenMillionGasTransactionFinalizes_aStarvedOneReverts`, `test_finalize_withTooLittleGas_revertsInsteadOfFailing`; the fork journey refuses 11.9M and launches with a 15M transaction on both chains |
| F8 | The vault description does not say what happens after the tax period | Fixed: "Trading tax (...) is the treasury's income until <date> UTC; after that the tap is paid only from the treasury, so book value only falls unless the team deposits revenue (depositRevenue)." | `CovenantVaultDisplay.describe`; `test_F8_*`; fork journey |
| NEW-1 | Found by the independent re-review of these fixes: a holder could sell in one block until the pool's spot BNB reserve read under half the seed, poke, and buy back, wiping every unlock counter (the non-strict branch treated a shallow pool as a reset) | Fixed: depth is the pool's BNB reserve at the window's TWAP on its own invariant, sqrt(k x TWAP), which no swap can lower within a block; the non-strict branch no longer uses depth | `test_NEW1_*`; fork `test_fork_NEW1_aSameBlockSaleCannotWipeTheCounters` |
| UI | `vaultUISchema` named `tapAccrued`, a view the vault no longer has | Fixed: `owedTeam` | `test_vaultUISchema_everyViewItNamesExists` |
| R2 info | The first observation reads the spot reserve (there is no window yet), so a same-block sale can make it non-strict | Accepted: without a push feed at launch it delays the first BNB/USD reference (tap, dollar sale price) by one poke gap and cannot be repeated; on BNB testnet the push feed fixes the dollar sale price at launch | independent re-review round 2 |
| R2 info | A crash in the last minutes of a keeper window still reads deep, and that window's TWAP may still hold the multiple | Accepted: the TWAP lag the multiple check already has, at most one window (`maxStep`); the next window resets | independent re-review round 2 |
| R2 info | A demo raise at its minimum (1.5x the creation floor) fails if Flap's BNB price falls more than a third during the sale | Accepted for the demo factory (refunds in full after the retry window); production fails only past a two-thirds fall | independent re-review round 2 |
| UI | Flap's UI needs flat raise views | Added: launcher `minRaise()`, `cap()`, `expectedToken()` (the token address the locked salt produces; equal to the launched token on both forks) | `test_launcherViews_*`; fork journey |

## Contracts

| ID | Item | Status | Where |
|---|---|---|---|
| Flap 1 | `newLauncher` did not screen name and symbol with Flap's `isScamWord` | Fixed: the factory asks Flap's screen at creation (`NameOrSymbolBlocked`), failing closed (F2) | `CovenantLauncherFactory._checkName`; fork test `test_fork_blockedNameOrSymbol_revertsAtCreate_normalNamePasses` |
| Flap 2 | `finalize()` needs at least 15M gas | Fixed: `FINALIZE_GAS_LIMIT` = 15M (12M floor at the check, re-review F7), sent by the app, API/MCP, keeper and agents | `CovenantLauncher.FINALIZE_GAS_LIMIT`; server and web tests |
| Flap 3 | Default 30-day tax; treasury only shrinks after it | Fixed: bounded 30 days to 100 years (and at least the anti-farmer window), default 100 years; end date shown | `CovenantTermsLib.validate` |
| Flap 4 | Guardian can `windDown()` any covenant | Disclosed; the vault records and emits who wound it down | `windDownCause`, `WindDownCaused` |
| Flap 5 | Fixed 10 BNB pool floor vs Flap's pool-share floors | Fixed: live `graduationFloorV2` check, the graduation floor with a 1.5x margin in production, the creation floor with the same margin in the demo factory (F1); `minRaiseFor` | `CovenantLauncherFactory._checkFloor` |
| Flap 6 | One Atlas signer could unlock team tokens with a bad rate | Fixed: unlock needs the multiple in BNB (pool TWAP) as well as in dollars | `CovenantVault._stepTranches`; `test_unlock_anOutlierAtlasRateAloneCannotUnlock` |
| Flap 7 | Rounding dust left in the launcher | Fixed: `sweepDust()` once every refund is out | `CovenantLauncher.sweepDust` |
| Flap 8 | Refunds are pull-only | Disclosed (kept for safety); Claim CTA, keeper `claims-open` alert, MCP `get_position` | |
| Flap 9 | No per-wallet cap | Disclosed by design: pro rata above the cap, excess refunded | |
| Flap 10 | Guardian can upgrade both beacons | Disclosed: refund BNB and treasury are only as safe as the Guardian (Flap's spec) | NatSpec, README, DESIGN.md, app |
| Pre H-1 | The poker chose strictness: withheld reports skipped the tranche reset | Fixed, refined by F4/F5: a trusted, non-strict observation resets each counter that misses its multiple at the last rate (all once that rate is over `maxStep` old), and unlock time is continuous strict time; a plain poke at a holding price no longer wipes the team's progress | `test_H1_withheldReports_resetTheTranches_insteadOfSkippingThem` |
| Pre M-1 | The last BNB/USD never expired | Superseded by F5. The root cause (a poker keeping the rate stale by front-running reports) is closed: a report always gets through, so the tap follows the fresh rate. With no report at all (an outage) Flap's rule applies: the dollar budget at the last verified rate, capped; the pause the first fix added let anyone who blocked reports stop the tap. Accepted residue: in a long outage the tap is priced at an old rate, within the cap | `test_M1_withheldReports_cannotKeepTheRateStale`; `test_F5_noStrictObservationFor20Days_tapStaysWithinTheBudgetAtTheLastRate` |
| Pre M-2 | The first strict poke picked the dollar sale price | Fixed: set at launch from a fresh push feed; else ratchets up only for `staleAfter` | `_setStrictRate`; `test_M2_*` |
| Pre M-3 | Terms the factory accepted were refused by the Portal at launch | Fixed: at least one tax rate, tax duration bounds, name screen, floor, all at creation | `test_M3_*`; fork `test_fork_termsThePortalRefuses_areRefusedAtCreate` |
| Pre §3 | Guardian powers beyond `windDown` (lowerTap, postReport, claimTap) | Disclosed in full, including `description()`; the vault records who posted each report | `test_guardianPowers_areDisclosed_andRecorded` |
| Pre §3 | Second dust pool: sale tokens in the Token Dock counted in R | Fixed: `burnSaleDust()` burns what no claim can reach (an upper bound on unclaimed allocations) | `test_dust_saleTokenRemainder_isBurned_neverAnUnclaimedAllocation` |
| Pre L-1 | A report could be rewritten after a passing verdict | Fixed: write-once per period | `test_L1_*` |
| Pre L-2 | A late pass on an old period lifted a newer failure; verdicts on missing reports | Fixed: verdicts per period, pause while any stands failed; a pass needs a posted report | `test_L2_*` |
| Pre L-3 | Salt squatting of a pending `newLauncher` | Accepted: Flap's salt lock gives a salt to its first locker (verified on a fork: a second lock reverts), so no factory change can prevent it. The squatter gets a launcher paying its own team wallet, shown on the page; the issuer mines a new salt (seconds) and can send through a private RPC | `test_L3_*` |
| Pre L-4 | A lapsed team could `windDown` to keep the tap | Fixed: past the deadline a wind-down is an abandonment | `test_L4_*` |
| Pre L-5 | A transient Portal refusal failed the raise for good | Fixed: retry window (3 days production, 10 minutes demo) before FAILED | `test_refusedLaunch_canBeRetried_insideTheWindow` |
| Pre L-6 | Redeem builder approved `maxUint256` | Fixed: exact amount | `server/src/covenant/tx.ts` |
| Pre L-11 | LiteVault read R before the burn transfer | Fixed: reads after the transfer | `CovenantLiteVault.redeem` |
| Pre L-12 | LiteVault allowed a 50%-per-day tap | Fixed: at most 10% per period of 30 to 90 days | `CovenantLiteVault` bounds |
| Pre I-1 | Tax tokens sent to the vault were stuck in R | Fixed: `burnSaleDust()` burns them | |
| Pre I-2 | `reportRelayer` could equal `teamWallet` | Fixed: refused at creation | `test_I2_*` |
| Pre I-3 | Strict time before the cliff counts toward the window | Accepted, documented in DESIGN.md (Rule 2) | |
| Pre I-4 | `agentId` ownership checked only at creation | Accepted: the lens shows `agentBound` live | |
| Pre I-5 | Lens reads `roundsOpened` before assigning it | Accepted, harmless | |
| Pre I-6 | Naming (`upgradeVaultImplementation` upgrades launchers, `exitStreak` target vs value) | Accepted: Flap's inherited names; documented here | |
| Pre I-8 | The exit rule needs someone to poke | Disclosed: anyone can poke (app button, MCP tool) | |
| Pre I-9 | A BNB donation can force an exit round | Accepted: it costs the donor and benefits holders | |
| Pre I-10 | Floating pragmas | Fixed: Covenant's own contracts pin `0.8.26` | |
| H-1 side effect | Draining the pool under half its seed made observations non-strict and reset the team's unlock counters | Fixed by NEW-1: depth is read at the TWAP on the pool's invariant, and only a lasting drain reads shallow; a non-strict observation never resets on depth | `test_NEW1_*` |
| M-2 residue | Without a push feed (BNB Chain mainnet today) the first window's rates set the dollar reference | Accepted: a dip only counts if every honest strict poke in the window is front-run, and the BNB leg still needs the real multiple | |

## Server and agentic surface (handled by the agentic review)

| ID | Item | Status |
|---|---|---|
| A-1 | Unverified vault addresses listed and trusted; unlimited approvals to them | Server |
| A-2 | RPC URL (and key) in `/health`, 500 details and the web `/api/deployment` | Server |
| A-3 | Mainnet keeper signs with the anvil key and never falls back to a bare poke | Server |
| L-7 | Issuer agent's irreversible pay cut on manipulable spot | Server |
| L-8 | Unbounded API work, open CMC/Atlas proxies | Server |
| L-9 | Faucet trusts the first X-Forwarded-For hop; loopback treated as dev chain | Server |
| L-10 | Loopback URIs written on chain | Server |
| L-13 | MCP transaction builders marked `readOnlyHint` | Server |
| L-14 | Raw untrusted text to MCP clients; investor agent signs unchecked transactions | Server |

## Other

- The Atlas pull-oracle consumer under `contracts/src/vendor/atlas` is BUSL-1.1 (see `contracts/VENDORED.md`); confirm
  terms with Atlas before a production deployment.
- Contract `version()` returns "1.0.0" while the packages are 0.1.0.
