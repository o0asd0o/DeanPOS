# 011: The local stack and the versioned deploy — Caddy, one proxy that also serves the two bundles, and a git SHA as the image tag

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/08-local-stack-and-versioned-deploy.md`, including its "Carried forward from issue 03" section)

**Amended 2026-08-02:** building the stack, not preference, forced five corrections to
what is specified below, all now applied in place. All three slim Bun stages need
`RUN apt-get install ca-certificates` — the slim base ships no CA bundle and `vp`'s
prepare-hook HTTPS request aborts without it. The `web.Dockerfile` build command is
`vp run -F pos build && vp run -F backoffice build`, not `vp build -F pos`, which is
not a valid CLI form. `apps/landing/next.config.ts` also needs
`experimental.useTypeScriptCli: true`, because this repository's TypeScript 7.0.2
(typescript-go) has no compiler API and Next's typecheck step needs one.
`apps/landing/tsconfig.json` needs `jsx`, the `dom` lib, and the `next` plugin, and
`apps/landing/public/.gitkeep` must exist so the Dockerfile's `COPY public` does not
fail. And `postgres` publishes `5433:5432`, not `5432:5432`, because the gate requires
a developer's own PostgreSQL on 5432 (issue 09) and the container must not contend
for that port. The rest of this record is unchanged.

## The question

The whole stack has to run on a developer's laptop with no cloud account and no
public DNS, and the same stack has to run on one rented server, reachable at four
web addresses over HTTPS. This record picks the pieces: which reverse proxy, which
Next.js version for the marketing site, which container base images, how a
container image is named so that yesterday's version can be put back, what a fresh
clone has to type to get everything running, and which new configuration names go
into the committed example file.

A wrong answer is expensive in two directions. Downwards, area 10 (`release-ops`)
builds its deploy script, its rollback rehearsal, and its runbook directly on top of
whatever lands here. Sideways, one specific constraint kills most of the obvious
answers: **the four addresses must have working HTTPS on a laptop with no DNS.**
That is not a nice-to-have. `apps/api/src/middlewares/cors.ts` already ships with
the allowlist hard-coded as `https://pos.${appDomain}` and `https://admin.${appDomain}`,
and `apps/api/tests/cors.test.ts` already asserts it. A local stack served over plain
`http://` would fail CORS against code that is already merged and already tested.
Local TLS is therefore a correctness requirement, not developer comfort.

**Settled elsewhere and not reopened here:** four origins on one registrable domain
(ADR-0001, PRD story 48); separate origins as the browser-enforced boundary for the
Device token and PIN hashes (ADR-0007); the CORS allowlist being exactly `pos.` and
`admin.` (issue 04, tested); the registrable domain being read from `APP_DOMAIN`
rather than decided; PostgreSQL (record 001); `pg` talking straight to it with no
pooler in between (record 004); Next.js for `apps/landing` with Next's own build
(ADR-0001, PRD); `apps/landing` staying outside `packages/ui` until area 11
(record 007); no hosted CI (ADR-0006); the deploy *script* and everything about
environments, backups and rollback rehearsal (area 10).

## What I chose, and why

**Caddy 2.11.4, in one container that is both the TLS reverse proxy and the file
server for the two React bundles. Next.js 16.2.12 for `apps/landing` in its own
container. Four Compose services. Every image tagged with the git commit SHA it was
built from.**

Five things inside that carry the record.

### 1. Caddy, because it is the only candidate that issues its own certificates

The hard part of this issue is not "serve four names over TLS in production" — every
candidate does that. It is "serve four names over TLS on a laptop that has no DNS,
no public IP, and no account anywhere". Those are different problems and the PRD
requires both.

Caddy solves the second one by having a certificate authority of its own. Its
`internal` issuer runs a local CA inside the container, signs certificates for any
hostname you ask for, and needs no network, no ACME server, and no credentials. And
crucially it selects that issuer **automatically, from the hostname**: Caddy's
Automatic HTTPS documentation states that names under `.localhost`, `.local`,
`.internal` and `.home.arpa` do not qualify for publicly-trusted certificates and
get the internal issuer instead.

That single behaviour is what makes this whole record small. There is **no local
mode and no production mode.** There is one Caddyfile with `{$APP_DOMAIN}` in it,
and the environment variable decides everything:

- `APP_DOMAIN=deanpos.localhost` → four names ending in `.localhost` → Caddy's own
  CA signs them, offline, in about a second.
- `APP_DOMAIN=someones-real-domain.com` → four public names → Caddy asks Let's
  Encrypt over the HTTP-01 challenge on port 80, which is on by default.

No conditional, no second config file, no Compose override, no template step. The
one environment variable the PRD already demanded turns out to be sufficient on its
own, which is the kind of answer worth noticing rather than improving.

Two supporting facts made this comfortable rather than lucky. First, **the four
hostnames are enumerated, so no wildcard certificate is needed** — and a wildcard is
the one thing that would have forced DNS-01 validation, which needs a DNS provider
plugin, a custom Caddy build, and an API token in production. Writing out four site
blocks instead of one wildcard block removes a credential from the deployment
entirely. Second, `.localhost` names resolve to loopback automatically on macOS and
on Linux under RFC 6761, so there is normally nothing to add to `/etc/hosts`; the
four-line fallback is documented below for the machines where it is not automatic.

The alternatives lose on exactly this axis, and it is worth being specific because
both are otherwise excellent servers:

- **Traefik has no local CA at all.** Its own documentation gives two modes: ACME,
  or certificates you supply. With neither, it serves a built-in self-signed default
  certificate that no browser trusts and that cannot be trusted per-host. Local TLS
  would therefore need `mkcert` — a tool whose last release was **v1.4.4 in April
  2023** with no meaningful activity since — installed by hand on every machine,
  plus a file-provider config to mount what it produces. Traefik also spreads its
  routing across Docker labels on each service instead of one readable file, which
  is a genuine benefit when services come and go and a genuine cost when there are
  four of them and one operator.
- **nginx cannot read environment variables at all.** The official image works
  around this with an `envsubst` template pass in `/docker-entrypoint.d/`, which is
  a second mechanism to learn and has a known "Bad file descriptor" failure mode.
  nginx *did* gain a native ACME module (1.25.1 minimum, 1.28.0+ recommended,
  announced August 2025), so its production story is now fine — but that module does
  nothing for the laptop, which is the half that was hard. nginx locally is
  `mkcert` again, or a hand-rolled OpenSSL CA.

Neither is a bad tool. Both cost a second tool, a second mechanism, and an unmaintained
dependency to reach where Caddy arrives with one file and zero installs.

### 2. The proxy serves the two React bundles itself. There are no static containers.

`apps/pos` and `apps/backoffice` compile to a folder of files. Caddy already contains
a file server. Putting each bundle in its own container behind the proxy would mean
two more images to build, tag, push, restart and roll back, whose entire job is to
hand back forty static files that the process in front of them could hand back
directly.

**This does not weaken ADR-0007, and that is the objection to answer head-on.**
Browser storage isolation is a property of the *origin* — the scheme, host and port
in the address bar — not of which process on the server produced the bytes. Caddy
serves `pos.$APP_DOMAIN` from `/srv/pos` and `admin.$APP_DOMAIN` from `/srv/admin`
as two separate site blocks. To a browser those are two origins with two separate
IndexedDB stores, two separate localStorage areas, and no way for a script in one to
read the other. A back-office XSS still cannot reach the terminal's Device token.
The criterion the issue actually sets — "each front end is served from its own
origin, not a path on another one" — is met exactly, and a path-based deployment is
still rejected.

The landing site is different and does get its own container, because it is not a
folder of files: it is Next.js with its own server.

### 3. Next.js 16.2.12, constrained *by* the catalog's React, not the other way round

Next.js 16.2.12's peer range is `react: "^18.2.0 || 19.0.0-rc-… || ^19.0.0"`, and
`react@19.2.8` — the version record 007 pinned — satisfies it. Next does not vendor
the React that the application uses; its installation documentation says to declare
`react` and `react-dom` in `package.json` regardless. So `apps/landing` declares
`react: "catalog:"` and `react-dom: "catalog:"` like every other workspace, one copy
of React resolves across the monorepo, and **the catalog constrains Next rather than
Next constraining the catalog.** If a future Next major demands a React the catalog
cannot supply, that is a re-check trigger on this record, not a silent second copy of
React in `bun.lock`.

(Next's App Router does use React canary builds *internally*, which it compiles in.
That is Next's business and does not reach the application's own React.)

**`apps/landing` does not consume `packages/ui`, and gets no Tailwind here.** That
is record 007's decision — "`apps/landing` deliberately outside `packages/ui` until
area 11, which reuses the same `theme.css` through `@tailwindcss/postcss`" — and this
record confirms it rather than re-deciding it. The site has no content. Wiring a
design system into a page with nothing on it is work area 11 would redo.

### 4. The image tag is the git commit SHA, and one variable rolls all three back

The criterion is "a deploy produces a versioned container image, tagged so a previous
version can be redeployed", and the PRD's reason is "rolling back is redeploying a
previous image rather than reverting code".

The tag is `git rev-parse --short=12 HEAD`. Not a semver tag: nobody in this project
cuts releases, every manifest reads `"version": "0.0.0"`, and ADR-0006 means there is
no CI to bump anything — a scheme that depends on a human remembering a ritual will
be wrong within a month. Not a date: a date does not tell you what code is inside.
A commit SHA is derived from the artefact itself, is unique, is already what the
operator has in `git log`, and needs nothing maintained.

All three images take the **same** tag in one deploy. That is the part that makes
rollback a single action: `IMAGE_TAG=<previous sha> docker compose up -d` puts the
API, the bundles and the landing site back to one consistent commit together. Mixed
tags across services are the failure this avoids.

Naming a previous image is `docker image ls 'deanpos/*'` — the tags *are* the SHAs —
next to `git log --oneline`, which maps each one to a commit message.

**The honest limitation:** no container registry is chosen here, because a registry
needs credentials and credentials are outside what I may decide. Images therefore
live only in the Docker daemon on the machine that built them, so `docker image
prune -a` deletes your rollback targets. Retention, and a registry if one is wanted,
belong to area 10. The runbook line warning about `prune` is written now so the
first person to lose an image is not the one who discovers this.

### 5. Nothing sits between the API and PostgreSQL

Record 004 warns that a connection pooler in *statement* mode would break
`SET LOCAL` / `set_config(..., true)` with no code change, silently taking area 2's
tenant isolation with it. Stating it plainly for this stack: **the `api` container
opens a TCP connection straight to the `postgres` container over the Compose
network. There is no PgBouncer, no pgpool, no proxy, and no connection multiplexer
anywhere in the database path.** Caddy carries HTTP only and never sees the
database. `SET LOCAL` semantics are exactly what record 004 assumed, and adding
anything in that path is a no-go below.

### Weights used for the ranking

Declared before any option was written down, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | ADR-0001 fixes the four origins. Every candidate produces the same four addresses for the same end user. |
| Business impact | ×1 | Every candidate is free and open-source. The only business variable is operator hours, which lands under engineering cost anyway. |
| Engineering cost and risk | ×2 | Local TLS with no DNS is the whole difficulty, and there is one operator running one VPS. A stack that needs a second tool installed by hand is a stack that breaks on the next machine. |
| Reversibility | ×2 | Area 10 builds its deploy script, rollback rehearsal and runbook directly on this. It is the headline risk. |
| Evidence strength | ×2 | I have no VPS and cannot exercise the production half at all (see the VPS section). Verified documentation has to carry the weight that a test would normally carry. |

Maximum possible total: 40. Same shape as records 006, 007 and 008, for the same reason.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Caddy, one container, proxy + file server for both bundles; issuer chosen automatically from `APP_DOMAIN`** | 5 | 4 | 5 (10) | 4 (8) | 4 (8) | **35** |
| 2 | Caddy as proxy only, plus a static container each for `pos` and `backoffice` (6 services) | 5 | 4 | 4 (8) | 4 (8) | 4 (8) | **33** |
| 3 | nginx + `envsubst` templates + `mkcert` locally + native ACME module on the VPS | 5 | 3 | 2 (4) | 3 (6) | 3 (6) | **24** |
| 4 | Traefik with Docker labels + `mkcert` and a file provider locally | 5 | 3 | 2 (4) | 2 (4) | 3 (6) | **22** |
| 5 | Defer — ship Compose with Postgres and the API only, no proxy, no TLS, no images | 1 | 1 | 4 (8) | 5 (10) | 1 (2) | **22** |

**1. Caddy, one container — chosen.** One config file, one binary, no second tool to
install, and the local-versus-production switch falls out of the environment variable
the PRD already required. It scores 5 on engineering cost because it is the only
option where the laptop story and the server story are the *same* configuration.
Reversibility is 4 rather than 5 because the two SPA bundles are baked into the proxy
image, so moving to a different proxy means moving the file-server blocks as well as
the routing — still one directory and one Compose file, but not a one-line revert.
Evidence is 4, not 5, because of one unverified sentence named honestly below.

**2. Caddy as proxy only, with separate static containers.** Genuinely close, and it
is what a larger team would probably do — it separates "route traffic" from "serve
this app's build", which matters when the two are owned by different people, and it
would let the terminal bundle be redeployed without restarting the proxy. It loses
one point on engineering cost, not on correctness: two more Dockerfiles, two more
images to tag on every deploy, two more services to keep healthy, in exchange for a
separation that a single-operator single-VPS deployment never spends. **This is the
option to move to** if the front-end bundles ever need to be deployed on a different
cadence from the routing layer, and the move is additive: two new Dockerfiles and two
`reverse_proxy` lines replacing two `file_server` blocks. Nothing is rewritten.

**3. nginx.** The most widely-operated web server in existence and I did not
dismiss it lightly. Its production story is now genuinely good — the native ACME
module (announced August 2025, 1.28.0+ recommended) removes the certbot sidecar and
the renewal cron that used to make this option ugly. It loses on the laptop. nginx
cannot read an environment variable, so `APP_DOMAIN` needs the official image's
`envsubst` template pass, which is a mechanism with a documented failure mode; and it
has no way to make a trusted certificate for `pos.deanpos.localhost`, so every
developer installs `mkcert` — last released April 2023 — and every new machine repeats
that. Two extra mechanisms and one unmaintained dependency to reach where option 1
starts.

**4. Traefik.** Ranked below nginx, which will surprise anyone who has used it,
because Traefik's whole appeal is exactly this shape — Docker labels, automatic
Let's Encrypt, service discovery. Two things sink it here. Its documentation is
explicit that with no ACME and no supplied certificates it serves a generated
self-signed default certificate, so it has **no equivalent of a local CA at all** and
local TLS is `mkcert` plus a file provider. And its routing lives in labels spread
across four service definitions plus a static/dynamic config split, which scores
worst on reversibility: moving off Traefik means unpicking configuration from every
service rather than deleting one file. Its dynamic discovery is worth real money when
services appear and disappear; four fixed services is not that situation.

**5. Defer.** Included because it must be, and note that **10 of its 22 points come
from reversibility**, which any do-nothing option maximises trivially — the same
inflation records 002, 004, 006, 007 and 008 each left visible rather than tuning
away. It fails on the facts. Issue 08 cannot start without these choices, its
dependencies (06 and 07) are already closed, and deferring hands the decision to
whichever implementer opens the issue first, at speed, without the local-TLS finding
that is the entire difficulty. It also leaves the carried-forward clean-clone gap from
issue 03 open for a second issue running, which is exactly the "going quiet" the
reviewer's ruling exists to prevent.

**Is it close?** Between 1 and 2, yes — two points, and I would not argue with someone
who took 2. Between the top two and the rest, no: the local-CA property is a real
capability that only one of the three servers has, and it is the property this
project's already-merged CORS test makes mandatory.

## What the implementer does

Exact. Nothing here is re-decided downstream.

### The Compose service list — four services, three volumes

`docker-compose.yml` gains three services alongside the existing `postgres`.

| Service | Image | Publishes | Depends on |
| --- | --- | --- | --- |
| `postgres` | `postgres:18` *(unchanged from issue 03)* | `5433:5432` | — |
| `api` | `deanpos/api:${IMAGE_TAG:-dev}` | **nothing** | `postgres` (`service_healthy`) |
| `landing` | `deanpos/landing:${IMAGE_TAG:-dev}` | **nothing** | — |
| `web` | `deanpos/web:${IMAGE_TAG:-dev}` | `80:80`, `443:443` | `api`, `landing` |

Volumes: the existing `postgres_data`, plus **`caddy_data`** (mounted at `/data`) and
**`caddy_config`** (at `/config`).

**`caddy_data` is not optional and not cosmetic.** It holds the local CA's root
certificate and, in production, the issued certificates. Without it: locally, the CA
regenerates on every `docker compose down`, so the root certificate the developer
trusted stops matching and TLS breaks with a confusing error; in production, every
container recreate re-requests certificates and Let's Encrypt's rate limit (a small
number of certificates per identical hostname set per week) locks the deployment out.
Losing this volume is the single most likely way to break the stack.

`api` and `landing` publish **no ports**. Only `web` is reachable from outside, which
is what makes the four origins the only way in.

The `api` service's environment is **derived, not copied from `.env`**:

```yaml
environment:
  DATABASE_URI: postgresql://${POSTGRES_USER:-deanpos}:${POSTGRES_PASSWORD:-deanpos}@postgres:5432/${POSTGRES_DB:-DeanPOS_dev}
  APP_DOMAIN: ${APP_DOMAIN:-deanpos.localhost}
```

This is deliberate and it fixes a trap. The host's `.env` has `DATABASE_URI` pointing
at `localhost:5432` because that is what the gate and the tests need. A container
using that value would try to reach itself. Deriving the container's URL from the same
`POSTGRES_*` parts Compose already uses for the database service means the two never
have to be kept in agreement by hand. Note that this value inherits record 005's
quoting constraint through `POSTGRES_PASSWORD` — a password containing a space, `&`
or `?` breaks the shell sourcing in the root `migrate` scripts. Do not put one there.

`api` healthcheck, which needs no `curl` in the image:

```yaml
healthcheck:
  test: ["CMD", "bun", "-e", "process.exit((await fetch('http://localhost:3000/health')).ok ? 0 : 1)"]
  interval: 10s
  timeout: 5s
  retries: 5
```

All three new services get `restart: unless-stopped`, matching `postgres`.

### The files, and where they live

```
docker/Caddyfile
docker/api.Dockerfile
docker/web.Dockerfile
docker/landing.Dockerfile
.dockerignore          (repo root)
```

**This departs from the issue's "Relevant files" hint of `apps/*/Dockerfile`, and
here is the reason.** The `web` image contains the builds of *two* applications plus
the proxy configuration, so it cannot live under `apps/<one-app>/`. Given that one of
the three has to sit outside `apps/`, putting all three in one directory next to the
Caddyfile they are deployed with is more legible than splitting two into `apps/` and
one into a corner. All three build contexts are the repository root regardless,
because every image needs the workspace and the lockfile — so the Dockerfiles were
never going to be self-contained inside an app directory anyway.

`.dockerignore` at the repository root, at minimum: `node_modules`, `.git`,
`.worktrees`, `dist`, `.next`, `.scratch`, `.env`, `**/generated`.

### `docker/Caddyfile` — the whole thing

```
# The registrable domain is not decided (ADR-0001, PRD). It arrives as APP_DOMAIN.
# There is deliberately no local-vs-production switch here: Caddy picks the
# certificate issuer from the hostname. Names under .localhost get Caddy's own
# internal CA with no network and no credentials; public names get Let's Encrypt
# over HTTP-01 on port 80. One file, both environments.

{$APP_DOMAIN:deanpos.localhost} {
	reverse_proxy landing:3000
}

pos.{$APP_DOMAIN:deanpos.localhost} {
	root * /srv/pos
	encode zstd gzip
	try_files {path} /index.html
	file_server
}

admin.{$APP_DOMAIN:deanpos.localhost} {
	root * /srv/admin
	encode zstd gzip
	try_files {path} /index.html
	file_server
}

api.{$APP_DOMAIN:deanpos.localhost} {
	reverse_proxy api:3000
}
```

Four things about that file are load-bearing:

- **`try_files {path} /index.html` is required, not decorative.** Both front ends are
  single-page applications with client-side routing. Without the fallback, reloading
  the browser on any route other than `/` returns 404 from the file server, and the
  symptom is "the app works until you refresh".
- **Four enumerated site blocks, not one wildcard.** A wildcard certificate would
  force DNS-01 validation, which needs a DNS-provider plugin compiled into Caddy and
  an API token stored on the server. Enumerating removes a credential from the
  deployment.
- **`encode zstd gzip` on the two bundle blocks.** One line, and the terminal is used
  on a tablet over a restaurant's connection. Not applied to the two `reverse_proxy`
  blocks, where the upstream owns its own encoding.
- **No security headers here.** HSTS, CSP, referrer policy and frame options are
  area 9 (`hardening`), which the PRD lists under Out of Scope for this area. Their
  absence is a decision, not an oversight — and they belong in one place with a threat
  model behind them, not sprinkled here first.

### `docker/api.Dockerfile`

```dockerfile
FROM oven/bun:1.3.13-slim
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.title="deanpos-api" \
      org.opencontainers.image.revision="${IMAGE_TAG}"
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
```

- **`oven/bun:1.3.13-slim`** — the exact Bun in `devEngines.packageManager`, so the
  image runs the runtime the lockfile was resolved with. **Standing rule: that tag and
  `devEngines.packageManager.version` move together or not at all.** Current published
  Bun is 1.3.14; if `1.3.13-slim` turns out not to exist on Docker Hub, bump both to
  `1.3.14` in the same commit rather than letting them diverge. Debian slim rather than
  alpine: `pg` is pure JavaScript so musl is not a hazard, but slim is the variant with
  the fewest surprises and image size is not a measured problem here.
- **`--frozen-lockfile`** satisfies PRD security criterion 7 and makes the build fail
  loudly rather than silently resolving something new.
- **No `CMD` change and no server file.** `apps/api/src/index.ts` already
  `export default`s the Hono app, and Bun's documented behaviour is that a default
  export carrying a `fetch` handler is passed to `Bun.serve`, listening on 3000 unless
  `PORT`/`BUN_PORT` says otherwise. The container needs nothing added.
- **Single stage, devDependencies included, on purpose.** A two-stage trim would need
  `--production`, which skips `vp`, which the root `prepare` hook needs. That is real
  work to save disk on one VPS nobody has measured. **Trigger to revisit:** image size
  or build time becoming a complaint. **Pre-decided fallback if `prepare` misbehaves in
  the image** (it runs `vp run -w codegen`): add `--ignore-scripts` to the install. The
  API does not need the generated Prisma types at runtime, because
  `packages/backend/src/db/client.ts` imports `DB` with `import type`, which Bun erases.

> **Conflict flagged, per `docs/agents/domain.md`.** Record 008 says in passing that
> "`devDependencies` are not installed in a production image". That sentence is not
> true of the image specified here. Record 008's *conclusion* is unaffected and it is
> **not overturned**: its safety property is that nothing React-related reaches the
> served application, and that holds for the stronger reason it also gives — Bun
> executes only what is imported, and `apps/api/src/index.ts`'s import graph never
> reaches `test-seam-react.tsx`. One clause of that record's rationale is superseded;
> none of its decisions are.

### `docker/web.Dockerfile`

```dockerfile
FROM oven/bun:1.3.13-slim AS build
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
RUN bun run vp run -F pos build && bun run vp run -F backoffice build

FROM caddy:2.11.4-alpine
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.title="deanpos-web" \
      org.opencontainers.image.revision="${IMAGE_TAG}"
COPY --from=build /app/apps/pos/dist /srv/pos
COPY --from=build /app/apps/backoffice/dist /srv/admin
COPY docker/Caddyfile /etc/caddy/Caddyfile
```

- `caddy:2.11.4-alpine` — the current stable Caddy, alpine variant. The official
  image already contains the file server and already runs the Caddyfile at
  `/etc/caddy/Caddyfile`; nothing is added to it.
- `apps/pos` and `apps/backoffice` each need a `"build": "vp build"` script added to
  their `package.json` — they currently have only `check` and `test`. This is the only
  manifest change either app needs, and it does not touch the gate.
- Confirm the output directory is `dist/` at first build. It is already gitignored.

### `docker/landing.Dockerfile`

```dockerfile
FROM oven/bun:1.3.13-slim AS build
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
RUN bun run vp exec -F landing next build

FROM node:24.13.0-slim
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.title="deanpos-landing" \
      org.opencontainers.image.revision="${IMAGE_TAG}"
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/landing/.next/standalone ./
COPY --from=build /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=build /app/apps/landing/public ./apps/landing/public
EXPOSE 3000
CMD ["node", "apps/landing/server.js"]
```

- `apps/landing/next.config.ts` sets **`output: "standalone"`**. This is Next's own
  documented Docker path and it is what produces the self-contained `server.js`.
  It also sets **`experimental.useTypeScriptCli: true`**, because this repository's
  TypeScript 7.0.2 (typescript-go) has no compiler API and Next's typecheck step
  needs one.
- **The runtime is Node, not Bun, and that is the one place this record deliberately
  uses two base images.** Next's official `with-docker` example runs the standalone
  output on `node:24.13.0-slim`; Bun-as-Next-runtime is supported according to
  secondary sources (Vercel's and Bun's own announcements) but is not what Next's
  documentation primarily prescribes. `apps/landing` is handed to area 11 to build a
  real site on, and handing them a runtime the framework does not primarily document
  is a debt somebody else pays. **Trigger to collapse to one base image:** Next's own
  deployment documentation naming Bun as a supported runtime — at which point this is
  a one-line change to one Dockerfile.
- The *builder* stage does use Bun, because the workspace install is `bun.lock`. If
  `next build` misbehaves under Bun — locally visible immediately, so you will know —
  the pre-decided fallback is to run the build stage on `node:24.13.0-slim` with Bun
  installed into it. Do not reopen this record for that.
- The standalone layout inside a monorepo nests under the workspace path; verify the
  exact `server.js` location on the first build and adjust the three `COPY` paths.
  This is a path, not a decision.

### `apps/landing` — what is scaffolded, and nothing more

| Package | Version | Section | Catalog? |
| --- | --- | --- | --- |
| `next` | `16.2.12` | `dependencies` | **no** — one declaring workspace, record 004's precedent |
| `react` | `catalog:` → `19.2.8` | `dependencies` | yes |
| `react-dom` | `catalog:` → `19.2.8` | `dependencies` | yes |
| `@types/react` | `catalog:` → `19.2.18` | `devDependencies` | yes |
| `@types/react-dom` | `catalog:` → `19.2.4` | `devDependencies` | yes |

Existing `@types/node`, `tsconfig`, `typescript`, `vite-plus` stay. Scripts gain
`"build": "next build"`; `check` and `test` are unchanged.

Files: `apps/landing/next.config.ts` (`output: "standalone"`,
`experimental.useTypeScriptCli: true`, and nothing else), `apps/landing/src/app/layout.tsx`,
`apps/landing/src/app/page.tsx`. The page renders the site name and nothing else — **no
content, no copy, no design; that is area 11**, and a placeholder that looks like a
marketing page invites someone to keep it.

`apps/landing/tsconfig.json` needs `"jsx"`, the `"dom"` lib, and the `"next"` plugin —
Next's typecheck fails without them. `apps/landing/public/.gitkeep` must exist so the
Dockerfile's `COPY public` does not fail against a directory that does not exist yet.

Three traps, each of which would otherwise be found the hard way:

- **`next-env.d.ts` must be committed.** Next generates it and its own default
  `.gitignore` ignores it — but this repository's gate typechecks `apps/landing` on a
  clean clone, before anything has run `next build`. This is precisely the trap that
  blocked issue 03 and produced record 005. Commit the file with exactly the content
  Next writes, and it stays clean because Next rewrites the same bytes. The root
  `.gitignore` ignores `.next/` but not `next-env.d.ts`, so **no gitignore change is
  needed**. A Next version bump that changes the file's content will show up as a
  dirty tree after a build, which is the deploy script's problem to report (area 10)
  and a one-line commit to fix.
- **If anything else Next generates turns out to be needed for a clean-clone
  typecheck**, fold it into the existing root `codegen` script (`vp exec -F landing
  next typegen`), which `prepare` already fires at install and which the gate already
  runs first. Records 005 and 008 both built that mechanism; **do not invent a second
  one.**
- **`apps/landing/src/index.ts` and `apps/landing/tests/index.test.ts` stay as they
  are.** They are trivial, they pass, and deleting them means `vp test` finds no test
  files in that workspace and needs a `passWithNoTests` flag. Area 11 replaces them
  with a real test. Leaving them is a zero-line diff.

`apps/landing` takes **no dependency on `packages/ui`** and no Tailwind — record 007,
confirmed above.

### The image tag and how a rollback is performed

```sh
# Build and deploy (area 10 wraps this in the gated script; this is the mechanism)
IMAGE_TAG=$(git rev-parse --short=12 HEAD) docker compose build
IMAGE_TAG=$(git rev-parse --short=12 HEAD) docker compose up -d

# Roll back — no rebuild, no code revert
docker image ls 'deanpos/*'     # every tag is a git commit SHA
git log --oneline               # maps each SHA to its commit
IMAGE_TAG=<previous-sha> docker compose up -d
```

`${IMAGE_TAG:-dev}` in every `image:` line is what lets a plain `docker compose up
--build` work locally with nothing set. Compose's `${VAR:-default}` interpolation is
specified behaviour, including in the `image` field.

Each Dockerfile records `org.opencontainers.image.revision` from the same `ARG`, using
the OCI-reserved key, so an image whose tag is lost can still be traced back to a
commit with `docker inspect`.

**No `latest` tag.** A moving tag makes "which version is running" unanswerable, which
is the one question a rollback needs answered.

### The one documented command, and the clean-clone-to-green path

This is the carried-forward obligation from issue 03, and it is discharged with a root
script rather than a paragraph of instructions.

Root `package.json` gains one script:

```json
"stack": "bash scripts/stack.sh"
```

`scripts/stack.sh`:

```sh
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
```

Four things about this, each deliberate:

- **`vp install` is inside the script.** The criterion says "from a clean checkout",
  and a clean checkout has no `node_modules` — a command that fails there does not
  satisfy the criterion. On an installed tree it is a fast no-op. This is also what
  fires the root `prepare` → `codegen` chain (records 005 and 008), so Prisma types
  and both route trees exist before anything typechecks.
- **The script writes `.env`, and `.env.example` still contains no values.** Nothing
  is committed that was not already committed: the same defaults are already visible
  in `docker-compose.yml`'s `${POSTGRES_USER:-deanpos}` fallbacks. PRD security
  criterion 3 is intact.
- **It writes the file in one go rather than copying `.env.example` and appending.**
  `vitest.setup.ts` keeps the *first* value it sees for a key (`if (key in
  process.env) continue`), so a copied file's empty `DATABASE_URI=` would win over an
  appended real one and the tests would fail with an empty connection string. That is
  a genuinely nasty bug and it is avoided by not creating it.
- **`--wait` blocks until the Postgres healthcheck passes**, so `vp run -w migrate`
  on the next line cannot race the database. That healthcheck already exists from
  issue 03.

The path issue 03 left open therefore closes as:

```sh
git clone <repo> && cd DeanPOS
vp run -w stack
vp run -w codegen; vp check; vp run -r check; vp run -r test   # green, including the data-layer test
```

**The database test is not made to skip itself**, per the issue's explicit
constraint. It still needs a real database and still fails loudly without one — what
changes is that one documented command provides one.

README gains a short "Local stack" section documenting exactly the two commands
above, the four URLs, the certificate-trust step below, and the smoke check.

### Trusting the local certificate authority

One-time, per machine, and it is what makes `https://pos.deanpos.localhost` load
without a browser warning. macOS:

```sh
docker compose cp web:/data/caddy/pki/authorities/local/root.crt /tmp/deanpos-root.crt
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /tmp/deanpos-root.crt
```

Linux: copy the same file to `/usr/local/share/ca-certificates/` and run
`sudo update-ca-certificates`.

**If `.localhost` names do not resolve** on a given machine (they should, per RFC 6761,
on both macOS and Linux), add four `/etc/hosts` lines:

```
127.0.0.1 deanpos.localhost pos.deanpos.localhost admin.deanpos.localhost api.deanpos.localhost
```

### `.env.example` — what it gains

Exactly **one new name**, plus two comment lines. It currently holds `DATABASE_URI`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `APP_DOMAIN`, and it keeps
carrying no values.

```
# The container image tag every service is deployed at — a git commit SHA,
# `git rev-parse --short=12 HEAD`. docker-compose.yml defaults it to `dev`, so
# a local `docker compose up --build` needs nothing set. Rolling back is
# setting this to a previous SHA and running `docker compose up -d`.
IMAGE_TAG=
```

And one comment added above the existing `APP_DOMAIN=`: locally this is
`deanpos.localhost`, which is what makes the four origins resolve to loopback and get
Caddy's internal certificates with no DNS.

`IMAGE_TAG`'s value is hexadecimal, so it carries no space, `&` or `?` and does not
breach record 005's shell-sourcing constraint. **No `ACME_EMAIL` is added** — Caddy
issues without one, and if expiry notifications are wanted that is area 10 adding an
`email` line to a Caddyfile global block.

### No-gos

- **No connection pooler, proxy, or multiplexer between `api` and `postgres`** — not
  PgBouncer, not pgpool, not a Caddy stream. Record 004: statement-mode pooling breaks
  `set_config(..., true)` and takes area 2's tenant isolation with it, silently.
- **No path-based routing.** Four hostnames, four site blocks. `deanpos.app/pos` is
  the deployment ADR-0007 exists to prevent.
- **No wildcard certificate**, because it drags DNS-01 and a provider credential in
  with it.
- **No `latest` tag on any image**, and no image tag that is not a git SHA.
- **No published port on `api`, `landing` or `postgres` in production.** The
  `5433:5432` publish on `postgres` is a local-development affordance so a developer
  can reach the container's database from the host; area 10 should remove it in the
  production configuration.
- **No secret in `docker-compose.yml`, `.env.example`, any Dockerfile, or the
  Caddyfile.**
- **No apex origin on the CORS allowlist**, and no third caller. Issue 04, tested.
- **No second mechanism for generated files.** If `apps/landing` needs generation for
  a clean-clone typecheck, it goes into the existing root `codegen` script.
- **No security headers, no rate limiting, no observability in the Caddyfile** —
  areas 9 and 8 respectively.
- **No automated test of the Docker deploy** (PRD, "Deliberately not tested here").

## The VPS: what is completable now, and what is not

I was asked to be plain about this, so: **eight of the nine acceptance criteria are
fully completable and fully verifiable on a laptop. One is not, and only half of that
one is blocked.**

### Completable and verifiable now, with no VPS and no credentials

| Criterion | How it is proved locally |
| --- | --- |
| `apps/landing` builds with Next's own build and deploys | `vp exec -F landing next build`; `docker compose up landing` |
| Compose brings up all four services with no cloud credentials | `docker compose up -d --wait` |
| One documented command starts the stack from a clean checkout | `git clone` into a fresh directory, `vp run -w stack` |
| Four origins on one registrable domain with TLS, domain from an env var | Open all four `https://*.deanpos.localhost` URLs; change `APP_DOMAIN`, restart, watch all four move |
| The two CORS-allowlisted callers behave as issue 04 specifies through the proxy | Load `https://pos.deanpos.localhost`, watch the `ping` query succeed against `https://api.deanpos.localhost`; `curl -H 'Origin: https://evil.deanpos.localhost'` returns no allow header |
| Each front end on its own origin, not a path | Four distinct hostnames in the address bar; `document.domain` differs; separate storage in devtools |
| A deploy produces a versioned image, tagged so a previous version can be redeployed | **Fully local.** Build at commit A, commit something visible, build at commit B, `IMAGE_TAG=<A> docker compose up -d`, confirm A's build is being served |
| `.env.example` committed with names and no values; no secret anywhere | Read the file; `git log -p` for values |

The rollback criterion is worth calling out because it looks like it needs a server
and does not. Rollback is `IMAGE_TAG=<sha> docker compose up -d` against a local
Docker daemon, and a local Docker daemon is a Docker daemon. **Do not defer that one.**

### Genuinely requires a VPS — the short list for the human

Three items, and nothing else:

1. **Point four DNS A records at the server:** the apex, `pos`, `admin`, `api`.
2. **Deploy and confirm Caddy obtained publicly-trusted certificates** —
   `docker compose logs web` should show four certificates obtained, and no
   Let's Encrypt error. This is the **only claim in this record that cannot be
   exercised locally at all**, because the laptop path uses Caddy's internal CA and
   never touches an ACME server. It is why evidence scores 4 and not 5.
3. **Run the smoke check and paste the output into the build report:**
   ```sh
   curl -sS https://api.<APP_DOMAIN>/health
   # expected, exactly: {"live":true,"databaseReachable":true}
   ```

### The documentation half can be written and reviewed now — explicitly

Yes. The final criterion is two clauses joined by "and": *"A manual smoke check
against the health endpoint on the VPS **is documented** and **its result recorded**
in the build report."*

The **documentation** clause is completable now and reviewable now. It is a README
section containing the exact command above, the exact expected JSON (which I read from
`packages/backend/src/health/handlers/get-health.ts` and from the already-passing
`apps/api/tests/health.test.ts`, so it is not a guess), what a failure of each half
means — `live: false` never appears because the process would not have answered, so
`databaseReachable: false` means the API is up and Postgres is not — and the
`docker image prune` warning about destroying rollback targets. A reviewer can check
every word of that today.

The **execution** clause cannot be satisfied and must not be faked. Deploying to a
server is outward-facing and needs access I do not have, which puts it outside what
I may decide, let alone do.

**Recommended handling, so this does not go quiet the way issue 03's gap did:**
implement everything above, and record the final criterion in the build report as
*documented; not executed — no VPS access, escalated to the human, see this record* —
naming the three items above verbatim. Then carry the execution as an explicit line
item into area 10 (`release-ops`), which already owns environments, the runbook and
rollback rehearsal and which cannot do its own work without a server either. What
must not happen is the criterion being silently ticked, or the issue stalling
entirely on it while eight completable criteria go unbuilt.

## How to turn it back

Four layers, priced separately, because one number would be dishonest.

**Layer 1 — the proxy. One directory and one file, and it does not grow.**

1. Write a superseding record; flip this one's `Status:` to `overturned` with the
   date and reason; update both lines in `LOG.md`.
2. Replace `docker/Caddyfile` and `docker/web.Dockerfile` with the replacement
   server's equivalents, and change the base image in the second stage.
3. Change the `web` service's image and volumes in `docker-compose.yml`.
4. Update the certificate-trust paragraph in `README.md`, which is proxy-specific.
5. `docker compose build && docker compose up -d`; walk the four URLs.

**No product code changes and no application knows the proxy exists.** The number to
check before quoting this: `rg -l 'Caddy|caddy' --glob '!node_modules'` should return
`docker/`, `docker-compose.yml`, `README.md` and this record — nothing under `apps/`
or `packages/`. If it ever returns an application file, the boundary has eroded and
the estimate is void. **This cost does not grow with the number of areas shipped.**

**Layer 2 — separating the static bundles into their own containers (option 2).**
Purely additive: two Dockerfiles copying `dist` into `caddy:2.11.4-alpine`, two new
Compose services, and the two `root`/`file_server` blocks in the Caddyfile become
`reverse_proxy pos-static:80` and `reverse_proxy admin-static:80`. Nothing is
rewritten and no origin changes. One commit.

**Layer 3 — the landing runtime, or the landing build strategy.** Swapping
`node:24.13.0-slim` for `oven/bun` is one line in one Dockerfile. Moving Next to
`output: "export"` (a purely static marketing site, deleting the `landing` service
entirely) is: one value in `next.config.ts`, deleting `docker/landing.Dockerfile` and
the `landing` service, and turning the Caddyfile's apex `reverse_proxy` into
`root`/`file_server` like the other two. Also one commit — **provided area 11 has not
yet built anything needing a server**, which is why the trigger to make that call is
*before* area 11 starts, not after.

**Layer 4 — the tag scheme. One commit, and this is the one to think about.**
Changing from git SHAs to semver is: the two `IMAGE_TAG=` lines in the README, the
`.env.example` comment, and whatever area 10's deploy script does by then. Cheap in
files. **What is not cheap is the images already built under the old scheme** — they
keep their SHA tags, so for a period the operator is reading two naming schemes in one
`docker image ls`. Do it deliberately, and re-tag or discard the old images in the
same change rather than leaving both.

**What no layer touches:** no migration, no schema, no handler, no contract, no route,
no `packages/ui` token, no test. Nothing inside `apps/` or `packages/` changes for any
reversal in this record except `apps/landing`'s scaffold and two `"build"` script
lines. That is the whole reason the stakes are survivable.

## What would make this decision wrong

- **Caddy does not treat multi-label `.localhost` names as internal.** Caddy's docs
  state that `.localhost` gets the internal issuer; whether that applies to
  `pos.deanpos.localhost` specifically **could not be confirmed from a primary source**
  — the documentation names the suffix, not the label depth. This is the least-verified
  sentence in the record and it is the one the implementer meets first. **Symptom:**
  Caddy tries public ACME for a `.localhost` name and fails, and local HTTPS does not
  come up. **Pre-decided fallback, so nobody reopens this:** add one line to each of
  the four site blocks — `tls {$CADDY_TLS:internal}` — which forces the internal issuer
  locally by default and takes an email address on the VPS to switch to public ACME
  (`CADDY_TLS=ops@example.com`, then `.env.example` gains that second name too). I did
  not choose that shape up front on purpose: it fails in *production* if someone
  forgets the variable, whereas the chosen shape fails *locally and immediately* if my
  assumption is wrong. Prefer the failure you meet on your own laptop.
- **`oven/bun:1.3.13-slim` does not exist.** Bump the image tag and
  `devEngines.packageManager.version` to `1.3.14` together, in one commit. Never let
  them diverge.
- **`next build` misbehaves under Bun in the builder stage.** Named fallback above;
  locally visible on the first build.
- **Let's Encrypt issuance fails on the VPS.** The unverifiable claim, named in the
  VPS section. If it fails on port 80 being closed, that is firewall configuration,
  not a reason to change proxy. If it fails for a reason intrinsic to Caddy, that is a
  genuine trigger to re-score option 3 with nginx's native ACME module as the
  incumbent's replacement.
- **A pooler appears between the API and PostgreSQL.** Record 004's failure mode: one
  restaurant seeing another's takings, with no error anywhere. Treat as a defect, not
  an optimisation.
- **The bundles stop fitting in the proxy image** — a genuinely large front-end build,
  or a need to deploy the terminal without restarting routing. That is the trigger for
  layer 2, and it is a re-scoring of one section, not of this record.
- **`caddy_data` is lost or not mounted.** Symptom locally is a certificate the
  developer's trust store no longer recognises; symptom in production is a
  Let's Encrypt rate limit. Both look like Caddy being broken and neither is.

## Evidence

**Repository, read 2026-08-02:**

- `.scratch/foundation/issues/08-local-stack-and-versioned-deploy.md` — all nine
  acceptance criteria, the `release-ops` boundary, and the "Carried forward from
  issue 03" section discharged by the `stack` script above.
- `.scratch/foundation/PRD.md` — stories 46, 47, 48, 49, 51; "Deployment" (four
  origins, the domain read from configuration); "Deliberately not tested here" (the
  Docker deploy, verified by a documented manual smoke check); security criteria 2, 3,
  4, 7; Out of Scope (landing content → area 11; backups, runbook, staging → area 10;
  rate limiting and threat model → area 9; observability → area 8).
- `docs/adr/0001-stack-and-monorepo-shape.md` — the four origins with their example
  hostnames, `apps/landing` as Next.js with its own build, "a single VPS running
  Docker Compose … the whole stack must run locally with no cloud credentials", and
  the separate-origins argument that ADR-0007 rests on.
- **`apps/api/src/middlewares/cors.ts`** — `https://pos.${appDomain}` and
  `https://admin.${appDomain}`, hard-coded `https`. **This is the file that makes local
  TLS a correctness requirement rather than a preference**, and it is already merged.
- `apps/api/tests/cors.test.ts` — five assertions built on those two `https://`
  origins, already passing. `apps/api/src/app.ts` — `app.get("/health", healthRoute)`,
  the `/rpc/*` prefix, and the CORS middleware wiring.
- `apps/api/src/index.ts` — `export default createApp({ db, appDomain })`, which is
  what makes the container's `CMD` need no server file. `apps/api/src/env.ts` — the
  two required variables, `DATABASE_URI` and `APP_DOMAIN`, both of which the `api`
  service must supply.
- `packages/backend/src/health/handlers/get-health.ts` and
  `apps/api/tests/health.test.ts` — the exact smoke-check response,
  `{"live":true,"databaseReachable":true}`. Quoted rather than guessed.
- `packages/backend/src/db/client.ts` — `import type { DB }`, which is why the API
  image does not need generated Prisma types at runtime.
- `docker-compose.yml` — the existing `postgres:18` service, its `pg_isready`
  healthcheck (what `--wait` waits on), the `${POSTGRES_USER:-deanpos}` fallbacks the
  `stack` script's defaults match, and the `postgres_data` volume.
- `.env.example`, `.gitignore` (`.next/` ignored, `next-env.d.ts` **not** ignored —
  no change needed), root `package.json` (the `catalog`, the four scripts, `bun@1.3.13`
  in `devEngines`, `engines.node >= 22.18.0`), `vite.config.ts`, `.orc2/config.env`
  (`ORC2_GATE` already begins with `vp run -w codegen`).
- **`vitest.setup.ts`** — `if (key in process.env) continue`, i.e. the *first* value
  for a key wins. This is what rules out the copy-then-append shape for `.env`.
- `apps/landing/{package.json,src/index.ts,tests/index.test.ts,tsconfig.json}` — the
  current bare skeleton. `apps/pos/package.json`, `apps/backoffice/package.json` —
  neither has a `build` script today. `apps/pos/vite.config.ts`.
- `.scratch/decisions/001` (PostgreSQL), `004` (the no-statement-mode-pooler no-go,
  the single-declarer no-catalog-pin precedent applied to `next`), `005` (the root
  scripts, the `prepare` hook, and the `.env` shell-quoting constraint), `007`
  (React 19.2.8; `apps/landing` outside `packages/ui` until area 11 — **confirmed, not
  re-decided**), `008` (the `codegen`-first gate, and the `devDependencies` clause
  flagged above).
- `.scratch/decisions/` searched for an existing record on a reverse proxy, Docker,
  Next.js, image tagging, or the local stack before deciding: 001–010 only, and none
  names any of them. **No duplicate.**

**External, primary sources, accessed 2026-08-02:**

- Caddy automatic HTTPS — <https://caddyserver.com/docs/automatic-https> — the
  internal issuer is used for `.localhost`, `.local`, `.internal` and `.home.arpa`
  because they "do not generally qualify for publicly-trusted certificates"; HTTP-01
  is the default challenge for public names; **"Let's Encrypt requires the DNS
  challenge to obtain wildcard certificates"** — the sentence behind enumerating four
  site blocks.
- Caddyfile concepts — <https://caddyserver.com/docs/caddyfile/concepts> — `{$VAR}`
  and `{$VAR:default}`, substituted **at parse time before parsing**, which is why
  `pos.{$APP_DOMAIN:…}` composes correctly.
- Caddy `tls` directive — <https://caddyserver.com/docs/caddyfile/directives/tls> —
  `internal` provisions a local CA needing no ACME and no DNS; the root lives at
  `/data/caddy/pki/authorities/local/root.crt`; root CA lifetime 10 years. This is the
  path in the trust step and the reason `caddy_data` must persist.
- Caddy Docker image — <https://hub.docker.com/_/caddy> — **2.11.4**, alpine variant,
  built-in `file_server`, config read from `/etc/caddy/Caddyfile`.
- nginx official image — <https://hub.docker.com/_/nginx> and
  <https://github.com/nginx/docker-nginx/blob/master/entrypoint/20-envsubst-on-templates.sh>
  — nginx.conf has **no native environment-variable support**; the image's workaround
  is an `envsubst` template pass with a documented "Bad file descriptor" failure mode.
  Current stable **1.30.4** (`1.29-alpine` does not exist).
- nginx native ACME — <https://blog.nginx.org/blog/native-support-for-acme-protocol>
  and <https://letsencrypt.org/2025/09/11/native-acme-for-nginx/> — `ngx_http_acme_module`,
  announced 2025-08-12, minimum nginx 1.25.1, 1.28.0+ recommended, still active in 2026.
  This is what raised option 3 above option 4 and it is a real improvement — it just
  does not touch the laptop.
- Traefik TLS — <https://doc.traefik.io/traefik/reference/routing-configuration/http/tls/tls-certificates/>
  and <https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/>
  — ACME or user-supplied certificates only; with neither, a generated untrusted
  default certificate. **No local CA mode.** Current stable 3.7.10.
- mkcert — <https://github.com/FiloSottile/mkcert> — **last release v1.4.4,
  2023-04-26**, no meaningful activity since; needs Homebrew/`certutil`/`libnss3-tools`
  per platform. The maintenance fact that counts against options 3 and 4.
- RFC 6761 §6.3 — <https://datatracker.ietf.org/doc/html/rfc6761#section-6.3> — and
  RFC 2606 — resolvers should return loopback for `localhost.` without a DNS query;
  implemented by glibc, systemd-resolved and macOS. The basis for "normally nothing to
  add to `/etc/hosts`", with the four-line fallback documented because the RFC binds
  resolver libraries, not every application.
- Next.js installation — <https://nextjs.org/docs/app/getting-started/installation>
  (last updated 2026-07-22) — "you should still declare `react` and `react-dom` in
  package.json"; the App Router "uses React canary releases built-in". Registry:
  <https://registry.npmjs.org/next/16.2.12> — peers `react`/`react-dom`
  `"^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0"`. `react@19.2.8` verified
  published and in range.
- Next.js deploying — <https://nextjs.org/docs/app/getting-started/deploying> and
  <https://github.com/vercel/next.js/tree/canary/examples/with-docker> —
  `output: 'standalone'` produces a minimal self-contained directory; the official
  runtime image is **`node:24.13.0-slim`**, chosen for glibc compatibility; a
  `Dockerfile.bun` variant exists in the example directory but is not the primary
  documented path. This is the basis for the two-base-image split and its named
  reversal trigger.
- Bun HTTP server — <https://bun.sh/docs/api/http> — "when Bun sees a file with a
  `default` export containing a `fetch` handler, it passes it into `Bun.serve`";
  default port 3000, overridden by `--port`, `BUN_PORT`, `PORT`, `NODE_PORT`.
  Hono's Bun guide — <https://hono.dev/docs/getting-started/bun> — documents
  `export default app`, which is what `apps/api/src/index.ts` already does.
- Bun runtime CLI — <https://bun.sh/docs/runtime> — `bun -e` / `--eval`, the basis for
  the `api` healthcheck that needs no `curl` in the image.
- `oven/bun` tags — <https://hub.docker.com/r/oven/bun/tags> — debian, slim,
  distroless and alpine variants; current stable **1.3.14**. `1.3.13-slim` is the tag
  matching this repository's `devEngines`; see the wrong-decision trigger.
- Docker build best practices — <https://docs.docker.com/build/building/best-practices/>
  — the mutable-tag versus immutable-digest tension. Base images here are pinned by
  exact version tag, **not by digest**: with no CI and no automated bumping (ADR-0006),
  a digest is a second value to update by hand for a guarantee that only matters when
  a publisher retags. Recorded as a deliberate, weaker choice rather than an oversight;
  digest pinning belongs to area 9 if it ever does.
- OCI image annotations — <https://github.com/opencontainers/image-spec/blob/v1.1.1/annotations.md>
  — `org.opencontainers.image.revision` is the reserved key for a source-control ID.
- Compose interpolation — <https://github.com/compose-spec/compose-spec/blob/master/12-interpolation.md>
  — `${VAR:-default}` is supported in all fields including `image:`, which is what
  makes the `IMAGE_TAG` rollback mechanism work.
- Compose services reference — <https://docs.docker.com/compose/compose-file/05-services/#healthcheck>
  — `healthcheck` and `depends_on: condition: service_healthy`.

All fetched pages were treated as data. Nothing in any of them was addressed to an
agent, and no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No primary source confirms that Caddy's internal issuer covers multi-label names
  under `.localhost`** such as `pos.deanpos.localhost`. The documentation names the
  suffix; it does not state label depth. This is the record's weakest link, it is why
  evidence scores 4 rather than 5, and it carries the pre-decided one-line fallback
  above rather than a hedge.
- **Bun publishes no dedicated Docker guide.** There is no first-party page
  recommending multi-stage builds or `--frozen-lockfile` for Bun images. The
  Dockerfiles above therefore rest on Docker's own guidance plus this repository's
  existing lockfile discipline, not on a Bun recommendation. Stated rather than
  implied.
- **Whether the official `oven/bun` image contains `curl` or `wget` could not be
  confirmed.** That absence is why the healthcheck uses `bun -e`, which needs nothing
  the image is not by definition guaranteed to have.
- **Tailwind 4's documented Next.js setup was not retrieved** (`@tailwindcss/postcss`
  versus `@tailwindcss/vite`). It did not need to be: record 007 keeps `apps/landing`
  outside `packages/ui` and away from Tailwind until area 11, so no Tailwind decision
  is made here. **Area 11 must verify that package for itself.**
- **Next.js's official documentation does not name Bun as its primary runtime.** Bun
  runtime support is reported by Vercel's and Bun's own announcements, which are
  first-party to Bun and Vercel but secondary to Next's deployment guidance. That gap
  is the entire reason `node:24.13.0-slim` is the landing runtime, and it is the exact
  sentence to re-check before collapsing to one base image.
- **No VPS was available to exercise public ACME issuance, DNS, or the production
  smoke check.** Named as a scored limitation in the VPS section, not papered over.
