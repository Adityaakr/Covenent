# Home copy, part A: Hero and Features

Every fact below points at its source in `docs/DESIGN.md`. Layout follows `docs/landing/content-plan.md` "Home".
Section headings in DESIGN.md are quoted as "Heading".

## Hero

| Element | Copy | Source |
| --- | --- | --- |
| Chip | Agents | "Agent layer" |
| Announcement (Desktop, Tablet) | Now with an agent layer: issuer, investor and keeper agents | "Three agent roles" |
| Announcement (Phone) | Now with an agent layer | same |
| Heading | The operating stack for autonomous ventures. | The owner's headline (see `content/home-v2.md`) |
| Subheading | Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain. | The owner's subline |
| Buttons | Read the rules (`/features`), Launch app (`/app`) | content plan |
| Note | No fees in v1 · Built on Flap Pool Launch | "Business model and roadmap" (no raise fee in v1); "Summary" (Built on) |

### App window (the covenant sheet)

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

### Update card (issuer agent)

| Element | Copy | Source |
| --- | --- | --- |
| Title | Issuer agent, heartbeat | "Issuer agent loop" |
| Time | Hourly | "Time-weighted price" (keeper pokes hourly) via content plan |
| Body | Claimed 4.1 BNB of tap at the Atlas rate. Heartbeat sent. Report due in 12 days. | "Rule 1: tap" (paid at the Atlas BNB/USD rate; claimTap counts as a heartbeat); Rule card table |
| Buttons | Logs, View on sheet | content plan |

### Logo row

Caption: "Built on Flap Pool Launch, priced by Atlas, explained with CoinMarketCap data" ("Summary", "Sponsor
integrations"). Names, integrations and not customers: Flap, Atlas, CoinMarketCap, PancakeSwap, Four.meme, ERC-8004,
Cournot, BNB Chain. Each shows the project's own mark, monochrome in the ticker grey; sources in
`web/public/landing/logos/SOURCES.md`.

## Features

| Element | Copy | Source |
| --- | --- | --- |
| Eyebrow | How Covenant works | "How Covenant works" |
| Heading | Five rules, fixed at launch. Money goes in, rules hold it, and holders get it back when the price says the project failed. | "Summary", "Lifecycle" (terms fixed at creation) |
| Index | Raise with refunds, Read the sheet, Pay the team, Exit at book | content plan |

### 1. Raise with refunds

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

### 2. Read the sheet

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

### 3. Pay the team

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

### 4. Exit at book

Statement: "Exit at book when the price fails. The exit compares two on-chain numbers, pool price and treasury per
token, and works with no oracle." ("What the oracle does and does not decide", "Rule 3: book-value exit".)

Redemption card ("Rule 3: book-value exit", worked example): chip EXIT_ROUND ("States"), "Exit round open · 7 days",
title "Redeem 6,000,000 tokens"; You get: "2.534 BNB after the 1% fee", "Selling on the pool pays about 2.1 BNB";
Your tokens: "Sent to the burn address"; Book value: "Moves from 0.00000042667 to 0.00000042670".
Toast: "Redeemed · 2.534 BNB sent".
