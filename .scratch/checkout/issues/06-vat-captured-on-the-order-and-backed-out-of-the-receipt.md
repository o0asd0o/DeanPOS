# 06 — VAT captured on the Order and backed out of the receipt

**Status:** ready-for-human
**Category:** feature

## What to build

A customer buying from a VAT-registered business gets a usable record; an owner who is not
registered gets receipts that do not imply a registration they do not hold.

**VAT is a Tenant setting, off by default** (ADR-0010), and it is **backed out, never added**.
Prices are what the customer pays in every configuration. When VAT is enabled, the Order
captures the **enablement and the rate in force at sale time**, and the receipt shows the VAT
contained in the total:

```
vat = total − total / (1 + rate)
```

When VAT is disabled there is no VAT figure computed, stored, or displayed — no zero, no empty
line, and nothing in the submit response or the persisted row.

**The enablement and rate are read from the Tenant server-side and captured on the Order.** A
terminal may not assert that a sale was VAT-exempt or state its own rate; a forged exemption is
a tax claim.

Use the existing `vatBackout` primitive. VAT-exempt Discounts change the computation order and
are issue 09; this issue is the ordinary case.

## Acceptance criteria

- [x] The Order stores VAT enablement and the rate percent in force at sale time, read
      server-side from the Tenant.
- [x] A rate or enablement asserted by the terminal is ignored or rejected — never trusted.
- [x] **VAT on:** the receipt shows VAT backed out of the Order total at the captured rate.
- [x] **VAT off:** no VAT line on the receipt and no VAT figure in the submit response or the
      persisted row.
- [x] Changing the Tenant's rate or enablement after a sale does not change that sale's stored
      figures or its receipt.
- [x] Property test, both configurations: VAT backed out and re-applied returns the original
      total; every intermediate is an exact `Millicentavos` integer.
- [x] Every existing money property in this area is re-asserted with VAT enabled and disabled.
- [ ] WCAG 2.2 AA; the VAT line is drawn from the mock, not improvised.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/receipt-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/receipt-390.svg`

The VAT line is a **conditional surface**. A non-VAT tenant has no VAT line anywhere — that
absence is the default configuration and needs its own build check.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `Order` VAT capture columns
- `packages/backend/src/order/` — edit: capture enablement and rate server-side
- `packages/schemas/src/money.ts` — read: `vatBackout`; do not duplicate
- `apps/pos/src/features/receipt/` — edit: the conditional VAT line
- tests — edit: on-and-off configuration and property tests

## Depends on

- 04 — The receipt and the device-assigned order number

## Comments

- 2026-08-12: Proven by `schemas` money properties, POS receipt tests, and API submit-order
  integration tests. The remaining visual reference check requires human review at 1280px and
  390px; it is intentionally unchecked.
