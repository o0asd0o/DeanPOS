# 04 — Roles, Store membership, and the authorisation gate

**Status:** ready-for-agent

## What to build

One authorisation model for both surfaces: `cashier` < `manager` < `admin`, plus Store
membership. **Role answers *what kind of action*; membership answers *where*.** Both are
checked server-side on every procedure. The front end may hide what it must, but hiding is
presentation, never enforcement.

**Role and membership are append-only and effective-dated**, and that is not tidiness — it is
what makes a later sentence implementable. An Override created offline on Monday and replayed
on Wednesday must be re-verified against the role and membership that were in force **on
Monday** (issue 12). With a mutable role column and an undated `UserStore`, a manager demoted
on Tuesday would retroactively invalidate a legitimate Monday approval, and nothing would
record which it was. `UserRole` and `UserStore` therefore carry `effective_from` and are never
updated or deleted — un-assigning writes a closing row. `User` may carry the current role as a
denormalised convenience; `UserRole` is the truth.

Membership asks a different question on each surface, and the admin exemption is the part most
likely to be got wrong:

| | Terminal (`pos.`) | Back-office (`admin.`) |
| --- | --- | --- |
| `cashier` | must be a member of the Device's Store, or unlock is refused | sees only their own published Shifts and their own session summaries |
| `manager` | must be a member to unlock or approve an Override there | scoped to assigned Stores on every read and write |
| `admin` | **exempt** — may unlock any Device in their Tenant | sees the whole Tenant; `UserStore` rows are not required |

So a `cashier` with no `UserStore` row can reach nothing on either surface, and an `admin`
with no `UserStore` row is normal and expected.

Also here: the "as of a given time" lookup over both histories, which issue 12 consumes.

## Acceptance criteria

- [ ] `UserRole` and `UserStore` exist, carry `effective_from`, and are append-only. An
      `UPDATE` or `DELETE` against either is prevented, not merely discouraged.
- [ ] Un-assigning a Store writes a closing row; the previous assignment remains readable.
- [ ] Every procedure exposed so far is gated server-side on role and, where applicable, Store
      membership — asserted per procedure, per role.
- [ ] The admin exemption holds: an `admin` with no `UserStore` row reaches everything in
      their Tenant; a `cashier` with no `UserStore` row reaches nothing on either surface.
- [ ] A `manager` is scoped to their assigned Stores on every read and every write.
- [ ] A helper answers "what role did this User hold, and which Stores were they assigned to,
      at time T" against the effective-dated history, and is tested with a change either side
      of T.
- [ ] Authorisation failures do not disclose whether the addressed record exists.
- [ ] Wrong-tenant probes on every procedure this issue exposes or gates.

## Depends on

- 03 — Back-office sign-in, session, sign-out, and the `Origin` gate

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` —
  `UserRole`, `UserStore`
- `packages/backend/src/common/**` — the authorisation gate, applied at the handler boundary
  per ADR-0008
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` — "Store membership, per role and per surface",
Security criteria 13 and 21. DeanPOS has no per-User permissions; "the right to see expected
cash" is the Role (`manager` and `admin`), not a grantable flag, and `drawer-sessions` and
`reporting` both read that rule from here._

**Orchestrator note, 2026-08-02 — inherited from [record 029](../../decisions/029-how-a-tenant-row-is-created-under-rls.md).**

A pre-existing premise nothing asserts: the whole suite's `ownerDb` reads work **only because the
migrating role is a superuser under `FORCE ROW LEVEL SECURITY`**. The day a hardened environment
migrates as a non-superuser owner, every failure will read as an RLS bug rather than a setup one.

Add one assertion in the test setup that the migrating role is superuser, so the premise fails
loudly and in the right place. Cheap here; expensive to diagnose later.
