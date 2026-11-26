# Deploying Covenant to BNB testnet and BNB Chain

This is the runbook for `contracts/script/Deploy.s.sol`. Covenant is deployed on BNB testnet (below); nothing is on BNB
Chain mainnet. Run the steps below with the owner, testnet first.

## BNB testnet deployment (chain 97, 26 Nov 2026)

`contracts/deployments/97.json` holds the record. Deployer `0x6A23244b34bFAFB9594d34c723b886bE89E0cC02`, blocks
144956048 to 144956125, 8 transactions, 37,604,408 gas at 0.05 gwei (0.00188 tBNB). Push-feed mode: the oracle reads
the Atlas BNB/USD push feed, max age 3600 s; no pull feed id was set (`atlasFeedIdBnbUsd` 0x00000001 is the
placeholder, so signed pull reports are not accepted by this oracle). Every contract below, plus the four beacon
implementations and the four beacons, is source-verified on Sourcify (`match`). BscScan-native verification still
needs a BscScan API key (`ETHERSCAN_API_KEY`).

| Contract | Address |
|---|---|
| CovenantOracle | [`0x3CC607931edaF307dC867111e48cAc28e31fF052`](https://testnet.bscscan.com/address/0x3CC607931edaF307dC867111e48cAc28e31fF052) |
| CovenantLauncherFactory (production, ask Flap to enable) | [`0x373491d66f68FE2Acc370B12E6FA2bB488FC6A0B`](https://testnet.bscscan.com/address/0x373491d66f68FE2Acc370B12E6FA2bB488FC6A0B) |
| CovenantVaultFactory (production) | [`0x2665c44Ea346De54207b8E8C1A351aE3e82FCf57`](https://testnet.bscscan.com/address/0x2665c44Ea346De54207b8E8C1A351aE3e82FCf57) |
| CovenantLauncherFactory (demo, ask Flap to enable) | [`0x89D7E30109D62F72fBf717aafc2d59d21CA4DC48`](https://testnet.bscscan.com/address/0x89D7E30109D62F72fBf717aafc2d59d21CA4DC48) |
| CovenantVaultFactory (demo) | [`0xF8Bf9A01457C45a8F53E7ae32D863B38d3876c97`](https://testnet.bscscan.com/address/0xF8Bf9A01457C45a8F53E7ae32D863B38d3876c97) |
| CovenantLens | [`0x6c0D9CDDCbAA497a54fF5aDDCbf444E77b3d1A83`](https://testnet.bscscan.com/address/0x6c0D9CDDCbAA497a54fF5aDDCbf444E77b3d1A83) |
| CovenantLiteVault template | [`0xC9aD3B8aC5baD26278EFc8F88D1073eB85791437`](https://testnet.bscscan.com/address/0xC9aD3B8aC5baD26278EFc8F88D1073eB85791437) |
| CovenantVaultDisplay (linked library) | [`0x29765E2633bE5656a8E8eB558EA42df7fBfe9122`](https://testnet.bscscan.com/address/0x29765E2633bE5656a8E8eB558EA42df7fBfe9122) |

Flap has not enabled the launcher factories yet. The testnet Portal launches from them anyway (see step 5).

### Running the platform on testnet

```bash
TESTNET_WALLETS=/path/to/wallets.env scripts/testnet-up.sh   # first run; later runs: scripts/testnet-up.sh
```

It writes `contracts/deployments/97.local.json` (the record in the `{chainId, rpcUrl, addresses}` shape the server and
the web read, git-ignored) and starts the server API, the keeper (push-feed pokes, no Atlas key), the issuer agent
(once a covenant of its wallet exists) and the web app, all on chain 97. The keeper and issuer keys go to
`.dev/testnet/keys.env` (mode 600, git-ignored); `TESTNET_SECRETS_FROM=<server .env>` adds the CMC and Anthropic keys.
`COVENANT_ALLOW_PUBLIC_NETWORK=1` is set in this mode only. There is no faucet and no seeded data: the app shows what
is on chain 97, and "Get test funds" becomes a link to BNB Chain's testnet faucet.

**Cost of a testnet covenant.** Flap's testnet Portal refuses a pool unless seed (BNB) × 700 ≥ 750 / pool share,
so the seed must be at least 1.0714 BNB / pool share. A Portal facet (`0x756b91aB3ecA51191212A98a68917685161b8A30`,
selector `db9c8c66`, delegatecalled inside `launchTaxTokenV2`) reverts with custom error `0xa32ef056(seed × 700,
750 / pool share)`, both 1e18: `(700, 2500)` for a 1 BNB seed at a 30% pool, `(1400, 1500)` for 2 BNB at 50%,
`(1537.8, 1562.5)` for 2.197 BNB at 48%. Token supply does not change it. Pool share cannot exceed the sale share, so
the absolute minimum is a 2.14 BNB seed. Measured on forks of chain 97 against our demo factory, 26 Nov 2026: the
launch fails, the covenant ends FAILED and every commitment refunds. This floor is Flap's, not our profile's (the
demo profile's own `minPoolQuote` is 1 BNB). `script/TestnetCovenant.s.sol` creates the cheapest covenant that keeps
a team share and a treasury: a 2.65 tBNB raise split 50 / 45 / 5, seed 2.385, treasury 0.265. Gas for the whole
journey (create, commit, finalize, claim, pokes, tap, wind-down, redeem) is under 8M, a fraction of a cent.

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

1. **Atlas.** Two sources, chosen per poke. A poke with a signed pull report appended uses it (the feed id
   `ATLAS_BNB_USD_FEED_ID`, a `bytes4`, and the keeper's API key come from Atlas onboarding; confirm the signer for
   the chain). A poke without one reads the oracle's push feed, `ATLAS_PUSH_FEED` (Chainlink-compatible
   `latestRoundData`). The feed keeps only its latest round, so the oracle checks that round's `updatedAt` against
   `ATLAS_PUSH_MAX_AGE` (default 1 hour).
   - **BNB testnet has Atlas push feeds** (`contracts/config/atlas-97.json`, verified 2026-11-26): BNB/USD
     `0x3957d289ee9C38272377786787ea34F9dd29788D`, BTC/USD `0x83B2F2c20df36F166cF5b3f017204cbB7BABcAD0`, ETH/USD
     `0x35369dEcD8c662954B3D24acc2A862C708A34fD2`, 18 decimals, open read. On chain 97 `Deploy.s.sol` uses the
     BNB/USD feed by default and the feed id becomes optional: with no Atlas API key the keeper pokes without a
     report and the push feed prices the tap and the strict gate; once a pull key exists, pull reports take over on
     the pokes that carry them (pass the feed id at deployment for that, it is fixed then). The server reads the
     same feed for display on chain 97 and never uses its local test signer there.
   - **BNB Chain mainnet** has no Atlas push feed yet (none of those addresses has code on 56): pull mode needs the
     feed id and the API key.
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
# ATLAS_BNB_USD_FEED_ID=0x........   (required on mainnet; optional on testnet, where the push feed is the default)
# ATLAS_SIGNER=0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600
# ATLAS_PUSH_FEED=                   (default on 97: 0x3957d289ee9C38272377786787ea34F9dd29788D; none on 56)
# ATLAS_PUSH_MAX_AGE=3600            (seconds, checked against the round's updatedAt)
# DEPLOY_DEMO_FACTORY=true    (testnet; leave false on mainnet)
# LITE_AUTHOR=0x...           (wallet that receives OpenFour's 6% template royalty)
set -a && . ./.env && set +a
```

1. **Test.** `forge build && forge test` (unit, invariant), then
   `forge test --match-path "test/fork/*"` with `BSC_RPC_URL` set: the full journey against the live Portal. With
   `BSC_TESTNET_RPC_URL` set, `test_fork_atlasPushFeed_pricesTheTapAndTheStrictGate` reads the real testnet BNB/USD
   push feed through `CovenantOracle`: a poke with no report is strict while the round is fresh, and past the max age
   the rate drops out while the exit observation still counts.
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
  SDK builds the calldata); with no API key on testnet it pokes plainly and the oracle reads the push feed. A poke without a report still counts for the exit streak; only strict pokes (fresh
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
