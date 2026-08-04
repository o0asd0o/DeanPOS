# 04 — Linking ModifierGroups to Variants, and the negative-price guard

**Status:** ready-for-agent
**Category:** feature

## What to build

The link that makes issue 03's library pay off, and the guard that stops it producing a price
below zero.

**Attaching is a link, not a copy.** One ModifierGroup, many Variants; editing the group updates
every Variant using it, which is the whole reason it is shared. The Variant editor gains a
**picker over what already exists** — and nothing else.

**The prohibition this issue exists to enforce: there is no `+ Add modifier group` in the item
editor.** That control is in the lo-fi mock, and building it is the single most likely way this
product ships as per-item duplication — thirty items, thirty `Size` groups, drifting rates, which
is the abandonment cause the PRD's `## Further Notes` name (`## Direction` prohibition 8). Creating
a group happens on the Options screen or it does not happen. **This is not negotiable by an
implementer, and a reviewer finding it in the item editor is a blocking Spec finding.**

**The linked-to count must be true before an edit is saved, not after.** A manager about to change
`Half` from ×0.5 to ×0.6 sees *"linked to 14 variants"* while deciding, not in a toast afterwards.

**The negative-price guard, from all three directions.** A negative effective price is reachable
three ways and must be blocked at all three by **one function called from each write path**, not
three checks that drift:

1. lowering a Variant's price below what a linked absolute Delta subtracts,
2. linking a group to a Variant too cheap for it,
3. editing a linked Modifier's Delta.

`## Scenarios` row 3 is direction 1 and is the one an implementer forgets, because it is a write
to a different table than the one holding the Delta.

**Composition order must be stored, not guessed** (`## Scenarios` row 15). Two `required-one`
groups on one Variant whose defaults are both ×0.5 compose to ×0.25, and whether that is intended
is not this issue's call — but *which order they apply in* must be deterministic and recorded, or
two terminals compute different totals from the same catalog. **If the PRD does not fix the order,
that is an open question for the `decider`, not a default for the implementer to pick.**

**A count that lies defeats the mechanism** (`## Scenarios` row 26). An Add-on or group linked to a
Variant that is later archived must not keep being counted — the linked-to count is approach B's
entire user-facing argument, and a count including dead links is worse than no count.

## Acceptance criteria

- [ ] A link table joining `Variant` to `ModifierGroup`, `tenant_id` present, RLS enabled and
      forced in the creating migration, composite FKs on both sides so a cross-tenant link is
      impossible at the database rather than in a handler (Security Criterion 5).
- [ ] The Variant editor links and unlinks existing groups and **exposes no creation control** —
      asserted by a test that fails if one appears, not only by review.
- [ ] Editing a shared ModifierGroup changes every Variant linked to it, asserted through the read
      model.
- [ ] The Options screen's `LINKED TO` count is real, and **excludes links to archived Variants**
      (`## Scenarios` row 26).
- [ ] The count is visible in the group editor **before** a save, not after.
- [ ] One guard function refuses a negative effective price, called from all three write paths;
      each path has its own test (`## Scenarios` row 3). A test that covers only the Delta-edit
      path does not satisfy this.
- [ ] Composition order for two `required-one` groups on one Variant is deterministic and stored;
      if the PRD does not fix it, the issue is routed to the `decider` and the record linked here
      before implementation (`## Scenarios` row 15).
- [ ] Archive cascade rows 4–5: archiving a ModifierGroup removes it from every Variant it was
      linked to, and those Variants stay sellable **unless** the group was `required-one`, in
      which case they leave; archiving the last Modifier of a `required-one` group removes that
      group's Variants (`## Scenarios` row 4).
- [ ] Two managers editing the same shared group from two browsers — state the concurrency
      behaviour and assert it. Record 067 §3 chose last-writer-wins per pair for availability;
      either follow it or diverge explicitly, and route the divergence to the `decider`
      (`## Scenarios` row 2).
- [ ] The read model carries groups, modifiers, and each `required-one` group's default.
- [ ] `cashier` cannot mutate; wrong-tenant probes on every procedure this issue exposes.
- [ ] WCAG 2.2 AA, asserted by the existing automated accessibility check.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/menuitem-editor-1440.svg`

**Read the mock against `## Direction` first.** Its Modifier-groups section shows the shape a
linked group renders as, which is useful. Its `+ Add modifier group` button is the thing this
issue exists to not build. The mock is intent, not a contract, and approach B overrode it here on
the record.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: the variant↔group link
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create
- `packages/backend/src/catalog/guard-effective-price.ts` — create: the one guard, three callers
- `packages/backend/src/catalog/handlers/commands/` — edit: link, unlink, and the three guarded paths
- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — edit: groups and defaults
- `apps/backoffice/src/features/catalog/` — edit: the Variant editor's picker
- `apps/backoffice/src/features/options/` — edit: the real linked-to count
- `apps/backoffice/tests/menu-item-editor.test.tsx` — edit: the no-creation-control assertion

## Depends on

- 03 — The Options library: ModifierGroups, Modifiers, and the Delta
