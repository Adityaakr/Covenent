#!/usr/bin/env bash
# The whole Covenant stack on this machine, one command:
#
#   scripts/dev-all.sh            chain (BNB Chain fork if reachable, else offline mock) + deploy + local test funds
#                                 + covenants at every stage (raising, active, exit round, abandoned, wound down) by
#                                 real transactions, then the server API (:8787), keeper, issuer agents and the web
#                                 app on http://localhost:8080
#   scripts/dev-all.sh --mock     offline chain (chain id 31337), no network needed
#   scripts/dev-all.sh --fork     require the BNB Chain fork (chain id 56)
#   scripts/dev-all.sh --prod     serve a production build of the web app instead of the dev server
#   scripts/dev-all.sh --no-chain keep the running chain and deployment; restart only the processes
#   scripts/dev-all.sh status     what is running, with log paths
#   scripts/dev-all.sh stop       stop the processes and the chain
#   scripts/dev-all.sh stop-issuer   kill the issuer agent (the stage moment: nothing sends heartbeats any more)
#
# WEB_PORT (default 8080) moves the web app; 8081-8083 and 8085 are also origins the Privy app allows.
# Every key used here is one of anvil's public test keys; signing is refused on any non-loopback RPC.
# Logs and pids: .dev/ at the repository root (git-ignored). server/.env and web/.env.local are read if present.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/.dev"
export PATH="$HOME/.foundry/bin:$PATH"
mkdir -p "$RUN"

say() { printf '\033[1m[dev-all]\033[0m %s\n' "$*"; }

MNEMONIC="test test test test test test test test test test test junk"
key() { cast wallet private-key "$MNEMONIC" "$1"; }

stop_one() {
  local name="$1" f="$RUN/$1.pid"
  [ -f "$f" ] || return 0
  local pid; pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    # the process group: pnpm, tsx and next spawn children
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -KILL -- "-$pid" 2>/dev/null || true
    say "stopped $name (pid $pid)"
  fi
  rm -f "$f"
}

stop_all() {
  for p in web issuer issuer-2 keeper api; do stop_one "$p"; done
}

# start <name> <dir> <command...>: in its own session (process group), so stop_one takes pnpm's children too.
# perl's setsid works on macOS and Linux alike.
start() {
  local name="$1" dir="$2"; shift 2
  ( cd "$dir" && exec perl -e 'use POSIX qw(setsid); setsid(); exec @ARGV or die "exec: $!"' "$@" ) \
    >"$RUN/$name.log" 2>&1 < /dev/null &
  echo $! >"$RUN/$name.pid"
}

status() {
  for p in api keeper issuer issuer-2 web; do
    if [ -f "$RUN/$p.pid" ] && kill -0 "$(cat "$RUN/$p.pid")" 2>/dev/null; then
      printf '  %-7s running  pid %-6s log %s\n' "$p" "$(cat "$RUN/$p.pid")" "$RUN/$p.log"
    else
      printf '  %-7s stopped\n' "$p"
    fi
  done
  if cast chain-id --rpc-url http://127.0.0.1:"${DEV_PORT:-8545}" >/dev/null 2>&1; then
    echo "  chain   running  chain id $(cast chain-id --rpc-url http://127.0.0.1:"${DEV_PORT:-8545}")  log $ROOT/contracts/.anvil/anvil.log"
  else
    echo "  chain   stopped"
  fi
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

case "${1:-}" in
  stop) stop_all; "$ROOT/scripts/dev-down.sh"; exit 0 ;;
  stop-issuer) stop_one issuer; say "the issuer agent is stopped: nothing sends heartbeats now"; exit 0 ;;
  status) status; exit 0 ;;
esac

UP_ARGS=()
CHAIN=1
PROD=0
for arg in "$@"; do
  case "$arg" in
    --mock|--fork) UP_ARGS+=("$arg") ;;
    --no-chain) CHAIN=0 ;;
    --prod) PROD=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

for bin in anvil forge cast jq curl pnpm node; do
  command -v "$bin" >/dev/null || { echo "missing $bin" >&2; exit 1; }
done
WEB_PORT="${WEB_PORT:-8080}"
for p in 8787 "$WEB_PORT"; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
    owner="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t | head -1)"
    if ! grep -qx "$owner" "$RUN"/*.pid 2>/dev/null; then
      echo "port $p is taken by pid $owner (not this stack); stop it first, or set WEB_PORT for the web app" >&2
      exit 1
    fi
  fi
done

stop_all

if [ "$CHAIN" = "1" ]; then
  say "chain, deployment, local test funds and covenants at every stage"
  "$ROOT/scripts/dev-up.sh" ${UP_ARGS[@]+"${UP_ARGS[@]}"}
fi

DEPLOY="$ROOT/contracts/deployments/local.json"
[ -f "$DEPLOY" ] || { echo "no $DEPLOY: run without --no-chain" >&2; exit 1; }
CHAIN_ID="$(jq -r .chainId "$DEPLOY")"
MODE="$(jq -r .mode "$DEPLOY")"

say "installing packages (no-op when up to date)"
pnpm --dir "$ROOT/server" install --frozen-lockfile --silent
pnpm --dir "$ROOT/web" install --frozen-lockfile --silent

# Server processes read server/.env (keys) and these demo settings; anvil indices follow deployments/local.json.
export COVENANT_DATA_DIR="$RUN/server-data"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT,http://localhost:8080,http://127.0.0.1:8080,http://localhost:3000,http://127.0.0.1:3000}"
rm -rf "$COVENANT_DATA_DIR" && mkdir -p "$COVENANT_DATA_DIR"

say "server API on :8787 (with the local test-funds faucet: anvil #0)"
FAUCET_PRIVATE_KEY="$(key 0)" start api "$ROOT/server" pnpm api
wait_http http://127.0.0.1:8787/health api

say "keeper (anvil #$(jq -r .accounts.keeper.anvilIndex "$DEPLOY")), pokes every 20 s with the local Atlas test signer"
KEEPER_PRIVATE_KEY="$(key "$(jq -r .accounts.keeper.anvilIndex "$DEPLOY")")" \
KEEPER_TICK_SECONDS=10 KEEPER_POKE_INTERVAL_SECONDS=20 \
  start keeper "$ROOT/server" pnpm keeper

# One issuer agent per live covenant (the team wallet, anvil #1): "issuer" runs the ACTIVE one (Lumen), the one
# `stop-issuer` kills on stage; "issuer-2" keeps the exit-round covenant's team present.
LIVE_VAULT="$(jq -r '.seeded.active.vault // .demo.vault' "$DEPLOY")"
ROUND_VAULT="$(jq -r '.seeded.exitRound.vault // empty' "$DEPLOY")"
TEAM_KEY="$(key "$(jq -r .accounts.team.anvilIndex "$DEPLOY")")"
issuer() {
  ISSUER_PRIVATE_KEY="$TEAM_KEY" ISSUER_VAULT="$2" \
  ISSUER_TICK_SECONDS=15 ISSUER_HEARTBEAT_EVERY_SECONDS=120 ISSUER_PERIOD_SECONDS=300 ISSUER_MIN_CLAIM_BNB=0.0001 \
    start "$1" "$ROOT/server" pnpm issuer
}
say "issuer agent on $LIVE_VAULT (the team wallet, anvil #$(jq -r .accounts.team.anvilIndex "$DEPLOY"))"
issuer issuer "$LIVE_VAULT"
if [ -n "$ROUND_VAULT" ]; then
  say "second issuer agent on the exit-round covenant $ROUND_VAULT"
  issuer issuer-2 "$ROUND_VAULT"
fi

if [ "$PROD" = "1" ]; then
  say "building the web app"
  pnpm --dir "$ROOT/web" build >"$RUN/web-build.log" 2>&1 || { tail -30 "$RUN/web-build.log" >&2; exit 1; }
  say "web app (production build) on http://localhost:$WEB_PORT"
  start web "$ROOT/web" pnpm exec next start -p "$WEB_PORT"
else
  say "web app (dev server) on http://localhost:$WEB_PORT"
  start web "$ROOT/web" pnpm exec next dev -p "$WEB_PORT"
fi
wait_http "http://localhost:$WEB_PORT/" web

say "ready: chain $CHAIN_ID ($MODE), web http://localhost:$WEB_PORT (app at /app), API http://127.0.0.1:8787"
status
cat <<EOF

  Wallets: Privy on :$WEB_PORT, or "Browser wallet" -> "Local test account #n" (anvil's public accounts, unlocked).
  Seeded covenants (real transactions; launcher / vault):
$(jq -r '.seeded // {} | to_entries[] | "    \(.key | ascii_downcase): \(.value.name)  \(.value.launcher)  \(.value.vault)"' "$DEPLOY")
  Test funds:              http://localhost:$WEB_PORT/app/faucet (test BNB + Demo USDC, local chain only)
  Scenes:                  scripts/dev-demo.sh use <launcher>, then slide | poke | redeem | abandon | advance <s>
  Stop the agent:          scripts/dev-all.sh stop-issuer      Stop all: scripts/dev-all.sh stop
EOF
