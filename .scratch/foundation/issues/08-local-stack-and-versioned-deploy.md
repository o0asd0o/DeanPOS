# 08 — Local stack, four origins, and a versioned deploy

**Status:** ready-for-agent

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

- [ ] `apps/landing` builds with Next.js's own build and deploys. No content.
- [ ] Docker Compose brings up API, `apps/pos`, `apps/backoffice`, `apps/landing`, and
      PostgreSQL locally, with **no cloud credentials required**.
- [ ] One documented command starts the whole stack from a clean checkout — onboarding is not
      tribal knowledge.
- [ ] The reverse proxy serves four origins on one registrable domain with TLS, and the
      domain comes from an environment variable.
- [ ] The three CORS-allowlisted callers behave as issue 04 specifies once served through the
      proxy; the apex origin is still not on the allowlist.
- [ ] A deploy produces a **versioned** container image, tagged so a previous version can be
      redeployed.
- [ ] `.env.example` is committed with variable names and **no values**. No secret is
      committed anywhere in the repository.
- [ ] A manual smoke check against the health endpoint on the VPS is documented and its
      result recorded in the build report. The Docker deploy itself is not automated-tested,
      by decision.

## Depends on

- 04 — Ping through contract → api → backend, with health and CORS
- 06 — Terminal shell (`apps/pos`) rendering ping, and the test seam
- 07 — Back-office shell (`apps/backoffice`) rendering ping

## Relevant files

- `docker-compose.yml` (extends the database service from issue 03)
- `apps/*/Dockerfile`
- reverse-proxy configuration
- `apps/landing/**`
- `.env.example`, `README.md`

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 46–51; security criteria 2, 3). Out of
scope by decision: staging environments, backups, restore drills, rollback rehearsal, and the
gated deploy script — all area 10._
