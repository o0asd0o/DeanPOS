# 10 — The manual line override

**Status:** ready-for-agent
**Category:** feature

## What to build

The untyped escape hatch: a manager adjusts one line's price for a legitimate one-off reason,
without a promotions engine and without anyone editing the catalog.

**A manual override is not a Discount and must not become one** (ADR-0010). It carries a
manager Override, a reason, and **the original price recorded alongside the overridden one**, so
the adjustment is measurable rather than invisible. `reporting` shows the two separately, because
"we honoured a statutory discount" and "somebody changed a price" are different facts about a
business.

The Override mechanism is `tenancy-identity`'s: the manager enters their PIN on the terminal, it
is verified against the locally synced hash, and the approval travels with the Order for server
re-verification on arrival. **This area consumes that mechanism and must not build a second
one** — which is also why overrides work during an outage.

An overridden price is **inside the recorded OrderLine total**, exactly like a line-scoped
Discount. It is not a second reduction and it does not exempt the line from the Order ratio when
a refund apportions it later (issue 12).

## Acceptance criteria

- [ ] A manager applies a price override to a single line; the cashier gets a clear prompt that
      a manager is required.
- [ ] The line stores the overridden price, **the original price**, and the reason.
- [ ] The action is authorised **server-side** with a valid Override for that specific action
      instance; a UI-only gate is a defect and a cashier's unapproved attempt is refused.
- [ ] The Override is single-use — replaying one approval to authorise a second override fails.
- [ ] The override works with no network at all, verified against the locally synced hash, and
      is re-verified on arrival against the approver's role and Store membership as of then.
- [ ] The overridden figure is the line's recorded total and is rounded exactly once.
- [ ] The reason string is untrusted input, bounded and validated; PINs and payloads are never
      logged.
- [ ] Wrong-tenant probes on the procedure; WCAG 2.2 AA.

## Visual reference

- Image · component: ManagerOverrideDialog · 1280: `design/lofi/pos/manager-override-1280.svg`

## Relevant files

- `apps/pos/src/features/sale/` — edit: the line override action
- `apps/pos/src/features/override/` — read: the existing Override prompt
- `packages/backend/src/order/` — edit: override capture and server-side authorisation
- `packages/backend/src/db/prisma/schema.prisma` — edit: `OrderLine` original-price column
- tests — edit: authorisation, single-use, offline

## Depends on

- 03 — The paid Order: cash, idempotent submit, and the recorded price
