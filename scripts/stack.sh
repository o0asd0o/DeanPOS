#!/usr/bin/env bash
set -euo pipefail

# One command from a clean checkout: dependencies, .env, the stack, the schema.
# Idempotent — safe to run again at any time.

if [ ! -f .env ]; then
  # Local development defaults. Not secrets: docker-compose.yml already carries
  # the same values as its own fallbacks, and .env is gitignored. See .env.example
  # for what each name is for.
  cat > .env <<'EOF'
DATABASE_URI=postgresql://deanpos:deanpos@localhost:5432/DeanPOS_dev
POSTGRES_USER=deanpos
POSTGRES_PASSWORD=deanpos
POSTGRES_DB=DeanPOS_dev
APP_DOMAIN=deanpos.localhost
EOF
  echo "Wrote .env with local defaults."
fi

vp install
docker compose up -d --wait
vp run -w migrate

echo "Stack up. https://deanpos.localhost  https://pos.deanpos.localhost  https://admin.deanpos.localhost  https://api.deanpos.localhost"
