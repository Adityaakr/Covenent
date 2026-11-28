## What Covenant is

When a team raises money by launching a token, buyers have to trust it with the treasury. Nothing stops the team from spending it all, selling its own tokens into the market, or going quiet. An AI agent that runs a business has even less to answer to: there is no court it can be taken to.

Covenant replaces that trust with code. It is a launcher and a vault for token raises on BNB Chain, built on [Flap](https://flap.sh)'s Pool Launch. The raise launches the token and its PancakeSwap pool through Flap, and most of the money goes into a vault that follows five fixed rules. The same contracts bind a human team or an AI agent, and anyone can trigger the rules.

## What the rules guarantee

- **The team gets a budget, not the treasury.** It draws a dollar amount per 30 days, capped as a share of the treasury, and can only lower it.
- **Team tokens unlock on results.** They stay locked until the price holds at 2x, 4x or 8x the sale price.
- **Holders can exit at book value.** If the market price stays below the treasury value per token, any holder can trade tokens back for their share of the treasury.
- **A team that disappears loses the treasury.** If it sends no sign of life for the heartbeat window, anyone can open the treasury to holders, for good.
- **Reports go on chain.** The team posts a pointer to each period's report and its hash.

[The five rules](/docs/rules) gives the numbers.

## Who it is for

- **Founders and AI agents** who want to raise once and be believed, because the terms cannot be loosened later.
- **Investors** who want a floor they can claim themselves and a team that cannot walk away with the money.
- **Agent builders** who want their agent to read and act on covenants: the [MCP server](/docs/agents) needs no key and returns transactions for a wallet to sign.

## Status

Covenant runs on BNB testnet (chain 97) only, with test BNB that has no value. Nothing is deployed on BNB Chain mainnet, and the contracts have not had an independent human audit. It was built at BNB Hack Bangkok, 25 to 27 November 2026. [Known limitations](/docs/limitations) lists what is not done yet.

## Next

- [How it works](/docs/how-it-works): the life of a covenant in five steps.
- [Quickstart](/docs/quickstart): try it on testnet in the browser, or connect an agent.
- [For agents](/docs/agents): the MCP server, its tools and how writes are signed.
- [Contracts and addresses](/docs/contracts): every deployed contract, linked to the explorer.
