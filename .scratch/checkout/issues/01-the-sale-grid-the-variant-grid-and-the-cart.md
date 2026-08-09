# 01 — The sale grid, the variant drill-down, and the cart

**Status:** ready-for-agent
**Category:** feature

## What to build

The screen a cashier stands in front of all day. The Store's menu is a grid of tappable tiles
grouped by Category, with a search box for the rarely-sold item. Tapping a MenuItem **replaces
the tile grid in place** with that item's Variants and a breadcrumb back to the full menu; the
cart never unmounts and never moves. Selecting a Category while drilled in exits the
drill-down — there is no second back control to learn.

**A draft Order exists on the Device from the first tap** and holds a client-generated UUID
assigned at creation. It is persisted locally, so a reload mid-order costs the customer
nothing. **It is never sent to the server** — this issue writes no server procedure and creates
no table. The server sees an Order for the first time at payment (issue 03).

Two layouts, not one breakpoint. Tablet landscape puts the grid and the cart side by side;
phone puts the grid full-width with the cart as a bottom sheet carrying the running total.

**The tap-count rules are the point of the drill-down, not a nicety.** A MenuItem with exactly
one Variant skips the variant step. A Variant with no modifier groups and no add-ons skips
straight into the cart — a bottle of water is one tap. An unavailable Variant is visibly
unsellable and cannot be added.

**Speed is asserted, not asserted-to-be-felt.** The catalog read model may be fetched once when
the screen loads; **building an order after that issues zero network requests**. Tested by
driving the flow with the transport stubbed to throw. Offline catalog caching itself is
`offline-sync`'s (area 5) — this issue relies only on what the terminal already holds in its
query cache and its local draft.

Lines whose composition needs a modifier or add-on choice are issue 02; this issue adds the
optionless case and the cart that holds it.

## Acceptance criteria

- [ ] The sale screen renders the Device's Store catalog from the existing catalog read model,
      authorised by the Device token — grouped by Category, with unavailable Variants rendered
      unsellable and refused on tap.
- [ ] Search narrows the grid by name.
- [ ] Tapping a MenuItem replaces the grid in place with its Variants; the back control returns
      to the full menu; selecting a Category also exits the drill-down; the cart is unchanged
      throughout.
- [ ] A MenuItem with exactly one Variant skips the variant step; a Variant with no modifier
      groups and no add-ons goes straight into the cart.
- [ ] The draft carries a client-generated UUID from creation, persists to local storage, and
      survives a terminal reload with its lines intact.
- [ ] The running Order total is visible while building, both layouts.
- [ ] Clearing a non-empty order is confirmed first; clearing an empty one needs no confirm.
- [ ] Both layouts built from their own mock — 1280 side-by-side, 390 grid plus bottom sheet.
      A width not drawn is a translation and is flagged as such in the build report.
- [ ] A test drives building a three-line order with the transport stubbed to throw and it
      completes — zero network requests after the initial catalog load.
- [ ] WCAG 2.2 AA, asserted by the existing automated accessibility check, with touch targets
      and one-handed reach honoured on 390.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/sale-grid-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/sale-grid-390.svg`
- Image · whole-screen · 1280: `design/lofi/pos/variant-grid-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/variant-grid-390.svg`
- Image · whole-screen · 390:  `design/lofi/pos/cart-390.svg`

The mocks fix what is on screen and in what order. Everything else comes from `packages/ui`
tokens. What they do not decide — empty states, loading, error and disabled treatments — goes
to the `decider`, not to an implementer's judgement.

## Relevant files

- `apps/pos/src/routes/` — create: the sale route
- `apps/pos/src/features/sale/` — create: grid, variant grid, cart, draft store
- `apps/pos/tests/` — create: sale-screen tests, the zero-network test

## Depends on

- None — can start immediately. Consumes the `catalog` read model and `tenancy-identity`'s
  Device token, both already shipped.
