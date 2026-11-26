import type { ReactNode } from "react";
import { Mark } from "../sections/usecases/marks";
/** Owner: use-cases agent. Also rendered by the home use-case cards and quote.
 *  Template CMS "Stories" (D9wcyChdJ), same order. Field map: Company -> name, Industry -> category,
 *  Team Size -> who, Result -> result, Result Label -> resultLabel, Quote Author -> quoteAuthor,
 *  Author Role -> quoteRole, Story -> body. Every fact is from docs/DESIGN.md (see docs/landing/content/use-cases.md).
 *  `mark` is an 18px stroke icon (svg); resize it with CSS on the svg. `cover` is a 1600px wide photo. */
export type UseCase = {
  slug: string; name: string; headline: string; summary: string; category: string; who: string;
  result: string; resultLabel: string; quote: string; quoteAuthor: string; quoteRole: string;
  cover: string; mark: ReactNode; featured: boolean; body: { h2?: string; p?: string }[];
};

export const useCases: UseCase[] = [
  {
    slug: "agent-issuer",
    name: "Agent issuer",
    headline: "An AI agent raises a budget it can be held to.",
    summary:
      "The issuer agent holds the team wallet, claims its tap as a compute budget and reports every period. Its key reaches its accrued budget and nothing else.",
    category: "AI agent",
    who: "An AI agent holding the team wallet",
    result: "4%",
    resultLabel: "of the treasury per 30 days, the most its tap can reach",
    quote:
      "ClawPump lets an agent launch a token. Covenant lets an agent raise a budget it can be held to.",
    quoteAuthor: "Pitch line",
    quoteRole: "Agent layer",
    cover: "/landing/usecases/cover-1.jpg",
    mark: <Mark kind="circle" />,
    featured: true,
    body: [
      { h2: "Why an agent needs a covenant" },
      {
        p: "An agent cannot be sued, can be hijacked and can simply stop. The vault that binds a human team binds an AI agent the same way, and an agent needs it more.",
      },
      {
        p: "If the agent's key leaks, the attacker reaches the accrued tap, at most 4% of the treasury a month. The treasury stays in the vault.",
      },
      { h2: "What the agent does" },
      {
        p: "Every few minutes it reads the vault's status. It claims its tap when enough has accrued, which also counts as a heartbeat, and sends a heartbeat when it has not.",
      },
      {
        p: "When the price comes close to book value it can lower its own tap, a pay cut that protects the floor. Revenue it earns goes to the vault and raises book value for every holder. At the end of each period an LLM writes the report and the agent posts it.",
      },
      {
        p: "The LLM never decides a rule. It writes the report and explains the budget choices. The rules stay in the vault, which is the point.",
      },
    ],
  },
  {
    slug: "human-team",
    name: "Human team",
    headline: "A team shows buyers what it can and cannot do.",
    summary:
      "A commitment the team opts into at launch and buyers can verify on-chain, while it keeps a monthly budget it controls.",
    category: "Team",
    who: "An app, a game or a company testing tokenized shares",
    result: "60%",
    resultLabel: "of the sale price backed by the treasury at launch, with default terms",
    quote: "As a team, I want to raise in public and show buyers exactly what I can and cannot do with their money.",
    quoteAuthor: "Job to be done",
    quoteRole: "Team",
    cover: "/landing/usecases/cover-2.jpg",
    mark: <Mark kind="triangle" />,
    featured: false,
    body: [
      { h2: "Priced like every other launch" },
      {
        p: "A team raising money has no way to prove it will not run with the raise, so it is priced like every other launch. Covenant gives it a commitment it can opt into at launch and buyers can verify on-chain.",
      },
      { h2: "What the rules hold" },
      {
        p: "Buyers commit during the sale window. Above the cap, each commitment is scaled down pro rata and the excess is refunded. Below the minimum, everyone refunds in full.",
      },
      {
        p: "The team draws a dollar tap capped at 4% of the treasury per 30 days. Its own tokens unlock only when the price holds 2x, 4x and 8x the sale price for 30 trusted days, after a 6 month cliff. Nothing can be edited later except lowering the tap.",
      },
    ],
  },
  {
    slug: "launchpad",
    name: "Launchpad",
    headline: "A launchpad features launches without vouching for the team.",
    summary:
      "Rugs are a reputational cost and keep serious teams away. A covenant is a launch type that attracts real projects, plus template fees.",
    category: "Launchpad",
    who: "Flap, Four.meme and BNB Chain",
    result: "3 days",
    resultLabel: "trusted, below book value, before an exit round opens",
    quote: "As a launchpad, I want launches I can feature without vouching for the team myself.",
    quoteAuthor: "Job to be done",
    quoteRole: "Launchpad",
    cover: "/landing/usecases/cover-3.jpg",
    mark: <Mark kind="hexagon" />,
    featured: false,
    body: [
      { h2: "Inside the launchpads people already use" },
      {
        p: "A covenant is a Flap launcher and vault pair, plus an OpenFour template. There is no new venue to bootstrap.",
      },
      { h2: "The exit needs no vote" },
      {
        p: "If the token trades below book value for 3 trusted days, a 7 day round opens and any holder can burn tokens for a pro rata share of the treasury. The launchpad does not have to judge the team. The rule does.",
      },
      {
        p: "To open a round, the price must sit below book for three days. Anyone pushing it there is selling tokens for less than the treasury will pay for them.",
      },
    ],
  },
  {
    slug: "investor-agent",
    name: "Investor agent",
    headline: "An investor agent prices the downside before it commits.",
    summary:
      "It reads terms, computes the downside, commits, claims and redeems when a round opens, through the Covenant MCP server.",
    category: "AI agent",
    who: "Any MCP client, through the Covenant MCP server",
    result: "7 days",
    resultLabel: "of exit round, open to any holder at book value",
    quote: "As a contributor, I want to know the worst case before I commit: what I get back if the project fails.",
    quoteAuthor: "Job to be done",
    quoteRole: "Contributor",
    cover: "/landing/usecases/cover-4.jpg",
    mark: <Mark kind="sun" />,
    featured: false,
    body: [
      { h2: "A meme gives a program nothing to compute" },
      {
        p: "A launch with no terms gives an investor agent nothing to work with. A covenant puts the terms and book value on-chain, so the downside is a number before committing.",
      },
      { h2: "Tools any assistant can call" },
      {
        p: "The Covenant MCP server lists covenants with their book value and pool price, returns the full terms, and reports what a position redeems for at book today. Writes return an unsigned transaction, so the user's own wallet signs.",
      },
      {
        p: "When a round opens, the agent can exit by itself. It never controls the money rules.",
      },
    ],
  },
  {
    slug: "keeper-agent",
    name: "Keeper agent",
    headline: "A keeper agent keeps the rules moving, hour by hour.",
    summary:
      "It pokes hourly to record prices, dispatches tax, declares abandonment when due and buys market data per request.",
    category: "AI agent",
    who: "Anyone who calls poke(), a person or a program",
    result: "45 days",
    resultLabel: "of team silence before anyone can open the treasury",
    quote:
      "As a holder, I want to leave at a fair value when the market has given up, without waiting for anyone's approval.",
    quoteAuthor: "Job to be done",
    quoteRole: "Holder",
    cover: "/landing/usecases/cover-5.jpg",
    mark: <Mark kind="diamond" />,
    featured: false,
    body: [
      { h2: "Every transition is a public call" },
      {
        p: "A keeper, or anyone, calls poke() about once an hour to record prices. Each observation feeds the exit streak and the unlock counters, and only trusted time counts.",
      },
      { h2: "The abandonment switch" },
      {
        p: "Any team action is a heartbeat. If the team is silent for 45 days, anyone can call declareAbandoned(). The tap ends, locked team tokens are burned and redemption stays open with no fee.",
      },
    ],
  },
  {
    slug: "four-meme-creator",
    name: "Four.meme creator",
    headline: "A Four.meme founder puts their tax share under a covenant.",
    summary:
      "A tax vault template brings the tap and the abandonment switch to any Four.meme tax token, without changing how the founder launches.",
    category: "Tax vault template",
    who: "A founder launching a Four.meme tax token",
    result: "~6%",
    resultLabel: "of each tax receipt, the OpenFour template royalty",
    quote:
      "Tokens are sold to the public with none of the protections investors get elsewhere, and Covenant writes the core ones into the launch itself.",
    quoteAuthor: "Pitch line",
    quoteRole: "Covenant",
    cover: "/landing/usecases/cover-6.jpg",
    mark: <Mark kind="tree" />,
    featured: false,
    body: [
      { h2: "The founder's tax, in a vault" },
      {
        p: "With CovenantLiteVault, the founder's share of trading tax lands in the vault instead of the founder's wallet. The founder can withdraw at most a set share of the balance per period, and each withdrawal is a heartbeat.",
      },
      {
        p: "If the founder is silent past the heartbeat window, or winds down, the balance becomes redeemable. Holders burn tokens for a pro rata share.",
      },
      { h2: "How it plugs in" },
      {
        p: "The template uses OpenFour's Unverified Royalty path. Four.meme's create page builds the form from the template's schema: tap share, tap period, heartbeat and redeem fee. Template and init params cannot be changed after create.",
      },
    ],
  },
];
