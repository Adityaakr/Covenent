#!/usr/bin/env bash
# Build the contracts and export the ABIs the web app and the server read, to contracts/abi/<Contract>.json.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C="$ROOT/contracts"
export PATH="$HOME/.foundry/bin:$PATH"
(cd "$C" && forge build -q)
mkdir -p "$C/abi"

# file:contract pairs under contracts/out
ARTIFACTS=(
  CovenantLauncherFactory.sol:CovenantLauncherFactory
  CovenantLauncher.sol:CovenantLauncher
  CovenantVaultFactory.sol:CovenantVaultFactory
  CovenantVault.sol:CovenantVault
  CovenantOracle.sol:CovenantOracle
  CovenantLens.sol:CovenantLens
  CovenantLiteVault.sol:CovenantLiteVault
  ForwardVault.sol:ForwardVault
  IPortal.sol:IPortal
  IERC8004.sol:IERC8004Identity
  IERC8004.sol:IERC8004Reputation
  PairTwap.sol:IV2Pair
  IERC20.sol:IERC20
  MockFlap.sol:MockPortal
  MockFlap.sol:MockTaxProcessor
  MockFlap.sol:MockTaxToken
  MockV2.sol:MockV2Router
  MockV2.sol:MockWBNB
  MockERC8004.sol:MockIdentityRegistry
  MockERC8004.sol:MockReputationRegistry
  DemoUSDC.sol:DemoUSDC
)
for a in "${ARTIFACTS[@]}"; do
  file="${a%%:*}"
  name="${a##*:}"
  src="$C/out/$file/$name.json"
  [ -f "$src" ] || { echo "missing artifact $src" >&2; exit 1; }
  jq '.abi' "$src" >"$C/abi/$name.json"
done
echo "[dev-abi] wrote ${#ARTIFACTS[@]} ABIs to $C/abi"
