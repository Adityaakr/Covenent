#!/usr/bin/env bash
# Stop the dev chain started by scripts/dev-up.sh. Leaves deployments/local.json in place.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/contracts/.anvil"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1
if [ -f "$STATE/anvil.pid" ]; then
  PID="$(cat "$STATE/anvil.pid")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.25; done
    [ "$QUIET" = "1" ] || echo "[dev-down] stopped anvil (pid $PID)"
  fi
  rm -f "$STATE/anvil.pid"
else
  [ "$QUIET" = "1" ] || echo "[dev-down] no dev chain running"
fi
