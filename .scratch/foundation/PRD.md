# Foundation

- **Status:** ready-for-agent
- **Area:** 1 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** nothing
- **Blocks:** every other area

## Problem Statement

DeanPOS does not exist. There is no repository layout, no build, no test runner, no
database connection, no deployable artefact, and no gate that can tell a passing change
from a broken one. Ten planned areas — tenancy, catalog, checkout, offline sync, and the
rest — all assume a working pipe from a rendered screen through a typed contract to a
migrated PostgreSQL database, and none of them can be started until that pipe exists and
is proven by a test.

Worse, the decisions that make DeanPOS what it is are currently only written down. The
architecture is CQRS-lite with a fixed module shape, tenants share one database behind Row-Level
Security, money is integer centavos, the cashier terminal and the back-office are
separate apps on separate origins. Each of those is a rule that has to be *structurally
enforced* from the first commit, because retrofitting any of them across ten areas of
merged work is the expensive kind of mistake.

## Solution

A Bun + TypeScript monorepo containing four applications and six shared packages, wired
end to end and deployed to a single VPS, with exactly one thin vertical slice running
through it: a `ping` procedure that reads one row from PostgreSQL and renders on both
front-end applications.

The slice has no domain meaning on purpose. Its job is to prove that the contract
package, the Hono handler, the Kysely query, the Prisma migration, both React shells,
the three-origin routing, the CORS allowlist, and the Docker deploy all work together —
and to leave behind the single test seam every later area will reuse.

Alongside it, the money primitives — integer centavos, VAT backout at a configurable rate,
round-once-per-stored-figure, half-up — land as pure, property-tested functions.
They are foundation work because `catalog`, `checkout`, `drawer-sessions`, and `reporting`
each independently need them, and four independent reimplementations of a rounding rule
is four different totals.

## User Stories

**Repository and toolchain**

1. As an implementing agent, I want a single monorepo with a declared workspace layout, so that I know where a new module belongs without inventing a convention.
2. As an implementing agent, I want Bun as the only package manager and runtime, so that I never have to reason about which lockfile is authoritative.
3. As an implementing agent, I want one command that installs everything from a clean checkout, so that a fresh lane worktree is productive without a setup document.
4. As an implementing agent, I want TypeScript configured in strict mode across every workspace, so that a type error is a build failure rather than a runtime surprise.
5. As an implementing agent, I want `bun run check` to run typecheck and lint across all workspaces, so that the gate's first half is one command.
6. As an implementing agent, I want `bun run test` to run every Vitest suite across all workspaces, so that the gate's second half is one command.
7. As an implementing agent, I want the gate to fail on a type error in one workspace even when the others pass, so that a broken contract cannot merge behind a green partial run.
8. As a developer, I want Vite+ configured as the runner for both React applications, so that the two front ends behave identically in development.
9. As a developer, I want the Vite+ licence handled explicitly — a token in the local environment, or a documented and deliberate fallback to plain Vite — so that the build never silently degrades and nobody debugs it under time pressure.
10. As a developer, I want formatting and linting to be non-negotiable and automatic, so that no review ever spends a comment on style.

**Contract and typesafety**

11. As an implementing agent, I want a shared contract package that defines every procedure's input and output, so that the API and both clients agree by construction.
12. As an implementing agent, I want the API's handlers to be type-checked against that contract, so that a handler returning the wrong shape fails the gate.
13. As an implementing agent, I want both front-end applications to consume a typed client generated from the same contract, so that renaming a field breaks the build rather than the checkout screen.
14. As a reviewer, I want the contract to be hand-written and reviewable, so that a change to the API surface is visible in a diff instead of buried in generated output.

**API application**

15. As an implementing agent, I want `packages/backend` laid out per ADR-0008 — `db/`, per-area `handlers/`, and `db-operations/{commands,queries}` — so that the first real feature has an obvious home for each part.
16. As an implementing agent, I want one worked example flowing from contract, through the `apps/api` route binding, into a backend handler and a db-operation query, so that the structure is copied from working code rather than guessed from prose.
17. As an implementing agent, I want both React applications laid out per ADR-0009 — thin routes, fat features — so that a screen ticket's change surface is obvious.
18. As an implementing agent, I want `packages/backend` to import no transport library, so that a handler can be tested without an HTTP server.
19. As an operator, I want a health endpoint that reports whether the process is up and whether the database is reachable, so that a deploy can be verified without opening the app.
20. As an operator, I want the health endpoint to be distinguishable from the readiness of the database, so that "the container booted" and "the app can serve" are separate answers.

**Data layer**

21. As an implementing agent, I want the schema defined in a Prisma schema file as the single source of truth, so that there is never a question of which definition is current.
22. As an implementing agent, I want migrations generated as checked-in SQL and applied with `prisma migrate deploy`, so that the same migration runs identically in a lane, on a developer's machine, and in production.
23. As an implementing agent, I want Kysely table types generated from that schema by `prisma-kysely`, so that a query referencing a dropped column fails the gate.
24. As an implementing agent, I want every runtime query to go through Kysely and never through the Prisma client, so that the data layer stays thin and no ORM type leaks into a handler.
25. As an implementing agent, I want generated type output excluded from review diffs, so that a reviewer reads the change and not the regeneration.
26. As an implementing agent, I want database access to exist behind a single factory that is the only place a connection is opened, so that the tenant session variable added in area 2 has exactly one choke point to be set in.
27. As a pipeline lane, I want to create and drop my own database from the checked-in migrations, so that parallel lanes never share state.

**Front-end shells**

28. As a cashier, I want the terminal application to load as its own application on its own origin, so that the back-office cannot read my device's stored credentials.
29. As a manager, I want the back-office to be a separate application, so that its bundle and its release cadence are independent of the terminal's.
30. As an implementing agent, I want both applications to share a design token package with Tailwind preset and shadcn primitives, so that two apps do not drift into two design systems.
31. As an implementing agent, I want `packages/ui` to contain primitives and tokens only, so that no component in it can know what a cart or a report is.
32. As an implementing agent, I want TanStack Router configured with typed routes in both applications, so that a link to a removed route fails the build.
33. As an implementing agent, I want TanStack Query configured with the oRPC client in both applications, so that later areas add a query without re-solving data fetching.
34. As a cashier, I want the terminal shell to be laid out touch-first for tablet landscape and for phone, so that the sale screens built in `checkout` inherit the right ergonomics instead of retrofitting them.
35. As a manager, I want the back-office shell to be responsive from phone to desktop, so that I can check on the store from my phone.
36. As a user of either application, I want the shell to meet WCAG 2.2 AA — focus order, visible focus, contrast, landmarks — so that accessibility is a starting condition rather than a remediation project.
37. As a user, I want a visible error state when the application cannot reach the API, so that a failure is legible rather than a blank screen.

**The vertical slice**

38. As a developer, I want a `ping` procedure that reads one row from PostgreSQL through the full stack, so that the pipe is proven rather than assumed.
39. As a developer, I want `ping` rendered on a route in both applications, so that the contract, the client, the CORS configuration, and both builds are all exercised.
40. As a developer, I want the `ping` slice to carry no domain meaning, so that deleting or replacing it later costs nothing.

**Money primitives**

41. As an implementing agent, I want money represented as integer centavos with a dedicated type, so that a float can never reach a total.
42. As an implementing agent, I want a single half-up rounding function, called once per stored figure — the OrderLine total, and the Order-scoped Discount amount — so that four areas cannot produce four different totals.
43. As an implementing agent, I want a VAT-backout function taking the rate as an argument, so that reporting does not reinvent the tax arithmetic and a non-VAT tenant is expressible (ADR-0010).
43a. As an implementing agent, I want VAT backout to be a pure function of a total and a rate — never of a global constant — so that a Tenant setting change cannot silently re-interpret a past sale.
44. As an implementing agent, I want typed `Delta` support — `absolute` and `multiplier` — so that `catalog` and `checkout` apply modifiers using the same primitive.
45. As a reviewer, I want these functions covered by property tests, so that the guarantees are stated as invariants rather than a handful of examples.

**Local development and deployment**

46. As a developer, I want the entire stack to run locally with Docker Compose and no cloud credentials, so that every test and every lane is honest.
47. As a developer, I want a documented one-command start from a clean checkout, so that onboarding is not tribal knowledge.
48. As an operator, I want the four origins — landing, terminal, back-office, API — served under one registrable domain with TLS, so that browser storage is isolated while cookies stay same-site.
49. As an operator, I want CORS configured as an explicit allowlist of the origins that actually call the API, so that a permissive default never ships.
49a. As an operator, I want a request from a non-allowlisted origin to be refused by an automated test in the gate, so that a permissive default cannot ship green while a reviewer is trusted to remember.
49b. As a developer, I want the gate demonstrated failing — a deliberate type error and a deliberately broken assertion, each turning it red — so that a gate nobody has watched fail is not assumed to work.
50. As an operator, I want the deploy script to refuse a dirty tree and refuse a commit whose gate has not passed locally, so that an unbuildable commit cannot reach the VPS. **There is no hosted CI** — that was decided in `release-ops` and this PRD follows it.
51. As an operator, I want a deploy to produce a versioned container image, so that rolling back is redeploying a previous image rather than reverting code.

## Implementation Decisions

**Workspace layout.** Four applications — `apps/landing` (Next.js marketing site),
`apps/pos` (React terminal), `apps/backoffice` (React admin), and `apps/api` (a **thin
Hono shell** holding no product logic) — and six packages: `packages/backend` (server logic
and the database), `packages/contract` (oRPC contract), `packages/schemas` (zod shapes),
`packages/error` (error taxonomy), `packages/ui` (Tailwind preset, tokens, shadcn
primitives), and `packages/tsconfig`. Bun workspaces. This is ADR-0001 and ADR-0008 and is
not open in this PRD.

The internal shape of `packages/backend` and of both React applications is fixed by ADR-0008
and ADR-0009 respectively. `foundation` establishes those shapes with one worked example
each; every later area copies the nearest neighbour rather than inventing.

`apps/landing` is scaffolded here only far enough to build and deploy; its content is
area 11.

**Toolchain.** Bun as package manager and runtime. Vite+ as runner and bundler for
`apps/pos` and `apps/backoffice`; `apps/landing` keeps Next.js's own build. Vitest is the
only test runner, configured as a workspace so one invocation covers every package.
TypeScript strict everywhere.

The Vite+ licence must be resolved as part of this PRD — either a token is wired into the
local environment and verified, or the repository deliberately pins plain Vite and records
why. A build that degrades silently is a defect of this PRD, not a later surprise.

**Linter and formatter: Biome.** One binary covering both, one config at the root, and the
sibling project **ApxDenta** already has a working configuration to copy — which is the
whole argument. oxlint ships with Vite+ and is a fine linter, but it is not a formatter, so
choosing it means running two tools where one will do. The stakes are low either way; what
matters is that the answer is written down. This closes the open item in `.scratch/APP-PLAN.md`
and it is **not reopened by a later area**.

**Task running: Bun workspaces plus Vite+, no Turborepo.** `bun run check` and
`bun run test` must each be a single command that fails if *any* workspace fails. A
remote-cached task graph is a solution to a build-time problem this repository does not
have yet. **Deferred, trigger:** the gate taking long enough that somebody starts skipping
it. This closes the second open item in `.scratch/APP-PLAN.md`.

**Gate.** `bun run check` (typecheck + lint across all workspaces) and `bun run test`
(Vitest across all workspaces). These are already recorded in `.orc2/config.env`; this
PRD makes them real. Both must fail loudly when any single workspace fails.

**Contract.** `packages/contract` hand-writes oRPC procedure definitions with their
input and output schemas. `apps/api` implements against it; `apps/pos` and
`apps/backoffice` consume a typed client built from it. The contract is the only place a
procedure's shape is declared. A generated-from-router approach was considered and
rejected — a hand-written contract is reviewable in a diff.

**Backend structure.** Per ADR-0008, **CQRS-lite**: handler → db-operation → Kysely, with
commands and queries in separate directories. Handlers live in `packages/backend` and are
**transport-pure** — nothing there imports oRPC or Hono. `apps/api/src/routes/<area>.ts` is
the only transport-aware code, binding a contract procedure to a handler.

The `ping` slice is the worked example of exactly that path: contract definition →
`apps/api` route binding → `packages/backend` handler → db-operation query → Kysely. Later
areas copy this shape, and **the shape is the deliverable, not the ping**.

A handler that nobody routed cannot occur: oRPC's `implement(contract)` fails typecheck on
an unimplemented procedure. That property must be established here, since `hardening`'s
coverage sweep relies on the contract being the single enumerable surface.

**Data layer.** Per ADR-0004: `schema.prisma` is the source of truth; migrations are
Prisma-generated SQL, checked in, applied with `prisma migrate deploy`; `prisma-kysely`
emits Kysely table interfaces; Kysely executes every runtime query. The Prisma client is
not a runtime dependency of `packages/backend`.

Connection acquisition lives behind **one** function. Area 2 adds the tenant session
variable there and nowhere else. Any code path that obtains a connection by another
route is a defect.

Generated output lives under a `generated/` directory and is matched by
`ORC2_GENERATED_PATHS="**/generated/**"`.

**Front-end shells.** Both React applications use TanStack Router with typed routes and
TanStack Query wired to the oRPC client. Shared visual language comes from
`packages/ui`; anything domain-aware belongs in the consuming application.

`apps/pos` ships an app shell designed for tablet landscape and for phone as two
layouts, not one breakpoint — the sale screen is the densest in the product and the two
are different designs. `apps/backoffice` is responsive across the full range. Both meet
WCAG 2.2 AA at the shell level: landmark structure, keyboard focus order, visible focus
indicators, and contrast.

No service worker and no offline behaviour in this PRD. `apps/pos` is structured so a
service worker can be added in `offline-sync` without restructuring the shell, but the
worker itself is that area's work.

**Money primitives live in `packages/schemas`, not in `packages/backend`.** The terminal
computes totals offline and must produce the same number the server would, so the
arithmetic has to be importable by `apps/pos` — and `packages/backend` is server-only by
ADR-0008. `packages/schemas` is already in every workspace's graph (`contract` depends on
it, both front ends depend on `contract`), and `Centavos` is the one type every money
schema in the product contains. A separate `packages/money` would be imported by exactly
the same set of workspaces for no benefit.

What lands there:

- A `Centavos` **branded integer** type. Construction from a decimal string is validated
  and total — it returns a result, never throws past a boundary, and never yields a float.
- `roundLineTotal` — round-half-up, applied **exactly once** at the OrderLine total.
- **`vatBackout(total, ratePercent)` — pure on both arguments.** No global rate, no
  default, no `12` anywhere in the implementation. VAT is a Tenant setting that is off by
  default and carries a configurable rate captured per Order (ADR-0010); a function that
  closes over a constant cannot express a non-VAT tenant and cannot render a receipt from
  before the rate changed.
- A `Delta` type discriminated on `absolute` versus `multiplier`, with application logic.
  **Applying a Delta returns `Millicentavos`, not `Centavos`** — an integer at 1000× scale.
  A `multiplier` on an integer-centavo price produces a fraction, and `catalog` requires
  that fraction to survive composition unrounded so that ADR-0005's *round once, at the
  OrderLine total* is literally true. Rounding at Delta application would round twice.
  Millicentavos keeps it exact and keeps floats out (ADR-0005 prohibits them in every
  layer); `roundLineTotal` is the single place the scale collapses back to `Centavos`,
  half-up.

  A half-adobo is the worked example: `₱120.00 → 12000 centavos → ×0.5 → 6000000
  millicentavos → ₱60.00`. Change the price to `₱121.00` and the multiplier keeps
  `6050000`, which rounds once to `₱60.50` — not two roundings that could land on
  `₱60.00`.

**No other workspace implements any of this.** A second `round` is a review finding.

**The vertical slice.** A `ping` procedure returns one row read from PostgreSQL — a
single-row table created by the first migration. It is rendered on one route in each
front-end application. It carries no domain meaning and is expected to be deleted once
a real slice replaces it.

**Deployment.** Docker Compose defines the API, both static front ends, the landing
site, and PostgreSQL. A reverse proxy serves **four origins** on one registrable domain
with TLS — the apex for `apps/landing`, plus `pos.`, `admin.`, and `api.` (ADR-0001).

**The gate runs locally, not in hosted CI** (`release-ops`, ADR-0006). The deploy script
refuses a dirty tree and refuses a commit whose gate has not passed, then builds a versioned
image. `foundation` builds the gate as two commands; `release-ops` builds the script that
enforces them.

**The CORS allowlist is three origins, not four.** `pos.` and `admin.` call the API and
are allowlisted; **the apex landing origin is not**, because in v1 the landing site makes
no browser call to `api.` — its one write, the waitlist form, is area 11's work and adds
itself to the allowlist then, with its own reason. Everything gets TLS; only callers get
CORS.

The registrable domain is **not decided**. The four-origin shape is. Configuration
must read the domain from an environment variable so that settling it is a config
change, not a code change.

## Testing Decisions

**What makes a good test here.** It exercises the seam a user or a caller actually
crosses, and it fails when behaviour changes rather than when structure does. A test
that asserts a repository was called with certain arguments is testing the wiring; a
test that asserts the rendered route shows the value that is in the database is testing
the behaviour. Prefer the second every time. No mocks of anything DeanPOS owns.

**The one seam.** Confirmed with the developer during specification:

> render a real route (happy-dom + Testing Library) → real TanStack Query → real oRPC
> client from `packages/contract` → a custom `fetch` that dispatches into the Hono
> application in-process via `app.request()` → real Kysely → real lane PostgreSQL

There is no HTTP port, no running server, and no mocked client. A single test through
this seam proves the contract, the handler, the query, the migration, and the render
together. Every later area reuses it, which is why establishing it correctly is the
highest-value deliverable in this PRD.

This is a new seam because the repository is empty; there is no prior art to prefer. The
helper that builds it — a function returning a rendered route wired to a live in-process
API and a lane database — is itself a foundation deliverable and must be documented for
the areas that follow.

**Direct unit tests, not a seam.** The money primitives are pure functions with no I/O.
They are tested directly and **property-tested**: rounding is idempotent and never drifts
by more than a centavo from the unrounded value; VAT backout composed with VAT
application returns the original; **applying any sequence of Deltas yields an exact
`Millicentavos` integer with no rounding at any step**, and rounding that sequence once at
the end never differs from the exact value by more than half a centavo. Examples alone are
not sufficient for money.

The property that is deliberately **not** asserted: that a `multiplier` Delta applied to a
`Centavos` yields a `Centavos`. It does not, and an earlier draft of this PRD claimed it
did — which contradicted `catalog` outright and would have rounded twice on every
half-portion sold.

**Deliberately not tested here.**

- Service workers, IndexedDB, and offline behaviour. happy-dom cannot exercise them and
  there is nothing offline to prove yet. The real-browser seam is deferred to
  `offline-sync`, which must carry its setup cost explicitly in its own PRD.
- Visual regression. The lo-fi contract does not support pixel comparison.
- The Docker deploy itself. It is verified by a documented manual smoke check against
  the health endpoint on the VPS, not by an automated test.

**Gate proof.** The gate must be demonstrated to fail: a deliberate type error in one
workspace, and a deliberately broken assertion, each shown to turn the gate red. A gate
nobody has watched fail is not known to work. This is story 49b, and the demonstration is
recorded in the build report — otherwise it is the step that quietly does not happen.

**CORS is tested, not reviewed.** Through the in-process seam: a request carrying an
`Origin` that is not on the allowlist receives **no** `Access-Control-Allow-Origin` header,
and a request from each allowlisted origin receives exactly its own. A wildcard, or an
origin echoed from the request, fails the test rather than waiting for a reviewer to
notice. Story 49a.

## Security Criteria

Per-area criteria, per the app-wide plan. Foundation crosses few boundaries but sets
every default.

1. **CORS is an explicit allowlist** of the three known origins. A wildcard origin, or
   an origin read from the request, fails review.
2. **The three origins are genuinely separate**, so that browser storage isolation is
   real. A path-based deployment on one origin defeats ADR-0007 and is not acceptable.
3. **No secret is committed.** Configuration comes from environment variables with a
   checked-in `.env.example` that contains names and no values.
4. **The health endpoint discloses nothing** — no version string, no connection details,
   no stack traces. Liveness and database reachability as booleans.
5. **Errors returned to a client are opaque.** Stack traces and database error text stay
   in the logs. This default is set here or it is never set.
6. **The single connection choke point is structural**, so that area 2 can enforce
   tenant scoping in one place. If more than one code path opens a connection, that is a
   finding in this PRD, not in area 2.
7. **Dependencies are lockfile-pinned** and the lockfile is committed.
8. **Untrusted input:** only the `ping` route exists, and it takes none. The decision
   that all procedure inputs are validated by the contract's schemas at the boundary is
   established here and inherited by every later area.

## Out of Scope

- Any domain model: no Tenant, Store, User, MenuItem, Order, or DrawerSession tables. Area 2
  onwards.
- Authentication and authorisation of any kind, including RLS policies. Area 2.
- Service workers, offline caching, IndexedDB, the Outbox. Area 5.
- Landing page content, copy, and design. Area 11.
- Structured logging, Sentry, metrics, alerting. Area 8 — a health endpoint is not
  observability.
- Backups, restore drills, rollback rehearsal, runbook. Area 10.
- Rate limiting, threat model, dependency advisory policy. Area 9.
- Staging environment. One production target is enough to prove the deploy; environments
  are area 10.
- Self-serve tenant signup, billing, onboarding. Not in v1 at all.

## Further Notes

- **Vite+ is the single most likely source of a mysterious build failure in this PRD.**
  Resolve the licence explicitly and prove it on a clean machine before anything depends on the
  build. If a token is unavailable, pin plain Vite and record the decision rather than
  leaving a fallback that nobody knows is active.
- **The seam helper is the real deliverable.** Ten areas will use it. If it is awkward,
  every later test is awkward. Spend the time here.
- **Do not let structure inflate the ping slice.** One handler, one query, one route binding.
  The structure is the example; the ping is not the product.
- The registrable domain is a placeholder throughout. Read it from configuration.
- `packages/ui` drifts by accident, not by decision. The first component that knows about
  a cart belongs in `apps/pos`.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and
ADR-0001 through ADR-0007. Seams confirmed with the developer before writing._
