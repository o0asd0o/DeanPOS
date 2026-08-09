# 11 — Void and the whole-order refund

**Status:** ready-for-agent
**Category:** feature

## What to build

The two corrections that cancel an entire sale, built together because they share every piece
of plumbing: a manager Override, a reason, an idempotent reversal record, and the rule that one
excludes the other.

```
draft ──pay──▶ paid ──┬── voided    whole order, manager Override, reason
                      └── refunded  whole or per-line, manager Override, reason
```

**Corrections are additive.** A Void cancels a whole paid Order; a whole-order Refund returns
the Order total, full stop — no apportionment, no summing of shares, no opportunity to be off by
a centavo. Both write **new records referencing the original without touching it**. The original
Order must come out byte-for-byte unchanged; assert that, not that a handler ran.

**An Order that is voided cannot be refunded and vice versa.** Both directions refused.

**Each reversal carries its own client-generated UUID**, produced on the Device when the manager
approves it, with a unique constraint per table. The Order's UUID is not sufficient: this area
allows cumulative partial refunds (issue 12), so "a retry of refund X" and "a second, legitimate
refund on the same Order" are indistinguishable by Order UUID alone. `offline-sync` replays all
three kinds and is **forbidden from inventing its own deduplication**, so the guarantee has to be
complete here.

Both work offline — the Override mechanism is `tenancy-identity`'s, consumed, never rebuilt.

Per-line refunds, apportionment, and the concurrency lock are issue 12.

## Acceptance criteria

- [ ] `Void` and `Refund` tables with `tenant_id`, RLS enabled and forced in the creating
      migration, `@@unique([tenantId, id])`, and a unique constraint on each record's client UUID.
- [ ] A manager voids a whole paid Order with a reason; a cashier's attempt is refused
      server-side, and the cashier is clearly prompted that a manager is required.
- [ ] A manager refunds a whole Order for **exactly the Order total**, with a reason.
- [ ] The original Order and its lines are byte-for-byte unchanged after either; any `UPDATE`
      against an Order or OrderLine is a review finding.
- [ ] Double submission of the same Void UUID yields exactly one Void; the same for a Refund —
      including two **concurrent** attempts.
- [ ] Refund after void and void after refund are both refused.
- [ ] The Override is single-use and bound to that one action instance; replaying one approval
      to authorise a second void fails.
- [ ] Both actions work with no network and are re-verified on arrival against the approver's
      role and Store membership as of then.
- [ ] With VAT enabled, a whole-order refund backs VAT out at the rate **captured on the Order**,
      never the Tenant's current rate; a refund of a sale that recorded zero VAT records zero VAT
      rather than omitting the field.
- [ ] Reason strings are untrusted input, bounded and validated; payloads and PINs never logged.
- [ ] Wrong-tenant and wrong-Store probes on every procedure this issue exposes; errors opaque.
- [ ] WCAG 2.2 AA on both flows.

## Visual reference

- Image · component: ManagerOverrideDialog · 1280: `design/lofi/pos/manager-override-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/receipt-1280.svg`

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `Void`, `Refund`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create: tables, RLS, unique
  constraints on the reversal UUIDs
- `packages/backend/src/order/` — edit: void and whole-order refund handlers
- `packages/contract/src/routes/order/` — edit: the reversal contracts
- `apps/pos/src/features/receipt/` — edit: the void and refund actions
- tests — create: idempotency under concurrency, mutual exclusion, unchanged original

## Depends on

- 03 — The paid Order: cash, idempotent submit, and the recorded price
