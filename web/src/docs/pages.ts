/*
 * The docs at /docs: one ordered list of pages. Each page's body is web/src/docs/content/<slug>.md, the one source for
 * the HTML page (/docs/<slug>), its markdown twin (/docs/<slug>.md), /llms.txt and /llms-full.txt (docs/source.ts).
 * `answer` is the page's one-line answer: the lead under the title, the meta description and the llms.txt line.
 * The order is the reading order: a newcomer goes Introduction, Why Covenant, How it works, Agentic finance,
 * Quickstart, then the mechanism in depth, then the reference.
 */

export interface DocPage {
  slug: string;
  title: string;
  /** shorter label for the sidebar and the pager, when the title is long */
  nav?: string;
  group: DocGroup;
  answer: string;
}

export const DOC_GROUPS = ["Start", "Mechanism", "Use it", "Reference"] as const;
export type DocGroup = (typeof DOC_GROUPS)[number];

export const DOC_PAGES: readonly DocPage[] = [
  // ── Start: the newcomer path ──
  {
    slug: "introduction",
    title: "The operating stack for autonomous ventures",
    nav: "Introduction",
    group: "Start",
    answer: "Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain.",
  },
  {
    slug: "why-covenant",
    title: "Why Covenant",
    group: "Start",
    answer:
      "MetaDAO showed that people will fund a raise whose treasury they can get back. Covenant brings that protection to BNB Chain with fixed rules in a vault instead of proposal markets, and makes it native for AI agents.",
  },
  {
    slug: "how-it-works",
    title: "How it works",
    group: "Start",
    answer:
      "A capped raise launches the token through Flap, a vault keeps most of the money, the team draws a capped dollar budget, and holders redeem at book value when the price stays below it or the team goes silent.",
  },
  {
    slug: "agentic-finance",
    title: "Agentic finance",
    group: "Start",
    answer:
      "An AI agent can raise capital, draw a budget for its compute and build a public track record on Covenant, while its holders are protected by the vault instead of by trust in the agent.",
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    group: "Start",
    answer: "Three five-minute paths on BNB testnet: back a raise as an investor, open one as a founder, or connect an AI agent over MCP.",
  },

  // ── Mechanism: each part in depth ──
  {
    slug: "raise",
    title: "The raise and the launch",
    nav: "Raise and launch",
    group: "Mechanism",
    answer:
      "Buyers commit BNB to a capped raise; after the deadline one finalize() call refunds the excess, launches the token and its pool through Flap, and moves the rest of the money into the vault.",
  },
  {
    slug: "treasury",
    title: "Treasury and book value",
    group: "Mechanism",
    answer:
      "The vault holds the treasury in BNB and grows it with trading tax and revenue; book value is that treasury per redeemable token, and it is the price holders can exit at.",
  },
  {
    slug: "budget",
    title: "The budget",
    nav: "Budget (tap)",
    group: "Mechanism",
    answer:
      "The team draws a budget set in dollars per 30 days, paid in BNB at the Atlas rate and never more than a fixed share of the treasury. It can be lowered, never raised.",
  },
  {
    slug: "unlocks",
    title: "Team unlocks",
    group: "Mechanism",
    answer:
      "The team's tokens stay locked until the price holds at 2x, 4x and 8x the sale price, in dollars and in BNB, for 30 days after a 180-day cliff. Time cannot unlock them; only the price can.",
  },
  {
    slug: "exit",
    title: "The exit at book value",
    nav: "Exit at book value",
    group: "Mechanism",
    answer:
      "When the pool trades below book value for a 3-day streak, a 7-day exit round opens and any holder can burn tokens for their share of the treasury, less a 1% fee that stays with the holders who remain.",
  },
  {
    slug: "heartbeats",
    title: "Heartbeats and the end",
    group: "Mechanism",
    answer:
      "The team proves it is alive by acting. After 45 days of silence anyone can declare the covenant abandoned: the locked team tokens burn and the treasury opens to holders with no fee, forever.",
  },
  {
    slug: "oracle",
    title: "Prices and the oracle",
    group: "Mechanism",
    answer:
      "Anyone can poke the oracle, about once an hour; each poke turns the pool's time-weighted price, plus an Atlas BNB/USD rate when one is available, into one observation that the vault acts on.",
  },
  {
    slug: "guarantees",
    title: "Fees and guarantees",
    group: "Mechanism",
    answer:
      "Covenant takes no fee and has no admin key. The trading tax funds the treasury, the exit fee stays with holders, and the table below lists what nobody, the team included, can do.",
  },

  // ── Use it ──
  {
    slug: "founders-and-investors",
    title: "For founders and investors",
    nav: "Founders and investors",
    group: "Use it",
    answer:
      "Founders and AI agents raise once under terms they cannot loosen later; investors get a floor they can claim themselves and a team that cannot drain the treasury or walk away with it.",
  },
  {
    slug: "agents",
    title: "For agents",
    group: "Use it",
    answer:
      "AI agents use Covenant through an MCP server that reads the chain with no key and returns every write as an unsigned, simulated transaction for a wallet to sign.",
  },
  {
    slug: "mcp-reference",
    title: "MCP reference",
    group: "Use it",
    answer: "Every tool, prompt and resource of the Covenant MCP server with its arguments and units, generated from the server's own tool list.",
  },

  // ── Reference ──
  {
    slug: "rules",
    title: "Rules and defaults",
    group: "Reference",
    answer:
      "Every covenant runs the same five rules. This page lists each with its default and the range the launcher factory accepts, for the production factory (days) and the demo factory (minutes).",
  },
  {
    slug: "architecture",
    title: "Architecture",
    group: "Reference",
    answer:
      "Contracts on BNB Chain hold the money and the rules; an off-chain keeper, API, MCP server and two agents read and poke them; the web app reads the chain directly.",
  },
  {
    slug: "contracts",
    title: "Contracts and addresses",
    nav: "Contracts and addresses",
    group: "Reference",
    answer: "Covenant runs on BNB testnet (chain 97); every address below comes from the deployment record contracts/deployments/97.json.",
  },
  {
    slug: "security",
    title: "Security",
    group: "Reference",
    answer:
      "Covenant is unaudited hackathon code on testnet: the review findings are fixed or disclosed with regression tests, and the trust it still needs (Flap's Guardian, one Atlas signer, the pool) is stated below.",
  },
  {
    slug: "limitations",
    title: "Known limitations",
    group: "Reference",
    answer: "What Covenant does not protect, what has only run on a fork, and the review findings that are still open.",
  },
  {
    slug: "glossary",
    title: "Glossary",
    group: "Reference",
    answer: "Every Covenant term in a line or two, from book value and the tap to strict observations and the heartbeat window.",
  },
  {
    slug: "faq",
    title: "FAQ",
    group: "Reference",
    answer: "Short answers to the questions people ask first.",
  },
];

export const docHref = (slug: string) => (slug === "introduction" ? "/docs" : `/docs/${slug}`);
export const docMdHref = (slug: string) => `/docs/${slug}.md`;
export const findDoc = (slug: string) => DOC_PAGES.find((p) => p.slug === slug);
/** The short label of a page: what the sidebar and the previous / next links show. */
export const docLabel = (p: DocPage) => p.nav ?? p.title;

export function neighbours(slug: string): { prev: DocPage | null; next: DocPage | null } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? DOC_PAGES[i - 1]! : null, next: i >= 0 && i < DOC_PAGES.length - 1 ? DOC_PAGES[i + 1]! : null };
}
