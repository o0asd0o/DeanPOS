# 08 — Local stack, four origins, and a versioned deploy

**Status:** done — except the VPS smoke check, escalated to the human

## What to build

The whole stack running locally with no cloud credentials, and the same stack reachable on a
single VPS over TLS on four origins — with the deployed artefact being a **versioned image**,
so that rolling back is redeploying a previous image rather than reverting code.

`apps/landing` is scaffolded here only far enough to build and deploy. Its content, copy, and
design are area 11.

**Four origins on one registrable domain** (ADR-0001): the apex for `apps/landing`, plus
`pos.`, `admin.`, and `api.`. Separate origins are what make the terminal's Device token and
PIN hashes browser-isolated from the back-office. The domain itself is **not decided** — read
it from an environment variable, so that settling it is a config change and not a code change.

Docker Compose defines the API, both static front ends, the landing site, and PostgreSQL. A
reverse proxy serves the four origins with TLS.

**Boundary:** this issue produces the image and the running stack. The deploy *script* that
refuses a dirty tree and refuses a commit whose gate has not passed is `release-ops` (area 10),
which also owns environments, rollback rehearsal, backups, and the runbook.

## Acceptance criteria

- [x] `apps/landing` builds with Next.js's own build and deploys. No content.
- [x] Docker Compose brings up API, `apps/pos`, `apps/backoffice`, `apps/landing`, and
      PostgreSQL locally, with **no cloud credentials required**.
- [x] One documented command starts the whole stack from a clean checkout — onboarding is not
      tribal knowledge.
- [x] The reverse proxy serves four origins on one registrable domain with TLS, and the
      domain comes from an environment variable.
- [x] The **two** CORS-allowlisted callers — `pos.` and `admin.` — behave as issue 04
      specifies once served through the proxy. The apex origin is still not on the allowlist,
      and `api.` does not need to be: an origin calling itself is not a cross-origin request.
- [x] Each front end is served from **its own origin, not a path** on another one. This is
      what makes the terminal's Device token and PIN hashes browser-isolated from the
      back-office (ADR-0007); a path-based deployment defeats it and is not acceptable.
- [x] A deploy produces a **versioned** container image, tagged so a previous version can be
      redeployed.
- [x] `.env.example` is committed with variable names and **no values**. No secret is
      committed anywhere in the repository.
- [ ] A manual smoke check against the health endpoint on the VPS is documented and its
      result recorded in the build report. The Docker deploy itself is not automated-tested,
      by decision.
      **Status: documented; not executed — no VPS access, escalated to the human.** The
      README's "Smoke check" section carries the exact command and the exact expected
      response. The human must, on the VPS: (1) point four DNS A records at the server
      — the apex, `pos`, `admin`, `api`; (2) confirm Caddy obtained publicly-trusted
      certificates via `docker compose logs web` — the one claim that cannot be
      exercised locally, since the laptop path never contacts an ACME server; (3) run
      `curl -sS https://api.<APP_DOMAIN>/health` and confirm it returns exactly
      `{"live":true,"databaseReachable":true}`, then record the output here or in the
      build report. See `.scratch/decisions/011-local-stack-and-versioned-deploy.md`.

## Depends on

- 06 — Terminal shell (`apps/pos`) rendering ping, and the test seam
- 07 — Back-office shell (`apps/backoffice`) rendering ping

_(04 is a gate too, but transitively through both — it is not listed twice.)_

## Relevant files

- `docker-compose.yml` (extends the database service from issue 03)
- `apps/*/Dockerfile`
- reverse-proxy configuration
- `apps/landing/**`
- `.env.example`, `README.md`

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 46–49, 51, and the image half of 50;
security criteria 2, 3). Out of
scope by decision: staging environments, backups, restore drills, rollback rehearsal, and the
gated deploy script — all area 10._

`docker-compose.yml` defaults `POSTGRES_PASSWORD` to `deanpos` when unset. That is a
documented dev default, not a committed secret — security criterion 3 holds. But the stack
is now deployable, so an operator who forgets to set it ships `deanpos`. Area 10
(`release-ops`, production password-hardening) should make this fail closed rather than
default.

Review fix applied 2026-08-02: `postgres` now publishes `5433:5432` instead of
`5432:5432` — it was colliding with a developer's own local PostgreSQL and defeating
the one-command onboarding criterion. Verified end to end with the host's PostgreSQL
still running on 5432: brought the stack up, ran `vp run -w migrate` with
`DATABASE_URI` pointing at `localhost:5433`, confirmed the migration landed in the
container's `DeanPOS_dev` (queried directly on 5433 — tables present) and not the
host's `DeanPOS_dev` or lane database on 5432 (both unchanged), confirmed
`GET /health` returns `{"live":true,"databaseReachable":true}` from inside the `api`
container, then brought the stack down. `.scratch/decisions/011-...md` copied from
main and amended to match shipped code (ca-certificates in the slim Bun stages, the
`vp run -F <app> build` form, `apps/landing`'s `useTypeScriptCli` config, its
`tsconfig.json` additions and `public/.gitkeep`, and the port). Gate green:
`vp run -w codegen`, `vp check`, `vp run -r check`, `vp run -r test`.

## Carried forward from issue 03

The reviewer on issue 03 ruled that the clean-clone-to-green path is **this issue's** to
close, under stories 46 and 47. A fresh `git clone` plus `vp install` now reaches a green
`vp check` and `vp run -r check`, but `vp run -r test` fails, because the data layer's test
reads a real database and a bare clone has neither a `.env` nor a running PostgreSQL.

Document the full path here: copy `.env.example`, set `DATABASE_URI`, `docker compose up`,
then the gate. Do **not** close the gap by making the database test skip itself when
`DATABASE_URI` is absent — a silent skip hides a real gate gap and is strictly worse than a
loud failure.

---

**Closed by the pipeline, with one criterion deliberately incomplete.** One review round used
(REVISE on two should-fix findings, then PASS on both axes). Gate green cold in the lane after
the rebase and again on `main`. Merged at `67df9bc`. Lane database dropped at close.

**8 of 9 acceptance criteria are complete and proven locally.** The ninth — the manual smoke
check against the health endpoint on the VPS — is **documented but not executed**, because
there is no VPS, no credentials, and no access, and deploying to one is outward-facing. It was
escalated rather than performed or ticked silently.

**What a human must do to close it — exactly three things:**

1. Point four DNS A records at the server: the apex, `pos`, `admin`, and `api`.
2. Confirm Caddy obtained public certificates — `docker compose logs web`. **This is the only
   claim in the whole issue that cannot be exercised locally at all**, because the laptop path
   uses Caddy's internal certificate authority and never contacts an ACME server.
3. `curl -sS https://api.<APP_DOMAIN>/health` and expect exactly
   `{"live":true,"databaseReachable":true}`.

**Things that looked like they needed a VPS and did not, so they were done:**

- **The versioned-image and rollback criterion.** Two images were built at different commits,
  and switching by tag alone made a marker appear and disappear with no rebuild and no code
  revert. A local Docker daemon is a Docker daemon. The demo commits net to zero change.
- **CORS through the proxy.** `pos.` and `admin.` origins get exactly their own origin echoed
  back; the apex and an arbitrary origin get no allow header — issue 04's behaviour, now
  observed through Caddy rather than only in-process.
- **Four origins with TLS**, from `APP_DOMAIN`, with Caddy's internal CA issuing for all four
  `.localhost` names in under 20ms and no ACME attempted. The multi-label `.localhost` risk
  record 011 flagged did not materialise, so its `tls {$CADDY_TLS:internal}` fallback was not
  needed.

**The review's most valuable finding was operational, not architectural.** `docker-compose.yml`
published PostgreSQL on `5432:5432`, which collides with the local PostgreSQL that this
project's own gate requires. Docker binds the port without error, but host connections still
resolve to the host's server — so `vp run -w migrate` silently migrated the wrong database
while the API container talked to an unmigrated one. The implementer had needed an uncommitted
override to get a working stack, which means the documented one-command path required knowledge
that was not written down — exactly what story 47 forbids.

Fixed by publishing `5433:5432` and documenting it. Nothing inside the compose network moved;
services still reach `postgres:5432`. Verified by confirming the container database gained the
tables while both host databases on 5432 were untouched — the step that had failed silently
before.

**Decision made during this issue:** `.scratch/decisions/011-local-stack-and-versioned-deploy.md`
— **Stakes: high.** Caddy `2.11.4-alpine` as one container serving as both proxy and static file
server; four enumerated site blocks and never a wildcard, since a wildcard would force DNS-01
and an API token; no local mode and no production mode, because Caddy picks its issuer from the
hostname; Next.js `16.2.12` with `output: "standalone"`; image tags from
`git rev-parse --short=12 HEAD` with no `latest`; and nothing whatsoever between the API and
PostgreSQL, because record 004 established that a statement-mode pooler would silently break
the `SET LOCAL` that area 2's tenant isolation depends on.

**The record was corrected against shipped reality**, the second time this run that a record
went stale before the next area could copy it. Five corrections, each forced by actually
building: `ca-certificates` in all three slim Bun stages (the slim base ships no CA bundle and
`vp`'s prepare hook aborts without one), the invalid `vp build -F` CLI form, Next's
`experimental.useTypeScriptCli` under this repo's typescript-go compiler, the landing
`tsconfig`/`public` scaffold requirements, and the port reality.

**The clean-clone obligation from issue 03 is discharged.** A fresh clone plus `vp install`
reaches green `vp check` and `vp run -r check`; `vp run -r test` **fails loudly** without a
database rather than skipping; and the README documents the full path. Nothing was made to skip
when `DATABASE_URI` is absent — a silent skip would have hidden a real gate gap.

**Carried to area 10:** `POSTGRES_PASSWORD` defaults to `deanpos` when unset. Not a committed
secret and `.env.example` carries names only, so security criterion 3 holds — but the stack is
now deployable, so area 10 should make it **fail closed** rather than default.
