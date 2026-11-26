# Covenant: investor protections that enforce themselves

> **Design document of 26 Nov 2026.** Where it differs from the code, the code wins (the contracts' NatSpec,
> [README.md](../README.md), [server/README.md](../server/README.md)). The known differences:
> - **Exit.** The exit streak runs on on-chain numbers only (pool TWAP against book value, no Atlas, no depth gate), and
>   it **decays** above book instead of resetting to zero. The depth gate applies to unlocks and the tap rate only.
> - **Disclosure (rule 5).** Reports are posted on chain. The Cournot check is planned: the vault hook exists, but no
>   relayer runs, so no report check pauses the tap today.
> - **Vault views.** The accrued tap is `owedTeam()`; there is no `tapAccrued()`.
>
> Live status and evidence: [JUDGES.md](../JUDGES.md), [docs/DEPLOY.md](DEPLOY.md), [docs/KNOWN-ISSUES.md](KNOWN-ISSUES.md).

## Summary

Covenant is a launcher and vault for token raises on BNB Chain that binds the team after the money comes in. Five rules, enforced by contract and a verified price feed, replace the trust a buyer normally has to extend.

The pitch in one line: tokens are sold to the public with none of the protections investors get elsewhere, and Covenant writes the core ones into the launch itself.

The same contracts work when the issuer is an AI agent, and that is where they matter most. An agent cannot be sued, can be hijacked and can simply stop. The agent layer section covers that case and puts an agent at the center of the demo.

|  |  |
|---|---|
| What it is | A Flap Pool Launch launcher (the raise) plus a vault (the treasury and the team's tokens) governed by fixed rules |
| Who it is for | Teams that want to raise credibly, buyers who want a floor under what they buy, launchpads that want fewer rugs |
| The five rules | Tap, performance unlock, book-value exit, abandonment switch, disclosure (stretch) |
| What enforces them | Smart contracts, a time-weighted pool price, and signed Atlas reports behind a trust gate |
| Built on | Flap Pool Launch (primary), OpenFour tax vault template (port), Atlas and CoinMarketCap data, Cournot for disclosure checks |
| Closest precedent | MetaDAO's ownership coins on Solana. Same promise, different engine: rules and a feed instead of decision markets |

### What the rules do

Tap. The team can withdraw a fixed dollar budget per month, capped as a share of the treasury, and nothing more.

Performance unlock. Team tokens unlock only when the token has held a multiple of the sale price over a sustained window, measured on a price the feed marks as trusted.

Book-value exit. If the token trades below treasury value per token for three trusted days, an exit round opens and any holder can burn tokens for a pro rata share of the treasury.

Abandonment switch. If the team stops showing up, the treasury opens to holders permanently.

Disclosure (stretch). A missed or failed monthly report pauses the tap until it is cured.

### What the first build covers

CovenantLauncher and CovenantVault launching through Flap's Portal: on BNB testnet if Flap enables our factory, on a fork if not.

An oracle contract that combines the pool's time-weighted price with signed Atlas reports.

A tax vault template that brings the tap and the abandonment switch to Four.meme tokens.

A web app with a raise page, a live covenant sheet per token, a redeem flow and a launch simulator on CoinMarketCap data. An MCP server lets AI agents read terms, commit and redeem, and a reference issuer agent lives on its tap.

A scripted three-minute demo: an oversubscribed raise, a tap claim, a slide under book value that pays a holder, and an abandoned project that opens its treasury.

## Problem and evidence

Token buyers hand over money at launch and get no enforceable claim on it afterwards. The data shows what that produces.

| Finding | Number | Source |
|---|---|---|
| Pump.fun tokens (Jan 2024 to Mar 2025, 7M+ tokens with at least 5 trades) that fell below $1,000 of liquidity | 98.6% | Solidus Labs, May 2025 |
| Raydium pools showing soft rug pull traits | 93% of 388,000 pools | Solidus Labs, May 2025 |
| Tokens on BNB Smart Chain and Ethereum that were active for less than one day (data to March 2022) | about 60% | Cernera et al., USENIX Security 2023 |
| Share of tokens created by the top 1% of creator addresses | 20% to 25% | Cernera et al., USENIX Security 2023 |
| Profit taken by one-day rug pulls, most common on BNB Smart Chain | about $240M | Cernera et al., USENIX Security 2023 |
| BSC meme coins that had gone inactive about two months into the study window | 80.96% | MemeChain, arXiv 2601.22185 |
| Capital committed to MetaDAO's protected raises across 14 launches, and the share refunded because raises were capped | $580M committed, 92.2% refunded | Basis Point, Aug 2026 |

The last row is the demand signal. Buyers offered roughly thirteen times more money than protected raises could accept.

### Four ways a launch fails its buyers

The money leaves in one piece. The team controls the whole raise on day one. Nothing ties spending to progress.

Insiders are paid by the calendar. Vesting unlocks on dates, whether or not the token is worth anything by then.

Buyers cannot get out at fair value. When confidence drops, the only exit is selling into a thin pool, even if the treasury still holds most of the raise.

Projects fade instead of closing. A team that stops working keeps the keys. Holders wait for updates that never come.

### Why the usual fixes fall short

Liquidity locks protect the pool. They say nothing about the raise or the treasury.

Vesting contracts fix timing, not results. A team can vest fully into a dead token.

Token votes need turnout and a majority, and treasuries usually sit with the team. ROOK holders got about $25M back, roughly 60% of the treasury, only after an activist campaign (CoinDesk, Apr 2023). Aragon dissolved and put 86,343 ETH into a redemption contract after a long gap between treasury value and market cap (Blockworks, Nov 2023).

Decision markets work on Solana through MetaDAO, but they need liquid pass and fail markets for every proposal, plus a legal entity per project (RockawayX).

### Why now, on BNB Chain

Flap announced Pool Launch on Nov 4, 2026: tokens start in a DEX pool, and developers can write their own launchers and vaults (Odaily, Flap example repo). It makes both the raise and the treasury programmable by third parties.

Four.meme's OpenFour lets anyone publish a tax vault template and earn a royalty when tokens adopt it (OpenFour docs).

Atlas, the oracle backed by CoinMarketCap, ships Chainlink-compatible feeds and signed pull reports that a small contract can verify (Atlas docs).

The pieces needed to enforce investor protections in code are now all on BNB Chain. We have not found a project that assembles them.

## Research foundations

Each rule in Covenant is an old idea from finance, moved from a legal contract into a smart contract. The table maps rule to source.

| Rule | The idea it rests on | Where it comes from |
|---|---|---|
| The whole design | When buyers cannot tell good projects from bad, good ones must send a signal that bad ones cannot afford to copy. | Akerlof (1970) on lemons markets. Leland and Pyle (1977) on insiders keeping skin in the game. Grossman (1981) on warranties as a quality signal. |
| Tap | Releasing money in stages limits how much a manager can waste before investors can react. | Jensen and Meckling (1976) on agency costs. Gompers (1995) on staged venture financing. Buterin's DAICO (2018), which adds a per-second tap the team can lower but not raise. |
| Performance unlock | Pay tied to observable results beats pay tied to time. | Holmstrom (1979) on moral hazard. Jensen and Murphy (1990) on performance pay. MetaDAO's price-multiple tranches at 2x to 32x with a three-month average (Basis Point). |
| Book-value exit | A fund trading below the value of its assets is a known problem with a known cure: let holders redeem at asset value. | Lee, Shleifer and Thaler (1991) on closed-end fund discounts. Bradley, Brav, Goldstein and Jiang (2010) on activists forcing funds to open. Moloch DAO's rage quit. |
| Abandonment switch | Control should pass to investors in bad states of the world. | Aghion and Bolton (1992) on state-contingent control. Smith and Warner (1979) on bond covenants that trigger on default. |
| Disclosure | Issuers that disclose and commit do better. | Howell, Niessner and Yermack studied 1,500+ ICOs that raised $12.9B. Success tracked disclosure, credible commitment to the project and quality signals (NBER w24774, Review of Financial Studies 2020). |

### What the precedents teach

DAICO (2018). Buterin's design has two holder powers: raise the tap by vote, or vote to shut down and withdraw the remaining funds pro rata. He also lists a tap priced in dollars through a price feed as a variation (ethresear.ch). Covenant keeps the tap and the pro rata refund. It replaces the vote with a rule.

MetaDAO (2025 to 2026). The closest live system. Raises last four days with a cap and pro rata refunds. About 80% of the raise goes to a treasury and the rest seeds liquidity. Teams get a fixed monthly allowance and price-based token tranches (Basis Point). Holders can propose liquidation through decision markets. Ranger was about 14x oversubscribed, with $86.4M committed against a $6M minimum, and was later liquidated by proposal with USDC returned to holders (RockawayX).

What went wrong there. Treasury value is not a guarantee: several coins traded below it for long stretches. On Nov 1, 2026, LOYAL sat about 7% below treasury value per token, P2P about 15% and NECTAR about 36% (01Resolved). Closing that gap needs a full liquidation proposal to pass. A holder who wants out alone has no path except selling at the discount.

Treasury raids (2023). Rook and Aragon show the demand for exit at asset value, and how slow and hostile it is when the only tool is a governance fight (CoinDesk, Blockworks).

### The gap Covenant fills

None of these systems gives a single holder an exit at treasury value without a vote, a market or a lawyer. Covenant's book-value exit does that with one rule and one price check. The other four rules stop the treasury from being emptied before that exit matters.

## Who it is for

Covenant has three users, and the product only works if all three get something.

| User | Their problem today | What Covenant gives them |
|---|---|---|
| A team raising money (an app, a game, an AI agent with revenue, a company testing tokenized shares) | No way to prove it will not run with the raise, so it is priced like every other launch | A commitment it can opt into at launch and buyers can verify on-chain, while keeping a monthly budget it controls |
| A buyer (raise contributor or later holder) | Cannot tell an honest team from a dishonest one, and has no recourse after buying | A floor at treasury value, team tokens that cannot be sold early, and an exit that needs no vote and no permission |
| A launchpad and its chain (Flap, Four.meme, BNB Chain) | Rugs are a reputational cost and keep serious teams away | A launch type that attracts real projects, plus template fees |

### Jobs to be done

As a team, I want to raise in public and show buyers exactly what I can and cannot do with their money.

As a contributor, I want to know the worst case before I commit: what I get back if the project fails.

As a holder, I want to leave at a fair value when the market has given up, without waiting for anyone's approval.

As a launchpad, I want launches I can feature without vouching for the team myself.

### What Covenant is not

Not a DAO framework. There are no proposals and no votes in v1. The rules are fixed at launch.

Not legal ownership. It protects the money and the token supply on-chain. It does not give holders a claim on a company, its IP or its off-chain revenue.

Not a tool for five-minute meme launches. It works for them, but the design assumes a team that plans to be around for months.

## How Covenant works

A covenant is one launcher and one vault with terms that are fixed at creation. It moves through six states, and every transition is a rule anyone can trigger.

Green marks the three states where holders take BNB out: a failed raise, an exit round and a wind-down. Wind-down can be entered from any live state, not only from active.

### Lifecycle

Create. The team calls Flap's Portal.newLauncher with our launcher factory and the terms: supply split, minimum and cap, sale window, tap, unlock tranches, exit and heartbeat settings. Nothing can be edited later except lowering the tap.

Raise. Anyone commits BNB during the sale window. Commitments are not capped, so the raise can be oversubscribed.

Settle. After the deadline anyone calls finalize(). Below the minimum, every contributor refunds in full. Above the cap, each commitment is scaled down pro rata and the excess is refundable.

Launch. In the same transaction the launcher calls Flap's launchTaxTokenV2. Flap deploys the token, seeds the PancakeSwap V2 pool at the sale price, and asks our vault factory to create the vault. Sale and team tokens go to the vault. The launcher forwards the treasury share of the raise to the vault.

Operate. Contributors claim tokens. Trading tax flows into the treasury. The team draws its tap. A keeper, or anyone, calls poke() about once an hour to record prices.

Exit round. If the token trades below book value for 3 trusted days, a 7 day round opens. Any holder can burn tokens for their share of the treasury. The tap is paused. A 14 day cooldown follows.

Unlock. A team tranche unlocks when the dollar price holds above its multiple for 30 trusted days, after the cliff.

Wind-down. If the team is silent for 45 days, or chooses to close, the tap ends, locked team tokens are burned and redemption stays open with no fee.

### States

| State | What is true | How it ends |
|---|---|---|
| RAISING | Commitments open. Refunds not yet possible. | Sale deadline, then finalize() |
| FAILED | Minimum missed or the launch call reverted. Full refunds only. | Terminal |
| ACTIVE | Tap accrues. Tax accrues. Prices are recorded. Exit trigger armed. | Exit trigger or wind-down trigger |
| EXIT_ROUND | Redemption open at book value. Tap paused. | Round length passes |
| COOLDOWN | Same as active, exit trigger disarmed. | Cooldown passes |
| WIND_DOWN | Tap ended. Locked team tokens burned. Redemption open forever. | Terminal |

### Where the money goes: a worked example

Supply is 1,000,000,000 tokens: 60% sale, 15% pool, 25% team (locked). Minimum raise 200 BNB, cap 500 BNB.

| Step | Amount |
|---|---|
| Committed by buyers | 1,400 BNB (2.8x oversubscribed) |
| Accepted | 500 BNB |
| Refunded pro rata | 900 BNB (each buyer keeps 35.7% of their commitment in the sale) |
| Sale price | 500 / 600M = 0.000000833 BNB per token |
| Pool seed | 125 BNB + 150M tokens, so the pool opens at the sale price |
| Treasury | 375 BNB, held by the vault |
| Book value per token | 375 / 750M = 0.0000005 BNB, which is 60% of the sale price |

A buyer who committed 14 BNB ends with 6,000,000 tokens for 5 BNB and a 9 BNB refund. From day one, 3 BNB of that 5 BNB is backed by the treasury and can only leave through the five rules.

## The rules in detail

Every rule is a formula over numbers the vault can read on-chain. This section gives the formula, the default and the edge cases for each.

Symbols: S total supply, A sale tokens, P pool tokens, E team tokens, C total committed, Q accepted raise, T treasury in BNB, R redeemable supply, b book value per token, p pool price in BNB.

### The raise

$$
Q = \min(C, \text{cap}), \qquad q_i = \left\lfloor c_i \cdot \frac{Q}{C} \right\rfloor, \qquad a_i = A \cdot \frac{q_i}{Q}
$$

Buyer i committed c_i, keeps q_i in the sale, is refunded c_i - q_i, and receives a_i tokens.

If C is below the minimum, state becomes FAILED and everyone refunds c_i.

Sale price is p0 = Q / A. The pool is seeded with Q_pool = Q * P / A and P tokens, so it opens at exactly p0. This needs P <= A.

Treasury starts at T0 = Q - Q_pool, less a buffer of one wei per contributor so the floors in q_i never leave a refund short. Once every refund has been claimed, anyone can call sweepDust() and the leftover buffer goes to the treasury as revenue; refunds stay claimable forever.

If Flap's launch call reverts for any reason, the launcher catches it and moves to FAILED. A failed launch never traps funds.

There is no per-wallet cap, by design: commitments are uncapped, the raise can be oversubscribed, and above the cap every commitment is scaled back pro rata and the excess refunds. Refunds and sale tokens are pull payments (claimRefund on the launcher, claimTokens on the vault), never pushed; the app, the keeper's alerts and the MCP get_claimable tool remind contributors.

Before a raise opens, the launcher factory refuses terms Flap's launch would refuse at finalize, so money is never raised for a launch that cannot happen: a name or symbol on Flap's blocklist (isScamWord on Flap's anti-scam module, the one the Portal's launch facet calls; a module that does not answer refuses creation too), tax terms the Portal refuses (the higher of the two rates under 1% or either over 10%, a tax shorter than the anti-farmer window), and a minimum raise whose pool seed Q_pool misses Flap's graduation floor with a safety margin. The factory asks the Portal's graduationFloorV2, with our vault factory so Flap's BNB price and multiplier apply, whether the seed less a third (FLOOR_MARGIN_BPS = 1.5x) still meets the floor. Flap's creation floor is $750 x S / P; twice that is the graduation floor, at which Flap marks the token graduated in the launch transaction (FlapTokenGraduated). The production factory needs the graduation floor with the margin (at $700 per BNB and a 15% pool: a 21.43 BNB seed, an 85.71 BNB minimum raise at 60% sale), because the Portal reads its price and the multiplier again at finalize: the margin absorbs a one-third fall in Flap's BNB price, or a 1.5x higher multiplier, during the sale. The demo factory (minute timers, for the stage and testnet) needs the creation floor with the same margin, so its tokens launch but may not graduate. minRaiseFor(S, A, P) reports the minimum. The Portal checks again at launch; a refusal then still ends in FAILED with full refunds. On BNB Chain and BNB testnet the factories accept only Flap's own Portal, Guardian, Token Dock router and name screen at construction.

### Book value

R = S - \\text{dead} - \\text{lockedTeam}, \\qquad b = \\frac{T - \\text{owedTeam}}{R}, \\qquad \\frac{b_0}{p_0} = \\frac{A - P}{A + P}

dead is the token balance of the burn address. lockedTeam is team tokens still locked in the vault. owedTeam is tap already accrued but not yet claimed.

Tokens sitting in the pool count in R. That makes b invariant to trading: buying or selling on the pool never changes anyone's book value. If pool tokens were excluded, every purchase from the pool would dilute holders.

Locked team tokens do not count. If every outside holder exits, the team cannot claim what is left through its locked allocation.

| What happens | Effect on b |
|---|---|
| Trade on the pool | None |
| Redemption at book | None, or a small rise when an exit fee applies |
| Trading tax arrives | Rises |
| Team draws the tap | Falls |
| Team tranche unlocks | Falls: the unlocked tokens join R |

The split sets the starting floor. More pool tokens means deeper liquidity and a lower floor.

| Sale A | Pool P | Share of raise seeding the pool | Starting floor b0 / p0 |
|---|---|---|---|
| 70% | 10% | 14.3% | 0.75 |
| 60% | 15% (default) | 25.0% | 0.60 |
| 60% | 20% | 33.3% | 0.50 |
| 50% | 20% | 40.0% | 0.43 |

### Rule 1: tap

The team's budget is set in dollars per 30 days and paid in BNB at the Atlas BNB/USD rate. It is capped as a share of the treasury.

\\text{accrued}(\\Delta t) = \\Delta t \\cdot \\min\\left( \\frac{\\text{tapUsd}}{30\\text{d} \\cdot \\text{bnbUsd}},\\; \\frac{\\text{capBps}}{10^4} \\cdot \\frac{T}{30\\text{d}} \\right)

Default cap is 4% of the treasury per 30 days. With 375 BNB the cap is 15 BNB in the first month.

The team can lower tapUsd at any time. Nobody can raise it in v1.

Accrual pauses during an exit round and ends at wind-down.

claimTap() pays the accrued amount to the team wallet fixed at creation. It also counts as a heartbeat.

The floor falls as the team spends. With the cap binding, no tax income and no redemptions:

| Months after launch | Treasury left | Floor as a share of sale price |
|---|---|---|
| 0 | 100% | 60.0% |
| 6 | 78.3% | 47.0% |
| 12 | 61.3% | 36.8% |
| 24 | 37.5% | 22.5% |

### Rule 2: performance unlock

Team tokens unlock on price, not on dates. Default tranches: 5% of supply at 2x, 10% at 4x, 10% at 8x, measured against the sale price both in dollars and in BNB.

Each poke() yields the time-weighted pool price since the last one, converted to dollars with Atlas.

For tranche k, a counter adds the interval when the observation is strict and the price is at or above m_k times the sale price in dollars (TWAP x Atlas BNB/USD against the dollar sale price) and in BNB (the pool TWAP against Q / A, no oracle). The BNB leg reads only the pool, so one Atlas signer's bad rate, high or low, cannot advance an unlock counter by itself; the dollar leg keeps the team from unlocking on a BNB rally the token did not share. The interval of a strict observation runs from the previous poke that carried a rate, and the price must hold over it and over the time since the last poke of any kind (when that is at least the poke gap long); otherwise the counter resets. An interval longer than maxStep (6 hours) resets it too: unlock time is continuous strict time. A trusted observation without a verified rate never adds time; it resets each counter whose multiple the TWAP misses at the last verified rate, and all of them when that rate is more than maxStep old or the pool holds under half its seed (Flap re-review F4; pre-audit H-1). So no one can hide a dip from the counters by poking without a report, and a poke without a report at a price that holds the multiple changes nothing. An untrusted one (no valid TWAP) leaves it unchanged.

The tranche unlocks when its counter reaches 30 days and the cliff (6 months) has passed. Continuous strict time before the cliff counts toward the 30 days, so the first strict observation after the cliff can unlock at once if the counter is already full.

The dollar sale price behind the dollar targets is fixed in the launch transaction from the oracle's push feed when one is fresh; otherwise the first verified rate sets it, and for staleAfter after that a higher verified rate raises it, a lower one never lowers it (pre-audit M-2). A poker who waits for a BNB/USD dip cannot lower the targets, and the BNB leg needs the real multiple anyway.

Unlocked tokens are ordinary tokens. They join R, so each unlock dilutes book value: after all three tranches, b is 0.75 of what it would otherwise be. This is disclosed on the covenant sheet.

At wind-down, tranches still locked go to the burn address.

### Rule 3: book-value exit

A streak counter adds trusted time while the interval price is below b. A trusted observation at or above b takes the same time off it: the streak decays, it does not reset (exit fix 1), so an hour above book cancels an hour below, not three days.

When the streak reaches 3 days, an exit round opens for 7 days.

During the round, redeem(x) takes x tokens, sends them to the burn address and pays x * b * (1 - fee). Default fee is 1% and stays in the treasury.

After the round, a 14 day cooldown runs before the trigger can arm again. In a permanent discount the tap is paused at most 29% of the time (7 of every 24 days).

Worked example: treasury 320 BNB, R = 750M, so b = 0.000000427 BNB. The pool trades at 0.00000035, about 18% under book, for three days. A holder redeems 6M tokens and receives 2.534 BNB. Selling on the pool would pay about 2.1 BNB before tax and slippage. Book value for everyone else moves from 0.00000042667 to 0.00000042670.

Why a round and not an always-open window: with redemption always open, arbitrage pins the price at book and a paused tap could starve an honest team for months. A round gives doubters a clean exit, then lets the people who stayed fund the team again.

Why the trigger is hard to abuse: to open a round, the price must sit below book for three days. Anyone pushing it there is selling tokens for less than the treasury will pay for them. The seller loses and the buyers gain.

### Rule 4: abandonment switch

Any team action is a heartbeat: heartbeat(), claimTap(), lowerTap(), postReport().

If now > lastHeartbeat + 45 days, anyone can call declareAbandoned(). Unclaimed tap is forfeited back to the treasury.

The team can also call windDown() to close honestly. Tap accrued up to that moment stays claimable.

Both paths end in WIND_DOWN: no more tap, locked team tokens burned, redemption open with no fee and no deadline.

### Rule 5: disclosure (stretch)

The team posts a report each period: postReport(period, uri, hash).

A Cournot market per period asks whether the report exists and matches on-chain facts. The verdict is relayed to the vault.

A missing or failed report pauses tap accrual until a passing one lands.

### Design choices worth defending

| Choice | Alternative considered | Why this one |
|---|---|---|
| Exit by rule | Exit by vote or decision market | Works for one holder, needs no turnout and no market liquidity |
| Exit rounds | Always-open window with hysteresis | Bounded pause on the tap, simpler state machine |
| Pool tokens count in R | Exclude pool tokens for a higher floor | Book value cannot be diluted by buying from the pool |
| Dollar tap and dollar unlock | BNB-denominated | A 2x that is only BNB moving is not performance |
| No governance in v1 | Holder vote to raise the tap | Less to build and audit, fewer attack paths |

## Data and oracle design

Covenant needs three numbers it cannot make up: the token's price in BNB, the BNB price in dollars, and a signal for when either should not be trusted. The pool gives the first and Atlas gives the other two.

### Which data does which job

| Job | Source | Why this source |
|---|---|---|
| Token price in BNB, time-weighted | PancakeSwap V2 pair cumulative prices, read on-chain | Exists from the first block of trading, needs no feed, cannot be moved by a single trade |
| BNB price in dollars | Atlas BNB/USD (signed pull report first, push feed as fallback) | Sets the dollar tap and the dollar unlock multiples |
| Token price across venues | Atlas feed for the token, once one exists | Cross-check against the pool once the token trades elsewhere |
| Trust signal | Report freshness, pool depth, pool against Atlas agreement, and Atlas status when exposed on-chain | Decides whether time counts toward a trigger |
| History and context off-chain | CoinMarketCap DEX API | Covenant sheet, alerts and the launch simulator |

### What Atlas exposes today

Read from the Atlas docs and the interface repo on Nov 25, 2026.

| Mode | How a contract reads it | Notes |
|---|---|---|
| Push, single feed | latestRoundData() on an ISingleFeed, Chainlink AggregatorV2V3 compatible (reference) | startedAt is the off-chain aggregation time, updatedAt the on-chain time. Only the latest round is stored. |
| Push, multi feed | fetch(bytes4 feedId) returns PriceSnapshot { price, aggregatedTs, onchainTs } (reference, interfaces) | One contract, many feeds |
| Pull | Signed report appended to calldata, verified in the consumer with _getVerifiedFeedData(feedId) (guide) | Stateless. Reference limits: maxDelay 180 s, maxFutureDrift 60 s. Needs an API key and feed ids from Atlas onboarding. |

Two facts shape the build:

Push feeds can be read-restricted. In whitelist mode only approved contracts can read. Our adapter must be whitelisted, or the feed must be in open-read mode (push guide). Pull mode has no such gate, so it is our first choice.

Status is not in the published interfaces yet. The Consensus Score page describes a score, six statuses and a reason code per feed. The push and pull interfaces we read return a price and timestamps only, and the data quality page lists the score as coming soon. This is question one for the Atlas team on site.

### The trust gate

As built, the oracle has two levels. Trusted means the pool TWAP is valid; that is all the exit streak needs. Strict additionally needs a verified, fresh BNB/USD rate (a signed pull report or a fresh push round) and a pool holding at least half its launch seed; only strict observations add unlock time, and a trusted observation that is not strict can only reset unlock counters (rule 2). The tap is priced at the verified rate that rides along, else at the last verified rate. The checks below are the full design; the token-feed agreement and the Atlas status gate wait for Atlas to publish them on-chain and are not in the code.

The Atlas BNB/USD report verifies and is no older than maxDelay.

Its timestamp is not older than the last one accepted. Atlas notes that a signed report can be replayed inside its freshness window, so we enforce monotonic timestamps.

The pool's BNB reserve, valued at the window's TWAP on the pool's own invariant (sqrt(k x TWAP), which no swap can lower inside a block), is at least half of the launch seed.

If a token feed is configured, the pool price and the Atlas price agree within 10%.

If Atlas status is readable on-chain, it is one the counter accepts (table below).

| Atlas status | Score | Counts toward exit streak | Counts toward unlock and tap rate |
|---|---|---|---|
| HEALTHY | at least 0.85 | Yes | Yes |
| DEGRADED | 0.65 to 0.85 | Yes | Yes |
| WARNING | 0.40 to 0.65 | Yes | No |
| CRITICAL | below 0.40 | No | No |
| SPLIT_MARKET | two price camps | No | No |
| UNKNOWN | not enough data | No | No |

The gate is stricter when it pays the team than when it protects holders. At CRITICAL, Atlas publishes the last trusted value and stops advancing, so on a push feed the timestamp simply ages out and check 1 fails (Consensus Score).

Atlas's own stress cases show why the gate matters for a new token: a roughly 7x price inflation on one DEX against other venues scores 0.10 and flips to SPLIT_MARKET, and a +2000% spike on a thin venue scores about 0.45 (Consensus Score). Those are exactly the moves a team would try in order to fake an unlock.

### What the oracle does and does not decide

The exit rule compares two BNB numbers the vault can read itself: pool price and treasury per token. It works with no oracle, and in the code it uses none. A cross-venue check against an Atlas token feed is design only: no token feed is configured and the code has no such check.

The tap and the unlock are different. Both are set in dollars, so both depend on Atlas for every step. That is the honest split: the oracle is a guard for rule 3 and the engine for rules 1 and 2.

### Time-weighted price

Each poke() reads the pair's cumulative price and timestamp, in the style of the Uniswap V2 oracle. The average since the previous poke is the difference in cumulative price divided by elapsed time.

Pokes are at least 1 hour apart, on two clocks (Flap re-review F5): a poke without a rate waits an hour after the last poke of any kind; a poke with a verified rate waits an hour after the last poke with a rate only. So nobody can use up the slot of the keeper's report by poking without one first, and every unlock interval is at least an hour long. A keeper pokes hourly. Anyone else can too.

One poke adds at most 6 hours to any counter, so sparse poking slows triggers instead of firing them on one long average.

A flash loan cannot move it: the cumulative value only records prices that survived to the end of a block.

### Fallback ladder

Pull report verified in the poke transaction.

Push feed read, if the adapter is whitelisted or the feed is open.

No new verified rate: the tap keeps the dollar budget at the last verified rate, however old, and never falls back to the cap alone (Flap re-review F5; this replaces the pause the pre-audit's M-1 fix had added, which let anyone who blocked reports stop the team's budget). A report always gets through the oracle's rate gap, so withholding reports cannot keep the rate stale while anyone brings one. The exit streak keeps running on pool price; observations without a rate add no unlock time, and after maxStep without a rate they reset the unlock counters. With no verified rate ever, the tap pays nothing.

The ladder fails toward holders. If the oracle disappears, the exit still works, the team cannot unlock tokens, and the tap stays within its dollar budget at the last known rate and its cap.

### CoinMarketCap DEX API in the app

Base URL https://pro-api.coinmarketcap.com, header X-CMC_PRO_API_KEY (token endpoints, candles).

| Use in Covenant | Endpoint |
|---|---|
| Live pair quote, holders and security scan on the covenant sheet | GET /v4/dex/pairs/quotes/latest with aux=holders,security_scan |
| Liquidity now and liquidity changes, for depth alerts | GET /v1/dex/token-liquidity/query, GET /v1/dex/liquidity-change/list |
| Price history for the price against book chart | GET /v1/k-line/candles |
| Recent swaps, to show who is selling into an exit round | GET /v1/dex/tokens/transactions |
| Sample of new launches for the simulator | POST /v1/dex/new/list |

### The launch simulator

A page that answers one question with CoinMarketCap data: what would have happened if recent BNB Chain launches had carried a covenant?

Pull a sample of BNB Chain tokens from the new list, then daily candles for each from launch.

Assume the default terms: floor at 60% of the opening price, falling by the tap cap each month.

Report how many tokens crossed below that floor for three days, how soon, and what share of an assumed raise would have been redeemable at that point.

This gives every set of terms a number computed from real launch data, before any money is raised.

## Positioning and prior art

Covenant makes the same promise as MetaDAO's ownership coins, with a different engine and on a chain where nothing like it exists. The table shows where each approach puts the raise and what a holder can do when things go wrong.

|  | Covenant (BNB Chain) | MetaDAO (Solana) | DAICO (2018 design) | Bonding-curve launchpads | Genius.fun (BNB Chain) |
|---|---|---|---|---|---|
| Raise | Capped, pro rata refunds, full refund under minimum | Capped, pro rata refunds | Any sale format | No raise, curve purchases | No raise, curve then PancakeSwap |
| Where the money sits | Vault governed by fixed rules | Treasury multisig signed by the futarchy DAO | Contract with a tap | Pool and creator wallet | Treasury of tokenized assets |
| Team budget | Dollar tap, capped as a share of treasury | Fixed monthly allowance | Per-second tap | None | Share of trading fees |
| Team tokens | Unlock at price multiples on a trusted average | Unlock at 2x to 32x on a three-month average | Not specified | Usually free from launch | Not specified |
| Holder exit at asset value | Individual, by rule, in exit rounds | Collective, by liquidation proposal in decision markets | Collective, by vote | None | Depends on each product and issuer |
| What enforces it | Contract plus price feed | Decision markets plus a legal entity | Token vote | Nothing | Not disclosed |

Sources: MetaDAO mechanics from Basis Point and RockawayX. DAICO from Buterin. Genius.fun from crypto.news, Sept 17, 2026, which notes the announcement described no specific investor protections.

### How to say it in one breath

MetaDAO proved that buyers want raises with a treasury they can get back. It needs a decision market and a company for every project. Covenant gets the same protection from one vault, one rule and one price feed, on the launchpads BNB Chain already uses.

### Where Covenant is different on purpose

One holder can leave. MetaDAO's exit is all or nothing and needs a proposal to pass. Three of its coins traded 7% to 36% under treasury value on Nov 1, 2026 with no individual way out (01Resolved).

Trading tax feeds the treasury. Flap routes a share of every trade's tax to the vault, so book value can grow with volume. MetaDAO treasuries only shrink unless the project earns revenue.

The rules are public before the raise. There is no proposal process to learn and nothing to vote on.

It lives inside existing launchpads. A Flap launcher and vault pair, plus an OpenFour template. No new venue to bootstrap.

### Where Covenant is weaker, stated up front

No legal claim. MetaDAO wraps each project in a legal entity that the DAO controls. Covenant holders own a contract right to treasury BNB, not the company, its IP or its revenue.

No governance. Holders cannot raise the tap, replace the team or redirect the treasury. v1 offers exit, not voice.

The floor is below the sale price and falls as the team spends. Covenant limits losses. It does not remove them.

It depends on a price feed for the dollar rules, and on Flap's Guardian for upgrades.

## Agent layer

The vault that binds a human team binds an AI agent the same way, and an agent needs it more. This section puts agents on both sides of a covenant without changing the five rules, and makes the agent the lead character of the demo.

### Why add it now

BNB Chain has named the gap. Its May 21, 2026 post says agent finance needs identity, capability, payment and accountability. Identity is live at scale: about 89,000 ERC-8004 agents on BSC, roughly 44.5% of all tracked, plus about 132,000 BAP-578 agents. Accountability in that post means task escrow and dispute resolution. It does not cover an agent that raises capital (BNB Chain blog).

Research points the same way. Google DeepMind's paper on virtual agent economies argues that agent markets need infrastructure for trust, safety and accountability, built on purpose and not left to emerge (Tomasev et al., 2025).

### Why an agent needs a covenant more than a human team

| Problem with an agent holding money | Evidence | Rule that answers it |
|---|---|---|
| Nobody to hold liable | AI16Z was marketed as an autonomous, AI-run venture fund, per a class action complaint. It peaked at $2.39B on Jan 2, 2025. On Aug 5, 2026 its founder wrote that the token is dead, and the foundation's remaining treasury went to settle the case (CoinDesk) | Treasury sits in the vault under fixed rules. Exit at book value |
| Agents get hijacked | About $175,000 was drained from an agent wallet on May 4, 2026 through a hidden instruction. Vitalik Buterin advised capping autonomous spending near $100 a day, as reported in this roundup | Tap. The agent's key reaches its accrued budget and nothing else |
| Agents stop without notice | Credits run out, a server goes down, an operator walks away | Heartbeat and the abandonment switch |
| Agent income is on-chain | CoinMarketCap already sells data to agents at $0.01 per request, with the payment as the login (x402 docs) | An agent can name the vault as its payee. Revenue raises book value for every holder |
| Investor agents cannot judge a meme | A launch with no terms gives a program nothing to compute | Terms and book value are on-chain. Downside is a number before committing |

The fourth row is the one human teams cannot match. A company can only promise revenue through a legal wrapper. An agent that is paid on-chain can route that revenue to the vault in code.

One line for the pitch:

BNB Chain has identity, capability and payment for agents. Covenant is accountability for the ones that hold other people's money.

### Three agent roles

| Role | What it does | Built from | New contract code |
|---|---|---|---|
| Issuer agent | Holds the team wallet. Claims its tap as a compute budget, sends heartbeats, posts a report each period, can lower its own tap, routes revenue to the vault | A small loop with an LLM for the report and the budget decision. ERC-8004 identity | None |
| Investor agent | Reads terms, computes the downside, commits, claims, redeems when a round opens | Covenant MCP server and a skill file, in any MCP client | None |
| Keeper agent | Pokes hourly, dispatches tax, declares abandonment when due, buys market data per request | The keeper already in the build plan, plus CoinMarketCap's MCP or x402 endpoints | None |

All three work against the contracts as specified. The agent layer is software around the vault, so it cannot break the core.

### Optional contract changes

These bind a covenant to a registered agent and write its outcome to the agent's public record. Skip them if the contracts are frozen.

Identity. Add agentId to Terms, zero for human teams. The launcher factory requires IdentityRegistry.ownerOf(agentId) == teamWallet.

Track record. On abandonment, wind-down or a tranche unlock, the vault calls ReputationRegistry.giveFeedback(agentId, value, 0, "covenant", outcome, "", uri, hash) inside a try and catch. ERC-8004 blocks feedback from the agent's own owner or operators. The vault is neither, so the call is allowed (ERC-8004).

Badge. The covenant sheet shows the agent id, its registration file and the outcomes of its past covenants.

An agent that abandons one covenant carries that record into its next raise. BNB Chain's post calls reputation that travels across protocols still early. Money outcomes are the strongest signal that record could hold.

| ERC-8004 registry | BNB Chain (56) | BNB testnet (97) |
|---|---|---|
| Identity | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004A818BFB912233c491871b3d84c89A494BD9e |
| Reputation | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | 0x8004B663056A597Dffe9eCcC1965A193B7388713 |

Addresses are from the ERC-8004 contracts repo. The agent registers by calling register(agentURI) from the team wallet. Its registration file lists the Covenant MCP endpoint under services and crypto-economic under supportedTrust.

### Covenant MCP server

One server that turns a covenant into tools any assistant can call. Writes return an unsigned transaction by default, so the user's own wallet signs.

| Tool | Kind | Returns |
|---|---|---|
| list_covenants | Read | Token, state, treasury, book value, pool price, premium or discount |
| get_terms | Read | The full terms as JSON, plus a plain-language summary |
| get_status | Read | State, exit streak, round end, tap accrued and cap, heartbeat age, tranche progress, last trust result |
| get_downside | Read | What a position redeems for at book today, floor as a share of sale price, runway at the tap cap |
| get_issuer | Read | Team wallet, agent id, registration file, outcomes of past covenants |
| get_market | Read | Pair quote, liquidity and holders from CoinMarketCap |
| commit, claim_tokens, claim_refund | Write | Unsigned transaction for the launcher or vault |
| redeem, poke, declare_abandoned | Write | Unsigned transaction for the vault or oracle |
| claim_tap, heartbeat, lower_tap, post_report | Write, issuer only | Unsigned transaction from the team wallet |

Build notes:

TypeScript with the MCP SDK and viem. Standard input and output transport is enough for the demo. Reads are the same multicalls the app uses.

Ship a SKILL.md beside it, so skill-based agents can use Covenant without running a server.

CoinMarketCap's own MCP server exposes 12 tools and marks DEX data as work in progress, so get_market calls the DEX API directly (CMC MCP docs).

### Issuer agent loop

```text
every few minutes:
  status = vault.status()                      # state, treasury, book, price, tap accrued
  if status.state is ACTIVE and status.tapAccrued > minimumClaim:
      vault.claimTap()                         # also a heartbeat
  else:
      vault.heartbeat()
  if status.price is close to status.book:
      consider vault.lowerTap(lowerBudget)     # a pay cut that protects the floor
  if earned revenue since last tick:
      send it to the vault                     # raises book value for every holder
  if the period ended:
      report = llm.write(ledger of spend, actions, revenue)
      vault.postReport(period, uri(report), hash(report))
```

The LLM never decides a rule. It writes the report and explains the budget choices. The rules stay in the vault, which is the point.

### Four.meme tie-in

Scope: CovenantLiteVault (the Four.meme / OpenFour template) is outside Flap's audit. It never touches Flap's Portal, Guardian or Token Dock; it is a separate integration with its own threat model and needs its own review before mainnet.

OpenFour's Agent ID Exclusive preset lets only Binance Agentic Wallets with an Agent ID trade a token on the inner market, with a 1% holding cap per address. The preset accepts an optional founder tax vault (mechanism doc). CovenantLiteVault drops into that slot with no new code: a token only agents can trade early, with the founder's tax under a covenant. Preset id 1778027615735.

One limit to know. Binance's docs for the Agentic Wallet cover transfers and swaps that the user confirms, and do not document arbitrary contract calls (AI Pro docs). The issuer agent therefore runs on its own key with an ERC-8004 identity, not on an Agentic Wallet.

### Honest limits

An agent is whoever holds its key. Covenant does not prove autonomy. It makes the question matter less, because the rules bind the wallet either way.

A stolen key can still end the project. The thief can claim the accrued tap and call wind-down. Wind-down returns the treasury to holders, so nothing is taken, but the project is over. A notice period on wind-down is a later fix.

A fresh agent id has no history. Reputation helps from the second covenant on. Readers should count feedback only from vaults our factory created, since ERC-8004 warns that unfiltered summaries invite spam.

Write tools move money. Never give a hosted MCP server a key. Unsigned transactions are the default for that reason.

Revenue to the vault is BNB only in v1. Stablecoin income needs a swap step.

### Hard questions on the agent layer

| Question | Answer |
|---|---|
| Is the agent really autonomous? | It does not need to be. A human with the key and an agent with the key are bound by the same vault. That is the design. |
| Why would anyone fund an agent? | Not without rules like these. An agent can otherwise hold a treasury with no limits. With a capped budget, an exit at book and a dead-man switch, the worst case is a number. |
| What does the AI actually do? | It runs the business side: spends within its budget, reports, decides when to cut its own pay, and on the investor side reads terms and exits. It never controls the money rules. |
| What if the agent's key leaks? | The attacker reaches the accrued tap, at most 4% of the treasury a month. The treasury stays in the vault. |

## System architecture

Covenant is six contracts, one keeper and one web app. Flap creates the token, the pool and the vault. Our code decides who can raise, where the money sits and when it can move.

Money enters through the launcher, rests in the vault and leaves only through the vault's rules. The Portal also hands the vault the sale and team tokens at launch. CovenantLiteVault for Four.meme is a separate, smaller contract and is not drawn.

### Components

| Component | What it does | Built on |
|---|---|---|
| CovenantLauncherFactory | Validates terms and deploys one launcher per raise | Flap LauncherFactoryBase, spec lf-v1 |
| CovenantLauncher | Holds commitments, settles pro rata, launches once, forwards the treasury, pays refunds | Flap LauncherBase |
| CovenantVaultFactory | Accepts only launches from our launchers with the exact expected shape, deploys the vault | Flap DirectLaunchVaultFactoryBase, spec pl-v1 |
| CovenantVault | Holds treasury and reserved tokens, runs the five rules | Flap DirectLaunchVaultBase and IStrategy, Token Dock |
| CovenantOracle | Verifies Atlas reports, reads the pair, sends one observation to a vault | Atlas pull consumer, PancakeSwap V2 pair |
| CovenantLiteVault | Tax-only version of the rules for Four.meme tokens | OpenFour BaseTaxVault behind ForwardVault |
| Keeper | Pokes hourly with a signed Atlas report, dispatches pending tax, raises alerts | TypeScript, viem, Atlas pull SDK |
| Web app | Create, commit, covenant sheet, redeem, team console, simulator | Next.js, wagmi, viem, CoinMarketCap DEX API |

### Launch sequence

Everything below happens inside one finalize() transaction.

The launcher computes Q and Q_pool and builds Flap's CreateTaxTokenParams. The single fee slot is VAULT at 10000 bps with vaultData = abi.encode(launcher).

It sets launching = true and calls Portal.launchTaxTokenV2{value: Q_pool} with Distribution { target: VAULT, amount: A + E }, inside a try and catch.

The Portal calls CovenantVaultFactory.newVault(predictedToken, launcher, 0, abi.encode(params, distribution)). The factory checks every condition listed in the specification, then deploys and initializes the vault from launcher.terms().

The Portal deploys the token, seeds the V2 pool with Q_pool and P, and locks the liquidity.

The Portal calls vault.initializeDistribution(token, A + E, "", salt). The vault pulls exactly that amount and deposits it in Flap's Token Dock.

Back in the launcher: vault.fundTreasury{value: Q - Q_pool}(pool), then state becomes LAUNCHED.

The keeper's first poke records the sale price in dollars.

If step 2 reverts, nothing after it happened. The launcher moves to FAILED and every commitment is refundable.

### Poke sequence

The keeper builds a call to CovenantOracle.poke(vault). The Atlas SDK appends the signed report to the calldata.

The oracle verifies BNB/USD, and the token feed if one is configured. It reads the pair's cumulative price and reserves and computes the average price since the last poke and the trust flag.

The oracle calls vault.onObservation(obs). The vault recognizes new tax revenue, accrues the tap, steps the exit streak and tranche counters, and changes state if a threshold is crossed.

### Tax flow

Trades on the pool leave tax in the token's tax processor. Flap's processor sells the collected tax in chunks of about $500, at most once every 10 seconds, on sells into the main pool, and Flap's protocol fee takes about 10% first, so the vault receives about 90%. Anyone can call its dispatch(). The vault's share arrives as plain BNB in receive(), and the vault recognizes it by comparing its balance to its own ledger, as Flap's spec requires.

The tax runs for taxDuration after launch, a term the team sets and the factory bounds to 30 days to 100 years (Flap accepts anything from the anti-farmer window up to 2^32 - 1 seconds); the default is 100 years, the longest the factory allows, because the tax is the treasury's revenue stream. When it ends, the treasury grows only from revenue the issuer sends with depositRevenue(tag) (or a plain transfer); the covenant page shows the end date.

### Trust boundaries

| Party | What it can do | What it cannot do |
|---|---|---|
| Flap Portal | Create the vault once, hand over reserved tokens once | Move treasury or change terms |
| Flap Guardian | Upgrade the vault and launcher implementations for all covenants (so treasury and refund BNB are only as safe as the Guardian). Call every team function, per Flap's spec: windDown() on any covenant (ends the tap early, opens fee-free redemption, recorded as windDownCause 2 and shown in the app), claimTap() (pays only the fixed team wallet), lowerTap(), heartbeat(), postReport() | Count as a heartbeat, raise the tap, change the team wallet or any term, unlock tranches, or send treasury BNB or tokens anywhere but the team wallet's accrued tap and redeeming holders, short of an upgrade. Act without Flap's security review, per Flap's stated process |
| Atlas signer | Set BNB/USD inside a signed report, which prices the tap (never above its cap of tapCapBps of the treasury per 30 days) | Open or block an exit round: book and pool price are read on-chain. Unlock team tokens alone: an unlock also needs the multiple in BNB, from the pool TWAP |
| Keeper | Choose when to poke | Forge a report, skip the trust gate, or poke more than hourly |
| Team | Claim tap, lower tap, heartbeat, wind down | Raise the tap, touch locked tokens, block redemptions |
| Any holder | Poke, redeem in a round, declare abandonment when due | Redeem outside a round |

### Repository layout

```text
covenant/
  contracts/                 Foundry project
    src/flap/                Flap spec files, copied unchanged
    src/launcher/            CovenantLauncher.sol, CovenantLauncherFactory.sol
    src/vault/               CovenantVault.sol, CovenantVaultFactory.sol, CovenantTypes.sol
    src/oracle/              CovenantOracle.sol, PairTwap.sol, IAtlas.sol
    src/openfour/            CovenantLiteVault.sol
    test/                    unit, fork (BNB Chain and testnet), invariant
    script/                  Deploy.s.sol, Demo.s.sol
  keeper/                    poke, dispatch, alerts
  web/                       Next.js app
  sim/                       CoinMarketCap simulator job
```

### Stack

| Layer | Choice | Reason |
|---|---|---|
| Contracts | Solidity 0.8.26, Foundry, solady, OpenZeppelin upgradeable | Same toolchain and versions as Flap's example repo, so its bases and fork tests drop in |
| Proxies | Beacon proxy per launch, keyed by token address | Flap's recommended pattern |
| Keeper | Node, viem, @atlas-oracle/pull-oracle-consumer-sdk | The SDK fetches and appends signed reports |
| App | Next.js, wagmi, viem, Tailwind, Satoshi typeface | Fast to build, wallet support out of the box |
| Data | CoinMarketCap DEX API behind a server route | Keeps the API key off the client |

## Smart contract specification

This is the build spec: terms, functions, access, core logic and invariants. Interfaces marked Flap, OpenFour or Atlas were read from their source on Nov 25, 2026.

### Terms

Set once in newLauncher, stored in the launcher, copied into the vault at launch.

```solidity
struct Terms {
    // token and raise
    string name; string symbol; string meta;
    bytes32 salt;               // mined so the token address ends in 0x7777
    uint256 totalSupply;
    uint16 saleBps;             // A / S
    uint16 poolBps;             // P / S, must be <= saleBps
    uint16[] trancheBps;        // team tranches, sum = 10000 - saleBps - poolBps
    uint16[] trancheMultiple;   // 200 = 2x the sale price in dollars
    uint256 minRaise; uint256 cap;
    uint32 saleDuration;
    // trading tax
    uint16 buyTaxBps; uint16 sellTaxBps; uint32 taxDuration;
    // rule 1: tap
    address teamWallet;
    uint256 tapUsdPer30d;       // 18 decimals
    uint16 tapCapBps;           // share of treasury per 30 days
    // rule 2: unlock
    uint32 cliff; uint32 unlockWindow;
    // rule 3: exit
    uint32 exitStreak; uint32 roundLength; uint32 cooldown; uint16 exitFeeBps;
    // rule 4: abandonment
    uint32 heartbeat;
}
```

The launcher factory rejects terms outside these bounds:

| Field | Bound | Reason |
|---|---|---|
| saleBps | at least 4000 | Buyers hold the largest share |
| poolBps | 500 to saleBps | Pool must open at the sale price |
| Team total | at most 3000 | Limits dilution of book value |
| tapCapBps | at most 1000 | At least ten months of runway |
| exitStreak | 1 to 14 days | Long enough to resist manipulation, short enough to matter |
| roundLength | at least 3 days | Time for holders to act |
| exitFeeBps | at most 300 | Exit must stay close to book |
| heartbeat | 14 to 90 days | Avoids false alarms and endless silence |
| minRaise * poolBps / saleBps | at least 1.5x Flap's graduation floor | Otherwise the token may launch ungraduated, or the launch reverts LaunchLiquidityTooLow, if Flap's price or multiplier moves during the sale |
| max(buyTaxBps, sellTaxBps) | 100 to 1000 | The Portal refuses a higher rate under 1% (InvalidTaxBps) |

The floor check uses the Portal's graduationFloorV2 (with our vault factory). A second factory with time bounds in minutes is deployed for the demo only; it applies Flap's creation floor with the same 1.5x margin.

### CovenantLauncher

| Function | Caller | Behavior |
|---|---|---|
| initialize(hub, creator, terms) payable | Factory | Stores terms. Calls Portal.lockSalt itself with exactly SALT_LOCK_FEE, because Flap requires the locker to be the launcher. |
| contribute() payable | Anyone | Adds to contributions[msg.sender] and committed while RAISING and before the deadline. |
| finalize() | Anyone, after the deadline | Under minimum: FAILED. Otherwise settles, launches (sequence above), forwards the treasury. A reverted launch also ends in FAILED. |
| claimRefund() | Contributor | Pays the full commitment if FAILED, or the unaccepted part if LAUNCHED. |
| acceptedOf(a), allocationOf(a) | View | q_i and a_i. The vault reads these. |
| terms(), state(), launching(), token(), vault() | View | Read by the vault factory, the vault and the app. |
| description() | View | Flap's v1 JSON plus appended covenant keys, kept under 4 KB. Past that size the Portal silently stores an empty string. |

The launcher also declares the real creator with LaunchExtensionHelper.encodeCreator(creator), so Flap's launch event shows the team wallet and not the launcher contract.

### CovenantVaultFactory

newVault(token, creator, launchKind, launchParams) is onlyHub and reverts before deploying unless all of these hold:

Flap's common checks pass (_validateLaunch): one VAULT slot naming this factory, non-zero bps, supported quote.

Portal.getLauncher(creator).launcherFactory is our launcher factory. A stranger contract cannot pose as a launcher.

vaultData is exactly abi.encode(address launcher) and names the caller.

launcher.launching() is true and the launch parameters equal what launcher.terms() implies: supply, pool tokens, tax rates.

Quote is native BNB. The VAULT slot is 10000 bps.

distribution.target == VAULT, distribution.amount == A + E and poolToken + amount == totalSupply.

Other surfaces: isQuoteTokenSupported(address(0)) only, factorySpecVersion() returns pl-v1, vaultDataSchema(), tokenCreationPolicies(), and upgradeVaultImplementation() restricted to Flap's Guardian.

### CovenantVault

| Function | Caller | Behavior |
|---|---|---|
| initialize(token, launcher, terms) | Factory | Copies terms, sets state ACTIVE, starts the heartbeat clock. |
| initializeDistribution(token, amount, data, salt) | Flap Portal, once | Checks the token and amount, pulls exactly amount, verifies the balance change, deposits in the Token Dock, emits FlapDistributionInitialized. |
| fundTreasury(pool) payable | Launcher, once | Records the raise treasury and the pair address. |
| receive(), sync() | Anyone | Recognizes revenue by balance delta. Cheap and idempotent, since Flap may ping it with zero value. |
| claimTokens() | Contributor | Withdraws allocationOf(msg.sender) from the Token Dock to the caller, once. |
| onObservation(obs) | CovenantOracle only | Core step, shown below. |
| claimTap() | Team wallet or Guardian | Pays accrued tap to the team wallet. Heartbeat. |
| lowerTap(newUsd) | Team wallet or Guardian | Only downwards. Heartbeat. |
| heartbeat() | Team wallet or Guardian | Resets the abandonment clock. |
| releaseTeam() | Anyone | Sends unlocked tranches from the Token Dock to the team wallet. |
| redeem(amount, minOut) | Any holder | Only in EXIT_ROUND or WIND_DOWN. Shown below. |
| declareAbandoned() | Anyone, after the heartbeat lapses | Forfeits unclaimed tap, burns locked tranches, enters WIND_DOWN. |
| windDown() | Team wallet or Guardian | Voluntary close. Same end state, accrued tap stays claimable. The vault records who: windDownCause 1 team, 2 Guardian, 3 abandoned, with windDownBy, and emits WindDownCaused(by, cause). |
| postReport(period, uri, hash) | Team wallet or Guardian | Stretch. Stores the report pointer. Heartbeat (team wallet only). |
| bookValue(), redeemableSupply(), state(), exitStreak(), trancheProgress(k), owedTeam() (the accrued tap) | View | Drive the covenant sheet. |
| description(), vaultUISchema() | View | Flap's two mandatory vault methods. |

Flap's spec asks that every permissioned vault function also accept the Guardian. The payout address is fixed, so a Guardian call to claimTap() still pays the team.

### CovenantOracle

```solidity
struct Observation {
    uint32  elapsed;     // seconds since this vault's previous observation
    uint256 twapBnb;     // average pool price over that interval, 1e18
    uint256 bnbUsd;      // Atlas BNB/USD, 1e18
    bool    trusted;     // gate passed for the exit streak
    bool    strict;      // gate passed for unlock and tap rate
}
function poke(address vault) external;   // signed Atlas report rides in trailing calldata
```

The oracle is a singleton with no owner. It stores, per vault, the last cumulative price, the last pair timestamp and the last Atlas timestamp accepted. It refuses a second poke within 1 hour.

### Core logic

```solidity
function onObservation(Observation calldata o) external onlyOracle {
    _tick();                                            // time-based state changes
    _sync();                                            // recognize tax revenue
    uint256 dt = o.elapsed > MAX_STEP ? MAX_STEP : o.elapsed;   // 6 hours at most
    if (state == State.ACTIVE || state == State.COOLDOWN) _accrueTap(dt, o);
    if (o.trusted) {
        if (usdSalePrice == 0 && o.strict) usdSalePrice = salePriceBnb * o.bnbUsd / 1e18;
        if (o.strict) _stepTranches(dt, o.twapBnb * o.bnbUsd / 1e18);
        if (state == State.ACTIVE) {
            exitStreak = o.twapBnb < bookValue() ? exitStreak + dt : 0;
            if (exitStreak >= terms.exitStreak) _openRound();
        }
    }
    emit Observed(o.twapBnb, o.bnbUsd, bookValue(), o.trusted, state);
}
function redeem(uint256 amount, uint256 minOut) external nonReentrant {
    _tick();
    if (state != State.EXIT_ROUND && state != State.WIND_DOWN) revert NotRedeemable();
    _sync();
    uint256 b = bookValue();                            // read before the burn, rounded down
    uint256 got = _pullAndBurn(msg.sender, amount);     // measures tokens received, sends them to 0xdEaD
    uint256 gross = got * b / 1e18;
    uint256 out = state == State.WIND_DOWN ? gross : gross - gross * terms.exitFeeBps / 10_000;
    if (out < minOut) revert Slippage();
    totalOut += out;                                    // ledger first, transfer last
    msg.sender.safeTransferETH(out);
    emit Redeemed(msg.sender, got, out, b);
}
```

bookValue() is (address(this).balance - owedTeam) * 1e18 / R, with R = totalSupply - balanceOf(DEAD) - lockedTeam.

### Events

Contributed, Finalized, Refunded, TreasuryFunded, RevenueRecognized, Observed, TapClaimed, TapLowered, ExitRoundOpened, ExitRoundClosed, Redeemed, TrancheUnlocked, Heartbeat, WoundDown, ReportPosted. The app and the keeper index these and nothing else.

### Invariants to test

The vault's BNB balance is never less than owedTeam.

A redemption never lowers book value for the holders who remain.

Accepted amounts sum to at most Q, and for every buyer accepted plus refund equals the commitment.

Tap paid over any 30 days is at most tapCapBps of the treasury at the start of that window.

Locked team tokens leave the vault only to the team wallet after an unlock, or to the burn address at wind-down.

State only moves along the edges in the state table. FAILED and WIND_DOWN are terminal.

With no trusted observation, no counter changes.

### What Flap.sh will render

description() must disclose fees and every party that receives revenue or reserved tokens. Ours reads like this:

CovenantVault: 100% of this vault's revenue goes to the treasury. State ACTIVE.

Treasury 317.47 BNB, book value 0.000000427 BNB per token.

Team 0x...: tap up to 4% of treasury per 30 days, 4.10 BNB claimable.

Team tokens: 250,000,000 locked, unlock at 2x, 4x, 8x of the sale price.

Sale buyers claim 600,000,000 tokens pro rata. Exit fee 1%, kept by the treasury.

vaultUISchema() lists bookValue, state, claimTokens, redeem (with its token approval), releaseTeam, declareAbandoned and sync. Flap.sh builds its interaction panel from that schema, so a covenant is usable there without our app.

## Sponsor integrations

Each integration does a job in Covenant that nothing else in the stack does.

| Integration | What Covenant uses | What breaks without it | Open question for the integrator |
|---|---|---|---|
| Flap: Pool Launch | Launcher and vault pair, reserve hand-off, Token Dock, tax to vault | No raise, no treasury, no token | Enable our launcher factory on BNB testnet |
| CoinMarketCap and Atlas | Atlas for dollar tap, dollar unlock and the trust gate. CoinMarketCap DEX API for the sheet and simulator | Tap and unlock cannot be set in dollars. Triggers count during broken markets | API key, BNB/USD feed id, and whether status is readable on-chain |
| Four.meme: OpenFour | CovenantLiteVault, a tax vault template on the Unverified Royalty path | Four.meme creators cannot adopt the rules | Listing the template on the create page |
| Cournot | Verdict on each period's disclosure report | Rule 5 has no judge | Partner source id and how markets are created |

### Flap

Flap's repo names two things to build on a launch: a vault and a launcher. Covenant builds both as a locked pair, and the vault also takes the reserved tokens. That covers every extension point in the spec (README).

| Extension point | Flap requirement, from source | How Covenant meets it |
|---|---|---|
| Launcher factory | newLauncher(creator, data) callable by the Portal only, factorySpecVersion() returns lf-v1, launcherDataSchema() | CovenantLauncherFactory on LauncherFactoryBase |
| Salt | The launcher must call lockSalt itself. The token address must end in 7777 | Locked in initialize. The app mines the salt |
| Launch call | For native quote, msg.value must equal poolQuote + creatorBuyQuote. One launch per launcher | Value is exactly Q_pool. No creator buy |
| Vault factory | newVault is onlyHub, validates before deploying, factorySpecVersion() returns pl-v1 | Six checks listed in the specification |
| Reserve hand-off | IStrategy.initializeDistribution: Portal only, once, pull exactly amount, emit the event | Vault takes A + E |
| Token Dock | Hold reserves through _getTokenDockRouter(), never cache it | Deposit at hand-off, withdraw on claim and unlock |
| Revenue | Native value lands in receive(). Use balance-delta accounting, decrement on every outflow | _sync() ledger |
| Fee slots | At most four, summing to 10000 bps. VAULT and MARKETING are exclusive | One VAULT slot at 10000 |
| Disclosure | description() must name fees and every recipient. vaultUISchema() lists user methods | Both implemented, example in the specification |
| Upgrades | Guardian only for the low-risk badge | onlyGuardian, no other path |

Addresses, same on BNB Chain (56) and BNB testnet (97) unless noted:

| Contract | Address |
|---|---|
| Direct Launch Portal | 0x000042108465206185A077Edc3F3fd2b49060000 |
| TokenDockRouter | 0x000048E888aBf09f690a952E1b386b2D031a0000 |
| Guardian, BNB Chain | 0x9e27098dcD8844bcc6287a557E0b4D09C86B8a4b |
| Guardian, testnet | 0x00004d58290854c5E9880F4b5B1993c6Ad8b0000 |
| Tax token implementation | 0x7777c57ff7dc441c1715b2e36fa581c48B782222 |

Two things gate a live launch. A launcher factory must be enabled by Flap before newLauncher works, and factories must pass Flap's audit before mainnet launches open. Until then vaults show as unverified. If Flap cannot enable us in time, we demo on a fork and enable the factory the way Flap's own fork tests do, by acting as the Portal admin.

### CoinMarketCap and Atlas

Atlas data moves money in three places, and CoinMarketCap data explains it to users.

Dollar tap. Every accrual converts the team's dollar budget at the verified BNB/USD rate.

Dollar unlock. Tranche counters only advance on prices that pass the strict gate.

Trust gate. No trigger counts time during stale, split or thin markets.

Covenant sheet and simulator. CoinMarketCap DEX endpoints listed in the data section.

Integration facts from the Atlas docs: the pull consumer is installed with forge install oracle-atlas/pull-oracle-consumer, the SDK is @atlas-oracle/pull-oracle-consumer-sdk, and the default authorized signer is 0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600 (pull guide). Venus and Lista already price assets from Atlas (Venus forum).

### Four.meme and OpenFour

CovenantLiteVault brings rules 1 and 4 to any Four.meme tax token through the Unverified Royalty path (mechanism doc).

What it does:

The founder's share of trading tax lands in the vault instead of the founder's wallet.

The founder can withdraw at most tapBps of the balance per period. Each withdrawal is a heartbeat.

If the founder is silent past the heartbeat window, or winds down, the balance becomes redeemable. Holders burn tokens for a pro rata share.

How it plugs in, from source:

| Item | Fact |
|---|---|
| Wrapper | The platform clones ForwardVault as the token's founder. It clones our template (EIP-1167) and initializes it with token, quote, owner = creator, empty roles and our initData |
| Royalty | ROYALTY_BPS = 600: about 6% of each receipt goes to the template's authorWallet(), the rest to the clone |
| Required interface | initialize, taxVaultToken(), taxVaultQuote(), authorWallet(), onERC20TaxReceived(), plus a payable receive() |
| Base | Inherit BaseTaxVault, implement _customInit and moduleEncodeSchema(), call _disableInitializers() in the constructor |
| Limits | updateShares() is not forwarded, so the template cannot track holder balances. Burn-to-redeem needs none. The first receipt locks native or ERC20 mode |
| Create | taxVaultTypeId = keccak256("SafuSkill.ForwardVault.v1"), params abi.encode(template, initData). Four.meme's create page builds the form from moduleEncodeSchema() |
| BSC implementation | 0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4 |
| Permanence | Template and init params cannot be changed after create |

Our schema has four fields: tapBps, tapPeriod, heartbeat, redeemFeeBps. Testing runs on OpenFour's developer/fork-deploy environment, which ships the Bonding Tax V1 preset with ForwardVault already registered.

### Cournot

Cournot resolves questions about real-world events and publishes a verdict with reasoning and an on-chain proof (docs). Rule 5 asks it one question per period: did the team publish the report it committed to, and does it match on-chain facts?

The public API returns a market's status, verdict, confidence, reasoning and proofs with a BSC transaction hash, from GET /cournot/markets/public on https://interface.cournot.ai (API reference).

The docs list no endpoint for creating a market, and no contract for reading a verdict on-chain. Both need the Cournot team.

v1 design: the keeper polls, then a relayer address fixed at creation records the verdict and the proof hash in the vault. The relayer is a trust assumption, stated on the sheet.

This is the first thing cut if time runs short. Rules 1 to 4 do not depend on it.

## Security, threat model and testing

The vault holds other people's money under rules that pay out on price. The threats that matter are the ones that move a price, a clock or a balance.

### Threats and defenses

| Threat | How it would work | Defense | What remains |
|---|---|---|---|
| Fake an unlock | Team pumps the pool above a multiple | 30 strict days on a time-weighted price, the multiple in BNB and in dollars, pool depth check, cliff | A team willing to hold the price up with real money for a month. Holders can sell to them at that price |
| Withhold Atlas reports | Whoever pokes leaves the report off while the price is under a multiple, so the reset never happens | A trusted observation without a rate resets every counter whose multiple it misses at the last rate, and every counter once that rate is over maxStep old; unlock time must be continuous strict time (H-1, Flap F4) | A lasting drain of the pool under half its seed makes observations non-strict (no unlock time) until it recovers; a same-block sale cannot fake it, because depth is read at the TWAP on the pool's invariant (NEW-1) |
| Block the keeper's report | Poke without a report first, every hour, so the strict poke reverts TooSoon | A poke with a rate waits only for the previous poke with a rate (Flap F5); the keeper decides it is due from that point | None: a plain poke at a price that holds the multiple changes nothing |
| Pick the dollar sale price | First strict poke made at a BNB/USD dip | Fixed at launch from the push feed; else ratchets up only, for staleAfter (M-2); the BNB leg needs the real multiple | A rate within the first window, if every honest poke is front-run |
| Force an exit round | Attacker dumps to push price under book for three days | Selling below book hands value to buyers. Cooldown bounds the tap pause | Griefing that costs the attacker more than the team |
| Flash-loan the price | Move the pool inside one transaction | Cumulative prices only record end-of-block values. Hourly minimum between pokes | None practical |
| Replay an old Atlas report | Reuse a signed report inside its freshness window | Monotonic timestamp per vault, maxDelay of 180 s | Choice of report within three minutes |
| Stale or halted feed | Atlas stops updating | Freshness check fails; no unlock time counts, counters reset after maxStep; the tap keeps the dollar budget at the last verified rate, capped (Flap F5) | During a long outage the tap is priced at an old rate (within the cap); the exit rule keeps running |
| Reentrancy on payout | Receiver re-enters during a BNB transfer | Ledger updated before transfer, nonReentrant, pull payments only | None known |
| Trapped raise | Launch reverts after the raise succeeded | Try and catch around the launch, FAILED state, full refunds | None known |
| Vault squatting | Someone deploys at the vault's address first | newVault is onlyHub, as Flap's spec requires | None |
| Impostor launcher | A contract names our vault factory in its launch | Factory checks the Portal's launcher record and the launching flag | None |
| Tax on transfer during redeem | Fewer tokens arrive than were sent | Payout uses the measured amount received | None |
| Forced BNB into the vault | Self-destruct or plain send | Counted as revenue. It raises book value | None, it is a gift |
| Rounding | Many small redemptions | Division rounds toward the vault | Dust stays with remaining holders |
| Team redeems its unlocked tokens | Team exits at book in a round | Disclosed on the sheet. Stretch: linear release after unlock | Team shares the floor for tokens it earned |
| Abandonment false alarm | Honest team forgets the heartbeat | Any team action counts, 45 day window, keeper reminders | Irreversible if missed. The window is deliberately long |
| Nobody pokes | Counters never advance | Anyone can poke. The app has a button and the MCP server a tool. Sparse pokes add at most 6 hours each | Triggers arrive late. If the team runs the only keeper and stops, holders must poke for exit rounds to open |
| Terms the Portal refuses | A covenant raises for weeks, then Flap refuses the launch | The factory mirrors the Portal's launch checks at creation: name blocklist, liquidity floor, at least one tax rate, tax duration bounds (M-3); a refusal at finalize can be retried for a window (L-5) before refunds | Flap changing a rule during the sale |
| Lapsed team winds down | A team past its heartbeat calls windDown to keep the tap abandonment forfeits | Past the deadline a wind-down is an abandonment (L-4) | None |
| Rewritten report | Team swaps a report after a passing verdict | Reports are write-once per period (L-1); verdicts count per period, a late pass cannot lift a newer failure (L-2) | The relayer's honesty |
| Unverified addresses through the API or MCP | A contract posing as a vault is read, listed, or asks for approvals | Server side, being fixed by the agentic review (A-1); approvals are for the exact amount (L-6) | See docs/KNOWN-ISSUES.md |
| Prompt injection through token names, terms or URIs | Text from chain or users reaches an LLM client | Server side, agentic review (L-14) | Clients must treat names and URIs as data |

### Trust assumptions, all shown on the covenant sheet

Flap's Guardian can upgrade the vault and the launcher (so the treasury and the refund BNB are only as safe as the Guardian). It is the only upgrade path, as Flap's low-risk badge requires. Flap states that upgrades take about 24 hours of security review. After audit we can ship a factory whose upgrade function always reverts. Per Flap's spec it can also call every team function: windDown on any covenant (recorded as a Guardian wind-down), lowerTap (even to zero, for good), postReport (write-once, recorded as the Guardian's), claimTap (pays only the fixed team wallet) and heartbeat (never counts). The vault's description() lists these.

Atlas's signer is honest about BNB/USD. A wrong rate can misprice the tap, within its cap. It cannot unlock team tokens alone (the BNB leg reads only the pool) and cannot open or block an exit round, because book value and pool price are both read on-chain.

The PancakeSwap V2 pair is the price. Liquidity is locked at launch, so the pair cannot be pulled.

The Cournot relayer is honest, for rule 5 only.

There are no Covenant admin keys: no owner, no pause, no fee switch. The Guardian's powers above are Flap's, not Covenant's.

### What the contract does not protect against

A treasury that is legitimately spent. The floor falls with every tap claim.

A falling BNB price. The treasury is BNB, so its dollar value moves.

Anything off-chain: the team's company, IP and revenue are outside the contract.

Legal classification. A token with a redemption right may be treated as a security in some places. This needs counsel before mainnet.

### Test plan

| Layer | What | Tool |
|---|---|---|
| Unit | Raise math, pro rata rounding, state machine edges, tap accrual, counters with trusted and untrusted steps | Foundry |
| Fork, live Portal | Full journey on BNB Chain and testnet forks: create, commit, finalize, real pool trades, tax dispatch, tap, exit round, redeem, wind-down | Foundry fork tests modeled on Flap's ForkBase |
| Invariant | The seven invariants in the specification under random sequences of commit, trade, poke, redeem, claim | Foundry invariant testing |
| Oracle | Signature checks, stale and replayed reports, gate conditions one by one | Foundry with fixture reports |
| OpenFour | Template behind ForwardVault: native receipts, royalty split, tap, heartbeat lapse, redeem | OpenFour fork-deploy and Workbench |

Flap's README lists nine scenarios every vault test suite should cover before audit. We adopt them as written: Hub creates the vault, a non-Hub caller reverts, bad input reverts before deployment, native revenue is credited, a spurious ping credits nothing twice, every outflow decrements the ledger, the core action is gated, only the Guardian upgrades with state preserved, and the reserve hand-off is Hub-only and exact.

Flap's test notes also warn against makeAddr on forks, because a hashed address can collide with a live account that carries code. We use plain numbered accounts as they do.

### Before mainnet

Flap factory audit for both factories

Independent review of the vault and oracle

Atlas whitelisting or pull credentials for production

Legal review of redemption rights

Decide on Guardian upgrades or an immutable factory

Keeper redundancy: two operators and a public poke button

## Frontend and UX

The app has one job: let a buyer read five rules in under a minute and see, at any moment, whether each one is holding. The covenant sheet is the screen that gets the polish.

### Screens

| Screen | For | Shows | Main action |
|---|---|---|---|
| Create | Team | Terms form with live preview of sale price, pool seed, treasury and starting floor. Salt mining progress | Create covenant |
| Raise | Buyer | Terms in plain words, committed against minimum and cap, time left, your commitment and expected allocation | Commit BNB |
| Settle | Buyer | Result of the raise: accepted, refund, tokens | Claim tokens, claim refund |
| Covenant sheet | Everyone | The five rules with live status, price against book chart, treasury ledger, event feed | Poke, redeem when open |
| Redeem | Holder | Tokens in, BNB out, comparison with selling on the pool, time left in the round | Redeem |
| Team console | Team | Tap claimable, heartbeat countdown, tranche progress, report due | Claim tap, heartbeat, lower tap, wind down |
| Simulator | Teams and buyers | What recent BNB launches would have looked like under a covenant | Change terms, rerun |

### The covenant sheet

One page per token, readable without a wallet. Top to bottom:

Header. Token, state badge, treasury in BNB and dollars, book value per token, pool price, premium or discount to book.

Five rule cards. Each has a one-line rule, a meter and the next event.

Price against book chart. Two lines over time. Shaded bands mark exit rounds. Candles come from CoinMarketCap, book value from Observed events.

Treasury ledger. Raised, tax in, tap out, redeemed out. Every row links to its transaction.

Trust panel. Atlas report age, gate result for the last poke, the trust assumptions in plain words.

| Rule card | Meter | Next event line |
|---|---|---|
| Tap | Claimed this period against the cap | 4.1 BNB claimable now |
| Performance unlock | Days above each multiple, out of 30 | 2x tranche: 11 of 30 days |
| Book-value exit | Streak days below book, out of 3 | Opens in 1 day 4 hours at this price |
| Abandonment switch | Days since last heartbeat, out of 45 | Team last active 6 days ago |
| Disclosure | Reports passed against due | Next report due in 12 days |

### Principles

Numbers before adjectives. No safety score, no badge. Show the treasury, the floor and the countdowns.

Say what it does not cover. The sheet states that the floor is below the sale price and falls with spending.

Every number is checkable. Each figure links to the contract read or transaction behind it.

One action per state. The sheet shows redeem only when a round is open, and says when it would open otherwise.

Plain verbs. Commit, claim, redeem, poke. No protocol jargon on buyer screens.

### Build notes

Salt mining. Flap requires the token address to end in 7777. The app mines a salt in a web worker by predicting the clone address from the tax token implementation and the Portal. About 65,000 tries on average.

Reads. One multicall per screen against the launcher, vault and pair. No indexer for the hackathon. Events are fetched by log filter from the launch block.

Poke button. Calls the keeper's endpoint to fetch a signed Atlas report, then sends poke from the user's wallet. This keeps the system live without our keeper.

Flap.sh. The vault's vaultUISchema() gives Flap's site a working panel with no extra work. Show it in the demo.

Look. Satoshi for text, a monospace face for every figure, one accent color for the state badge. Light and dark themes.

## Business model and roadmap

Covenant earns when tokens launched through it keep trading, through fee paths that already exist in the sponsors' contracts. It adds no new fee for buyers or teams in v1.

### Revenue lines

| Line | Mechanism | Who pays | Status |
|---|---|---|---|
| Flap commission | Flap's launch parameters carry a commissionReceiver. Per the Portal interface, its share is derived from the launch's tax rate and paid from the protocol-fee remainder | Flap's protocol fee, not the project | Field exists in source. Rate and eligibility for third-party launchers to confirm with Flap |
| OpenFour royalty | ForwardVault sends about 6% of every tax receipt to the template's authorWallet() | The founder's tax share on tokens that adopt the template | Live mechanism, documented by Four.meme |
| Raise fee | A small share of the accepted raise, taken at launch | The project | Set to zero in v1. A lever for later |
| Services | Managed keeper, monitoring and alerts for launchpads and teams | Launchpads, teams | After mainnet |

The first two lines pay on trading volume over a token's whole life. That ties our income to launches that last, which is the behavior the product exists to produce.

A worked illustration, with made-up volume: a Four.meme token with $10M of monthly volume and a 1% tax each way produces $100,000 of tax a month. If the founder weight is 100%, the template author's 6% is $6,000 a month from that one token.

### Who adopts first

Teams that want a credible raise. Builders with a product who lose buyers to the assumption that every launch is a rug. The covenant sheet is their answer.

Launchpads that want fewer rugs on their front page. A verified covenant factory on Flap, and a template on Four.meme's create page.

Buyers who filter by terms. Once several covenants exist, the sheet becomes the thing people compare.

### Go to market

Pass Flap's factory audit so covenant vaults carry the low-risk badge instead of the unverified label.

Launch with three design-partner teams and publish their covenant sheets.

Publish the simulator and its dataset, so anyone can test their own terms against real launches.

Offer the OpenFour template as the low-commitment entry: a founder can adopt the tap and the switch without changing how they launch.

### Roadmap

| When | Milestone |
|---|---|
| Nov 25 to 27, 2026 | First build: the full lifecycle on a fork and on BNB testnet, the OpenFour template, the simulator |
| December 2026 | Flap audit of both factories. Independent review of the vault and oracle. Atlas production credentials. Legal review of redemption rights |
| Q1 2027 | Mainnet with three design partners. Decision on Guardian upgrades against an immutable factory. Stablecoin-quoted treasuries once Flap enables the pair |
| Q2 2027 | Sealed-bid raise mode with a uniform clearing price, using Peal's batched threshold encryption. Holder vote to raise the tap. Linear release after an unlock |
| Later | Treasuries held in tokenized assets priced by Atlas. A covenant standard other launchpads can implement. An optional legal wrapper for teams that want one |

Peal is existing work and is not part of the current build. It enters only on the roadmap.

### Numbers to track from day one

| Metric | Why it matters |
|---|---|
| BNB held under covenant | Size of the promise being kept |
| Oversubscription ratio per raise | Demand for protected launches |
| Exit rounds opened, and BNB redeemed | Proof the floor pays out |
| Tap paid, and months of runway left per project | Proof the budget rule holds |
| Share of covenants still active at 90 days | The comparison against the 80.96% two-month failure rate |

## Risks and open questions

The main external dependencies are access, not code: a factory Flap has to enable, and oracle credentials. Both have fallbacks (a fork, and a local signer).

### Risks

| Risk | Area | Chance | Impact | Response |
|---|---|---|---|---|
| Flap does not enable our launcher factory soon | Access | Medium | No live testnet launch | Fork demo with the factory enabled as Portal admin. Say so plainly |
| Atlas pull credentials or feed id arrive late | Access | Medium | Dollar rules run on a test signer | Build against the consumer with a local signer, swap when the key lands |
| Atlas push feed is read-restricted | Access | Medium | Fallback path unavailable | Pull mode is primary. Ask for whitelisting anyway |
| Flap token behaves differently from the examples on transfer or burn | Technical | Low | Redeem or claim reverts | Measure received amounts. Burn by sending to the dead address. Test on a fork early |
| Launch reverts on Flap's liquidity floor or name screen | Technical | Low | Raise cannot launch | The factory reads Flap's live floor and blocklist at creation and refuses such terms. Try and catch at finalize, then refund |
| Tax ends after taxDuration | Product | Low | Treasury grows only from issuer revenue | Default 100 years, bounded 30 days to 100 years, end date shown. Treat tax as upside: the floor math does not rely on it |
| Teams do not want these limits | Product | Medium | No supply | Lead with oversubscription data. Offer the Lite template as a first step |
| Floor is too low to matter after a year of spending | Product | Medium | Weak protection late in life | Show the runway table. Let teams choose a lower tap cap as a selling point |
| Many covenants enter exit rounds in a market crash | Product | Medium | Treasuries shrink together | That is the rule working. Rounds and cooldowns keep teams funded between them |
| Wrong BNB/USD from the oracle | Technical | Low | Tap mispriced | Strict gate, treasury cap on the tap, and unlocks need the multiple in BNB from the pool too, so a bad rate alone cannot unlock |
| Guardian upgrade misused or compromised | Trust | Low | Rules could be changed | Disclosed. Flap states a security review. Immutable factory is an option after audit |
| Redemption right treated as a security | Legal | Unknown | Limits who can use it | Legal review before mainnet. Testnet only for now |
| Flap or another team ships the same idea | Competitive | Medium | Lose the novelty | Speed, the audit relationship and published design partners |

### Design questions still open

| Question | Current answer | What would change it |
|---|---|---|
| Should the tap pause fully during an exit round? | Yes | Evidence that honest teams get starved. Then pay half |
| Is a 1% exit fee right? | Yes, and zero at wind-down | If it visibly widens the discount, drop it |
| What happens to the treasury share that backs pool-held tokens after wind-down? | It stays as backing. Arbitrage extracts most of it over time | A sweep rule after a long delay |
| Should unlocked team tokens be redeemable at once? | Yes, disclosed | Add a linear release after unlock |
| Should holders be able to raise the tap by vote? | Not in v1 | Demand from design partners |
| BNB or stablecoin treasury? | BNB, because Flap's native quote is the proven path | Flap enabling a stablecoin quote pair |

## References

Every linked page below was opened while preparing this document. The classic papers at the end are standard citations and were not reopened.

### Evidence on launches

Solidus Labs, Solana rug pulls and pump-and-dumps, May 2025.

Cernera, La Morgia, Mei and Sassi, Token spammers, rug pulls, and sniper bots: an analysis of the ecosystem of tokens in Ethereum and in the Binance Smart Chain, USENIX Security 2023 (arXiv 2206.08202).

MemeChain, arXiv 2601.22185.

Howell, Niessner and Yermack, Initial coin offerings: financing growth with cryptocurrency token sales, NBER w24774. Published in Review of Financial Studies 33(9), 2020.

### Mechanism precedents

Vitalik Buterin, Explanation of DAICOs, Jan 6, 2018.

Basis Point, MetaDAO ownership coins, Aug 2, 2026.

RockawayX, Novel permissionless fundraising mechanisms.

01Resolved, MetaDAO research note, Nov 1, 2026.

CoinDesk, ROOK token holders poised to collect $25M payout, Apr 13, 2023.

Blockworks, Aragon DAO dissolves, Nov 2023.

crypto.news, Genius.fun launches on BNB Chain, Sept 17, 2026.

### Integration documentation

BNB Chain, BNB Hack Bangkok: build, demo and pitch.

Flap, Pool Launch vault and launcher examples: README, src/flap interfaces, Crowd and StakeMine examples, fork tests.

Odaily, Flap Pool Launch announcement, Nov 4, 2026.

Four.meme, OpenFour docs: developer guide, unverified royalty, tax token, and the BaseTaxVault and ForwardVault contracts.

Atlas, Consensus Score.

Atlas docs: what makes Atlas different, push mode, pull mode, data quality, API summary, single feed, multi feed.

Atlas, push oracle interfaces on GitHub.

Venus community forum, oracle updates for the core pool.

CoinMarketCap API: DEX token endpoints, candles.

Cournot: documentation, partner public API.

### Agent layer

BNB Chain, Building the infrastructure base for the AI agent economy, May 21, 2026.

BNB Chain, BNB Hack Abu Dhabi highlights.

CoinDesk, AI agent token once worth $2.4 billion ends with founder calling it dead, Aug 5, 2026.

hoge.gg, AI agents on-chain: the 2026 reckoning over autonomy and trust. A secondary roundup, used for the wallet drain and the spending-cap advice.

Tomasev et al., Virtual agent economies, arXiv 2509.10147, Sept 2025.

ERC-8004: Trustless Agents, draft standard, and the contracts repo for BNB Chain addresses.

CoinMarketCap AI Agent Hub: x402, MCP server.

Four.meme, OpenFour Binance Agent ID Exclusive preset.

Binance, Agentic Wallet with AI Pro.

### Classic theory

Akerlof, G. (1970). The market for lemons. Quarterly Journal of Economics 84(3).

Aghion, P. and Bolton, P. (1992). An incomplete contracts approach to financial contracting. Review of Economic Studies 59(3).

Bradley, M., Brav, A., Goldstein, I. and Jiang, W. (2010). Activist arbitrage: a study of open-ending attempts of closed-end funds. Journal of Financial Economics 95(1).

Gompers, P. (1995). Optimal investment, monitoring, and the staging of venture capital. Journal of Finance 50(5).

Grossman, S. (1981). The informational role of warranties and private disclosure about product quality. Journal of Law and Economics 24(3).

Holmstrom, B. (1979). Moral hazard and observability. Bell Journal of Economics 10(1).

Jensen, M. and Meckling, W. (1976). Theory of the firm: managerial behavior, agency costs and ownership structure. Journal of Financial Economics 3(4).

Jensen, M. and Murphy, K. (1990). Performance pay and top-management incentives. Journal of Political Economy 98(2).

Lee, C., Shleifer, A. and Thaler, R. (1991). Investor sentiment and the closed-end fund puzzle. Journal of Finance 46(1).

Leland, H. and Pyle, D. (1977). Informational asymmetries, financial structure, and financial intermediation. Journal of Finance 32(2).

Smith, C. and Warner, J. (1979). On financial contracting: an analysis of bond covenants. Journal of Financial Economics 7(2).

## Appendix A: default parameters

The defaults below are the terms used in every example in this document. The demo column is the short-timer factory used for demos only.

| Parameter | Default | Demo | Can change after launch |
|---|---|---|---|
| Supply split | Sale 60%, pool 15%, team 25% | Same | No |
| Team tranches | 5% at 2x, 10% at 4x, 10% at 8x | Same | No |
| Sale window | 4 days | 2 minutes | No |
| Minimum and cap | Set by the team | 200 BNB and 500 BNB | No |
| Share of raise to the pool | 25% (follows from the split) | Same | No |
| Trading tax | 1% buy, 1% sell, all of the fee slots to the vault | Same | No |
| Tap budget | Set by the team, in dollars per 30 days | $30,000 | Team can lower it |
| Tap cap | 4% of treasury per 30 days | Same | No |
| Cliff | 6 months | None | No |
| Unlock window | 30 trusted days | 2 minutes | No |
| Exit streak | 3 trusted days below book | 3 minutes | No |
| Round length | 7 days | 5 minutes | No |
| Cooldown | 14 days | 2 minutes | No |
| Exit fee | 1%, zero at wind-down | Same | No |
| Heartbeat window | 45 days | 10 minutes | No |
| Minimum time between pokes | 1 hour | 20 seconds | No |
| Most time one poke can add | 6 hours | 1 minute | No |
| Atlas report age | 180 seconds | Same | No |
| Pool depth for a trusted observation | Half of the launch seed | Same | No |
| Pool against Atlas agreement band | 10% | Same | No |
| Dollar sale price ratchet window (staleAfter) | A higher verified BNB/USD can raise the dollar sale price for 14 days after the first reference | 1 hour | No |

Notes on the choices:

Four-day sale follows MetaDAO's raise length.

Trading tax is lower than the 3% and 5% in Flap's examples. A lower buy tax keeps the pool price closer to book during an exit round, because arbitrage has to pay it.

Tap cap of 4% leaves the treasury at 37.5% of its start after two years, with no tax income.

Three trusted days is long enough that a single bad day does not open a round, and short enough that a holder is not trapped.

Forty-five days of silence is about six weeks. Any team action resets it.

## Appendix B: glossary

| Term | Meaning |
|---|---|
| Accepted raise | The part of total commitments the sale keeps: the smaller of commitments and the cap |
| Book value | Treasury BNB, less tap already owed to the team, divided by redeemable supply |
| Cooldown | The period after an exit round when the exit trigger is disarmed |
| Covenant | One launcher and one vault with fixed terms. Also the set of five rules |
| Covenant sheet | The public page that shows a covenant's terms and live status |
| Exit round | A fixed window in which any holder can burn tokens for their share of the treasury |
| Guardian | Flap's security address. The only party that can upgrade vaults |
| Heartbeat | Any team action that proves the team is active |
| Launcher | The contract buyers interact with before the token exists. It runs the raise and launches once |
| Poke | The public call that records a price observation and advances the rules |
| Pool Launch | Flap's launch type where a token starts directly in a DEX pool with locked liquidity |
| Redeemable supply | Total supply, less burned tokens, less team tokens still locked |
| Strict gate | The tighter trust check used for the tap rate and unlock counters |
| Tap | The team's capped budget, accrued over time |
| Time-weighted price | The average pool price over an interval, from the pair's cumulative price |
| Token Dock | Flap's shared custody for reserved tokens, reached through its router |
| Tranche | A slice of team tokens that unlocks at a price multiple |
| Trust gate | The checks an observation must pass before its time counts toward a trigger |
| Trusted day | A day of time accumulated from observations that passed the trust gate |
| Vault | The contract that holds the treasury and reserved tokens and enforces the rules |
| Wind-down | The final state: no tap, locked team tokens burned, redemption open with no fee |

This doc takes suggestions. While the person is in Suggesting mode, lay a change as a suggestion. Otherwise, when to suggest and when to edit: guide( items = ["topic.suggestions"] ).
