/* Compare table content. Every cell comes from docs/DESIGN.md "Positioning and prior art" (the table),
   "Where Covenant is different on purpose" and "Where Covenant is weaker, stated up front".
   "✓" renders in Accent and "–" in Text Secondary, as the template does. */

export const compareColumns = ["Covenant", "MetaDAO", "DAICO", "Launchpads"] as const;

export type CompareRow = { name: string; cells: [string, string, string, string] };
export type CompareGroup = { title: string; rows: CompareRow[] };

export const compareFirstHeader = "Terms";

export const compareGroups: CompareGroup[] = [
  {
    title: "Raise and treasury",
    rows: [
      { name: "Raise", cells: ["Capped, pro rata", "Capped, pro rata", "Any sale format", "Curve purchases"] },
      { name: "Full refund under minimum", cells: ["✓", "–", "Not specified", "–"] },
      { name: "Where the money sits", cells: ["Rule-bound vault", "Futarchy multisig", "Tap contract", "Pool and creator"] },
      { name: "Team budget", cells: ["Dollar tap, capped", "Monthly allowance", "Per-second tap", "None"] },
      { name: "Team tokens", cells: ["Unlock at multiples", "Unlock 2x to 32x", "Not specified", "Usually free"] },
    ],
  },
  {
    title: "Holder exit",
    rows: [
      { name: "Exit at asset value", cells: ["Individual, by rule", "Collective, by proposal", "Collective, by vote", "None"] },
      { name: "One holder can leave", cells: ["✓", "–", "–", "–"] },
      { name: "Fixed rules, nothing to vote on", cells: ["✓", "–", "–", "–"] },
      { name: "What enforces it", cells: ["Contract and feed", "Markets and legal entity", "Token vote", "Nothing"] },
    ],
  },
  {
    title: "Trade-offs, stated up front",
    rows: [
      { name: "Legal claim on the company", cells: ["–", "✓", "Not specified", "–"] },
      { name: "Holder governance", cells: ["–", "✓", "✓", "–"] },
      { name: "Trading tax feeds the treasury", cells: ["✓", "–", "Not specified", "–"] },
    ],
  },
];
