/*
 * The docs at /docs: one ordered list of pages. Each page's body is web/src/docs/content/<slug>.md, the one source for
 * the HTML page (/docs/<slug>), its markdown twin (/docs/<slug>.md), /llms.txt and /llms-full.txt (docs/source.ts).
 * `answer` is the page's one-line answer: the lead under the title, the meta description and the llms.txt line.
 */

export interface DocPage {
  slug: string;
  title: string;
  /** shorter label for the sidebar, when the title is long */
  nav?: string;
  group: DocGroup;
  answer: string;
}

export const DOC_GROUPS = ["Start", "Understand", "Use it", "Reference"] as const;
export type DocGroup = (typeof DOC_GROUPS)[number];

export const DOC_PAGES: readonly DocPage[] = [
  {
    slug: "introduction",
    title: "Introduction",
    group: "Start",
    answer:
      "Covenant is a launcher and a vault for token raises on BNB Chain: the money a team or an AI agent raises sits in a vault under five rules that code enforces and anyone can trigger.",
  },
  {
    slug: "how-it-works",
    title: "How it works",
    group: "Start",
    answer:
      "Buyers commit BNB to a capped raise, Flap launches the token and its pool, most of the raise goes into the vault, the team draws a capped budget from it, and holders can exit at book value when the market price stays below it.",
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    group: "Start",
    answer: "Open the app on BNB testnet with a wallet and a little test BNB, or clone the repository to run the MCP server or the whole stack yourself.",
  },
  {
    slug: "rules",
    title: "The five rules",
    group: "Understand",
    answer:
      "Every covenant runs the same five rules: a capped budget that can only go down, team tokens that unlock on price, an exit at book value, an abandonment switch, and on-chain reports.",
  },
  {
    slug: "concepts",
    title: "Concepts",
    group: "Understand",
    answer:
      "Book value is the treasury per redeemable token; the vault compares it with the pool's time-weighted price, prices the budget in dollars through Atlas, and moves through six states.",
  },
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
    slug: "faq",
    title: "FAQ",
    group: "Reference",
    answer: "Short answers to the questions people ask first.",
  },
];

export const docHref = (slug: string) => (slug === "introduction" ? "/docs" : `/docs/${slug}`);
export const docMdHref = (slug: string) => `/docs/${slug}.md`;
export const findDoc = (slug: string) => DOC_PAGES.find((p) => p.slug === slug);

export function neighbours(slug: string): { prev: DocPage | null; next: DocPage | null } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? DOC_PAGES[i - 1]! : null, next: i >= 0 && i < DOC_PAGES.length - 1 ? DOC_PAGES[i + 1]! : null };
}
