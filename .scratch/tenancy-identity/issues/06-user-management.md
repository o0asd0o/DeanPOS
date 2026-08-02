# 06 — User management

**Status:** ready-for-agent

## What to build

The screen where a restaurant's staff become accounts. A tenant admin creates a User with an
email, a role, and an admin-set temporary password — **there is no invitation, because no
email transport exists**. They assign the User to one or more Stores, promote them without
issuing a new account, reset a forgotten password in-house, and deactivate a leaver.

**Deactivation is immediate and it is a flag, never a delete.** The User's existing sessions
are revoked on the spot, and their past Orders and Overrides stay attributed to them, because
an audit trail that loses its people is not an audit trail. Their PIN hash leaves the Devices
on the next sync — that half lands in issue 10, which builds the sync payload.

Store assignment and role change both write append-only effective-dated rows (issue 04). This
screen never updates one.

Visibility follows the same model as everything else: a `manager` sees the Users assigned to
their own Stores, so they know who can open a DrawerSession. A `cashier` can see and change
nothing about any other User — the system does not depend on their restraint.

## Acceptance criteria

- [ ] An admin creates a User with an email, a role, and a temporary password; the User must
      change it at first sign-in (issue 03's path).
- [ ] A User is assigned to one or more Stores, and un-assigned — the un-assignment writes a
      closing row rather than deleting the assignment.
- [ ] An admin changes a User's role; the change writes a new effective-dated row and the
      previous role remains readable.
- [ ] An admin resets a User's password to a new temporary one.
- [ ] Deactivating a User is immediate: their existing sessions are revoked, and they can
      reach nothing on either surface.
- [ ] A deactivated User's historical attribution survives — no row that references them is
      rewritten or orphaned.
- [ ] A `manager` sees the Users assigned to their own Stores and no others; a `cashier` can
      neither read nor modify any other User.
- [ ] Nothing logs a password or a temporary password.
- [ ] WCAG 2.2 AA on the screen, asserted by the existing automated accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/users-1440.svg`

## Depends on

- 05 — Store management

## Relevant files

- `packages/backend/src/**` — User handlers and db-operations per ADR-0008
- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**`
- `apps/backoffice/src/routes/**` and `apps/backoffice/src/features/**` — per ADR-0009
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 7–13, 19), Security criterion 16.
The PIN half of a User — setting, changing, resetting, and the removal of a deactivated User's
hash from Devices — is issue 10, which is where a Device exists to sync to._

**Orchestrator note, 2026-08-02 — inherited from [record 031](../../decisions/031-how-a-query-with-no-tenant-reads-a-row.md).**

Admin-initiated password reset is the likely **third pre-auth lookup**. Two named GUCs
(`app.login_email`, `app.session_id`) are a pair; a third is a pattern that gets copied badly.
Record 031's named trigger fires here: **the answer is a narrowly-scoped `SECURITY DEFINER`
function, not `app.something_else`.** Route to the `decider` before adding a GUC.

Also inherited: `User.email` is **globally** unique, and record 031 found that is a hard
precondition of `user_login_lookup` being a one-row read — per-tenant uniqueness would make the
same policy text match one row per sharing tenant, an actual cross-tenant read. Do not change
one without the other; they move together in a single record.
