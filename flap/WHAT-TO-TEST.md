# Covenant on flap.sh: what to send Flap and what to test

Chain: BSC Testnet (97). All addresses come from `contracts/deployments/97.json`. Checksums are in
`flap/packages/SHA256SUMS`.

## Production set and demo set

Covenant has two factory pairs on testnet. The contracts and UI are identical; the pairs differ only in the factory
profile (`contracts/src/launcher/CovenantProfiles.sol`).

- **Production** (`launcherFactory`, `vaultFactory`): the real bounds.
  - Sale at least 1 day, exit streak at least 1 day, heartbeat at least 14 days, unlock window at least 7 days.
  - The minimum raise must clear Flap's graduation floor with a 1.5x margin (`requireGraduation`). On testnet that
    is more tBNB than we can put into a test raise, so no Launcher has been created on it yet.
  - This is the set to bind after the audit.
- **Demo** (`demoLauncherFactory`, `demoVaultFactory`): the same rules with timers in minutes.
  - The raise only needs Flap's creation floor (with the 1.5x margin), so a token launches but may not graduate.
  - Flap's test launch is on this pair, so **use the demo set for the preview**.

| | Production | Demo (use for the preview) |
|---|---|---|
| Launcher UI zip | `covenant-launcher-ui.zip` | `covenant-launcher-ui-demo.zip` |
| Launcher artifactId | `covenant-launcher` | `covenant-launcher-demo` |
| Launcher Factory | `0x528374FeF9da2C31C646E59AE19EB2aE18b7a0DF` | `0x0F92C58c6aC5A3f6A5E3fF23a7698F58306Df2aE` |
| Vault UI zip | `covenant-vault-ui.zip` | `covenant-vault-ui-demo.zip` |
| Vault artifactId | `vaultui_covenant-vault_01M8CE66GAFS2GH973DAR062SG` | `vaultui_covenant-vault-demo_01M8CMW2QF2AR4EF4ZTN4JG972` |
| Vault Factory | `0xAbb9811f529B793c86848211522B789071671ebC` | `0x6d3a421708F8b45FbD92342d33a841de40E6cC8F` |

Test launch on the demo pair (launched; Launcher, token and vault all verified on chain):

- **Launcher:** `0xFb40790832BBAF5ABe61Db0beEc575468c973045`, state Launched. It raised 3.9682 tBNB, which equals
  its minimum and its cap. `expectedToken()` equals the issued token.
- **Token:** `0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777` (CVD). Both Vault UI manifests use it as the acceptance
  token.
- **Vault:** `0xFdC8dA0C251ED1f24cef6d9220aDa60E311638bE`, state Active, treasury about 0.397 tBNB.

**Binding (Vault UI F-01, Launcher UI F-01).** Bind both factory pairs. The two pairs run identical launcher and vault
code, so the same components serve both:

- **Now:** the demo set. Bind `covenant-vault-ui-demo.zip` to demo Vault Factory
  `0x6d3a421708F8b45FbD92342d33a841de40E6cC8F` and `covenant-launcher-ui-demo.zip` to demo Launcher Factory
  `0x0F92C58c6aC5A3f6A5E3fF23a7698F58306Df2aE`. CVD and its Launcher and vault come from this pair.
- **After the audit:** the production set. Bind `covenant-vault-ui.zip` to production Vault Factory
  `0xAbb9811f529B793c86848211522B789071671ebC` and `covenant-launcher-ui.zip` to production Launcher Factory
  `0x528374FeF9da2C31C646E59AE19EB2aE18b7a0DF`. No Launcher exists on this pair yet. The production Vault UI manifest
  names CVD only as the E2E acceptance token, because no production token exists; a Safe Bind of the production
  factory does not reach CVD's page.

**Creation form (Launcher UI F-02).** Both Launcher packages are detail-only (`launcher-detail/v1`). For now Flap's
generic creation form, built from the factory's `launcherDataSchema()`, is intended at `/create/launcher`.

Preview links on the testnet host, once Workbench has built the demo zips:

- Launcher: `/launcher/0xFb40790832BBAF5ABe61Db0beEc575468c973045?chain=bnb-testnet&kind=launcher-detail&artifactPath=<launcher artifact>`
- Vault: `/bnb-testnet/0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777/taxinfo?…&artifactPath=<vault artifact>`

The Launcher manifest declares transactions: `contribute` (payable), `finalize` and `claimRefund`. It therefore
needs a Workbench Preview with the wallet bridge. Without the bridge the page is read-only and says so.

## Launcher UI

1. **Test launch.** The badge reads "Launched".
   - Committed shows 3.9682 tBNB at 100% of the cap, with "minimum reached".
   - Minimum and cap both read 3.9682 tBNB, plus sale end (2026-11-26 18:59 UTC), 1 contributor, 500,000,000 tokens
     for sale and one sale price, "0.007936 tBNB per 1M tokens" (prices under 0.000001 per token read per 1M).
   - The split reads "90% of the accepted raise seeds the PancakeSwap pool … the other 10% goes to the covenant
     vault's treasury" (from `poolAmount / saleAmount`). Below it: the vault rules, the tax period and Flap's Guardian.
   - The token shows `0xcd4c…7777`, and "Open the vault page" redirects to `/bnb-testnet/<token>/taxinfo`.
   - The wallet section shows your commitment, sale tokens and refund. An exactly-filled raise has no refund.
2. **Artifact preview with no Launcher:** it shows "Open a Covenant Launcher from this factory…".
3. **A new demo raise, to test the wallet flow.** Its sale can be as short as 60 seconds.
   - While the sale is open: commit and confirm, and the committed amount and your commitment update.
   - After the deadline the badge reads "Sale ended, awaiting finalize" and anyone can Finalize.
   - Finalize launches the token and funds the vault in one transaction. It needs 12M gas left at its check and uses
     about 5.5M. The host bridge's `submit` takes no gas field, so the wallet's estimate sets the limit; the review
     step says so. With too little gas it reverts and the raise is unchanged.
   - After the retry window (`launchRetryUntil`) the hint says a refused launch now fails the raise with full refunds.
   - Below the minimum, Finalize fails the raise and Claim refund returns the full commitment. Above the cap, the
     excess refunds pro rata after launch. A raise that ends with nothing committed reads "Closed, never funded".
   - Enter 0 as the amount: Commit stays disabled and the field says to enter an amount above 0.
4. Switch the language to zh and ko.

## Vault UI (on the CVD vault)

1. Flap's risk status is the first badge, with the covenant state beside it: Active, Exit round open, Cooldown or
   Ended.
2. Metrics: book value in BNB per token, treasury (free BNB) and exit streak progress, with the streak length read
   from the vault ("3 min" on CVD).
3. Holder actions:
   - Claim sale tokens: shown when the wallet has an allocation. The test launch's only contributor (the deployer)
     has already claimed, so this appears only for a new demo raise.
   - Redeem: only during an exit round or after wind-down. It approves exactly the amount, then redeems with
     `minOut` 1% under the preview.
   - Declare abandoned: shown once the heartbeat has lapsed.
   - Release unlocked team tokens: shown when there are any.
4. Team panel, shown to the team wallet only: claim tap, heartbeat, lower tap (USD per 30 days, down only), post a
   report, and wind down (two-step confirm).
   - Lower tap accepts 0; the first press shows that 0 stops the tap for good and turns into "Confirm: set the tap
     to 0".
   - Type a period that already has a report: "A report for this period is already posted" appears and Post report
     is disabled.
   - Past the heartbeat deadline, wind down warns that the owed tap is forfeited.
5. "Rules and treasury" shows:
   - tap budget and cap, tap paid and owed;
   - each tranche's multiple and progress, and the team tokens;
   - the heartbeat deadline, or how the covenant ended;
   - how the tap accrues, the unlock rule (window and cliff from the vault: 2 min, no cliff on CVD), the trading tax
     ("buy 1%, sell 1% … until 2126-11-02 UTC" on CVD, parsed from the vault's `description()`);
   - treasury at launch, revenue and redemptions, the contract addresses, and what Flap's Guardian can do.
7. In a cooldown, the countdown runs to `roundEnd + cooldown`, also before any transaction has written
   `cooldownEnd`.
6. On the wrong network, every write is blocked with a message.

## Workbench findings resolved

### Vault UI (job c3f67fa8-5c0a-4103-a4f8-ebba72971268)

| Finding | Change |
|---|---|
| U-01 cooldown countdown | Reads `cooldown()`. The countdown targets `cooldownEnd` when it is past `roundEnd`, else `roundEnd + cooldown` (covers 0 and a value left by a previous round). |
| U-02 lowerTap to 0 | 0 is a valid budget; a first press arms a warning that 0 stops the tap for good, a second press sends it. A `TapNotLower` revert gets its own message. |
| U-03 report already posted | Reads `report(period)` as the period is typed and again before sending; shows "A report for this period is already posted" (en/zh/ko) and disables Post report. A `ReportExists` revert maps to the same message. |
| M-01 exit streak | States that the streak decays (time above book value cancels time below), runs on the pool TWAP at oracle observations, and shows `exitStreakNeeded` as a duration. |
| M-02 tap accrual | States that the tap grows only on oracle observations, at the lower of the USD budget and the cap, not during an exit round, not while a verdict stands failed, not before a verified rate, and that unclaimed tap stops at one period's cap. A paused tap (`disclosurePaused`) shows an alert. |
| M-03 tax period | Shows the buy and sell tax and the real end date from the vault's `description()` (launcher terms on chain), and that after it no tax refills the treasury. |
| M-04 tranche dilution | States the unlock rule with `unlockWindow` and `cliff` read from the vault, and that an unlocked tranche joins redeemable supply and lowers book value per token. |
| M-05 wind-down forfeit | Team copy: past the heartbeat deadline a wind-down counts as abandonment and forfeits the owed tap; an alert shows the amount when the deadline has passed. |
| M-06 Guardian | Reworded to "Through an upgrade … the Guardian can change any rule. Without an upgrade it can … but it cannot …" in en/zh/ko. |
| F-01 binding | See "Binding" above: demo pair now, production pair after the audit. |
| F-02 pre-audit | Not a UI change: the pre-audit recheck on the deployed contracts is still open, so production binding waits for it. |

### Launcher UI (job 19f3eeaa-5ac5-4375-b502-37b909c6d448)

| Finding | Change |
|---|---|
| U-01 finalize gas | The host's `submit({ kind, action, valueWei })` has no gas field, so the component cannot set 15M. The copy now says finalize needs 12M left at its check, the wallet may show up to 15M (Flap's cap), only about 5.5M is paid, and too little gas reverts with the raise unchanged. If Flap's bridge can send `finalize` with a 15,000,000 gas limit, please do. |
| U-02 date formatting | No `Intl` at all: sale end and retry times are formatted by hand as `YYYY-MM-DD HH:MM UTC`. |
| U-03 tiny prices | Prices keep four significant figures; under 0.000001 per token they read per 1M tokens (CVD: 0.007936 tBNB per 1M tokens). |
| M-01 no withdrawal | Intro and commit help: commitments cannot be withdrawn before finalize. |
| M-02 retry window | The retry hint adds that a refusal after the window fails the raise with full refunds; once the window has passed, the hint says so directly. |
| M-03 raise split | "Most of the raise sits in the vault" is gone. The split is computed from on-chain `poolAmount / saleAmount` (the `creator` read was swapped for `poolAmount` to stay within 16 reads): 90% seeds the pool and 10% goes to the vault on CVD. |
| M-04 tax | States that the buy and sell tax goes to the vault only for the tax period set at launch. The Launcher has no flat getter for the tax rates or duration (they sit in `terms()`), so the rates and end date are shown on the token's vault page, not here. |
| M-05 Guardian | States that Flap's Guardian can upgrade the Launcher, which holds the committed BNB until finalize, and the vault. |
| Also | A raise that ended with nothing committed reads "Closed, never funded" with nothing to refund; an amount of 0 shows a hint. |
| F-01 binding | Same as the Vault UI: demo pair now, production after the audit. |
| F-02 creation form | Flap's generic form is intended for now (see above). |
| S-01 no Launcher validation | On Flap's side. Local checks on template `main` b912fd1 (runtime 0.1.50): `yarn launcher:check-source` on the production and demo sources both return `"ok": true` (`launcher-detail/v1`); `yarn launcher:package` (which reruns those checks) built both zips; `yarn test:launcher-source` passes 26 of 26. |
