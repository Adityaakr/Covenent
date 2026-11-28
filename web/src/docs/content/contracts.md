Addresses link to BscScan's testnet explorer. They are read from the deployment record when the site is built, so this page cannot fall out of date with it.

```covenant
addresses
```

## Live covenants

Covenants are not listed in the record: new ones appear whenever someone creates one. The app's [Covenants](/app/covenants) page and the MCP tool `list_covenants` find them through each launcher factory's `allLaunchers()`. Flap's test launch on the current contracts, `CVD`, went through the demo factory on 27 November 2026; the [deploy runbook](https://github.com/Adityaakr/Covenent/blob/main/docs/DEPLOY.md#flaps-test-launch-on-bnb-testnet-27-nov-2026) lists its transactions.

## Checking them yourself

The current Covenant contracts (with their implementations and beacons) are source-verified on Sourcify: `curl https://sourcify.dev/server/v2/contract/97/<address>` answers `"match":"match"`. BscScan refuses most automated clients, so for scripts use an RPC. `https://bsc-testnet-rpc.publicnode.com` serves current state but drops old logs and receipts. Check an older transaction with `https://bsc-testnet.bnbchain.org` (for example `cast receipt <tx> status --rpc-url https://bsc-testnet.bnbchain.org`) and read older logs from `https://bsc-prebsc-dataseed.bnbchain.org` in ranges of 5,000 blocks.

Nothing is deployed on BNB Chain mainnet. The runbook for both networks is [docs/DEPLOY.md](https://github.com/Adityaakr/Covenent/blob/main/docs/DEPLOY.md).
