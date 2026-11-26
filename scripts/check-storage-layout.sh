#!/usr/bin/env bash
# Storage layout guard for the beacon-upgradeable contracts (CovenantVault, CovenantLauncher). A Guardian upgrade
# runs new code against old storage, so a reordered, retyped or removed variable corrupts every live covenant.
# Compares `forge inspect <C> storageLayout` with the committed snapshot in contracts/storage-layout/.
#   scripts/check-storage-layout.sh            fail on any difference (CI)
#   scripts/check-storage-layout.sh --update   rewrite the snapshot after an intended, append-only change
# Append new variables just before the `__gap` and shrink the gap by the same number of slots.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C="$ROOT/contracts"
export PATH="$HOME/.foundry/bin:$PATH"
mkdir -p "$C/storage-layout"
status=0
for name in CovenantVault CovenantLauncher; do
  snap="$C/storage-layout/$name.json"
  now="$( (cd "$C" && forge inspect "$name" storageLayout --json) | jq '[.storage[] | {label, slot, offset, type: (.type | sub("\\)[0-9]+_storage"; ")_storage") | sub("\\)[0-9]+"; ")"))}]')"
  if [ "${1:-}" = "--update" ]; then
    printf '%s\n' "$now" >"$snap"
    echo "[storage-layout] wrote $name"
  elif [ ! -f "$snap" ] || ! diff <(printf '%s\n' "$now") "$snap" >/dev/null; then
    echo "[storage-layout] $name differs from contracts/storage-layout/$name.json:" >&2
    diff <(printf '%s\n' "$now") "$snap" >&2 || true
    status=1
  else
    echo "[storage-layout] $name matches the snapshot"
  fi
done
exit $status
