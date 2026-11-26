# Judging Covenant

Covenant is a Flap Pool Launch launcher and vault on BNB Chain. It puts a raise (by an AI agent or a human team) under
five rules anyone can trigger: a capped budget that only goes down, unlocks on price, an exit at book value, a dead-man
switch, and on-chain reports. Testnet only (chain 97), unaudited, built 25-27 Nov 2026.

This page lists what is proven where and gives the command that checks each claim. BscScan refuses most automated
clients, so every check below uses Sourcify or an RPC.

## See it working in 2 minutes (no wallet, no clone)

1. **A covenant whose issuer went silent.** Open
   https://covenant.adibuilds.in/app/c/0x524059B1424101D4CAFD33B9a1A8D332dD71193D (`$CVT`). The timeline shows the
   raise, the Flap launch, the issuer agent's budget claim and heartbeats, the keeper declaring abandonment, and a holder
   redeeming at book.
2. **Ask the app.** Open Ask AI in the app and ask: "What happened to this covenant, and why can holders redeem?" It
   answers from live chain reads and never holds a key.
3. **Read what agents read.** https://covenant.adibuilds.in/llms.txt (summary) and
   https://covenant.adibuilds.in/llms-full.txt (every MCP tool, generated from the server).
4. **Check one transaction yourself.** This RPC still serves old receipts (publicnode answers them with `null`):
   `cast receipt 0xa41449d924c01b477e16562c3e0eb9212dda1e42b1a4d9b27b47c5f43c0399be status --rpc-url https://bsc-testnet.bnbchain.org`
   prints `true`. This is the finalize, where Flap's Portal launched the token and the pool and funded the vault.

## Run it in 10 minutes (clone)

```bash
git clone https://github.com/Adityaakr/Covenent.git && cd Covenent && git submodule update --init
( cd contracts && forge test )                                                       # 155 passed, 3 skipped (fork suites need BSC_RPC_URL / BSC_TESTNET_RPC_URL)
( cd server && pnpm install --frozen-lockfile && pnpm test )                         # 137 passed, 3 skipped
( cd web && pnpm install --frozen-lockfile && pnpm test && pnpm build )              # 106 passed, then a production build
```

**Talk to the MCP server.** It needs no key, reads BNB testnet, and its writes return unsigned transactions:

```bash
( printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"judge","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_covenants","arguments":{"include_raises":true}}}'; sleep 25 ) \
  | COVENANT_NETWORK=testnet pnpm --silent --dir server mcp
```

This prints the 27 tools, then every covenant on chain 97 with its state, treasury and book value. Any covenant address
works as input (vault, token, launcher or pool): `get_events` with the CVT token
`0x40002FcB9983c46b299F13e2d64E2c9Cb3b07777` returns its whole ledger. In Claude Code:
`claude mcp add covenant -- pnpm --dir "$PWD/server" mcp`, then ask "list the covenants and tell me which I could
redeem".

**The whole stack locally:** `scripts/dev-all.sh` starts a chain, deploys everything, seeds a covenant at every stage
by real transactions, and opens http://localhost:8080.

## Claims and evidence

| Claim | Evidence | Check |
|---|---|---|
| The contracts are deployed and source-verified on BNB testnet | 97.json: oracle `0x2Df1…F775`, launcher factory `0x5283…a0DF`, vault factory `0xAbb9…1ebC`, demo pair `0x0F92…f2aE` / `0x6d3a…cC8F`, lens `0x21DA…a6b4`, Lite template `0x411c…D285` (the 27 Nov 2026 redeploy with the fixes for Flap's pre-audit re-review) | `curl https://sourcify.dev/server/v2/contract/97/0x2Df1Ad97fe98033Cc4Eba6Ea98B5703B0c69F775` returns `"match":"match"`; the same for each address in [README, Deployments](README.md#deployments) |
| It is a real Flap Pool Launch integration, not a mock | The factories extend Flap's `LauncherFactoryBase` and vault bases (`contracts/src/launcher`, `contracts/src/vault`). The vault factory's `newVault` checks the launcher against the Portal's record. The vendored Flap code is byte-identical to upstream (`contracts/VENDORED.md`). Covenant's own flap.sh UI packages are in [`flap/`](flap/README.md) | CVD's create tx `0x849e3d5cda9879d551dcecec99870c5067b617f03c1860eda7e98db151422034` (current contracts) and CVT's `0x6176d4d188fc535a2ce8eb712dd62abd57b88d21018655a2f69015b3ac36a737` both have `to` = the Flap Portal `0x000042108465206185A077Edc3F3fd2b49060000` (`cast tx <hash> to --rpc-url https://bsc-testnet.bnbchain.org`) |
| Every stage ran on chain | [DEPLOY.md, "End-to-end run"](docs/DEPLOY.md#end-to-end-run-on-bnb-testnet-26-nov-2026): create, commit, finalize, claim, poke, tax dispatch, sell, heartbeat, tap, abandonment, redeem (11 txs, all status 1). CVT was made by the first deployment's demo factory, before the audit fixes. On the current contracts, Flap's Portal launched `$CVD` through the demo pair: [DEPLOY.md, "Flap's test launch"](docs/DEPLOY.md#flaps-test-launch-on-bnb-testnet-27-nov-2026) (create, commit, finalize with a 15M gas limit, claim, a trade round trip, a strict poke) | `cast receipt <tx> status --rpc-url https://bsc-testnet.bnbchain.org` |
| An issuer that stops loses control of the treasury | `CovenantVault.declareAbandoned` (anyone can call it after the heartbeat window). On testnet: tx `0xb353116ef47c503e415fdac059b02a7de6f27635f448ccae1879700b6a2ae86f`, the keeper declaring abandonment 600 s after the issuer agent stopped | `cast call 0x524059B1424101D4CAFD33B9a1A8D332dD71193D "state()(uint8)" --rpc-url https://bsc-testnet.bnbchain.org` returns 5 (WIND_DOWN) |
| The agent's budget is capped and can only go down | `CovenantVault.claimTap` / `lowerTap`; the invariant "tap within cap over any 30-day window" (`test/invariant/CovenantInvariant.t.sol`) | `( cd contracts && forge test --match-path "test/invariant/*" )` |
| The exit at book value needs no oracle | `CovenantVault.onObservation` compares the pool TWAP with book value, both in BNB | `( cd contracts && forge test --match-contract Vault )` |
| Agent identity and reputation (ERC-8004) | The launcher factory refuses an `agentId` the team wallet does not own (`AgentNotOwnedByTeam`). The vault writes -100 (abandoned), 0 (wound down) or +multiple (unlock) to the reputation registry (`_recordOutcome`, `OutcomeRecorded`). Proven on a BNB Chain fork against the live registries. CVT has no agent id (`agentId` 0), so testnet holds no reputation write yet | Registries on 97: `0x8004A818BFB912233c491871b3d84c89A494BD9e`, `0x8004B663056A597Dffe9eCcC1965A193B7388713`; `( cd contracts && forge test --match-path "test/fork/*" )` with `BSC_RPC_URL` |
| The AI's decisions are bounded and auditable | The Claude issuer proposes the period's plan (claim, cut pay or heartbeat); a fixed policy clamps it (`server/agents/issuer/decision.ts`). Each decision is posted on chain as a report with its hash and checked again by the app (`web/src/lib/chain/decisions.ts`). No decision record is on testnet yet: CVT's issuer ran before decision records were added | `( cd server && pnpm test -- decision )`; on a local stack, `scripts/dev-all.sh` runs an issuer agent on each live covenant |
| The MCP server never holds a key | Writes return `unsignedTransaction` plus a simulation, with provenance, chain and per-call value guards (`server/mcp/tools.ts`, `server/src/safety.ts`) | The MCP one-liner above; a `commit` above 1 BNB is refused |
| Atlas prices the budget | `CovenantOracle` reads the Atlas BNB/USD push feed `0x3957d289ee9C38272377786787ea34F9dd29788D` on 97 | The keeper's poke tx `0x7a358c903192c5c2b5dd16f38f5c64f1e0360f4e3c173eaaa420d2571416b393` |
| It is tested | 398 tests: contracts 155 (unit, invariants, pre-audit and Flap re-review regressions, the live-Portal fork journeys), server 137, web 106. CI runs all three, plus the EIP-170 sizes and the storage layout | The commands above |

## What is not done (stated up front)

- **Testnet only, unaudited.** Flap has not enabled the factories on its Portal (`enabled=false`). The testnet Portal
  launches from them anyway.
- **On the current contracts, the full lifecycle has not run yet.** `$CVD` launched and is ACTIVE; its exit round,
  abandonment and redemption are proven on forks and in the test suites, and on chain only for `$CVT` (first
  deployment). The BNBH2026 raise (`0x9C8c01A54DE25Ac95A425535F650644055678c73`, on the superseded 26 Nov factories)
  expired unfunded and reads `RAISING` until someone calls `finalize`.
- **Fork only:** trading tax reaching a vault (testnet volume never crossed Flap's ~0.714 BNB processing threshold),
  ERC-8004 reputation writes, and Four.meme Lite through ForwardVault (ForwardVault exists only on mainnet).
- **Planned:** Cournot report checks.
- **CoinMarketCap** feeds the launch simulator's backtest of BNB Chain launches. The hosted site runs without a Covenant
  server, so it shows no live CMC quote.
- **No hosted MCP or API.** Run the MCP server from a clone (above). The hosted site serves `/llms.txt` and Ask AI.
- **Open findings** from an outside review (two Low, fixes planned before mainnet), and the ones already fixed, are listed in
  [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md#open-findings-27-nov-2026). Threat model and policy:
  [SECURITY.md](SECURITY.md). [docs/DESIGN.md](docs/DESIGN.md) was written before the code; its banner lists where the
  code differs.

## License

MIT, see [LICENSE](LICENSE). Landing page design adapted from the Ondrel Framer template, used under its license;
vendored Flap and OpenZeppelin/solady code keep their own licenses ([NOTICE](NOTICE)).
