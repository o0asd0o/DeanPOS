# 04 — The receipt and the device-assigned order number

**Status:** ready-for-agent
**Category:** feature

## What to build

What the cashier turns to the customer after payment. An on-screen receipt itemising every line
with its Modifiers and Add-ons, the total, the amount tendered, and the change. From it, the
next order starts in one tap, because the queue keeps moving.

**Every Order carries a short human-readable number assigned on the Device** — a device code
plus a per-Device incrementing sequence, e.g. `C2-0421`. It is not the primary key and it is not
globally unique; the UUID is. A server-allocated sequence is impossible offline, and a number
that appears only after reconnection is useless to a cashier holding a receipt. **Order numbers
are unique per Device**, so anywhere one is displayed outside the terminal that created it, the
Device must be displayed with it.

**A receipt is a view over the Order, rendered on demand** (ADR-0012). Nothing is stored as a
file, in object storage or anywhere else. "Print" means the browser's own print of that view;
no thermal printer, no ESC/POS, no drawer kick — receipt hardware is a non-goal for v1.

VAT and discount lines are conditional surfaces and arrive in issues 06 and 07. A non-VAT tenant
with no Discounts — the default product — has neither line, and that is what this issue builds.

## Acceptance criteria

- [x] The receipt itemises each line with its Modifiers and Add-ons, and shows the total, the
      amount tendered, and the change.
- [x] The receipt renders from the Order's captured names and prices, so a Variant renamed or
      archived after the sale does not change how it renders. Asserted directly.
- [x] The Order number is assigned on the Device from the device code plus a per-Device
      sequence, is stored on the Order, and appears on the receipt.
- [x] The number is assigned with no network at all — asserted with the transport stubbed to
      throw.
- [x] The device code is displayed alongside the number wherever the number is shown.
- [x] A clear confirmation that the sale completed, so nobody charges twice out of doubt.
- [x] Starting the next order from the receipt is one tap and leaves the previous Order
      untouched.
- [x] No VAT line and no discount line for the default tenant — no zero, no empty row.
- [x] Nothing is written to storage as a rendered receipt.
- [x] Wrong-tenant and wrong-Store probes on reading a receipt by id; the error is opaque.
- [ ] Both layouts built from their own mock; WCAG 2.2 AA.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/receipt-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/receipt-390.svg`

## Relevant files

- `apps/pos/src/features/receipt/` — create: the receipt view, next-order action
- `apps/pos/src/lib/` — create: the per-Device order-number sequence
- `packages/backend/src/order/` — edit: store and expose the order number
- `apps/pos/tests/` — edit: receipt tests

## Depends on

- 03 — The paid Order: cash, idempotent submit, and the recorded price

## Comments

Implemented the persisted receipt projection, Store-confined `terminal.receipt` read, receipt
screen, one-tap next Order, and a Device-local sequence reserved on the Draft before transport.
The sequence uses `localStorage` under the confirmed one-active-tab-per-Device constraint; retries
reuse the reservation, gaps are allowed, and the server validates the formatted number against the
authenticated Device before enforcing per-Device uniqueness.

Automated proof: terminal contract 10/10, API submit/receipt/isolation 12/12, POS focused 9/9,
paid-order seam 1/1, changed-file static checks PASS, migration status PASS. No Receipt table,
file, blob, or object-storage write exists. The pre-production migration requires no historical
Orders; two authorised `DeanPOS Demo Cafe` Orders were removed from the local development database
before deployment.

Pending human visual proof for the final acceptance criterion: compare the receipt at 1280 and 390
against both named lo-fi mocks; verify content order, responsive fit, touch targets, readable money
rows, focus treatment, and WCAG 2.2 AA. The issue remains non-done until that human PASS.
