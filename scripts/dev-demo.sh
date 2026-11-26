#!/usr/bin/env bash
# Run the demo story on the dev chain, all of it or one scene at a time.
#
#   scripts/dev-demo.sh story          the whole story (dev-up.sh runs this)
#   scripts/dev-demo.sh <scene>        one scene: create raise finalize claim trade tap revenue report slide
#                                      poke poke-noatlas redeem heartbeat abandon redeem-after status
#   scripts/dev-demo.sh advance <s>    move the dev chain's clock forward <s> seconds
#   scripts/dev-demo.sh use <launcher> point the scenes at another covenant (one created in the web app, say):
#                                      later scenes (trade, slide, poke, redeem, abandon...) act on it
#   scripts/dev-demo.sh live           seed a second covenant and leave it ACTIVE with trading under way, for the
#                                      issuer agent and a hand-driven walk (DEMO_NAME / DEMO_SYMBOL name it)
#   scripts/dev-demo.sh seed           the story plus one covenant at every other stage, by real transactions:
#                                      wound down by its team, ACTIVE with tax and tap, exit round open, raising.
#                                      Each is recorded under .seeded.<stage> in deployments/local.json.
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

# Demo.s.sol rewrites deployments/local.json from its own struct on every scene, so anything the shell scripts add
# (the test-funds addresses, .seeded) lives in deployments/extra.local.json and is merged back after each scene.
EXTRA="$C/deployments/extra.local.json"
merge_extra() {
  [ -f "$EXTRA" ] || return 0
  local t; t="$(mktemp)"
  jq -s '.[0] * .[1]' "$C/deployments/local.json" "$EXTRA" >"$t" && mv "$t" "$C/deployments/local.json"
}

scene() {
  say "scene: $1"
  # Gas is estimated one block before it runs (the chain mines every second); a sell that crosses Flap's tax
  # liquidation threshold in between needs far more gas than estimated, so leave 3x headroom.
  local log="$C/.anvil/scene-$1.log"
  mkdir -p "$C/.anvil"
  if ! (cd "$C" && forge script script/Demo.s.sol:Demo --sig "run(string)" "$1" --rpc-url "$RPC" --broadcast \
      --slow --gas-estimate-multiplier 300 >"$log" 2>&1); then
    tail -40 "$log" >&2
    echo "scene $1 failed (full log: $log)" >&2
    exit 1
  fi
  merge_extra
  sed -n '/== Logs ==/,/^$/p' "$log" | sed '1d'
}

# Vaults whose team stays present while the clock jumps: the demo factory's heartbeat window is 10 minutes and a
# seed step can jump further, so the team wallet (anvil #1) heartbeats each of them between chunks of at most 280 s.
KEEPALIVE="$C/.anvil/keepalive"
keepalive_add() { mkdir -p "$C/.anvil"; jq -r .demo.vault "$C/deployments/local.json" >>"$KEEPALIVE"; }
heartbeat_all() {
  # While seeding: every vault on the keep-alive list. Otherwise: only the vaults of issuer agents scripts/dev-all.sh
  # still runs (.dev/<name>.vault beside a live .dev/<name>.pid), since a running agent would have checked in during
  # the jump; a stopped agent's covenant is left to lapse, which is the point of the stage moment.
  local key v st list f
  list="$(mktemp)"
  [ "${KEEP_ALIVE:-0}" = "1" ] && [ -s "$KEEPALIVE" ] && cat "$KEEPALIVE" >>"$list"
  for f in "$ROOT"/.dev/*.vault; do
    [ -f "$f" ] && [ -f "${f%.vault}.pid" ] && kill -0 "$(cat "${f%.vault}.pid")" 2>/dev/null && cat "$f" >>"$list"
  done
  [ -s "$list" ] || { rm -f "$list"; return 0; }
  key="$(cast wallet private-key "test test test test test test test test test test test junk" 1)"
  while read -r v; do
    [ -n "$v" ] || continue
    st="$(cast call --rpc-url "$RPC" "$v" 'state()(uint8)' 2>/dev/null || echo 9)"
    case "$st" in 2|3|4) cast send --rpc-url "$RPC" --private-key "$key" "$v" 'heartbeat()' >/dev/null 2>&1 || true ;; esac
  done < <(sort -u "$list")
  rm -f "$list"
}

advance() {
  local left="$1" step f live=0
  # nothing to keep present (no seed list, no running issuer agent): one jump
  [ "${KEEP_ALIVE:-0}" = "1" ] && [ -s "$KEEPALIVE" ] && live=1
  for f in "$ROOT"/.dev/*.vault; do
    [ -f "$f" ] && [ -f "${f%.vault}.pid" ] && kill -0 "$(cat "${f%.vault}.pid")" 2>/dev/null && live=1
  done
  if [ "$live" = "0" ]; then
    cast rpc --rpc-url "$RPC" evm_increaseTime "$left" >/dev/null
    cast rpc --rpc-url "$RPC" evm_mine >/dev/null
    say "clock +$1 s"
    return
  fi
  while [ "$left" -gt 0 ]; do
    step=$(( left > 280 ? 280 : left ))
    heartbeat_all
    cast rpc --rpc-url "$RPC" evm_increaseTime "$step" >/dev/null
    cast rpc --rpc-url "$RPC" evm_mine >/dev/null
    left=$(( left - step ))
  done
  heartbeat_all
  say "clock +$1 s"
}

# Record the covenant the scenes act on under .seeded.<stage> in deployments/local.json.
record() {
  local tmp; tmp="$(mktemp)"
  [ -f "$EXTRA" ] || echo '{}' >"$EXTRA"
  jq --arg s "$1" --arg n "${DEMO_NAME:-Covenant Agent}" --slurpfile l "$C/deployments/local.json" \
    '.seeded[$s] = ($l[0].demo + {name: $n})' "$EXTRA" >"$tmp" && mv "$tmp" "$EXTRA"
  merge_extra
}

# Flap's anti-sniper window on the fork: trading opens about 10 minutes after launch.
trading_window() { if [ "$MODE" = "fork" ]; then advance 601; else advance 30; fi; }

# The Four.meme path (Covenant Lite): a tax token whose founder tax goes through the live ForwardVault into a Lite
# vault. Needs the fork and the FourLiteLauncher scripts/dev-funds.sh deploys. `fourmeme full` runs the whole
# journey (taxed trades, dispatch with the 6% royalty, a tap, 7 days of founder silence, abandonment, a redemption);
# `fourmeme active` stops after the tap. Lite's minimum heartbeat is 7 days, so the full journey jumps the clock.
fourmeme() {
  local L name="$2" sym="$3" mode="$1" n key team buyer1 buyer2 vd l token lite deadline
  L="$(jq -r '.addresses.fourLiteLauncher // empty' "$C/deployments/local.json")"
  [ -n "$L" ] || { say "Four.meme path: no FourLiteLauncher (needs the BNB Chain fork)"; return 0; }
  local M="test test test test test test test test test test test junk"
  team="$(cast wallet private-key "$M" 1)"; buyer1="$(cast wallet private-key "$M" 2)"; buyer2="$(cast wallet private-key "$M" 4)"
  local B2; B2="$(cast wallet address --private-key "$buyer2")"
  local ROUTER WBNB TEMPLATE; ROUTER="$(jq -r .addresses.router "$C/deployments/local.json")"
  WBNB="$(jq -r .addresses.wbnb "$C/deployments/local.json")"; TEMPLATE="$(jq -r .addresses.liteVaultTemplate "$C/deployments/local.json")"
  # cast send exits 0 even when the transaction reverts, so check the receipt. Gas is set, not estimated: the chain
  # mines every second, and an estimate taken a block early falls short on the tax swap and the ForwardVault hop.
  snd() {
    local k="$1" st; shift
    st="$(cast send --rpc-url "$RPC" --private-key "$k" --gas-limit 3000000 --json "$@" | jq -r .status)"
    [ "$st" = "0x1" ] || { echo "transaction failed ($*)" >&2; exit 1; }
  }
  # tap 4% per day-long period, 7-day heartbeat, 1% redeem fee: the template's own bounds allow nothing shorter
  vd="$(cast call --rpc-url "$RPC" "$L" 'encodeVaultData(address,uint16,uint32,uint32,uint16)(bytes)' "$TEMPLATE" 400 86400 604800 100)"
  say "Four.meme path: $name launches (tax 5%, founder tax to the Lite vault through ForwardVault)"
  snd "$team" "$L" 'launch(string,string,uint256,uint16,bytes,uint256)' "$name" "$sym" 1000000000ether 500 "$vd" 300000000ether --value 20ether
  n="$(cast call --rpc-url "$RPC" "$L" 'launchCount()(uint256)')"
  l="$(cast call --rpc-url "$RPC" "$L" 'launches()((address,address,address,address,address,uint64)[])' | tr -d '[]()' | tr ',' '\n' | sed 's/ //g' | sed -n "$(( (n - 1) * 6 + 1 )),$(( n * 6 ))p")"
  token="$(echo "$l" | sed -n 1p)"; lite="$(echo "$l" | sed -n 3p)"
  deadline=$(( $(cast block latest --rpc-url "$RPC" -f timestamp) + 3600 ))
  snd "$buyer1" "$ROUTER" 'swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)' 0 "[$WBNB,$token]" "$(cast wallet address --private-key "$buyer1")" "$deadline" --value 6ether
  snd "$buyer2" "$ROUTER" 'swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)' 0 "[$WBNB,$token]" "$B2" "$deadline" --value 4ether
  snd "$team" "$token" 'dispatch()'
  snd "$team" "$lite" 'withdrawTap()'
  say "  token $token  lite vault $lite: tax dispatched, tap withdrawn"
  if [ "$mode" = "full" ]; then
    advance 604860
    snd "$(cast wallet private-key "$M" 7)" "$lite" 'declareAbandoned()'
    local bal; bal="$(cast call --rpc-url "$RPC" "$token" 'balanceOf(address)(uint256)' "$B2" | awk '{print $1}')"
    snd "$buyer2" "$token" 'approve(address,uint256)' "$lite" "$bal"
    snd "$buyer2" "$lite" 'redeem(uint256,uint256,uint256)' "$bal" 0 0
    say "  founder silent 7 days: a stranger opened the treasury, a holder redeemed"
  fi
}

# The story plus one covenant at every other stage, all by real transactions on the dev chain.
seed() {
  rm -f "$KEEPALIVE"
  export KEEP_ALIVE=1
  # Four.meme path first: its 7-day clock jump would lapse every 10-minute demo heartbeat seeded after it
  fourmeme full "Forge Agent" "FORGE"
  fourmeme active "Anvil Agent" "ANVL"
  story
  record abandoned
  # wound down by its own human team (no ERC-8004 id)
  export DEMO_NAME="Harbor Labs" DEMO_SYMBOL="HRBR" DEMO_AGENT=false
  scene create; scene raise; advance 121; scene finalize; scene claim; keepalive_add; trading_window
  scene trade; scene tap; scene winddown
  record woundDown
  unset DEMO_AGENT
  # ACTIVE with tax, tap, revenue and a report: the issuer agent runs it from here
  export DEMO_NAME="Lumen Agent" DEMO_SYMBOL="LUMEN"
  scene create; scene raise; advance 121; scene finalize; scene claim; keepalive_add; trading_window
  scene trade; scene tap; scene revenue; scene report
  record active
  # an exit round open: a whale sells under book and three pokes count the streak
  export DEMO_NAME="Scout Agent" DEMO_SYMBOL="SCOUT"
  scene create; scene raise; advance 121; scene finalize; scene claim; keepalive_add; trading_window
  scene trade; scene tap; scene slide
  for _ in 1 2 3; do advance 61; scene poke; done
  record exitRound
  # a raise still under way: two days left, under the minimum so far
  export DEMO_NAME="Fern Agent" DEMO_SYMBOL="FERN" DEMO_SALE_SECONDS=172800
  scene create; scene raise-light
  record raising
  unset DEMO_SALE_SECONDS
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

use() {
  local l="$1" v t p proc
  v="$(cast call --rpc-url "$RPC" "$l" 'vault()(address)')"
  t="$(cast call --rpc-url "$RPC" "$l" 'token()(address)')"
  p="$(cast call --rpc-url "$RPC" "$l" 'pool()(address)')"
  proc=0x0000000000000000000000000000000000000000
  if [ "$t" != "$proc" ]; then
    if [ "$MODE" = "mock" ]; then
      proc="$(cast call --rpc-url "$RPC" "$(jq -r .addresses.portal "$C/deployments/local.json")" 'taxProcessorOf(address)(address)' "$t")"
    else
      proc="$(cast call --rpc-url "$RPC" "$t" 'taxProcessor()(address)')"
    fi
  fi
  local tmp; tmp="$(mktemp)"
  jq --arg l "$l" --arg v "$v" --arg t "$t" --arg p "$p" --arg x "$proc" \
    '.demo.launcher=$l | .demo.vault=$v | .demo.token=$t | .demo.pair=$p | .demo.taxProcessor=$x' \
    "$C/deployments/local.json" >"$tmp" && mv "$tmp" "$C/deployments/local.json"
  say "scenes now act on launcher $l (vault $v)"
}

# A second covenant that stays ACTIVE: raised, launched, claimed, traded. The issuer agent runs it from here.
live() {
  export DEMO_NAME="${DEMO_NAME:-Lumen Agent}" DEMO_SYMBOL="${DEMO_SYMBOL:-LUMEN}"
  scene create
  scene raise
  advance 121
  scene finalize
  scene claim
  # Flap's anti-sniper window on the fork; the agent checks in half way so its 10-minute heartbeat never lapses
  if [ "$MODE" = "fork" ]; then advance 300; scene heartbeat; advance 301; else advance 30; fi
  scene trade
  scene heartbeat
}

case "${1:-story}" in
  story) story ;;
  seed) seed ;;
  fourmeme) fourmeme "${2:-active}" "${3:-Four Agent}" "${4:-FOUR}" ;;
  live) live ;;
  use) use "${2:?launcher address}" ;;
  advance) advance "${2:?seconds}" ;;
  *) scene "$1" ;;
esac
