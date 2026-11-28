/*
 * The text version of each docs diagram: what the markdown twin, /llms-full.txt and screen readers get. The drawn
 * versions are in docs/diagrams.tsx and show the same steps, so change both together.
 */

export const LIFECYCLE_STEPS = [
  { title: "Raise", sub: ["Buyers commit BNB", "to the launcher"] },
  { title: "Launch", sub: ["Flap mints the token", "and seeds the pool"] },
  { title: "Vault", sub: ["Holds the treasury", "and trading tax"] },
  { title: "Budget", sub: ["Team draws a capped", "dollar tap"] },
  { title: "Exit", sub: ["Holders redeem", "at book value"] },
] as const;

export const SIGNING_STEPS = [
  { title: "Agent", sub: ["Calls an MCP tool,", "e.g. commit"] },
  { title: "MCP server", sub: ["Reads the chain, builds", "and simulates the tx"] },
  { title: "Wallet", sub: ["The user or the agent's", "own signer signs"] },
  { title: "BNB Chain", sub: ["The vault enforces", "the rules"] },
] as const;

export const ARCHITECTURE_LAYERS = [
  { title: "People and agents", items: ["Browser and wallet", "AI agent (MCP client)"] },
  { title: "Off-chain (server/, web/)", items: ["Web app", "API", "Keeper", "MCP server", "Issuer agent", "Investor agent"] },
  { title: "Covenant contracts (BNB Chain)", items: ["Launcher", "Vault", "Oracle", "Lens"] },
  { title: "Partners on chain", items: ["Flap Portal", "PancakeSwap pool", "Atlas BNB/USD", "ERC-8004"] },
] as const;

/** The exit-streak example on the exit page: hours below and above book, and where each rule ends up. */
export const STREAK_EXAMPLE = {
  targetHours: 72,
  phases: [
    { from: 0, to: 48, below: true },
    { from: 48, to: 60, below: false },
    { from: 60, to: 96, below: true },
  ],
  roundOpensAt: 96,
  endHours: 108,
} as const;

export type DiagramName = "handoff" | "lifecycle" | "moneyflow" | "states" | "streak" | "signing" | "architecture";

export const DIAGRAM_TEXT: Record<DiagramName, string> = {
  handoff: [
    "Two ways to raise:",
    "",
    "- **Today, a trust-me handoff.** Buyers send BNB straight to the team's wallet. Nothing stops the team spending it all, selling its tokens or going silent.",
    "- **With Covenant.** Buyers send BNB to a vault that runs fixed rules. The team or agent draws a capped budget from it; holders can redeem at book value when the price stays below it, or when the team goes silent. Anyone can trigger the rules.",
  ].join("\n"),
  lifecycle: [
    "The life of a covenant, in five steps:",
    "",
    "1. **Raise.** Buyers commit BNB to the launcher until the deadline. Below the minimum, everyone is refunded in full; above the cap, the excess is refunded pro rata.",
    "2. **Launch.** `finalize()` (anyone, after the deadline) calls Flap's Portal: it mints the tax token, seeds a PancakeSwap pool at the sale price and creates the vault.",
    "3. **Vault.** The rest of the raise goes to the vault as the treasury. Trading tax from the token lands there too.",
    "4. **Budget.** The team wallet draws the tap: a dollar budget per 30 days, capped as a share of the treasury.",
    "5. **Exit.** If the pool trades below book value for the exit streak, or the team goes silent, holders burn tokens for their share of the treasury.",
  ].join("\n"),
  moneyflow: [
    "Where the money goes:",
    "",
    "- **Buyers** commit BNB to the **launcher**.",
    "- At `finalize()` the launcher splits the accepted raise: commitments above the cap go back to buyers as **refunds**; `Q × P / A` (25% with the default split) seeds the **PancakeSwap pool**; the rest (75%) becomes the **vault treasury**.",
    "- **Into the vault:** the token's trading tax (through Flap's tax processor), revenue the issuer deposits, and the exit fees it keeps.",
    "- **Out of the vault, only two ways:** the capped budget to the **team wallet** fixed at creation, and redemptions at book value to **holders**.",
  ].join("\n"),
  states: [
    "The states of a covenant:",
    "",
    "- `RAISING` -> `ACTIVE` when `finalize()` launches the token, or -> `FAILED` (terminal, full refunds) when the raise missed its minimum or the launch was refused past the retry window.",
    "- `ACTIVE` -> `EXIT_ROUND` when the exit streak fills. Holders can redeem at book value, less the exit fee.",
    "- `EXIT_ROUND` -> `COOLDOWN` when the round ends, then `COOLDOWN` -> `ACTIVE` when the cooldown ends.",
    "- Any live state -> `WIND_DOWN` (terminal) when someone declares the covenant abandoned or the team winds it down. Redemption is then open with no fee, forever.",
  ].join("\n"),
  streak: [
    "The exit streak over four and a half days, with a 3-day (72-hour) target:",
    "",
    "| Hours | Pool price | Covenant's streak (decays) | A streak that resets |",
    "|---|---|---|---|",
    "| 0 to 48 | below book | rises to 48 h | rises to 48 h |",
    "| 48 to 60 | above book | falls to 36 h | resets to 0 |",
    "| 60 to 96 | below book | rises to 72 h: **the exit round opens** at hour 96 | rises to 36 h: no round |",
    "",
    "Twelve hours above book cancel twelve hours below it, not two days of evidence.",
  ].join("\n"),
  signing: [
    "How an agent acts on Covenant:",
    "",
    "1. **Agent.** It calls an MCP tool, for example `commit` with an amount and its wallet.",
    "2. **MCP server.** It reads the chain, builds the unsigned transaction and simulates it as that wallet. It holds no key.",
    "3. **Wallet.** The user, or the agent's own signer under the user's rules, checks and signs it.",
    "4. **BNB Chain.** The transaction lands, and the vault enforces the five rules whatever was signed.",
  ].join("\n"),
  architecture: [
    "Four layers, top to bottom:",
    "",
    ...ARCHITECTURE_LAYERS.map((l) => `- **${l.title}:** ${l.items.join(", ")}.`),
    "",
    "The web app and agents read the chain directly or through the API and MCP server; the keeper pokes the oracle; only wallets sign.",
  ].join("\n"),
};
