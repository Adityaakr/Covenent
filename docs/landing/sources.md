# Landing sources

Every number, quote and claim about the outside world on the landing pages, with the page it comes from. Each page
was opened and the figure or quote checked against it on 26 Nov 2026. Rule behaviour and default terms come from
`docs/DESIGN.md` and, for the exit rule, from the contract as built (`contracts/src/vault/CovenantVault.sol`: the
streak decays instead of resetting and reads on-chain numbers only). Logo sources are in
`web/public/landing/logos/SOURCES.md`.

Where it shows up: **P** = home "The problem today" (`web/src/landing/content/problem.ts`), **V** = home "Who named
this problem" (`content/voices.ts`), **U** = use cases (`content/useCases.tsx`), **C** = home compare note.

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
| $580M committed to MetaDAO's capped raises over 14 launches; $535M (92.2%) refunded above the caps; about 13x demand | "MetaDAO's launchpad has taken roughly $580M in ICO commitments and refunded $535M (92.2%) over 14 launches." "everything above the cap is refunded pro rata." 580 / 45 ≈ 12.9. | Basis Point, "MetaDAO Ownership Coins", 2 Aug 2026. https://basispointres.substack.com/p/metadao-ownership-coins | P, C |

Wording fixed against the sources: the earlier stats row said "$580M committed to protected raises, 92.2% of it
refunded", which read as protections paying out. The refunds were oversubscription above the caps, so the page now
says that, and presents it as the demand signal. "80.96% … about two months in" now names the window (October to
December 2024), since the study measured from its collection date, not from each coin's launch. Solidus Labs' own
executive summary says 98.7% where its methodology says 98.6%; the page uses the methodology's 98.6% and its
definition.

## Who named this problem

Quotes are copied from the page. The one paraphrase is labelled on the page.

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

Each use case's "What goes wrong today" cites rows above: AI agent (CoinDesk, Cointelegraph Mar 2025), community
round (Cernera et al.), inference agent (Cointelegraph Apr 2025), self-owning machine (Tomašev et al.), launchpad
(Solidus Labs, MemeChain). Every number on a use-case covenant sheet is illustrative and labelled so on the page. The
sheets use DESIGN.md's default terms (Appendix A): sale 60%, pool 15%, team 25%, so the treasury is 75% of the
accepted raise, the starting floor is 60% of the sale price and the tap cap is 4% of the treasury per 30 days. The
community round is DESIGN.md's worked example (1,400 BNB committed, 500 accepted, 375 BNB treasury).

## Compare note

MetaDAO mechanics: Basis Point (above) and RockawayX, as cited in DESIGN.md "Positioning and prior art". DAICO:
Buterin 2018 (above).
