# DeanPOS

## Setup

```
vp install
```

That is the only setup step. `vp` (Vite+) manages installs, the dependency catalog, and
workspace task running; Bun is the package-manager backend underneath it and the runtime
`apps/api` serves on. Versions are pinned in the root `package.json` `catalog`.

## Gate

```
vp check
vp run -r check
vp run -r test
```

`vp check` runs format, lint, and typecheck at the root. `vp run -r check` and
`vp run -r test` run each workspace's own `check` and `test` script. A type error, a lint
error, or a failing test in any single workspace turns the whole gate red.

## Local stack

```
vp run -w stack
```

From a clean checkout this writes `.env` with local defaults (nothing secret — the same
values already default in `docker-compose.yml`), installs dependencies, brings up
PostgreSQL, the API, `apps/landing`, and the Caddy proxy in Docker, waits for health, and
applies migrations. It is idempotent: safe to run again after `docker compose down`.

Once it finishes:

- `https://deanpos.localhost` — `apps/landing`
- `https://pos.deanpos.localhost` — the terminal (`apps/pos`)
- `https://admin.deanpos.localhost` — the back office (`apps/backoffice`)
- `https://api.deanpos.localhost` — the API

Each is served from its own origin, not a path on another one — that is what keeps the
terminal's Device token and PIN hashes browser-isolated from the back office
(ADR-0007). `APP_DOMAIN` is read from the environment; the same Caddyfile serves
`deanpos.localhost` locally and a real registrable domain on the VPS, because Caddy
picks its certificate issuer from the hostname — its own internal CA for `.localhost`,
Let's Encrypt for everything else.

### Trusting the local certificate authority

One-time, per machine, so the four URLs above load without a browser warning.

macOS:

```sh
docker compose cp web:/data/caddy/pki/authorities/local/root.crt /tmp/deanpos-root.crt
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /tmp/deanpos-root.crt
```

Linux: copy the same file to `/usr/local/share/ca-certificates/` and run
`sudo update-ca-certificates`.

`.localhost` names resolve to loopback automatically on macOS and Linux (RFC 6761). If
that is not the case on a given machine, add:

```
127.0.0.1 deanpos.localhost pos.deanpos.localhost admin.deanpos.localhost api.deanpos.localhost
```

### Clean-clone-to-green

```sh
git clone <repo> && cd DeanPOS
vp run -w stack
vp run -w codegen; vp check; vp run -r check; vp run -r test
```

The data layer's tests read a real database, so they need `.env` and PostgreSQL running
before they can pass — `vp run -w stack` provides both. The database tests are not made
to skip themselves when a database is absent; they fail loudly, and `vp run -w stack` is
what removes the reason they would.

### Rolling back

Every image is tagged with the git commit SHA it was built from — never `latest`.

```sh
IMAGE_TAG=$(git rev-parse --short=12 HEAD) docker compose build
IMAGE_TAG=$(git rev-parse --short=12 HEAD) docker compose up -d

# Roll back — no rebuild, no code revert
docker image ls 'deanpos/*'     # every tag is a git commit SHA
git log --oneline               # maps each SHA to its commit
IMAGE_TAG=<previous-sha> docker compose up -d
```

All three application images move together under one `IMAGE_TAG`, so a rollback puts
the API, both static bundles, and the landing site back to one consistent commit.
Images live only in the Docker daemon that built them — no registry is configured here
— so **`docker image prune -a` destroys your rollback targets.** Retention and a
registry, if wanted, are area 10 (`release-ops`).

### Smoke check

After a deploy, confirm the API can reach its database:

```sh
curl -sS https://api.<APP_DOMAIN>/health
# expected, exactly: {"live":true,"databaseReachable":true}
```

`live` is always `true` when this responds at all — the process would not have answered
otherwise. `databaseReachable: false` means the API is up and PostgreSQL is not.

**VPS execution status: documented; not executed — no VPS access, escalated to the
human.** Three things need doing on the server before this check can run for real:

1. Point four DNS A records at the server — the apex, `pos`, `admin`, `api`.
2. Confirm Caddy obtained publicly-trusted certificates: `docker compose logs web`
   should show four certificates obtained, with no Let's Encrypt error. This is the one
   claim that cannot be exercised locally at all — the laptop path uses Caddy's
   internal CA and never contacts an ACME server.
3. Run the `curl` command above against the real domain and paste the output into the
   build report.

## Layout

- `apps/landing`, `apps/pos`, `apps/backoffice`, `apps/api` — the four applications.
- `packages/backend`, `packages/contract`, `packages/schemas`, `packages/error`,
  `packages/ui`, `packages/tsconfig` — shared packages. `packages/tsconfig` holds the
  strict base TypeScript config every workspace extends.

See `docs/adr/0001-stack-and-monorepo-shape.md` for the shape and why it is fixed.
