# 05 — Store management

**Status:** ready-for-agent

## What to build

A tenant admin creates the outlets their business runs, renames one without calling support,
and deactivates one that closes — never deletes it, because its historical sales stay intact
and attributable. They see their own Tenant's Stores and nobody else's; the back-office is not
a shared address book.

Two Store-scoped settings live with the Store rather than on the sales-settings screen,
because they are properties of an outlet:

- **Business-day start**, defaulting to `00:00`. A shop closing at 2am should not split its
  night across two days. `reporting` and `drawer-sessions` read it.
- **Table labels** — an ordered list of free strings, **empty by default** (ADR-0011). A label
  is not a resource: nothing tracks occupancy and nothing prevents two Tickets carrying the
  same label. An empty list means the terminal shows no table control at all and the cashier
  types a label instead. `checkout` reads it.

Both obey the rule every setting in this area obeys: **a setting governs sales made from now
on, and the value in force is captured on the sale.** Editing or removing a table label never
rewrites a past Order. No Order exists yet, so the assertion that a change leaves captured
values untouched belongs to `checkout` — see Comments.

**There is no lofi mock for this screen.** Follow the list-and-editor pattern the back-office
shell already establishes; `design/lofi/backoffice/users-1440.svg` is the nearest sibling and
may be read as a *pattern* source, not as a contract for this screen.

## Acceptance criteria

- [ ] A tenant admin creates a Store, edits its name and details, and deactivates it. Nothing
      hard-deletes a Store.
- [ ] A deactivated Store remains readable and attributable; it is not offered as a target for
      new work.
- [ ] The Store list shows only the caller's own Tenant's Stores.
- [ ] Business-day start is set per Store and defaults to `00:00`.
- [ ] Table labels are a Store-scoped ordered list of free strings, empty by default;
      reordering, adding, and removing all work, and duplicates are permitted.
- [ ] Only `admin` may create, edit, or deactivate a Store; `manager` and `cashier` are
      refused server-side, and a `manager` sees only their assigned Stores.
- [ ] WCAG 2.2 AA on the screen, asserted by the existing automated accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes — including the read-only ones.

## Depends on

- 04 — Roles, Store membership, and the authorisation gate

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**`
- `packages/backend/src/**` — Store handlers and db-operations per ADR-0008
- `apps/backoffice/src/routes/**` and `apps/backoffice/src/features/**` — per ADR-0009
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 3–6, 6b) and ADR-0011._

_**Obligation carried forward to `checkout`:** the PRD asks for one test per setting proving a
change leaves every existing Order's captured values untouched. No Order exists in this area,
so the capture assertions for business-day start and table labels transfer to `checkout`,
which owns the Order. This area asserts the settings side only._

### Implementer's notes (2026-08-03)

Built: the `Store` schema/migration additions (`businessDayStart`, `tableLabels`, additive
only), `store.list/create/update/deactivate/reactivate` procedures alongside the existing
`store.get`, `auth.me`'s new `role` field (issue 04 had not added it), and the back-office
`Stores` screen (`apps/backoffice/src/features/stores/`) per records 038/039/040. Ran the
self-review (`/code-review`, Standards + Spec axes) against the diff before committing and
applied its actionable findings: moved the capture-note paragraph under the business-day-start
hint (040 §2 placement), removed a dead `opener.current` assignment in the deactivate handler,
and added the missing wrong-tenant probe for `store.reactivate`.

**Two things flagged rather than silently resolved, for the reviewer:**

1. **Record 039 clause 4 vs. its own most-important check.** Clause 4 chooses **native**
   `disabled` for the first row's ↑ and the last row's ↓. Testing that literally — focus the
   row-1 "move down" button, activate it three times via the keyboard — proved native `disabled`
   breaks the record's own named critical check: HTML spec moves focus off a control the instant
   it becomes `disabled`, so on the third press (the row's down button legitimately becomes the
   last-row button) focus is silently dropped to `<body>`, exactly the "reads as having done
   nothing" failure SC 2.5.7 exists to prevent. Record 039's own "What would make this decision
   wrong" section **pre-decides the fix** for this exact symptom: "`aria-disabled` plus an
   early-returning handler... keeps the tab order fixed." I implemented that pre-decided
   successor rather than ship a control that fails its own critical test, and I'm flagging it
   here rather than treating record 039's `Status: decided` as silently overridden — a proper
   superseding record may still be warranted.
2. **Record 038's own strings vs. its own reviewer check.** The verbatim deactivation-dialog
   body (038's string table) reads "...and nothing is deleted." The same record's reviewer
   check is `rg -in 'delete|permanently' apps/backoffice/src/features/stores` returning nothing.
   Those two clauses of 038 contradict each other. I implemented the verbatim string as written
   (it is the record's explicit "every string, verbatim" content) rather than silently rewrite
   copy the record fixed; the `rg` check will fail as written and needs a record update, not an
   agent's unilateral copy edit.

**Toolchain note:** in this environment the `Bash` tool and the `Edit`/`Read`/`Write` tools
sometimes read from different filesystem views — an `Edit` that `Read` confirms can be invisible
to a subsequent `Bash cat`/`prisma generate`. Worked around by making structural edits (schema,
contract, generated-type-dependent files) via `Bash`/`python3` heredocs instead, verified with
`Bash cat`. Noting it here in case it recurs for the reviewer or fixer.
