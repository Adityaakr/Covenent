# /changelog and /changelog/[slug] copy

Source for every fact: `docs/DESIGN.md`, plus the git history for the two shipped milestones
(`bf9709c` "Covenant: design document and project skeleton", `c5bdb61` "Design: add the agent layer").
Data lives in `web/src/landing/content/milestones.ts`.

## Changelog Hero

- Eyebrow: "Milestones"
- H1: "Built in public, gate by gate." / "Three gates in 36 hours, then Demo Night on Nov 27."
  Source: "Build plan for the 36 hours" (36 hours, three gates, Demo Night on Nov 27 from 15:00 to 18:00).
- Subscribe form: placeholder "you@example.com", button "Subscribe". No backend.
- Note: "One note per gate. This testnet build stores no emails." (true: the form has no backend.)

## Milestones (newest first)

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

## Detail bodies (Lead paragraphs, H3 headings)

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

## Entry page chrome

- Back link: "All milestones". Subscribe card: "Get a note at each gate" / "Follow the build on the milestones page. No emails yet."
- List link text: "Read the full update" (template wording kept).

## Page CTA (content plan default)

"Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the team." Secondary
"Read the rules" `/features`, primary "Launch app" `/app`.
