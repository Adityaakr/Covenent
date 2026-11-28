## How is Covenant different from MetaDAO?

Both protect a raise's treasury after the money comes in. MetaDAO does it with proposals decided by markets (futarchy) on Solana; Covenant does it with fixed rules in a vault on BNB Chain, so one holder can exit at book value without a vote, and a silent team loses the treasury without anyone proposing it. [Why Covenant](/docs/why-covenant) compares them.

## Why would anyone fund an AI agent?

Without rules, they should not: an agent cannot be sued, can be hijacked and can stop. With a capped budget, an exit at book value and an abandonment switch, the worst case is a number you can compute before committing. [Agentic finance](/docs/agentic-finance).

## Is Covenant on mainnet?

No. It runs on BNB testnet (chain 97) with test BNB, and it has not had an independent human audit.

## Do I have to trust the team?

Less than usual. The team cannot raise its budget, move the treasury, unlock its tokens early or change a term. What you still trust is listed under [Security](/docs/security#trust-assumptions): mainly Flap's Guardian, which can upgrade the contracts.

## What if the agent's key leaks?

The attacker reaches the budget accrued so far, which never exceeds one period's cap (4% of the treasury by default). The treasury stays in the vault, and the team wallet and the terms cannot be changed.

## What happens if the AI agent running a covenant stops?

Nothing sends heartbeats any more. Once the heartbeat window passes, anyone can declare the covenant abandoned (the keeper does it on its next tick), and every holder can redeem at book value with no fee, forever.

## Why does the floor start below the sale price?

Part of the raise seeds the pool, and the treasury backs the pool's tokens as well as the buyers'. With the default terms that puts book value at 60% of the sale price on day one.

## Who pokes the oracle, and does Covenant need a server?

Anyone can poke: the keeper, the button in the app, the MCP tool `poke`, or a plain transaction. The contracts need no server. The keeper just makes sure someone pokes about once an hour.

## What does Atlas do, and what if it is down?

Atlas gives the BNB/USD rate that prices the budget and the dollar unlock targets. If no rate arrives, the budget is priced at the last verified rate, unlocks stop advancing, and the exit rule carries on: it never uses Atlas.

## Why is everything in BNB and not a stablecoin?

Flap's pools are quoted in BNB, so the raise, the pool and the treasury are BNB. Demo USDC on testnet is only for the agent-economy demo: it pays the agent and never enters a vault.

## Does Covenant take a fee?

No. The costs are Flap's salt lock fee at creation, the trading tax (which funds the treasury), the exit fee (which stays in the treasury) and gas. [Fees and guarantees](/docs/guarantees).

## Does the MCP server need my private key?

No. It never holds or asks for a key. Write tools return an unsigned transaction with a simulation, and you sign it in your own wallet. Never give a key to any MCP server.

## Can a human team use Covenant?

Yes. The same contracts bind a human team or an AI agent; an agent can also carry an ERC-8004 identity and reputation.

## Why does every token address end in 7777?

Flap's Portal requires it. The app mines the salt that produces such an address before it creates the covenant.

## Why does finalize need a 15M gas limit?

The launch through Flap's Portal is large, so the launcher checks that 12M gas is left before trying it; 15M is the most Flap's tools send. The app, the API and the MCP server set it for you. Only the gas used is paid.
