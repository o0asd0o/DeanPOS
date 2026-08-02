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
