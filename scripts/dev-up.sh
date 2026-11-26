#!/usr/bin/env bash
# Start a local chain, deploy the whole Covenant stack, export ABIs and seed the demo story.
#
#   scripts/dev-up.sh              BNB Chain fork if the RPC answers, otherwise the offline mock stack
#   scripts/dev-up.sh --fork       require the fork (fails if no BNB Chain RPC is reachable)
#   scripts/dev-up.sh --mock       offline: local stand-ins for Flap, PancakeSwap and ERC-8004
#   scripts/dev-up.sh --no-demo    deploy only, do not seed the demo story
#
# Environment (all optional; contracts/.env is loaded if present):
#   BSC_RPC_URL     fork source; must serve older state (archive). Default: a keyless public archive endpoint
#   DEV_PORT        anvil port, default 8545
#   DEV_CHAIN_ID    chain id of the offline chain, default 31337. A fork always reports 56: Flap's Portal and
#                   Token Dock resolve their per-chain addresses from block.chainid and refuse other ids.
#
# Writes contracts/abi/*.json and contracts/deployments/local.json. Stop the chain with scripts/dev-down.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C="$ROOT/contracts"
export PATH="$HOME/.foundry/bin:$PATH"
[ -f "$C/.env" ] && { set -a; . "$C/.env"; set +a; }

MODE="auto"
SEED_DEMO=1
for arg in "$@"; do
  case "$arg" in
    --fork) MODE="fork" ;;
    --mock) MODE="mock" ;;
    --no-demo) SEED_DEMO=0 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

PORT="${DEV_PORT:-8545}"
RPC="http://127.0.0.1:$PORT"
FORK_URL="${BSC_RPC_URL:-https://bsc-mainnet.public.blastapi.io}"
STATE="$C/.anvil"
mkdir -p "$STATE" "$C/deployments" "$C/abi"

say() { printf '\033[1m[dev-up]\033[0m %s\n' "$*"; }

for bin in anvil forge cast jq curl; do
  command -v "$bin" >/dev/null || { echo "missing $bin (Foundry is expected in ~/.foundry/bin)" >&2; exit 1; }
done

"$ROOT/scripts/dev-down.sh" --quiet || true

rpc() { curl -s --max-time 10 -H 'content-type: application/json' -d "$2" "$1" 2>/dev/null; }

# A fork reads state at its fork block for as long as it runs. Public BNB Chain nodes prune state after a few
# minutes ("missing trie node"), which makes anvil panic mid-demo, so prefer an endpoint that serves older
# state: BSC_RPC_URL first, then keyless public ones known to (blastapi), then pruned ones as a last resort.
archive_ok() {
  local head old
  head="$(rpc "$1" '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | jq -r '.result // empty')"
  [ -n "$head" ] || return 1
  old="$(printf '0x%x' $(( head - 3000 )))"
  rpc "$1" "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getStorageAt\",\"params\":[\"0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c\",\"0x0\",\"$old\"]}" \
    | jq -e '.result' >/dev/null
}
is_bsc() {
  rpc "$1" '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q '"0x38"'
}

if [ "$MODE" = "auto" ] || [ "$MODE" = "fork" ]; then
  PICK=""
  PRUNED=""
  for u in ${BSC_RPC_URL:-} https://bsc-mainnet.public.blastapi.io https://bsc-dataseed.bnbchain.org; do
    is_bsc "$u" || continue
    if archive_ok "$u"; then PICK="$u"; break; fi
    [ -n "$PRUNED" ] || PRUNED="$u"
  done
  if [ -n "$PICK" ]; then
    FORK_URL="$PICK"
    MODE="fork"
  elif [ "$MODE" = "fork" ] && [ -n "$PRUNED" ]; then
    FORK_URL="$PRUNED"
    say "warning: $PRUNED prunes old state; the fork can crash after a few minutes. Set BSC_RPC_URL to a provider key."
  elif [ "$MODE" = "fork" ]; then
    echo "no BNB Chain RPC reachable; use --mock to run offline" >&2
    exit 1
  else
    say "no BNB Chain RPC that serves older state is reachable: running the offline mock stack"
    MODE="mock"
  fi
fi
[ "$MODE" = "fork" ] && say "forking BNB Chain from $FORK_URL"

if [ "$MODE" = "fork" ]; then CHAIN_ID=56; else CHAIN_ID="${DEV_CHAIN_ID:-31337}"; fi
say "starting anvil in $MODE mode on $RPC (chain id $CHAIN_ID)"
if [ "$MODE" = "fork" ]; then
  nohup anvil --fork-url "$FORK_URL" --port "$PORT" --chain-id "$CHAIN_ID" --gas-limit 100000000 \
    >"$STATE/anvil.log" 2>&1 &
else
  nohup anvil --port "$PORT" --chain-id "$CHAIN_ID" --gas-limit 100000000 --code-size-limit 65536 \
    >"$STATE/anvil.log" 2>&1 &
fi
echo $! >"$STATE/anvil.pid"
echo "$MODE" >"$STATE/mode"
for _ in $(seq 1 60); do
  cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break
  sleep 1
done
cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 || { echo "anvil did not start; see $STATE/anvil.log" >&2; exit 1; }

if [ "$MODE" = "fork" ]; then
  # anvil's test accounts are public keys, and on BNB Chain sweeper bots have put EIP-7702 delegation code on
  # them (one forwards any NFT it receives to a sweeper). Flap's fork notes warn about live accounts with code.
  # On this local fork only, clear the code so the roles behave as plain EOAs.
  MNEMONIC="test test test test test test test test test test test junk"
  for i in $(seq 0 9); do
    a="$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index "$i")"
    cast rpc --rpc-url "$RPC" anvil_setCode "$a" 0x >/dev/null
  done
  say "cleared EIP-7702 code from the 10 dev accounts on the fork"
fi

say "building and exporting ABIs"
"$ROOT/scripts/dev-abi.sh"

say "deploying the Covenant stack"
(cd "$C" && DEV_RPC_URL="$RPC" forge script script/DevDeploy.s.sol:DevDeploy \
  --rpc-url "$RPC" --broadcast --slow -q >"$STATE/deploy.log" 2>&1) \
  || { cat "$STATE/deploy.log" >&2; exit 1; }

if [ "$MODE" = "fork" ]; then
  # Flap enables a launcher factory as the Portal admin; on the fork we act as that admin, as Flap's tests do.
  ADMIN="$(jq -r .addresses.portalAdmin "$C/deployments/local.json")"
  PORTAL="$(jq -r .addresses.portal "$C/deployments/local.json")"
  say "opening the factories on Flap's Portal as its admin $ADMIN"
  cast rpc --rpc-url "$RPC" anvil_impersonateAccount "$ADMIN" >/dev/null
  cast rpc --rpc-url "$RPC" anvil_setBalance "$ADMIN" 0x3635C9ADC5DEA00000 >/dev/null
  for key in launcherFactory demoLauncherFactory; do
    f="$(jq -r ".addresses.$key" "$C/deployments/local.json")"
    cast send --rpc-url "$RPC" --unlocked --from "$ADMIN" "$PORTAL" \
      "setLauncherFactoryMultiplier(address,uint16,bool)" "$f" 10000 true >/dev/null
  done
  for key in vaultFactory demoVaultFactory; do
    f="$(jq -r ".addresses.$key" "$C/deployments/local.json")"
    cast send --rpc-url "$RPC" --unlocked --from "$ADMIN" "$PORTAL" \
      "setVaultFactoryMultiplier(address,uint16,bool)" "$f" 10000 true >/dev/null
  done
  cast rpc --rpc-url "$RPC" anvil_stopImpersonatingAccount "$ADMIN" >/dev/null
fi

if [ "$SEED_DEMO" = "1" ]; then
  say "seeding the demo story"
  "$ROOT/scripts/dev-demo.sh" story
fi

say "ready"
jq '{chainId, rpcUrl, mode, addresses: {portal: .addresses.portal, oracle: .addresses.oracle, lens: .addresses.lens, launcherFactory: .addresses.launcherFactory, demoLauncherFactory: .addresses.demoLauncherFactory}, demo}' \
  "$C/deployments/local.json"
echo "deployment: $C/deployments/local.json   ABIs: $C/abi/   chain log: $STATE/anvil.log"
