# /use-cases copy and sources

Every fact below comes from `docs/DESIGN.md`. Section names in quotes are DESIGN.md headings.
Quotes are "Jobs to be done" lines or pitch lines, attributed to a role, never to a person.

## Customers Hero
- Eyebrow "Use cases". H1 "Raises that bind the team." / "From AI agents to launchpads." (content-plan.md).

## Featured Story (Agent issuer, featured item)
- See item 1 below. Link text "Read the use case".

## Customer Stats (covenant default terms, "Appendix A: default parameters")
| Value | Label | Source |
| --- | --- | --- |
| 60% | of the sale price backed by the treasury at launch | "Where the money goes": book value per token is 60% of the sale price; "Book value" table (default split 0.60) |
| 4% | of the treasury per 30 days, the most the tap can pay | "Rule 1: tap": default cap 4% of the treasury per 30 days |
| 3 days | trusted, below book value, open an exit round | "Rule 3": streak reaches 3 days -> exit round; Appendix A exit streak 3 trusted days |
| 45 days | of team silence open the treasury to holders | "Rule 4": now > lastHeartbeat + 45 days -> declareAbandoned(); wind-down opens redemption |

## All Stories
- Eyebrow "Use cases". H2 "One vault, the same five rules." / "Six ways to put them to work."
  ("How Covenant works": one launcher and one vault; five rules, "Summary").

## Quote Wall
- Eyebrow "Jobs to be done". H2 "What each side needs from a raise." / "Written as jobs, answered by rules."
- Cards = items 2 to 4 (template offset 1, limit 3): the team, launchpad and contributor "Jobs to be done" lines.

## Page CTA (both pages)
- "Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the team."
  Read the rules `/features`, Launch app `/app` (content-plan.md default).

## Use cases (`content/useCases.tsx`)

### 1. Agent issuer (featured) `/use-cases/agent-issuer`
- Category "AI agent"; Who "An AI agent holding the team wallet" ("Three agent roles": issuer agent holds the team wallet).
- Headline "An AI agent raises a budget it can be held to." (pitch line, "ClawPump: what it proves").
- Summary: holds the team wallet, claims tap as a compute budget, reports each period; key reaches accrued budget and
  nothing else ("Three agent roles"; "Why an agent needs a covenant more than a human team", hijack row).
- Key term "4%" "of the treasury per 30 days, the most its tap can reach" ("Rule 1"; "Hard questions on the agent layer":
  a leaked key reaches at most 4% of the treasury a month).
- Quote "ClawPump lets an agent launch a token. Covenant lets an agent raise a budget it can be held to." Pitch line /
  Agent layer ("ClawPump: what it proves and what it leaves open", two lines for the pitch).
- Body: "Agent layer" intro and "Summary" (cannot be sued, hijacked, can stop); "Hard questions on the agent layer"
  (leaked key); "Issuer agent loop" (claim, heartbeat, lowerTap near book, revenue to vault, LLM report, LLM never
  decides a rule).

### 2. Human team `/use-cases/human-team`
- Category "Team"; Who "An app, a game or a company testing tokenized shares" ("Who it is for", team row).
- Headline "A team shows buyers what it can and cannot do." Summary: commitment it opts into at launch, verifiable
  on-chain, keeps a monthly budget it controls ("Who it is for").
- Key term "60%" "of the sale price backed by the treasury at launch, with default terms" ("Where the money goes";
  "Hard questions": 60% of the sale price at launch with default terms).
- Quote: team job ("Jobs to be done") / Job to be done, Team.
- Body: "Who it is for" (priced like every other launch); "Lifecycle" (settle: pro rata scale-down, full refund below
  minimum); "Rule 1" (4% cap); "Rule 2" (2x, 4x, 8x, 30 trusted days, 6 month cliff); "Lifecycle" (nothing editable
  except lowering the tap).

### 3. Launchpad `/use-cases/launchpad`
- Category "Launchpad"; Who "Flap, Four.meme and BNB Chain" ("Who it is for", launchpad row).
- Headline "A launchpad features launches without vouching for the team." ("Jobs to be done", launchpad).
- Summary: rugs are a reputational cost; a launch type that attracts real projects, plus template fees ("Who it is for").
- Key term "3 days" "trusted, below book value, before an exit round opens" ("Rule 3").
- Quote: launchpad job / Job to be done, Launchpad.
- Body: "Where Covenant is different on purpose" (Flap launcher and vault pair plus an OpenFour template, no new venue);
  "What the rules do" and "Lifecycle" (3 trusted days, 7 day round, pro rata share); "Rule 3" (why the trigger is hard
  to abuse).

### 4. Investor agent `/use-cases/investor-agent`
- Category "AI agent"; Who "Any MCP client, through the Covenant MCP server" ("Three agent roles", investor agent).
- Headline "An investor agent prices the downside before it commits." Summary: reads terms, computes downside,
  commits, claims, redeems when a round opens ("Three agent roles").
- Key term "7 days" "of exit round, open to any holder at book value" ("Rule 3": round opens for 7 days).
- Quote: contributor job / Job to be done, Contributor.
- Body: "Why an agent needs a covenant more than a human team" (investor agents cannot judge a meme; downside is a
  number); "Covenant MCP server" (list_covenants, get_terms, get_downside; unsigned transactions); "Demo script"
  2:25 (another agent can exit by itself); "Hard questions on the agent layer" (never controls the money rules).

### 5. Keeper agent `/use-cases/keeper-agent`
- Category "AI agent"; Who "Anyone who calls poke(), a person or a program" ("Lifecycle": a keeper, or anyone, calls poke()).
- Headline "A keeper agent keeps the rules moving, hour by hour." Summary: pokes hourly to record prices, dispatches
  tax, declares abandonment when due, buys market data per request ("Three agent roles"; "Lifecycle").
- Key term "45 days" "of team silence before anyone can open the treasury" ("Rule 4").
- Quote: holder job / Job to be done, Holder.
- Body: "Lifecycle" (poke about once an hour); "Rule 2" and "Rule 3" (trusted time only); "Rule 4" and "Lifecycle"
  (heartbeat, 45 days, declareAbandoned(), tap ends, locked team tokens burned, redemption open with no fee).

### 6. Four.meme creator `/use-cases/four-meme-creator`
- Category "Tax vault template"; Who "A founder launching a Four.meme tax token" ("Four.meme and OpenFour").
- Headline "A Four.meme founder puts their tax share under a covenant." Summary: brings the tap and the abandonment
  switch to any Four.meme tax token ("Four.meme and OpenFour", rules 1 and 4) without changing how the founder
  launches ("Go to market").
- Key term "~6%" "of each tax receipt, the OpenFour template royalty" ("Four.meme and OpenFour": ROYALTY_BPS = 600).
- Quote "Tokens are sold to the public with none of the protections investors get elsewhere, and Covenant writes the
  core ones into the launch itself." Pitch line / Covenant ("Summary": the pitch in one line).
- Body: "Four.meme and OpenFour" (founder's tax lands in the vault, withdraw at most tapBps per period, each
  withdrawal a heartbeat, silent past the window or wind-down -> redeemable, burn for pro rata share; Unverified
  Royalty path; create page builds the form from the schema tapBps, tapPeriod, heartbeat, redeemFeeBps; permanence).

Covers: the template's six neutral architecture and interior photos, reused as covers only.
