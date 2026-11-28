## Raising on chain is a trust-me handoff

AI agents and small teams can now raise money on chain in minutes. What they cannot do is make that money safe to give. Today a raise ends with the money in the issuer's wallet, and every buyer is trusting a promise:

- **Rugs.** Nothing stops the issuer from selling its own tokens or walking off with the treasury.
- **No budget.** It can spend everything in a week. Buyers find out afterwards.
- **No exit.** When the token trades below what the treasury holds, a holder can only sell at the discount.

An AI agent makes all three worse. It cannot be sued, it can be hijacked through a prompt or a leaked key, and it stops the day its credits run out.

## Covenant makes a venture fundable

```covenant
diagram:handoff
```

Covenant is the operating stack between the money and the venture. Capital comes in through a capped raise, a budget goes out under rules, and holders keep an exit. The rules live in a vault contract on BNB Chain, they run around the clock, and anyone can trigger them.

- **Capital in.** A capped public raise launches the token and its PancakeSwap pool through [Flap](https://flap.sh)'s Pool Launch. Below the minimum everyone is refunded; above the cap everyone is scaled back. Most of the money lands in a vault, not in a wallet.
- **A budget out.** The team or agent draws a dollar budget every 30 days, capped as a share of the treasury. It can lower that budget, never raise it.
- **An exit for holders.** If the market price sits below the treasury's value per token for three days, any holder can redeem at that value. If the issuer goes silent for 45 days, anyone can open the treasury to holders for good.
- **A record of the work.** Team tokens unlock only when the price holds at 2x, 4x and 8x the sale price. Reports and an agent's decisions go on chain, and the outcome of each covenant is written to the agent's ERC-8004 reputation, which follows it to its next raise.

The buyer no longer has to trust the issuer. They read the terms, which nobody can loosen after the raise, and they can work out the worst case before they commit.

## The same rails for agents and people

A human team and an AI agent sign the same terms with the same contracts. What changes for an agent is that everything is machine-readable: an investor agent reads the terms, prices the downside and redeems through the [MCP server](/docs/agents), and an issuer agent claims its budget, posts its decisions and sends its heartbeat the same way. The MCP server never holds a key: every write comes back as an unsigned, simulated transaction for a wallet to sign. [Agentic finance](/docs/agentic-finance) walks through it.

## Think MetaDAO, enforced by the vault

If you know MetaDAO on Solana, you know the idea: a raise whose treasury is protected, and that holders can get back if the team misbehaves. Covenant brings that idea to BNB Chain through Flap. The difference is the engine: fixed rules in the vault instead of votes or proposal markets, so one holder can leave alone, and a silent team loses the treasury without anyone having to propose it. [Why Covenant](/docs/why-covenant) compares the two fairly.

## Start here

| If you want to | Read |
|---|---|
| See why this design, and how it compares | [Why Covenant](/docs/why-covenant) |
| Understand the whole mechanism in one page | [How it works](/docs/how-it-works) |
| Run or fund an AI agent | [Agentic finance](/docs/agentic-finance) |
| Try it on testnet in five minutes | [Quickstart](/docs/quickstart) |
| Check a number or an address | [Rules and defaults](/docs/rules), [Contracts and addresses](/docs/contracts) |

## Status

Covenant runs on BNB testnet (chain 97) only, with test BNB that has no value. Nothing is deployed on BNB Chain mainnet, and the contracts have not had an independent human audit. It was built at BNB Hack Bangkok, 25 to 27 November 2026. [Known limitations](/docs/limitations) lists what is not done yet.
