# 05 — Payment methods: the chooser, recorded tenders, and the cash-only default

**Status:** done
**Category:** feature

## What to build

A GCash sale recorded as GCash and not as something else. The Tenant's configured
PaymentMethods (ADR-0010, owned by `tenancy-identity`) become the choice at the top of the
payment panel — **level with the amount due, not under the keypad**. *How are you paying* is
the first question at the counter, and a chooser below the keypad is answered after the cashier
has already typed a tendered amount that only makes sense for cash.

**A Store with only `cash` shows no chooser at all.** That is the default product and it must
stay one tap. The chooser's absence is the default configuration, not an edge case, and it gets
its own build check.

**Every non-cash method is a recording device, not a payment integration.** A typed amount, no
change, no authorisation, no gateway, no QR, no settlement. The keypad, the quick-tender row,
and the change display are **cash-only controls and are not rendered for a recorded tender**.
The panel's standing copy that a recorded tender authorises nothing stays exactly where it is —
a familiar logo is precisely what would make a cashier assume otherwise.

**GCash and Maya carry their own mark and brand colour**; every other method is a plain chip.
Two non-negotiables: the marks come from each provider's **official brand kit**, never redrawn
or approximated, and the colour is theirs, not one eyeballed from a screenshot.

The Payment stores the **method's name as it was at sale time**, not only its id, so renaming a
method next year does not rewrite last year's receipts.

Split tender across two methods is deferred — trigger: the first tenant who reports turning away
a part-cash-part-card customer.

## Acceptance criteria

- [x] The method chooser renders at the top of the payment panel, level with the amount due,
      listing the methods the Device's Store actually accepts.
- [x] A Store with only `cash` renders **no chooser** and pays in one tap.
- [x] Choosing a non-cash method removes the keypad, the quick-tender row, and the change
      display, and the authorises-nothing copy is still present. Asserted as one test.
- [x] A non-cash payment computes no change and is refused if it carries a tendered amount
      implying one.
- [x] Quick-tender buttons for common notes make an exact-cash sale one tap.
- [x] The Payment stores the method id **and its name at sale time**; renaming the method
      afterwards does not change the stored name or the receipt's rendering.
- [x] A deleted or deactivated PaymentMethod does not change any completed sale's rendering.
- [x] The method id is validated server-side against the Tenant's own configuration and the
      Device's Store; another Tenant's method, or one not enabled for that Store, is **refused**,
      not silently ignored.
- [x] GCash and Maya render their official mark and brand colour, sourced from the provider's
      brand kit; every other method is a plain chip.
- [x] Tested on and off: cash-only tenant, and a tenant with `cash`, `gcash`, and `card`.
- [x] Both layouts; WCAG 2.2 AA, including the branded chips meeting contrast.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/payment-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/payment-390.svg`

The mock is drawn fully configured. The payment-method row **does not exist** for a cash-only
tenant.

## Relevant files

- `apps/pos/src/features/payment/` — edit: the method chooser, cash-only controls, brand chips
- `packages/backend/src/order/` — edit: method validation, name capture on the Payment
- `packages/backend/src/db/prisma/schema.prisma` — edit: `Payment` method name column
- `apps/pos/tests/` — edit: on-and-off configuration tests

## Depends on

- 03 — The paid Order: cash, idempotent submit, and the recorded price

## Comments

Implemented the Store-scoped chooser through the versioned terminal catalog, recorded-tender
amount rules, server-side Tenant/Store eligibility, sale-time method snapshots, and receipt
rendering. PaymentMethod deletion remains forbidden; the regression proof covers deactivation,
a refused hard delete, and unchanged historical rendering.

Automated proof: contract 11/11; checkout POS 17/17 including axe; issue API 24/24; migration
status current. Changed-file lint/typecheck passes. Repository-wide checks retain unrelated
baseline failures in stale catalog contract/probe tests and a pre-existing raw receipt text size.

Human resolution: supplied GCash and Maya artwork was cropped without redrawing or recolouring.
The branded methods now render as image-only 112px buttons with accessible names and edge-to-edge
brand backgrounds; each mark retains proportional native background padding. Plain methods retain
text chips. Selected methods retain the pressed background and add a visible ring so the state is
clear over either brand image. The chooser owns two thirds of the wide header and keeps every
method on one horizontal row; narrow layouts scroll that row instead of wrapping Maya. Both marks
use expanded edge-matched background padding to keep their visual scale compact without distortion.
GCash and Maya show that artwork only while selected; their unselected states are ordinary text
chips matching Cash and Card. Selection keeps a stable pill width and reveals the artwork from
left to right over 180ms with linear clipping; no scale or layout animation runs, and reduced-motion
preferences make the reveal immediate.

Final proof: payment panel 5/5 including axe, image-only brand identity, generic-chip fallback,
selected-state semantics and styling, cash-only/configured variants, and responsive layout seams;
POS check and production build pass. The broader POS suite is 81/83: unrelated baseline failures
remain in `ReceiptView.tsx`'s raw design value and the ping route's pending-copy expectation.
