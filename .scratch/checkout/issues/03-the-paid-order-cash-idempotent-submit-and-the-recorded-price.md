# 03 — The paid Order: cash, idempotent submit, and the recorded price

**Status:** ready-for-agent
**Category:** feature

## What to build

The spine of the product: a built cart becomes money. The cashier enters the amount tendered,
sees the change, and completes the sale in one tap. The Order is submitted **once**, to an
endpoint that is idempotent on the client-generated UUID the draft has carried since issue 01.

**This is the one test that must pass before anything else in this area matters:** double
submission of the same Order UUID yields exactly one Order — including two genuinely
simultaneous requests. Idempotency that only holds when requests are serialised is not
idempotency. It is enforced by a **unique constraint**, never a read-then-write check.

**`paid` is terminal** (ADR-0005). No field on the Order or its lines is ever updated
afterwards; any `UPDATE` against either is a review finding. Corrections are separate records
and arrive in issues 10–12.

**The OrderLine captures everything at sale time** — Variant id *and* its name, the chosen
Modifiers and Add-ons with their names and Deltas, the quantity, the unit price, and the
computed line total. Names are denormalised deliberately: a receipt from March must render
correctly after the Variant is renamed or archived. This is ADR-0003's recorded price and the
server stores it **verbatim**.

**The server re-validates what the terminal composed and still stores the price it sent.** That
the Variant belongs to this Tenant and Store, that required Modifier groups were satisfied,
that Add-on maximums were respected. Validation catches a forged or malformed submission; it
does **not** re-price a completed sale. Dropping the validation admits forged Orders; re-pricing
breaks ADR-0003.

**Every Order must ultimately belong to a DrawerSession, and `drawer-sessions` is area 6.** Per
ADR-0006's expand/contract discipline this issue creates the Order with a **nullable**
DrawerSession reference, which area 6 backfills and tightens. This is deliberate sequencing —
do not "fix" it by pulling DrawerSessions forward.

Cash only here. The method chooser and recorded tenders are issue 05; a cash-only tenant is the
default product and this issue builds it.

## Acceptance criteria

- [ ] `Order`, `OrderLine`, and `Payment` tables with `tenant_id`, RLS enabled and forced in the
      creating migration, `@@unique([tenantId, id])`, and a **nullable** DrawerSession reference.
- [ ] A unique constraint on the Order's client UUID; submitting the same UUID twice yields one
      Order, and **two simultaneous requests** with the same UUID also yield one.
- [ ] The Store comes from the Device token, never from the request body.
- [ ] The server re-validates Variant ownership, required Modifier groups, and Add-on maximums,
      and rejects a submission that violates any of them — asserted by submitting directly,
      bypassing the UI.
- [ ] The recorded price the terminal sent is stored verbatim; the server never re-prices.
- [ ] Each OrderLine stores the Variant id and name, the Modifier and Add-on ids, names and
      Deltas, the quantity, the unit price, and the line total.
- [ ] The Order total equals the exact integer sum of the stored line totals; the sum is not a
      rounding site.
- [ ] Cash: the tendered amount is entered, change is computed, and a tender below the total is
      refused — in the UI *and* server-side.
- [ ] A paid Order cannot be mutated by any procedure, including re-submitting a modified body
      under the same UUID.
- [ ] Untrusted input: every id, quantity, and tendered amount is parsed to `Centavos` or a
      bounded positive integer, or rejected.
- [ ] Never logged: full Order payloads, tendered amounts, PINs. Log Order UUID, Store, Device,
      actor, outcome. A test asserts no payload reaches the log.
- [ ] Error messages are opaque about what exists — a wrong Order id reads the same whether it
      belongs to another Tenant or does not exist.
- [ ] Wrong-tenant and wrong-Store probes on every procedure this issue exposes, using
      `tenancy-identity`'s probe helper.
- [ ] A price change or a Variant rename after the sale does not alter the persisted Order.
- [ ] A single test through the seam rings up an order, pays, and asserts both the on-screen
      confirmation and the persisted rows.
- [ ] WCAG 2.2 AA on the payment step, both layouts.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/payment-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/payment-390.svg`

The mocks are drawn in the fully-configured state. **The cash-only tenant sees no method row and
no discount control** — that absence is the default configuration and needs its own build check,
not a conditional bolted on afterwards.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `Order`, `OrderLine`, `Payment`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create: tables, RLS, unique
  constraint on the Order UUID
- `packages/backend/src/order/` — create: submit handler, validation, db-operations
- `packages/contract/src/routes/order/` — create: the submit contract
- `apps/pos/src/features/payment/` — create: the payment panel, cash keypad, quick tender
- `packages/backend/src/order/*.test.ts`, `apps/pos/tests/` — create

## Depends on

- 02 — The line: modifiers, add-ons, quantity, and editing a line
