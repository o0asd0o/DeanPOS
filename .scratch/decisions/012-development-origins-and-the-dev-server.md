# 012: Development front ends are admitted by an entry point the production image never runs

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** `.scratch/foundation/issues/09-local-dev-server.md` ("The part that needs deciding
  before it is built"), and `.scratch/foundation/PRD.md` ("Development runs beside the deployment
  stack, not through it")

## The question

A developer's front end runs on a plain `http://localhost` port. The API only accepts calls from
`https://pos.<domain>` and `https://admin.<domain>`, so the browser refuses those calls. How do we
let the developer's browser through **without** creating any way for the live server to start
accepting calls from somewhere it should not?

Four smaller questions travel with it and are answered here rather than separately, because they
are not independent: the port numbers *are* the values the answer admits, so a record that settled
the admission mechanism without pinning the ports would not be actionable.

I checked `.scratch/decisions/` first. No existing record answers this. Records 004, 005 and 011
touch the neighbouring ground and are **followed, not re-decided**.

## Criteria weights, declared before the options

Equal across the five, **except engineering cost and risk, which counts double**. This is a
security default, and the failure that matters is not "development is awkward" — it is "a live
server quietly accepts calls from anywhere and nobody notices". That failure is a risk, so risk
carries the extra weight. Maximum total is 30. The weights were not changed after scoring.

## What I chose, and why

**A separate development start-up file.** `apps/api` gains a second entry point,
`apps/api/src/dev.ts`, used only by the `dev` script. It hands the two development addresses to
the application as a plain list written in the code. The production start-up file,
`apps/api/src/index.ts`, is **not edited at all** — it hands over no such list, so the server that
actually runs in the deployed image has no route by which those addresses could ever be accepted.

The point is what is *absent*. There is no new setting, no new environment variable, no
"is this development?" check. A setting can be filled in wrongly on the live server. A check can
be written backwards. Neither exists here, so neither can go wrong. To widen what the live API
accepts, someone has to edit `apps/api/src/index.ts` or `apps/api/src/middlewares/cors.ts`, and
either edit shows up in a diff that a person reads.

The file that holds the allowlist — `apps/api/src/middlewares/cors.ts` — is **not touched by this
decision at all**. Its diff is empty. That is the strongest form of "the production default was
not weakened" I can offer: not an argument, an empty diff.

There is a second, quieter benefit. Today's test builds the application exactly the way the
production entry point does, so the CORS test now measures the production allowlist *regardless of
what is set in anyone's shell*. Nothing a developer can export changes what that test is testing.

I also considered simply proxying the API through the development front-end server, which needs no
CORS at all and is the most conservative option on paper. It lost because it removes the
cross-origin call from development entirely — a CORS mistake would then be invisible until it
reached the live server, which is the opposite of what a development environment is for. The issue
also asks for the API to be reached directly, and this option cannot deliver that.

**This one is not close.** The chosen option wins on every criterion at once, which usually means
the question was really "is there an option with no configuration surface?" and there was.

## The options, ranked

Engineering cost and risk is doubled in the total, per the weights above.

| Rank | Option                                                 | User | Business | Eng cost/risk (×2) | Reversibility | Evidence | Total  |
| ---- | ------------------------------------------------------ | ---- | -------- | ------------------ | ------------- | -------- | ------ |
| 1    | **Development entry point, addresses written in code**  | 5    | 5        | 5 (10)             | 5             | 4        | **29** |
| 2    | `NODE_ENV === "development"` check inside `cors.ts`     | 5    | 4        | 4 (8)              | 5             | 4        | 26     |
| 3    | Proxy the API through the front-end dev server          | 3    | 4        | 4 (8)              | 5             | 4        | 24     |
| 4    | Do nothing / defer                                      | 1    | 3        | 4 (8)              | 5             | 5        | 22     |
| 5    | A development-only variable (`CORS_DEV_ORIGINS`)        | 5    | 2        | 3 (6)              | 4             | 3        | 20     |
| 6    | Bind dev front ends to the `.localhost` names via Caddy | 1    | 5        | 2 (4)              | 3             | 3        | 16     |
| 7    | Read the whole allowlist from configuration             | 4    | 1        | 2 (4)              | 3             | 3        | 15     |

**1. Development entry point, addresses written in code.** One new twelve-line file plus one
optional parameter on `createApp`. Nothing is read from the environment, so there is no value for
an operator to get wrong; the production entry point is byte-identical to what it is today.
Evidence scores 4 rather than 5 because the surrounding details (Bun's `--hot`, Vite's port
pinning) rest on documentation I read today rather than on this repository's own history.

**2. `NODE_ENV === "development"` check inside `cors.ts`.** Genuinely good, and the runner-up by
three points. The polarity is safe — comparing *equal to* development means an unset variable
yields the production list — and `docker/api.Dockerfile` already pins `NODE_ENV=production`. It
loses because the widening code still exists inside the running production process, gated by one
condition; one condition is one thing to write backwards, and it edits the very file whose
untouched state is the clearest proof we have. If option 1 ever has to go, this is where to go.

**3. Proxy the API through the front-end dev server.** Vite's `server.proxy` makes the call
same-origin, so CORS never enters it and the allowlist is untouched. It is the safest option for
production and the worst for catching CORS regressions, because development then never exercises
the cross-origin path production uses. It also contradicts the issue's requirement that the API be
reached directly. Worth remembering if the direct-call requirement is ever dropped.

**4. Do nothing / defer.** Considered, and it does not win. The inner loop stays a container
rebuild, PRD stories 47a–47c stay unmet, and the cost does not go away — it grows, because more
code lands on the current shape in the meantime.

**5. A development-only variable (`CORS_DEV_ORIGINS`), empty in production.** Ergonomic, and the
most tempting wrong answer. Production cannot be *replaced* by it, but it can still be *widened*
by it: the knob exists on the live server, and "leave it empty in production" is a rule someone has
to remember rather than a property of the code. It also needs splitting, trimming, and a
`.env.example` entry, all to buy something a literal already gives.

**6. Bind the dev front ends to the `.localhost` names Caddy serves.** The allowlist never changes,
which is the strongest possible answer to this question — but it puts Docker, TLS and a certificate
to trust back into the inner loop, which is exactly what issue 09 exists to remove, and it needs
proxy configuration for hot-reload web sockets. Record 011 also already flags that no primary
source confirms Caddy's internal issuer covers multi-label `.localhost` names.

**7. Read the whole allowlist from configuration.** The most flexible and the most dangerous. One
wrong value in a live environment file admits anything, silently, with no diff and no review. This
is the option the issue's own framing warns against, and it ranks last on merit rather than by
fiat.

## The instruction to implement

Nothing below is open. Where I could not verify a mechanism, a fallback is named so the
implementer still does not have to decide.

### 1. Admission mechanism — exact code shape

`apps/api/src/middlewares/cors.ts` — **no change. Zero-line diff.**

`apps/api/src/index.ts` — **no change. Zero-line diff.**

`apps/api/src/app.ts` — one optional parameter:

```ts
export type CreateAppOptions = {
  db: DatabaseInstance;
  appDomain: string;
  /**
   * Development-only extra origins, passed only by src/dev.ts. The production entry
   * (src/index.ts) passes none, and nothing here reads the environment — record 012.
   */
  devOrigins?: string[];
};

export const createApp = ({ db, appDomain, devOrigins = [] }: CreateAppOptions) => {
  // ...
  app.use("*", cors({ origin: [...allowedOrigins(appDomain), ...devOrigins] }));
```

`apps/api/src/dev.ts` — new file, the whole thing:

```ts
import { createDb } from "backend/src/db/client.ts";

import { createApp } from "./app.ts";
import { loadEnv } from "./env.ts";

// The development entry point. It exists so the two Vite dev-server origins are admitted by a
// file the production image never runs: docker/api.Dockerfile's CMD is
// `bun run apps/api/src/index.ts`, and index.ts passes no devOrigins. Record 012.
const env = loadEnv();
const db = createDb({ databaseUrl: env.databaseUrl });

const app = createApp({
  db,
  appDomain: env.appDomain,
  // Literals, never configuration. These ports are pinned by `server.strictPort`
  // in each front end's vite.config.ts — record 012.
  devOrigins: ["http://localhost:5173", "http://localhost:5174"],
});

export default { port: 3000, fetch: app.fetch };
```

Three things about that list, all deliberate:

- `apps/landing` is **not** on it. It makes no browser call to the API, exactly as the PRD excludes
  the apex origin in production. The development allowlist mirrors production's shape.
- `localhost` only, never `127.0.0.1`. A browser treats them as different origins. A developer
  who opens the IP form will be refused; that is correct, and the README says so.
- No LAN address. Testing `apps/pos` on a real tablet over Wi-Fi is not covered — see the
  re-check trigger below.

### 2. Ports

| Application       | Port   | Where it is pinned                                          |
| ----------------- | ------ | ----------------------------------------------------------- |
| `apps/api`        | `3000` | `export default { port: 3000, ... }` in `src/dev.ts`        |
| `apps/landing`    | `3001` | `next dev -p 3001`                                          |
| `apps/pos`        | `5173` | `server: { port: 5173, strictPort: true }` in `vite.config.ts` |
| `apps/backoffice` | `5174` | `server: { port: 5174, strictPort: true }` in `vite.config.ts` |

`3000` and `5173` are the Bun and Vite defaults and are kept; `3000` also matches the port
`docker-compose.yml`'s API health check already assumes, so the number does not fork. `apps/landing`
moves off Next's default `3000` because the API has it.

**`strictPort: true` is not tidiness, it is part of the security answer.** Vite's documented
default is to silently move to the next free port when one is taken. A front end that silently
moved to `5175` would be refused by CORS, and the obvious "fix" a frustrated developer reaches for
is widening the allowlist. `strictPort` turns that into a loud start-up failure instead. Set it in
the config file rather than as a CLI flag so the pin survives whichever binary launches the server.

Nothing collides with the deployment stack: it publishes `80`, `443` and `5433` only. `vp run dev`
and `docker compose up -d` can run at the same time.

### 3. `VITE_API_URL` — the exact contract

**It holds the API's origin: scheme, host, port. No path. No trailing slash.**

Both `apps/pos/src/lib/orpc.ts` and `apps/backoffice/src/lib/orpc.ts` become:

```ts
const client = createClient({ url: `${import.meta.env.VITE_API_URL}/rpc` });
```

`/rpc` stays in the code because it is a fact about the server's routing — `apps/api/src/app.ts`
mounts `app.use("/rpc/*")` with `prefix: "/rpc"` — not a fact about the environment. Putting it in
the variable would let a deployment point the client at a path the server does not serve, and would
make a stray trailing slash a runtime 404.

| Environment | Value                          | Supplied by                                                              |
| ----------- | ------------------------------ | ------------------------------------------------------------------------ |
| Development | `http://localhost:3000`        | the root `.env`, exported by the root `dev` script (see 4)               |
| Production  | `https://api.${APP_DOMAIN}`    | `docker/web.Dockerfile`, baked into the bundle at image build time       |
| The gate    | unset, deliberately            | nothing — see below                                                       |

Both environments use **one** mechanism: a shell variable already present when Vite runs. Vite
documents that such variables have the highest priority and are statically replaced into the bundle
at build time. So `docker/web.Dockerfile` gains, **before** its build step:

```dockerfile
ARG APP_DOMAIN=deanpos.localhost
ENV VITE_API_URL=https://api.${APP_DOMAIN}
```

and `docker-compose.yml`'s `web.build.args` gains `APP_DOMAIN: ${APP_DOMAIN:-deanpos.localhost}`
beside the `IMAGE_TAG` already there.

**This closes a live defect rather than creating work.** Nothing sets `VITE_APP_DOMAIN` at build
time today, so the bundles currently in the image call `https://api.undefined/rpc`. Issue 06 named
that placeholder and pointed at this issue; this is where it is paid.

Note that Vite's `envDir` is left at its default, so the monorepo-root `.env` is **never** read by
a front-end build. A stray `.env` in the Docker build context therefore cannot leak into a bundle.
Do not add `envDir`.

**Why the gate stays green with the variable unset.** I checked the installed
`@orpc/client@1.14.13` source: `RPCLink`'s constructor stores the `url` option and does not
construct a `URL` from it — resolution happens at call time, inside `toFetchRequest`. The front-end
tests dispatch through the injected in-process `fetch` and never reach that path. So no `.env`
change is required for the gate, and **no manual step is added before it runs**, which is the
constraint. Do not add an import-time guard that throws on a missing value; that would break the
gate and violate that constraint for no gain, because production's value comes from a committed
Dockerfile line with a default, not from anyone's configuration.

### 4. Dev scripts

Root `package.json`:

```json
"dev": "set -a; [ -f .env ] && . ./.env; set +a; vp run -r --parallel dev"
```

That prefix is copied character-for-character from the existing `migrate` script — record 005's
established pattern, not a new mechanism. It is what gives `apps/api` its `DATABASE_URI` (Bun's own
`.env` autoload only looks in the working directory, which for a workspace task is
`apps/api`, never the root) and what puts `VITE_API_URL` into the environment both Vite servers
inherit. Record 005's "first value per key wins" rule is unaffected: `set -a` exports into a fresh
child environment for this command only, and nothing here writes `.env`.

| Workspace         | `dev` script                  |
| ----------------- | ----------------------------- |
| `apps/api`        | `bun run --hot src/dev.ts`    |
| `apps/pos`        | `vp dev`                      |
| `apps/backoffice` | `vp dev`                      |
| `apps/landing`    | `next dev -p 3001`            |

`--hot` rather than `--watch` is Hono's own documented Bun dev command, and Bun documents that
`--hot` updates the request handler without restarting the process or dropping the port. No package
gets a `dev` script — only the four applications serve anything. Do **not** also declare a `dev`
task in `vite.config.ts`; Vite+ rejects the same task name in both places.

Yes, `apps/api` needs a `dev` script distinct from how it runs in the container, and the difference
is the entire point: the container runs `index.ts`, the script runs `dev.ts`. That divergence is
load-bearing, not accidental.

`.env.example` gains one name and no value, beneath a comment:

```
# The origin apps/pos and apps/backoffice call the API on — scheme, host, port,
# no path (the /rpc prefix lives in the code). Development: http://localhost:3000.
# Production does not read this file; docker/web.Dockerfile bakes
# https://api.${APP_DOMAIN} into the bundles at image build time.
VITE_API_URL=
```

`scripts/stack.sh`'s `cat >` heredoc gains `VITE_API_URL=http://localhost:3000` so a clean checkout
has it. The value contains no space, `&` or `?`, so it survives shell sourcing unquoted. A
developer with an `.env` that predates this record adds the one line by hand; the README says so,
and until they do, the front ends show record 009's error state rather than failing silently.

### 5. `vp run -r --parallel dev` with four long-running servers

**The premise that Fashio only runs watch tasks is wrong, and that is good news.** Fashio runs
three long-running dev servers under exactly this command — `astro dev --force`, `next dev`, and
`email dev` — alongside two `vp pack --watch` tasks. Long-running servers under
`vp run -r --parallel dev` are proven by the sibling project, so nothing special is needed.

Two things I verified and one I could not:

- Vite+ documents that dev servers are **excluded from task caching** ("Dev servers run
  continuously without a successful completion state, so they're not candidates for this caching
  approach"), so the root `run.cache: true` is safe as it stands. No change.
- What a developer does to stop them all: **Ctrl-C in the terminal running `vp run dev`.** I could
  not verify from any primary source how Vite+ forwards SIGINT to children, so the README carries
  the fallback explicitly: if a port stays bound, `lsof -ti:3000,3001,5173,5174 | xargs kill`.
  `strictPort: true` means a leftover process produces a loud start-up error rather than a silent
  port shift.
- One genuine difference from Fashio: one of the four servers needs the database. If PostgreSQL is
  not running, `apps/api` exits and the other three keep serving. That is acceptable — the failure
  is visible in the shared log and the front ends render record 009's error state — and it must not
  be papered over with a retry loop.

**Unverified, with a pre-decided fallback:** whether `vp run -r --parallel dev` skips workspaces
that have no `dev` task. Vite+'s documentation says a missing filtered task "prints a warning and
exits successfully", but Fashio does not settle it, because all five of its workspaces declare
`dev`. If the recursive form errors on the six packages, use the explicit filter form and change
nothing else:

```json
"dev": "set -a; [ -f .env ] && . ./.env; set +a; vp run --parallel -F api -F pos -F backoffice -F landing dev"
```

### 6. How `apps/api/tests/cors.test.ts` stays green and stays meaningful

It stays green because **it never sees a `devOrigins` value**. `createTestSeam()` calls
`createApp` without one, `devOrigins` defaults to `[]`, and the allowlist the test measures is
exactly `allowedOrigins(appDomain)` — the same array it measures today, produced by an unchanged
function in an unchanged file. Not one line of that test file changes.

It becomes *more* meaningful, not less. Today its meaning depends on nothing being different in
the environment; after this change that is a property rather than a hope, because no environment
variable reaches the allowlist at all. Nothing a developer can export from a shell alters what that
test is testing.

Two additions prove the mechanism inside the gate, so that **no part of this needs `vp run dev` to
be verified**:

- `apps/api/src/test-seam.ts` gains an optional `devOrigins?: string[]` passed straight through to
  `createApp`. `createTestSeam()` with no arguments is unaffected, which is why `cors.test.ts` does
  not change.
- A new file `apps/api/tests/cors-dev-origins.test.ts` with two assertions against a seam built as
  `createTestSeam({ devOrigins: ["http://localhost:5173"] })`: that origin is echoed back exactly,
  and `https://attacker.example.com` still receives **no** `Access-Control-Allow-Origin` header.
  The second assertion is the one that matters — it proves the parameter is additive and explicit,
  not a switch into permissiveness.

Hono's behaviour here is verified against the installed source, not its documentation:
`node_modules/.bun/hono@4.12.33/.../middleware/cors/index.js` reduces an array `origin` to
`(origin) => optsOrigin.includes(origin) ? origin : null`, and omits the header entirely when that
is `null`.

## The reviewer's test

Eight checks, all mechanical, none a matter of taste. If all eight hold, the live API accepts
exactly `allowedOrigins(appDomain)` and nothing in any environment can change that.

1. `git diff main -- apps/api/src/middlewares/cors.ts` is **empty**.
2. `git diff main -- apps/api/src/index.ts` is **empty**.
3. `git diff main -- apps/api/tests/cors.test.ts` is **empty**.
4. `rg -n "localhost" apps/api/src` matches in `apps/api/src/dev.ts` and nowhere else.
5. `rg -n "devOrigins" apps/api/src` matches only `app.ts` (type, destructuring, spread) and
   `dev.ts` (the literal array). Never `env.ts`, never `index.ts`, never `middlewares/`.
6. `rg -n "process\.env|Bun\.env" apps/api/src/app.ts apps/api/src/middlewares` returns nothing.
   No environment variable reaches the allowlist.
7. `rg -ni "origin|cors" .env.example docker-compose.yml docker/api.Dockerfile` returns nothing
   that configures an origin. No new knob exists.
8. `docker/api.Dockerfile`'s CMD is still `["bun", "run", "apps/api/src/index.ts"]` — the
   production image runs the entry point that passes no development origins.

Check 8 is the one that would silently undo everything. If a future change makes the image run
`dev.ts`, this whole record is void.

## How to turn it back

Two independent reversals. Neither depends on the other.

**A. The admission mechanism** — one commit, four edits:

1. Delete `apps/api/src/dev.ts`.
2. Remove `devOrigins` from `CreateAppOptions` and from the `cors({ origin: ... })` spread in
   `apps/api/src/app.ts`; the line returns to `cors({ origin: allowedOrigins(appDomain) })`.
3. Remove the `devOrigins` passthrough from `apps/api/src/test-seam.ts` and delete
   `apps/api/tests/cors-dev-origins.test.ts`.
4. Point `apps/api`'s `dev` script at `src/index.ts`, which restores the pre-record behaviour:
   development front ends are refused.

`apps/api/src/middlewares/cors.ts`, `apps/api/src/index.ts` and `apps/api/tests/cors.test.ts` need
no attention, because this record never touched them. Nothing can have been built on top of
`devOrigins` without appearing in reviewer check 5 — it is greppable by one word.

The likely successor is the runner-up, option 2: move the two literals into `cors.ts` behind
`process.env.NODE_ENV === "development"` and delete `dev.ts`. Write a superseding record, flip this
one to `overturned`, and update both log lines.

**B. `VITE_API_URL`** — separable, and worth stating separately because a reversal of A must not
drag it along:

1. Restore `apps/pos/src/lib/orpc.ts` and `apps/backoffice/src/lib/orpc.ts` to the
   `VITE_APP_DOMAIN`-derived URL. Note this restores a **broken** production path
   (`https://api.undefined/rpc`), so this half should be replaced, not simply reverted.
2. Remove the `ARG APP_DOMAIN` / `ENV VITE_API_URL` pair from `docker/web.Dockerfile` and the
   `APP_DOMAIN` build arg from `docker-compose.yml`.
3. Remove the `VITE_API_URL` line from `.env.example` and from `scripts/stack.sh`'s heredoc.

Cost grows with the number of front-end applications reading the variable. Today that is exactly
two files; `rg -l VITE_API_URL apps` is the count to check before promising a reversal.

**What would make this decision wrong.** Two named triggers:

- **A developer needs to test `apps/pos` on a real tablet over the LAN.** For a point-of-sale
  product this is likely, not hypothetical, and the origin would be `http://192.168.x.x:5173`,
  which literals cannot cover. The pre-decided successor is option 5, but scoped so that it stays
  safe: read the extra origins from an environment variable **inside `dev.ts` only**, never in
  `app.ts` and never in `cors.ts`. Reviewer checks 2, 5 and 6 all still hold, because the
  production entry point is still untouched. Do not reach for this before the need is real.
- **`docker/api.Dockerfile` starts running anything other than `index.ts`.** That is the single
  observation that voids the whole argument, and it is reviewer check 8.

## Evidence

Repository, read 2026-08-02:

- `.scratch/foundation/issues/09-local-dev-server.md`, `.scratch/foundation/PRD.md`
  (security criterion 1; "The CORS allowlist is two of the four origins"; "Development runs beside
  the deployment stack, not through it")
- `apps/api/src/middlewares/cors.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`,
  `apps/api/src/env.ts`, `apps/api/src/test-seam.ts`, `apps/api/src/helpers.ts`,
  `apps/api/tests/cors.test.ts`
- `apps/pos/src/lib/orpc.ts`, `apps/backoffice/src/lib/orpc.ts`, `packages/contract/src/client.ts`,
  `apps/pos/vite.config.ts`
- `package.json` (root), `apps/*/package.json`, `vitest.setup.ts`, `.env.example`,
  `scripts/stack.sh`, `README.md`
- `docker/api.Dockerfile` (`ENV NODE_ENV=production`; `CMD ["bun", "run", "apps/api/src/index.ts"]`),
  `docker/web.Dockerfile`, `docker/Caddyfile`, `docker-compose.yml`
- `.orc2/ORCHESTRATOR.md` — lanes are seeded by `cp .env .worktrees/<slug>/.env`, which is why an
  addition to the root `.env` reaches every lane without a change to the orchestrator
- `.scratch/decisions/004`, `005`, `011` — followed, not re-decided
- `node_modules/.bun/hono@4.12.33/node_modules/hono/dist/middleware/cors/index.js` —
  `(origin) => optsOrigin.includes(origin) ? origin : null`, header omitted when `null`
- `@orpc/client@1.14.13` fetch adapter — `RPCLink`'s constructor stores `url` without constructing
  a `URL`; resolution is at call time in `toFetchRequest`
- `/Users/jomelortega/Desktop/personals/PremiumSoftwares/Fashio` — root
  `"dev": "vp run -r --parallel dev"`; three long-running dev servers (`astro dev --force`,
  `next dev`, `email dev`) plus two `vp pack --watch` tasks; `run: { cache: true }` at the root;
  no ports pinned anywhere; README documents starting but not stopping

Primary sources, accessed 2026-08-02:

- https://vite.dev/config/server-options — `server.strictPort`: "exit if port is already in use,
  instead of automatically trying the next available port"; default port 5173
- https://vite.dev/config/shared-options — `envDir` defaults to `root`, may be relative to it;
  `envPrefix` defaults to `VITE_`
- https://vite.dev/guide/env-and-mode.html — "environment variables that already exist when Vite is
  executed have the highest priority and will not be overwritten by `.env` files"; `VITE_` variables
  are statically replaced at build time; `VITE_*` must not carry secrets
- https://bun.com/docs/runtime/hot — `--hot` "detects code changes and updates its internal module
  cache", and "You can update your HTTP request handler without shutting down the server"; `--watch`
  restarts the process
- https://bun.com/docs/api/http — port resolution "defaults to $BUN_PORT, $PORT, $NODE_PORT
  otherwise 3000"
- https://hono.dev/docs/getting-started/bun — `export default { port: 3000, fetch: app.fetch }`, and
  `"dev": "bun run --hot src/index.ts"`
- https://viteplus.dev/guide/cache — "Dev servers run continuously without a successful completion
  state, so they're not candidates for this caching approach"
- `node_modules/.bun/vite-plus@0.2.5.../vite-plus/README.md` — "`vp dev` – Run the development
  server"

**Searched for and not found**, and the absence mattered enough to name:

- No primary source documents how `vp run --parallel` forwards SIGINT to its children. The README
  fallback (`lsof -ti:... | xargs kill`) exists because of this gap, not despite it.
- No primary source documents whether `vp run -r --parallel <task>` skips workspaces lacking the
  task. Hence the pre-decided explicit-filter fallback in section 5.
- Vite does not document what `import.meta.env.VITE_FOO` becomes when the variable is unset at build
  time. This does not affect the decision, because the oRPC source check established that an unusable
  URL is inert until a call is made, and the gate never makes one.

No agent-directed instructions were encountered in any fetched page.
