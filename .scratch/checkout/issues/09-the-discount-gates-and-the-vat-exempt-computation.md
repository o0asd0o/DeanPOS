# 09 — The Discount gates and the VAT-exempt computation

**Status:** ready-for-agent
**Category:** feature

## What to build

The three things a configured Discount can demand before it applies, and the one computation
that makes a statutory exemption correct rather than approximate.

**The reference.** A Discount with `requiresReference` refuses to apply until the reference is
entered; the prompt's label comes from the Discount's own configuration. The captured reference
is stored on the Order and shown on the receipt. **A discount reference is personal data** — a
Senior Citizen or PWD ID identifies a real person. It is **never logged**, and it falls under
`hardening`'s export and deletion procedures. Renaming the label later does not alter references
already captured.

**The manager.** A Discount with `requiresOverride` needs an Override from `tenancy-identity`.
This area **consumes that mechanism and must not build a second one**. The Override is
single-use, bound to that one action instance, and authorised **server-side, per sale** — a
UI-only gate is a defect. The cashier gets a clear prompt that a manager is required, so they
call one instead of improvising.

**The prompted value.** A Discount with no configured value prompts the cashier, bounded by its
type: `0 < v ≤ 100` for `percent`, and for `amount`, positive centavos not exceeding the total.
A negotiated reduction is still recorded as a named Discount rather than a price edit.

**The VAT-exempt computation.** VAT is stripped **first** and the discount applies to the
VAT-exclusive base. This is the statutory Philippine Senior Citizen / PWD computation, not a
DeanPOS invention:

```
base     = subtotal / (1 + rate)
discount = base × percent
payable  = base − discount
vat recorded on the sale = 0
```

Worked example, ₱385.00 subtotal, 12% VAT, 20% VAT-exempt discount: base ₱343.75, discount
₱68.75, **payable ₱275.00, VAT ₱0.00**. Applying the discount to the VAT-inclusive ₱385.00
instead yields ₱308.00 and **overcharges an entitled customer by ₱33.00**.

When VAT is disabled there is no base to strip: a `vatExempt` Discount behaves as an ordinary
percent Discount and no VAT figure exists.

Discounts and their Overrides work offline, like everything else on this screen.

## Acceptance criteria

- [ ] A `requiresReference` Discount refuses to apply until the reference is entered; the prompt
      uses the label from the Discount's configuration.
- [ ] The reference is stored on the Order and rendered on the receipt.
- [ ] A `requiresReference` Discount submitted without a reference is refused **server-side**.
- [ ] The reference never reaches any log — asserted by a test.
- [ ] Renaming the `requiresReference` label after sales captured references under the old one
      does not alter those captures.
- [ ] A `requiresOverride` Discount prompts for a manager in the UI and is refused server-side
      without a valid Override; the Override is single-use and bound to that sale — replaying
      one approval to authorise a second discounted sale fails.
- [ ] A valueless Discount prompts, and the entered value is bounded by its type — `percent`
      `0 < v ≤ 100`, `amount` positive and not exceeding the total — enforced server-side.
- [ ] **VAT on, exempt Discount:** VAT is stripped first, the discount applies to the
      VAT-exclusive base, and the sale records **zero VAT** rather than omitting the field.
      ₱385.00 / 12% / 20% → **₱275.00** payable, asserted to the centavo.
- [ ] **VAT on, ordinary Discount:** VAT is backed out of the discounted total and is non-zero.
      Both cases asserted side by side.
- [ ] **VAT off:** a `vatExempt` Discount behaves as an ordinary percent Discount and no VAT
      figure exists.
- [ ] Property test, both configurations: a VAT-exempt Discount always yields a payable equal to
      `subtotal/(1+rate) × (1−percent)` to the centavo, and every intermediate is an exact
      `Millicentavos` integer.
- [ ] An offline-created Override is re-verified on arrival against the approver's role and
      Store membership as of then, per `tenancy-identity`.
- [ ] WCAG 2.2 AA on the reference prompt, the value prompt, and the manager prompt.

## Visual reference

- Image · component: DiscountPicker · 1280: `design/lofi/pos/discount-picker-1280.svg`
- Image · component: ManagerOverrideDialog · 1280: `design/lofi/pos/manager-override-1280.svg`

## Relevant files

- `apps/pos/src/features/discount/` — edit: reference prompt, value prompt, override gate
- `apps/pos/src/features/override/` — read: the existing Override prompt; do not build a second
- `packages/backend/src/order/` — edit: gate enforcement, VAT-exempt computation
- `packages/schemas/src/money.ts` — read: `vatBackout`, `roundLineTotal`
- tests — edit: the two worked examples, the no-log assertion, property tests

## Depends on

- 08 — Line-scoped Discounts and the before-rounding rule
- 06 — VAT captured on the Order and backed out of the receipt
