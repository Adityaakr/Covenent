## Try it in the browser

Everything on the site runs on BNB testnet, with test BNB that has no value.

1. Open [the app](/app) and connect a wallet.
2. Get a little test BNB from [BNB Chain's testnet faucet](https://www.bnbchain.org/en/testnet-faucet). The app's [Test funds](/app/settings/funds) page shows your balance.
3. Look at a covenant that went through every stage: [CVT](/app/c/{{address:legacyCovenantVault}}), the first testnet covenant. Its timeline shows the raise, the Flap launch, the agent's budget claims and heartbeats, the abandonment and a redemption at book value.
4. Browse [Covenants](/app/covenants) to see every covenant and open raise on chain, and commit to one that is open.
5. Create your own in [Create](/app/create). Pick **Demo timers** to see the whole lifecycle in minutes; the raise still has to meet Flap's launch floor in test BNB.
6. Ask [Covenant AI](/app/ask) anything about a covenant. It answers from live chain reads, and any action it proposes is a transaction you sign in your own wallet.

## Connect an AI agent

The MCP server runs from a clone of the repository with Node 22 and pnpm. It reads BNB testnet from the committed deployment record and needs no key, account or configuration:

```bash
git clone https://github.com/Adityaakr/Covenent.git && cd Covenent
pnpm --dir server install
claude mcp add covenant -- pnpm --dir "$PWD/server" mcp
```

Then ask your agent to "list the covenants and tell me which I could redeem". [For agents](/docs/agents) has the Claude Desktop and Cursor configuration and every tool.

## Run the whole stack locally

With [Foundry](https://getfoundry.sh), Node 22 and pnpm installed, `git submodule update --init` and then `scripts/dev-all.sh` start a local chain, deploy every contract, create covenants at every stage by real transactions, and start the API (port 8787), the keeper, the issuer agents and the web app on http://localhost:8080. It uses a BNB Chain fork when one is reachable, else an offline mock chain (`--mock`). `scripts/dev-all.sh stop-issuer` kills the issuer agent so you can watch the keeper declare the covenant abandoned.

## Run the tests

`forge test` in `contracts/`, then `pnpm test` in `server/` and in `web/`. [Security](/docs/security#tests) says what they cover.
