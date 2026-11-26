/**
 * "The problem today" on the home page, told as two four-step stories. Every number was checked against its primary
 * source on 26 Nov 2026, and the wording follows what the source measures. Full citations: docs/landing/sources.md.
 * The chart under each story is illustrative: it shows the order of events, not a price or liquidity series.
 */
export type Source = { label: string; href: string };
/** `stage` names the step of the story the number stands for (the chart's marker label). */
export type ProblemStat = { value: string; label: string; source: Source; stage?: string };
/** `curve`: the illustrative chart as [x, y] points, both 0..1 (y 1 = top); `axis` labels its four columns. */
export type ProblemGroup = {
  id: string;
  title: string;
  note: string;
  axis: string[];
  curve: [number, number][];
  stats: ProblemStat[];
};

export const problemGroups: ProblemGroup[] = [
  {
    id: "raises",
    title: "Token raises",
    note: "Buyers hand over money at launch and get no enforceable claim on it afterwards.",
    axis: ["Day 1", "Weeks", "Month 2", "Years"],
    curve: [
      [0, 0.06], [0.04, 0.5], [0.075, 0.92], [0.1, 0.74], [0.125, 0.52], [0.2, 0.34], [0.3, 0.22], [0.375, 0.15],
      [0.5, 0.1], [0.625, 0.07], [0.75, 0.05], [0.875, 0.04], [1, 0.035],
    ],
    stats: [
      {
        value: "~60%",
        stage: "Launch",
        label: "of tokens on BNB Chain and Ethereum were active for less than one day. One-day rug pulls took about $240M",
        source: { label: "Cernera et al., USENIX 2023", href: "https://arxiv.org/abs/2206.08202" },
      },
      {
        value: "98.6%",
        stage: "Liquidity drains",
        label: "of Pump.fun tokens with at least five trades fell below $1,000 of liquidity, Jan 2024 to Mar 2025",
        source: {
          label: "Solidus Labs, May 2025",
          href: "https://www.soliduslabs.com/reports/solana-rug-pulls-pump-dumps-crypto-compliance",
        },
      },
      {
        value: "80.96%",
        stage: "Team goes quiet",
        label: "of BSC meme coins in an October 2024 sample had no transactions two months later",
        source: { label: "MemeChain, arXiv, Jan 2026", href: "https://arxiv.org/html/2601.22185v1" },
      },
      {
        value: "53.2%",
        stage: "Holders stuck",
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
    axis: ["Hype", "Breach", "Manipulation", "Collapse"],
    curve: [
      [0, 0.12], [0.06, 0.4], [0.1, 0.78], [0.125, 0.9], [0.16, 0.86], [0.26, 0.7], [0.375, 0.58], [0.45, 0.5],
      [0.55, 0.42], [0.625, 0.36], [0.72, 0.24], [0.8, 0.12], [0.875, 0.07], [1, 0.05],
    ],
    stats: [
      {
        value: "$2.39B",
        stage: "Raised on hype",
        label: "peak value of AI16Z, sold as an “autonomous, AI-run venture fund”. Down 97%, its founder called it dead",
        source: {
          label: "CoinDesk, Aug 2026",
          href: "https://www.coindesk.com/markets/2026/08/05/ai-agent-token-once-worth-usd2-4-billion-ends-with-founder-calling-it-dead",
        },
      },
      {
        value: "$106K",
        stage: "Key hijacked",
        label: "in ETH (55.5) sent from the AIXBT agent’s wallet by two prompts, after its control dashboard was breached",
        source: {
          label: "Cointelegraph, Mar 2025",
          href: "https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth",
        },
      },
      {
        value: "$47,316",
        stage: "Agent talked round",
        label: "prize pool an AI agent paid out in a public challenge after 482 attempts to talk it into a transfer",
        source: {
          label: "The Block, Nov 2024",
          href: "https://www.theblock.co/post/328747/human-player-outwits-freysa-ai-agent-in-47000-crypto-challenge",
        },
      },
      {
        value: "−91%",
        stage: "Token collapses",
        label: "VIRTUAL, the token of the Virtuals agent launch platform, from $4.61 to $0.42 between Jan 2 and Apr 7, 2025",
        source: {
          label: "Cointelegraph, Apr 2025",
          href: "https://cointelegraph.com/news/ai-agents-virtual-revenue-plunge-token-price-decline",
        },
      },
    ],
  },
];

/** The demand side, said once under the stories: buyers do want raises with terms. */
export const problemDemand: ProblemStat = {
  value: "$580M",
  label:
    "was committed to MetaDAO’s capped raises over 14 launches, and $535M (92.2%) had to be refunded above the caps. Where a raise came with a treasury and fixed terms, buyers offered about thirteen times what it could take.",
  source: { label: "Basis Point, Aug 2026", href: "https://basispointres.substack.com/p/metadao-ownership-coins" },
};
