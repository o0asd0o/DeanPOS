# 12 — Refund per line, apportioned and serialised

**Status:** ready-for-agent
**Category:** feature

## What to build

A customer returns one of three dishes. The manager picks the lines and the quantities, sees
what is still refundable on each, and refunds in one action. **This is where money silently goes
wrong**, so the arithmetic is written out rather than inferred.

**A partial refund returns what the line actually cost, not what it was listed at.** An
Order-scoped Discount came off the whole bill, so every line was effectively sold for less than
its recorded total. Refunding a line at its recorded total hands back money the customer never
paid.

```
line share of the Order        = OrderLine total × (Order total / Σ OrderLine totals)
                                 computed in exact Millicentavos

refund amount for a selection  = Σ the shares of the selected lines and quantities
                                 ROUND ONCE, half-up  →  Centavos       ← rounded figure 3

FINAL refund clearing the Order = Order total − everything already refunded
                                 (the remaining balance, not a recomputed share)
```

**The ratio is `Order total ÷ Σ line totals`, not `1 − discount ÷ Σ line totals`.** They agree
for an ordinary Discount and disagree for a VAT-exempt one, where the discount is computed on
the VAT-exclusive base and the VAT comes off as well. The ratio form states *what was actually
paid over what was listed*, so it holds for every configuration: VAT on or off, exempt or not,
discount or none.

**A line carrying a line-scoped Discount or a manual override is not an exception.** Both are
already inside the recorded OrderLine total — that is what "recorded" means — so they are
apportioned exactly once by being part of the figure the ratio multiplies. Such a line **still
gets the Order ratio**, because an Order-scoped Discount reduced it too. Reduced once, not twice.

**The last refund returns the remaining balance.** Apportioning leaves a residue of a centavo or
two that no line owns; the refund that clears the Order absorbs it, so refunding every line one
at a time returns **exactly** the Order total.

**Reversals against one Order serialise, and the check is inside the write.** Idempotency on a
reversal's own UUID makes a *retry* safe; it does nothing about two *different* refunds arriving
together, which is exactly what an Outbox drain after an outage produces. Two requests can each
read ₱100.00 remaining and each commit ₱100.00, returning ₱200.00 on a ₱100.00 sale — and the
same race lets a Void and a Refund both observe `paid` and both commit. **Read-remaining and
write-reversal happen in one transaction that takes a lock on the Order.** This is the one place
in the product where two writers contend for the same row, and it is where money is.

## Acceptance criteria

- [ ] The refund picker lets a manager choose lines and quantities, and each line shows what is
      still refundable after any earlier partial refund.
- [ ] The refund amount is the summed apportioned shares, rounded **exactly once**, half-up —
      the third and last rounded figure in this area.
- [ ] **Named example, ordinary Discount:** ₱385.00 subtotal, ₱77.00 Order-scoped discount,
      ₱308.00 total; one ₱120.00 line returned → **₱96.00**. Asserting ₱120.00 is the bug this
      test exists to catch.
- [ ] **Named example, VAT-exempt:** same subtotal, 12% VAT, 20% SC/PWD, total ₱275.00; the same
      line returns **₱85.71** and the refund records **zero VAT**. Both examples required — a
      rule written as `1 − discount/subtotal` passes the first and over-refunds the second.
- [ ] A line carrying **both** a line-scoped Discount and an Order-scoped one refunds its ratio
      share of the already-reduced recorded total — reduced once, not twice. Same for a line
      carrying a manual override.
- [ ] Property test over generated carts and discounts, both VAT configurations: refunding every
      line individually, in any order, returns **exactly** the Order total, with the final refund
      absorbing the residue.
- [ ] Cumulative partial refunds may never exceed the Order total, enforced **server-side from
      persisted rows**, never from a client-supplied remaining balance.
- [ ] Two different refunds submitted **concurrently** against one Order cannot both succeed
      beyond the remaining balance, and a concurrent Void and Refund cannot both commit —
      asserted with genuinely parallel requests, not sequential ones. A sequential test passes
      against the broken implementation.
- [ ] Two refunds on the same Order with **different** UUIDs both apply, cumulatively — which is
      what makes issue 11's idempotency assertion about idempotency rather than about refusing a
      second refund.
- [ ] The refund's VAT is backed out at the rate captured on the Order; a refund of a sale that
      recorded zero VAT records zero VAT.
- [ ] Manager Override required per refund, single-use, works offline; the original Order stays
      byte-for-byte unchanged.
- [ ] Wrong-tenant and wrong-Store probes; WCAG 2.2 AA on the picker.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/refund-picker-1280.svg`
- Image · component: ManagerOverrideDialog · 1280: `design/lofi/pos/manager-override-1280.svg`

## Relevant files

- `packages/backend/src/order/` — edit: apportionment, remaining-balance query, the locking
  transaction
- `packages/backend/src/db/prisma/schema.prisma` — edit: refunded-line rows
- `apps/pos/src/features/refund/` — create: the line and quantity picker
- tests — create: the two named examples, the concurrency tests, the property test

## Depends on

- 11 — Void and the whole-order refund
- 09 — The Discount gates and the VAT-exempt computation
