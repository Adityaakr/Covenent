#!/usr/bin/env bash
# LOCAL TEST FUNDS. Deploys DemoUSDC (6 decimals, minted only by the faucet account) on the dev chain and seeds a
# dUSDC/WBNB pool on the local PancakeSwap (the real one on a BNB Chain fork, the stand-in offline) at BNB/USD 600,
# so the app's "Get test funds" page can show a wallet funded in dollars and swap them to BNB. Covenant raises stay
# BNB-quoted; no treasury ever holds dUSDC. Writes addresses.demoUsdc, addresses.demoUsdcPair and
# addresses.faucet into contracts/deployments/local.json. scripts/dev-up.sh runs this after the deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C="$ROOT/contracts"
J="$C/deployments/local.json"
export PATH="$HOME/.foundry/bin:$PATH"
RPC="${DEV_RPC_URL:-http://127.0.0.1:${DEV_PORT:-8545}}"
say() { printf '\033[1m[dev-funds]\033[0m %s\n' "$*"; }

CHAIN_ID="$(cast chain-id --rpc-url "$RPC")"
case "$RPC" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: $RPC is not a local node" >&2; exit 1 ;; esac

MNEMONIC="test test test test test test test test test test test junk"
KEY="$(cast wallet private-key "$MNEMONIC" 0)"   # the deployer doubles as the faucet: anvil's public account #0
FAUCET="$(cast wallet address --private-key "$KEY")"
ROUTER="$(jq -r .addresses.router "$J")"
WBNB="$(jq -r .addresses.wbnb "$J")"
FACTORY="$(cast call --rpc-url "$RPC" "$ROUTER" 'factory()(address)')"

say "deploying DemoUSDC on chain $CHAIN_ID (minter $FAUCET)"
USDC="$(cd "$C" && forge create --rpc-url "$RPC" --private-key "$KEY" --broadcast \
  src/mocks/DemoUSDC.sol:DemoUSDC --constructor-args "$FAUCET" 2>/dev/null | awk '/Deployed to:/ {print $3}')"
[ -n "$USDC" ] || { echo "DemoUSDC deploy failed" >&2; exit 1; }

# 600,000 dUSDC against 1,000 BNB: BNB at $600, the same rate the local Atlas test signer reports
USDC_IN=600000000000     # 600,000 * 1e6
BNB_IN=1000ether
snd() { cast send --rpc-url "$RPC" --private-key "$KEY" "$@" >/dev/null; }
snd "$FACTORY" 'createPair(address,address)' "$USDC" "$WBNB"
PAIR="$(cast call --rpc-url "$RPC" "$FACTORY" 'getPair(address,address)(address)' "$USDC" "$WBNB")"
snd "$USDC" 'mint(address,uint256)' "$PAIR" "$USDC_IN"
snd "$WBNB" 'deposit()' --value "$BNB_IN"
snd "$WBNB" 'transfer(address,uint256)' "$PAIR" "$(cast to-wei 1000)"
snd "$PAIR" 'mint(address)' "$FAUCET"
say "dUSDC $USDC, pool $PAIR (600,000 dUSDC / 1,000 BNB)"

# The Four.meme path, local stand-in for Four.meme's token creation (src/mocks/FourLiteLauncher.sol). OpenFour's
# ForwardVault resolves WBNB by chain id and refuses anything but BNB Chain and its testnet, so this needs the fork;
# it clones the live ForwardVault implementation there.
FOUR=""
FVIMPL="$(jq -r '.addresses.forwardVaultImpl // empty' "$J")"
if [ "$CHAIN_ID" = "56" ] && [ -n "$FVIMPL" ] && [ "$(cast code --rpc-url "$RPC" "$FVIMPL")" != "0x" ]; then
  FOUR="$(cd "$C" && forge create --rpc-url "$RPC" --private-key "$KEY" --broadcast \
    src/mocks/FourLiteLauncher.sol:FourLiteLauncher --constructor-args "$FVIMPL" "$ROUTER" "$WBNB" 2>/dev/null \
    | awk '/Deployed to:/ {print $3}')"
  say "Four.meme path (local stand-in launcher on the live ForwardVault $FVIMPL): $FOUR"
else
  say "Four.meme path skipped: OpenFour's ForwardVault runs only on BNB Chain (fork) or its testnet"
fi

# Demo.s.sol rewrites local.json from its own struct, so these live in extra.local.json and are merged in (here and
# after every demo scene, by scripts/dev-demo.sh).
X="$C/deployments/extra.local.json"
[ -f "$X" ] || echo '{}' >"$X"
tmp="$(mktemp)"
jq --arg u "$USDC" --arg p "$PAIR" --arg f "$FAUCET" --arg four "$FOUR" \
  '.addresses.demoUsdc=$u | .addresses.demoUsdcPair=$p | .addresses.faucet=$f | .accounts.faucet={address:$f, anvilIndex:0}
   | (if $four != "" then .addresses.fourLiteLauncher=$four else . end)' \
  "$X" >"$tmp" && mv "$tmp" "$X"
tmp="$(mktemp)"
jq -s '.[0] * .[1]' "$J" "$X" >"$tmp" && mv "$tmp" "$J"
