#!/usr/bin/env bash
set -euo pipefail

# One command from a clean checkout: dependencies, .env, the stack, the schema.
# Idempotent — safe to run again at any time.

if [ ! -f .env ]; then
  # Local development defaults. Not secrets: docker-compose.yml already carries
  # the same values as its own fallbacks, and .env is gitignored. See .env.example
  # for what each name is for.
  cat > .env <<'EOF'
DATABASE_URI=postgresql://deanpos:deanpos@localhost:5433/DeanPOS_dev
APP_DATABASE_URI=postgresql://deanpos_app:deanpos_app@localhost:5433/DeanPOS_dev
POSTGRES_USER=deanpos
POSTGRES_PASSWORD=deanpos
POSTGRES_DB=DeanPOS_dev
APP_DOMAIN=deanpos.localhost
VITE_API_URL=http://localhost:6001
EOF
  echo "Wrote .env with local defaults."
fi

# An .env from before VITE_API_URL existed never gains it, since the block
# above only fires on a missing file — .scratch/decisions/012.
if ! grep -q '^VITE_API_URL=' .env; then
  echo "VITE_API_URL=http://localhost:6001" >> .env
  echo "Added VITE_API_URL to existing .env."
fi

# .scratch/decisions/027 — an .env written before this name existed never gains it.
if ! grep -q '^APP_DATABASE_URI=' .env; then
  echo "APP_DATABASE_URI=postgresql://deanpos_app:deanpos_app@localhost:5433/DeanPOS_dev" >> .env
  echo "Added APP_DATABASE_URI to existing .env."
fi

vp install
docker compose up -d --wait
vp run -w migrate

echo "Stack up. https://deanpos.localhost  https://pos.deanpos.localhost  https://admin.deanpos.localhost  https://api.deanpos.localhost"
