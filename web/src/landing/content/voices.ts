/**
 * "Who named this problem": the five sources the owner chose, in this order. Each quote was copied from the linked
 * page on 26 Nov 2026. `topic` is a short tag for the slider's tab. `paraphrase: true` would mark a faithful summary
 * in our words (shown with a "Paraphrase" label); none of the five needs it. `answer` is how Covenant responds, in
 * our words. The other verified voices (DeepMind, Sean Neville, Howell et al., Lee, Shleifer and Thaler) stay in
 * docs/landing/sources.md.
 */
export type Voice = {
  who: string;
  role: string;
  date: string;
  topic: string;
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
    topic: "DAICO",
    quote: "they can always vote to shut the DAICO down entirely and get their money back.",
    answer: "Covenant keeps the DAICO’s tap and pro rata refund, and replaces the vote with a rule one holder can use.",
    href: "https://ethresear.ch/t/explanation-of-daicos/465",
    sourceLabel: "ethresear.ch",
  },
  {
    who: "Vitalik Buterin",
    role: "Ethereum co-founder",
    date: "Apr 2026",
    topic: "Agent spending limit",
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
    topic: "Agent finance",
    quote: "Agent finance needs four things: identity, capability, payment, accountability.",
    answer: "Identity, capability and payment exist. Covenant is accountability for the agents that hold other people’s money.",
    href: "https://www.bnbchain.org/en/blog/bnb-chain-building-the-infrastructure-base-for-the-ai-agent-economy",
    sourceLabel: "bnbchain.org blog",
  },
  {
    who: "Chris Dixon and Elizabeth Harkavy",
    role: "a16z crypto",
    date: "May 2026",
    topic: "Agent spending policy",
    quote:
      "There’s still no standard framework for proving agent identity, handling delegated authority, or enforcing spending policies.",
    answer: "The tap is a spending policy the agent cannot edit upward. The vault enforces it, not the agent’s operator.",
    href: "https://a16zcrypto.com/posts/article/investing-in-catena-part-ii",
    sourceLabel: "a16zcrypto.com",
  },
  {
    who: "MetaDAO",
    role: "Docs, “Ownership coins”",
    date: "Read Nov 2026",
    topic: "Ownership coins",
    quote:
      "Most tokens don’t give you real ownership. The team controls the treasury, the IP, and a huge chunk of the supply. Token holders have no power.",
    answer: "The treasury sits in the vault, team tokens unlock on price, and a holder can leave at book value alone.",
    href: "https://docs.metadao.fi/benefits/ownership-coins",
    sourceLabel: "docs.metadao.fi",
  },
];
