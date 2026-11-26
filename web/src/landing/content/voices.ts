/**
 * "Who named this problem". Each quote was copied from the linked page on 26 Nov 2026. `paraphrase: true`
 * marks a faithful summary in our words, shown with a "Paraphrase" label instead of quotation marks.
 * `answer` is how Covenant responds, in our words. Full citations: docs/landing/sources.md.
 */
export type Voice = {
  who: string;
  role: string;
  date: string;
  quote: string;
  paraphrase?: boolean;
  answer: string;
  href: string;
  sourceLabel: string;
};

export const voices: Voice[] = [
  {
    who: "Vitalik Buterin",
    role: "Ethereum co-founder",
    date: "Jan 2018",
    quote: "they can always vote to shut the DAICO down entirely and get their money back.",
    answer: "Covenant keeps the DAICO’s tap and pro rata refund, and replaces the vote with a rule one holder can use.",
    href: "https://ethresear.ch/t/explanation-of-daicos/465",
    sourceLabel: "ethresear.ch",
  },
  {
    who: "Vitalik Buterin",
    role: "Ethereum co-founder",
    date: "Apr 2026",
    quote:
      "If your goal is to avoid large losses of funds, it’s reasonable to allow a daily limit of $100 to bypass human confirmation.",
    answer: "The tap is that limit written into the vault. An agent’s key reaches its accrued budget and nothing more.",
    href: "https://vitalik.eth.limo/general/2026/04/02/secure_llms.html",
    sourceLabel: "vitalik.eth.limo",
  },
  {
    who: "BNB Chain",
    role: "Official blog",
    date: "May 21, 2026",
    quote: "Agent finance needs four things: identity, capability, payment, accountability.",
    answer: "Identity, capability and payment exist. Covenant is accountability for the agents that hold other people’s money.",
    href: "https://www.bnbchain.org/en/blog/bnb-chain-building-the-infrastructure-base-for-the-ai-agent-economy",
    sourceLabel: "bnbchain.org blog",
  },
  {
    who: "Tomašev et al., Google DeepMind",
    role: "Virtual Agent Economies",
    date: "Sep 2025",
    quote: "socio-technical infrastructure needed to ensure trust, safety, and accountability.",
    answer: "The rules live in a contract any agent or person can read before money moves, and enforce themselves after.",
    href: "https://arxiv.org/abs/2509.10147",
    sourceLabel: "arXiv 2509.10147",
  },
  {
    who: "Sean Neville",
    role: "Circle co-founder, CEO of Catena Labs, in a16z crypto",
    date: "Dec 2025",
    quote:
      "agents will need cryptographically signed credentials to transact — linking the agent to its principal, its constraints, and its liability.",
    answer: "A covenant ties an ERC-8004 agent id to its team wallet, its terms and the outcome of every raise it runs.",
    href: "https://a16zcrypto.com/posts/article/big-ideas-things-excited-about-crypto-2026/",
    sourceLabel: "a16zcrypto.com",
  },
  {
    who: "Chris Dixon and Elizabeth Harkavy",
    role: "a16z crypto",
    date: "May 2026",
    quote:
      "There’s still no standard framework for proving agent identity, handling delegated authority, or enforcing spending policies.",
    answer: "The tap is a spending policy the agent cannot edit upward. The vault enforces it, not the agent’s operator.",
    href: "https://a16zcrypto.com/posts/article/investing-in-catena-part-ii",
    sourceLabel: "a16zcrypto.com",
  },
  {
    who: "Howell, Niessner and Yermack",
    role: "NBER working paper 24774, Review of Financial Studies",
    date: "2018",
    quote: "Success is associated with disclosure, credible commitment to the project, and quality signals.",
    answer: "Covenant makes the commitment credible: terms fixed at launch, a budget that cannot rise, reports on-chain.",
    href: "https://www.nber.org/papers/w24774",
    sourceLabel: "NBER w24774",
  },
  {
    who: "MetaDAO",
    role: "Docs, “Ownership coins”",
    date: "Read Nov 2026",
    quote:
      "Most tokens don’t give you real ownership. The team controls the treasury, the IP, and a huge chunk of the supply. Token holders have no power.",
    answer: "The treasury sits in the vault, team tokens unlock on price, and a holder can leave at book value alone.",
    href: "https://docs.metadao.fi/benefits/ownership-coins",
    sourceLabel: "docs.metadao.fi",
  },
  {
    who: "Lee, Shleifer and Thaler",
    role: "Journal of Finance",
    date: "1991",
    quote:
      "Closed-end funds often trade at a discount to the value of the assets they hold, and the discount moves with investor sentiment.",
    paraphrase: true,
    answer: "When a token trades below treasury per token for three days, the book-value exit opens and closes the gap.",
    href: "https://ideas.repec.org/a/bla/jfinan/v46y1991i1p75-109.html",
    sourceLabel: "Journal of Finance 46(1)",
  },
];
