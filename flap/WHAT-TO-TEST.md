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

Preview links on the testnet host, once Workbench has built the demo zips:

- Launcher: `/launcher/0xFb40790832BBAF5ABe61Db0beEc575468c973045?chain=bnb-testnet&kind=launcher-detail&artifactPath=<launcher artifact>`
- Vault: `/bnb-testnet/0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777/taxinfo?…&artifactPath=<vault artifact>`

The Launcher manifest declares transactions: `contribute` (payable), `finalize` and `claimRefund`. It therefore
needs a Workbench Preview with the wallet bridge. Without the bridge the page is read-only and says so.

## Launcher UI

1. **Test launch.** The badge reads "Launched".
   - Committed shows 3.9682 tBNB at 100% of the cap, with "minimum reached".
   - Minimum and cap both read 3.9682 tBNB, plus sale end (UTC), 1 contributor, 500,000,000 tokens for sale and
     one sale price per token.
   - The token shows `0xcd4c…7777`, and "Open the vault page" redirects to `/bnb-testnet/<token>/taxinfo`.
   - The wallet section shows your commitment, sale tokens and refund. An exactly-filled raise has no refund.
2. **Artifact preview with no Launcher:** it shows "Open a Covenant Launcher from this factory…".
3. **A new demo raise, to test the wallet flow.** Its sale can be as short as 60 seconds.
   - While the sale is open: commit and confirm, and the committed amount and your commitment update.
   - After the deadline the badge reads "Sale ended, awaiting finalize" and anyone can Finalize.
   - Finalize launches the token and funds the vault in one transaction. It is sent with a 15,000,000 gas limit
     (Flap's cap), needs 12M left at its check, and uses about 5.5M.
   - Below the minimum, Finalize fails the raise and Claim refund returns the full commitment. Above the cap, the
     excess refunds pro rata after launch.
4. Switch the language to zh and ko.

## Vault UI (on the CVD vault)

1. Flap's risk status is the first badge, with the covenant state beside it: Active, Exit round open, Cooldown or
   Ended.
2. Metrics: book value in BNB per token, treasury (free BNB) and exit streak progress.
3. Holder actions:
   - Claim sale tokens: shown when the wallet has an allocation. The test launch's only contributor (the deployer)
     has already claimed, so this appears only for a new demo raise.
   - Redeem: only during an exit round or after wind-down. It approves exactly the amount, then redeems with
     `minOut` 1% under the preview.
   - Declare abandoned: shown once the heartbeat has lapsed.
   - Release unlocked team tokens: shown when there are any.
4. Team panel, shown to the team wallet only: claim tap, heartbeat, lower tap (USD per 30 days, down only), post a
   report, and wind down (two-step confirm).
5. "Rules and treasury" shows:
   - tap budget and cap, tap paid and owed;
   - each tranche's multiple and progress, and the team tokens;
   - the heartbeat deadline, or how the covenant ended;
   - treasury at launch, revenue and redemptions, the contract addresses, and what Flap's Guardian can do.
6. On the wrong network, every write is blocked with a message.
