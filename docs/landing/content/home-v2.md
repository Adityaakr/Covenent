# Home and use cases, v2: what changed and where the copy comes from

The second pass on the landing, after the owner's brief. New sections reuse the template's own patterns, named below.
Every outside fact is cited in `docs/landing/sources.md`; rule behaviour comes from `docs/DESIGN.md` and, for the exit,
from `contracts/src/vault/CovenantVault.sol`.

## Home order

Hero, The problem today, Who named this problem, Features (the five rules), Lifecycle, Agent layer, Use cases, Quote,
Prior art (compare), Fees, FAQ, Milestones, Closing CTA.

## Hero

- Heading "The operating stack for autonomous ventures." Subheading "Capital, budgets and exits for businesses run by
  AI agents. Enforced by code, not courts. 24/7 on BNB Chain." (the owner's words, verbatim; also the home metadata
  and Open Graph in `web/src/landing/meta.ts`).
- Built-on ticker: Flap, Atlas, CoinMarketCap, PancakeSwap, Four.meme, ERC-8004, Cournot, BNB Chain, each with its
  own mark, monochrome, 20px optical height (`web/public/landing/logos/SOURCES.md`).

## The problem today (from the template's "Stats")

Eyebrow "The problem today". H2 "Money raised in public has no rules after launch." / "Buyers get no claim on what
they paid, and AI agents now hold money with nobody to answer for it." Two stat rows in the Stats cell pattern, each
under a group head (the Compare group row), every cell with a linked source:

- Token raises: 98.6% (Solidus Labs), ~60% (Cernera et al.), 80.96% (MemeChain), 53.2% (CoinGecko).
- Agents holding money: $2.39B AI16Z (CoinDesk), $106K AIXBT (Cointelegraph), −91% VIRTUAL (Cointelegraph), $47,316
  Freysa, labelled as a public challenge (The Block).
- Demand row: $580M committed to MetaDAO's capped raises, $535M (92.2%) refunded above the caps, about 13x (Basis
  Point). This replaces the old "committed to protected raises, 92.2% of it refunded", which misread the refunds.

## Who named this problem (the template's Quote Wall)

Eyebrow "Who named this problem". H2 "The gap has been on the record for years." / "Researchers, investors and BNB
Chain itself have described it." Nine cards: exact quote (or a labelled paraphrase), name, role, date, "Covenant's
answer" in our words, and the source link. Buterin (DAICO, 2018), Buterin ($100 a day before human confirmation,
2026), BNB Chain (21 May 2026), Google DeepMind (Tomašev et al., 2025), Sean Neville in a16z crypto (2025), Dixon and
Harkavy at a16z crypto (2026), Howell, Niessner and Yermack (NBER w24774), MetaDAO docs, Lee, Shleifer and Thaler
(1991, paraphrase).

## Lifecycle (the /features Capabilities grid)

Eyebrow "Lifecycle". H2 "From raise to exit, every step is a public call." / "Anyone can trigger the next
transition. Nobody can skip one." Six Feature Cards: Create, Raise, Settle and launch, Operate, Exit round, Unlock or
wind down (DESIGN.md "Lifecycle"; the exit card states the decaying streak).

## Prior art (the /pricing Compare table)

Same table as /pricing (`sections/pricing/compareData.ts`), with the heading "Same promise, different engine." /
"Compared with MetaDAO, the DAICO and launchpads, weak spots included." and a note naming the limit (the floor
starts at 60% of the sale price and falls as the team spends) with its sources.

## FAQ additions (`content/faqs.ts`)

"Can a team pump the price to hold the exit off?" (no: the streak decays hour for hour), "Why not let holders redeem at
any time?", "What if an agent's key leaks?", "Does the agent have to be autonomous?", "What does Covenant not
protect?", "Is this token a security?" (DESIGN.md "Hard questions", "Hard questions on the agent layer", "Where
Covenant is weaker").

## Use cases (`content/useCases.tsx`)

The owner's five, in order: `ai-agent-working-capital` (An AI agent raising working capital), `community-round` (A
small team raising a community round), `gpu-inference-agent` (An inference agent that buys its own GPUs),
`machines-that-own-themselves` (Machines that own themselves), `launchpad-protected-tier` (A launchpad's protected
tier). Each has the situation, what goes wrong today (linked), how each of the five rules handles it, the limit, and
an illustrative covenant sheet labelled "Illustrative numbers, default terms. Not a live covenant."

/use-cases keeps the template's hero, featured story, stats and story grid, then adds one block per case (two
columns: text and the sheet card). /use-cases/[slug] renders the same fields in the story body.
