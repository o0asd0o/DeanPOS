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
exactly once** — the OrderLine total, the Order-scoped Discount amount if there is one, and
the amount of any Refund.
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

**Tickets, tables, and how the order will be taken** (ADR-0011)

17a. As a cashier, I want to set the current order aside under a name, so that a customer who is still deciding does not hold up the queue behind them.
17b. As a cashier, I want to see every Ticket I have open, with its label, its total, and how long it has been open, so that nothing is forgotten at the counter.
17c. As a cashier, I want to resume a Ticket in one tap and carry on building it, so that coming back to a customer costs nothing.
17d. As a cashier, I want to label a Ticket with a table, so that I can match the order to where the customer is sitting.
17e. As a cashier at a Store that does not use tables, I want to type any label — a name, "red shirt" — so that the feature works without a floor plan.
17f. As a manager, I want the Store's table labels configured as a list, so that a cashier taps instead of typing and the labels stay consistent.
17f1. As a cashier, I want a grid of my Store's tables showing which are free and what each occupied one owes, so that I can see the floor's state at a glance and resume the right order in one tap.
17f2. As a cashier, I want a table that already has an open Ticket to be unavailable when labelling a new one, so that I cannot put two orders on Table 4 and lose track of which is which.
17f3. As a cashier, I want to move a Ticket to a different table, so that customers changing seats is not a re-ring.
17g. As a cashier, I want to discard a Ticket, so that a customer who walked away does not sit in my list forever.
17h. As an owner, I want a discarded Ticket to leave no trace and no reversal record, so that my void report is about real cancelled sales and nothing else.
17i. As a cashier, I want to be stopped from closing my drawer while Tickets are still open, so that I never leave money uncollected and unaccounted for.
17j. As a cashier, I want to tag an order as dine in, take out, delivery, or pick up, so that the sale records how the food left the counter.
17k. As an owner, I want that tag kept on the sale and filterable in the Orders list, so that the question can be answered later even though v1 does nothing else with it.

**Payment**

18. As a cashier, I want to take payment in cash, so that the ordinary case is fast.
19. As a cashier, I want to enter the amount tendered and be shown the change, so that I do not do arithmetic in front of a queue.
20. As a cashier, I want quick-tender buttons for common notes, so that an exact-cash sale is one tap.
21. As a cashier, I want to be prevented from completing a cash sale for less than the total, so that an underpayment cannot be recorded as complete.
22. As a cashier, I want to choose from the payment methods my Store actually accepts, so that a GCash sale is recorded as GCash and not as something else.
22a. As a cashier at a cash-only Store, I want no payment-method choice at all, so that the ordinary sale stays one tap.
22b. As a cashier, I want a non-cash payment recorded as a typed amount with no change due, so that it is obvious DeanPOS did not charge anything.
22c. As an owner, I want the method's name kept on the sale, so that renaming it next year does not rewrite last year's receipts.
22d. As a cashier, I want the method chooser at the top of the payment panel, level with the amount due, so that I pick how they are paying before I touch the keypad instead of after.
22e. As a cashier, I want GCash and Maya to carry their own mark and colour, so that I hit the right one at a glance in a queue instead of reading four similar words.
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
34c. As a cashier, I want "recent" to mean a stated window — this DrawerSession and the previous two business days — so that I know without asking whether a sale will be findable here.
34d. As a cashier at a second terminal, I want to find a sale rung up on the other counter by typing its number, so that a customer is not sent back to a till that has a queue.
34e. As a cashier, I want to be told plainly that a sale was rung elsewhere and needs a connection, so that an empty result never looks like a fake receipt.
34f. As a manager, I want to void or refund a sale I found this way, so that finding it is actually worth something.
34a. As a cashier, I want to narrow that lookup to the orders I rang up myself, so that after a handover I am not scrolling through my colleague's sales to find mine.
34b. As a manager, I want that filter to list whoever actually used this terminal today rather than every User in the Store, so that it is two taps and not a directory.

**Corrections**

35. As a manager, I want to void a whole paid Order, so that a sale rung up in error can be cancelled.
36. As a manager, I want voiding to require my PIN, so that a cashier cannot cancel sales unsupervised.
37. As a manager, I want to record a reason for a void, so that a pattern is visible later.
38. As a manager, I want a void to leave the original Order intact and add a reversal record, so that the audit trail is complete.
39. As a manager, I want to refund a whole Order, so that a customer returning everything is handled.
40. As a manager, I want to refund individual lines, so that a customer returning one of three dishes is handled.
41. As a manager, I want refunds to require my PIN and a reason, so that money leaving the drawer is always attributable.
42. As a manager, I want to be prevented from refunding more than was paid, so that repeated partial refunds cannot exceed the sale.
42a. As an owner, I want a refunded line to give back what the customer actually paid for it after a whole-bill discount — not its listed price — so that every discounted partial refund does not quietly cost me the difference.
42b. As a manager, I want to choose which lines and how many of each I am refunding, so that returning one of three portions is one action.
42c. As a manager, I want each line to show what is still refundable after an earlier partial refund, so that I am not doing subtraction in front of a customer.
42d. As an owner, I want refunding every line one at a time to return exactly what was paid — no more, no less — so that the arithmetic cannot drift by a centavo per refund.
42e. As a VAT-registered owner, I want a refund's VAT backed out at the rate captured on the original sale, and a refund of a VAT-exempt sale to record no VAT, so that reversals match what was actually charged.
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

**Order lookup reads the recent-Orders store, not the Outbox.** The Outbox holds
unacknowledged entries and empties as they sync; a lookup built on it would find a sale during
an outage and lose it the moment the terminal caught up. `offline-sync` owns that store and its
window — **the current DrawerSession plus the previous two business days**, pruned at
DrawerSession close, with unacknowledged Orders never pruned. This area consumes it, and a
Void or Refund taken against a synced sale works offline for the same reason a sale does.

**The lookup falls back to the Store when the sale is not local, and says so when it cannot.**
The local store answers instantly and offline; a number that is not in it is searched against
the Store — the same query the back-office Orders list runs, **authorised identically**, so it
returns only Orders of the caller's Tenant and the Device's own Store — and the result opens
the same read-only receipt with the same Void and Refund actions.

**Three outcomes, and all three are worded, because a blank result reads to a cashier as
*this receipt is not real*:**

```
found locally        opens immediately, online or offline
not local, online    found in this Store and opened — same actions
                     OR "no sale with this number in this store"
not local, offline   "this sale was not rung on this terminal — reconnect to find it"
```

The middle case has a subtlety worth stating: the other terminal may have rung the sale and
**not yet synced it**, so the server legitimately has no such row. That is not "no such sale" —
the wording is *not found in this store; it may still be waiting to sync on the terminal that
rang it*, and the cashier's move is that terminal, not a refusal to the customer.

This works because a Device code is unique within its Store (`tenancy-identity`), so a printed
`C2-0421` names exactly one sale in that shop. Without that constraint the fallback would be a
way to refund the wrong Order, so it is a dependency and not a nicety.

**A refund taken on one terminal for a sale rung on another takes the cash out of the drawer
performing it.** That is physically what happens, so it is what the drawer records: the cash
movement belongs to today's DrawerSession on *this* Device, while `reporting` still attributes
the refund to the original sale's business day. The two are consistent and they look
inconsistent — which is why it is written here, in `drawer-sessions`, and in `reporting`,
rather than discovered by whoever reconciles the first one.

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

**A Ticket is a labelled draft, not a new entity** (ADR-0011). The Device may hold many
drafts instead of one; each carries a **ticket label** and an opened-at time. Everything else
about a draft is unchanged: it lives in local storage, it is **never sent to the server**, and
it joins the Outbox only on `paid`. Resuming a Ticket opens a draft — it is not a state
transition, and the `draft → paid` machine above is untouched.

- **A Ticket belongs to the Device that opened it and is invisible to every other Device.**
  No sharing, no takeover, no lock. This is what keeps the feature small: there is no shared
  mutable draft, so there is no merge, and DeanPOS has no merge semantics anywhere by design.
- **Discarding a Ticket writes nothing.** The server never saw it. A discard is not a Void,
  produces no reversal record, and appears in no report — Voids and Refunds remain operations
  on *paid* Orders (story 17h).
- **A DrawerSession cannot close while Tickets are open** (story 17i). The guard lives in
  `drawer-sessions`; this area supplies the count of open Tickets and the resolve-each flow.
- **Table labels are a Store-scoped configured list, ordered, empty by default** — free
  strings with **no stored state**, following the comparison product's predefined-ticket model
  (Loyverse §2.14) rather than a floor plan. `tenancy-identity` owns the list; this area
  consumes it.
- **Occupancy is derived, never stored:** a table is occupied if an open Ticket on this Device
  carries its label. A configured label holds **at most one** open Ticket and the picker
  **hides labels already in use** (Loyverse §2.14.2). Free-text labels are unconstrained.
- **The Tables view and the Tickets list are the same screen in two configurations.** With
  table labels configured, the terminal shows a grid of them — free tiles start a new labelled
  order, occupied tiles show their Ticket's item count and total and resume it on tap — with
  any free-text Tickets listed beneath. With none configured, the grid is absent and the screen
  is the plain list. One route, one set of objects, and the empty-list case is the default.
- **Moving a Ticket to another label is supported** (Loyverse's *Move ticket*, §2.14.3) —
  the customers moved tables, and a Ticket is a local draft, so this is editing a string.
  **Splitting and merging Tickets are not built**; both are shared-draft operations and both
  are where that product's complexity actually lives.
- The label is **captured on the Order**, like every other configuration (ADR-0010).

**The fulfilment tag is recorded and not interpreted** (ADR-0011). An Order may carry
`dine_in` | `take_out` | `delivery` | `pick_up`, chosen on the sale screen and captured on the
Order. **v1 branches on it nowhere**: no routing, no fee, no separate pricing, no service
charge, no address, no preparation queue. `reporting` shows it as a column and a filter and
builds no breakdown around it. **Noted for v2:** `take_out`, `pick_up`, and `delivery` overlap
in ordinary usage and the distinction that will matter is who carries the food and who pays
for that — settle the taxonomy when a tenant needs it to mean something. Nothing acts on the
tag, so changing its meaning later is a backfill and not a behavioural risk.

**Payment method sits at the top of the payment panel, level with the amount due** (story
22d). *How are you paying* is the first question at the counter, not the last, and a chooser
under the keypad is answered after the cashier has already typed a tendered amount that only
makes sense for cash. The keypad, quick-tender row, and change display are **cash-only
controls** and are not rendered for a recorded tender. A cash-only tenant — the default — sees
no chooser at all and loses nothing to this layout.

**GCash and Maya render with their own mark and brand colour** (story 22e); every other
method is a plain chip. Two constraints on that, both non-negotiable: the marks come from each
provider's **official brand kit**, never redrawn or approximated, and the colour is theirs, not
one eyeballed from a screenshot. And the branding must not imply an integration — the panel's
standing copy that a recorded tender **authorises nothing** stays exactly where it is, because
a familiar logo is precisely what would make a cashier assume otherwise.

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

**The rule is "once per stored figure", not "once per Order".** There are exactly three
rounded figures — the OrderLine total, the Order-scoped Discount amount, and the Refund
amount (see *Refund arithmetic* below) — and none is
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

**Refund arithmetic — a partial refund returns what the line actually cost, not what it was
listed at.** This is the rule that was missing, and it is where money silently goes wrong.

An Order-scoped Discount came off the **whole bill**, so every line was effectively sold for
less than its recorded total. Refunding a line at its recorded total therefore hands back
money the customer never paid.

```
line share of the Order        = OrderLine total × (Order total / Σ OrderLine totals)
                                 computed in exact Millicentavos

refund amount for a selection  = Σ the shares of the selected lines and quantities
                                 ROUND ONCE, half-up  →  Centavos          ← rounded figure 3

FINAL refund clearing the Order = Order total − everything already refunded
                                 (the remaining balance, not a recomputed share)
```

**The ratio is `Order total ÷ Σ line totals`, not `1 − discount ÷ Σ line totals`.** They
agree for an ordinary Discount and they disagree for a VAT-exempt one, where the discount is
computed on the VAT-exclusive base and the VAT comes off as well: on the ₱385.00 / 12% /
20% SC-PWD sale the Order total is ₱275.00, and `1 − 68.75/385` would apportion ₱316.25
across the lines — ₱41.25 more than the customer ever paid, refundable on a single-line order.
The ratio form is stated against **what was actually paid over what was listed**, so it holds
for every configuration this product has: VAT on or off, exempt or not, discount or none.

Two worked examples, both required tests:

- **Ordinary Discount.** ₱385.00 subtotal, ₱77.00 Order-scoped senior discount, Order total
  ₱308.00. One line recorded at ₱120.00 comes back: `120.00 × (308/385) = ₱96.00` — **not
  ₱120.00**. Returning the listed price costs the tenant ₱24.00 on that refund and on every
  discounted partial refund after it, invisibly.
- **VAT-exempt Discount.** Same subtotal, 12% VAT, 20% SC/PWD, Order total ₱275.00. The same
  line comes back: `120.00 × (275/385) = ₱85.71`. The refund records **zero VAT**, because the
  sale did.

- **The last refund returns the remaining balance.** Apportioning to lines leaves a residue of
  a centavo or two that no line owns; if each refund recomputed its own share, refunding every
  line one at a time could return more or less than was paid. The refund that clears the Order
  absorbs it, so **refunding every line individually returns exactly the Order total**.
- **Refundable remaining is per line and is shown**: a line already partly refunded shows what
  is left, and the running total of refunds may never exceed the Order total. Enforced
  server-side from persisted rows (SC10), never from a figure the terminal sent.
- **Reversals against one Order serialise, and the check is inside the write.** Idempotency on
  each reversal's own UUID makes a *retry* safe; it does nothing about two *different* refunds
  arriving together, which is exactly what an Outbox drain after an outage produces. Two
  requests can each read ₱100.00 remaining and each commit ₱100.00, returning ₱200.00 on a
  ₱100.00 sale — and the same race lets a Void and a Refund both observe `paid` and both
  commit, defeating the rule that one excludes the other. **Read-remaining and write-reversal
  happen in one transaction that takes a lock on the Order**, so the second request sees the
  first one's row and is refused. This is the one place in the product where two writers
  contend for the same row, and it is where money is.
- **Line-scoped Discounts and manual overrides need no *separate* step, and they are not an
  exception to the ratio.** Both are already inside the recorded OrderLine total — that is what
  "recorded" means — so they are apportioned exactly once by being part of the figure the ratio
  multiplies. A line carrying one **still gets the Order ratio**, because an Order-scoped
  Discount reduced it too. An earlier draft of this section said such lines refund at their
  recorded total with no apportionment; that was wrong whenever both applied to the same line,
  and it is the double-reduction confusion this bullet now exists to prevent.
- **VAT follows the sale it is reversing, never the Tenant's current setting.** With VAT
  enabled, the refund's VAT is backed out of the refund amount at the rate **captured on the
  Order**. Where the sale recorded zero VAT — the VAT-exempt SC/PWD case — the refund records
  zero VAT too. A refund never invents a VAT figure the sale did not have.
- **A whole-order refund is the Order total**, full stop. No apportionment, no summing of
  shares, no opportunity to be off by a centavo.

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
**every stored figure is rounded exactly once — the OrderLine total, the Order-scoped
Discount amount, and the Refund amount, and nothing else**; the Order total always equals the sum of the stored
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
- **Tickets, tested where they can actually go wrong** (ADR-0011): a labelled Ticket is set
  aside and resumed with its lines and its label intact · two Tickets are open at once and
  stay independent · an open Ticket appears in **no** total, no report query, and no
  DrawerSession figure · a discarded Ticket leaves no row anywhere and no reversal record ·
  Tickets survive a terminal reload, like any draft · a Ticket that is paid becomes an
  ordinary Order carrying its label, and the label is captured on it · a second Device sees
  none of the first Device's Tickets.
- **The fulfilment tag is captured and inert**: an Order tagged `delivery` persists the tag
  and produces byte-for-byte the same totals, receipt, and drawer effect as an untagged one.
  If any figure moves, something branched on the tag and should not have.
- **The payment panel's cash-only controls do not render for a recorded tender** — choosing
  GCash removes the keypad, the quick-tender row, and the change display, and the
  authorises-nothing copy is still present.
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
- **The apportionment case, as a named example:** ₱385.00 subtotal, ₱77.00 Order-scoped
  discount, ₱308.00 total, one ₱120.00 line returned → **₱96.00**. Asserting ₱120.00 is the
  bug this test exists to catch, and it is the one an implementer will write by default.
- **The same order, VAT-exempt** — 12% VAT, 20% SC/PWD, total ₱275.00 — returns **₱85.71** for
  that line and records zero VAT. Both examples are required, because a rule written as
  `1 − discount/subtotal` passes the first and over-refunds the second by ₱41.25 across the
  order.
- **Two different refunds submitted concurrently against one Order cannot both succeed beyond
  the remaining balance**, and a concurrent Void and Refund cannot both commit. Asserted with
  genuinely parallel requests, not sequential ones — a sequential test passes against the
  broken implementation.
- A line carrying **both** a line-scoped Discount and an Order-scoped one refunds its ratio
  share of the already-reduced recorded total — reduced once, not twice.
- **Refunding every line individually returns exactly the Order total** — property-tested over
  generated carts and discounts, in any line order, with the final refund absorbing the
  apportionment residue. Off-by-a-centavo here is money, repeated per refund.
- A line already partly refunded reports the correct remaining refundable quantity and amount,
  and a request exceeding it is refused **server-side from persisted rows**.
- A refund's VAT is backed out at the rate **captured on the Order**, not the Tenant's current
  rate; a refund of a VAT-exempt sale records zero VAT rather than omitting the field.
- A line carrying a line-scoped Discount or a manual override refunds its **ratio share of the
  already-reduced recorded total** — the line reduction is inside the recorded figure, the
  Order ratio is applied on top of it, and neither is applied twice.
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
**exactly three figures are ever rounded — the OrderLine total, the Order-scoped Discount
amount, and the Refund amount**; VAT backed out and re-applied returns the original total; a VAT-exempt Discount
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
- **Receipt hardware of any kind** — thermal printer, ESC/POS, cash-drawer kick, scanner,
  card terminal. Non-goal for v1. The receipt is the rendered view; "print" means the
  browser's own print of that view, and nothing in this product talks to a device.
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
- Kitchen tickets, split bills, table service, and floor management. Non-goals — this is
  still order-then-pay counter service, and Tickets did not change that.
- **Shared Tickets.** A Ticket is owned by the Device that opened it and no other terminal can
  see or resume it (ADR-0011). **Deferred, trigger:** a tenant with two or more terminals where
  the customer orders at one and pays at another. That version is a shared mutable draft and
  needs conflict resolution the current model deliberately has nowhere.
- **Table state of any kind** — occupancy, seating, covers, turn time, a floor plan, or
  preventing two Tickets on one table. A table is a label (ADR-0011).
- **Anything acting on the fulfilment tag** — routing, delivery fees, service charges,
  addresses, couriers, preparation queues, or a report broken down by it. v1 records the word
  and nothing else, deliberately, and v2 decides what it means.
- **Storing a rendered receipt** as a file, in object storage or anywhere else. A receipt is a
  view over the Order, rendered on demand (ADR-0012).
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
- **The parked-order deferral was triggered and is now built** (ADR-0011, 2026-08-01). The
  trigger this PRD wrote down — *a tenant reporting that the counter stalls because a cashier
  cannot set one order aside* — was reported by the stakeholder before v1 shipped: customers
  stand at the counter deciding while the queue builds.

  **It came back as the cheap version, exactly as this note said it should.** A Ticket is a
  private draft on one terminal — many of them now instead of one — with a label. No server
  state, no merge, no conflict. What stayed out is the expensive version: a *shared mutable
  draft* that any Device can edit, which in an offline-first product means two terminals
  editing one cart while disconnected, where last-write-wins silently drops a line the
  customer ordered. The comparable product's own manual concedes its open tickets work offline
  "but without synchronization with other devices".

  **A parked draft is a small feature and an open ticket is a distributed-systems problem.**
  The line between them is where v1 stops, and the trigger for crossing it is written into
  Out of Scope above.
- **The most damaging possible bug in this feature is an open Ticket counted as a sale.**
  Every total, every report, and every DrawerSession figure must be blind to drafts. Test it
  directly rather than trusting that a query filters on `paid`.
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
