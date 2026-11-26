# Deployments

- `local.json`: written by `scripts/dev-up.sh` for the dev chain (git-ignored). Shape:
  `{chainId, rpcUrl, mode, deployedAtBlock, addresses{...}, atlas{...}, accounts{...}, demo{...}}`.
- `<chainId>.json`: written by `script/Deploy.s.sol` for BNB testnet (97) or BNB Chain (56). A dry run writes the
  simulated addresses; the broadcast overwrites them with the real ones. `97.json` is the BNB testnet redeploy of
  26 Nov 2026 with the audit fixes (docs/DEPLOY.md); nothing is deployed on BNB Chain mainnet. Its `legacyCovenant*`
  and `previous*` keys are added by hand after `Deploy.s.sol` runs: the first testnet covenant and the contracts it was
  created with, so the app and the server keep reading its history. Re-add them after a redeploy.
- `97.local.json`: written by `scripts/testnet-up.sh` from `97.json` in the `local.json` shape (git-ignored); the server
  and the web read it through `COVENANT_DEPLOYMENTS`.
