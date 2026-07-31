# ADR-0010: VAT, Discounts, and Payment methods are tenant-configurable, and all three default to off

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, after reviewing the Loyverse POS manual against the DeanPOS plan
- **Amends:** ADR-0005 (the fixed 12% VAT-inclusive rule, and "manual price override is the
  only discount mechanism")

## Context

The plan hard-coded three things that the market does not hold constant.

**VAT.** ADR-0005 fixed displayed prices as VAT-inclusive at 12%. That is correct for a
VAT-registered business and wrong for most of the target market: a carinderia under the
₱3,000,000 annual threshold is not VAT-registered, files percentage tax instead, and must
not show a VAT line on anything. Baking 12% into every report would hand those tenants
figures that are confidently incorrect and imply a registration they do not have.

**Discounts.** ADR-0005 ruled out a promotions engine and made manual line override the
only way to reduce a price. That holds for marketing promotions. It does not hold for the
**Senior Citizen and PWD discount**, which is statutory, universal in Philippine food
service, applied several times a week in an ordinary carinderia, and carries a VAT
exemption on the discounted sale. Recording it as an untyped manual override computes the
wrong VAT and files a legal obligation as if it were the cashier's generosity.

**Payment methods.** `checkout` fixed the enum at `cash | card_manual`. In this market the
second-most-common tender is not a card — it is **GCash**, with Maya behind it. An owner
reconciling a GCash balance against a column labelled "card" is reconciling against a lie,
and the fix is not a bigger enum, because the next tender will arrive too.

The comparison product (Loyverse) makes all three tenant-configurable, which is the shape
this decision adopts.

## Decision

All three are **Tenant configuration**, and all three are **off or empty by default**. A
tenant that wants one turns it on. Nothing here is inferred from the tenant's country,
size, or catalog.

### VAT

- Tenant setting: `vatEnabled` (default **false**) and `vatRatePercent` (default `12`).
- **A price is always what the customer pays.** VAT is never added at checkout, in any
  configuration. This part of ADR-0005 is unchanged and is the reason the toggle is cheap.
- When `vatEnabled`, reports and receipts **back the rate out** of the recorded total.
  When it is off, no VAT figure is computed, displayed, exported, or stored.
- The rate and enablement in force **are captured on the Order**, alongside the recorded
  price. Turning VAT on next March must not retroactively invent VAT in February.
- No per-Variant VAT-exempt flag. Mixed VAT and non-VAT lines within one tenant are not
  supported. **Deferred, trigger:** a tenant selling both VATable and exempt goods —
  plausible only if DeanPOS moves outside prepared food.

### Discounts

- Tenant-configured list, empty by default. An empty list means the terminal shows no
  discount control at all.
- A **Discount** carries: name · type `percent` \| `amount` · scope `order` \| `line` ·
  an optional fixed value (a discount with no value is prompted for one at sale time) ·
  `requiresOverride` · `vatExempt` · `requiresReference` with a label.
- `amount` discounts are `order`-scoped only. Distributing a peso amount across lines is a
  rounding argument with no correct answer.
- `vatExempt` removes VAT from the discounted sale when VAT is enabled — this is the field
  that makes the SC/PWD case correct rather than approximate. **The order of operations is
  statutory, not ours:** strip VAT first, then discount the VAT-exclusive base.
  `base = subtotal / (1 + rate)` · `payable = base × (1 − percent)` · VAT recorded is zero.
  Discounting the VAT-inclusive price instead overcharges an entitled customer — on a
  ₱385.00 subtotal at 12% and 20%, ₱308.00 charged where ₱275.00 is due.
- `requiresReference` forces the cashier to record an identifying reference (the SC/PWD ID
  number) before the discount applies. The label is tenant-set, because the field means
  different things to different tenants.
- The discount **type, value, name, and reference are captured on the Order** at sale time,
  like a recorded price. Editing or deleting a Discount never rewrites a past sale.
- **This is still not a promotions engine.** No conditions, no schedules, no coupon codes,
  no buy-one-get-one, no customer segments, no stacking rules beyond "one Order-scoped
  discount and one per line". A Discount is a named, typed reduction a cashier applies on
  purpose.
- **Manual line override survives** as the untyped escape hatch, and stays manager-gated.
  The two are reported separately, because "we honoured a statutory discount" and "somebody
  changed a price" are different facts.

### Payment methods

- Tenant-configured list. `cash` always exists, cannot be renamed, and cannot be deleted.
- Every other method is a **recorded tender**: a name and a typed amount. DeanPOS
  authorises nothing, contacts no gateway, and confirms nothing. Presets offered at setup:
  Card, GCash, Maya, Bank transfer.
- **Only `cash` affects DrawerSession expected cash.** Every other method is excluded from
  the drawer, exactly as `card_manual` was.
- The method's **name is captured on the Payment** at sale time. Renaming or deleting a
  method never changes history — a receipt from March still says what it said in March.
- Split tender across two methods remains deferred (`checkout`).

## Consequences

- `reporting` gains *Sales by payment type* almost free — it is a `GROUP BY` over a column
  that now exists, instead of a two-value enum that did not deserve a report.
- Every money figure in every report becomes **conditionally VAT-aware**. Report tests must
  cover both a VAT-enabled and a VAT-disabled tenant, or half the product is untested.
- The Order grows captured configuration: VAT enablement and rate, discount name/type/value,
  discount reference, and payment method name. This is the same principle as the recorded
  price and for the same reason — a report reads what the sale said, never what the settings
  say now.
- Three new back-office configuration surfaces. Payment methods and VAT are Tenant settings
  (`tenancy-identity`); the Discount list is back-office CRUD alongside the catalog
  (`catalog`).
- **Defaulting all three to off means the out-of-the-box product is the simplest one**: cash
  only, no VAT, no discounts. That is a correct and complete POS for the median target
  tenant, and every added concept is one that tenant asked for.

## Reversing it

Cheap to widen, expensive to narrow. Adding a fourth configurable thing follows this
pattern. Removing the configurability means telling a live tenant their GCash column or
their senior discount is going away, which is not a migration, it is a conversation.

The one genuinely irreversible part is capturing configuration on the Order. Skipping that
is what makes it irreversible — a report that reads current settings to interpret old sales
silently rewrites history the first time a setting changes, and there is no way back.
