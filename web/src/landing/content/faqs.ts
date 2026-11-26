export type FAQ = { q: string; a: string };

/**
 * Owner: home-b agent. Shared by the home, pricing and contact FAQ lists.
 * Source: docs/DESIGN.md "Demo script and pitch" > "Hard questions", "Hard questions on the agent layer" and
 * "Where Covenant is weaker" (answers shortened). The exit answers follow the rule as built
 * (contracts/src/vault/CovenantVault.sol): on-chain numbers only, and the streak decays instead of resetting.
 */
export const faqs: FAQ[] = [
  {
    q: "Is this MetaDAO on BNB Chain?",
    a: "Same promise, different engine. A fixed rule instead of a market, and an exit for one holder instead of a vote for all. It lives inside launchpads people already use.",
  },
  {
    q: "Why would a team accept these limits?",
    a: "Protected raises drew about thirteen times the capital they could take. The limits are what make a raise credible. The team keeps its upside through price tranches.",
  },
  {
    q: "What stops the team draining the treasury?",
    a: "The tap. It is capped at 4% of the treasury per 30 days, and nobody can raise it.",
  },
  {
    q: "What is the floor really worth?",
    a: "With default terms, 60% of the sale price at launch. It falls as the team spends and rises as trading tax comes in.",
  },
  {
    q: "Can a whale trigger an exit to hurt the team?",
    a: "Only by selling below treasury value for three days, which costs them. The tap pause ends with the round and its cooldown.",
  },
  {
    q: "Can a team pump the price to hold the exit off?",
    a: "Not for long. Time above book counts the exit streak down hour for hour instead of resetting it, so an hour of buying buys an hour.",
  },
  {
    q: "What if Atlas is wrong or down?",
    a: "The exit compares two on-chain numbers, the pool price and the treasury per token, so it works with no oracle. The dollar rules freeze, then fall back in the holders’ favor.",
  },
  {
    q: "Why not let holders redeem at any time?",
    a: "Arbitrage would pin the price at book and an honest team could be starved for months. A round gives doubters a clean exit, then funding resumes.",
  },
  {
    q: "What if an agent’s key leaks?",
    a: "The attacker reaches the accrued tap, at most 4% of the treasury a month. They could also wind the project down, which hands the treasury to holders, not to them.",
  },
  {
    q: "Does the agent have to be autonomous?",
    a: "No. A human with the key and an agent with the key are bound by the same vault. Covenant binds the wallet, whoever holds it.",
  },
  {
    q: "What does Covenant not protect?",
    a: "Holders get a contract right to treasury BNB, not the company, its IP or its revenue. There is no governance in v1, and the floor starts below the sale price and falls as the team spends.",
  },
  {
    q: "Is this token a security?",
    a: "A redemption right raises that question in some places. Legal review comes before mainnet; the current build runs on a local chain and testnet.",
  },
];
