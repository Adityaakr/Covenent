#!/usr/bin/env bash
# The Covenant platform against the live BNB testnet deployment (chain 97), one command:
#
#   scripts/testnet-up.sh            server API (:8787, API_PORT), keeper, issuer agent (once a covenant of its wallet exists) and
#                                    the web app on http://localhost:8080, all on chain 97 and contracts/deployments/97.json
#   scripts/testnet-up.sh --prod     serve a production build of the web app
#   scripts/testnet-up.sh issuer     (re)start only the issuer agent, e.g. after its first covenant was created
#   scripts/testnet-up.sh status     what is running, with log paths
#   scripts/testnet-up.sh stop       stop every process
#
# Keys: the first run reads TESTNET_WALLETS (a KEY=value file with KEEPER_PRIVATE_KEY and ISSUER_AGENT_PRIVATE_KEY) and,
# when set, TESTNET_SECRETS_FROM (a server .env holding CMC_API_KEY / ANTHROPIC_API_KEY), and writes them to
# .dev/testnet/keys.env (mode 600, git-ignored). Later runs reuse that file. No key is printed or committed.
#
# This mode signs real transactions on BNB testnet: COVENANT_ALLOW_PUBLIC_NETWORK=1 is set here and nowhere else.
# There is no faucet and no seeded data: the app shows only what is on chain 97. Test BNB: the BNB Chain faucet.
# RPC_URL overrides the public RPC (default https://bsc-testnet-rpc.publicnode.com). WEB_PORT and API_PORT move the web
# app and the server (8081-8083 and 8085 are also origins the Privy app allows).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/.dev/testnet"
KEYS="$RUN/keys.env"
RECORD="$ROOT/contracts/deployments/97.json"
DEPLOY="$ROOT/contracts/deployments/97.local.json" # app-shaped view of the record, git-ignored
export PATH="$HOME/.foundry/bin:$PATH"
mkdir -p "$RUN"
chmod 700 "$RUN"

say() { printf '\033[1m[testnet]\033[0m %s\n' "$*"; }

stop_one() {
  local name="$1" f="$RUN/$1.pid"
  [ -f "$f" ] || return 0
  local pid; pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -KILL -- "-$pid" 2>/dev/null || true
    say "stopped $name (pid $pid)"
  fi
  rm -f "$f"
}
stop_all() { for p in web issuer keeper api; do stop_one "$p"; done; }

start() {
  local name="$1" dir="$2"; shift 2
  ( cd "$dir" && exec perl -e 'use POSIX qw(setsid); setsid(); exec @ARGV or die "exec: $!"' "$@" ) \
    >"$RUN/$name.log" 2>&1 < /dev/null &
  echo $! >"$RUN/$name.pid"
}

status() {
  for p in api keeper issuer web; do
    if [ -f "$RUN/$p.pid" ] && kill -0 "$(cat "$RUN/$p.pid")" 2>/dev/null; then
      printf '  %-7s running  pid %-6s log %s\n' "$p" "$(cat "$RUN/$p.pid")" "$RUN/$p.log"
    else
      printf '  %-7s stopped\n' "$p"
    fi
  done
}

wait_http() {
  local url="$1" name="$2"
  for _ in $(seq 1 180); do
    curl -s -o /dev/null --max-time 2 "$url" && return 0
    sleep 1
  done
  echo "$name did not answer at $url; see $RUN/$name.log" >&2
  tail -20 "$RUN/$name.log" >&2 || true
  return 1
}

# Read one KEY from a KEY=value file without sourcing it (the file may hold anything).
val() { sed -n "s/^$2=//p" "$1" | tail -1 | tr -d '"'"'"'\r'; }

write_keys() {
  [ -n "${TESTNET_WALLETS:-}" ] || { echo "first run: set TESTNET_WALLETS to the testnet wallets file (KEEPER_PRIVATE_KEY, ISSUER_AGENT_PRIVATE_KEY)" >&2; exit 2; }
  [ -r "$TESTNET_WALLETS" ] || { echo "cannot read TESTNET_WALLETS=$TESTNET_WALLETS" >&2; exit 2; }
  local keeper issuer cmc="" anthropic=""
  keeper="$(val "$TESTNET_WALLETS" KEEPER_PRIVATE_KEY)"
  issuer="$(val "$TESTNET_WALLETS" ISSUER_AGENT_PRIVATE_KEY)"
  [ -n "$keeper" ] && [ -n "$issuer" ] || { echo "TESTNET_WALLETS lacks KEEPER_PRIVATE_KEY or ISSUER_AGENT_PRIVATE_KEY" >&2; exit 2; }
  if [ -n "${TESTNET_SECRETS_FROM:-}" ] && [ -r "$TESTNET_SECRETS_FROM" ]; then
    cmc="$(val "$TESTNET_SECRETS_FROM" CMC_API_KEY)"
    anthropic="$(val "$TESTNET_SECRETS_FROM" ANTHROPIC_API_KEY)"
  fi
  ( umask 077; printf 'KEEPER_PRIVATE_KEY=%s\nISSUER_PRIVATE_KEY=%s\nCMC_API_KEY=%s\nANTHROPIC_API_KEY=%s\n' \
      "$keeper" "$issuer" "$cmc" "$anthropic" >"$KEYS" )
  say "wrote $KEYS (mode 600): keeper and issuer keys$([ -n "$cmc" ] && echo ", CMC key")$([ -n "$anthropic" ] && echo ", Anthropic key")"
}

# deployments/97.json is Deploy.s.sol's flat record; the server and the web read {chainId, rpcUrl, addresses{...}}.
write_deploy() {
  jq --arg rpc "$RPC_URL" --slurpfile atlas "$ROOT/contracts/config/atlas-97.json" '
    {
      chainId, rpcUrl: $rpc, mode: "testnet", startBlock: 144956048,
      addresses: ((to_entries | map(select(.value | type == "string" and test("^0x[0-9a-fA-F]{40}$"))) | from_entries) + {
        taxTokenImpl: "0x7777c57ff7dc441c1715b2e36fa581c48B782222",
        wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
        router: "0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3",
        atlasPushBnbUsd: $atlas[0].pushFeeds["BNB/USD"]
      }),
      atlas: { feedIdBnbUsd: .atlasFeedIdBnbUsd, pushFeeds: $atlas[0].pushFeeds },
      demo: {}
    }' "$RECORD" >"$DEPLOY"
}

export RPC_URL="${RPC_URL:-https://bsc-testnet-rpc.publicnode.com}"
WEB_PORT="${WEB_PORT:-8080}"
export API_PORT="${API_PORT:-8787}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:$API_PORT}"

# Everything the server processes need, chain 97 only.
server_env() {
  set -a; . "$KEYS"; set +a
  export CHAIN_ID=97 COVENANT_DEPLOYMENTS="$DEPLOY" COVENANT_ALLOW_PUBLIC_NETWORK=1
  export ATLAS_PUSH_FEED="$(jq -r .addresses.atlasPushBnbUsd "$DEPLOY")" ATLAS_API_KEY=""
  export ERC8004_IDENTITY="$(jq -r .addresses.identityRegistry "$DEPLOY")" ERC8004_REPUTATION="$(jq -r .addresses.reputationRegistry "$DEPLOY")"
  export COVENANT_DATA_DIR="$RUN/server-data"   # kept between runs: report files and keeper state are real history
  export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT}"
  export FAUCET_PRIVATE_KEY=""                  # no faucet on a public network
  mkdir -p "$COVENANT_DATA_DIR"
}

start_issuer() {
  stop_one issuer
  local team
  team="$(cast wallet address "$ISSUER_PRIVATE_KEY")"
  # the issuer agent runs a covenant whose team wallet is its own; until one exists there is nothing to run
  local found="" l
  for f in launcherFactory demoLauncherFactory; do
    for l in $(cast call --rpc-url "$RPC_URL" "$(jq -r ".addresses.$f" "$DEPLOY")" 'allLaunchers()(address[])' | tr -d '[],'); do
      v="$(cast call --rpc-url "$RPC_URL" "$l" 'vault()(address)' 2>/dev/null || true)"
      [ -n "$v" ] && [ "$v" != "0x0000000000000000000000000000000000000000" ] || continue
      [ "$(cast call --rpc-url "$RPC_URL" "$v" 'teamWallet()(address)' 2>/dev/null | tr 'A-F' 'a-f')" = "$(echo "$team" | tr 'A-F' 'a-f')" ] && found="$v"
    done
  done
  if [ -z "$found" ]; then
    say "issuer agent not started: no launched covenant has team wallet $team yet (create one, then: scripts/testnet-up.sh issuer)"
    return 0
  fi
  say "issuer agent ($team) on vault $found"
  ISSUER_VAULT="$found" ISSUER_TICK_SECONDS="${ISSUER_TICK_SECONDS:-60}" ISSUER_HEARTBEAT_EVERY_SECONDS="${ISSUER_HEARTBEAT_EVERY_SECONDS:-300}" \
  ISSUER_PERIOD_SECONDS="${ISSUER_PERIOD_SECONDS:-3600}" ISSUER_MIN_CLAIM_BNB="${ISSUER_MIN_CLAIM_BNB:-0.000001}" ISSUER_GAS_RESERVE_BNB="${ISSUER_GAS_RESERVE_BNB:-0.002}" \
    start issuer "$ROOT/server" pnpm issuer
}

case "${1:-}" in
  stop) stop_all; exit 0 ;;
  status) status; exit 0 ;;
  issuer) [ -f "$KEYS" ] || write_keys; write_deploy; server_env; start_issuer; status; exit 0 ;;
esac

PROD=0
for arg in "$@"; do
  case "$arg" in
    --prod) PROD=1 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

for bin in cast jq curl pnpm node perl; do command -v "$bin" >/dev/null || { echo "missing $bin" >&2; exit 1; }; done
[ -f "$RECORD" ] || { echo "no $RECORD: deploy first (docs/DEPLOY.md)" >&2; exit 1; }
[ "$(cast chain-id --rpc-url "$RPC_URL")" = "97" ] || { echo "$RPC_URL is not BNB testnet (chain 97)" >&2; exit 1; }
for p in "$API_PORT" "$WEB_PORT"; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
    owner="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t | head -1)"
    group="$(ps -o pgid= -p "$owner" 2>/dev/null | tr -d ' ')"
    grep -qx -e "$owner" -e "${group:-none}" "$RUN"/*.pid 2>/dev/null \
      || { echo "port $p is taken by pid $owner (scripts/dev-all.sh stop, or set WEB_PORT)" >&2; exit 1; }
  fi
done

stop_all
[ -f "$KEYS" ] || write_keys
write_deploy
say "deployment $DEPLOY from $(basename "$RECORD") on $RPC_URL"
server_env

say "installing packages (no-op when up to date)"
pnpm --dir "$ROOT/server" install --frozen-lockfile --silent
pnpm --dir "$ROOT/web" install --frozen-lockfile --silent

say "server API on :$API_PORT (no faucet)"
start api "$ROOT/server" pnpm api
wait_http "http://127.0.0.1:$API_PORT/health" api

# The demo factory's covenants allow a poke every 20 s; on a public chain every poke costs gas, so the default is
# every 10 minutes (KEEPER_POKE_INTERVAL_SECONDS). No Atlas key: pokes carry no report and the oracle reads the feed.
say "keeper ($(cast wallet address "$KEEPER_PRIVATE_KEY")), push-feed pokes every ${KEEPER_POKE_INTERVAL_SECONDS:-600} s"
KEEPER_TICK_SECONDS="${KEEPER_TICK_SECONDS:-30}" KEEPER_POKE_INTERVAL_SECONDS="${KEEPER_POKE_INTERVAL_SECONDS:-600}" \
KEEPER_DECLARE_ABANDONED=true KEEPER_STATE_FILE="$COVENANT_DATA_DIR/keeper-state.json" \
  start keeper "$ROOT/server" pnpm keeper

start_issuer

# The web app: chain 97 from the same record, no local test accounts, the server above.
export NEXT_PUBLIC_DEV_WALLET=0 NEXT_PUBLIC_COVENANT_API="http://localhost:$API_PORT" NEXT_PUBLIC_LOCAL_RPC="$RPC_URL"
if [ "$PROD" = "1" ]; then
  say "building the web app"
  pnpm --dir "$ROOT/web" build >"$RUN/web-build.log" 2>&1 || { tail -30 "$RUN/web-build.log" >&2; exit 1; }
  start web "$ROOT/web" pnpm exec next start -p "$WEB_PORT"
else
  start web "$ROOT/web" pnpm exec next dev -p "$WEB_PORT"
fi
wait_http "http://localhost:$WEB_PORT/" web

say "ready: BNB testnet (97), web http://localhost:$WEB_PORT (app at /app), API http://127.0.0.1:$API_PORT"
status
cat <<EOF

  Contracts:   $RECORD (verified on Sourcify), explorer https://testnet.bscscan.com
  Test BNB:    https://www.bnbchain.org/en/testnet-faucet
  Create:      http://localhost:$WEB_PORT/app/create (demo factory: minutes instead of days)
  Stop:        scripts/testnet-up.sh stop
EOF
