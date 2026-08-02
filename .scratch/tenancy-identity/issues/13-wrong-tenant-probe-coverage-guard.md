# 13 — The wrong-tenant probe coverage guard

**Status:** ready-for-agent

## What to build

Security criterion 3 says every procedure has a wrong-tenant probe, no exceptions, including
read-only ones. Right now that is a habit, and habits decay across nine remaining areas and
hundreds of procedures. This turns it into a gate.

A test enumerates the procedures the contract exposes and fails if any one of them has no
wrong-tenant probe asserting against it. Adding a procedure without a probe should break the
build on the day it is added, not be noticed in a review three areas later.

**Keep it mechanical and keep it honest.** The guard proves a probe exists, not that it is a
good one — so it must not be satisfiable by an empty or trivially-passing test. If the only
way to make the guard reliable is a naming or registration convention, establish that
convention here and write it down; every later area inherits it.

Also the sweep: close any procedure this area shipped that the guard now shows uncovered.

## Acceptance criteria

- [ ] A test enumerates every procedure the contract exposes and fails when one has no
      wrong-tenant probe.
- [ ] The guard is demonstrated to work: adding a procedure with no probe fails the gate, and
      the demonstration is reverted.
- [ ] The guard cannot be satisfied by an empty or no-op probe.
- [ ] Every procedure shipped by issues 02–12 passes it, with no exclusions list. If an
      exclusion is genuinely unavoidable, it is named individually with a written reason —
      never a wildcard.
- [ ] The convention later areas must follow is documented where the roles that write
      procedures will read it.

## Depends on

- 02 — Platform-admin tenant provisioning
- 03 — Back-office sign-in, session, sign-out, and the `Origin` gate
- 04 — Roles, Store membership, and the authorisation gate
- 05 — Store management
- 06 — User management
- 07 — Tenant settings
- 08 — Payment methods
- 09 — Device enrolment, the Device principal, and revocation
- 10 — PIN unlock and the hash-sync payload
- 11 — PIN throttling and lockout
- 12 — The Override mechanism and its as-of-time re-verification

## Relevant files

- `packages/contract/src/contract.ts` — the enumeration source
- the shared test helpers introduced by issue 01
- `docs/agents/code-standards.md` — where the convention is written down

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` — Security criterion 3, and the "Further Notes"
observation that the probe helper outlives this PRD and eight later areas will call it. This is
the last issue in the area; it runs after everything else has merged._
