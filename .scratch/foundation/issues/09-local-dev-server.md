# 09 — One command runs every app against local PostgreSQL

**Status:** ready-for-agent

## What to build

A developer runs one command and gets every application serving, with hot reload, against the
PostgreSQL already installed on their machine. No Docker, no reverse proxy, no TLS, no
certificates to trust.

Issue 08 built the *deployment* stack — four origins behind Caddy with TLS, everything in
containers. That is the right shape for production and the wrong shape for the inner loop: a
container rebuild between edit and refresh is the cost that makes people stop running the
thing they are building.

**Copy `../Fashio`'s pattern, do not design it.** Its root `package.json` carries
`"dev": "vp run -r --parallel dev"`, and each workspace that has something to serve declares
its own `dev` script. `vp` already knows how to run workspace tasks in parallel; this issue is
mostly wiring, not invention.

Four things run: `apps/api` (Bun, serving Hono), `apps/pos`, `apps/backoffice` (both Vite+),
and `apps/landing` (Next's own dev server). Each on its own port on `localhost`.

**The database is the local PostgreSQL, and that is deliberate.** `DeanPOS_dev` already exists
and already carries the migrations. A developer's inner loop should read the data they have
been looking at, not a container's empty volume. The Compose `postgres` service stays where
issue 08 put it — for the deployment stack and for anyone without a local install — but
`vp run dev` does not use it.

**The API is not proxied in development.** Both front ends read their API base URL from
`VITE_API_URL` and call it directly. In production that value points at `https://api.<domain>`
and Caddy is in front; in development it points at `http://localhost:<api-port>` and nothing
is. This is the one place the two environments genuinely differ, so it is the one place a
variable is the right answer.

Both front ends currently derive their base URL from `VITE_APP_DOMAIN`
(`https://api.${import.meta.env.VITE_APP_DOMAIN}/rpc`), which was a placeholder issue 06 left
pointing here. Replace it with `VITE_API_URL`.

## The part that needs deciding before it is built

**Development origins are not on the CORS allowlist.** `apps/api` builds its allowlist from
`APP_DOMAIN` as exactly `https://pos.<domain>` and `https://admin.<domain>` — that is issue
04's work, it is asserted by a test, and security criterion 1 says a wildcard or an
origin echoed from the request fails review. A front end served from `http://localhost:5173`
is not on that list and will be refused.

**Do not widen the allowlist to make this work, and do not echo the request's origin.** How
development origins are admitted without weakening the production default is an open question
and goes to the `decider` before any code assumes an answer. It is genuinely open — reading
the allowlist from configuration, adding a separate development-only variable, and binding the
front ends to the `.localhost` names Caddy already issues certificates for are all plausible,
and they have different consequences for what ships.

## Acceptance criteria

- [ ] One documented command from the repository root starts `apps/api`, `apps/pos`,
      `apps/backoffice`, and `apps/landing` together, following `../Fashio`'s
      `vp run -r --parallel dev` pattern.
- [ ] Every workspace with something to serve declares its own `dev` script; the root script
      only fans out.
- [ ] The stack runs against the **local** PostgreSQL — `DeanPOS_dev` by default, read from
      `DATABASE_URI`. **No Docker is required to run `dev`.**
- [ ] Both front ends read their API base URL from **`VITE_API_URL`**, and no longer derive it
      from `VITE_APP_DOMAIN`. The variable is in `.env.example` with a name and no value.
- [ ] The API is reached **directly** in development — no reverse proxy, no TLS, no
      certificate to trust.
- [ ] Editing a file in `apps/pos` or `apps/backoffice` hot-reloads that app without
      restarting the others.
- [ ] A cross-origin call from a development front end to the development API **succeeds**,
      by whatever mechanism the `decider` settles — **and issue 04's CORS test still passes
      unchanged**, proving the production allowlist was not widened to buy it.
- [ ] `README.md` documents the development command alongside issue 08's stack command, and
      says plainly which is for which — a developer should not have to guess whether to run
      Docker.
- [ ] The gate stays green, and `vp run dev` is not required for it to pass.

## Depends on

- 06 — Terminal shell (`apps/pos`) rendering ping, and the test seam
- 07 — Back-office shell (`apps/backoffice`) rendering ping
- 08 — Local stack, four origins, and a versioned deploy (owns `apps/landing`, `.env.example`,
  and the `README` sections this issue sits beside)

## Relevant files

- `package.json` (root `dev` script), `apps/*/package.json`
- `apps/pos/src/lib/orpc.ts`, `apps/backoffice/src/lib/orpc.ts` — the `VITE_API_URL` change
- `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/src/middlewares/cors.ts`
- `.env.example`, `README.md`

## Comments

_Filed 2026-08-02 at the developer's request, during the `foundation` run and after issue 08
was implemented. The gap it names is real: issue 08 delivered a deployment stack and there is
no inner loop beside it._

_Scope note: this is developer experience, not a product surface. It adds no procedure, no
screen, and no table. The one production-visible change is `VITE_API_URL` replacing the
`VITE_APP_DOMAIN`-derived base URL — which issue 06 left as an acknowledged placeholder
pointing at exactly this work._

_Verification 2026-08-02, record 012 §5's two unresolved questions: `vp run -r --parallel dev`
does **not** work here — `-r` self-selects the workspace root (which itself declares a `dev`
script that runs `vp run -r --parallel dev`), so the command recurses into itself and fails
with spawn errors. Reproduced repeatedly, independent of cache state, and confirmed against
`../Fashio` running the identical command shape without the same root-level `dev` name
collision. Applied record 012's pre-decided fallback verbatim: the explicit `-F api -F pos
-F backoffice -F landing` filter form, which never selects root. Ran the real root `dev`
script end to end against the lane database: all four origins responded, CORS admitted
`http://localhost:5173` and refused `attacker.example.com`, and `-F` filtering silently
omitted `packages/*` (no `dev` script) rather than erroring — confirming record 012's other
prediction. Separately observed that killing the top-level `vp run` process with `SIGTERM`
does not reliably terminate the spawned Vite/Next child processes; the README's documented
`lsof -ti:... | xargs kill` fallback is therefore load-bearing, not just precautionary._

_Fix pass 2026-08-02, two minor findings taken despite the reviewer passing the issue:
`apps/api/tests/cors-dev-origins.test.ts`'s echo test now also asserts a production origin
(`https://pos.<appDomain>`) is still echoed back with `devOrigins` set, converting additivity
from review-guarded to test-guarded. Proved it bites: temporarily changed `app.ts`'s spread to
`devOrigins.length ? devOrigins : allowedOrigins(appDomain)` (replace-semantics), the new
assertion failed with `expected null to be 'https://pos.deanpos.test'`, then reverted `app.ts`
exactly — `git diff` against the prior commit is empty, and `cors.ts`, `index.ts`, and
`cors.test.ts` remain zero-line diffs against `main`. Test count stayed at 10 because the
assertion went inside the existing test rather than a new one. Separately, copied record 012
from `main` (it never landed in this lane) and amended it: section 4's root `dev` script is now
the `-F` filter form as primary, with a note that `-r` is not usable when the root workspace
itself declares a `dev` script — it recurses into itself — and an `**Amended 2026-08-02**`
paragraph after the front matter records that this was found by running it, not by preference.
Gate green: `vp run -w codegen`, `vp check`, `vp run -r check`, `vp run -r test` (10/10
workspaces, `apps/api` at 10 tests)._

_Port change 2026-08-02: moved to the 600x range at the developer's request — `apps/api`
6001, `apps/landing` 6002, `apps/pos` 6003, `apps/backoffice` 6004. `6000` itself is skipped:
it's on Chromium's and Firefox's restricted-port list (X11), so a browser `fetch` to it fails
outright with `ERR_UNSAFE_PORT`, which would break the API for every front end. Updated
`apps/api/src/dev.ts`, both Vite configs, `apps/landing/package.json`, `.env.example`,
`scripts/stack.sh`, `README.md`, and `apps/api/tests/cors-dev-origins.test.ts`. Left the
deployment stack's internal `localhost:3000` (docker-compose.yml's `api` health check) alone
— that's the container's own port, unaffected by the dev loop. Re-ran the fan-out end to end:
all four origins responded, `Origin: http://localhost:6003` got its own origin echoed back,
`attacker.example.com` still got no header. `cors.ts`, `index.ts`, and `cors.test.ts` remain
zero-line diffs. Gate green._
