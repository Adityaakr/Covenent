/**
 * "The problem today" on the home page. Every number was checked against its primary source on 26 Nov 2026,
 * and the wording follows what the source measures. Full citations: docs/landing/sources.md.
 */
export type Source = { label: string; href: string };
export type ProblemStat = { value: string; label: string; source: Source };
export type ProblemGroup = { id: string; title: string; note: string; stats: ProblemStat[] };

export const problemGroups: ProblemGroup[] = [
  {
    id: "raises",
    title: "Token raises",
    note: "Buyers hand over money at launch and get no enforceable claim on it afterwards.",
    stats: [
      {
        value: "98.6%",
        label: "of Pump.fun tokens with at least five trades fell below $1,000 of liquidity, Jan 2024 to Mar 2025",
        source: {
          label: "Solidus Labs, May 2025",
          href: "https://www.soliduslabs.com/reports/solana-rug-pulls-pump-dumps-crypto-compliance",
        },
      },
      {
        value: "~60%",
        label: "of tokens on BNB Chain and Ethereum were active for less than one day. One-day rug pulls took about $240M",
        source: { label: "Cernera et al., USENIX 2023", href: "https://arxiv.org/abs/2206.08202" },
      },
      {
        value: "80.96%",
        label: "of BSC meme coins in an October 2024 sample had no transactions two months later",
        source: { label: "MemeChain, arXiv, Jan 2026", href: "https://arxiv.org/html/2601.22185v1" },
      },
      {
        value: "53.2%",
        label: "of all tokens tracked on GeckoTerminal since 2021 have failed, 11.6 million of them in 2025 alone",
        source: {
          label: "CoinGecko Research, Jan 2026",
          href: "https://www.coingecko.com/research/publications/how-many-cryptocurrencies-failed",
        },
      },
    ],
  },
  {
    id: "agents",
    title: "Agents holding money",
    note: "An agent cannot be sued, can be hijacked and can simply stop. Today nothing binds the wallet.",
    stats: [
      {
        value: "$2.39B",
        label: "peak value of AI16Z, sold as an “autonomous, AI-run venture fund”. Down 97%, its founder called it dead",
        source: {
          label: "CoinDesk, Aug 2026",
          href: "https://www.coindesk.com/markets/2026/08/05/ai-agent-token-once-worth-usd2-4-billion-ends-with-founder-calling-it-dead",
        },
      },
      {
        value: "$106K",
        label: "in ETH (55.5) sent from the AIXBT agent’s wallet by two prompts, after its control dashboard was breached",
        source: {
          label: "Cointelegraph, Mar 2025",
          href: "https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth",
        },
      },
      {
        value: "−91%",
        label: "VIRTUAL, the token of the Virtuals agent launch platform, from $4.61 to $0.42 between Jan 2 and Apr 7, 2025",
        source: {
          label: "Cointelegraph, Apr 2025",
          href: "https://cointelegraph.com/news/ai-agents-virtual-revenue-plunge-token-price-decline",
        },
      },
      {
        value: "$47,316",
        label: "prize pool an AI agent paid out in a public challenge after 482 attempts to talk it into a transfer",
        source: {
          label: "The Block, Nov 2024",
          href: "https://www.theblock.co/post/328747/human-player-outwits-freysa-ai-agent-in-47000-crypto-challenge",
        },
      },
    ],
  },
];

/** The demand side, said once under the grid: buyers do want raises with terms. */
export const problemDemand: ProblemStat = {
  value: "$580M",
  label:
    "was committed to MetaDAO’s capped raises over 14 launches, and $535M (92.2%) had to be refunded above the caps. Where a raise came with a treasury and fixed terms, buyers offered about thirteen times what it could take.",
  source: { label: "Basis Point, Aug 2026", href: "https://basispointres.substack.com/p/metadao-ownership-coins" },
};
