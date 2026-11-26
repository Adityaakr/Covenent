# Covenant landing: final copy and sources

> **v2 (26 Nov 2026):** `content/home-v2.md` describes the current home and use-case pages and overrides this file where
> they differ. The /pricing and /changelog copy, and the home fees, FAQ and milestones sections, below are retired.


Every section's final copy on the code rebuild of the Framer template, with the `docs/DESIGN.md` section behind each fact.
The per-page source files are in `docs/landing/content/`; this file concatenates them in site order.
No customer, testimonial or number here is invented: quotes are DESIGN.md lines attributed to a role, and every number is a DESIGN.md figure or a term of the default covenant.
The simulator headline is left out until it is computed (DESIGN.md: "The simulator number does not exist yet").


## Global copy (navigation, footer, page CTA default)

Owner: foundation agent. Code: `web/src/landing/components/siteLinks.ts`, `Navigation.tsx`, `Footer.tsx`.
Plan: `docs/landing/spec/content-plan.md` "Global". No numbers appear in global copy.

### Navigation

| Slot (template) | Covenant | Link | Source |
| --- | --- | --- | --- |
| Logo wordmark "Ondrel" | Covenant | `/` | DESIGN.md title "Covenant: investor protections that enforce themselves" |
| Product | Rules | `/features` | content plan |
| Pricing | Fees | `/pricing` | content plan |
| Customers | Use cases | `/use-cases` | content plan |
| Changelog | Milestones | `/changelog` | content plan |
| Contact | Contact | `/contact` | content plan |
| Sign in (text link) | Connect wallet | `/app` | content plan |
| Start for free (Primary button) | Launch app | `/app` | content plan |

Phone drawer repeats the five links (Text/H3) and the two buttons: Secondary "Connect wallet", Primary "Launch app".

### Footer

- Tagline: "Investor protections that enforce themselves. A launcher and vault for token raises on BNB Chain."
  Source: DESIGN.md title line and Summary ("Covenant is a launcher and vault for token raises on BNB Chain ...").
- Status pill: "Testnet build · BNB Hack Bangkok". Source: DESIGN.md "What ships at BNB Hack Bangkok" ("on BNB testnet ...").
- Columns:
  - Product: Rules `/features`, Fees `/pricing`, Milestones `/changelog`.
  - Company: Use cases `/use-cases`, Contact `/contact`, Launch app `/app`.
  - Built on: Flap https://flap.sh, CoinMarketCap https://coinmarketcap.com, Four.meme https://four.meme (open in a new tab).
    Source: DESIGN.md Summary table "Built on" (Flap Pool Launch, OpenFour on Four.meme, CoinMarketCap data).
- Big wordmark: "Covenant".
- Copyright: "© 2026 Covenant. Built at BNB Hack Bangkok." Source: DESIGN.md "What ships at BNB Hack Bangkok".
- Right note: "Made for raises that keep their word".

### Page CTA default (page agents pass these props)

- Heading "Raise under rules. Exit at book." Body "Five rules hold the treasury. Nobody has to trust the team."
  Source: DESIGN.md Summary ("Five rules, enforced by contract ... replace the trust a buyer normally has to extend").
- Secondary "Read the rules" `/features`, Primary "Launch app" `/app`.

## Home copy, part A: Hero and Features

Every fact below points at its source in `docs/DESIGN.md`. Layout follows `docs/landing/content-plan.md` "Home".
Section headings in DESIGN.md are quoted as "Heading".

### Hero

| Element | Copy | Source |
| --- | --- | --- |
| Chip | Agents | "Agent layer" |
| Announcement (Desktop, Tablet) | Now with an agent layer: issuer, investor and keeper agents | "Three agent roles" |
| Announcement (Phone) | Now with an agent layer | same |
| Heading | The operating stack for autonomous ventures. | The owner's headline (see `content/home-v2.md`) |
| Subheading | Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain. | The owner's subline |
| Buttons | Read the rules (`/features`), Launch app (`/app`) | content plan |
| Note | No fees in v1 · Built on Flap Pool Launch | "Business model and roadmap" (no raise fee in v1); "Summary" (Built on) |

#### App window (the covenant sheet)

| Element | Copy | Source |
| --- | --- | --- |
| Address bar | covenant.app / AGENT covenant | content plan |
| Workspace | Covenant | brand |
| Nav | Covenants, Raise, Sheet (current), Redeem, Agent, Trust | "Screens", "The covenant sheet" |
| Group | Your covenants: Agent issuer, Human team, Launchpad | "Who it is for", "Three agent roles" |
| Header | Covenant sheet, chip ACTIVE | "States" (ACTIVE) |
| Avatars | IS, IN, KP (issuer, investor and keeper agents) | "Three agent roles" |
| Header button | Poke | "The covenant sheet" main action, "Time-weighted price" |
| Tabs | Rules, Treasury, Ledger, Trust | "The covenant sheet" (rule cards, ledger, trust panel) |
| Columns | Day 0, Day 30, Day 60 | content plan |
| Raise settled | Done | "Lifecycle" (Settle) |
| Pool seeded | Done | "Lifecycle" (Launch) |
| Tap | 4.1 BNB claimable | "The covenant sheet", Rule card table (Tap) |
| Unlock 2x | 11 of 30 days | Rule card table (2x tranche: 11 of 30 days) |
| Exit streak | Opens in 1 day 4 hours | Rule card table (Book-value exit) |
| Heartbeat | Last active 6 days ago | Rule card table (Abandonment switch) |
| Report | Due in 12 days | Rule card table (Disclosure) |
| Phone progress fills | Tap 27.3% = 4.1 of 15 BNB; Unlock 36.7% = 11 of 30 days | "Rule 1: tap" (cap 4% of 375 BNB = 15 BNB in month one); Rule card table |

#### Update card (issuer agent)

| Element | Copy | Source |
| --- | --- | --- |
| Title | Issuer agent, heartbeat | "Issuer agent loop" |
| Time | Hourly | "Time-weighted price" (keeper pokes hourly) via content plan |
| Body | Claimed 4.1 BNB of tap at the Atlas rate. Heartbeat sent. Report due in 12 days. | "Rule 1: tap" (paid at the Atlas BNB/USD rate; claimTap counts as a heartbeat); Rule card table |
| Buttons | Logs, View on sheet | content plan |

#### Logo row

Caption: "Built on Flap Pool Launch, priced by Atlas, explained with CoinMarketCap data" ("Summary", "Sponsor
integrations"). Names, integrations and not customers: Flap, Atlas, CoinMarketCap, PancakeSwap, Four.meme, ERC-8004,
Cournot, BNB Chain. Each shows the project's own mark, monochrome in the ticker grey; sources in
`web/public/landing/logos/SOURCES.md`.

### Features

| Element | Copy | Source |
| --- | --- | --- |
| Eyebrow | How Covenant works | "How Covenant works" |
| Heading | Five rules, fixed at launch. Money goes in, rules hold it, and holders get it back when the price says the project failed. | "Summary", "Lifecycle" (terms fixed at creation) |
| Index | Raise with refunds, Read the sheet, Pay the team, Exit at book | content plan |

#### 1. Raise with refunds

Statement: "Raise with refunds built in. Above the cap, each commitment is scaled down pro rata and the excess is
refunded." ("Lifecycle", Settle.)

Panel "Commitments", filters Committed 1,400 / Accepted 500 / Refunded 900. Rows ("Where the money goes: a worked
example"):

| Amount (BNB) | Title | Detail | Chip | Status |
| --- | --- | --- | --- | --- |
| 1,400 | Committed by buyers | 2.8x oversubscribed against a 500 BNB cap | Buyers | Committed |
| 500 | Accepted into the sale | The cap, filled pro rata | Sale | Accepted |
| 900 | Refunded pro rata | Each buyer keeps 35.7% of their commitment | Buyers | Refunded |
| 125 | Seeds the PancakeSwap pool | With 150M tokens, so it opens at the sale price | Pool | Seeded |
| 375 | Forwarded to the vault | The treasury, held under the five rules | Vault | Held |

#### 2. Read the sheet

Statement: "Every rule on one sheet. Each rule shows a meter and its next event, readable without a wallet."
("The covenant sheet": one page per token, readable without a wallet; each rule card has a meter and the next event.)

Board (rule cards, "Rule card" table):

| Column | Card | Meta | Value | Meter |
| --- | --- | --- | --- | --- |
| Team | Tap (1) | Claimable | 4.1 BNB | 27.3% (4.1 of the 15 BNB month-one cap, "Rule 1: tap") |
| Team | Performance unlock (2) | 2x | 11 of 30 | 36.7% (11 of 30 days) |
| Holders | Book-value exit (3) | Opens in | 1d 4h | 61.1% (streak 44 of 72 hours: 3 days less 1 day 4 hours) |
| Holders | Abandonment switch (4) | Silent for | 6 days | 13.3% (6 of 45 days, "Rule 4") |
| Checks | Disclosure (5) | Report in | 12 days | none |
| Checks | Trust panel (T) | Atlas | Fresh | none ("The covenant sheet": Atlas report age) |

#### 3. Pay the team

Statement: "A budget, never the treasury. The team claims a capped tap and can lower it, but nobody can raise it."
("Rule 1: tap".)

Team console ("Screens", Team console), header "Team wallet":

| Task | Chip | Status | When | Source |
| --- | --- | --- | --- | --- |
| Claim the accrued tap | Tap | Claimable | Now | "Rule 1: tap" (claimTap) |
| Post the period report | Disclosure | Drafting | 12 days | "Rule 5", Rule card table |
| Raise the tap | Tap | Blocked | Never | "Rule 1: tap" (nobody can raise it in v1) |
| Lower the tap if price nears book | Tap | Optional | Any time | "Rule 1: tap", "Issuer agent loop" |
| Heartbeat sent | Heartbeat | Done | Today | "Rule 4: abandonment switch" |

Blocker card: "Blocked by rule" / "Nobody can raise the tap in v1. The team can only lower it." / button "Lower the
tap". Progress card: "Tap cap", "4%", meter 4%, note "of treasury per 30 days · 15 BNB in month one" ("Rule 1: tap").

#### 4. Exit at book

Statement: "Exit at book when the price fails. The exit compares two on-chain numbers, pool price and treasury per
token, and works with no oracle." ("What the oracle does and does not decide", "Rule 3: book-value exit".)

Redemption card ("Rule 3: book-value exit", worked example): chip EXIT_ROUND ("States"), "Exit round open · 7 days",
title "Redeem 6,000,000 tokens"; You get: "2.534 BNB after the 1% fee", "Selling on the pool pays about 2.1 BNB";
Your tokens: "Sent to the burn address"; Book value: "Moves from 0.00000042667 to 0.00000042670".
Toast: "Redeemed · 2.534 BNB sent".

## Home, part B: final copy and sources

Every number comes from `docs/DESIGN.md`. Section names are the Framer section names.

### Stats -> The problem today (HomeProblem)

Rebuilt as "The problem today": two stat rows and a demand row, each figure linked to its source. Copy in
`content/home-v2.md`, citations in `docs/landing/sources.md`.

### Weekly Update -> agent layer (HomeAgentLayer)

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

### Stories -> use cases (HomeUseCases)

- Eyebrow: Use cases. Heading: "One vault for every issuer." / "AI agents, teams, machines and launchpads raise under the same five rules."
  (DESIGN.md "Who it is for", "Agent layer".) Link: "All use cases" -> `/use-cases`.
- Cards: first three items of `content/useCases.tsx` (owned by the use-cases agent; sources in its content doc).

### Quote (HomeQuote)

- The featured item of `content/useCases.tsx`: its `quote`, `quoteAuthor` · `quoteRole`, `name`.

### Pricing Preview -> fees (HomePricing)

- Eyebrow: Fees. Heading: "Free to raise. Free to buy." / "We earn from fee paths that already exist."
  (DESIGN.md "Business model and roadmap": "It adds no new fee for buyers or teams in v1"; revenue lines use fee paths
  "that already exist in the sponsors' contracts".)
- Cards: `content/plans.ts` (owned by the pricing agent; sources in its content doc). Badge text = plan `badge`.

### FAQ (HomeFAQ, content/faqs.ts)

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

### Changelog Preview -> milestones (HomeMilestones)

- Eyebrow: Milestones. Heading: "Built in public, gate by gate." / "From the design document to Demo Night."
  (DESIGN.md "Build plan for the 36 hours".) Link: "See every milestone" -> `/changelog`.
- Entries: `content/milestones.ts` sorted by date descending, first four (owned by the changelog agent).

### Closing CTA (HomeClosingCTA)

- Heading: "Raise under rules. Exit at book." Body: "Covenant runs on Flap Pool Launch on BNB Chain. No fees for buyers or
  teams in v1." (content-plan "Closing CTA"; DESIGN.md "Summary", "Business model".)
- Buttons: Secondary "Read the rules" -> `/features`, Primary "Launch app" -> `/app`.

## /features copy and sources

Every fact below is from `docs/DESIGN.md`; the section of DESIGN.md is given in brackets.

### Features Hero

- Eyebrow: Rules
- Heading: Five rules that bind the team. (content-plan "/features")
- Body: Covenant writes investor protections into the launch, and they bind a human team or an AI agent the same way.
  [Summary: "the core ones into the launch itself"; "The same contracts work when the issuer is an AI agent"]
- Buttons: Talk to the team `/contact` (secondary), Launch app `/app` (primary).

### Board Showcase (covenant lifecycle board)

- Bar: "Covenant · Lifecycle", filter "Group by state". Columns are states [How Covenant works > States].
- RAISING: "Commitments open" / "4 day sale window" [Appendix A: sale window 4 days];
  "Oversubscribed 2.8x" / "1,400 BNB committed" [Where the money goes: a worked example].
- ACTIVE: "Tap accrues" / "4% of treasury per 30 days" [Rule 1: tap; Appendix A tap cap];
  "Price recorded" / "Poked hourly" [Lifecycle > Operate; Time-weighted price: a keeper pokes hourly].
- EXIT_ROUND: "Round open, tap paused" / "7 days" [Lifecycle > Exit round; States: EXIT_ROUND tap paused];
  "Redeemed 6,000,000 tokens" / "2.534 BNB" [Rule 3 worked example].
- WIND_DOWN: "Silent for 45 days" / "Abandonment switch" [Rule 4];
  "Locked team tokens burned" / "Redemption with no fee" [Lifecycle > Wind-down; Rule 4].

### Capabilities (six cards)

- Eyebrow: The five rules
- Heading: "Five rules, fixed at launch." / "Each one is a formula over numbers the vault reads on-chain."
  [Lifecycle > Create: nothing can be edited later except lowering the tap; The rules in detail: "Every rule is a
  formula over numbers the vault can read on-chain"]
- Tap: "A dollar budget per 30 days, capped at 4% of the treasury." [Rule 1: tap]
- Performance unlock: "Team tokens unlock at 2x, 4x and 8x, held 30 trusted days." [Rule 2]
- Book-value exit: "Price below treasury per token for 3 trusted days opens a round." [Rule 3; What the oracle does
  and does not decide: compares pool price and treasury per token, both read by the vault]
- Abandonment switch: "After 45 days of team silence, the treasury opens to holders." [Rule 4; What the rules do]
- Disclosure (stretch): "A missed or failed period report pauses the tap until cured." [Rule 5]
- Agent layer: "An AI issuer’s key reaches its accrued tap and nothing else." [Agent layer > Why an agent needs a
  covenant: "The agent's key reaches its accrued budget and nothing else"]

### Dependencies (exit round timeline)

- Eyebrow: Book-value exit
- Heading: "An exit that runs on a clock." / "Three trusted days below book open a 7 day round. A 14 day cooldown follows
  before it can arm again." [Rule 3; Appendix A: exit streak 3 trusted days, round 7 days, cooldown 14 days]
- Points: "Compares pool price with treasury per token, both on-chain" [What the oracle does and does not decide];
  "Any holder can burn tokens for a share of the treasury" [Lifecycle > Exit round];
  "The tap pauses while the round is open" [States: EXIT_ROUND, tap paused].
- Bars: "Exit streak · 3 trusted days", "Exit round · 7 days", "Cooldown · 14 days" [Appendix A].
- Note: "Round open. A holder redeemed 6,000,000 tokens for 2.534 BNB." [Rule 3 worked example]

### Integrations (eight tiles)

- Eyebrow: Integrations
- Heading: "Built on the BNB Chain stack." / "Each integration does a job in Covenant that nothing else could do."
  [Sponsor integrations: "Each sponsor's technology does a job in Covenant that nothing else could do"]
- Flap Pool Launch: "Runs the raise and seeds a pool with locked liquidity" [Lifecycle > Launch; Glossary: Pool Launch]
- Atlas: "Signed BNB/USD for the dollar tap and unlock" [Which data does which job; CoinMarketCap and Atlas]
- CoinMarketCap DEX API: "Quotes, liquidity and holders on the covenant sheet" [CoinMarketCap DEX API in the app]
- OpenFour: "Brings the tap and the switch to Four.meme tokens" [Four.meme and OpenFour: rules 1 and 4]
- PancakeSwap V2: "Time-weighted pool price, read on-chain" [Which data does which job]
- ERC-8004: "Agent identity and a record that travels between raises" [Agent layer > Optional contract changes]
- Covenant MCP server: "Lets any agent read terms, commit and redeem" [Summary: What ships; Covenant MCP server]
- Cournot: "A verdict on each period’s disclosure report" [Cournot; Rule 5]

### Security (trust assumptions)

- Eyebrow: Trust assumptions
- Heading: "Trust assumptions, stated up front." / "Every one is shown on the covenant sheet, in plain words."
  [Trust assumptions, all shown on the covenant sheet]
- No admin keys: "No owner, no pause and no fee switch." [Trust assumptions]
- Guardian upgrades only: "Flap’s Guardian is the only path to upgrade a vault." [Trust assumptions; Flap > Upgrades]
- Exit needs no oracle: "Atlas cannot open or block a round. Both prices are on-chain." [Trust assumptions: Atlas
  "cannot open or block an exit round, because book value and pool price are both read on-chain"]
- Liquidity locked: "The PancakeSwap V2 pair is locked at launch and cannot be pulled." [Trust assumptions]

### Page CTA

- Heading "Raise under rules. Exit at book." Body "Five rules hold the treasury. Nobody has to trust the team."
  (content-plan "Page CTA default"). Secondary "Talk to the team" `/contact` (the page is /features, so the default
  "Read the rules" link would point to itself), primary "Launch app" `/app`.

## /pricing copy and sources

Every fact below comes from `docs/DESIGN.md`. Section names refer to its headings.

### Pricing Hero

- Eyebrow: "Fees"
- Title: "No fees for buyers or teams in v1."
  Source: "Business model and roadmap": "It adds no new fee for buyers or teams in v1."
- Body: "Covenant earns through fee paths already built into Flap and OpenFour, paid on trading volume."
  Source: "Business model and roadmap": "Covenant earns when tokens launched through it keep trading, through fee paths
  that already exist in the sponsors' contracts"; "Revenue lines": "The first two lines pay on trading volume".

### Plans (`web/src/landing/content/plans.ts`, also used by the home pricing preview)

"Yearly:" becomes "Status:".

1. Buyers: $0 "to commit or refund"; "For anyone committing BNB to a raise."; Status "No fee in v1"; button
   "Launch app" /app. Features: Refunds if oversubscribed; Full refund under minimum; Redeem at book in a round;
   1% exit fee, kept by vault; No fee after wind-down.
   Sources: "Business model and roadmap" (no fee for buyers in v1); "Positioning and prior art" table (capped, pro rata
   refunds, full refund under minimum); "Rule 3: book-value exit" ("Default fee is 1% and stays in the treasury");
   "Lifecycle" ("redemption stays open with no fee" after wind-down).
2. Teams (highlighted, badge "Free in v1"): $0 "raise fee in v1"; "For human teams and AI agents that raise.";
   Status "Raise fee set to zero"; button "Launch app" /app. Features: Capped raise on Pool Launch; 4% tap cap per
   30 days; Unlocks at price multiples; A live covenant sheet; Same rules for agent issuers.
   Sources: "Revenue lines" (Raise fee: "Set to zero in v1"); "Summary" (Flap Pool Launch, the rules, the covenant
   sheet, "The same contracts work when the issuer is an AI agent"); 4% tap cap per 30 days per content-plan.md
   (DESIGN.md "Appendix A: default parameters"); "Rule 2: performance unlock".
   The template badge says "Most popular"; there is no evidence for that claim, so the badge reads "Free in v1".
3. Flap commission: "TBC" "of Flap’s protocol fee"; "Paid by Flap from its fee, not the project."; Status
   "Rate to confirm"; button "Contact the team" /contact. Features: Set by commissionReceiver; Derived from the tax
   rate; Paid from Flap’s fee; Earned on lifetime volume; No cost to buyers or teams.
   Source: "Revenue lines", Flap commission row ("commissionReceiver … derived from the launch's tax rate and paid
   from the protocol-fee remainder"; "Flap's protocol fee, not the project"; "Rate and eligibility … to confirm with
   Flap") and "The first two lines pay on trading volume over a token's whole life."
4. OpenFour royalty: "~6%" "of founder tax receipts"; "For Four.meme tokens on our vault template."; Status
   "Live on Four.meme"; button "Contact the team" /contact. Features: ROYALTY_BPS = 600; From the founder’s tax share;
   Adds the tap and the switch; Template fixed after create; Founders launch as before.
   Sources: "Revenue lines", OpenFour royalty row ("about 6% of every tax receipt"; "The founder's tax share";
   "Live mechanism, documented by Four.meme"); "Four.meme and OpenFour" (ROYALTY_BPS = 600; rules 1 and 4, the tap
   and the abandonment switch; "Template and init params cannot be changed after create"); "Go to market" ("a founder
   can adopt the tap and the switch without changing how they launch").
- Note: "No new fee for buyers or teams in v1. A raise fee and services come later."
  Source: "Revenue lines" (Raise fee "A lever for later"; Services "After mainnet").

### Compare (`web/src/landing/sections/pricing/compareData.ts`)

- Eyebrow "Prior art"; heading "Same promise, different engine." / "What a holder can do when it fails."
  Source: "Positioning and prior art" ("Same promise, different engine" in "Summary"; the table "shows … what a holder
  can do when things go wrong").
- Columns: Terms / Covenant / MetaDAO / DAICO / Launchpads (the table's "Bonding-curve launchpads" column).
- Raise and treasury: Raise; Full refund under minimum; Where the money sits; Team budget; Team tokens.
  Source: the "Positioning and prior art" table rows "Raise", "Where the money sits", "Team budget", "Team tokens".
- Holder exit: Exit at asset value; One holder can leave; Fixed rules, nothing to vote on; What enforces it.
  Sources: table rows "Holder exit at asset value", "What enforces it"; "Where Covenant is different on purpose"
  ("One holder can leave"; "There is no proposal process to learn and nothing to vote on").
- Trade-offs, stated up front: Legal claim on the company; Holder governance; Trading tax feeds the treasury.
  Sources: "Where Covenant is weaker, stated up front" ("No legal claim", "No governance … v1 offers exit, not voice");
  "Where Covenant is different on purpose" ("Trading tax feeds the treasury … MetaDAO treasuries only shrink unless
  the project earns revenue"); DAICO powers from "Research foundations" (raise the tap by vote, shut down by vote).
  Where DESIGN.md says nothing about a DAICO cell, it reads "Not specified", matching the table's own wording.

### Pricing Quote

- "That ties our income to launches that last." Attribution "Covenant · Business model".
  Source: "Revenue lines": "That ties our income to launches that last".

### Pricing FAQ

- Eyebrow "Questions", heading "Fees, in plain words." List renders `content/faqs.ts` (owned and sourced by home-b).

### Page CTA

- Content-plan default: "Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the
  team." Secondary "Read the rules" /features, primary "Launch app" /app.

## /use-cases copy and sources

Every fact below comes from `docs/DESIGN.md`. Section names in quotes are DESIGN.md headings.
Quotes are "Jobs to be done" lines or pitch lines, attributed to a role, never to a person.

### Customers Hero
- Eyebrow "Use cases". H1 "Raises that bind the team." / "From AI agents to launchpads." (content-plan.md).

### Featured Story (AI agent, featured item)
- See item 1 below. Link text "Read the use case".

### Customer Stats (covenant default terms, "Appendix A: default parameters")
| Value | Label | Source |
| --- | --- | --- |
| 60% | of the sale price backed by the treasury at launch | "Where the money goes": book value per token is 60% of the sale price; "Book value" table (default split 0.60) |
| 4% | of the treasury per 30 days, the most the tap can pay | "Rule 1: tap": default cap 4% of the treasury per 30 days |
| 3 days | below book value, on on-chain prices, open an exit round | "Rule 3" as built: the streak reads on-chain numbers only and decays instead of resetting (CovenantVault.sol) |
| 45 days | of team silence open the treasury to holders | "Rule 4": now > lastHeartbeat + 45 days -> declareAbandoned(); wind-down opens redemption |

### All Stories
- Eyebrow "Use cases". H2 "One vault, the same five rules." / "Five ways to put them to work."
  ("How Covenant works": one launcher and one vault; five rules, "Summary").

### Quote Wall
- Eyebrow "Jobs to be done". H2 "What each side needs from a raise." / "Written as jobs, answered by rules."
- Cards = items 2 to 4 (template offset 1, limit 3): the community round, inference agent and self-owning machine "Jobs to be done" lines.

### Page CTA (both pages)
- "Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the team."
  Read the rules `/features`, Launch app `/app` (content-plan.md default).

### Use cases (`content/useCases.tsx`)

#### 1 to 5. The owner's five cases

Full copy and sources: `content/home-v2.md` ("Use cases") and `docs/landing/sources.md` ("Use cases"). Slugs:
`ai-agent-working-capital` (featured), `community-round`, `gpu-inference-agent`, `machines-that-own-themselves`,
`launchpad-protected-tier`. Each carries the situation, what goes wrong today with links, the five rules applied, the
limit, and an illustrative covenant sheet on DESIGN.md's default terms.

Covers: the template's neutral architecture and interior photos 1 to 5, reused as covers only.

## /changelog and /changelog/[slug] copy

Source for every fact: `docs/DESIGN.md`, plus the git history for the two shipped milestones
(`bf9709c` "Covenant: design document and project skeleton", `c5bdb61` "Design: add the agent layer").
Data lives in `web/src/landing/content/milestones.ts`.

### Changelog Hero

- Eyebrow: "Milestones"
- H1: "Built in public, gate by gate." / "Three gates in 36 hours, then Demo Night on Nov 27."
  Source: "Build plan for the 36 hours" (36 hours, three gates, Demo Night on Nov 27 from 15:00 to 18:00).
- Subscribe form: placeholder "you@example.com", button "Subscribe". No backend.
- Note: "One note per gate. This testnet build stores no emails." (true: the form has no backend.)

### Milestones (newest first)

Dates for gates: the build runs from the evening of Nov 25 to the morning of Nov 27 (Build plan). Hour 10 and hour 18
land on Nov 26 for any evening kickoff. Hour 26 also lands on Nov 26 for a kickoff before 22:00, so Gate C is dated
Nov 26; the hour is stated in its copy. Tags: "Shipped" or "Target"; versions 0.1 to 0.6 (content plan).

| v | Date | Tag | Title | Summary | Source |
| --- | --- | --- | --- | --- | --- |
| 0.6 | Nov 27 | Target | Demo Night | Three minutes on stage, Nov 27 from 15:00 to 18:00. Money goes in, rules hold it, holders get it back. | Build plan; "Demo script and pitch" |
| 0.5 | Nov 26 | Target | Gate C: feature freeze | Hour 26 of the build. Feature freeze, fixes only from here. | Workstreams table, Gate C row |
| 0.4 | Nov 26 | Target | Gate B: the demo story, end to end | Hour 18 of the build. The fork test runs the whole demo story end to end. | Gate B row |
| 0.3 | Nov 26 | Target | Gate A: raise to vault on a fork | Hour 10 of the build. Commit, finalize, then token, pool and vault exist and tokens are claimed. | Gate A row |
| 0.2 | Nov 26 | Shipped | Agent layer design | Issuer, investor and keeper agents, an MCP server and ERC-8004 identity, around the same five rules. | "Agent layer"; commit c5bdb61 (Nov 26) |
| 0.1 | Nov 25 | Shipped | Design document | The raise, book value and the five rules, written down before any contract code. | "Summary", "The rules in detail"; commit bf9709c |

Covers: the template's six changelog CMS images, reused in the same order (newest entry gets the template's newest cover).

### Detail bodies (Lead paragraphs, H3 headings)

- Demo Night: date and hours (Build plan); "one story in three minutes: money goes in, rules hold it, and a holder gets
  it back when the price says the project has failed"; heading "What the demo shows"; oversubscribed raise, tap claim,
  slide under book value that pays a holder, abandoned project that opens its treasury; real transactions on a fork or
  testnet with short timers; the issuer is an AI agent, and the same script runs with a human team wallet if the agent
  layer is cut ("What ships at BNB Hack Bangkok", "Demo script and pitch").
- Gate C: hour 26, fixes only; heading "What comes before it"; hours 18 to 26 work (testnet deployment if Flap enabled
  us, demo factory with short timers, CovenantLiteVault and its fork test, redeem flow, team console, simulator page);
  cut scope instead of pushing the gate (Build plan intro, Workstreams table).
- Gate B: hour 18, whole demo story on the fork; "a complete story on a fork beats a broader build that breaks on stage"
  (Confidence); hours 10 to 18 work (tap, exit streak, rounds, redeem, heartbeat, wind-down, unit tests for every rule,
  covenant sheet on live contract reads); nothing in the agent layer starts before Gate B is green (Build order).
- Gate A: hour 10, commit, finalize, token and pool and vault exist, tokens claimed; hours 2 to 10 work (launcher commit,
  finalize, refunds, launch; vault factory checks; vault hand-off; pair time-weighted price library; oracle with trust gate).
- Agent layer design: opening line of "Agent layer"; heading "Three agent roles"; issuer, investor and keeper roles
  ("Three agent roles" table); "The LLM never decides a rule..." ("Issuer agent loop").
- Design document: "Summary" (launcher and vault on BNB Chain that binds the team after the money comes in); heading
  "Five rules"; the five rules and what enforces them (Summary table); 36 hours, three gates, cut order (Build plan).

### Entry page chrome

- Back link: "All milestones". Subscribe card: "Get a note at each gate" / "Follow the build on the milestones page. No emails yet."
- List link text: "Read the full update" (template wording kept).

### Page CTA (content plan default)

"Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the team." Secondary
"Read the rules" `/features`, primary "Launch app" `/app`.

## /contact copy

Source: `docs/DESIGN.md` and `docs/landing/spec/content-plan.md` "/contact".

### Contact Main

- Eyebrow "Contact". H1 "Talk to the team." / "Raise with rules." (content plan).
- Body: "Tell us what you are raising for. Covenant runs on Flap Pool Launch on BNB Chain." (Summary: "Built on Flap Pool Launch (primary)").
- Channels (no invented email addresses, content plan): App "Launch the app" `/app`; Rules "Read the five rules" `/features`;
  Milestones "Follow the gates" `/changelog`.
- Form: Name ("Your name"), Email ("you@example.com", a reserved example domain), Project ("Project or token name"),
  You are (Team, Buyer, Launchpad, Agent builder), "What are you raising for?" ("An agent that pays for its own
  compute, a game, a launchpad…", from "Who it is for": an app, a game, an AI agent with revenue; and launchpads).
  Button "Send message"; Pending "Sending…"; Success "Thank you".
- Note: "This testnet build has no backend. Nothing you type leaves your browser." (true: submit is a no-op.)

### Contact Promises

| Title | Body | Source |
| --- | --- | --- |
| No admin keys | No owner, no pause and no fee switch on any covenant. | "Trust assumptions": "There are no Covenant admin keys. No owner, no pause, no fee switch." |
| Rules fixed at launch | No proposals and no votes in v1. Nobody can raise the tap. | "What Covenant is not": "no proposals and no votes in v1. The rules are fixed at launch"; Rule 1 tap (team can only lower it) |
| No fees in v1 | Covenant adds no fee for buyers or teams in v1. | "Business model": "It adds no new fee for buyers or teams in v1." |

### Contact FAQ

- Eyebrow "Before you write"; heading "Quick answers." (template wording kept).
- Items: the first four of `content/faqs.ts` (owned by home-b; sources noted in `docs/landing/content/home.md`).

## 404 copy

Source: `docs/landing/spec/content-plan.md` "404".

- Code: "404"
- H1: "This page left in an exit round." (exit round: DESIGN.md "Rule 3: book-value exit")
- Body: "The link may be old. The rules are still where you left them."
- Buttons: secondary "Read the milestones" `/changelog`, primary "Back to home" `/`.
