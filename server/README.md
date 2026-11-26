# Covenant server

The off-chain side of Covenant: the **keeper**, the **API** the web app reads (`:8787`), the **launch simulator** on market data, the **issuer agent**, the **investor agent** and the **Covenant MCP server**. TypeScript on Node 22 with viem; standalone pnpm package.

```
server/
  src/
    schema.ts        zod response schemas (the web app mirrors these)
    config.ts        env + contracts/deployments/local.json discovery
    abi/             fallback ABIs from docs/DESIGN.md, merged under contracts/abi/*.json
    atlas/report.ts  Atlas pull-report codec, local test signer, SDK path
    covenant/        read model (sheet, events, history), unsigned tx builders, downside math
    keeper/          poke loop, tax dispatch, alerts, restart-safe state
    api/             Hono app: covenants, sheet, events, history, downside, txs, poke-report, CMC proxy
    sim/             simulator job: sample launches, daily candles, replay covenant terms
  agents/issuer/     issuer agent loop, period reports (Claude or labelled template), ERC-8004 registration
  agents/investor/   investor agent: under book -> downside -> redeem, over MCP
  mcp/               Covenant MCP server (stdio and stateless streamable HTTP) + SKILL.md
  scripts/           agent-demo.ts (a scripted agent session on BNB testnet), gen-llms.ts (web/public/llms-full.txt)
  data/simulator/    latest simulator output (real data, see provenance inside)
  test/              vitest: unit + chain (anvil) with a Solidity fake-chain fixture
```

## Run

```bash
cd server
pnpm install
cp .env.example .env        # optional: every value has a local default
export PATH="$HOME/.foundry/bin:$PATH"

pnpm test                   # unit + chain tests (starts its own anvil per file)
pnpm typecheck

pnpm api                    # http://127.0.0.1:8787
pnpm keeper                 # needs KEEPER_PRIVATE_KEY; --once for one tick: pnpm keeper:once
pnpm sim                    # writes data/simulator/latest.json (needs network)
pnpm issuer                 # needs ISSUER_PRIVATE_KEY (the team wallet); --once: pnpm issuer:once
pnpm investor               # needs INVESTOR_PRIVATE_KEY; drives the MCP server over stdio
pnpm mcp                    # stdio MCP server (BNB testnet from 97.json when there is no local.json)
pnpm mcp:http               # streamable HTTP MCP, stateless, read-only by default: POST http://127.0.0.1:8788/mcp
pnpm demo:agent             # scripted agent session over MCP against BNB testnet (docs/AGENT-DEMO.md)
pnpm gen:llms               # regenerate web/public/llms-full.txt from the tool list
```

Everything reads `contracts/deployments/local.json` (`{chainId, rpcUrl, addresses{...}, demo{...}}`) and `contracts/abi/<Contract>.json` at runtime. Until those exist the code runs on the interfaces in `docs/DESIGN.md`; point at any other file with `COVENANT_DEPLOYMENTS` / `COVENANT_ABI_DIR`. Vaults are found anywhere in the deployments JSON under a key ending in `vault` (factories, implementations and registries are skipped), or listed in `COVENANT_VAULTS`.

Signing is refused on BNB Chain (56) and testnet (97) unless `COVENANT_ALLOW_PUBLIC_NETWORK=1`: this build is local-only.

### Demo on a local chain

With the contracts lane's local node up and the demo factory timers (exit streak 3 min, round 5 min, heartbeat 10 min, poke interval 20 s):

```bash
KEEPER_PRIVATE_KEY=<anvil #5> KEEPER_POKE_INTERVAL_SECONDS=20 KEEPER_TICK_SECONDS=5 pnpm keeper
ISSUER_PRIVATE_KEY=<team key> ISSUER_TICK_SECONDS=20 ISSUER_PERIOD_SECONDS=120 pnpm issuer
CUSTOMER_PRIVATE_KEY=<anvil #6> pnpm issuer:earn <team address> 2   # revenue scene
# kill the issuer process on stage: nothing sends heartbeats any more; once the window passes the keeper
# declares abandonment on its next tick (on by default) and the treasury opens to holders. If the keeper is
# offline, anyone can press the sheet's "Declare abandoned" button or call MCP declare_abandoned instead
INVESTOR_PRIVATE_KEY=<holder key> pnpm investor
```

## Atlas: two modes

| | With `ATLAS_API_KEY` | Without (default) |
|---|---|---|
| Source | `@atlas-oracle/pull-oracle-consumer-sdk` `fetchPrices([ATLAS_BNB_USD_FEED_ID])`, validated (180 s max delay, 60 s drift) | local test signer, anvil account #9 `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` (override `ATLAS_LOCAL_SIGNER_KEY`) |
| Price | live Atlas BNB/USD | fixed `ATLAS_LOCAL_BNB_USD` (600) |
| Accepted by | an oracle whose authorized signer is Atlas's (`0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600`) | an oracle deployed locally with the test signer authorized |
| Labelled | `mode: "atlas"` | `mode: "local-test-signer"` and a note saying it is not Atlas |

The report bytes are exactly the Atlas consumer's layout: `[feedId u32 | value u80 (1e18) | timestamp u48]… ++ count u8 ++ signature (r‖s‖v, low-s) ++ 0x7096`, signed over `keccak256(packages ++ count)` with no EIP-191 prefix. Calldata is `poke(vault)` with the report appended, byte-identical to the SDK's `buildCalldata` (unit-tested). The fixture's oracle verifies it on-chain the same way the consumer does. The local signer stamps `max(wall clock, latest block time)` so a warped anvil still passes the freshness check.

## Keeper

Every tick, for each covenant: resolve any pending tx by receipt, decide whether a poke is due from chain state (`oracle.lastPokeAt(vault)` when exposed, persisted state otherwise), fetch a report, **simulate**, then send. Then dispatch pending trading tax (`token.taxProcessor().dispatch()` when the token has one), read the sheet and raise alerts.

- **Idempotent and redundant-safe.** The oracle refuses pokes inside its interval, and the pre-send simulation turns a redundant keeper's poke into a free skip (`TooSoon`). Any number of keepers, plus the web's poke button, can run at once.
- **Restart-safe.** State lives in `.data/keeper-state.json` (atomic writes) and a pid lock stops two processes sharing one key and state dir.
- **Exit fix 3.** If Atlas cannot be reached the keeper still pokes, with no report: the observation is untrusted, tap rate and unlocks do not move, the exit streak still steps.
- **Alerts** (stdout, `.data/alerts.jsonl` served at `/api/covenants/:vault/alerts`, optional `ALERT_WEBHOOK_URL`), deduplicated across restarts: `exit-streak-building` (each quarter of the streak, per round), `exit-round-open`, `heartbeat-due` (80% of the window), `abandonable`, `poke-failed`, `tax-dispatched`.
- **Keeper agent role.** It calls `declareAbandoned()` on its first tick after the heartbeat window has passed (default on; `KEEPER_DECLARE_ABANDONED=false` leaves the switch to a person). The anyone-can-press button and MCP `declare_abandoned` are the fallback when no keeper runs.

## API (`:8787`)

| Route | Returns (schema in `src/schema.ts`) |
|---|---|
| `GET /health` | `Health`: chain, block, deployments and ABI source, oracle, Atlas mode, CMC key present |
| `GET /api/covenants` | `{ covenants: CovenantSummary[] }` |
| `GET /api/covenants/:vault` (`?fresh=1` skips the 2 s cache) | `CovenantSheet`: state, treasury, book value, pool price, premium, terms, exit streak/round/cooldown, tap, tranches, heartbeat, trust, pool reserves, ledger totals, issuer (ERC-8004), launcher, `reads.missing` |
| `GET /api/covenants/:vault/events` (`?kind=raise\|tax\|tap\|redeem\|state\|observation\|team`) | `{ events: LedgerEvent[] }` decoded from vault and launcher logs, with tx hashes and block times |
| `GET /api/covenants/:vault/history` | `History`: `Observed` points (TWAP, book, BNB/USD, trusted, state) and exit-round bands |
| `GET /api/covenants/:vault/downside?holder=&tokens=` | `Downside`: redeem at book now vs. sell on pool, floor path at the tap cap, runway |
| `GET /api/covenants/:vault/alerts` | `{ alerts: Alert[] }` |
| `GET /api/covenants/:vault/tx/:action` | `UnsignedTx` for `commit?amount=`, `claim-refund`, `claim-tokens`, `redeem?amount=&from=`, `declare-abandoned`, `claim-tap`, `heartbeat`, `lower-tap?usd=` |
| `GET /api/poke-report?vault=` (alias `/poke-report`) | `PokeReport`: signed report + ready `poke(vault)` tx for the web's poke button |
| `GET /api/simulator` | `SimulatorResult` |
| `GET /api/simulator/sample` | the simulator's launches with their daily candles (BNB per token), for the web's "try other terms" replay |
| `GET /api/fourmeme/encode?tapBps=&tapPeriod=&heartbeat=&redeemFeeBps=[&template=]` | the Four.meme path: ForwardVault's vault data for a Covenant Lite vault, `abi.encode(InitParams(template, initData))` (one tuple, as the live ForwardVault decodes it; the flat encoding in Four.meme's docs reverts), with the template's bounds checked |
| `GET /api/fourmeme/launches` | Lite covenants the dev chain's FourLiteLauncher created, with treasury, tax forwarded, tap and heartbeat |
| `GET /api/faucet` / `POST /api/faucet {address}` | local test funds: whether the faucet is on, then 10 test BNB from anvil #0 plus 10,000 Demo USDC (dUSDC) minted to the address. Refused (403) on any RPC that is not a loopback node, whatever the chain id; needs `FAUCET_PRIVATE_KEY` (dev-all sets anvil #0); 30 s per address |
| `GET /api/cmc` and `/api/cmc/{pair-quote,token-liquidity,liquidity-change,candles,transactions}`, `POST /api/cmc/new-list` | CoinMarketCap DEX proxies from the doc; key stays server-side; `x-covenant-cmc-mode: pro \| keyless-public-api` |
| `GET /reports/:vault/:period` | issuer period report (markdown) whose hash is on-chain |
| `GET /agents/:owner/registration.json` | ERC-8004 registration file |

Wei amounts are integer strings; per-token prices are BNB per token × 1e18; `*Bnb`/`*Usd` numbers are display-only. CORS allows `CORS_ORIGINS`.

## Simulator

`pnpm sim` samples BNB Chain launches, pulls daily candles priced in BNB, and replays the default terms: floor at 60% of the opening price, falling 4% per 30 days (the tap cap binding), exit after 3 days below. It reports three variants: the original reset rule, the **decay** fix and the **72-hour average** fix; the headline uses `decay` (`--headline-rule`). Output: `data/simulator/latest.json` (with each launch's candles), served at `/api/simulator` and `/api/simulator/sample`. With `CMC_API_KEY`, candles come from CoinMarketCap (`/v1/k-line/candles`, `platform=bsc`, token address, `unit=native`); `POST /v1/dex/new/list` is plan-gated on the owner's key (403, error 1006), so the sample then comes from GeckoTerminal's listings, one entry per token.

- With `CMC_API_KEY`: CoinMarketCap `POST /v1/dex/new/list` and `GET /v1/k-line/candles`. **This mapping has not run in this build** (no key was available); if it returns nothing usable the job falls back to GeckoTerminal and says so.
- Without: **GeckoTerminal** (the stated fallback; the keyless CMC route answered with an anonymous-access limit). The sample is WBNB-quoted pools from GeckoTerminal's activity-ranked listings, created 14–180 days ago, so it is biased toward survivors and the trigger share is conservative. The output says this in `source.notes` and names the sample in the headline.
- `computedFromRealData` is true only when the headline comes from fetched candles; under `--min-sample` tokens there is no headline at all.

## Issuer agent

`agents/issuer`: the loop from the doc, every `ISSUER_TICK_SECONDS`:

1. forward revenue: BNB that arrived in the agent wallet since the last tick (and that it did not cause) goes to the vault with `depositRevenue(tag)` (a plain send on a vault without it), raising book value. Demo USDC that customers paid the agent (test funds, `demoUsdc` in the deployment) is recorded as revenue and stays in the agent wallet: treasuries are BNB because Flap's pools are BNB-quoted;
2. decide: claim the tap (once `ISSUER_MIN_CLAIM_BNB` has accrued), cut its own pay (once per period, never under `$5,000`), heartbeat (due at a third of the window). With `ANTHROPIC_API_KEY`, Claude (`ANTHROPIC_MODEL`, default `claude-opus-5-5`, structured output, server-side refusal fallback) proposes the plan from the vault's numbers and explains it; the policy bounds it (no claim of nothing, no cut under the floor or upward, no skipped heartbeat that is due) and notes any override. Without a key, or if the call fails, the fixed rules decide (claim when claimable, cut 20% when the pool trades within `ISSUER_PAY_CUT_BELOW_PREMIUM_PCT` of book, heartbeat on schedule). The model is not called when there is nothing to decide;
3. post the decision on-chain: `postReport(period, "data:application/json;base64,<record>", keccak256(record))` with the action, the reasoning, who decided (model or rule), the numbers it read and the action's transaction. It is also the heartbeat. The web app reads these records from the chain alone (the covenant page's "Agent decisions"). `ISSUER_POST_DECISIONS=0` keeps them local;
4. at period end write a report and `postReport(period, uri, keccak256(report))`.

The vault enforces the five rules whatever the agent decides: the LLM chooses within what the contract and the policy allow, never a rule. With `ANTHROPIC_API_KEY` the period report is written by Claude from the ledger only; without it a fixed template writes it and its first line says so. The ledger is appended to every report. Kill the process and it is gone: nothing else heartbeats for the covenant.

`pnpm issuer:register` writes the ERC-8004 registration file (MCP endpoint under `services`, `crypto-economic` under `supportedTrust`) and calls `register(agentURI)` from the team wallet. The sheet's `issuer` block shows the agent id, the registration URI, whether the identity owner is the team wallet, and the reputation summary counting only feedback written by known covenant vaults.

## Investor agent and MCP server

`pnpm mcp` serves 27 tools, 3 prompts (`explain_covenant`, `should_i_redeem`, `before_you_commit`) and 3 resources
(`covenant://network`, `covenant://guide`, `covenant://covenants/{address}`) over stdio. Reads: `get_network`,
`list_covenants`, `get_covenant`, `get_terms`, `get_status`, `get_raise`, `get_position`, `get_actions`, `get_downside`,
`get_issuer`, `get_market`, `get_events`, `simulate_transaction`. Writes: `commit`, `finalize`, `claim_tokens`,
`claim_refund`, `redeem`, `poke`, `declare_abandoned`, `release_team`, `deposit_revenue`, and for the team wallet
`claim_tap`, `heartbeat`, `lower_tap`, `post_report`, `wind_down`. Every covenant tool takes any of the covenant's
addresses. Writes return `{unsignedTransaction, simulation, howToSend}`: an eth_call at the latest block with the custom
error decoded and a gas estimate; the server never holds a key. `finalize` carries `FINALIZE_GAS` from
`src/covenant/gas.ts`, the one place that number lives (the web's copy is checked against it in `test/unit/gas.test.ts`).

Guards (`src/safety.ts`): the chain allowlist (31337, 56 on a loopback fork, 97; `COVENANT_ALLOWED_CHAINS`), the RPC's
chain id must match the record, a per-call BNB cap on built transactions (`COVENANT_MAX_VALUE_BNB`; 1 BNB on testnet),
RPC URLs printed host-only, and third-party text (token names, descriptions, URIs, event args) sanitized, listed in
`untrustedFields`, and fenced in `<untrusted-data>` blocks inside prompts. `pnpm mcp:http` adds a per-IP limit
(`MCP_HTTP_RATE_PER_MIN`, 120) and a Host allowlist on loopback (`MCP_HTTP_ALLOWED_HOSTS`); write tools only with
`MCP_HTTP_WRITES=1`. The API rate-limits `/tx/*` and `/poke-report` per IP (`API_TX_RATE_PER_MIN`, 60).
`mcp/SKILL.md` documents the same surface for skill-based agents; `web/public/llms-full.txt` is generated from it.

Hardening from the pre-audit (regressions in `test/unit/preaudit-regressions.test.ts`):

- **Provenance.** `CovenantService.known()` / `resolve()` accept a covenant only from the deployment record,
  `COVENANT_VAULTS`, factory discovery, or an on-chain factory check (`vaultFactory.launcherOf(vault) != 0`,
  `launcherFactory.isLauncher`). Reads never add a covenant; an unknown address gets a 404 (API) or an error with a
  `Next:` hint (MCP), never a sheet or a transaction. The ERC-8004 reputation filter is `vaultFactory.allVaults()`.
  `redeem` approves exactly the amount.
- **No secrets out.** A 500 returns `{error: 'internal error', id}` and logs the redacted detail; `/health`, the MCP
  server and the logs show the RPC host only; the web's `/api/deployment` serves the record's `rpcUrl` only when it is
  loopback.
- **Atlas.** The local test signer is used only on a loopback RPC, never on chain 97; when the oracle refuses a
  report-carrying poke (any reason but `TooSoon`), the keeper sends the bare poke, so the exit rule keeps stepping.
- **Signing guards.** On chain 56 or 97 a loopback RPC must also answer `web3_clientVersion` as anvil (or hardhat,
  ganache) before the keeper, issuer, investor or `issuer:register` sign, and before the local faucet pays.
- **Limits.** Every `/api/*` route has a per-IP limit (`API_RATE_PER_MIN`, 300), the X-Forwarded-For hop used behind a
  trusted proxy is the last one, caches are bounded, the Atlas report behind `/api/poke-report` is reused for 60 s,
  and a JSON-RPC batch to `mcp:http` costs one token per message. `mcp:http` refuses browser origins unless listed in
  `MCP_HTTP_ALLOWED_ORIGINS`.
- **Issuer agent.** The irreversible pay cut needs both the pool spot and the oracle-observed TWAP within
  `ISSUER_PAY_CUT_BELOW_PREMIUM_PCT` of book on `ISSUER_PAY_CUT_CONFIRM_TICKS` (3) consecutive ticks; on a public
  chain it is only recorded as due unless `ISSUER_AUTO_PAY_CUT=1`. On a public chain the issuer and `issuer:register`
  refuse a loopback or plain-http `API_BASE_URL`, since report URIs and the agentURI go on chain
  (`COVENANT_ALLOW_LOOPBACK_URIS=1` overrides).
- **Investor agent.** It signs only `approve(vault, <= amount)` on the covenant token and `redeem` on that vault, with
  no BNB attached and the wallet's chain id; anything else the MCP server returns is refused.

`pnpm investor` spawns the MCP server over stdio, lists covenants under book, computes the downside of its position, waits if no round is open, and redeems (approval + redeem, signed with its own key) when a round is open and redemption beats the pool by `INVESTOR_MIN_EDGE_PCT`.

## The contract surface the server reads

Checked against the real contracts (`contracts/abi`, deployed by `scripts/dev-up.sh`): `pnpm test:chain` runs
`test/chain/deployed.test.ts` against the running stack, and every sheet reports `reads.missing: []`. Each read is
tolerant: a view missing from the ABI yields `null` and is listed in `sheet.reads.missing`. Where the design doc and
the contracts name a view differently, the server tries both (`src/covenant/read.ts`, `VAULT_ALIASES`).

- **Vault:** `state()` (enum order RAISING, FAILED, ACTIVE, EXIT_ROUND, COOLDOWN, WIND_DOWN), `bookValue()`,
  `redeemableSupply()`, `exitStreak()`, `exitStreakNeeded()` (doc: `exitStreakTarget`), `tapAccrued()`, `owedTeam()`,
  `tapPaid()` (doc: `totalTapPaid`), `taxToken()` (doc: `token`), `trancheCount()`, and `trancheProgress(k)`, which returns
  `(amount, multiple x100, progress seconds, unlocked, targetUsd)` in one call. Also `launcher, teamWallet, pair, agentId,
  salePriceBnb, usdSalePrice, tapUsdPer30d, tapCapBps, roundLength, cooldown, exitFeeBps, heartbeatWindow, unlockWindow,
  roundEnd, cooldownEnd, lastHeartbeat, lockedTeam, totalRedeemed, lastObservedAt, lastTrusted, lastStrict`.
  Writes: `claimTokens, claimTap, lowerTap, heartbeat, releaseTeam, redeem(amount, minOut), declareAbandoned, windDown,
  postReport, depositRevenue(tag), sync`.
- **Oracle:** `poke(address)` with the Atlas report appended to the calldata; the last poke time comes from
  `points(vault).pokedAt`; a second poke inside the vault's `minPokeGap` reverts `TooSoon`.
- **Launcher:** `state, committed, terms()` (holds `minRaise` and `cap`), `saleDeadline, contributions, acceptedOf,
  allocationOf, refundOf, contribute, finalize, claimRefund, vault, token, pool`.
- **Discovery:** every launched covenant from `launcherFactory.allLaunchers()` and `demoLauncherFactory.allLaunchers()`
  (then `launcher.vault()`), on each list and keeper tick, so covenants created in the web app appear without a restart.
- **Event args the ledger reads:** `TreasuryFunded(amount, pair)`, `RevenueRecognized(amount, totalRevenue)`,
  `RevenueDeposited(from, amount, tag)`, `TapClaimed(to, amount)`, `Redeemed(account, tokens, bnbOut, bookValue)`,
  `Observed(twapBnb, bnbUsd, bookValue, trusted, strict, state, exitStreak)`, `ExitRoundOpened(roundEnd, bookValue,
  twapBnb)`, `ExitRoundClosed(roundEnd, cooldownEnd)`, `OutcomeRecorded(agentId, value, outcome, ok)`.
- **Logs start** at `deployments/local.json` `deployedAtBlock` (plus one on a fork, whose deploy block is the fork
  block; reading at or below it would hit the upstream public RPC).
- **Signing** is allowed on chain 56 or 97 only when the RPC is a loopback address (the local fork); anything else
  still needs `COVENANT_ALLOW_PUBLIC_NETWORK=1`.

## The three exit-rule fixes, where this package touches them

1. **Decaying streak.** The sheet reports `exit.rule: "decaying-streak-onchain"`; the fixture vault decays the streak by the elapsed time above book; the simulator replays reset vs. decay vs. 72-hour average; the "pump one day in three" attack is a unit test (blocks the old rule, not the fixed ones).
2. **Depth gate on unlocks only.** The fixture oracle sets `strict` (tap rate, unlocks) from pool depth and leaves `trusted`/the exit alone; a chain test opens a round with the pool far under half its seed.
3. **Exit on on-chain numbers only.** The keeper pokes without a report when Atlas is down, and a chain test opens a round with no report at all.

## Tests

`pnpm test` runs both projects. `test/chain/*` start anvil on a random port per file and deploy `test/fixtures/contracts` (mock vault, oracle, launcher, token, pair, ERC-8004 registries, compiled with forge). `test/chain/deployed.test.ts` runs against the real contracts when `contracts/deployments/local.json` exists and is skipped otherwise.
