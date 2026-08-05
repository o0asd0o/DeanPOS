# 03 — The Options library: ModifierGroups, Modifiers, and the Delta

**Status:** done
**Category:** feature

## What to build

**This issue is where approach B is won or lost.** A ModifierGroup is a **tenant-level object with
its own screen and its own creation surface** — not something you make from inside a menu item.
*Size · Whole ×1.0 / Half ×0.5* is created once and later linked to fourteen ulam; it is never
retyped per dish.

The screen lists ModifierGroups with, per row, the group's selection rule, its Modifiers, and a
**linked-to count**. The count reads `0` for everything until issue 04 builds linking, and that is
correct rather than a gap — the column exists from the start because it is the mechanism by which
duplication becomes visibly absurd, and adding it later means shipping the screen without the one
feature that makes B worth choosing.

A **Modifier** never holds a price. It holds a typed `Delta`: `absolute` (± `Centavos`) or
`multiplier` (× rate). **The discriminator is a stored column, never inferred from the value** —
this is the entire reason the type exists, because `0.5` is otherwise a coin flip between fifty
centavos and half price.

A `multiplier` is stored as an **integer per-mille rate**: `×0.5` is `500`, `×1.25` is `1250`.
ADR-0005 prohibits floats in every layer including the wire and IndexedDB, and per-mille makes
`foundation`'s Delta application exact with no division — `Centavos × per-mille` **is**
`Millicentavos`. A rate needing more than three decimal places is rejected at configuration time,
not silently truncated.

**Do not round a modified price at the Modifier level.** Delta application returns
`Millicentavos`, the fraction survives composition exactly, and `roundLineTotal` collapses the
scale once at the OrderLine total in `checkout` (ADR-0005). This is worth a comment in the code
because it is the obvious wrong thing to do and an earlier `foundation` draft asserted the
opposite.

A group declares one of `required-one`, `optional-one`, or `many` (with an optional maximum), may
name a default Modifier, and its Modifiers reorder per record 039. A group set to `many` with
maximum `0` is configured, legal-looking and unsatisfiable — refuse it with a `CHECK`, not a
comment (`## Scenarios` row 25).

**The screen.** The existing `/add-ons` placeholder route becomes the Options screen and gains the
ModifierGroups card; issue 05 adds the Add-ons card beside it. Renaming the nav leaf from `Add-ons`
to `Options` touches records 020 and 022 — 022 fixed the three nav *groups*, not the leaf labels,
so this should be within bounds. **If the reviewer reads it as a contradiction with either record,
that goes to the `decider`, not to a fixer.**

## Acceptance criteria

- [ ] `ModifierGroup` and `Modifier` tables with `tenant_id`, RLS enabled and forced in the
      creating migration, composite FKs, and `@@unique([tenantId, id])` on both.
- [ ] `Delta` is stored with an explicit `kind` column (`absolute` | `multiplier`) and an integer
      value; a `multiplier` is per-mille. No float anywhere — schema, wire, fixtures, or tests.
- [ ] Bounds refused at write time, as digits and not adjectives: a `multiplier` is
      `0 < m ≤ 10000` per-mille — `0`, a negative, and `10001` are rejected, `10000` is accepted;
      an `absolute` Delta is within `±100,000` centavos.
- [ ] A rate needing more than three decimal places is rejected, not truncated.
- [ ] Delta validation is **property-tested as pure logic** against `foundation`'s money
      primitives, directly rather than through the seam.
- [ ] A group declares `required-one` | `optional-one` | `many`, may carry a maximum, and may name
      a default Modifier; a group with no default is accepted.
- [ ] `many` with maximum `0` is refused **by a database `CHECK`**, not by application code
      (`## Scenarios` row 25).
- [ ] Modifiers reorder within a group per record 039; groups and Modifiers archive, never delete.
- [ ] The Options screen lists groups with a `LINKED TO` count column, reading `0` until issue 04.
      The count is rendered from a query, not hardcoded to zero.
- [ ] The Delta editor uses **two radios, not a `<Select>`**, and the value field's affix renders
      `+₱` or `×` and changes as the radio changes, while the number is being typed
      (`## Direction` prohibition 2).
- [ ] No `toast()` on save — announcement goes through record 038's two alternating
      `role="status"` sr-only regions, failure inline (prohibition 5; the toast override in
      record 068 is scoped to the Availability screen alone).
- [ ] `cashier` cannot mutate; wrong-tenant probes on every procedure this issue exposes.
- [ ] WCAG 2.2 AA, asserted by the existing automated accessibility check.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/addons-1440.svg`

The Add-ons mock supplies the list shape this screen reuses — record 038's page header, one
`Card`, `ListToolbar` + `Table` + `TablePagination`. There is **no mock for the ModifierGroups
screen**, because the mock puts groups inside the item editor and approach B moved them out. Build
the list from 038's shape and the editor from record 049's detached non-modal `Sheet` plus 050's
`SheetForm`. Anything the mocks genuinely do not answer is an open question for the `decider`, not
a guess.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `ModifierGroup`, `Modifier`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create: tables, RLS, `CHECK`s
- `packages/backend/src/catalog/handlers/commands/` — edit: group and modifier commands
- `packages/backend/src/catalog/delta.ts` — create: bounds and validation, pure
- `packages/backend/src/catalog/delta.test.ts` — create: property tests
- `apps/backoffice/src/routes/_shell/add-ons.tsx` — edit: becomes the Options route
- `apps/backoffice/src/features/options/` — create
- `apps/backoffice/tests/options-screen.test.tsx` — create

## Depends on

- 02 — Variants, the price, and the archive cascade
