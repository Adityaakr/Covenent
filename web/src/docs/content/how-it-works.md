```covenant
diagram:lifecycle
```

## 1. Raise

A founder or an agent creates a covenant through Flap's Portal with the Covenant launcher factory. All terms are set at this moment and stored on chain: the token split, the minimum and the cap, the sale length, the trading tax, the budget, the unlock multiples, the exit timers and the heartbeat window.

During the sale, buyers commit BNB to the launcher. There is no per-wallet limit. If more than the cap comes in, every commitment is accepted pro rata and the rest can be taken back. If less than the minimum comes in, the raise fails and everyone can take their full commitment back. Refunds are pulled with `claimRefund()`, never pushed.

## 2. Launch

After the deadline anyone can call `finalize()`. It needs a 15,000,000 gas limit (Flap's cap); the app, the API and the MCP server set it for you. In one transaction the launcher asks Flap's Portal to mint the token, seed a PancakeSwap pool at the sale price, and create the covenant's vault, then sends the rest of the raise to the vault.

With the default split (60% of the supply sold, 15% in the pool, 25% for the team), a quarter of the accepted BNB seeds the pool and three quarters become the treasury. Flap's Token Dock holds the buyers' tokens until each buyer claims them, and the team's tokens until they unlock. If the Portal refuses the launch, anyone can retry during a short window (3 days on the production factory); after that the raise fails and refunds in full.

## 3. Vault

The vault holds the treasury in BNB. The token charges a trading tax (1% on buys and 1% on sells by default, for 100 years), and Flap's tax processor sends it to the vault as revenue. An issuer can add revenue with `depositRevenue()`. More revenue means a higher book value for every holder.

## 4. Budget

The team wallet draws the tap: a budget set in US dollars per 30 days, paid in BNB at the Atlas BNB/USD rate and never more than a fixed share of the treasury ($30,000 and 4% by default). The team can lower it, never raise it. Claiming the tap also counts as a heartbeat.

## 5. Exit

About once an hour, someone pokes the oracle: the keeper, the app's button, an agent, or anyone. Each poke compares the pool's time-weighted price with book value. Time below book builds the exit streak; time above book takes it back. When the streak fills (3 days by default), an exit round opens and any holder can redeem tokens for their share of the treasury, less a 1% fee that stays with the remaining holders.

If the team stops sending heartbeats for the window (45 days by default), anyone can declare the covenant abandoned. The treasury then opens to holders forever, with no fee. [Concepts](/docs/concepts) explains each part in more detail.
