# Deployments

- `local.json`: written by `scripts/dev-up.sh` for the dev chain (git-ignored). Shape:
  `{chainId, rpcUrl, mode, deployedAtBlock, addresses{...}, atlas{...}, accounts{...}, demo{...}}`.
- `<chainId>.json`: written by `script/Deploy.s.sol` for BNB testnet (97) or BNB Chain (56). A dry run writes the
  simulated addresses; the broadcast overwrites them with the real ones. `97.json` is the BNB testnet deployment of
  26 Nov 2026 (docs/DEPLOY.md); nothing is deployed on BNB Chain mainnet.
- `97.local.json`: written by `scripts/testnet-up.sh` from `97.json` in the `local.json` shape (git-ignored); the server
  and the web read it through `COVENANT_DEPLOYMENTS`.
