# Landing sources

Every number, quote and claim about the outside world on the landing pages, with the page it comes from. Each page
was opened and the figure or quote checked against it on 26 Nov 2026. Rule behaviour and default terms come from
`docs/DESIGN.md` and, for the exit rule, from the contract as built (`contracts/src/vault/CovenantVault.sol`: the
streak decays instead of resetting and reads on-chain numbers only). Logo sources are in
`web/public/landing/logos/SOURCES.md`.

Where it shows up: **P** = home "The problem today" (`web/src/landing/content/problem.ts`), **V** = home "Who named
this problem" (`content/voices.ts`), **U** = use cases (`content/useCases.tsx`), **A** = home "Why we built it"
(`sections/home/HomePriorArt.tsx`), **B** = home "How it's built" (`sections/home/HomeBuiltOn.tsx`).

## The problem today

| Figure on the page | What the source says (exact) | Source | Used in |
| --- | --- | --- | --- |
| 98.6% of Pump.fun tokens with at least five trades fell below $1,000 of liquidity, Jan 2024 to Mar 2025 | "Over 7 million tokens deployed with at least five trades, but only 97,000 tokens maintain liquidity above $1,000." The methodology defines "the 98.6% metric" as the share of Pump.fun tokens "that have fallen under $1,000 worth of liquidity measured in SOL". | Solidus Labs, "The 2025 Rug Pull Report", May 2025. https://www.soliduslabs.com/reports/solana-rug-pulls-pump-dumps-crypto-compliance | P, U |
| ~60% of tokens on BNB Chain and Ethereum were active for less than one day; one-day rug pulls took about $240M | "We discover that about 60% of tokens are active for less than one day." "We estimate that 1-day rug pulls generated $240 million in profits." Pooled across both chains, from their start to March 2022. | Cernera, La Morgia, Mei, Sassi, "Token Spammers, Rug Pulls, and SniperBots", USENIX Security 2023. https://arxiv.org/abs/2206.08202 | P, U |
| 80.96% of BSC meme coins in an October 2024 sample had no transactions two months later | "BSC exhibited the highest extinction rate, with 80.96% of its meme coins (12,503 out of 15,442) showing no recent activity". Coins collected mid-October 2024; inactive means no transaction after 15 Dec 2024. | Mongardini and Mei, "MemeChain", arXiv 2601.22185, Jan 2026. https://arxiv.org/html/2601.22185v1 | P, U |
| 53.2% of all tokens tracked on GeckoTerminal since 2021 have failed, 11.6 million of them in 2025 | "53.2% of all cryptocurrencies on GeckoTerminal have failed, with the majority occurring in 2025 itself." 11.6M failures in 2025. | CoinGecko Research (Shaun Paul Lee), "Dead Coins", Jan 2026. https://www.coingecko.com/research/publications/how-many-cryptocurrencies-failed | P |
| $2.39B peak of AI16Z, sold as an "autonomous, AI-run venture fund"; down 97%; founder called it dead | "peaked at $2.39 billion on Jan. 2, 2025"; "down 97% from its high"; the class action said the project marketed itself as an "autonomous, AI-run venture fund". | CoinDesk, "AI agent token once worth $2.4 billion ends with founder calling it dead", 5 Aug 2026. https://www.coindesk.com/markets/2026/08/05/ai-agent-token-once-worth-usd2-4-billion-ends-with-founder-calling-it-dead | P, U |
| $106K in ETH (55.5) sent from the AIXBT agent's wallet by two prompts after its dashboard was breached | The attacker "made two prompts for it to transfer 55.5 Ether, worth $106,200, from its wallet." The developer said the dashboard was breached; the AI itself was not manipulated. | Cointelegraph, 19 Mar 2025. https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth | P, U |
| −91%: VIRTUAL from $4.61 to $0.42 between Jan 2 and Apr 7, 2025; Virtuals revenue near $500 a day | VIRTUAL hit "an all-time high of $4.61" on Jan 2 and fell "as low as $0.42" by Apr 7 (−90.9%). Headline: "Virtuals revenue plunges to $500 a day". | Cointelegraph, 9 Apr 2025. https://cointelegraph.com/news/ai-agents-virtual-revenue-plunge-token-price-decline | P, U |
| $47,316 prize pool an AI agent paid out in a public challenge after 482 attempts | Final prize $47,316.05; "challenged by 195 players with 482 attempts". It was a designed game, and the page says so. | The Block, 29 Nov 2024. https://www.theblock.co/post/328747/human-player-outwits-freysa-ai-agent-in-47000-crypto-challenge | P |
| $580M committed to MetaDAO's capped raises over 14 launches; $535M (92.2%) refunded above the caps; about 13x demand (also A: "Buyers offered $580M across 14 raises") | "MetaDAO's launchpad has taken roughly $580M in ICO commitments and refunded $535M (92.2%) over 14 launches." "everything above the cap is refunded pro rata." 580 / 45 ≈ 12.9. | Basis Point, "MetaDAO Ownership Coins", 2 Aug 2026. https://basispointres.substack.com/p/metadao-ownership-coins | P, A |

Wording fixed against the sources: the earlier stats row said "$580M committed to protected raises, 92.2% of it
refunded", which read as protections paying out. The refunds were oversubscription above the caps, so the page now
says that, and presents it as the demand signal. "80.96% … about two months in" now names the window (October to
December 2024), since the study measured from its collection date, not from each coin's launch. Solidus Labs' own
executive summary says 98.7% where its methodology says 98.6%; the page uses the methodology's 98.6% and its
definition.

## Who named this problem

On the page: the owner's five, in this order: Buterin (DAICO, 2018), Buterin ($100 a day, 2026), BNB Chain (21 May
2026), Dixon and Harkavy (a16z crypto, May 2026), MetaDAO docs. The other rows were verified the same way and are
kept here for reference; they are not on the page. Quotes are copied from the page.

| Who | Date | Exact quote (or paraphrase) | Source |
| --- | --- | --- | --- |
| Vitalik Buterin, Ethereum co-founder | 6 Jan 2018 | "they can always vote to shut the DAICO down entirely and get their money back." | "Explanation of DAICOs", ethresear.ch. https://ethresear.ch/t/explanation-of-daicos/465 |
| Vitalik Buterin | 2 Apr 2026 | "If your goal is to avoid large losses of funds, it's reasonable to allow a daily limit of $100 to bypass human confirmation." (A limit before a human must confirm, not a hard cap; the page quotes it as written.) | "My self-sovereign / local / private / secure LLM setup, April 2026". https://vitalik.eth.limo/general/2026/04/02/secure_llms.html |
| BNB Chain, official blog | 21 May 2026 | "Agent finance needs four things: identity, capability, payment, accountability." | "BNB Chain: Building the Infrastructure Base for the AI Agent Economy". https://www.bnbchain.org/en/blog/bnb-chain-building-the-infrastructure-base-for-the-ai-agent-economy |
| Tomašev, Franklin, Leibo, Jacobs, Cunningham, Gabriel, Osindero (Google DeepMind) | 12 Sep 2025 | "socio-technical infrastructure needed to ensure trust, safety, and accountability." | "Virtual Agent Economies", arXiv 2509.10147. https://arxiv.org/abs/2509.10147 |
| Sean Neville, Circle co-founder and CEO of Catena Labs, in a16z crypto | 11 Dec 2025 | "agents will need cryptographically signed credentials to transact — linking the agent to its principal, its constraints, and its liability." | a16z crypto, "17 things we're excited about for crypto in 2026". https://a16zcrypto.com/posts/article/big-ideas-things-excited-about-crypto-2026/ |
| Chris Dixon and Elizabeth Harkavy, a16z crypto | 20 May 2026 | "There's still no standard framework for proving agent identity, handling delegated authority, or enforcing spending policies." | "Investing in Catena, Part II". https://a16zcrypto.com/posts/article/investing-in-catena-part-ii |
| Sabrina Howell, Marina Niessner, David Yermack | 2018 (RFS 2020) | "Success is associated with disclosure, credible commitment to the project, and quality signals." | NBER working paper w24774. https://www.nber.org/papers/w24774 |
| MetaDAO (docs, not attributed to a person) | Undated; read 26 Nov 2026 | "Most tokens don't give you real ownership. The team controls the treasury, the IP, and a huge chunk of the supply. Token holders have no power." | https://docs.metadao.fi/benefits/ownership-coins |
| Charles Lee, Andrei Shleifer, Richard Thaler | 1991 | Paraphrase: closed-end funds often trade at a discount to the value of the assets they hold, and the discount moves with investor sentiment. The abstract's own words: "This paper examines the proposition that fluctuations in discounts of closed-end funds are driven by changes in individual investor sentiment." Linking this to tokens below treasury value is our framing. | "Investor Sentiment and the Closed-End Fund Puzzle", Journal of Finance 46(1). https://ideas.repec.org/a/bla/jfinan/v46y1991i1p75-109.html |

Checked and left off the page:

- Aghion and Bolton (1992), "An Incomplete Contracts Approach to Financial Contracting", Review of Economic Studies
  59(3), https://ideas.repec.org/a/oup/restud/v59y1992i3p473-494..html. "Control passes to investors in bad states"
  is a paraphrase, not in the abstract (which asks "how should control rights be allocated to achieve
  efficiency?"). It stays in DESIGN.md's research table, not on the page.
- Solidus Labs' quote ("approximately 98.7% of tokens on Pump.fun and 93% of liquidity pools on Raydium have
  exhibited characteristics of pump-and-dump schemes or rug pulls") repeats the stat with a different number, so the
  page shows the stat only.
- ERC-8004 ("Trust models are pluggable and tiered, with security proportional to value at risk",
  https://eips.ethereum.org/EIPS/eip-8004) is verified. It is used on the page as an integration, not as a quote.
- DESIGN.md's "about $175,000 drained from an agent wallet on May 4, 2026" and "Buterin advised capping autonomous
  spending near $100 a day" came from a secondary roundup. The first is not used. The second is replaced by
  Buterin's own words above, which are about a limit before human confirmation, not a cap.
- Chainalysis "3.59% of 2024 tokens": secondary sources disagree on the year and the metric, and the primary report
  was not opened. Dropped.

## Use cases

Each use case's "What goes wrong today" cites rows above: working capital (CoinDesk, Cointelegraph Mar 2025),
community round (Cernera et al.), inference agent (Cointelegraph Apr 2025), self-owning machine (Tomašev et al.),
protected tier (Solidus Labs, MemeChain). Every number on a use-case covenant sheet and cover card is illustrative
and labelled so on the sheet. They use DESIGN.md's default terms (Appendix A): sale 60%, pool 15%, team 25%, so the
treasury is 75% of the accepted raise, the starting floor is 60% of the sale price and the tap cap is 4% of the
treasury per 30 days. The community round is DESIGN.md's worked example (1,400 BNB committed, 500 accepted, 900
refunded, 375 BNB treasury).

Covers are live HTML (`sections/usecases/Cover.tsx`), not images: the template's own hero sky photo
(`web/public/landing/home/hero-plate.jpg`) under one product card per case. No third-party photos are used.

## Why we built it (prior art)

| Claim on the page | Source |
| --- | --- |
| The DAICO: a tap the team can lower but not raise; holders can vote to shut it down and get their money back; both run on a vote | Buterin, "Explanation of DAICOs" (row above): "they can always vote to shut the DAICO down entirely and get their money back." The tap and the vote to raise it are in the same post (DESIGN.md "What the precedents teach"). |
| Ownership coins: the treasury sits under market oversight so the team can't easily rug it; it moves only by decision market | MetaDAO docs, https://docs.metadao.fi/benefits/ownership-coins: "Treasury governed by decision markets: money sits in a treasury with market oversight so that the team can't easily rug it." and "The valuable parts of the organization—intellectual property, treasury, mint authority—are controlled by decision markets." "A holder who wants out alone sells at the market price" is our reading of that: there is no individual redemption. |
| Buyers offered $580M across 14 raises | Basis Point (row above). |
| Launchpads: 98.6% of Pump.fun tokens fell below $1,000 of liquidity | Solidus Labs (row above). |
| Locks and vesting: say nothing about the raise or the treasury; a team can vest into a dead token | Our own analysis (DESIGN.md "Why the usual fixes fall short"); labelled "Our own read" on the page. |
| Covenant's limits: a contract right to treasury BNB, not the company or its IP; no holder vote in v1 | DESIGN.md "Where Covenant is weaker, stated up front". |

## How it's built (integrations)

Data: `web/src/landing/content/integrations.ts`, shown on the home flow and the /features tiles. Checked on 27 Nov 2026
against the current deployment (`contracts/deployments/97.json`, the 27 Nov redeploy) and the `$CVD` test launch in
`docs/DEPLOY.md` ("Flap's test launch on BNB testnet"); statuses match README.md ("Proven on chain", "Fork only") and
JUDGES.md ("What is not done"). Nothing is on mainnet. Proof links: `$CVD` token
`0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777`, finalize tx `0x38170242…`, pool `0x464AF9543120B9a83Da2196BC6C3d1FC67E7860b`,
buy tx `0x00cdbd9c…`, strict poke tx `0x114078bc…` (all in DEPLOY.md). Cournot is not listed: only its verdict hook
(`recordVerdict`) is designed; no relayer is integrated.

| Integration | What the page says | Where it is checked |
| --- | --- | --- |
| Flap Pool Launch | `Portal.newLauncher` with our launcher factory; the launcher calls `Portal.launchTaxTokenV2` at finalize; the vault deposits reserved tokens through the TokenDockRouter; tax to the vault. Portal `0x000042108465206185A077Edc3F3fd2b49060000` and TokenDockRouter `0x000048E888aBf09f690a952E1b386b2D031a0000` (same on testnet and mainnet). Our testnet launcher factory `0x528374FeF9da2C31C646E59AE19EB2aE18b7a0DF`, vault factory `0xAbb9811f529B793c86848211522B789071671ebC`, demo pair `0x0F92C58c6aC5A3f6A5E3fF23a7698F58306Df2aE` / `0x6d3a421708F8b45FbD92342d33a841de40E6cC8F` (launched `$CVD` through launcher `0xFb40790832BBAF5ABe61Db0beEc575468c973045`). Status: live on BNB testnet (Flap's testnet Portal launched `$CVD`); tax reaching a vault is fork-tested | `contracts/src/launcher/CovenantLauncher.sol` (`finalize`, `launchTaxTokenV2`), `CovenantLauncherFactory.sol`, `CovenantVault.sol` (`ITokenDock.deposit`), `docs/DEPLOY.md` address table, `contracts/test/fork/Covenant.BSC.fork.t.sol` ("Nothing of theirs is mocked") |
| PancakeSwap V2 | Each poke reads the pair's `price0CumulativeLast` / `price1CumulativeLast` and turns it into the time-weighted price since the vault's last poke; the exit reads only that and book value | `contracts/src/oracle/PairTwap.sol`, `CovenantOracle.sol` header ("trusted = the pool TWAP is valid. That is all the exit streak needs") |
| Atlas | BNB/USD push feed on BNB testnet `0x3957d289ee9C38272377786787ea34F9dd29788D`: read on-chain on 26 Nov 2026, `decimals()` = 18, `description()` = "SingleFeed BNB/USD", `latestRoundData()` about $559.29, updated seconds before the call. CovenantOracle reads a Chainlink-compatible push feed passed at deployment (`ATLAS_PUSH_FEED`); signed pull reports are tried first when present; only strict observations (verified fresh BNB/USD and a pool at least half its seed) move the dollar rules; the exit never depends on it | `CovenantOracle.sol` (fallback ladder, strict gate), `contracts/script/Deploy.s.sol` (`ATLAS_PUSH_FEED`), BNB testnet RPC |
| CoinMarketCap | `/v4/dex/pairs/quotes/latest` (quote, holders, security scan on the sheet), `/v1/k-line/candles` (price against book, simulator), `/v1/dex/liquidity-change/list` and `/v1/dex/tokens/transactions` (depth alerts, sellers in a round) | `server/src/api/cmc.ts` (`CMC_ROUTES`), `server/src/sim/main.ts` |
| ERC-8004 | `IdentityRegistry.ownerOf(agentId)` must be the team wallet; `ReputationRegistry.giveFeedback` inside try/catch. Testnet identity `0x8004A818BFB912233c491871b3d84c89A494BD9e`, reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713`; mainnet identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, reputation `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`. Proven on a mainnet fork against the live registries | DESIGN.md "Optional contract changes", `docs/DEPLOY.md`, `CovenantVault.sol`, the fork test |
| Four.meme / OpenFour | ForwardVault (`0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4`, BNB Chain) clones CovenantLiteVault per token; settings fixed at creation; creation itself happens on Four.meme's site. Proven on a mainnet fork (the fork clones the live ForwardVault) | `contracts/src/openfour/CovenantLiteVault.sol`, `docs/DEPLOY.md`, integration commit "the Four.meme path end to end on the fork" |
| BNB Chain | `Deploy.s.sol` targets 97 and 56 and refuses other chains; proven on a mainnet fork; deployed on BNB testnet and verified on Sourcify (current lens `0x21DA47FC79DaF6479A1703aab1E5fc18B5bFa6b4`) | `contracts/script/Deploy.s.sol`, `docs/DEPLOY.md` |

## Launch on Four.meme

Founder's tax share to a vault, a capped draw per period that counts as a heartbeat, pro rata redemption after
silence or wind-down, template fixed at creation; no raise and no book-value exit: DESIGN.md "Four.meme and OpenFour"
and `contracts/src/openfour/CovenantLiteVault.sol`.

