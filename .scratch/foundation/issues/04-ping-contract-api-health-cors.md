# 04 — Ping through contract → api → backend, with health and CORS

**Status:** done

## What to build

One procedure, `ping`, that reads the row created in issue 03 and returns it — travelling the
exact path every later feature will travel: a hand-written oRPC contract, a route binding in
`apps/api`, a transport-pure handler in `packages/backend`, a db-operation query, Kysely,
PostgreSQL. **The shape is the deliverable; the ping is not the product.**

Alongside it, the two defaults that are set here or never: a health endpoint that discloses
nothing, and a CORS allowlist that is tested rather than reviewed.

**Structure (ADR-0008, CQRS-lite).** `packages/contract` declares the procedure's input and
output and is the only place a procedure's shape is declared — hand-written, so an API change
is visible in a diff. `apps/api/src/routes/<area>.ts` is the only transport-aware code.
`packages/backend` holds the handler and its db-operations **nested per area** —
`src/<area>/handlers/<verb-noun>.ts` and `src/<area>/db-operations/{commands,queries}/` — and
imports no transport library at all, since a handler must be testable without an HTTP server.

**The per-area nesting is the point, not a detail.** Ten areas will copy this example. A flat
`src/handlers/` here becomes a flat `src/handlers/` holding every handler in the product.

**The server half of the one test seam** lands here: a real oRPC client over a custom `fetch`
that dispatches into the Hono application in-process via `app.request()`. No port, no running
server, no mocked client. Issue 06 completes it with the render half.

**CORS is an allowlist of two origins**, `pos.` and `admin.`, read from the configured
registrable domain. The apex landing origin is deliberately excluded — in v1 it makes no
browser call to the API, and area 11 adds itself with its own reason. Everything gets TLS;
only callers get CORS.

## Acceptance criteria

- [ ] `ping` returns the row read from PostgreSQL, through contract → route binding → handler
      → db-operation → Kysely, with no layer skipped.
- [ ] An unimplemented contract procedure **fails typecheck** — demonstrated, since
      `hardening`'s coverage sweep relies on the contract being the single enumerable surface.
- [ ] The files sit exactly where ADR-0008 puts them: `apps/api/src/routes/ping.ts`,
      `packages/backend/src/ping/handlers/…`, `packages/backend/src/ping/db-operations/queries/…`.
      Per-area nesting, not a flat `src/handlers/`.
- [ ] `packages/backend` imports neither oRPC nor Hono; the handler is exercised by a test
      with no HTTP server involved.
- [ ] Procedure inputs are validated by the contract's schemas **at the boundary**, and that
      is stated in the route binding even though `ping` takes no input — every later area
      inherits this default from here (security criterion 8).
- [ ] The health endpoint reports liveness and database reachability as **two separate
      booleans** — "the container booted" and "the app can serve" are different answers.
- [ ] The health endpoint discloses nothing else: no version string, no connection details,
      no stack trace.
- [ ] Errors returned to a client are opaque, **proven by a forced failure** — make the
      database unreachable through the seam and assert the response carries no stack trace, no
      database error text, and no connection detail. Prose is not proof for this one.
- [ ] **CORS is asserted through the seam:** a request carrying a non-allowlisted `Origin`
      receives no `Access-Control-Allow-Origin` header at all, and a request from each
      allowlisted origin receives exactly its own. A wildcard, or an origin echoed from the
      request, fails the test.
- [ ] The registrable domain is read from configuration, never hardcoded.
- [ ] The in-process seam helper exists and is used by this issue's test.

## Depends on

- 03 — Data layer and the lane database

## Relevant files

- `packages/contract/**`
- `packages/error/**`
- `apps/api/**`
- `packages/backend/src/ping/handlers/**`, `packages/backend/src/ping/db-operations/queries/**`
- `packages/backend/src/common/**` (Ctx and handler types, per ADR-0008)
- the shared test-seam helper (server half)

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 11, 12, 14–16, 18–20, 38, 49, 49a;
security criteria 1, 4, 5, 8). Stories 13 and 17 are front-end and belong to issues 06 and 07.
This is the fattest issue in the PRD and is deliberately not split — the ping proves nothing
until it crosses all four layers._

Applied review round 2: added `apps/api/tests/router-contract.types.ts`, a committed
`@ts-expect-error` fixture pinning the unimplemented-procedure property (decision 006);
centralized the `DATABASE_URI`/`APP_DOMAIN` key names as `ENV_KEYS` in `env.ts`; moved
`opaque-errors.test.ts` teardown into `afterAll` to match the sibling tests.

### Implementer notes (2026-08-02)

Demonstrated the unimplemented-procedure typecheck property: added `pong: oc.input(z.void()).output(pingOutputSchema)`
to `packages/contract/src/contract.ts` with no matching key in `apps/api/src/app.ts`'s
`implement(contract).$context<Ctx>().router({ ping: pingRoute })`, ran `vp check`, and got:

```
x typescript(TS2741): Property 'pong' is missing in type '{ ping: ImplementedProcedure<...>; }'
but required in type '{ ping: Lazyable<Procedure<...>>; pong: Lazyable<...>; }'.
  apps/api/src/app.ts:34:61
```

Reverted both files immediately after capturing this. `vp check` is clean again.

Seam helper: `createTestSeam(options?: { databaseUrl?: string; appDomain?: string })` in
`apps/api/src/test-seam.ts`, returning `{ app, client, db }`. `apps/pos`/`apps/backoffice`
(issues 06, 07) import it as a `devDependency` on `api` per `.scratch/decisions/006`.

---

**Closed by the pipeline.** One review round used (REVISE, then PASS on both axes). Gate green
cold in the lane after the rebase and again on `main`. Merged to `main` at `357e2e0`. Lane
database `DeanPOS_lane_foundation_04_ping_contract_api` dropped at close.

**The shape later areas copy** — this is the deliverable, not the ping:

- `packages/contract/src/contract.ts` — the hand-written procedure. The only place a shape is declared.
- `packages/contract/src/client.ts` — `createClient({ url, fetch? })`, typed `ContractRouterClient<typeof contract>`.
- `apps/api/src/routes/<area>.ts` — the only transport-aware code; binds a contract procedure to a handler and nothing else.
- `packages/backend/src/<area>/handlers/<verb-noun>.ts` and `src/<area>/db-operations/queries/*.query.ts` — per-area nesting, not a flat `src/handlers/`.
- `packages/backend/src/common/{ctx,handler}.ts` — `Ctx` and `Handler<TInput, TOutput>`.

**The test seam**, which the PRD calls the real deliverable of this area:
`createTestSeam(options?: { databaseUrl?, appDomain? }) => { app, client, db }` in
`apps/api/src/test-seam.ts`. A real oRPC client whose `fetch` is
`(request, init) => app.request(request, init)` — no port, no running server, no mock of
anything DeanPOS owns. It lives in `src/` rather than `tests/` so `apps/pos` and
`apps/backoffice` can import it cross-workspace in issues 06 and 07; the production entry
`apps/api/src/index.ts` does not import it, so it never reaches a runtime bundle.

**Proofs, not claims:**

- `packages/backend` imports neither oRPC nor Hono — grep returns nothing.
- The unimplemented-procedure property is pinned by a committed `@ts-expect-error` fixture at
  `apps/api/tests/router-contract.types.ts`, not by a one-off demonstration. I verified it
  bites by deleting the directive myself: `vp check` went red with `TS2741`. If an `@orpc/*`
  upgrade ever loosened `ContractedRouter` to make the key optional, the directive would
  become unused and the gate would go red — so it fails in the direction of the feared
  regression, which is what `hardening`'s coverage sweep depends on.
- Opaque errors are proven by forcing an unreachable database through the seam and matching
  the client-visible error against a leak regex. The reviewer confirmed the assertion is
  load-bearing rather than vacuous — the failure genuinely occurs inside the query.
- CORS is asserted through the seam: a non-allowlisted origin receives no
  `Access-Control-Allow-Origin` header at all, and each of `pos.` and `admin.` receives
  exactly its own. The apex landing origin is excluded and `api.` has no entry.

**Decision made during this issue:** `.scratch/decisions/006-rpc-and-validation-dependencies.md`
— **Stakes: high.** The RPC and validation dependency set. Notable because the sibling project
ApxDenta, which earlier records resolved by copying, is on **tRPC** — so there was no prior art
and the choice had to be made on its own merits. Lands `zod@4.4.3`, `@orpc/{contract,client,
server}@1.14.13`, and `hono@4.12.33` across four workspaces; forbids `@orpc/zod` and any
`@hono/*` adapter. `@orpc/tanstack-query@1.14.13` is reserved for issues 06 and 07.

**Environment note.** This issue introduced `APP_DOMAIN`, so any pre-existing `.env` goes stale
and the gate fails with `APP_DOMAIN is not set` — which reads like a code failure and is not.
`main` went red on exactly this and needed the variable added. Issue 08 owns the onboarding
documentation; this trap belongs in it.
