# Checkout

- **Status:** ready-for-agent
- **Area:** 4 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `tenancy-identity`, `catalog`
- **Blocks:** `offline-sync`, `drawer-sessions`, `reporting`, `observability`

> **This is the one path that must never break.** A cashier takes an order and completes
> a cash payment. Everything else in DeanPOS exists to support this area or to prove it
> kept working.

## Problem Statement

There is a menu and there are people authorised to sell it, but there is no way to take a
customer's money. The terminal has no sale screen, there is no Order, no Payment, no
receipt, and no way to correct the two mistakes that happen at every counter — the wrong
item rung up, and the customer who changes their mind after paying.

The constraints make this harder than a form that writes a row:

**Speed is a feature.** A queue forms behind a slow cashier. Building an OrderLine from a
Variant plus a required Modifier group plus optional Add-ons has to be a handful of taps,
on a tablet held sideways or on a phone.

**A paid Order can never be edited.** ADR-0005 makes `paid` irreversible, so corrections
are new records — void and refund — each requiring a manager. Getting this wrong turns a
sales ledger into a set of numbers nobody can reconcile.

**Money must be exactly right, once.** Integer centavos, and **every stored figure rounded
exactly once** — the OrderLine total, and the Order-scoped Discount amount if there is one.
A cent of drift per line is a peso a day and an argument at drawer-session close.

**The offline story starts here even though the Outbox does not.** If the submit endpoint
is not idempotent from the first commit, `offline-sync` cannot safely replay anything.

## Solution

The sale screen: a Store's catalog as a tappable grid, a cart on the side (tablet) or a
sheet (phone), and a payment step that takes cash, computes change, and produces an
on-screen receipt.

An Order lives as a **local draft on the Device** and is stamped with a client-generated
UUID the moment it starts. It is never sent to the server while it is a draft. At payment
it becomes `paid` and is submitted once, to an endpoint that is **idempotent on that
UUID** — so submitting twice, whether from a double tap now or a replay next Tuesday,
produces one sale.

Corrections are additive. A **Void** cancels a whole paid Order; a **Refund** returns a
whole Order or individual lines. Both require a manager Override from
`tenancy-identity`, carry a reason, and write new records that reference the original
without touching it. A **manual line override** — the untyped escape hatch, distinct from a
configured **Discount** (ADR-0010) — is likewise manager-gated and records what the price
would have been.

Every OrderLine captures its **recorded price** at the moment of sale. The catalog can
change tomorrow; the receipt stays true.

## User Stories

**Building the order**

1. As a cashier, I want to see my Store's menu as a grid of tappable tiles, so that I can ring up an item without searching.
2. As a cashier, I want the grid grouped by Category, so that I can find a drink without scrolling past every ulam.
3. As a cashier, I want to search the menu by name, so that a rarely-sold item is one type away.
4. As a cashier, I want unavailable Variants to be visibly unsellable, so that I do not promise something we ran out of.
5. As a cashier, I want tapping a MenuItem to show its Variants as a grid in the same place, so that a dozen ulam choices are all reachable without scrolling a list inside a dialog.
6. As a cashier, I want to get back to the full menu in one tap, so that drilling into an item is never a trap.
6a. As a cashier, I want a MenuItem with only one Variant to skip the variant step, so that a single-form item is not two taps for no reason.
6b. As a cashier, I want a Variant with no options at all to go straight into the cart, so that a bottle of water is one tap.
6c. As a cashier, I want the cart to stay visible while I drill into an item, so that I do not lose sight of the order.
6d. As a cashier, I want to be prompted for a required Modifier group, so that I cannot ring up an *Adobo* with no size.
7. As a cashier, I want a default Modifier preselected, so that the common case is one tap.
8. As a cashier, I want to add Add-ons while building a line, so that *Extra rice* goes on the same line as the dish.
9. As a cashier, I want to add the same Add-on more than once up to its limit, so that two eggs is possible and twenty is not.
10. As a cashier, I want to set a quantity on a line, so that three of the same order is one line and not three taps.
11. As a cashier, I want to see the running order total as I build it, so that I can tell the customer before they pay.
12. As a cashier, I want to change a line's quantity before payment, so that a miscount is trivially fixed.
13. As a cashier, I want to edit a line's Modifiers and Add-ons before payment, so that a changed mind costs nothing.
14. As a cashier, I want to remove a line before payment, so that a wrong tap is not a manager call.
15. As a cashier, I want to clear the whole order, so that a walked-away customer does not block the till.
16. As a cashier, I want to be warned before clearing a non-empty order, so that a stray tap does not lose a built basket.
17. As a cashier, I want the draft order to survive a terminal reload, so that a crash mid-order does not cost the customer's time.

**Payment**

18. As a cashier, I want to take payment in cash, so that the ordinary case is fast.
19. As a cashier, I want to enter the amount tendered and be shown the change, so that I do not do arithmetic in front of a queue.
20. As a cashier, I want quick-tender buttons for common notes, so that an exact-cash sale is one tap.
21. As a cashier, I want to be prevented from completing a cash sale for less than the total, so that an underpayment cannot be recorded as complete.
22. As a cashier, I want to choose from the payment methods my Store actually accepts, so that a GCash sale is recorded as GCash and not as something else.
22a. As a cashier at a cash-only Store, I want no payment-method choice at all, so that the ordinary sale stays one tap.
22b. As a cashier, I want a non-cash payment recorded as a typed amount with no change due, so that it is obvious DeanPOS did not charge anything.
22c. As an owner, I want the method's name kept on the sale, so that renaming it next year does not rewrite last year's receipts.
23. As a cashier, I want to be able to cancel out of the payment step back to the order, so that a customer changing their mind at the last second is not a void.
24. As a cashier, I want the sale to complete in one tap once the tender is entered, so that the queue moves.
25. As a cashier, I want a clear confirmation that the sale completed, so that I do not charge twice out of doubt.
26. As a cashier, I want a double tap on the pay button to produce one sale, so that an anxious tap does not double-charge a customer.

**Receipt**

27. As a cashier, I want an on-screen receipt after payment, so that I can show the customer what they paid for.
28. As a customer, I want the receipt to itemise each line with its Modifiers and Add-ons, so that I can check what I was charged for.
29. As a customer, I want the receipt to show the total, the amount tendered, and my change, so that the transaction is unambiguous.
30. As a customer buying from a VAT-registered business, I want the receipt to show the VAT included in the total, so that it is a usable record.
30a. As an owner who is not VAT-registered, I want no VAT line on my receipts at all, so that my receipts do not imply a registration I do not hold.
30b. As a customer, I want any discount applied to show on the receipt with its name, so that I can see what I was given.
31. As a cashier, I want each Order to carry a short human-readable number, so that I can find it again when the customer returns.
32. As a cashier, I want that number to be assigned on the terminal, so that it exists even when we are offline.
33. As a cashier, I want to start the next order in one tap from the receipt, so that the queue keeps moving.
34. As a cashier, I want to look up a recent Order **from what this terminal already holds**, so that a returning customer is handled at the counter with no network and no wait.

**Corrections**

35. As a manager, I want to void a whole paid Order, so that a sale rung up in error can be cancelled.
36. As a manager, I want voiding to require my PIN, so that a cashier cannot cancel sales unsupervised.
37. As a manager, I want to record a reason for a void, so that a pattern is visible later.
38. As a manager, I want a void to leave the original Order intact and add a reversal record, so that the audit trail is complete.
39. As a manager, I want to refund a whole Order, so that a customer returning everything is handled.
40. As a manager, I want to refund individual lines, so that a customer returning one of three dishes is handled.
41. As a manager, I want refunds to require my PIN and a reason, so that money leaving the drawer is always attributable.
42. As a manager, I want to be prevented from refunding more than was paid, so that repeated partial refunds cannot exceed the sale.
43. As a manager, I want to be prevented from voiding an Order that has already been refunded, so that the two mechanisms cannot double-count.
44. As a cashier, I want a clear prompt that a manager is required, so that I call one instead of improvising.
45. As a manager, I want to apply a manual price override to a line, so that a legitimate one-off adjustment is possible without a promotions engine.
46. As a manager, I want the original price recorded alongside the overridden one, so that the adjustment is measurable rather than invisible.
47. As a manager, I want overrides, voids, and refunds to work while offline, so that an outage does not stop me doing my job.

**Discounts — when the Tenant has configured any**

47a. As a cashier, I want to apply one of my Store's configured Discounts to the order, so that a senior citizen discount is one tap and not arithmetic.
47b. As a cashier at a Store with no Discounts configured, I want no discount control on the screen, so that the sale screen stays as simple as the business is.
47c. As a cashier, I want a percentage Discount applicable to a single line, so that only the eligible person's meal is discounted.
47d. As a cashier, I want to be required to enter the reference a Discount asks for before it applies, so that the ID number behind an exemption is captured at the moment it is claimed.
47e. As a cashier, I want a Discount marked as restricted to require a manager, so that not every reduction is mine to give.
47f. As a cashier, I want a Discount with no preset value to prompt me for one, so that a negotiated reduction is still recorded as a named Discount rather than a price edit.
47g. As an owner, I want a VAT-exempt Discount to remove VAT from that sale, so that a statutory exemption is computed rather than approximated.
47h. As a cashier, I want Discounts to work offline, so that the customer in front of me during an outage still gets what they are entitled to.
47i. As an owner, I want the Discount's name, type, and value kept on the sale, so that editing the Discount later does not change what happened.

**Integrity**

48. As a manager, I want a paid Order to be uneditable by anyone, so that the ledger can be trusted.
49. As an owner, I want every line to keep the price it was actually sold at, so that a price rise does not rewrite last week's sales.
50. As an owner, I want every void, refund, and override to name a person, so that I know who approved what.
51. As a tenant admin, I want another Tenant to be unable to read or touch my Orders, so that my revenue is private.
52. As an owner, I want a submitted Order to be recorded exactly once no matter how many times it is submitted, so that a network retry never double-counts revenue.

## Implementation Decisions

**A draft never reaches the server.** The Order exists on the Device from the first tap,
holding a client-generated **UUID** assigned at creation. It is persisted locally so a
reload does not lose it. The server sees an Order for the first time at payment, and only
ever in the `paid` state.

This is the decision that makes offline coherent. There is no draft synchronisation
problem because drafts are not shared, and no partial-order reconciliation because a
partial order is not a thing the server knows about.

**Every submission is idempotent on its own client-generated UUID, from the first commit —
and that means reversals too.** An Order carries a UUID; **so does each Void and each
Refund**, generated on the Device when the manager approves it. Re-submitting any of them is
a no-op returning the same result, enforced by a unique constraint per table.

The Order's UUID is not sufficient for reversals: this area allows cumulative partial
refunds, so "a retry of refund X" and "a second, legitimate line refund on the same Order"
are indistinguishable by Order UUID alone. `offline-sync` replays all three kinds and is
forbidden from inventing its own deduplication, so the guarantee has to be complete here.

Written and tested in this area even though nothing replays yet, because retrofitting
idempotency onto a live sales endpoint is not something anyone should have to do.

**Order number.** A short human-readable identifier assigned **on the Device** — a device
code plus a per-Device incrementing sequence, e.g. `C2-0421`. It is not globally unique
and it is not the primary key; the UUID is. A server-allocated sequence is impossible
offline, and a number that appears only after reconnection is useless to a cashier holding
a receipt.

**State machine** (ADR-0005):

```
draft ──pay──▶ paid ──┬── voided    whole order, manager Override, reason
                      └── refunded  whole or per-line, manager Override, reason
```

`draft` is local-only. `paid` is terminal for the Order row: no field on it or on its
lines is ever updated afterwards. Void and Refund are **separate records** referencing the
Order. An Order that is voided cannot be refunded and vice versa; partial refunds
accumulate and may not exceed what was paid.

**OrderLine captures everything at sale time** — Variant id *and* its name, the chosen
Modifiers and Add-ons with their names and Deltas, the quantity, the unit price, and the
computed line total. Names are denormalised deliberately: a receipt from March must render
correctly after the Variant is renamed or archived. This is the **recorded price** of
ADR-0003 and the server stores it verbatim.

**Pricing arithmetic — the whole rule, in order, with nothing left to infer.** All
intermediates are exact `Millicentavos` integers; nothing is a float at any point.

```
per line     Variant price
             + Modifier and Add-on Deltas          exact, millicentavos
             − line-scoped Discount, if any        exact, applied to the UNROUNDED amount
             × quantity                            exact
             ──────────────────────────────────────
             ROUND ONCE, half-up  →  OrderLine total, Centavos      ← rounded figure 1

per order    Σ OrderLine totals                    exact integer sum, no rounding
             − Order-scoped Discount               computed from that subtotal,
                                                   ROUND ONCE, half-up               ← rounded figure 2
             ──────────────────────────────────────
             Order total, Centavos
```

**The rule is "once per stored figure", not "once per Order".** There are exactly two
rounded figures — the OrderLine total and the Order-scoped Discount amount — and neither is
ever rounded twice. A sum of already-rounded integers needs no rounding, which is why the
Order total itself is never a rounding site. `CONTEXT.md`, ADR-0005, and
`.scratch/APP-PLAN.md` were amended on 2026-07-31 to say this; they previously said "once,
at the OrderLine total", which was true before ADR-0010 introduced an Order-scoped Discount
and false afterwards.

**A line-scoped Discount applies before the line's single rounding**, to the unrounded
millicentavo amount. Applying it after would round twice on every discounted line.

**VAT, where enabled, is backed out — never added.** Two cases, and they differ:

```
ordinary Discount     total is computed as above; VAT is then backed out of the
                      Order total at the rate captured on the Order.
                      vat = total − total / (1 + rate)

VAT-exempt Discount   VAT is stripped FIRST, and the discount applies to the
                      VAT-exclusive base. This is the statutory Philippine
                      Senior Citizen / PWD computation, not a DeanPOS invention.
                      base    = subtotal / (1 + rate)
                      discount = base × percent
                      payable  = base − discount
                      vat recorded on the sale = 0
```

Worked example, ₱385.00 subtotal, 12% VAT, 20% VAT-exempt discount:
`base 34375000 mc (₱343.75) · discount 6875000 mc (₱68.75) · payable ₱275.00 · VAT ₱0.00`.
Applying the discount to the VAT-inclusive ₱385.00 instead would yield ₱308.00 and
overcharge an entitled customer by ₱33.00.

When VAT is disabled, there is no base to strip: a `vatExempt` Discount behaves as an
ordinary percent Discount, and no VAT figure exists.

**No other module in DeanPOS implements any of this.**

**The server re-validates everything the terminal composed** — that the Variant belongs to
the Tenant and Store, that required Modifier groups were satisfied, that Add-on maximums
were respected — and it **still stores the recorded price the terminal sent**. Validation
catches a malformed or malicious submission; it does not re-price a completed sale.

**Payment.** One Payment per Order, against one **PaymentMethod** from the Tenant's
configured list (ADR-0010).

- `cash` always exists: amount tendered is entered, change is computed, and tendering below
  the total is rejected.
- Every other method is a **recorded tender**: a typed amount, no change, no authorisation,
  no gateway. The UI must make that unmistakable — a cashier who believes DeanPOS charged
  the card has been misled by the screen.
- The Payment stores the **method's name as it was at sale time**, not only its id.
- **A Store with only `cash` shows no method chooser.** The default product does not make
  anyone choose between one option.

**Split tender across two methods is deferred** — trigger: the first tenant who reports
turning away a part-cash-part-card customer.

**Discounts, when configured** (ADR-0010). The Tenant's Discount list is empty by default;
an empty list means **no discount control renders at all**. When it is not empty:

- A cashier may apply **at most one Order-scoped Discount and at most one line-scoped
  Discount per line**. Stacking rules beyond that do not exist, because a stacking rule is
  the first step into a promotions engine.
- `amount` Discounts are Order-scoped only. `percent` Discounts may be either.
- A Discount with `requiresOverride` needs a manager Override, using
  `tenancy-identity`'s existing mechanism — this area consumes it and must not build a
  second one.
- A Discount with `requiresReference` refuses to apply until the reference is entered. The
  prompt's label comes from the Discount's configuration.
- A Discount with no configured value prompts the cashier for one, bounded by its type.
- The Order captures the Discount's **name, type, value, scope, VAT-exemption, and the
  entered reference** — the recorded-price principle applied to the reduction. Editing or
  deleting the Discount later never touches a completed sale.
- Discounts apply on the Device and work offline like everything else on this screen.

**Manual line override is not a Discount and must not become one.** It stays the untyped
escape hatch: manager Override, original price recorded alongside the overridden one, plus
a reason. `reporting` shows the two separately, because "we honoured a statutory discount"
and "somebody changed a price" are different facts about a business.

**VAT is a Tenant setting, off by default** (ADR-0010). Prices are what the customer pays in
every configuration; VAT is never added at checkout. When VAT is enabled, the Order captures
the **enablement and the rate in force at sale time**, and the receipt shows the VAT backed
out of the total. When it is disabled, no VAT figure is computed, stored, or displayed —
there is no zero and no empty line. A VAT-exempt Discount removes VAT from the sale it
applied to; that is what typing the Discount buys.

**Overrides work offline.** The mechanism is `tenancy-identity`'s: the manager enters
their PIN on the terminal, it is verified against the locally synced hash, and the
Override travels with the Order for server re-verification on arrival. This area consumes
that mechanism and must not build a second one.

**DrawerSession binding is a forward dependency.** Every Order must ultimately belong to a DrawerSession,
but `drawer-sessions` is area 6. Per ADR-0006's expand/contract discipline, this area creates
the Order with a **nullable** DrawerSession reference, and `drawer-sessions` backfills and tightens it.
This is deliberate sequencing, not an oversight — it is recorded here so nobody
"fixes" it by pulling DrawerSessions forward into checkout.

**Variant selection is a grid drill-down, not a list in a dialog.** Tapping a MenuItem
replaces the tile grid in place with that item's Variants, with a breadcrumb back to the
full menu. The cart stays mounted throughout.

This is a correction to an earlier sketch that put Variants as radio options inside the
options dialog. A carinderia's *Ulam* can carry a dozen Variants; a dialog caps out at
about four and then scrolls badly on a phone. The grid already scrolls, already has the
right touch targets, and is already the thing the cashier's hand is on.

Consequences, all of which reduce taps:

- The options modal now carries **modifiers and add-ons only**, so it is small enough to
  fit a phone without scrolling in the common case.
- A MenuItem with exactly **one** Variant skips the variant step entirely.
- A Variant with **no** modifier groups and **no** add-ons skips the modal entirely and
  goes straight into the cart — a bottle of water is one tap.
- Selecting a Category while drilled in exits the drill-down; there is no second back
  button to learn.

**Two layouts, not one breakpoint.** Tablet landscape puts the grid and the cart
side-by-side; phone puts the grid full-width with the cart as a bottom sheet showing a
running total. The payment step, the receipt, and every manager-Override prompt are
designed for both. Touch targets, one-handed reach on phone, and WCAG 2.2 AA apply to
both.

**Visual reference.** `ORC2_DESIGN="lofi"`, `ORC2_LOFI_DIR="design/lofi"`. Mocks exist and
are committed: `pos/sale-grid-{1280,390}`, `pos/cart-390`,
`pos/variant-grid-{1280,390}`, `pos/modifier-picker-{1280,390}`, `pos/payment-{1280,390}`,
`pos/discount-picker-1280`, `pos/receipt-{1280,390}`,
`pos/manager-override-1280`, `pos/order-lookup-1280`. Copy the tagged entries from
`design/lofi/README.md` into each screen issue's `## Visual reference` section.

**The mocks are drawn in the fully-configured state; the default tenant sees less.**
`discount-picker` does not exist for a tenant with no Discounts, the payment-method row does
not exist for a cash-only tenant, and the VAT line does not exist for a non-VAT tenant. Each
absence is the default and needs its own build check — not a conditional bolted on after the
configured version renders.

The notes under each mock are part of the contract. What the mocks deliberately do **not**
decide — empty states, loading, most error states, focus and disabled treatments — goes to
the `decider`, not to an implementer's judgement.

## Testing Decisions

**What makes a good test here.** Drive the sale screen the way a cashier does and assert
what the customer would see and what the database ends up holding. Never assert that a
pricing helper was called; assert that ringing up a half-adobo with extra rice produces
₱75 on screen and ₱75 in the row. Never assert a void handler ran; assert the original
Order is byte-for-byte unchanged and a reversal record exists.

**The seam.** Unchanged — rendered route → TanStack Query → oRPC client → in-process Hono
→ Kysely → real lane PostgreSQL, with actors from `tenancy-identity`. No new seam. This is
the area that proves the seam was worth building: a single test rings up an order, pays,
and asserts both the receipt and the persisted row.

**Prior art.** The wrong-tenant probe helper from `tenancy-identity`, applied to every
procedure. The catalog fixtures from `catalog`, which should be reused rather than
re-seeded — the *Ulam → Adobo/Munggo → Whole/Half → Extra rice* fixture is the canonical
one for this area.

**Money, property-tested.** The composition rules get property tests over generated
catalogs and carts: a line total is always a non-negative integer number of centavos;
**every stored figure is rounded exactly once — the OrderLine total and the Order-scoped
Discount amount, and nothing else**; the Order total always equals the sum of the stored
line totals minus the stored discount amount; VAT backed out and re-applied returns the
original total; every intermediate is an exact `Millicentavos` integer. Examples are not
sufficient for money.

**Through the seam, at minimum.**

- Ring up a Variant with a required Modifier and an Add-on; assert the on-screen line, the
  total, and the persisted OrderLine.
- A MenuItem with several Variants drills down; the back control returns to the full menu;
  the cart is unchanged throughout.
- A MenuItem with one Variant skips the drill-down; a Variant with no options skips the
  modal and lands directly in the cart.
- A required Modifier group cannot be skipped — rejected in the UI *and* rejected by the
  server when submitted directly.
- An Add-on beyond its maximum is rejected server-side.
- **An existing draft line is edited, not rebuilt** — changing its quantity, and changing
  its Modifiers and Add-ons, each recompute the line total and the running Order total, and
  the line keeps its identity in the cart. Stories 12 and 13 had no test; building a line
  from scratch does not exercise mutating one.
- A line-scoped Discount reduces the line **before** its single rounding — asserted on a
  price where discounting after rounding would differ by a centavo.
- An unavailable Variant cannot be added.
- Cash below total is rejected; exact cash and over-tender both compute correct change.
- **Double submission of the same Order UUID yields exactly one Order** — the single most
  important test in this PRD.
- **Double submission of the same Void UUID yields exactly one Void, and the same for a
  Refund** — including two concurrent attempts. Then, distinctly: **two refunds on the same
  Order with different UUIDs both apply**, cumulatively, which is what makes the previous
  assertion about idempotency rather than about refusing a second refund.
- A concurrent double submission (two simultaneous requests, same UUID) also yields one
  Order. Idempotency that only holds when requests are serialised is not idempotency.
- A paid Order cannot be mutated by any procedure, including by re-submitting a modified
  body under the same UUID.
- Void requires a manager Override; a cashier's attempt is refused; the original Order is
  unchanged and a reversal exists.
- Refund whole and per-line; cumulative partial refunds cannot exceed the paid amount;
  refund after void and void after refund are both refused.
- A manual line override requires a manager Override and stores the original price.
- A Variant renamed or archived after a sale does not change the historical Order's
  rendering.
- A price change after a sale does not alter the recorded price.
- Wrong-tenant and wrong-Store probes on every procedure, including reading a receipt by
  id.

**The optional features.** Every one of them is tested **on and off**, because the
off-by-default configuration is the product most tenants will run.

- A Tenant with only `cash` renders no method chooser and pays in one tap.
- A Tenant with `cash`, `gcash`, and `card` records the chosen method **and its name** on
  the Payment; the name survives a later rename of the method.
- A non-cash payment computes no change and is refused if it carries a tendered amount that
  implies one.
- A deleted PaymentMethod does not change any completed sale's rendering.
- A Tenant with no Discounts renders no discount control, and the submit procedure **rejects
  an Order carrying a Discount** — the UI's absence is not the control.
- A `percent` line Discount reduces exactly that line; an `amount` Discount applied to a
  line is rejected server-side.
- Two Order-scoped Discounts on one Order are rejected.
- A `requiresOverride` Discount without a valid Override is refused server-side; a cashier's
  attempt in the UI prompts for a manager.
- A `requiresReference` Discount without a reference is refused server-side.
- A valueless Discount prompts, and the entered value is bounded by its type — 0–100 for
  `percent`, not exceeding the total for `amount`.
- The Discount's name, type, value, and reference are stored on the Order; editing the
  Discount afterwards does not change the stored values or the receipt's rendering.
- **VAT off:** the receipt has no VAT line, and no VAT figure appears in the submit
  response or the persisted row.
- **VAT on:** the receipt shows VAT backed out of the total at the rate captured on the
  Order; changing the Tenant's rate afterwards does not change it.
- **A VAT-exempt Discount removes VAT from that sale** while an ordinary Discount does not,
  with the exact centavo figures asserted.

**Money, property-tested — both configurations.** Every property in this area is asserted
with VAT enabled and disabled, and with and without a Discount applied: the Order total
always equals the sum of stored line totals minus the stored Order-scoped Discount amount;
**exactly two figures are ever rounded — the OrderLine total and the Order-scoped Discount
amount**; VAT backed out and re-applied returns the original total; a VAT-exempt Discount
always yields a payable equal to `subtotal/(1+rate) × (1−percent)` to the centavo; no
Discount can drive a total below zero.

**Deliberately not tested here.** Queueing, replay from a real Outbox, and service-worker
behaviour — `offline-sync`, using the idempotency this area establishes. DrawerSession binding and
cash reconciliation — `drawer-sessions`. Aggregate sales figures — `reporting`. Visual
regression — the design contract is lo-fi.

## Security Criteria

1. **Wrong-tenant and wrong-Store probes on every procedure**, including receipt lookup —
   an Order id is exactly the kind of thing reachable by guessing.
2. **A Device may only submit Orders for its own Store.** The Store comes from the Device
   token, never from the request body.
3. **Idempotency is enforced server-side and is concurrency-safe** — a unique constraint
   on the Order UUID, not a read-then-write check.
4. **The server re-validates the composition** (Variant ownership, required groups, Add-on
   maximums) while still storing the recorded price. Both halves matter: dropping
   validation admits forged Orders; re-pricing breaks ADR-0003.
5. **The recorded price is authoritative, not client-authoritative-for-everything.** The
   terminal may state the price; it may not state which Tenant or Store the sale belongs
   to, who approved an Override, or that an Override occurred without evidence.
6. **Manager-gated actions are authorised server-side.** Void, refund, and manual override
   each require a valid Override for that specific action instance; a UI-only gate is a
   defect.
7. **An Override is single-use and bound to one action** — replaying one approval to
   authorise a second void must fail.
8. **An offline-created Override is re-verified on arrival** against the approver's role
   and Store membership as of then, per `tenancy-identity`.
9. **A paid Order is append-only at the database level** where practical, and never
   updated by any code path. Any `UPDATE` against an Order or OrderLine is a review
   finding.
10. **Refund totals are bounded server-side**, computed from persisted rows, never from a
    client-supplied remaining balance.
11. **Untrusted input:** every id, quantity, tendered amount, override price, and reason
    string. Amounts parse to `Centavos` or are rejected; quantities are bounded positive
    integers.
12. **Never logged:** full Order payloads, tendered amounts, and manager PINs. Log Order
    UUID, Store, Device, actor, and outcome.
13. **Error messages to the terminal are opaque** about what exists — a wrong Order id
    reads the same whether the Order belongs to another Tenant or does not exist.
14. **Discount and PaymentMethod ids are validated against the Tenant's own configuration.**
    A terminal naming another Tenant's Discount, or one that was never enabled for its
    Store, is refused — not silently ignored, which would complete the sale at the wrong
    price.
15. **A Discount's economic effect is recomputed server-side** from the captured type and
    value. The terminal states what it applied; it does not state what that was worth.
16. **A Discount requiring an Override is authorised server-side, per sale.** The
    single-use, bound-to-one-action rule for Overrides covers this too.
17. **A discount reference is personal data** — a Senior Citizen or PWD ID identifies a real
    person. It is stored, shown on the receipt, and **never logged**, and it falls under
    `hardening`'s export and deletion procedures.
18. **VAT enablement and rate are read from the Tenant server-side and captured on the
    Order.** A terminal may not assert that a sale was VAT-exempt or state its own rate; a
    forged exemption is a tax claim.

## Out of Scope

- The Outbox, the service worker, retry and backoff, offline catalog caching, and sync
  status UI. Area 5 — this area supplies idempotent submit and offline-capable Overrides.
- DrawerSessions, Floats, cash counts, and Variance. Area 6 — Order carries a nullable DrawerSession
  reference until then.
- Sales reports and aggregates of any kind. Area 7.
- Structured logging, error tracking, and alerting on failed payment. Area 8.
- Rate limiting and the threat model. Area 9.
- Printed receipts and any hardware — printer, cash drawer, scanner, card terminal.
  Non-goal for v1; the receipt is on-screen only.
- Integrated card, GCash, or Maya payment authorisation. Non-goal — every non-cash
  PaymentMethod **records an amount and authorises nothing**. No gateway, no QR generation,
  no settlement, no reconciliation against a provider's statement.
- Configuring PaymentMethods, the VAT setting, or the Discount list. This area *applies*
  them; `tenancy-identity` owns the settings and `catalog` owns the Discount list.
- A promotions engine. ADR-0010 widened discounting to a configured, typed list and no
  further: no conditions, no schedules, no coupon codes, no buy-one-get-one, no customer
  segments, no stacking rules beyond one per Order and one per line.
- Splitting an `amount` Discount across lines. Order-scoped only, by decision — distributing
  a peso amount across lines is a rounding argument with no correct answer.
- Mixed VATable and VAT-exempt goods within one Tenant. VAT is Tenant-level (ADR-0010).
- Emailed or SMS receipts. **Deferred, trigger:** a tenant that needs a customer-retained
  copy. Requires an email or SMS transport DeanPOS does not have.
- Split tender across two payment methods. **Deferred, trigger:** first reported
  part-cash-part-card customer.
- Dine-in tables, open tabs, kitchen tickets, split bills. Non-goals — this is
  order-then-pay counter service.
- **Parking an order to serve the next customer.** Not in v1, but this one is deferred with
  a trigger rather than closed, because it has a daily cost the other non-goals do not.
  **Deferred, trigger:** a tenant reporting that the counter stalls because a cashier cannot
  set one order aside. See the note below on what the cheap version looks like.
- Promotions, coupons, loyalty, and any **rule-based** discounting — conditions, schedules,
  codes, BOGO, segments. Non-goal. Configured Discounts (ADR-0010) and the manual line
  override are the only reductions, and both are applied by a person on purpose.
- Customer records attached to an Order. Non-goal for v1.
- Exchanges as a first-class operation. A refund plus a new sale is the v1 answer.

## Further Notes

- **The mocks are committed and this area is no longer blocked on them.** They fix
  structure and order only; everything else comes from tokens. An implementer that measures
  a mock has misread it.
- **The double-submit test is the one to write first.** If it does not pass, nothing else
  in this area matters, and `offline-sync` cannot be built at all.
- **The cost of having no parked order is real, and is written down here so nobody has to
  rediscover it.** A customer mid-order says "wait, let me think" with a queue behind them,
  and the cashier has exactly two options: hold the till, or clear the basket and re-ring it
  later. That is a daily friction, not a hypothetical.

- **When it comes back, the cheap version is one parked draft per Device, local-only, never
  shared** — and that distinction is the whole decision. A *parked draft* is still a private
  object on one terminal, so it changes nothing about the architecture: no server state, no
  merge, no conflict.

  An **open ticket** in the comparable product is something else entirely: a *shared mutable
  draft* that any Device can edit. DeanPOS is offline-first, so two terminals can edit one
  ticket while disconnected from each other — genuine conflict resolution on a live cart,
  where last-write-wins means a line the customer ordered silently disappears. The current
  model has no merge semantics anywhere, deliberately, and that product's own manual
  concedes its open tickets work offline "but without synchronization with other devices".

  So: **a parked draft is a small feature and an open ticket is a distributed-systems
  problem.** If this comes back, it comes back as the first one, with its own decision
  record. Reaching for the second without one is the failure mode this note exists to
  prevent.
- **Speed is an acceptance criterion, and it is falsifiable.** Not "feels fast" — the
  assertion is that **building an order and looking one up issue zero network requests**.
  Tested by driving the flow with the transport stubbed to throw: building a three-line
  order, editing it, and opening the order lookup all complete. Every catalog and Order read
  in this flow comes from what the terminal already holds. A test that cannot fail is not a
  criterion, and "should be fast" cannot fail.
- **Every non-cash PaymentMethod is a recording device, not a payment integration.** The UI
  should make that unmistakable, or a tenant will assume DeanPOS charged the card — and a
  method named `GCash` invites that assumption far more strongly than one named `Card` did.
- Order numbers are unique per Device, not per Store or Tenant. Anywhere one is displayed
  outside the terminal that created it, the Device must be displayed with it.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and
ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007. Reuses the seam from `foundation`, the
actors and Override mechanism from `tenancy-identity`, and the catalog fixtures from
`catalog`._
