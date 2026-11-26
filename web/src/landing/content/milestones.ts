/** Owner: changelog agent. Also rendered by the home milestones preview. */
export type Milestone = {
  slug: string; title: string; date: string; // ISO date
  version: string; tag: string; summary: string; cover: string; body: { h2?: string; p?: string }[];
};

/**
 * Build milestones, newest first (the template sorts its Changelog CMS by date, descending).
 * Sources: docs/DESIGN.md "Build plan for the 36 hours" and the git history
 * (design document committed Nov 25 2026, agent layer Nov 26 2026). See docs/landing/content/changelog.md.
 */
export const milestones: Milestone[] = [
  {
    slug: "demo-night",
    title: "Demo Night",
    date: "2026-11-27",
    version: "0.6",
    tag: "Target",
    summary: "Three minutes on stage, Nov 27 from 15:00 to 18:00. Money goes in, rules hold it, holders get it back.",
    cover: "/landing/changelog/cover-1.jpg",
    body: [
      { p: "Demo Night runs on Nov 27 from 15:00 to 18:00. The demo tells one story in three minutes: money goes in, rules hold it, and a holder gets it back when the price says the project has failed." },
      { h2: "What the demo shows" },
      { p: "An oversubscribed raise, a tap claim, a slide under book value that pays a holder, and an abandoned project that opens its treasury. Every step is a real transaction on a fork or testnet with short timers." },
      { p: "The issuer in the demo is an AI agent, because every rule is easier to see when the team is software. If the agent layer is cut, the same script runs with a human team wallet." },
    ],
  },
  {
    slug: "gate-c-feature-freeze",
    title: "Gate C: feature freeze",
    date: "2026-11-26",
    version: "0.5",
    tag: "Target",
    summary: "Hour 26 of the build. Feature freeze, fixes only from here.",
    cover: "/landing/changelog/cover-2.jpg",
    body: [
      { p: "Gate C lands at hour 26 of the 36-hour build. From here the plan allows fixes only, no new features." },
      { h2: "What comes before it" },
      { p: "Hours 18 to 26 cover the testnet deployment if Flap enables our factory, a demo factory with short timers, CovenantLiteVault and its fork test, the redeem flow, the team console and the simulator page." },
      { p: "If a gate slips, the plan cuts scope from the cut order instead of pushing the gate." },
    ],
  },
  {
    slug: "gate-b-demo-story-end-to-end",
    title: "Gate B: the demo story, end to end",
    date: "2026-11-26",
    version: "0.4",
    tag: "Target",
    summary: "Hour 18 of the build. The fork test runs the whole demo story end to end.",
    cover: "/landing/changelog/cover-3.jpg",
    body: [
      { p: "Gate B lands at hour 18. The fork test runs the whole demo story end to end. It is the gate that matters: a complete story on a fork beats a broader build that breaks on stage." },
      { h2: "What comes before it" },
      { p: "Hours 10 to 18 cover the tap, the exit streak, rounds, redeem, the heartbeat and wind-down, with unit tests for every rule and the covenant sheet on live contract reads." },
      { p: "Nothing in the agent layer starts before Gate B is green." },
    ],
  },
  {
    slug: "gate-a-raise-to-vault",
    title: "Gate A: raise to vault on a fork",
    date: "2026-11-26",
    version: "0.3",
    tag: "Target",
    summary: "Hour 10 of the build. Commit, finalize, then token, pool and vault exist and tokens are claimed.",
    cover: "/landing/changelog/cover-4.jpg",
    body: [
      { p: "Gate A lands at hour 10. A fork test commits to the raise, finalizes it, checks that the token, the pool and the vault exist, and claims tokens." },
      { h2: "What comes before it" },
      { p: "Hours 2 to 10 cover the launcher (commit, finalize, refunds, launch), the vault factory checks, the vault hand-off, the pair time-weighted price library and the oracle with its trust gate." },
    ],
  },
  {
    slug: "agent-layer-design",
    title: "Agent layer design",
    date: "2026-11-26",
    version: "0.2",
    tag: "Shipped",
    summary: "Issuer, investor and keeper agents, an MCP server and ERC-8004 identity, around the same five rules.",
    cover: "/landing/changelog/cover-5.jpg",
    body: [
      { p: "The vault that binds a human team binds an AI agent the same way, and an agent needs it more. The agent layer puts agents on both sides of a covenant without changing the five rules." },
      { h2: "Three agent roles" },
      { p: "The issuer agent holds the team wallet, claims its tap as a compute budget, sends heartbeats and posts a report each period. Investor agents read terms and redeem through the Covenant MCP server. The keeper agent pokes hourly." },
      { p: "The LLM never decides a rule. It writes the report and explains the budget choices. The rules stay in the vault." },
    ],
  },
  {
    slug: "design-document",
    title: "Design document",
    date: "2026-11-25",
    version: "0.1",
    tag: "Shipped",
    summary: "The raise, book value and the five rules, written down before any contract code.",
    cover: "/landing/changelog/cover-6.jpg",
    body: [
      { p: "The design document sets out Covenant: a launcher and vault for token raises on BNB Chain that binds the team after the money comes in." },
      { h2: "Five rules" },
      { p: "Tap, performance unlock, book-value exit, abandonment switch and disclosure. Smart contracts, a time-weighted pool price and signed Atlas reports behind a trust gate enforce them." },
      { p: "It also fixes the build plan: 36 hours, three gates, and a cut order that keeps the demo story intact." },
    ],
  },
];
