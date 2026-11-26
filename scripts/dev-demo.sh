#!/usr/bin/env bash
# Run the demo story on the dev chain, all of it or one scene at a time.
#
#   scripts/dev-demo.sh story          the whole story (dev-up.sh runs this)
#   scripts/dev-demo.sh <scene>        one scene: create raise finalize claim trade tap revenue report slide
#                                      poke poke-noatlas redeem heartbeat abandon redeem-after status
#   scripts/dev-demo.sh advance <s>    move the dev chain's clock forward <s> seconds
#
# The demo factory runs the same rules in minutes: sale 2 min, exit streak 3 min, round 5 min, cooldown 2 min,
# heartbeat 10 min, at most 1 min per poke, pokes 20 s apart.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C="$ROOT/contracts"
export PATH="$HOME/.foundry/bin:$PATH"
RPC="${DEV_RPC_URL:-http://127.0.0.1:${DEV_PORT:-8545}}"
MODE="$(cat "$C/.anvil/mode" 2>/dev/null || jq -r .mode "$C/deployments/local.json")"

say() { printf '\033[1m[demo]\033[0m %s\n' "$*"; }

scene() {
  say "scene: $1"
  local log="$C/.anvil/scene-$1.log"
  mkdir -p "$C/.anvil"
  if ! (cd "$C" && forge script script/Demo.s.sol:Demo --sig "run(string)" "$1" --rpc-url "$RPC" --broadcast \
      --slow >"$log" 2>&1); then
    tail -40 "$log" >&2
    echo "scene $1 failed (full log: $log)" >&2
    exit 1
  fi
  sed -n '/== Logs ==/,/^$/p' "$log" | sed '1d'
}

advance() {
  cast rpc --rpc-url "$RPC" evm_increaseTime "$1" >/dev/null
  cast rpc --rpc-url "$RPC" evm_mine >/dev/null
  say "clock +$1 s"
}

story() {
  scene create
  scene raise
  advance 121          # the 2-minute sale closes
  scene finalize       # settle pro rata, launch on Flap, fund the vault
  scene claim          # buyers claim tokens and refunds; first poke records the dollar sale price
  if [ "$MODE" = "fork" ]; then
    # Flap's anti-sniper window: trade after ~10 minutes. The agent checks in half way.
    advance 300; scene heartbeat; advance 301
  else
    advance 30
  fi
  scene trade          # trading tax reaches the vault
  advance 60
  scene tap            # the agent draws its dollar budget at the Atlas rate
  scene revenue        # the agent forwards revenue it earned
  scene report         # last sign of life from the agent
  scene slide          # a whale sells: the price falls under book
  for _ in 1 2 3; do advance 61; scene poke; done   # 3 minutes below book: the exit round opens
  scene redeem         # the 14 BNB buyer burns 6M tokens at book value
  advance 301          # the round ends, cooldown
  # The agent stops. The keeper keeps poking; that does not count as a heartbeat.
  for _ in 1 2 3; do advance 61; scene poke; done
  scene abandon        # anyone opens the treasury; the outcome lands on the agent's ERC-8004 record
  scene redeem-after   # redemption with no fee
  scene status
}

case "${1:-story}" in
  story) story ;;
  advance) advance "${2:?seconds}" ;;
  *) scene "$1" ;;
esac
