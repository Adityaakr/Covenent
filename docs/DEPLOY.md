# Deploying Covenant to BNB testnet and BNB Chain

This is the runbook for `contracts/script/Deploy.s.sol`. Covenant is deployed on BNB testnet (below); nothing is on BNB
Chain mainnet. Run the steps below with the owner, testnet first.

## Redeploy with Flap's re-review fixes F1 to F8 (27 Nov 2026)

The factories, launcher, vault, oracle and Lite template changed for Flap's pre-audit re-review (F1 to F8: the
graduation floor with a 1.5x margin, the name screen failing closed, Flap's tax rules, the unlock counter and the poke
gap, the dollar tap at the last rate, Flap's addresses checked per chain, the 15M finalize gas limit, the post-tax
disclosure) and the independent re-review (NEW-1: depth at the TWAP on the pool's invariant), so the stack was
redeployed once with `script/Deploy.s.sol` after a clean dry run. Deployer `0x6A23244b34bFAFB9594d34c723b886bE89E0cC02`,
blocks 145030019 to 145030078, 8 transactions (the `CovenantVaultDisplay` library first, at
`0x92918A39161BCB6793871a25eC4635DbC1A946b3`), 41,001,857 gas (0.0049 tBNB at about 0.12 gwei). All 16 contracts (the library, the seven
below, the four implementations and the four beacons) are source-verified on Sourcify. `CovenantVault` is 24,403 of
24,576 bytes (the `size` profile).

`contracts/deployments/97.json` holds the record; it also lists the first covenant (`legacyCovenantLauncher`,
`legacyCovenantVault`) and the first deployment's factories and oracle (`previous*`), and the first audit-fix deployment
of 26 Nov 2026 (`round1*`, with `round1CovenantLauncher`, the BNBH2026 raise that never launched), so the app and the
server keep reading them. Re-add those keys after a redeploy: `Deploy.s.sol` rewrites the file.

| Contract | Address |
|---|---|
| CovenantOracle | [`0x2Df1Ad97fe98033Cc4Eba6Ea98B5703B0c69F775`](https://testnet.bscscan.com/address/0x2Df1Ad97fe98033Cc4Eba6Ea98B5703B0c69F775) |
| CovenantLauncherFactory (production: 1.5x the graduation floor; ask Flap to enable) | [`0x528374FeF9da2C31C646E59AE19EB2aE18b7a0DF`](https://testnet.bscscan.com/address/0x528374FeF9da2C31C646E59AE19EB2aE18b7a0DF) |
| CovenantVaultFactory (production) | [`0xAbb9811f529B793c86848211522B789071671ebC`](https://testnet.bscscan.com/address/0xAbb9811f529B793c86848211522B789071671ebC) |
| CovenantLauncherFactory (demo: 1.5x the creation floor; ask Flap to enable) | [`0x0F92C58c6aC5A3f6A5E3fF23a7698F58306Df2aE`](https://testnet.bscscan.com/address/0x0F92C58c6aC5A3f6A5E3fF23a7698F58306Df2aE) |
| CovenantVaultFactory (demo) | [`0x6d3a421708F8b45FbD92342d33a841de40E6cC8F`](https://testnet.bscscan.com/address/0x6d3a421708F8b45FbD92342d33a841de40E6cC8F) |
| CovenantLens | [`0x21DA47FC79DaF6479A1703aab1E5fc18B5bFa6b4`](https://testnet.bscscan.com/address/0x21DA47FC79DaF6479A1703aab1E5fc18B5bFa6b4) |
| CovenantLiteVault template | [`0x411c4560f9D8F9b06a730D9652FCb9D71290D285`](https://testnet.bscscan.com/address/0x411c4560f9D8F9b06a730D9652FCb9D71290D285) |

Read back on chain 97 after the deploy: both factories hold Flap's Portal, the testnet Guardian and Flap's testnet name
screen (`0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E`), and `FLOOR_MARGIN_BPS` = 15000. `minRaiseFor(1e27, 6000, 1500)`
answers 85.71 BNB on the production factory (1.5 x the $10,000 graduation floor at the Portal's $700) and 42.86 BNB on
the demo factory (1.5 x the $5,000 creation floor); at a 50 / 45 / 5 split, 7.94 and 3.97 BNB. The oracle's
`pushBnbUsd()` returns the live Atlas push rate, which new vaults read in their launch transaction.

## Flap's test launch on BNB testnet (27 Nov 2026)

A real tax-token launch through the redeployed demo pair, from the deployer as team and sole contributor
(`script/TestnetCovenant.s.sol` with `TN_NAME="Covenant Demo" TN_SYMBOL=CVD TN_SALE_SECONDS=120 TN_HEARTBEAT=2592000`).
The production factory needs 7.94 tBNB at this split (1.5x the graduation floor), more than the 4.6 tBNB available,
so the demo factory (1.5x the creation floor) carried it; the token launched without graduating, as disclosed.

| Step | Transaction | Result |
|---|---|---|
| Create (`Portal.newLauncher`, demo factory) | [`0x849e3d5c…`](https://testnet.bscscan.com/tx/0x849e3d5cda9879d551dcecec99870c5067b617f03c1860eda7e98db151422034) | launcher [`0xFb40790832BBAF5ABe61Db0beEc575468c973045`](https://testnet.bscscan.com/address/0xFb40790832BBAF5ABe61Db0beEc575468c973045); minimum = cap = 3.968253968253968256 tBNB (the factory's `minRaiseFor`), 50 / 45 / 5, 1% / 1% tax for 100 years |
| Commit 3.968 tBNB | [`0xcb3c5f11…`](https://testnet.bscscan.com/tx/0xcb3c5f1178ec149f6f849e61f24c4bf7f01cb2b6e1b1cfbc3ebafc026c69be29) | committed = the minimum |
| Finalize, gas limit 15,000,000 | [`0x38170242…`](https://testnet.bscscan.com/tx/0x38170242eb34ebf1b449a16403fc270bd32892e3cd3ff3f8a2b9b6c589a09d2d) | ACTIVE, 5,562,477 gas used. Token [`0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777`](https://testnet.bscscan.com/address/0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777) (= `expectedToken()`), vault [`0xFdC8dA0C251ED1f24cef6d9220aDa60E311638bE`](https://testnet.bscscan.com/address/0xFdC8dA0C251ED1f24cef6d9220aDa60E311638bE) (the Portal's `getLaunchVault`, via our demo vault factory), pool [`0x464AF9543120B9a83Da2196BC6C3d1FC67E7860b`](https://testnet.bscscan.com/address/0x464AF9543120B9a83Da2196BC6C3d1FC67E7860b) seeded with 3.5714 WBNB and 450M CVD, 100% of the LP at the dead and zero addresses, treasury 0.3968 tBNB, 550M reserved tokens in Flap's Token Dock, dollar sale price fixed at launch from the push feed |
| Claim sale tokens | [`0x6c5cf40b…`](https://testnet.bscscan.com/tx/0x6c5cf40bb1d4bcaedc855fe9239590200a89039d8fcf34b124822dec25079747) | 500M CVD from the Token Dock |
| Buy 0.05 tBNB of CVD on PancakeSwap | [`0x00cdbd9c…`](https://testnet.bscscan.com/tx/0x00cdbd9c1ea77af6c4835389d42b5fac70c291d71cd7a17a1d6031e5f443e729) | 6.13M CVD; 61,946 CVD of buy tax held by the token |
| Approve and sell the 6.13M CVD back | [`0xfec60d06…`](https://testnet.bscscan.com/tx/0xfec60d0669a0dff47c0d9ec586f19d5eccf5dae9557c6bf55219987f27c6a123), [`0x7cacfefa…`](https://testnet.bscscan.com/tx/0x7cacfefad0d3c6bdc5ffe8d1f739724c92d55de52e3a78ef0aad378b229d2c3e) | 123,273 CVD of tax collected in the token. Flap's tax processor converts and forwards tax in chunks of about $500 on sells, so this much (about 0.001 tBNB) waits in the token before it reaches the vault |
| Poke (push feed, no pull report) | [`0x114078bc…`](https://testnet.bscscan.com/tx/0x114078bc4d2abdfeec5c08206d348574b1859b7db76ea1790c9a7e1544c77b9e) | strict: BNB/USD $553.15 from the Atlas push feed, deep pool; the tap started accruing |

The deployer went from 4.6291 to 0.6488 tBNB over the redeploy (0.0049) and this run (3.968 in the raise, 0.005 salt
lock fee, the trade round trip and gas): the 3.968 tBNB now sits in the pool seed (3.571) and the treasury (0.397).

## Audit-fix deployment (26 Nov 2026, superseded)

`round1*` in `97.json`: production launcher factory `0x270dE514C8cbE98E574D842e42c724335E742Fd1`, vault factory
`0xCD43CDEc6d587110510c9946BF0791a8eA07D58E`, demo `0x502d78a835e68DeB940191Da83AF0Cb838ef8693` and
`0xA981585c8D26C1169Fb73F25764A5b18c006D075`, oracle `0x4bFcdBe83Cdc6C3b914049d753283883cDcae49d`, lens
`0x61a33a14752C7Abbe6A71A211096f19F6E917309`, Lite template `0x8C86A73a40Bf25Ae445F1B142d3db219e80a31D1`. One raise
was opened on its demo factory (BNBH2026, launcher `0x9C8c01A54DE25Ac95A425535F650644055678c73`, 2.9 to 3 tBNB at a 45%
pool); nothing was committed and it never launched.

Two earlier attempts the same day are superseded and hold no covenant: a deploy with only Flap's review fixes
(production launcher factory `0xA3884139b002AaCEd9Dd77d8fd89e4E65c1D10Da`, demo `0xFC0a5dc742D21C4e36947762dbb4e36296BD1138`,
oracle `0x749ec94844Bf50DDfd4CfAFD9167305213CcC11D`), and a broadcast that stopped when the vault factory's constructor
reverted because `CovenantVault` was over the EIP-170 limit (only an unused oracle,
`0xf27B019178E9B0E050283215B131Ae589930cF13`, was created). Run `forge build --sizes` before a broadcast: forge's
script simulation does not enforce the size limit; CI does now.

## First BNB testnet deployment (chain 97, 26 Nov 2026, before the audit fixes)

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

These are superseded by the redeploy above; the first covenant (`CVT`) was created by this demo factory and keeps
working against these contracts. Flap has not enabled the launcher factories yet. The testnet Portal launches from them anyway (see step 5).

### Running the platform on testnet

```bash
TESTNET_WALLETS=/path/to/wallets.env scripts/testnet-up.sh   # first run; later runs: scripts/testnet-up.sh
```

It writes `contracts/deployments/97.local.json` (the record in the `{chainId, rpcUrl, addresses}` shape the server and
the web read, git-ignored) and starts the server API, the keeper (push-feed pokes, no Atlas key), the issuer agent
(once a covenant of its wallet exists) and the web app, all on chain 97. The keeper and issuer keys go to
`.dev/testnet/keys.env` (mode 600, git-ignored); `TESTNET_SECRETS_FROM=<server .env>` adds the CMC and Anthropic keys.
`COVENANT_ALLOW_PUBLIC_NETWORK=1` is set in this mode only. There is no seeded data: the app shows what is on chain 97.
Test BNB: with `TESTNET_FAUCET_PRIVATE_KEY` in the wallets file (or appended to `keys.env`), Settings, Test funds sends
a 0.003 tBNB drip (`TESTNET_FAUCET_BNB`) from that wallet, once per wallet and once per IP every 24 hours, at most
0.03 tBNB a day (`TESTNET_FAUCET_DAILY_BNB`), refusing a wallet that already holds 0.01 tBNB; the ledger is
`.dev/testnet/server-data/faucet-97.json`. When the faucet wallet runs low it points to BNB Chain's public faucets.
Covenants are BNB-denominated: the server faucet drips BNB only; Demo USDC is minted from its own contract (below).

### End-to-end run on BNB testnet (26 Nov 2026)

One covenant through every stage on chain 97, with the platform running (`scripts/testnet-up.sh`): launcher
[`0x0f3Fe8a8d3e2862E6218f42D6376D28ba3EaDf5E`](https://testnet.bscscan.com/address/0x0f3Fe8a8d3e2862E6218f42D6376D28ba3EaDf5E), token [`0x40002FcB9983c46b299F13e2d64E2c9Cb3b07777`](https://testnet.bscscan.com/address/0x40002FcB9983c46b299F13e2d64E2c9Cb3b07777),
pool [`0x8ef1997E6D38A51Ad49459C8147f0E18fa0a4201`](https://testnet.bscscan.com/address/0x8ef1997E6D38A51Ad49459C8147f0E18fa0a4201), vault [`0x524059B1424101D4CAFD33B9a1A8D332dD71193D`](https://testnet.bscscan.com/address/0x524059B1424101D4CAFD33B9a1A8D332dD71193D).
The keeper poked 14 times and dispatched tax 14 times on its own; the issuer agent sent heartbeats and claimed the tap.

| Step | Tx |
|---|---|
| Create (team = issuer agent wallet, demo factory, 2.65 tBNB at 50/45/5) | [`0x6176d4d1…`](https://testnet.bscscan.com/tx/0x6176d4d188fc535a2ce8eb712dd62abd57b88d21018655a2f69015b3ac36a737) |
| Commit 2.65 tBNB (buyer = deployer) | [`0xb4e10947…`](https://testnet.bscscan.com/tx/0xb4e10947392e695164b4861970e7d306bdc4c6ead874d9d5b913103fe48e8976) |
| Finalize: Flap launches the token and the pool, the vault is funded (ACTIVE) | [`0xa41449d9…`](https://testnet.bscscan.com/tx/0xa41449d924c01b477e16562c3e0eb9212dda1e42b1a4d9b27b47c5f43c0399be) |
| Buyer claims 500M CVT | [`0xfec82370…`](https://testnet.bscscan.com/tx/0xfec823709b21df2d4d0ecc2a09d20a9a3d9a5676fabfe11c5d87b3d7b9da8e8e) |
| Keeper's first poke (push feed, no report) | [`0x7a358c90…`](https://testnet.bscscan.com/tx/0x7a358c903192c5c2b5dd16f38f5c64f1e0360f4e3c173eaaa420d2571416b393) |
| Keeper dispatches trading tax | [`0xf648b4a9…`](https://testnet.bscscan.com/tx/0xf648b4a9f97af134088c632dec8130a0f312ef4f564d1115a350bd7ed66d2a56) |
| Buyer sells 450M CVT into the pool (1.185 tBNB back) | [`0x35b92e75…`](https://testnet.bscscan.com/tx/0x35b92e75bbae2092d80f8a0bfa3afca76edcb1fc6a66877eef585e0e9e4810df) |
| Issuer agent heartbeat | [`0x0b14fe5a…`](https://testnet.bscscan.com/tx/0x0b14fe5ae8a626ee9223c78cb0a604fd06eab8e36944932a6c19debc832a9c54) |
| Issuer agent claims the tap (budget) | [`0x88b0c875…`](https://testnet.bscscan.com/tx/0x88b0c87590deceabb5a2e2b688a2e5ca53f20ab0328880839f1ac783faf4b988) |
| Issuer agent stopped; keeper declares the covenant abandoned after 600 s of silence | [`0xb353116e…`](https://testnet.bscscan.com/tx/0xb353116ef47c503e415fdac059b02a7de6f27635f448ccae1879700b6a2ae86f) |
| Buyer redeems its last 50M CVT at book (0.01395 tBNB) | [`0xc6ef64d2…`](https://testnet.bscscan.com/tx/0xc6ef64d27ccfc62aed8ab4c8b3b66e988f7b33e5e3095bd8676a32d9a3349a7f) |

Of the 2.65 tBNB raised, 1.199 came back to the buyer (sell 1.185, redeem 0.014). 0.251 stays in the vault for the
other holders (mostly tokens in the pool), and the rest is in the pool. The trading tax did not reach the vault in this
run, and that is Flap's batching, not a fault: the one 1.18 BNB sell left 4.5M tokens of tax (about 0.006 BNB) in the
token, under the processor's 0.714 BNB threshold (see Operating notes, Tax), so the keeper's 14 dispatches each moved
nothing (`FlapTaxProcessorDispatchExecuted(token, 0, 0, 0)`). The threshold is priced against the pool at the time; on
a fork of chain 97 one 5 BNB round trip (9.6 BNB of volume) crossed it and the vault received 0.3515 BNB. Within the
0.05 tBNB this run allowed for trades, 1% tax yields about 0.0005 BNB, so it was not triggered on chain.

**Hosting the web app (Vercel or any host, root directory `web`).** A default build serves BNB testnet with no
environment variables: `pnpm build` runs `scripts/bake-testnet.mjs`, which bakes `contracts/deployments/97.json`, the
Atlas push feeds and the public ABIs into `web/src/generated/testnet.json` (committed) and the simulator's last result
into `web/public/data/`. The app reads every covenant straight from chain 97 through public RPCs (publicnode, then
bnbchain.org, then blastapi) and needs no Covenant server. Nothing about a local chain appears unless a developer opts
in with `NEXT_PUBLIC_CHAIN_ID=31337` (or 56 for a fork), which `scripts/dev-all.sh` sets.

| Variable | Needed | What it does |
|---|---|---|
| none | | the default build is BNB testnet, Privy app `cmwxgt4at00fz0hjkdtasmncg` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | optional | another Privy app (public id, not a secret) |
| `NEXT_PUBLIC_COVENANT_API` | optional | a running Covenant server: market data, rerunning the simulator with other terms, downside quotes. Without it those parts say they are not available on this site |
| `NEXT_PUBLIC_BSC_TESTNET_RPC` | optional | a private BNB testnet RPC, tried before the public ones |
| `NEXT_PUBLIC_SITE_URL` | optional | the canonical URL for link previews |
| `ANTHROPIC_API_KEY` | for Ask AI | server-only (never `NEXT_PUBLIC_`): the `/api/ask` route calls Claude with it. Without it the Ask AI panel says it is not configured; everything else works |
| `ANTHROPIC_MODEL` | optional | the model Ask AI uses, default `claude-opus-5-5` |

**Ask AI** runs in the web app's own route handler (`web/src/app/api/ask`, `maxDuration` 60 s), so it needs no
Covenant server: Claude reads chain 97 through the same public RPCs and builds unsigned transactions that the user's
own wallet signs after a confirmation card. Limits per question: 8 model turns, 8,000 output tokens per turn, 55 s; per
IP, 20 questions per 10 minutes on each server instance (set a spend limit in the Anthropic console as the backstop).

**Demo USDC on testnet.** `script/DemoUSDC.s.sol` deployed `DemoUSDC` (test funds, an open `faucet()` of 1,000 dUSDC
per wallet per day; the app labels it USDT with the Tether mark and a Testnet tag, and the contract is unchanged) at `0x85D09A18824421FfC9dC5197DA7a95b9643B3ba5`, recorded as `demoUsdc` in `deployments/97.json`
(`Deploy.s.sol` rewrites that file, so add the key back after a redeploy). Visitors mint it from Settings, Test funds
or through Ask AI and pay issuer agents with it. Covenant treasuries stay BNB: Flap's pools are BNB-quoted, and a
stablecoin-quoted treasury waits on Flap supporting that pair (docs/DESIGN.md, Roadmap).

In the Privy dashboard, add the deployed domain (for example `https://covenant.adibuilds.in`) to the app's allowed
origins, or Privy's login iframe is blocked there. `NEXT_PUBLIC_*` values are inlined at build time, so redeploy after
changing them.

**Cost of a testnet covenant.** Flap's testnet Portal refuses a pool unless seed (BNB) × 700 ≥ 750 / pool share,
so the seed must be at least 1.0714 BNB / pool share. A Portal facet (`0x756b91aB3ecA51191212A98a68917685161b8A30`,
selector `db9c8c66`, delegatecalled inside `launchTaxTokenV2`) reverts with custom error `0xa32ef056(seed × 700,
750 / pool share)`, both 1e18: `(700, 2500)` for a 1 BNB seed at a 30% pool, `(1400, 1500)` for 2 BNB at 50%,
`(1537.8, 1562.5)` for 2.197 BNB at 48%. Token supply does not change it. Pool share cannot exceed the sale share, so
the absolute minimum is a 2.14 BNB seed. Measured on forks of chain 97 against our demo factory, 26 Nov 2026: the
launch fails, the covenant ends FAILED and every commitment refunds. Since the audit fixes the factories read this
floor themselves before a raise opens (`graduationFloorV2` on the Portal, through `minRaiseFor`), with a 1.5x safety
margin since Flap's re-review: the demo factory needs 1.5x the launch (creation) floor and the production factory 1.5x
the graduation floor (twice the launch floor), so terms under it are refused at creation and never collect money.
`script/TestnetCovenant.s.sol` creates the cheapest demo covenant that keeps a team share and a treasury, at exactly
the demo factory's `minRaiseFor`: a 3.97 tBNB raise split 50 / 45 / 5 (seed 3.57, treasury 0.40) at the Portal's $700.
The same split on the production factory needs 7.94 tBNB. Gas for the whole journey (create, commit, finalize, claim,
pokes, tap, wind-down, redeem) is under 8M, a fraction of a cent.

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
2. **Flap's floors and name screen.** Nothing to configure: the launcher factory reads Flap's liquidity floor live
   from the Portal (`launchQuoteConfig` and `graduationFloorV2` with our vault factory, so Flap's BNB price and
   multiplier apply) and refuses a minimum raise whose pool seed, less a third (`FLOOR_MARGIN_BPS`, 1.5x), misses it:
   the graduation floor for the production profile, the launch floor for the demo profile. It also asks Flap's name and symbol blocklist (`isScamWord`, the
   contract the launch facet calls; its address is not exposed by the Portal, so `Deploy.s.sol` names it per chain:
   BNB Chain `0xfFb69d59f62454f3B8322Bc1a9FCE6E171a5264f`, testnet `0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E`).
   The factories refuse any other name screen, Portal, Guardian or Token Dock router on chains 56 and 97. If Flap
   moves the floor, the Portal still checks it at launch and a refused launch refunds every commitment.
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
- Flap's floors and name screen read live by the factory (step 2 of "Before you start"); confirm the name screen
  address with Flap.
- Legal review of redemption rights.
- Decision on Guardian upgrades against an immutable factory. Today the Guardian is the only upgrade path, and its
  calls to team functions never count as a heartbeat, so Flap cannot keep a silent team alive.
- Keeper redundancy: two operators and the public poke button.

## Operating notes

- **Keeper.** Calls `CovenantOracle.poke(vault)` about hourly with a signed Atlas report appended (the Atlas pull
  SDK builds the calldata); with no API key on testnet it pokes plainly and the oracle reads the push feed. A poke
  without a report still counts for the exit streak and can only reset unlock counters (when the price misses a
  multiple at the last rate); only strict pokes (fresh Atlas rate and a deep pool) add unlock time, which must be
  continuous: one poke adds at most 6 hours, and a longer gap restarts the count. A report-carrying poke waits only for
  the previous one (`nextRatePokeAt`), so the keeper decides it is due from that point. On the demo profile that
  limit is 60 s, so a demo covenant unlocks only with pokes at most a minute apart (`scripts/testnet-up.sh` pokes
  every 600 s). `finalize()` needs 12M gas left at its launch guard; every client sends the launcher's
  `FINALIZE_GAS_LIMIT` (15,000,000, the most Flap's vault SDK and flap.sh send): the app, the server's unsigned
  `finalize` (API and MCP, with `gas` set), the investor agent and the keeper, which finalizes raises past their
  deadline on its own (`KEEPER_FINALIZE=false` turns that off). From the command line pass `--gas-limit 15000000`.
  Only the gas used is paid: 5.32M on chain 97
  ([`0xa41449d9…`](https://testnet.bscscan.com/tx/0xa41449d924c01b477e16562c3e0eb9212dda1e42b1a4d9b27b47c5f43c0399be)),
  5.53M on a chain 97 fork and 6.95M on a BNB Chain fork.
- **Claims.** Refunds and sale tokens are pull payments. The keeper raises a `claims-open` alert while refunds or
  tokens wait, the MCP `get_position(covenant, wallet)` shows a wallet's refund and claimable allocation (then `claim_refund` / `claim_tokens`), and the covenant page shows a Claim
  button to the wallet that is owed. Once every refund is claimed, anyone can call `sweepDust()` on the launcher to
  move the leftover rounding buffer (at most one wei per contributor) into the treasury.
- **Tax.** Tax collects in the token as tokens. On a sell, Flap's tax processor swaps it to BNB only once it is worth
  about 0.714 BNB (it asks the router `getAmountsIn(0.714285 BNB)`, $500 at the Portal's internal $700/BNB; read on
  chain 97, 26 Nov 2026), so small volume leaves it pending. Anyone can then call the processor's `dispatch()`; the
  vault recognizes the BNB by balance delta. On a fork of chain 97 one 5 BNB round trip crossed the threshold and a
  dispatch sent the vault 0.3515 BNB, with 0.0391 (10%) kept as the processor's `feeQuoteBalance`. The keeper
  dispatches only when the processor holds BNB beyond its own balances.
- **Agents.** An agent covenant needs the ERC-8004 agent NFT in the team wallet when the covenant is created. The
  vault records abandonment (-100), wind-down (0) and each unlock (+multiple) on the ReputationRegistry. Read only
  feedback whose client address is a vault from our vault factory (`vaultFactory.launcherOf(vault) != 0`).
- **OpenFour.** A Four.meme token adopts the Lite template through ForwardVault with
  `abi.encode(ForwardVault.InitParams(template, abi.encode(tapBps, tapPeriod, heartbeat, redeemFeeBps)))`: the
  params are a tuple, not two flat values (the live ForwardVault reverts on the flat form).
