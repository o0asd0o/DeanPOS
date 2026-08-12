# 08 — Line-scoped Discounts and the before-rounding rule

**Status:** ready-for-agent
**Category:** feature

## What to build

Only the eligible person's meal is discounted. A `percent` Discount applies to a single
OrderLine, and **at most one per line**.

The rule that makes it correct:

```
per line     Variant price
             + Modifier and Add-on Deltas          exact, millicentavos
             − line-scoped Discount, if any        exact, applied to the UNROUNDED amount
             × quantity                            exact
             ─────────────────────────────────────
             ROUND ONCE, half-up  →  OrderLine total, Centavos    ← rounded figure 1
```

**A line-scoped Discount applies before the line's single rounding**, to the unrounded
millicentavo amount. Applying it after would round twice on every discounted line — that is the
defect this issue exists to prevent, and the test picks a price where the two orders of
operations differ by a centavo.

An `amount` Discount applied to a line is rejected server-side: distributing a peso amount
across lines is a rounding argument with no correct answer, and Order-scope is the decision.

A line-scoped Discount is **inside the recorded OrderLine total** — that is what "recorded"
means. It is not a second reduction and it does not exempt the line from the Order ratio when a
refund apportions it later (issue 12).

## Acceptance criteria

- [x] A `percent` Discount is applied to a single line and reduces exactly that line.
- [x] The reduction is applied to the **unrounded** millicentavo amount, before the line's
      single rounding — asserted on a price where discounting after rounding would differ by a
      centavo.
- [x] At most one line-scoped Discount per line; a second is rejected.
- [x] An `amount` Discount applied to a line is rejected **server-side**, not only in the UI.
- [x] A line-scoped Discount and an Order-scoped Discount coexist on the same order, each
      applied exactly once.
- [x] The line captures the Discount's name, type, and value alongside its recorded total.
- [x] Property test: exactly two figures are rounded on a sale with both scopes applied — the
      OrderLine total and the Order-scoped Discount amount.
- [x] The receipt shows the line's discount with its name.
- [ ] WCAG 2.2 AA.

## Visual reference

- Image · component: DiscountPicker · 1280: `design/lofi/pos/discount-picker-1280.svg`

## Relevant files

- `apps/pos/src/features/discount/` — edit: per-line application
- `apps/pos/src/features/sale/` — edit: line composition order of operations
- `packages/backend/src/order/` — edit: line discount capture and scope validation
- tests — edit: the before-rounding assertion, property tests

## Depends on

- 07 — Order-scoped Discounts at the point of sale

## Comments

- 2026-08-12: Implemented percent line Discounts with exact before-rounding arithmetic,
  server-side scope/catalog validation, immutable OrderLine snapshots, receipt projection, and
  coexistence with Order Discounts. Focused POS, contract, backend property, and API database
  tests pass. WCAG remains open for human visual and assistive-technology review; status remains
  non-done until that review passes.
