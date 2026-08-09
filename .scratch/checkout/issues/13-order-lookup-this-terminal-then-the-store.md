# 13 — Order lookup: this terminal, then the Store

**Status:** ready-for-agent
**Category:** feature

## What to build

A customer comes back holding a receipt. The cashier types the number and gets the sale — at the
counter, with no wait, and usually with no network.

**The lookup reads the recent-Orders store, not the Outbox.** The Outbox holds unacknowledged
entries and empties as they sync; a lookup built on it would find a sale during an outage and
lose it the moment the terminal caught up.

**Window:** the current DrawerSession plus the previous two business days, so a cashier knows
without asking whether a sale will be findable here. The lookup can also be narrowed to the
users who **actually used this terminal today** — after a handover, finding your own sales must
be two taps and not a directory of every User in the Store.

**Seam note, deliberate:** `offline-sync` (area 5) owns the recent-Orders store, its pruning at
DrawerSession close, and the rule that unacknowledged Orders are never pruned. That area does
not exist yet, so **this issue builds the minimal local store and the stated window, and area 5
takes ownership of pruning and retention when it lands.** Do not build an Outbox here.

**The fallback, and the three outcomes — all three worded, because a blank result reads to a
cashier as *this receipt is not real*:**

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

The server query is **the same query the back-office Orders list runs, authorised identically** —
only Orders of the caller's Tenant and the Device's own Store. This works because a Device code
is unique within its Store (`tenancy-identity`), so a printed `C2-0421` names exactly one sale in
that shop. Without that constraint the fallback would be a way to refund the wrong Order.

A result opens the **same read-only receipt with the same Void and Refund actions** — finding a
sale is only worth something if a manager can act on it.

**A refund taken on one terminal for a sale rung on another takes the cash out of the drawer
performing it.** That is physically what happens. The cash movement belongs to today's
DrawerSession on *this* Device, while `reporting` still attributes the refund to the original
sale's business day. The two are consistent and they look inconsistent, which is why it is
written here rather than discovered by whoever reconciles the first one.

## Acceptance criteria

- [ ] The terminal keeps the Orders it rang within the stated window and looks one up by number
      with **zero network requests** — asserted with the transport stubbed to throw.
- [ ] The window is the current DrawerSession plus the previous two business days, and the
      screen states it.
- [ ] The lookup can be narrowed to a user who actually used this terminal today; the list of
      those users comes from this terminal's own history, not from the Store's directory.
- [ ] A number not held locally, **online**, queries the Store — authorised identically to the
      back-office Orders list, restricted to the caller's Tenant and the Device's Store — and
      opens the same read-only receipt.
- [ ] All three outcomes are worded as specified; the not-found wording says the sale may still
      be waiting to sync on the terminal that rang it.
- [ ] A number not held locally, **offline**, produces the reconnect wording — never a blank
      result.
- [ ] Void and Refund are available on an Order found either way, with the same authorisation.
- [ ] A refund performed here records its cash movement against this Device's session while the
      original sale keeps its own business day — asserted, since `drawer-sessions` will consume it.
- [ ] Wrong-tenant and wrong-Store probes on the fallback procedure; a wrong id reads the same
      whether it belongs to another Tenant or does not exist.
- [ ] The Device code is displayed with the order number wherever a number from another terminal
      is shown.
- [ ] WCAG 2.2 AA.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/order-lookup-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/receipt-1280.svg`

390 is not drawn for this screen — the translation must be flagged as such in the build report,
not quietly invented.

## Relevant files

- `apps/pos/src/features/order-lookup/` — create: the lookup screen, the three outcomes
- `apps/pos/src/lib/` — create: the local recent-Orders store and its window
- `packages/backend/src/order/` — edit: the Store-scoped lookup query
- tests — create: zero-network local lookup, the three outcomes, the probes

## Depends on

- 04 — The receipt and the device-assigned order number
- 11 — Void and the whole-order refund
