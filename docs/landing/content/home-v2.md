# Home and use cases, v2: what is on the page and where the copy comes from

The second pass on the landing, after the owner's briefs. New sections reuse the template's own patterns, named
below, and speak in a founder's voice ("we"), short and plain. Every outside fact is cited in
`docs/landing/sources.md`; rule behaviour comes from `docs/DESIGN.md` and, for the exit, from
`contracts/src/vault/CovenantVault.sol`.

## Home order

Hero, The problem today, Who named this problem, Features (the five rules), Lifecycle, How it's built, Agent layer,
Use cases, Launch on Four.meme, Quote, Why we built it, Closing CTA. The fees, FAQ and milestones sections are gone
from the home page, and `/pricing` and `/changelog` redirect home (owner's request). The FAQ stays on `/contact`.

## Hero

- Heading "The operating stack for autonomous ventures." Subheading "Capital, budgets and exits for businesses run by
  AI agents. Enforced by code, not courts. 24/7 on BNB Chain." (verbatim; also the footer line and the metadata).
- Under the buttons: "Built on [Flap] Flap Pool Launch · Data by [CoinMarketCap] CoinMarketCap". "No fees in v1" is
  removed here and from the CTA and contact promises; the fee facts live only where they explain fees.
- Every "BNB" and "BNB Chain" in copy carries the BNB Chain mark inline (`components/Bnb.tsx`, `bnb()`), cap height,
  on the baseline, never split from its word. The same component draws the Flap, CoinMarketCap and Four.meme marks.
- Built-on ticker: Flap, Atlas, CoinMarketCap, PancakeSwap, Four.meme, ERC-8004, Cournot, BNB Chain, each with its own
  mark (`web/public/landing/logos/SOURCES.md`).

## The problem today (from the template's "Stats")

Two short stories, picked with the template's pill tabs: "Token raises" and "Agents holding money". Each has an
illustrative curve (labelled as such) with four markers, an axis, and four step cells in the Stats cell pattern. The
story plays itself while on screen (a progress line on the active step) until someone picks a step or a story; the
numbers count up the first time they appear. Each cell links its source. The demand row ($580M, 92.2% refunded above
the caps) closes the section.

## Who named this problem (a source slider)

Five sources, in the owner's order: Buterin's DAICO post (2018), Buterin on a $100 daily limit before human
confirmation (2026), BNB Chain on agent finance (21 May 2026), Dixon and Harkavy at a16z crypto (May 2026), MetaDAO's
docs on ownership coins. Left, the sources as tabs (name, date, topic) with a progress underline; the slider
advances every 7 seconds and pauses on hover or focus. Right, a framed card with corner marks: the dated exact quote,
who said it, checks (dated, source linked, exact quote), Covenant's answer and the link. Arrow keys, the arrows,
clicks and swipes move it. All five cards share one grid cell, so the frame never changes height.

## Lifecycle (the /features Capabilities grid)

Six Feature Cards: Create, Raise, Settle and launch, Operate, Exit round, Unlock or wind down.

## How it's built (a system diagram)

One covenant as a diagram on a white plate: the Covenant vault in the middle, each integration a pill node wired to
it, the whole inside a dashed BNB Chain frame. The active node lights its wire (with a moving pulse and a label for
what flows), and the card beside it says what the piece does in Covenant, what breaks without it, and its status
(Live API, Live on testnet, Proven on mainnet fork, Planned), with exactly how we use it (functions, endpoints)
and its contract addresses as short BscScan links with a copy button. Hover, focus, click or the slow autoplay. The
facts live in `content/integrations.ts` and also feed the /features integrations tiles. Atlas: the BNB/USD push
feed on BNB testnet, which CovenantOracle takes at deployment; Cournot is planned.

## Use cases

The owner's five, all on the home page (two wide cards over three): working capital (AI agent), community round,
inference agent, self-owning machine, protected tier (launchpad). Covers are live cards over the hero's sky photo
(`sections/usecases/Cover.tsx`), one product moment each, with its key number large. Icons are the template's
Phosphor set. /use-cases: hero, featured case, stats, jump links, one block per case, the jobs quote wall.

## Launch on Four.meme

Three steps in the Capabilities grid (pick the template, tax flows to the vault, holders stay protected), a button to
`/app/create?venue=fourmeme`, and a plain line that this is the lighter covenant (tap and abandonment switch, no raise,
no book-value exit) and that Flap Pool Launch carries all five rules.

## Why we built it (prior art)

A founder note beside the heading "We didn't invent the idea. We made it hold without a vote.", then four cards in
the hairline grid: the DAICO, ownership coins (MetaDAO), bonding-curve launchpads, locks and vesting. Each says what it
gets right, where it leaves holders and what we took, with its sources.
