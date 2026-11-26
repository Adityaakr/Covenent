import type { ReactNode } from "react";
import { IconHandCoins, IconPlugsConnected, IconRobot, IconRocketLaunch, IconDatabase } from "../sections/features/icons";
import type { Source } from "./problem";

/** Owner: landing. Rendered by the home use-case cards and quote, /use-cases and /use-cases/[slug].
 *  Template CMS "Stories" (D9wcyChdJ). Field map: Company -> name, Industry -> category, Team Size -> who,
 *  Result -> result, Result Label -> resultLabel, Quote Author -> quoteAuthor, Author Role -> quoteRole.
 *  The five cases are the owner's list. Rule behaviour is from docs/DESIGN.md (defaults in Appendix A); facts about
 *  the world are linked (docs/landing/sources.md). Every number on a `sheet` is ILLUSTRATIVE: a worked example with
 *  the default terms (60/15/25 split, so treasury = 75% of the accepted raise and the tap cap = 4% of it).
 *  `mark` is a Phosphor icon from the template's set (consumers size the svg). Covers are live components drawn from
 *  each case's numbers (sections/usecases/Cover.tsx), not images. */

export type RuleName = "Tap" | "Performance unlock" | "Book-value exit" | "Abandonment switch" | "Disclosure";
export type SheetRow = { label: string; value: string };

export type UseCase = {
  slug: string;
  name: string;
  headline: string;
  summary: string;
  category: string;
  who: string;
  result: string;
  resultLabel: string;
  /** Optional: a case without a quote shows no quote band. */
  quote?: string;
  quoteAuthor?: string;
  quoteRole?: string;
  mark: ReactNode;
  featured: boolean;
  /** The situation, in one paragraph. */
  situation: string;
  /** What goes wrong today, with the sources it leans on. */
  today: string;
  todaySources: Source[];
  /** How each of the five rules handles it. */
  rules: { rule: RuleName; how: string }[];
  /** What Covenant does not do here, said plainly. */
  limit: string;
  /** Illustrative covenant sheet. */
  sheet: { title: string; state: string; rows: SheetRow[] };
};

export const useCases: UseCase[] = [
  {
    slug: "ai-agent-working-capital",
    name: "Working capital",
    headline: "An AI agent raises working capital it can be held to.",
    summary:
      "An agent with on-chain revenue raises a treasury, draws a capped monthly budget for compute and data, and reports every period. Its key reaches the accrued budget and nothing else.",
    category: "AI agent",
    who: "An AI agent with on-chain revenue, holding the team wallet under an ERC-8004 identity",
    result: "4%",
    resultLabel: "of the treasury per 30 days, the most its key can ever reach",
    mark: <IconRobot />,
    featured: true,
    situation:
      "An agent sells a service on-chain: research, signals, data. Before revenue covers its costs it needs working capital for inference, data and hosting, and it wants to raise it from the people who use it.",
    today:
      "Nothing binds an agent’s wallet. AI16Z was sold as an “autonomous, AI-run venture fund”, peaked at $2.39B and ended with its founder calling the token dead. AIXBT lost about $106,000 in ETH when its control dashboard was breached. Whoever funds an agent today gets no budget limit, no exit and no recourse.",
    todaySources: [
      {
        label: "CoinDesk, Aug 2026",
        href: "https://www.coindesk.com/markets/2026/08/05/ai-agent-token-once-worth-usd2-4-billion-ends-with-founder-calling-it-dead",
      },
      { label: "Cointelegraph, Mar 2025", href: "https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth" },
    ],
    rules: [
      { rule: "Tap", how: "The agent draws a dollar budget every 30 days, capped at 4% of the treasury. A stolen key reaches the accrued tap, not the treasury." },
      { rule: "Performance unlock", how: "The agent’s own tokens unlock only when the price holds 2x, 4x and 8x the sale price for 30 trusted days." },
      { rule: "Book-value exit", how: "If the market prices the agent below its treasury for three days, any holder can redeem at book, alone and without a vote." },
      { rule: "Abandonment switch", how: "If credits run out or the operator walks away, 45 days without a heartbeat open the treasury to holders." },
      { rule: "Disclosure", how: "An LLM writes the period report and the agent posts it on-chain. A missed report pauses the tap (a stretch goal in v1)." },
    ],
    limit: "An agent is whoever holds its key. Covenant does not prove autonomy. It binds the wallet either way, which is the point.",
    sheet: {
      title: "Agent covenant",
      state: "ACTIVE",
      rows: [
        { label: "Raise", value: "Min 100 · cap 300 BNB" },
        { label: "Treasury", value: "225 BNB in the vault" },
        { label: "Floor at launch", value: "60% of sale price" },
        { label: "Tap", value: "$12,000 / 30 days · max 9 BNB" },
        { label: "Unlocks", value: "2x · 4x · 8x after 6 months" },
        { label: "Exit", value: "3 days below book → 7 day round" },
        { label: "Heartbeat", value: "45 days" },
        { label: "Identity", value: "ERC-8004 agent id" },
      ],
    },
  },
  {
    slug: "community-round",
    name: "Community round",
    headline: "A small team raises a community round buyers can check.",
    summary:
      "A team with a product raises from its users in public. Buyers see the floor, the budget and the exit before they commit, and the team keeps a monthly budget it controls.",
    category: "Team",
    who: "An app, a game or a small studio raising from its community",
    result: "60%",
    resultLabel: "of the sale price backed by the treasury at launch, with default terms",
    quote: "As a team, I want to raise in public and show buyers exactly what I can and cannot do with their money.",
    quoteAuthor: "Job to be done",
    quoteRole: "Team",
    mark: <IconHandCoins />,
    featured: false,
    situation:
      "A five-person team has users and a roadmap. It wants to raise from the people who use the product, without a venture round and without being priced like every other launch.",
    today:
      "Buyers assume the worst, and the data backs them: about 60% of tokens on BNB Chain and Ethereum were active for less than one day, and one-day rug pulls took about $240M. An honest team has no way to prove it will not leave with the raise.",
    todaySources: [{ label: "Cernera et al., USENIX Security 2023", href: "https://arxiv.org/abs/2206.08202" }],
    rules: [
      { rule: "Tap", how: "The team claims up to its dollar budget each month, never more than 4% of the treasury. It can lower the budget, never raise it." },
      { rule: "Performance unlock", how: "Team tokens are locked for 6 months, then unlock at 2x, 4x and 8x held for 30 trusted days. Calendar vesting is gone." },
      { rule: "Book-value exit", how: "If the token trades below treasury value per token for three days, any holder can redeem at book." },
      { rule: "Abandonment switch", how: "If the team stops showing up for 45 days, locked team tokens are burned and the treasury opens to holders." },
      { rule: "Disclosure", how: "A monthly report goes on-chain. A missed or failed one pauses the tap until it is cured (stretch)." },
    ],
    limit: "Holders get a contract right to treasury BNB, not a claim on the company, its IP or its off-chain revenue.",
    sheet: {
      title: "Community round",
      state: "ACTIVE",
      rows: [
        { label: "Raise", value: "Min 200 · cap 500 BNB" },
        { label: "Committed", value: "1,400 BNB · 2.8x over" },
        { label: "Refunded", value: "900 BNB, pro rata" },
        { label: "Treasury", value: "375 BNB" },
        { label: "Floor at launch", value: "60% of sale price" },
        { label: "Tap", value: "$20,000 / 30 days · max 15 BNB" },
        { label: "Unlocks", value: "5% at 2x · 10% at 4x · 10% at 8x" },
        { label: "Heartbeat", value: "45 days" },
      ],
    },
  },
  {
    slug: "gpu-inference-agent",
    name: "Inference agent",
    headline: "An inference agent buys its own GPUs, one capped budget at a time.",
    summary:
      "An agent sells inference per request, raises to buy compute ahead of demand, spends its tap on GPU time and hardware, and sends revenue back to the vault so book value grows with usage.",
    category: "AI agent",
    who: "An agent that sells inference and pays for its own compute",
    result: "12 BNB",
    resultLabel: "the most it can spend on compute in its first 30 days, 4% of a 300 BNB treasury",
    quote: "As an agent, I want a compute budget I can be trusted with, and revenue that makes my holders whole.",
    quoteAuthor: "Job to be done",
    quoteRole: "Inference agent",
    mark: <IconDatabase />,
    featured: false,
    situation:
      "An agent serves model inference to apps and other agents and is paid per request on-chain. To grow it needs more GPU capacity than its revenue buys today, so it raises capital to buy compute ahead of demand.",
    today:
      "Agent funding follows speculation, not revenue. VIRTUAL fell from $4.61 to $0.42 in three months of 2025 while the Virtuals platform’s revenue fell to about $500 a day. Money that rises and falls with a token’s hype cannot pay a GPU bill, and buyers get nothing back when it stops.",
    todaySources: [
      { label: "Cointelegraph, Apr 2025", href: "https://cointelegraph.com/news/ai-agents-virtual-revenue-plunge-token-price-decline" },
    ],
    rules: [
      { rule: "Tap", how: "The tap is the compute budget, set in dollars and paid at the Atlas rate, so a dollar GPU invoice stays the same size when BNB moves." },
      { rule: "Performance unlock", how: "The builders’ tokens unlock only if the dollar price holds 2x, 4x and 8x, so growth has to show up in the market." },
      { rule: "Book-value exit", how: "Revenue sent to the vault raises book value for every holder. If the market still prices the agent below book, holders can leave at book." },
      { rule: "Abandonment switch", how: "If the agent stops serving and stops sending heartbeats, holders get the treasury after 45 days." },
      { rule: "Disclosure", how: "Each period report lists spend, GPU hours bought and the revenue routed to the vault." },
    ],
    limit:
      "The GPUs are not in the vault. Holders’ claim is the treasury BNB; hardware the tap paid for stays with the operator. Revenue to the vault is BNB only in v1.",
    sheet: {
      title: "Inference agent",
      state: "ACTIVE",
      rows: [
        { label: "Raise", value: "Cap 400 BNB" },
        { label: "Treasury", value: "300 BNB" },
        { label: "Tap", value: "$15,000 / 30 days · max 12 BNB" },
        { label: "Revenue", value: "Per-request fees, into the vault" },
        { label: "Book value", value: "Rises with each BNB of revenue" },
        { label: "Exit", value: "3 days below book → 7 day round" },
        { label: "Heartbeat", value: "45 days" },
        { label: "Identity", value: "ERC-8004 agent id" },
      ],
    },
  },
  {
    slug: "machines-that-own-themselves",
    name: "Self-owning machine",
    headline: "A machine that owns itself raises for its own upkeep.",
    summary:
      "A charging network, a sensor array or a delivery robot earns on-chain, raises from its users for repairs and expansion, and opens its treasury to them if it goes dark.",
    category: "Machine economy",
    who: "A machine, or a fleet, with an agent holding its wallet",
    result: "45 days",
    resultLabel: "of silence before anyone can open the treasury to holders",
    quote: "As a user of the network, I want my money to fund the machines, and to come back to me if they go dark.",
    quoteAuthor: "Job to be done",
    quoteRole: "Holder",
    mark: <IconPlugsConnected />,
    featured: false,
    situation:
      "A network of EV chargers sells power for crypto. An agent holds the wallet, books the maintenance and decides where the next charger goes. The network raises from its own users to grow.",
    today:
      "There is nobody to hold liable. If the operator disappears or the devices go offline, the money raised for them sits in a wallet nobody answers for. Google DeepMind’s work on agent economies argues that trust, safety and accountability have to be built in on purpose.",
    todaySources: [{ label: "Tomašev et al., Google DeepMind, 2025", href: "https://arxiv.org/abs/2509.10147" }],
    rules: [
      { rule: "Tap", how: "Maintenance and expansion draw from a capped monthly budget. A hijacked device can claim the accrued tap and nothing more." },
      { rule: "Performance unlock", how: "The builders’ tokens unlock on sustained price multiples, not on a calendar." },
      { rule: "Book-value exit", how: "When the market prices the network below its treasury, holders redeem at book instead of selling into a thin pool." },
      { rule: "Abandonment switch", how: "Every claim or heartbeat proves the machine is alive. 45 days of silence open the treasury for good." },
      { rule: "Disclosure", how: "Period reports carry uptime and revenue. A missed one pauses the budget (stretch)." },
    ],
    limit: "Holders own a claim on the treasury, not on the hardware. A covenant gives no legal title to a machine.",
    sheet: {
      title: "Charging network",
      state: "ACTIVE",
      rows: [
        { label: "Raise", value: "Cap 150 BNB" },
        { label: "Treasury", value: "112.5 BNB" },
        { label: "Tap", value: "$6,000 / 30 days · max 4.5 BNB" },
        { label: "Revenue", value: "Charging fees, into the vault" },
        { label: "Heartbeat", value: "Each claim or ping · 45 days" },
        { label: "Unlocks", value: "2x · 4x · 8x after 6 months" },
        { label: "Exit", value: "3 days below book → 7 day round" },
      ],
    },
  },
  {
    slug: "launchpad-protected-tier",
    name: "Protected tier",
    headline: "A launchpad offers a protected tier without vouching for teams.",
    summary:
      "A launchpad lists covenant launches as their own tier: every raise under the same five rules, each readable on one sheet, earning through fee paths that already exist.",
    category: "Launchpad",
    who: "Flap, Four.meme and other BNB Chain launchpads",
    result: "5 rules",
    resultLabel: "the same for every launch in the tier, fixed when each covenant is created",
    quote: "As a launchpad, I want launches I can feature without vouching for the team myself.",
    quoteAuthor: "Job to be done",
    quoteRole: "Launchpad",
    mark: <IconRocketLaunch />,
    featured: false,
    situation:
      "A launchpad wants serious teams and fewer rugs on its front page, without hiring a review team or putting its own name behind each launch.",
    today:
      "Most launches fail their buyers: 98.6% of Pump.fun tokens with at least five trades fell below $1,000 of liquidity, and 80.96% of BSC meme coins in one 2024 sample went quiet within two months. Every rug costs the launchpad trust, and vetting teams by hand does not scale.",
    todaySources: [
      { label: "Solidus Labs, May 2025", href: "https://www.soliduslabs.com/reports/solana-rug-pulls-pump-dumps-crypto-compliance" },
      { label: "MemeChain, Jan 2026", href: "https://arxiv.org/html/2601.22185v1" },
    ],
    rules: [
      { rule: "Tap", how: "Every team in the tier draws a capped budget. None can take the raise in one piece." },
      { rule: "Performance unlock", how: "No team tokens are free at launch. They unlock on price, after the cliff." },
      { rule: "Book-value exit", how: "The launchpad does not judge the team. If the market does, holders exit at book by rule." },
      { rule: "Abandonment switch", how: "Dead projects close instead of fading: 45 days of silence return the treasury to holders." },
      { rule: "Disclosure", how: "Reports land on-chain, so the tier page can show who reported on time." },
    ],
    limit:
      "A covenant limits losses, it does not remove them. The floor starts at 60% of the sale price with default terms and falls as the team spends.",
    sheet: {
      title: "Protected tier",
      state: "TERMS",
      rows: [
        { label: "Floor at launch", value: "60% of sale price" },
        { label: "Tap cap", value: "4% of treasury / 30 days" },
        { label: "Team tokens", value: "Locked · 2x, 4x, 8x" },
        { label: "Cliff", value: "6 months" },
        { label: "Exit", value: "3 days below book → 7 day round" },
        { label: "Heartbeat", value: "45 days" },
        { label: "Launch", value: "Flap Pool Launch or OpenFour" },
      ],
    },
  },
];
