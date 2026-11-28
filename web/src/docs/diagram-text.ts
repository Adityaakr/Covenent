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

export const ARCHITECTURE_LAYERS = [
  { title: "People and agents", items: ["Browser and wallet", "AI agent (MCP client)"] },
  { title: "Off-chain (server/, web/)", items: ["Web app", "API", "Keeper", "MCP server", "Issuer agent", "Investor agent"] },
  { title: "Covenant contracts (BNB Chain)", items: ["Launcher", "Vault", "Oracle", "Lens"] },
  { title: "Partners on chain", items: ["Flap Portal", "PancakeSwap pool", "Atlas BNB/USD", "ERC-8004"] },
] as const;

export type DiagramName = "lifecycle" | "states" | "architecture";

export const DIAGRAM_TEXT: Record<DiagramName, string> = {
  lifecycle: [
    "The life of a covenant, in five steps:",
    "",
    "1. **Raise.** Buyers commit BNB to the launcher until the deadline. Below the minimum, everyone is refunded in full; above the cap, the excess is refunded pro rata.",
    "2. **Launch.** `finalize()` (anyone, after the deadline) calls Flap's Portal: it mints the tax token, seeds a PancakeSwap pool at the sale price and creates the vault.",
    "3. **Vault.** The rest of the raise goes to the vault as the treasury. Trading tax from the token lands there too.",
    "4. **Budget.** The team wallet draws the tap: a dollar budget per 30 days, capped as a share of the treasury.",
    "5. **Exit.** If the pool trades below book value for the exit streak, or the team goes silent, holders burn tokens for their share of the treasury.",
  ].join("\n"),
  states: [
    "The states of a covenant:",
    "",
    "- `RAISING` -> `ACTIVE` when `finalize()` launches the token, or -> `FAILED` (terminal, full refunds) when the raise missed its minimum or the launch was refused past the retry window.",
    "- `ACTIVE` -> `EXIT_ROUND` when the exit streak fills. Holders can redeem at book value, less the exit fee.",
    "- `EXIT_ROUND` -> `COOLDOWN` when the round ends, then `COOLDOWN` -> `ACTIVE` when the cooldown ends.",
    "- Any live state -> `WIND_DOWN` (terminal) when someone declares the covenant abandoned or the team winds it down. Redemption is then open with no fee, forever.",
  ].join("\n"),
  architecture: [
    "Four layers, top to bottom:",
    "",
    ...ARCHITECTURE_LAYERS.map((l) => `- **${l.title}:** ${l.items.join(", ")}.`),
    "",
    "The web app and agents read the chain directly or through the API and MCP server; the keeper pokes the oracle; only wallets sign.",
  ].join("\n"),
};
