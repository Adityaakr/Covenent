# Deployments

- `local.json`: written by `scripts/dev-up.sh` for the dev chain (git-ignored). Shape:
  `{chainId, rpcUrl, mode, deployedAtBlock, addresses{...}, atlas{...}, accounts{...}, demo{...}}`.
- `<chainId>.json`: written by `script/Deploy.s.sol` for BNB testnet (97) or BNB Chain (56). A dry run writes the
  simulated addresses; the broadcast overwrites them with the real ones. None exist yet: nothing has been deployed
  to a public network.
