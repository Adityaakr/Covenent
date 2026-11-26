# Deploying Covenant to BNB testnet and BNB Chain

This is the runbook for `contracts/script/Deploy.s.sol`. Nothing in this repository has been deployed to a public
network. Run the steps below with the owner, testnet first.

## What gets deployed

| Contract | Notes |
|---|---|
| `CovenantOracle` | Singleton, no owner. Fixed at deployment: the Atlas BNB/USD feed id, the one Atlas signer whose pull reports verify, and an optional Atlas push feed as fallback |
| `CovenantVaultFactory` + `CovenantLauncherFactory` (production) | A locked pair. The vault factory is deployed first with the launcher factory's predicted address; the launcher factory checks the pairing in its constructor. Each deploys a beacon for its implementation; upgrades are Flap Guardian only |
| Demo pair | Same contracts with the short-timer `Profile` (minutes instead of days). Testnet by default (`DEPLOY_DEMO_FACTORY`) |
| `CovenantLens` | Read-only aggregation for the app, keeper and MCP server. Stateless, redeploy at will |
| `CovenantLiteVault` | OpenFour tax vault template (implementation only; ForwardVault clones it per token) |

Addresses the script reads, not deploys:

| | BNB Chain (56) | BNB testnet (97) |
|---|---|---|
| Flap Direct Launch Portal | `0x000042108465206185A077Edc3F3fd2b49060000` | same |
| Flap Guardian | `0x9e27098dcD8844bcc6287a557E0b4D09C86B8a4b` | `0x00004d58290854c5E9880F4b5B1993c6Ad8b0000` |
| Flap TokenDockRouter | `0x000048E888aBf09f690a952E1b386b2D031a0000` | same |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Atlas production signer | `0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600` (default `ATLAS_SIGNER`) | confirm with Atlas |
| OpenFour ForwardVault implementation | `0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4` | confirm with Four.meme |

Flap's addresses come from `src/flap/LaunchVaultAddresses.sol` (vendored unchanged); the script refuses any other
chain.

## Before you start

1. **Atlas credentials.** The BNB/USD feed id for pull mode (`ATLAS_BNB_USD_FEED_ID`, a `bytes4`) comes from Atlas
   onboarding, together with the keeper's API key. Confirm the signer address for the target chain. If Atlas offers
   an open-read push feed, pass it as `ATLAS_PUSH_FEED` (Chainlink-compatible `latestRoundData`).
2. **Flap's creation floor.** The production profile refuses terms whose minimum raise seeds less than 10 BNB
   (`CovenantProfiles.production().minPoolQuote`). Check this against `PortalLaunchLens.graduationFloorV2` for a
   15% pool share and adjust the profile before deploying if Flap's floor is higher; a launch under the floor
   would otherwise fail at finalize (safely: every commitment refunds).
3. **A deployer key with a little BNB.** The production stack costs about 27.6M gas (about 0.0014 BNB at
   0.05 gwei, measured in a dry run on a BNB Chain fork). Add the demo pair for about 12M more.
4. **An RPC that serves older state** for the dry run on a fork (see `contracts/.env.example`).

## Steps

All commands run from `contracts/`.

```bash
cp .env.example .env            # then fill in the values below; .env is git-ignored
# DEPLOYER_PRIVATE_KEY=0x...
# ATLAS_BNB_USD_FEED_ID=0x........
# ATLAS_SIGNER=0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600
# ATLAS_PUSH_FEED=            (optional)
# DEPLOY_DEMO_FACTORY=true    (testnet; leave false on mainnet)
# LITE_AUTHOR=0x...           (wallet that receives OpenFour's 6% template royalty)
set -a && . ./.env && set +a
```

1. **Test.** `forge build && forge test` (unit, invariant), then
   `forge test --match-path "test/fork/*"` with `BSC_RPC_URL` set: the full journey against the live Portal.
2. **Dry run** (simulation only, nothing is sent):
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url "$BSC_TESTNET_RPC_URL"
   ```
   Check the logged addresses and the gas estimate. The dry run also writes `deployments/97.json` with the
   simulated addresses; the broadcast overwrites it with the real ones.
3. **Broadcast to testnet:**
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url "$BSC_TESTNET_RPC_URL" --broadcast --slow
   ```
4. **Verify on the explorer** (BscScan API key in `ETHERSCAN_API_KEY`):
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url "$BSC_TESTNET_RPC_URL" --resume --verify
   ```
5. **Ask Flap to enable the launcher factories.** Send Flap the `launcherFactory` (and `demoLauncherFactory`)
   addresses from `deployments/97.json`. Flap calls `Portal.setLauncherFactoryMultiplier(factory, multiplier,
   true)`; until then `Portal.newLauncher` reverts on BNB Chain. Since Portal v1.1.2 the launcher factory alone
   covers the launch; also ask Flap to set the vault factory's multiplier, which lowers the liquidity floor.
   Factories must pass Flap's audit before mainnet launches open; until then vaults show as unverified on Flap.sh.
   Observed on a testnet fork (Portal v1.2.0, Nov 26 2026): the testnet Portal created and launched a covenant
   from a factory Flap had not opened, even with creation paused, so a testnet demo may work before Flap enables
   us. Confirm on testnet itself before relying on it (`test_fork_unopenedFactory_isRefused` records it).
6. **Smoke test on testnet:** create a covenant on the demo factory through `Portal.newLauncher` (the app mines
   the 0x7777 salt), commit, finalize after two minutes, claim, poke with a real Atlas report through the keeper,
   and read `CovenantLens.status(launcher)`.
7. **Point the app and the keeper at the deployment:** they read `deployments/<chainId>.json` and `abi/*.json`.
8. **Mainnet:** repeat 2 to 5 with `--rpc-url "$BSC_RPC_URL"` and `DEPLOY_DEMO_FACTORY=false`, only after the
   checklist below.

## Mainnet checklist (from the design document)

- Flap factory audit passed for both factories (low-risk badge on Flap.sh).
- Independent review of `CovenantVault`, `CovenantLauncher` and `CovenantOracle`.
- Atlas production pull credentials and feed id; the Atlas pull consumer is BUSL-1.1, confirm license terms.
- Flap's creation floor confirmed against the production profile (step 2 of "Before you start").
- Legal review of redemption rights.
- Decision on Guardian upgrades against an immutable factory. Today the Guardian is the only upgrade path, and its
  calls to team functions never count as a heartbeat, so Flap cannot keep a silent team alive.
- Keeper redundancy: two operators and the public poke button.

## Operating notes

- **Keeper.** Calls `CovenantOracle.poke(vault)` about hourly with a signed Atlas report appended (the Atlas pull
  SDK builds the calldata). A poke without a report still counts for the exit streak; only strict pokes (fresh
  Atlas rate and a pool at least half its seed) price the dollar tap and move unlock counters. One poke adds at
  most 6 hours to any counter. `finalize()` needs a gas limit of at least 15M (the launch guard); wallets that
  estimate gas pick this up automatically.
- **Tax.** Anyone can call the token's tax processor `dispatch()`; the vault recognizes the BNB by balance delta.
- **Agents.** An agent covenant needs the ERC-8004 agent NFT in the team wallet when the covenant is created. The
  vault records abandonment (-100), wind-down (0) and each unlock (+multiple) on the ReputationRegistry. Read only
  feedback whose client address is a vault from our vault factory (`vaultFactory.launcherOf(vault) != 0`).
- **OpenFour.** A Four.meme token adopts the Lite template through ForwardVault with
  `abi.encode(ForwardVault.InitParams(template, abi.encode(tapBps, tapPeriod, heartbeat, redeemFeeBps)))`: the
  params are a tuple, not two flat values (the live ForwardVault reverts on the flat form).
