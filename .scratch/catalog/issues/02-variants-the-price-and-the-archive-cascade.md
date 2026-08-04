# 02 — Variants, the price, and the archive cascade

**Status:** ready-for-agent
**Category:** feature

## What to build

The thing that can actually be sold. A **Variant** belongs to a MenuItem, carries a name and a
price, and is the only object in this area that holds a price at all (ADR-0005). *Ulam* is not
buyable; *Adobo at ₱120* is.

With Variants in place the MenuItem editor becomes real, and the archive cascade's first three
rows become assertable: archiving a Category takes its MenuItems and their Variants; archiving a
MenuItem takes its Variants; archiving a Variant takes only itself — and takes the MenuItem too
if it was the last non-archived one, because a MenuItem with no Variant is not sellable.

**Price handling is prescribed and the prescriptions are not stylistic.** No `type="number"` and
no `₱` inside the field — `inputMode="decimal"`, the peso sign rendered outside the input, parsed
to `Centavos` at the boundary (`## Direction` prohibition 3; `type="number"` ships a spinner on a
price and accepts `1e3`). One money formatter everywhere, two decimals, tabular figures per record
013 — `₱120.00` in the table and `120` in the editor is how a manager reads ₱1,200 as ₱120.00
(prohibition 9). A price pasted as `₱1,200.00`, typed as `120.505`, or typed as `1e3` is each
handled at a stated bound (`## Scenarios` row 14).

**A price change affects future Orders only.** Do not implement that here and do not write a test
for it — `checkout` captures the recorded price at sale time (ADR-0003), OrderLines are area 4,
and at this issue's build point there are no price-capturing rows, so the assertion cannot fail
and would be a test that proves nothing. Say so in the build report rather than adding it.

**Save must be idempotent.** Clicking Save twice on a slow connection must not produce two
Variants named *Adobo* under one MenuItem (`## Scenarios` row 24). Record 067 §3 already requires
this shape for availability; the same standard holds here.

## Acceptance criteria

- [x] `Variant` table with `tenant_id`, RLS enabled and forced in the creating migration, a
      composite `(tenant_id, id)` FK to `MenuItem`, and **its own `@@unique([tenantId, id])`** —
      record 071 needs it to build the availability FK in issue 07, and adding it later is a
      second migration.
- [x] Price stored as integer `Centavos` using `foundation`'s primitive. No float reaches the
      database, the wire, or a test fixture (ADR-0005).
- [x] A manager creates, renames, re-prices, reorders and archives Variants inside the MenuItem
      editor; ordering uses record 039's up/down `Button` pairs.
- [x] The price input is `inputMode="decimal"` with the peso sign outside it, and `₱1,200.00`,
      `120.505` and `1e3` are each accepted-or-rejected at a stated bound — asserted in
      `apps/backoffice/tests/menu-item-editor.test.tsx`.
- [x] One money formatting helper is used by every catalog surface; a grep proves no second one
      exists.
- [x] Archive cascade rows 1–3, one test per level, asserted **against the read model** rather
      than against a join: Category → its MenuItems and Variants leave; MenuItem → its Variants
      leave; Variant → siblings unaffected, and the MenuItem leaves when its last non-archived
      Variant does.
- [x] Un-archiving a Category whose MenuItems were separately archived restores only what was
      never itself archived (`## Scenarios` row 5); un-archiving a Variant under a still-archived
      MenuItem leaves it absent from the read model (row 28, and see record 071 §3 for its
      availability row).
- [x] Two rapid identical Save submissions produce one Variant, not two (`## Scenarios` row 24).
- [x] An archived Variant is absent from the read model and still readable by id.
- [x] The read model gains variants with their prices, and a price change moves the version while
      a no-op save does not (record 069).
- [x] `cashier` cannot mutate; wrong-tenant probes on every procedure this issue exposes.
- [x] WCAG 2.2 AA, asserted by the existing automated accessibility check.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/menuitem-editor-1440.svg`

**Read `## Direction` before building this screen.** The mock is flagged `Stakes: high` as being
the obvious version drawn — a full-page stacked form with Save bottom-right — and it is silent on
the two questions that decide whether this catalog is maintainable. Its Modifier-groups section
is **out of scope here** and its `+ Add modifier group` button must not be built: issue 03 owns
that object and prohibition 8 forbids creating one from an item editor.

Prohibition 1 also applies: no `Sheet` opened from inside a `Sheet`. Record 049's editor is
`modal={false}` with no overlay, so two stacked panels have no z-order story, and 050 notes a
nested form's submit bubbles to the outer handler and fires a save nobody asked for. A Variant is
edited in the row that shows it, **or** the MenuItem editor is a route rather than a sheet — pick
one, state which in `## Comments`, never both.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `Variant`, plus `@@unique([tenantId, id])`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create
- `packages/backend/src/catalog/handlers/commands/` — edit: variant commands
- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — edit: variants and cascade
- `apps/backoffice/src/features/catalog/` — edit: the MenuItem editor
- `apps/backoffice/tests/menu-item-editor.test.tsx` — create

## Depends on

- 01 — Categories, MenuItems, and the read model's first shot
