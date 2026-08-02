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
