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
