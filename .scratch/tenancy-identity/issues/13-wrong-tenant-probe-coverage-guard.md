# 13 — The wrong-tenant probe coverage guard

**Status:** needs-information

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

---

## ESCALATED 2026-08-04 — round cap exhausted, NOT merged

**Two fix rounds were used and three BLOCKING findings survive.** Per `.orc2/ORCHESTRATOR.md`, round
exhaustion is a deadlock between two agents and does not go to the decider. The branch
`13-probe-coverage-guard` is **left in place, unmerged**, at `acd4396`.

**The work is real and mostly done.** Gate green at **623** tests (`main` is 589), five runs with
three fully clean and two showing only the known pre-existing flaky tests. The guard exists, the
retrofit is complete across all 39 contract procedures, three procedures that had **no probe at all**
gained one (`device.pendingCodes`, `device.cancelCode`, `device.generateCode`), and four probes that
were hollow in this PRD's characteristic way were fixed rather than merely tagged — including
`auth.signIn`, which probed a **random email that belonged to no tenant**, so it exercised an absent
account rather than a reachable wrong-tenant one.

### Why it is deadlocked

The reviewer's remaining fix for two of the three is *"replace lexical inference with AST
traversal"*. **That is not available.** `typescript@7.0.2` in this repo no longer exposes
`ts.createSourceFile` at its main entry — a fixer discovered this independently in issue 10 — and no
new dependency may be added. The reviewer and the constraints are asking for incompatible things,
which is precisely the deadlock the round cap exists to surface.

### What survives, stated honestly

**1 and 2 are adversarial bypasses, not accidents.** Each needs someone with commit access to write
code deliberately shaped to fool the scanner:

- A regex literal after a control-closing `)` that contains a complete fake probe —
  `if (flag) /it("wrong-tenant probe [store.update]: fake", …)/.test(value)` — is read as a real
  probe though no test registers. Quoted text inside `${...}` is likewise treated as code.
- File-level `if` and ternary guards around registration still yield `skipped: false`. A `return`
  inside an unrelated nested callback yields a false `skipped: true`, which fails safe. An early
  `throw` is runner-fatal, so not a silent bypass.

**3 was the one that mattered, and it is fixed** — by making the documentation true rather than the
code stronger. `mode: "effect"` is satisfied by `{ otherBefore: true, otherAfter: async () => true }`.
Rule 11 claimed the thunk re-reads; **the helper cannot verify that**. Rule 11 now says so plainly,
mirroring the caveat it already carried for `ownerSees`. A guard that overstates its guarantee is
worse than one with a documented limit, and record 062 was explicit about not doing that.

### The human's call

Three options, in the order I would rank them:

1. **Merge as-is.** The guard catches the accident it was built for — a procedure shipped with no
   probe — and its limits are documented in rule 11. It does not resist a hostile author who already
   has commit rights, and it was never going to.
2. **Add a real parser.** A dev-only dependency (`acorn`, or a working TypeScript AST) makes findings
   1 and 2 closable properly. That is a dependency decision with a reversal cost, and it is yours.
3. **Reduce scope.** Keep the enumeration and the tag convention, drop the static block checks, and
   rely on the helper's runtime assertions plus review.

**Nothing downstream is blocked either way** — the guard is additive and every other issue in this
PRD is merged.
