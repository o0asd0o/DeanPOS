# 04 — Ping through contract → api → backend, with health and CORS

**Status:** ready-for-agent

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
`packages/backend` holds the handler and `db-operations/{commands,queries}`, and imports no
transport library at all — a handler must be testable without an HTTP server.

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
- [ ] `packages/backend` imports neither oRPC nor Hono; the handler is exercised by a test
      with no HTTP server involved.
- [ ] The health endpoint reports liveness and database reachability as **two separate
      booleans** — "the container booted" and "the app can serve" are different answers.
- [ ] The health endpoint discloses nothing else: no version string, no connection details,
      no stack trace.
- [ ] Errors returned to a client are opaque; stack traces and database error text stay in
      the logs.
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
- `packages/backend/src/handlers/**`, `packages/backend/src/db-operations/queries/**`
- the shared test-seam helper (server half)

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 11–20, 38, 49, 49a; security criteria
1, 4, 5, 8). This is the fattest issue in the PRD and is deliberately not split — the ping
proves nothing until it crosses all four layers._
