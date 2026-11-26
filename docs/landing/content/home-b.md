# Home, part B: final copy and sources

Every number comes from `docs/DESIGN.md`. Section names are the Framer section names.

## Stats -> The problem today (HomeProblem)

Rebuilt as "The problem today": two stat rows and a demand row, each figure linked to its source. Copy in
`content/home-v2.md`, citations in `docs/landing/sources.md`.

## Weekly Update -> agent layer (HomeAgentLayer)

- Eyebrow: Agent layer
- Heading: "Raise a budget your agent can be held to." / "The vault binds an AI issuer the way it binds a human team."
  (DESIGN.md "Agent layer": "The vault that binds a human team binds an AI agent the same way".)
- Points ("Three agent roles", "Why an agent needs a covenant", "Issuer agent loop", "Covenant MCP server"):
  - Claims a tap, not the treasury: "The agent’s key reaches its accrued budget and nothing else."
  - Reports every period: "An LLM writes the report. The rules stay in the vault."
  - Read by other agents: "An MCP server lets investor agents price the downside and exit."
- Message card: sender "Issuer agent · ERC-8004" (ERC-8004 identity, "Three agent roles"); time "Every few minutes"
  ("Issuer agent loop"); title "Period report: tap claimed, heartbeat sent".
  - Tap: "Claimed the accrued tap at the Atlas rate, capped at 4% per 30 days." (Rule 1, demo script 0:50)
  - Heartbeat: "The claim counts as a heartbeat, so the abandonment switch stays shut." ("claimTap() # also a heartbeat", Rule 4)
  - Revenue: "Earned revenue goes to the vault and raises book value for every holder." ("Issuer agent loop")
  - Reactions: `claimTap()`, `heartbeat()`, `postReport()` (issuer write tools / loop calls).

## Stories -> use cases (HomeUseCases)

- Eyebrow: Use cases. Heading: "One vault for every issuer." / "AI agents, teams, machines and launchpads raise under the same five rules."
  (DESIGN.md "Who it is for", "Agent layer".) Link: "All use cases" -> `/use-cases`.
- Cards: first three items of `content/useCases.tsx` (owned by the use-cases agent; sources in its content doc).

## Quote (HomeQuote)

- The featured item of `content/useCases.tsx`: its `quote`, `quoteAuthor` · `quoteRole`, `name`.

## Pricing Preview -> fees (HomePricing)

- Eyebrow: Fees. Heading: "Free to raise. Free to buy." / "We earn from fee paths that already exist."
  (DESIGN.md "Business model and roadmap": "It adds no new fee for buyers or teams in v1"; revenue lines use fee paths
  "that already exist in the sponsors' contracts".)
- Cards: `content/plans.ts` (owned by the pricing agent; sources in its content doc). Badge text = plan `badge`.

## FAQ (HomeFAQ, content/faqs.ts)

- Eyebrow: Questions. Heading: "Hard questions, plain answers." Body: "Can’t find yours? Read the rules or ask the team."
  Button: "Contact us" -> `/contact`.
- Items (DESIGN.md "Demo script and pitch" > "Hard questions", answers shortened):
  1. Is this MetaDAO on BNB Chain? Same promise, different engine; a fixed rule instead of a market; an exit for one
     holder instead of a vote for all; lives inside launchpads people already use.
  2. Why would a team accept these limits? Protected raises drew about thirteen times the capital they could take;
     limits make the raise credible; upside through price tranches.
  3. What stops the team draining the treasury? Tap capped at 4% of the treasury per 30 days, cannot be raised.
  4. What is the floor really worth? 60% of the sale price at launch with default terms; falls with spending, rises with tax.
  5. Can a whale trigger an exit to hurt the team? Selling below treasury value for three trusted days costs them; the tap
     pause is bounded by the round and cooldown (Rule 3: three trusted days).
  6. What if Atlas is wrong or down? The exit compares two on-chain numbers (pool price, treasury per token) and works
     with no oracle; dollar rules freeze, then fall back in holders’ favor ("What the oracle does and does not decide",
     content-plan exit rule wording).

## Changelog Preview -> milestones (HomeMilestones)

- Eyebrow: Milestones. Heading: "Built in public, gate by gate." / "From the design document to Demo Night."
  (DESIGN.md "Build plan for the 36 hours".) Link: "See every milestone" -> `/changelog`.
- Entries: `content/milestones.ts` sorted by date descending, first four (owned by the changelog agent).

## Closing CTA (HomeClosingCTA)

- Heading: "Raise under rules. Exit at book." Body: "Covenant runs on Flap Pool Launch on BNB Chain. No fees for buyers or
  teams in v1." (content-plan "Closing CTA"; DESIGN.md "Summary", "Business model".)
- Buttons: Secondary "Read the rules" -> `/features`, Primary "Launch app" -> `/app`.
