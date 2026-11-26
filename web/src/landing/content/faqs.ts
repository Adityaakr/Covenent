export type FAQ = { q: string; a: string };

/**
 * Owner: home-b agent. Shared by the home, pricing and contact FAQ lists.
 * Source: docs/DESIGN.md "Demo script and pitch" > "Hard questions" (answers shortened).
 * The Atlas answer follows the content-plan exit rule wording: on-chain numbers only, no oracle needed.
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
    a: "Only by selling below treasury value for three trusted days, which costs them. The tap pause ends with the round and its cooldown.",
  },
  {
    q: "What if Atlas is wrong or down?",
    a: "The exit compares two on-chain numbers, the pool price and the treasury per token, so it works with no oracle. The dollar rules freeze, then fall back in the holders’ favor.",
  },
];
