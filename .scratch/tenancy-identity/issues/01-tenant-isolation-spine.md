# 01 — The tenant isolation spine and the wrong-tenant probe helper

**Status:** ready-for-agent

## What to build

The thing every later slice in this area — and every area after it — stands on: a database
that refuses to hand one Tenant another Tenant's rows, and a test helper that proves it.

`Tenant` and `Store` exist as tables. Every tenant-owned table carries `tenant_id`, has
Row-Level Security **`ENABLED` and `FORCED`** — forced, so the table owner does not bypass
it — and is created with its policy **in the same migration**. The application connects as a
role that is neither superuser nor the tables' owner.

The tenant reaches the database exactly one way: `createDb` in
`packages/backend/src/db/client.ts`, the choke point `foundation` issue 03 established, opens
a transaction and calls `set_config('app.tenant_id', $1, true)` inside it. **Transaction-local,
not a bare `SET`** — `.scratch/decisions/004-postgres-driver.md` carries this forward as a
warning, because a bare `SET` survives the connection's return to the pool and hands the next
request the previous request's tenant.

**The tenant is derived, never supplied.** It comes from a principal on `Ctx` and from nowhere
else — not a header, not a query parameter, not a request body, not the subdomain. No
authentication exists yet, so until issue 03 the only thing that can construct a principal is
the test seam. That is the point: there must be no client-controlled path to a tenant id even
in this issue, where it would be convenient.

`Tenant` itself sits outside tenant RLS by construction — it is the isolation root, reachable
only through platform-admin paths (issue 02).

**The probe helper is the deliverable, not the Store table.** Eight later areas call it. It
expresses one assertion: authenticated as Tenant A, addressing Tenant B's id directly, the
answer is not-found or empty — never Tenant B's row, and never an error message that confirms
the row exists. It deserves the same care `foundation` gave the seam helper.

This is a prefactor. It ships no screen.

## Acceptance criteria

- [ ] `Tenant` and `Store` tables exist; `Store` carries `tenant_id` and is deactivated,
      never deleted. RLS is `ENABLED` **and `FORCED`** on `Store`, created in the same
      migration as the table.
- [ ] The application database role is neither superuser nor the owner of any tenant-owned
      table, and how it is provisioned is written down where a lane and a deployment both
      read it.
- [ ] Exactly one code path sets `app.tenant_id`, inside `createDb`, transaction-local via
      `set_config(..., true)`. Grep proves there is no second path and no bare `SET`.
- [ ] A connection returned to the pool carries no tenant: a query issued with no tenant set
      returns zero rows rather than another tenant's rows.
- [ ] `Ctx` carries a principal and the tenant is read from it only. Grep proves no code path
      reads a tenant from a header, a query parameter, a request body, or the hostname.
- [ ] The test seam can construct a request as a given Tenant's caller and as an
      unauthenticated caller, through the existing helper — no second copy of the setup.
- [ ] A reusable wrong-tenant probe helper is exported for later areas, and is used by this
      issue's own procedure.
- [ ] **RLS is proven to be doing the work, not the repository.** A query deliberately issued
      without its tenant predicate, through the same connection path, returns nothing. If the
      test passes only because a repository added a filter, it is lying and does not count.
- [ ] `Tenant` is outside tenant RLS and unreachable from a tenant-scoped principal.
- [ ] The existing `ping` and `health` paths still pass the gate unchanged.

## Depends on

- None — can start immediately. (`foundation` is complete; this consumes its choke point.)

## Relevant files

- `packages/backend/src/db/client.ts` — the choke point; the `set_config` guard lands here
- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**`
- `packages/backend/src/common/ctx.ts` — gains the principal
- `apps/api/src/context.ts` — builds it
- `apps/api/src/test-seam.ts` — gains the actors
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` — ADR-0002, Security criteria 1–3, and the
"Further Notes" warning that a second connection path makes this area uncompletable. If a
second path to a connection is found, raise it as a blocker rather than setting the session
variable in two places._

### Implementer notes (2026-08-02)

**No second connection path found.** `createDb` in `packages/backend/src/db/client.ts` remains
the only place `new Pool(...)` is constructed; a grep test
(`apps/api/tests/tenant-isolation-grep.test.ts`) asserts this and asserts `set_config(` appears
in exactly one file, transaction-local (`, true`), never a bare `false`.

**What was built.**

- `Tenant` and `Store` tables, one migration
  (`packages/backend/src/db/prisma/migrations/20260802065946_tenant_isolation_spine`). `Store`
  gets RLS `ENABLE` + `FORCE` and a policy `"tenantId" = current_setting('app.tenant_id', true)`
  in that same migration. `Tenant` also gets `ENABLE` + `FORCE` but **no policy at all** — Postgres
  denies every row to a non-owner role when RLS is on with zero policies, which is how "Tenant
  sits outside tenant RLS and is unreachable from a tenant-scoped principal" is satisfied for this
  issue; issue 02 adds whatever platform-admin path is meant to reach it.
- A restricted role `deanpos_app`, created by the same migration (`LOGIN` only — no `SUPERUSER`,
  no `CREATEROLE`, not the table owner). Verified directly against the lane database: `rolsuper`
  and `rolbypassrls` both `f`. The app and the test seam now connect through `APP_DATABASE_URI`
  (new), while migrations still run through `DATABASE_URI` (the owner) — the split decision 005
  already established for the owner side, extended here for the app side.
- `packages/backend/src/db/client.ts` gains `withTenantScope(db, tenantId, fn)`: opens
  `db.transaction().execute(...)`, calls `set_config('app.tenant_id', $1, true)` only when
  `tenantId` is non-null, then runs `fn` on the transaction-bound Kysely handle. This is the only
  code path that ever sets the tenant.
- `Ctx` (`packages/backend/src/common/ctx.ts`) gains `principal?: Principal | null` —
  `{ tenantId: string }`. Optional, so `apps/api` tests that build `{ db }` directly (ping,
  health) needed no changes and still typecheck.
- `apps/api/src/app.ts`'s `createApp` gains an optional `principal`, used only by the test seam
  (`apps/api/src/test-seam.ts`), never by production entry points (`index.ts`, `dev.ts`). Ctx is
  still built once per app instance rather than per HTTP request — deliberate for this issue,
  since no real request-derived principal exists until issue 03 builds sessions; the seam gets
  per-actor scoping by building one Hono app instance per actor
  (`test-seam.ts`'s `buildActor`), all sharing the one `db` from `createDb`. Issue 03 is where
  per-request derivation from a real session/token needs to land, and that will need this
  middleware to move from "closure captured at app-build time" to "read per request" — flagging
  it now so it isn't mistaken for finished work.
- A demonstration procedure, `store.get` (`packages/contract/src/contract.ts`,
  `apps/api/src/routes/store.ts`, `packages/backend/src/store/**`), used by this issue's own
  wrong-tenant probe test. Its query (`get-store.query.ts`) filters only by `id`, never by
  `tenantId` — the zero-rows-for-a-wrong-tenant result comes from RLS, not a repository filter.
- The reusable probe helper, `expectWrongTenantRefusal`
  (`apps/api/src/wrong-tenant-probe.ts`), accepting either a non-throwing refusal (`store.get`
  returns `null`) or a thrown `ORPCError` with code `NOT_FOUND`, and failing if a `NOT_FOUND`
  message contains "tenant" or "exists".
- `docker-compose.yml`'s `api` service and `.env.example` both gained `APP_DATABASE_URI` — the
  written-down provisioning the acceptance criteria asks for: both a lane (this worktree's
  `.env`, gitignored, updated locally so the gate runs) and a deployment (`docker-compose.yml`,
  tracked) point the running app at the same restricted role the migration creates.

**Verified directly against Postgres**, not just inferred from the SQL: seeded two Tenants and
two Stores as the owner role, confirmed the app role sees zero Store rows with no tenant set,
exactly its own Store with the tenant set, zero rows for the *other* tenant's Store id addressed
directly, zero Tenant rows under any condition, and an `INSERT` into `Tenant` as the app role
raises `new row violates row-level security policy`.

**Gate:** `vp run -w codegen`, `vp check` (`--fix` needed once for formatting), `vp run -r check`,
and `vp run -r test` all green. `packages/contract/tests/index.test.ts` was updated (it asserted
the contract's exact key list, which necessarily changes when a second procedure is added) — the
only pre-existing test touched; ping, health, cors, and opaque-errors tests are byte-for-byte
unchanged and still pass.

**The app role's password** is settled by `.scratch/decisions/027-the-app-role-credential.md`: a
development default with a per-deployment override, never a secret store.

**Self-check:** started a codex second-model review of this diff as a self-check; the
coordinator directed closeout to proceed before it returned, so its findings are not reflected
here. If it surfaces anything after the fact, that is input for the `reviewer`/`fixer` step, not
something this commit already addressed.
