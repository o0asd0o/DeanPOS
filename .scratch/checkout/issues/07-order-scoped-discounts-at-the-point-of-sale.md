# 07 — Order-scoped Discounts at the point of sale

**Status:** done
**Category:** feature

## What to build

A senior citizen discount is one tap and not arithmetic. The Tenant's configured Discount list
(ADR-0010, owned by `catalog`) becomes a picker on the sale screen — **and when the list is
empty, no discount control renders at all**. The empty list is the default and the
configuration most tenants will keep, so its absence is a build check of its own, not a
conditional bolted on after the configured version renders.

At most **one Order-scoped Discount** per Order. Stacking rules beyond that do not exist,
because a stacking rule is the first step into a promotions engine. `amount` Discounts are
Order-scoped only; `percent` Discounts may be either scope, and the line scope is issue 08.

The arithmetic, in order:

```
per order    Σ OrderLine totals             exact integer sum, no rounding
             − Order-scoped Discount        computed from that subtotal,
                                            ROUND ONCE, half-up      ← rounded figure 2
             ─────────────────────────────
             Order total, Centavos
```

**The rule is "once per stored figure", not "once per Order".** The OrderLine total is rounded
figure 1 (issue 02); the Order-scoped Discount amount is figure 2. A sum of already-rounded
integers needs no rounding, which is why the Order total itself is never a rounding site.

**The Order captures the Discount's name, type, value, scope, and VAT-exemption** — the
recorded-price principle applied to the reduction. Editing or deleting the Discount later never
touches a completed sale.

**The terminal states what it applied; it does not state what that was worth.** The Discount's
economic effect is **recomputed server-side** from the captured type and value, and the
Discount id is validated against the Tenant's own configuration. A terminal naming another
Tenant's Discount is refused — not silently ignored, which would complete the sale at the wrong
price.

Discounts apply on the Device and work offline like everything else on this screen. The gates —
reference, override, prompted value — and the VAT-exempt computation are issue 09.

## Acceptance criteria

- [x] A Tenant with no Discounts configured renders **no discount control anywhere**, and the
      submit procedure **rejects an Order carrying a Discount** — the UI's absence is not the
      control.
- [x] The picker lists the Tenant's current, non-archived Discounts and applies one
      Order-scoped Discount to the order.
- [x] Two Order-scoped Discounts on one Order are rejected server-side.
- [x] An `amount` Discount is Order-scoped only.
- [x] The Order stores the Discount's id, name, type, value, scope, and VAT-exemption; editing
      or archiving the Discount afterwards changes neither the stored values nor the receipt.
- [x] The discount amount is recomputed server-side from the captured type and value and is
      rounded **exactly once**, half-up; the terminal's figure is not trusted.
- [x] A Discount id belonging to another Tenant, or not enabled for the Device's Store, is
      refused.
- [x] The Order total equals the sum of the stored line totals minus the stored discount amount
      — property-tested, and no Discount can drive a total below zero.
- [x] The receipt shows the discount with its name.
- [x] Applying a Discount issues no network request — it happens on the Device.
- [x] Wrong-tenant probes on any procedure this issue exposes; WCAG 2.2 AA.

## Visual reference

- Image · component: DiscountPicker · 1280: `design/lofi/pos/discount-picker-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/payment-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/receipt-1280.svg`

`discount-picker` is a **conditional surface**: it does not exist for a tenant with no
Discounts configured.

## Relevant files

- `apps/pos/src/features/discount/` — create: the picker, applied-discount state
- `packages/backend/src/order/` — edit: discount capture, server-side recomputation, validation
- `packages/backend/src/db/prisma/schema.prisma` — edit: `Order` discount capture columns
- `apps/pos/src/features/receipt/` — edit: the conditional discount line
- tests — edit: on-and-off configuration, property tests

## Depends on

- 04 — The receipt and the device-assigned order number
- `catalog` issue 06 (Discounts) must have landed — it supplies the list this consumes.

## Comments

- 2026-08-12: Closed with Device-local picker state, server-side catalog validation and
  recomputation, immutable Order snapshots, and receipt projection. Added POS accessibility
  coverage, API refusal/snapshot coverage, and a fast-check arithmetic property. Full backend
  and POS suites retain unrelated pre-existing failures (seed/design-value and test-environment
  paths); focused issue checks pass.
