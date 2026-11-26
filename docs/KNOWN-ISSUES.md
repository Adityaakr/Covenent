# Known issues

Every item raised so far by Flap's audit bot (review of `641afab`, 26 Nov 2026) and by the independent AI pre-audit
(`de0cd0c`, 26 Nov 2026), with its status, so reviewers can check the fix or the reasoning instead of re-raising it.

Status: **Fixed** (code changed, regression test named), **Disclosed** (kept by design, documented on-chain and in the
app), **Accepted** (a known limit with a stated reason), **Server** (fixed in the server by the agentic review, not in
this list's contracts).

## Contracts

| ID | Item | Status | Where |
|---|---|---|---|
| Flap 1 | `newLauncher` did not screen name and symbol with Flap's `isScamWord` | Fixed: the factory asks Flap's screen at creation (`NameOrSymbolBlocked`) | `CovenantLauncherFactory._checkName`; fork test `test_fork_blockedNameOrSymbol_revertsAtCreate_normalNamePasses` |
| Flap 2 | `finalize()` needs at least 15M gas | Fixed: `FINALIZE_GAS_LIMIT` = 16.7M, sent by the app, API/MCP, keeper and agents | `CovenantLauncher.FINALIZE_GAS_LIMIT`; server and web tests |
| Flap 3 | Default 30-day tax; treasury only shrinks after it | Fixed: bounded 30 days to 100 years (and at least the anti-farmer window), default 100 years; end date shown | `CovenantTermsLib.validate` |
| Flap 4 | Guardian can `windDown()` any covenant | Disclosed; the vault records and emits who wound it down | `windDownCause`, `WindDownCaused` |
| Flap 5 | Fixed 10 BNB pool floor vs Flap's pool-share floors | Fixed: live `graduationFloorV2` check (graduation floor in production, launch floor in demo); `minRaiseFor` | `CovenantLauncherFactory._checkFloor` |
| Flap 6 | One Atlas signer could unlock team tokens with a bad rate | Fixed: unlock needs the multiple in BNB (pool TWAP) as well as in dollars | `CovenantVault._stepTranches`; `test_unlock_anOutlierAtlasRateAloneCannotUnlock` |
| Flap 7 | Rounding dust left in the launcher | Fixed: `sweepDust()` once every refund is out | `CovenantLauncher.sweepDust` |
| Flap 8 | Refunds are pull-only | Disclosed (kept for safety); Claim CTA, keeper `claims-open` alert, MCP `get_position` | |
| Flap 9 | No per-wallet cap | Disclosed by design: pro rata above the cap, excess refunded | |
| Flap 10 | Guardian can upgrade both beacons | Disclosed: refund BNB and treasury are only as safe as the Guardian (Flap's spec) | NatSpec, README, DESIGN.md, app |
| Pre H-1 | The poker chose strictness: withheld reports skipped the tranche reset | Fixed: a trusted, non-strict observation resets the unlock counters | `test_H1_withheldReports_resetTheTranches_insteadOfSkippingThem` |
| Pre M-1 | The last BNB/USD never expired | Fixed: it expires after `staleAfter`; without a fresh rate the tap pauses (no cap-only fallback) | `freshBnbUsd`; `test_M1_staleBnbUsd_expires_andStopsPricingTheTap` |
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
| H-1 side effect | Draining the pool under half its seed makes observations non-strict and resets the team's unlock counters | Accepted: griefing that costs the attacker and only delays the team | |
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
