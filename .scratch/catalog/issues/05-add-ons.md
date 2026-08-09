# 05 — Add-ons

**Status:** done
**Category:** feature

## What to build

*Extra rice, +₱15.* An **Add-on** is defined once for the whole Tenant, carries a typed `Delta`
and an optional maximum quantity, and is linked to the MenuItems whose Variants inherit it — so a cashier is
not offered *Extra rice* with a soft drink. An Add-on with no links is offered nowhere, and the
list says so rather than looking configured.

Add-ons join ModifierGroups on the Options screen as a second `Card`, reusing everything issue 03
and 04 built: the same Delta editor with its two radios, the same bounds, the same linked-to count
that excludes archived Variants, the same guard against a negative effective price.

**Linking runs from the MenuItem side, not from a list of every Variant in the tenant.**
`packages/ui` exports no combobox, and record 054's `AvailabilityField` proved a checkbox list is
unusable at sixty rows — the Add-ons list therefore keeps `LINKED VARIANTS` as **read-only text**,
exactly as 054 made `Available at` read-only text (`## Direction` prohibition 4). A manager links
an Add-on to a dish from the dish, where the list is a handful.

**A maximum enforced by the stepper is not enforced.** Two eggs must not become twenty because a
client was patched; the server re-validates the quantity against the Add-on's maximum, held to the
same standard as the ModifierGroup maximum. The behaviour when a maximum is lowered while a cart
already exceeds it is `checkout`'s (`## Scenarios` row 10) — do not implement it here.

## Acceptance criteria

- [x] An `AddOn` table with `tenant_id`, RLS enabled and forced in the creating migration,
      `@@unique([tenantId, id])`, and a link table to `MenuItem` with composite FKs on both sides.
- [x] An Add-on carries a `Delta` with an explicit stored `kind`, reusing issue 03's column shape
      and its bounds — no second Delta implementation, proven by a grep.
- [x] An optional maximum quantity; a maximum of `0` is refused by a database `CHECK`, matching
      how issue 03 refused `many` with maximum `0`.
- [x] Add-ons archive, never delete. Archiving one removes it from every MenuItem it was linked to
      and those MenuItems (and inherited Variants) stay sellable — archive cascade row 6.
- [x] Linking happens from the MenuItem editor; the Add-ons list renders `LINKED VARIANTS` as
      read-only text and exposes **no multiselect combobox and no checkbox list of every Variant**
      (`## Direction` prohibition 4) — asserted by a test, not only by review.
- [x] The linked count excludes links to archived MenuItems, same rule as issue 04
      (`## Scenarios` row 26).
- [x] The negative-effective-price guard from issue 04 covers Add-on linking and Add-on Delta
      edits — the same function, two more callers, not a second implementation.
- [x] An Add-on with zero links is visibly flagged in the list as offered nowhere.
- [x] The read model carries add-on links inherited by each Variant with their Delta and maximum.
- [x] A quantity above an Add-on's maximum is **rejected server-side**.
- [x] No `toast()` on save; announcement through record 038's live regions, failure inline.
- [x] `cashier` cannot mutate; wrong-tenant probes cover every procedure this issue exposes.
- [x] WCAG 2.2 AA, asserted by the existing automated accessibility check.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/addons-1440.svg`

The mock's columns are `ADD-ON · DELTA TYPE · VALUE · MAX QTY · LINKED VARIANTS`, which matches
what this issue builds. Note the mock draws this as its own screen; approach B places it as a
second `Card` on the Options screen alongside ModifierGroups. Everything else about the mock
holds.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `AddOn` and its variant link
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create
- `packages/backend/src/catalog/handlers/commands/` — edit: add-on commands and linking
- `packages/backend/src/catalog/guard-effective-price.ts` — edit: two more callers
- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — edit: add-on links
- `apps/backoffice/src/features/options/` — edit: the second `Card`
- `apps/backoffice/src/features/catalog/` — edit: linking from the Variant editor
- `apps/backoffice/tests/options-screen.test.tsx` — edit

## Depends on

- 04 — Linking ModifierGroups to Variants, and the negative-price guard
