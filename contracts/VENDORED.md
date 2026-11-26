# Third-party code in this project

Every file below is copied unchanged from its public source. Covenant's own code lives elsewhere under `src/`.

| Folder | Source | Commit | License |
|---|---|---|---|
| `src/flap/` | [flap-sh/FlapPoolLaunchVaultExample](https://github.com/flap-sh/FlapPoolLaunchVaultExample) `src/flap/` (Pool Launch spec files and bases, "required and immutable") | `29334f689774f6b3a39720b3fc802ab0d6a61718` | MIT |
| `src/vendor/atlas/` | [oracle-atlas/pull-oracle-consumer](https://github.com/oracle-atlas/pull-oracle-consumer) `src/` (Atlas pull oracle consumer, CertiK audited) | `a8f5b14036ed05f25dcebb81546bac600e138a34` | BUSL-1.1 (see each file header) |
| `src/vendor/openfour/` | [four-meme-community/openfour-docs](https://github.com/four-meme-community/openfour-docs) `contracts/`: `taxvault/BaseTaxVault.sol`, `taxvault/ITaxVault.sol`, `taxvault/vaults/ForwardVault.sol`, `interfaces/IOpenFourModuleSchema.sol`, `libraries/OpenFourTypes.sol` | `079a45e9c3358c9f357c84f336c7d915c9f0e9fc` | MIT |

Libraries (git submodules under `lib/`, pinned to the same commits as Flap's example repo):

| Library | Commit | Version |
|---|---|---|
| foundry-rs/forge-std | `978ac6fadb62f5f0b723c996f64be52eddba6801` | |
| OpenZeppelin/openzeppelin-contracts | `dc44c9f1a4c3b10af99492eed84f83ed244203f6` | 4.9.6 |
| OpenZeppelin/openzeppelin-contracts-upgradeable | `2d081f24cac1a867f6f73d512f2022e1fa987854` | 4.9.6 |
| vectorized/solady | `acd959aa4bd04720d640bf4e6a5c71037510cc4b` | 0.1.26 |

ERC-8004 is used through our own minimal interfaces (`src/agent/IERC8004.sol`), written against
[erc-8004/erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts) at `b9e466c250744a7e06b13dff9d3c2844ed64f825`.

The Atlas consumer is BUSL-1.1. It is used here for a hackathon build on local chains and testnets; check its
license terms with Atlas before a production deployment.
