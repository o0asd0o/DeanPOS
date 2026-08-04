# 01 — Categories, MenuItems, and the read model's first shot

**Status:** ready-for-agent
**Category:** feature

## What to build

The spine of the catalog, proven end to end on its thinnest path: a Tenant's Categories and
the MenuItems inside them, a back-office screen to maintain both, and the one read-model
procedure a Device fetches — carrying a version — with categories and items in it.

**A MenuItem has no price and is not sellable.** One with zero non-archived Variants is a
half-finished draft: the back-office lists it and says so plainly, and it is excluded from the
read model. Variants arrive in issue 02, so at this issue's build point _every_ MenuItem is in
that state — which makes the exclusion easy to assert and easy to get wrong in the direction of
shipping an empty menu.

**Categories reorder here, and that order is the terminal's grid order.** Same for MenuItems
within a Category. Up/down `Button` pairs per record 039 — no drag surface — and the accessible
name names the list, not just the index. Two managers reordering concurrently must not land two
rows on the same sort position (`## Scenarios` row 21); state the tiebreak and assert it.

**Nothing is hard-deleted.** Archive only, the word `delete` nowhere, `Reactivate` unconfirmed
(records 038/041/044). Archiving a Category takes every MenuItem under it off every terminal, so
its confirmation dialog must state the count it takes with it — a confirm that names no
consequence confirms nothing (`## Direction` prohibition 6). Exclusion is computed from the
parent chain, never written down the tree, so archiving a Category is one row and cannot
half-fail.

**The version is record 069's**, and this issue is where its mechanism first exists: a SHA-256
of the assembled payload cast to `jsonb`, per `(tenant, store)`, 64 lowercase hex, opaque.
Record 070 computes it per request with a version-only procedure that never sends the payload.
Read both before writing the query — the `::jsonb` cast is load-bearing and the prohibitions in
069 §2 (no timestamp, no `updated_at`, no request id, no server clock anywhere in the payload)
are the way this silently stops working while every test stays green.

## Acceptance criteria

- [ ] `Category` and `MenuItem` tables exist with `tenant_id`, RLS `ENABLED` and `FORCED` in the
      creating migration, and composite `(tenant_id, id)` FKs — structure copied from
      `packages/backend/src/db/prisma/migrations/20260803130000_payment_methods`, not from prose.
- [ ] A manager creates a Category, renames it, and archives it; a MenuItem is created inside
      one, renamed, moved to another Category, and archived — in
      `packages/backend/src/catalog/handlers/commands/`.
- [ ] Both lists reorder with up/down `Button` pairs per record 039, and two concurrent reorders
      cannot produce two rows at one sort position — asserted with two concurrent writes, not
      one sequential pair (`## Scenarios` rows 13, 21).
- [ ] A MenuItem with no non-archived Variant is **absent from the read model** and is listed in
      the back-office flagged `not sellable — no variant`, whose row action reads `Add a variant`
      rather than `Edit` (`## Direction` prohibition 7).
- [ ] Archiving a Category excludes its MenuItems from the read model by parent chain, writing
      exactly one row; un-archiving restores those that were never themselves archived —
      verified by `apps/backoffice/tests/catalog-screen.test.tsx` and a backend test.
- [ ] The archive dialog states the count of MenuItems it takes with it, reusing 041's
      `DeactivateDialog` shape and not its Store copy.
- [ ] `catalog.read({ storeId })` returns categories and items in sort order plus
      `version: string`, 64 lowercase hex. `catalog.version({ storeId })` returns the same value
      and **selects only the hash column** — the payload never leaves the database (record 070).
- [ ] Equal versions mean equal payloads, asserted in both directions; a no-op save on a MenuItem
      does **not** move the version (`## Scenarios` row 11, and read 069's Discount carve-out
      before writing this test).
- [ ] A Category with zero non-archived MenuItems still renders as a tab in the read model, or
      does not — decide, state it in the issue's `## Comments`, and assert whichever
      (`## Scenarios` row 16).
- [ ] A brand-new Tenant fetches a read model with zero Categories and receives an empty list per
      field, never an omitted field (`## Scenarios` row 19).
- [ ] A 60-character name and an emoji name are accepted or rejected at a stated bound; the bound
      is set here, and tile rendering is `checkout`'s (`## Scenarios` row 27).
- [ ] `cashier` cannot mutate anything here, enforced server-side; `admin` and `manager` can.
      Wrong-tenant probes on every procedure this issue exposes, including the read model.
- [ ] WCAG 2.2 AA, asserted by the existing automated accessibility check.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/catalog-list-1440.svg`
- Image · component: confirmation · 1440: `design/lofi/backoffice/deactivate-dialog-1440.svg`

The Categories rail is the left column of the Catalog screen and that placement is settled
(`## Direction`, rightly-obvious). The list shape is record 038's: page header, then a single
`Card` holding `ListToolbar` + `Table` + `TablePagination`, nothing between them, with the
`overflow-x-auto py-1` wrapper whose `py-1` is load-bearing.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `Category`, `MenuItem`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create: tables, RLS, policies
- `packages/backend/src/catalog/handlers/commands/` — create: create/rename/archive/reorder
- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — create: the read model
- `packages/backend/src/catalog/handlers/queries/catalog-version.ts` — create: hash only
- `packages/contract/src/contract.ts` — edit: the `catalog.*` procedures
- `apps/backoffice/src/routes/_shell/catalog.tsx` — edit: replace the placeholder
- `apps/backoffice/src/features/catalog/` — create: the screen and its parts
- `apps/backoffice/tests/catalog-screen.test.tsx` — create

## Depends on

None.

## Comments

- A non-archived Category remains in the device read model even when it has no sellable MenuItems: the Category is a terminal tab and its ordering is meaningful.
- Category and MenuItem names are trimmed, require 1–60 characters, and accept emoji. Tile truncation belongs to `checkout`.
- Concurrent reorders are resolved by partial unique indexes on active sort positions. A conflicting write is refused rather than permitting duplicate positions.
