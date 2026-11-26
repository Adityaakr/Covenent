# /use-cases copy and sources

Every fact below comes from `docs/DESIGN.md`. Section names in quotes are DESIGN.md headings.
Quotes are "Jobs to be done" lines or pitch lines, attributed to a role, never to a person.

## Customers Hero
- Eyebrow "Use cases". H1 "Raises that bind the team." / "From AI agents to launchpads." (content-plan.md).

## Featured Story (AI agent, featured item)
- See item 1 below. Link text "Read the use case".

## Customer Stats (covenant default terms, "Appendix A: default parameters")
| Value | Label | Source |
| --- | --- | --- |
| 60% | of the sale price backed by the treasury at launch | "Where the money goes": book value per token is 60% of the sale price; "Book value" table (default split 0.60) |
| 4% | of the treasury per 30 days, the most the tap can pay | "Rule 1: tap": default cap 4% of the treasury per 30 days |
| 3 days | below book value, on on-chain prices, open an exit round | "Rule 3" as built: the streak reads on-chain numbers only and decays instead of resetting (CovenantVault.sol) |
| 45 days | of team silence open the treasury to holders | "Rule 4": now > lastHeartbeat + 45 days -> declareAbandoned(); wind-down opens redemption |

## All Stories
- Eyebrow "Use cases". H2 "One vault, the same five rules." / "Five ways to put them to work."
  ("How Covenant works": one launcher and one vault; five rules, "Summary").

## Quote Wall
- Eyebrow "Jobs to be done". H2 "What each side needs from a raise." / "Written as jobs, answered by rules."
- Cards = items 2 to 4 (template offset 1, limit 3): the community round, inference agent and self-owning machine "Jobs to be done" lines.

## Page CTA (both pages)
- "Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the team."
  Read the rules `/features`, Launch app `/app` (content-plan.md default).

## Use cases (`content/useCases.tsx`)

### 1 to 5. The owner's five cases

Full copy and sources: `content/home-v2.md` ("Use cases") and `docs/landing/sources.md` ("Use cases"). Slugs:
`ai-agent-working-capital` (featured), `community-round`, `gpu-inference-agent`, `machines-that-own-themselves`,
`launchpad-protected-tier`. Each carries the situation, what goes wrong today with links, the five rules applied, the
limit, and an illustrative covenant sheet on DESIGN.md's default terms.

Covers: the template's neutral architecture and interior photos 1 to 5, reused as covers only.
