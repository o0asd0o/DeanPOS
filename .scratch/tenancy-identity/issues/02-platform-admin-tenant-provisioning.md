# 02 — Platform-admin tenant provisioning

**Status:** ready-for-agent

## What to build

The way a restaurant comes to exist. A platform admin provisions a Tenant and its first admin
User; that User then takes over their own setup. There is no self-serve signup in v1, and no
email is sent, because DeanPOS has no email transport — the first password is set by the
platform admin and must be changed on first sign-in.

**Platform-admin identity is separate from any Tenant's users.** It is not a Tenant User with
a special role, and it does not act by assuming a Tenant's account. Its actions are audited:
who provisioned which Tenant, and when.

Password hashing arrives here because provisioning is the first thing that needs it:
`node:crypto`'s scrypt at OWASP's parameters, no new dependency, parameters configured in
one place — see `.scratch/decisions/028`. PIN hashing gets its own parameters later (issue
10) — the two are configured separately, because the PIN's hash ends up sitting on a
tablet.

## Acceptance criteria

- [ ] Provisioning creates a Tenant and exactly one `admin` User for it, with an admin-set
      temporary password flagged as must-change.
- [ ] Platform-admin identity is a distinct principal from any Tenant User. No code path lets
      a platform admin act as a Tenant's User.
- [ ] Every platform-admin action writes an audit row naming the actor, the action, and the
      Tenant.
- [ ] Password hashing runs from one implementation on both the production runtime and the
      test runtime, with parameters declared in one place, storing a self-describing hash
      string; the round-trip **and a published known-answer vector** are tested **directly,
      not through the seam** — it is a pure function over a hashing primitive.
- [ ] Nothing logs a password, a password hash, or the temporary password. Log the User id.
- [ ] Provisioning is unreachable from a tenant-scoped principal and from the `admin.` origin
      session paths — asserted, not assumed.
- [ ] A freshly provisioned Tenant is isolated on arrival: the wrong-tenant probe from issue
      01 passes against every procedure this issue exposes.

## Depends on

- 01 — The tenant isolation spine and the wrong-tenant probe helper

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` — `User`,
  the platform-admin table, the platform audit table
- `packages/backend/src/**` — provisioning handler and its db-operations, per ADR-0008
- `packages/contract/src/contract.ts`
- `apps/api/src/context.ts` — the platform-admin principal

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 1, 2, 47). Self-serve signup,
billing, and plan limits are explicitly out of scope for v1; so is email transport of any
kind, and therefore invitation and verification emails._

**Implementer, 2026-08-02 — two blockers, both routed to the decider, neither fixed unilaterally.**

Everything is built: `User`, `PlatformAdmin`, `PlatformAuditLog` in `schema.prisma` and the
migration; the `PlatformAdminPrincipal` / `ctx.platformAdmin` plumbing through `ctx.ts`,
`context.ts`, `app.ts`, `test-seam.ts`; the `platformAdmin.provisionTenant` contract procedure,
handler, db-operations, and route; the audit row; and the full test file
`apps/api/tests/platform-admin-provision-tenant.test.ts`. 3 of its 6 tests pass, including both
required negative tests (tenant-scoped principal refused, unauthenticated caller refused, both
via `expectWrongTenantRefusal`) and a direct RLS proof that a tenant-scoped connection cannot
insert an arbitrary `Tenant` row. `vp run -w codegen` and `vp run -r check` are fully green.

**Blocker 1 — `Bun.password` cannot execute under this project's `vp test` gate.** Verified
directly: `vp test` runs vitest under `vp`'s own bundled Node runtime (`process.versions.node`,
no `bun` key), never Bun, and there is no documented `vp` option to select Bun as the test
runtime (checked `vp test --help`, `vp env --help`, and web search — the only documented way to
get `Bun` global into vitest is `bun run --bun vitest`, which needs a project-level `vitest`
binary this repo doesn't have; `vp` bundles its own, privately, at `~/.vite-plus`). Concretely:
every test that calls `hashPassword` — the dedicated unit test and every provisioning test that
reaches a successful create — fails with `ReferenceError: Bun is not defined`. Type-checking
also failed (`Cannot find name 'Bun'`) until I added a local, dependency-free ambient
declaration, `packages/backend/src/common/bun-password.d.ts`, scoped to only the `Bun.password`
shape actually used — that's why `vp check` is green even though `vp test` is not. I did not
add `@types/bun` (a new devDependency) or swap to `node:crypto`'s built-in `argon2`/`argon2Sync`
(confirmed present and zero-dependency, but low-level — no PHC-string encoding, so using it
means hand-rolling salt generation and hash encoding myself, a security-relevant design choice).
Both are legitimate resolutions; neither is mine to pick.

**Blocker 2 — found while fixing blocker 1's fallout: no policy lets `deanpos_app` insert a
`Tenant` row at all, and the obvious fix breaks a locked issue-01 test.** `Tenant` has RLS
`ENABLED` + `FORCED` with no policy (issue 01), which the acceptance criteria there commits to:
`packages/backend/tests/db/with-tenant-scope.test.ts`'s `"Tenant is outside tenant RLS and
unreachable even from a tenant-scoped connection"` asserts zero rows for a tenant-scoped
connection querying `Tenant` at all — not "unreachable for other tenants," unreachable, full
stop. My first attempt added `CREATE POLICY ... USING ("id" = current_setting('app.tenant_id'))`
so provisioning could scope its transaction to the new Tenant's own id (reusing
`withTenantScope` with no second `set_config` call site, per this issue's own instruction not to
add one). That let the platform-admin path insert — but it also let an *ordinary* tenant-scoped
principal read its own `Tenant` row, which is exactly what issue 01's test forbids. I reverted
it (migration now has no `Tenant` policy, same as issue 01 left it) rather than ship a passing
provisioning test at the cost of a regression the reviewer wouldn't see me un-doing. The
question — how a strictly unprivileged, non-superuser app role is meant to insert the one row
issue 01 declared totally unreachable — needs a decision (a second, distinct session variable
for "platform-admin mode"; a `SECURITY DEFINER` function narrowly scoped to this one insert; or
something else), and it's exactly the class of call this issue told me to stop and report rather
than pick. `withTenantScope`/`client.ts` are untouched.

Branch `ti02-platform-admin-tenant-provisioning`. Full diff and both failing test files are
committed as-is — visibly red, not hidden — so the decision has the real repro in front of it.
