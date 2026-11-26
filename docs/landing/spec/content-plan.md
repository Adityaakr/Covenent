# Covenant content plan for the template

Source of truth: `docs/DESIGN.md`. Every number on the site must come from it, with its source noted in
`docs/landing/content/<page>.md`. No fake customers, logos, testimonials, ratings or invented numbers.
The simulator headline stays out (DESIGN.md: "The simulator number does not exist yet").
Agent-first: lead with an AI agent as the issuer, per DESIGN.md "Agent layer", without dropping human teams.

Template copy rules still apply: a heading has at most 8 words, one sentence under it, card text at most 12 words,
at most 3 bullets. Two-run headings: a short first sentence, then a second in secondary colour.
Write plainly. No em dashes. Use smart quotes and apostrophes.

## Exit rule wording (build fixes the owner asked for)

Describe the book-value exit as comparing on-chain numbers only (pool price against treasury per token), working
with no oracle (DESIGN.md "What the oracle does and does not decide"). Do not say a single high hour resets it,
and do not say thin pools freeze it.

## Global

- Brand: Covenant. Wordmark text "Covenant". Product: a launcher and vault for token raises on BNB Chain.
- Nav links: Rules `/features`, Fees `/pricing`, Use cases `/use-cases`, Milestones `/changelog`, Contact `/contact`.
  The template's "Sign in" text link becomes "Connect wallet" to `/app`. The button "Start for free" becomes "Launch app" to `/app`.
- Footer: tagline "Investor protections that enforce themselves. A launcher and vault for token raises on BNB Chain."
  Status pill "Testnet build · BNB Hack Bangkok". Columns: Product (Rules, Fees, Milestones), Company (Use cases,
  Contact, Launch app), Built on (Flap https://flap.sh, CoinMarketCap https://coinmarketcap.com, Four.meme https://four.meme).
  Copyright "© 2026 Covenant. Built at BNB Hack Bangkok." Right note "Made for raises that keep their word".
- Page CTA default: heading "Raise under rules. Exit at book." body "Five rules hold the treasury. Nobody has to trust the team."
  Secondary "Read the rules" `/features`, primary "Launch app" `/app`.

## Home

- Hero chip "Agents"; announcement "Now with an agent layer: issuer, investor and keeper agents".
  Heading "Investor protections that enforce themselves." Sub: "Covenant is a launcher and vault for token raises on
  BNB Chain. Five rules bind whoever holds the team wallet, a human team or an AI agent."
  Buttons: Secondary "Read the rules" `/features`, Primary "Launch app" `/app`. Note "No fees in v1 · Built on Flap Pool Launch".
- Hero app window = the covenant sheet. Address bar "covenant.app / AGENT covenant". Sidebar: Covenants, Raise, Sheet,
  Redeem, Agent, Trust; project list = example tokens is not allowed (no invented names): use "Your covenants" with
  "Agent issuer", "Human team", "Launchpad". Header "Covenant sheet", chip "ACTIVE". Tabs: Rules, Treasury, Ledger, Trust.
  Timeline columns "Day 0", "Day 30", "Day 60". Rows (DESIGN.md "Lifecycle", "Rule card" table):
  Raise settled (Done) · Pool seeded (Done) · Tap (4.1 BNB claimable) · Unlock 2x (11 of 30 days) · Exit streak
  (Opens in 1 day 4 hours) · Heartbeat (Last active 6 days ago) · Report (Due in 12 days).
  Floating update card = issuer agent: title "Issuer agent, heartbeat", time "Hourly", body "Claimed 4.1 BNB of tap at
  the Atlas rate. Heartbeat sent. Report due in 12 days." Buttons "Edit" -> "Logs", "Send to #product" -> "View on sheet".
- Logo row caption "Built on Flap Pool Launch, priced by Atlas, explained with CoinMarketCap data". Names (integrations,
  not customers, DESIGN.md "Summary" and "Sponsor integrations"): Flap, Atlas, CoinMarketCap, OpenFour, PancakeSwap,
  ERC-8004, Cournot.
- Features section eyebrow "How Covenant works"; heading "Five rules, fixed at launch." second run "Money goes in,
  rules hold it, and holders get it back when the price says the project failed."
  Feature index: "Raise with refunds", "Read the sheet", "Pay the team", "Exit at book".
  1. Raise (worked example, DESIGN.md "Where the money goes"): commitments panel "Commitments", filters
     "Committed 1,400", "Accepted 500", "Refunded 900"; rows 1,400 Committed by buyers (2.8x oversubscribed against a
     500 BNB cap) · 500 Accepted into the sale · 900 Refunded pro rata (each buyer keeps 35.7%) · 125 Seeds the
     PancakeSwap pool (with 150M tokens, opens at the sale price) · 375 Forwarded to the vault (the treasury).
  2. Covenant sheet: board columns of rule cards with meters (Tap, Abandonment switch, Performance unlock,
     Book-value exit, Disclosure, Trust panel) using the "Rule card" examples.
  3. Team console: tasks Claim the accrued tap (Claimable, Now) · Post the period report (Drafting, 12 days) ·
     Raise the tap (Blocked, Never) · Lower the tap if price nears book (Optional, Any time) · Heartbeat sent (Done, Today).
     Blocker "Blocked by rule: nobody can raise the tap in v1. The team can only lower it." Progress "Tap cap 4%, of
     treasury per 30 days · 15 BNB in month one".
  4. Exit round: "Exit round open · 7 days", "Redeem 6,000,000 tokens"; you get 2.534 BNB after the 1% fee; selling on
     the pool pays about 2.1 BNB; tokens go to the burn address; book value moves from 0.00000042667 to
     0.00000042670. Toast "Redeemed · 2.534 BNB sent". (DESIGN.md "Rule 3", worked example.)
- Stats (DESIGN.md "Problem and evidence"): 98.6% of Pump.fun tokens fell below $1,000 of liquidity (Solidus Labs) ·
  80.96% of BSC meme coins inactive about two months in (MemeChain) · ~60% of BNB Chain and Ethereum tokens active
  under a day (Cernera et al.) · $580M committed to protected raises, 92.2% refunded (Basis Point).
- Weekly Update section -> agent layer. Eyebrow "Agent layer". Heading "Raise a budget your agent can be held to."
  second run "The vault binds an AI issuer the way it binds a human team." Points: "Claims a tap, not the treasury"
  (the agent's key reaches its accrued budget and nothing else) · "Reports every period" (an LLM writes the report;
  the rules stay in the vault) · "Read by other agents" (an MCP server lets investor agents price the downside and exit).
  Message: sender "Issuer agent · ERC-8004", time "Every few minutes", title "Period report: tap claimed, heartbeat sent";
  tags Tap / Heartbeat / Revenue with lines from DESIGN.md "Issuer agent loop"; reactions become function names
  `claimTap()`, `heartbeat()`, `postReport()`.
- Stories -> six use cases (CMS-like data in `content/useCases.ts`): Agent issuer, Human team, Launchpad,
  Investor agent, Keeper agent, Four.meme creator. Each: title, one-line summary, category, a result number that
  is a covenant term from DESIGN.md (4% tap cap, 60% starting floor, 3 trusted days, 45 days heartbeat, 7 day round,
  ~6% OpenFour royalty), and a quote that is a "Jobs to be done" line or a pitch line from DESIGN.md, attributed to
  the role ("Job to be done · Team"), never to a person.
- Quote section: "ClawPump lets an agent launch a token. Covenant lets an agent raise a budget it can be held to."
  attribution "Covenant · Agent layer".
- Pricing preview -> "How it is paid for" (DESIGN.md "Business model"): Buyers $0, Teams $0 (no raise fee in v1),
  Flap commission (paid from Flap's protocol fee, rate to confirm), OpenFour royalty about 6% of founder tax receipts.
- FAQ: six "Hard questions" from DESIGN.md (MetaDAO, why accept limits, draining the treasury, floor worth, whale
  triggering an exit, Atlas down) with their answers, shortened. Contact button stays.
- Changelog preview -> build milestones (`content/milestones.ts`): Design document (Nov 25, 2026, shipped),
  Agent layer design (Nov 26, shipped), Gate A hour 10, Gate B hour 18, Gate C hour 26 (targets), Demo Night
  Nov 27 15:00 to 18:00 (DESIGN.md "Build plan"). Tags "Shipped" or "Target"; versions 0.1 to 0.6.
- Closing CTA: "Raise under rules. Exit at book." body "Covenant runs on Flap Pool Launch on BNB Chain. No fees for
  buyers or teams in v1." Secondary "Read the rules", primary "Launch app".

## /features -> the five rules and the agent layer

Hero "Five rules that bind the team." Board showcase -> covenant lifecycle board (RAISING, ACTIVE, EXIT_ROUND,
WIND_DOWN columns with real events). Capabilities grid (6 cards): Tap, Performance unlock, Book-value exit,
Abandonment switch, Disclosure (stretch), Agent layer. Dependencies section -> exit round timeline (streak 3 trusted
days, round 7 days, cooldown 14 days). Integrations (8 tiles) -> sponsor and agent integrations: Flap Pool Launch,
Atlas, CoinMarketCap DEX API, OpenFour, PancakeSwap V2, ERC-8004, Covenant MCP server, Cournot. Security section ->
trust assumptions (no admin keys; Guardian upgrades only; Atlas cannot open or block an exit; liquidity locked).

## /pricing -> how it is paid for

Plans as above. Compare table -> Covenant / MetaDAO / DAICO / Launchpads, rows from DESIGN.md "Positioning and prior
art" table and "Where Covenant is different on purpose". Quote -> "That ties our income to launches that last."
(Business model). FAQ heading "Fees, in plain words."

## /use-cases (template /customers)

Hero "Raises that bind the team. From AI agents to launchpads." Featured use case (agent issuer). Stats -> covenant
terms (60% starting floor, 4% max tap per 30 days, 3 trusted days below book, 45 days of silence). Grid of six use
cases. Quote wall -> three "Jobs to be done" lines. Detail page per use case with facts (Category, Who, Key term).

## /changelog and detail

Hero "Built in public, gate by gate." Subscribe form stays visually (no backend; submit is a no-op with a success
state). Milestone list. Detail page with a short body per milestone.

## /contact

Heading "Talk to the team. Raise with rules." Channels: App (`/app`), Rules (`/features`), Milestones (`/changelog`)
instead of invented email addresses. Form fields: Name, Email, Project, You are (Team, Buyer, Launchpad, Agent
builder), "What are you raising for?". No backend: submit shows the success state only.

## 404

"This page left in an exit round." body "The link may be old. The rules are still where you left them." Buttons
"Read the milestones" `/changelog`, "Back to home" `/`.
