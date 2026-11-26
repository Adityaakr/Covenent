# /features copy and sources

Every fact below is from `docs/DESIGN.md`; the section of DESIGN.md is given in brackets.

## Features Hero

- Eyebrow: Rules
- Heading: Five rules that bind the team. (content-plan "/features")
- Body: Covenant writes investor protections into the launch, and they bind a human team or an AI agent the same way.
  [Summary: "the core ones into the launch itself"; "The same contracts work when the issuer is an AI agent"]
- Buttons: Talk to the team `/contact` (secondary), Launch app `/app` (primary).

## Board Showcase (covenant lifecycle board)

- Bar: "Covenant · Lifecycle", filter "Group by state". Columns are states [How Covenant works > States].
- RAISING: "Commitments open" / "4 day sale window" [Appendix A: sale window 4 days];
  "Oversubscribed 2.8x" / "1,400 BNB committed" [Where the money goes: a worked example].
- ACTIVE: "Tap accrues" / "4% of treasury per 30 days" [Rule 1: tap; Appendix A tap cap];
  "Price recorded" / "Poked hourly" [Lifecycle > Operate; Time-weighted price: a keeper pokes hourly].
- EXIT_ROUND: "Round open, tap paused" / "7 days" [Lifecycle > Exit round; States: EXIT_ROUND tap paused];
  "Redeemed 6,000,000 tokens" / "2.534 BNB" [Rule 3 worked example].
- WIND_DOWN: "Silent for 45 days" / "Abandonment switch" [Rule 4];
  "Locked team tokens burned" / "Redemption with no fee" [Lifecycle > Wind-down; Rule 4].

## Capabilities (six cards)

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

## Dependencies (exit round timeline)

- Eyebrow: Book-value exit
- Heading: "An exit that runs on a clock." / "Three trusted days below book open a 7 day round. A 14 day cooldown follows
  before it can arm again." [Rule 3; Appendix A: exit streak 3 trusted days, round 7 days, cooldown 14 days]
- Points: "Compares pool price with treasury per token, both on-chain" [What the oracle does and does not decide];
  "Any holder can burn tokens for a share of the treasury" [Lifecycle > Exit round];
  "The tap pauses while the round is open" [States: EXIT_ROUND, tap paused].
- Bars: "Exit streak · 3 trusted days", "Exit round · 7 days", "Cooldown · 14 days" [Appendix A].
- Note: "Round open. A holder redeemed 6,000,000 tokens for 2.534 BNB." [Rule 3 worked example]

## Integrations (eight tiles)

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

## Security (trust assumptions)

- Eyebrow: Trust assumptions
- Heading: "Trust assumptions, stated up front." / "Every one is shown on the covenant sheet, in plain words."
  [Trust assumptions, all shown on the covenant sheet]
- No admin keys: "No owner, no pause and no fee switch." [Trust assumptions]
- Guardian upgrades only: "Flap’s Guardian is the only path to upgrade a vault." [Trust assumptions; Flap > Upgrades]
- Exit needs no oracle: "Atlas cannot open or block a round. Both prices are on-chain." [Trust assumptions: Atlas
  "cannot open or block an exit round, because book value and pool price are both read on-chain"]
- Liquidity locked: "The PancakeSwap V2 pair is locked at launch and cannot be pulled." [Trust assumptions]

## Page CTA

- Heading "Raise under rules. Exit at book." Body "Five rules hold the treasury. Nobody has to trust the team."
  (content-plan "Page CTA default"). Secondary "Talk to the team" `/contact` (the page is /features, so the default
  "Read the rules" link would point to itself), primary "Launch app" `/app`.
