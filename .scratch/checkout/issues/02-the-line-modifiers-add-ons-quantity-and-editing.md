# 02 — The line: modifiers, add-ons, quantity, and editing a line

**Status:** ready-for-agent
**Category:** feature

## What to build

The rest of building an OrderLine. A Variant that carries modifier groups or add-ons opens a
modal that carries **modifiers and add-ons only** — Variants are the grid behind it (issue 01),
which is what keeps this modal small enough to fit a phone without scrolling in the common
case.

A required Modifier group cannot be skipped: there is no way to ring up an *Adobo* with no
size. A group's default Modifier is preselected, so the common case is one tap. An Add-on may
be added more than once up to its configured maximum — two eggs is possible, twenty is not.

**A line is edited, not rebuilt.** Changing a line's quantity, and changing its Modifiers and
Add-ons, each recompute the line total and the running Order total, and the line **keeps its
identity in the cart**. Building a line from scratch does not exercise mutating one, which is
why this is called out.

Line arithmetic is exact `Millicentavos` throughout — Variant price plus Modifier and Add-on
Deltas, times quantity — and collapses to `Centavos` through `roundLineTotal` **exactly once**,
at the line total. Use the existing money primitives; do not write a second rounding function.
This is still a local draft: nothing here talks to the server.

## Acceptance criteria

- [ ] A Variant with modifier groups or add-ons opens the picker; a required group must be
      satisfied before the line can be added.
- [ ] A group's default Modifier is preselected.
- [ ] An Add-on can be added repeatedly up to its maximum and not beyond.
- [ ] A line carries a quantity; three of the same item is one line.
- [ ] An existing line's quantity is changed and its Modifiers and Add-ons are edited; both
      recompute the line total and the running Order total, and the line keeps its identity in
      the cart. Asserted as two distinct tests.
- [ ] A line is removed from the cart.
- [ ] Every intermediate is an exact `Millicentavos` integer; the line total is rounded exactly
      once, half-up, through the repository's single rounding function.
- [ ] Property test over generated catalogs and carts: a line total is always a non-negative
      integer number of centavos and is never rounded twice.
- [ ] Ringing a half-adobo with extra rice shows the correct figure on screen — assert what the
      customer would see, never that a pricing helper was called.
- [ ] Both layouts built from their own mock; WCAG 2.2 AA.

## Visual reference

- Image · component: ModifierAddonModal · 1280: `design/lofi/pos/modifier-picker-1280.svg`
- Image · component: ModifierAddonModal · 390:  `design/lofi/pos/modifier-picker-390.svg`

## Relevant files

- `apps/pos/src/features/sale/` — edit: the picker modal, line composition, the cart
- `packages/schemas/src/money.ts` — read: `Millicentavos`, `roundLineTotal`; do not duplicate
- `apps/pos/tests/` — edit: line composition and line-editing tests

## Depends on

- 01 — The sale grid, the variant drill-down, and the cart
