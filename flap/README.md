# Covenant on flap.sh

Covenant's own UI packages for Flap's pages, built with Flap's template
([flap-sh/flap-vault-component-template](https://github.com/flap-sh/flap-vault-component-template), `main`). Flap
builds and hosts them inside flap.sh; nothing here links out to the Covenant app.

| Folder | Flap surface | What it does |
|---|---|---|
| `launcher-ui/` | Launcher page, `/launcher/<launcher>` (`launcher-detail/v1`) | Raise progress against the minimum and the cap, sale end, price range, contributors, reserved or issued token. With Flap's wallet bridge: commit (`contribute`, payable), `finalize` and `claimRefund`, plus the wallet's commitment, refund and allocation. After launch it sends the visitor to the token's vault page. |
| `vault-ui/` | Token vault page, `/<chain>/<token>/taxinfo` (factory-scoped Vault UI) | Book value, treasury, exit streak, host risk status. Holders: claim sale tokens, redeem in an exit round or after wind-down (exact-amount approval, 1% slippage floor), declare abandonment, release unlocked team tokens. Team wallet only: claim and lower the tap, heartbeat, post a report, wind down. Rules and treasury details: tap, tranches, heartbeat deadline, revenue, redemptions. |
| `packages/` | | The zips Flap receives, and `SHA256SUMS`. |

Without these packages Flap still renders default pages from the contracts: the creation form from the launcher
factory's `launcherDataSchema()`, the vault page from the vault's `vaultUISchema()`.

## Rebuild

```bash
node flap/scripts/sync-manifests.mjs            # chain and factory addresses from contracts/deployments/97.json
node --test flap/test/*.test.mjs                # manifests, ABIs, translations, zips vs sources
FLAP_TEMPLATE_DIR=<template checkout on main> flap/scripts/package.sh --vault <vault of the manifest's test token>
```

`package.sh` runs Flap's `vault:check`, `vault:e2e` (PC, iPad and phone, each market phase, wrong network),
`vault:package`, `vault:verify-package` and `launcher:package`, then copies both zips here with their SHA-256. Flap's
packaging refuses a template checkout that is not exactly `origin/main` at the latest published runtime. After a
redeploy, run `sync-manifests.mjs`, then `package.sh`. Pass `--test-token` to `sync-manifests.mjs` with a real token
ending in 7777 if the vault factory changes. The Vault UI manifest needs one real token for Flap's E2E run, and it
does not restrict which tokens the UI serves.

Other tools:

```bash
node flap/scripts/print-schemas.mjs --rpc <bsc testnet rpc> [--launcher 0x…]   # what Flap's default pages read
node flap/scripts/render-launcher.mjs <out-dir> --rpc <rpc> --launcher 0x…      # Launcher UI as static HTML, live reads
```

Both use `server/node_modules` (viem). `render-launcher.mjs` also uses `web/node_modules` (React, TypeScript), because
Flap's template has no local preview for `launcher-detail/v1`.

## Rules Flap enforces

- Launcher source: only `react` imports, inline styles, no `new`, timers, URLs, `<a>`/`<img>`, browser globals, or
  identifiers Flap reserves (`top`, `parent`, `request`, `location` and others). Each file under 256 KB. Messages
  in `en`, `zh` and `ko` with identical keys. At most 16 reads (8 without transactions), each a no-argument getter
  returning `address`, `bool` or `uint256` (or one `address` argument with `account: true`). At most 8 zero-argument
  actions.
- Vault source: exactly the four files. Only `@/src/sdk`, `@/src/ui`, `viem` and `lucide-react`. No URLs in messages.
  The host's risk status within the first three blocks. Calls only to the vault and the token.
