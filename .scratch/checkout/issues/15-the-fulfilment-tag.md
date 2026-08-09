# 15 — The fulfilment tag

**Status:** ready-for-agent
**Category:** feature

## What to build

A sale records how the food left the counter: `dine_in` | `take_out` | `delivery` | `pick_up`,
chosen on the sale screen and captured on the Order.

**The tag is recorded and not interpreted** (ADR-0011). **v1 branches on it nowhere**: no
routing, no fee, no separate pricing, no service charge, no address, no courier, no preparation
queue. `reporting` shows it as a column and a filter and builds no breakdown around it. An Order
may also carry no tag at all.

**Noted for v2:** `take_out`, `pick_up`, and `delivery` overlap in ordinary usage, and the
distinction that will matter is who carries the food and who pays for that — settle the taxonomy
when a tenant needs it to mean something. Nothing acts on the tag, so changing its meaning later
is a backfill and not a behavioural risk.

## Acceptance criteria

- [ ] The sale screen offers the four tags; choosing one is optional.
- [ ] The chosen tag is captured on the Order and rendered where the Order is read back.
- [ ] An Order tagged `delivery` produces **byte-for-byte the same** totals, receipt, and drawer
      effect as an untagged one. If any figure moves, something branched on the tag and should
      not have.
- [ ] The tag is validated server-side against the four permitted values; anything else is
      rejected.
- [ ] No code path branches on the tag — asserted by the equality test above, not by inspection.
- [ ] WCAG 2.2 AA.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/sale-grid-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/sale-grid-390.svg`

The tag control is not separately drawn — its placement is a translation and must be flagged as
such in the build report.

## Relevant files

- `apps/pos/src/features/sale/` — edit: the tag control
- `packages/backend/src/db/prisma/schema.prisma` — edit: `Order` fulfilment column
- `packages/backend/src/order/` — edit: validation and capture
- tests — edit: the inertness assertion

## Depends on

- 03 — The paid Order: cash, idempotent submit, and the recorded price
