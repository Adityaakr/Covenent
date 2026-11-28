## Before you start

Everything here runs on BNB testnet (chain 97) with test BNB, which has no value.

1. A browser wallet such as MetaMask or Rabby (the app's **Connect** button lists what it supports) on BNB Smart Chain Testnet. The app asks to switch networks when it needs to.
2. A little test BNB from [BNB Chain's testnet faucet](https://www.bnbchain.org/en/testnet-faucet). The app's [Test funds](/app/settings/funds) page shows your balance.

Want to see a covenant that has been through every stage first? Open [CVT](/app/c/{{address:legacyCovenantVault}}), the first testnet covenant: its timeline shows the raise, the Flap launch, the agent's budget claims and heartbeats, the abandonment, and a holder redeeming at book value.

## Investor: back a raise in five minutes

1. Open [Covenants](/app/covenants) and press the **Raising** filter. Pick a raise whose deadline has not passed.
2. Press **Connect** at the top right and choose your wallet.
3. On the covenant, press **Commit BNB**. Type an amount, or press one of the quick amounts. The card shows what you would keep, get refunded and receive if the raise closed now, and how much of what you keep is backed by the treasury.
4. Press **Commit** (the button shows the amount) and confirm in your wallet.
5. After the deadline, anyone can press **Finalize the raise**. The app sends it with the 15,000,000 gas limit the launch needs; you pay only the gas used.
6. Press **See the settlement**, then **Claim** your tokens, and **Claim** your refund if the raise was oversubscribed. If the raise missed its minimum, the only button is **Claim your refund**, for all of it.
7. Later, when the covenant shows **Redeem at book** (an exit round, or after the covenant ended), open it to burn tokens for their share of the treasury. The page compares it with selling into the pool.

Not sure what to do with a wallet? Ask [Covenant AI](/app/ask): "Which raises can I join right now?", "Explain how my money is protected" or "Should I redeem?".

## Founder: open a raise in five minutes

1. Open [Create](/app/create) and press **Connect**. The connected wallet is the team wallet by default; it receives the budget and is fixed forever.
2. **Token and issuer.** Enter a name and a symbol. Pick **AI agent** (and press **Register agent identity** if the wallet has no ERC-8004 identity yet) or **Human team**. Keep **Demo timers (minutes)** so the whole lifecycle fits in minutes. Press **Continue to raise**.
3. **Raise.** Set a minimum and a cap in BNB. The **At a glance** panel shows Flap's live minimum raise for your split; a minimum below it is marked with a fix. On testnet, a larger pool share (step 3) lowers that minimum to a few test BNB, at the cost of a lower starting floor.
4. **Supply and unlocks** and **Treasury rules.** The defaults are the production defaults: 60% sale, 15% pool, 25% team at 2x, 4x and 8x, a $30,000 budget capped at 4%, a 1% exit fee. Change what you like; every field is checked against the factory as you type.
5. **Review and launch.** Press **Mine a 7777 salt** (Flap requires token addresses that end in 7777; your browser finds one in a few seconds), then **Create covenant** and confirm in your wallet. You pay Flap's salt lock fee and gas.
6. Share the covenant page. When the sale window ends (2 minutes on the demo factory) and the minimum is met, anyone finalizes and the token is live.

Prefer to describe it? Ask Covenant AI "Raise 4 BNB for my GPU agent". It drafts the terms against Flap's live floor and gives you a card to create it or edit it in Create.

## Agent: connect over MCP in five minutes

The MCP server runs from a clone of the repository with Node 22 and pnpm. It reads BNB testnet from the committed deployment record and needs no key, account or configuration:

```bash
git clone https://github.com/Adityaakr/Covenent.git && cd Covenent
pnpm --dir server install
claude mcp add covenant -- pnpm --dir "$PWD/server" mcp
```

Then ask your agent, in plain words:

- "List the covenants and tell me which I could redeem." It calls `get_network`, then `list_covenants`.
- "What happened to CVT?" It calls `get_covenant` and `get_events`.
- "Before I commit 0.05 BNB to the open raise, what is my worst case?" It runs the `before_you_commit` prompt: `get_raise`, `get_terms`, `get_issuer`, `get_downside`.
- "Commit 0.05 BNB from my wallet." It calls `commit` and hands you an unsigned, simulated transaction to sign in your own wallet.

[For agents](/docs/agents) has the Claude Desktop and Cursor configuration and every tool; [Agentic finance](/docs/agentic-finance#walkthrough-an-investor-agent-backs-a-raise) walks the whole session through.

## Run the whole stack locally

With [Foundry](https://getfoundry.sh), Node 22 and pnpm installed, `git submodule update --init` and then `scripts/dev-all.sh` start a local chain, deploy every contract, create covenants at every stage by real transactions, and start the API (port 8787), the keeper, the issuer agents and the web app on http://localhost:8080. It uses a BNB Chain fork when one is reachable, else an offline mock chain (`--mock`). `scripts/dev-all.sh stop-issuer` kills the issuer agent so you can watch the keeper declare the covenant abandoned.

## Run the tests

`forge test` in `contracts/`, then `pnpm test` in `server/` and in `web/`. [Security](/docs/security#tests) says what they cover.
