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

- [ ] The receipt itemises each line with its Modifiers and Add-ons, and shows the total, the
      amount tendered, and the change.
- [ ] The receipt renders from the Order's captured names and prices, so a Variant renamed or
      archived after the sale does not change how it renders. Asserted directly.
- [ ] The Order number is assigned on the Device from the device code plus a per-Device
      sequence, is stored on the Order, and appears on the receipt.
- [ ] The number is assigned with no network at all — asserted with the transport stubbed to
      throw.
- [ ] The device code is displayed alongside the number wherever the number is shown.
- [ ] A clear confirmation that the sale completed, so nobody charges twice out of doubt.
- [ ] Starting the next order from the receipt is one tap and leaves the previous Order
      untouched.
- [ ] No VAT line and no discount line for the default tenant — no zero, no empty row.
- [ ] Nothing is written to storage as a rendered receipt.
- [ ] Wrong-tenant and wrong-Store probes on reading a receipt by id; the error is opaque.
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
