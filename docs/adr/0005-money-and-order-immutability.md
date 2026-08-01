# ADR-0005: Money representation, VAT, and the immutability of a paid Order

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

Everything a POS is for. Getting money representation or the sales ledger's mutability
wrong is not a bug class you patch later — it is a reconciliation problem you own
forever.

## Decision

**Money**

- Currency is **PHP only**. Multi-currency is a non-goal.
- All amounts are **integer centavos**. Floats are prohibited in every layer, including
  the wire format and IndexedDB.
- ~~Displayed prices are **VAT-inclusive at 12%**.~~ **Amended by ADR-0010, 2026-07-31:**
  a price is always what the customer pays; VAT is never added at checkout — that part
  stands. But VAT is a **Tenant setting, off by default**, with a configurable rate, and
  the enablement and rate in force are captured on the Order. Most target tenants are
  below the ₱3,000,000 registration threshold.
- **Rounding happens once per stored figure, half-up.** **Amended by ADR-0010,
  2026-07-31:** originally "once, at the OrderLine total", which was complete before an
  Order-scoped Discount existed. **Amended again 2026-08-01:** a partial Refund of a
  discounted Order apportions the discount and is therefore fractional, so the Refund amount
  is a stored figure too. There are now exactly **three** rounded figures — the OrderLine
  total, the Order-scoped Discount amount, and the Refund amount — and none is ever rounded
  twice. The **final** Refund that clears an Order returns the remaining balance rather than a
  freshly computed share, so apportionment residue can be neither lost nor duplicated.
  The Order total is the sum of already-rounded integers minus the rounded discount amount,
  so it is exact and is not itself a rounding site. Intermediates are exact `Millicentavos`
  (centavos × 1000); floats remain prohibited in every layer.

**Pricing tree**

- Price lives on the **Variant**. A MenuItem has no price and is not sellable.
- A **Modifier** or **Add-on** carries a typed **Delta**: `absolute` (±centavos) or
  `multiplier` (×rate). The type is a stored field, never inferred from the value.

**Order lifecycle**

```
draft ──pay──▶ paid ──┬── void   (whole order, manager Override)
                      └── refund (whole or line, manager Override)
```

- `paid` is **irreversible**. Nothing after it edits an Order or an OrderLine.
- Void and Refund **write new records** referencing the original. They never mutate it.
- An OrderLine captures its price **at sale time** and keeps it forever, regardless of
  later catalog changes (see ADR-0003, *recorded price*).

**Manager Override required for:** void a paid Order, refund (whole or line), manual
line discount / price override, closing a DrawerSession with a cash Variance beyond threshold.
Each Override records the approving User and a reason.

## Consequences

- The sales ledger is append-only and auditable by construction. Reports never need to
  ask "was this edited?".
- ~~With a promotions engine ruled out as a non-goal, **manual price override is the only
  discount mechanism**~~ — **amended by ADR-0010, 2026-07-31.** A rule-based promotions
  engine is still a non-goal, but discounting is now a tenant-configured list of **typed,
  person-applied Discounts** (off by default), which is what makes the statutory Senior
  Citizen / PWD case computable. Manual price override survives as the untyped escape
  hatch, still manager-gated and logged, and is reported separately from a Discount.
- Rounding is a named, tested rule. A `roundLineTotal` helper with property tests is a
  Foundation-or-Catalog deliverable, not something each handler reimplements.

## Reversing it

Money representation and rounding: expensive after real sales, cheap before.
Order immutability: reversing it means abandoning auditability, and no partial version
of it is coherent.
