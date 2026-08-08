#!/usr/bin/env bash
set -euo pipefail

# `vp run -w dev` already counts as one `vp` process. Routing the fan-out
# through a second `vp run --parallel ...` puts `vp dev` (apps/pos,
# apps/backoffice) three `vp` processes deep, and the third one fails to spawn
# (os error 22) — reproduced directly, not by inference. Launching each app's
# own dev command as a background job here keeps `vp dev` two deep, which is
# the depth that is proven to work. .scratch/decisions/012.
set -a
[ -f .env ] && . ./.env
set +a

cd "$(dirname "$0")/.."

pids=()

cleanup() {
  trap - INT TERM EXIT
  local pid
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Process-group sweep for grandchildren (bun --hot, next, vp).
  kill 0 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd apps/api && bun run dev) & pids+=($!)
(cd apps/landing && bun run dev) & pids+=($!)
(cd apps/pos && bun run dev) & pids+=($!)
(cd apps/backoffice && bun run dev) & pids+=($!)

wait
