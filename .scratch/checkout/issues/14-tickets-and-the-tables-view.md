# 14 — Tickets and the tables view

**Status:** ready-for-agent
**Category:** feature

## What to build

A customer stands at the counter still deciding while the queue builds. The cashier sets that
order aside under a label, serves the next three people, and comes back to it in one tap.

**A Ticket is a labelled draft, not a new entity** (ADR-0011). The Device may hold many drafts
instead of one; each carries a label and an opened-at time. Everything else about a draft is
unchanged: it lives in local storage, it is **never sent to the server**, and it joins the sale
flow only at `paid`. Resuming a Ticket opens a draft — it is not a state transition, and the
`draft → paid` machine is untouched.

- **A Ticket belongs to the Device that opened it and is invisible to every other Device.** No
  sharing, no takeover, no lock. This is what keeps the feature small: no shared mutable draft,
  therefore no merge, and DeanPOS has no merge semantics anywhere by design.
- **Discarding a Ticket writes nothing.** The server never saw it. A discard is not a Void,
  produces no reversal record, and appears in no report.
- **A DrawerSession cannot close while Tickets are open.** The guard lives in `drawer-sessions`;
  this issue supplies the **count of open Tickets** and the resolve-each flow.
- The label is **captured on the Order** when the Ticket is paid, like every other configuration.

**Table labels are a Store-scoped configured list, ordered, empty by default** — free strings
with **no stored state**. `tenancy-identity` owns the list (`Store.tableLabels`, already
shipped); this area consumes it. **Occupancy is derived, never stored:** a table is occupied if
an open Ticket on this Device carries its label. A configured label holds **at most one** open
Ticket and the picker **hides labels already in use**. Free-text labels are unconstrained — a
Store without a floor plan types "red shirt" and the feature works.

**The tables view and the tickets list are the same screen in two configurations, not two
screens.** With table labels configured, the terminal shows a grid of them — free tiles start a
new labelled order, occupied tiles show their Ticket's item count and total and resume it on tap
— with any free-text Tickets listed beneath. With none configured, the grid is absent and the
screen is the plain list. **One route, one set of objects**, and the empty-list case is the
default. Building them as two routes is the mistake this note exists to prevent.

**Moving a Ticket to another label is supported** — the customers moved tables, and a Ticket is
a local draft, so this is editing a string. **Splitting and merging Tickets are not built**; both
are shared-draft operations and both are where the comparison product's complexity actually
lives.

**The most damaging possible bug in this feature is an open Ticket counted as a sale.** Every
total, every report, and every DrawerSession figure must be blind to drafts. Test it directly
rather than trusting that a query filters on `paid`.

## Acceptance criteria

- [ ] The current order is set aside under a label and the sale screen returns to empty.
- [ ] The Tickets list shows each Ticket's label, its total, and how long it has been open, and
      resumes one in a single tap with its lines and label intact.
- [ ] Two Tickets are open at once and stay independent.
- [ ] Tickets survive a terminal reload, like any draft.
- [ ] A discarded Ticket leaves **no row anywhere** and no reversal record.
- [ ] An open Ticket appears in **no** total, no report query, and no DrawerSession figure —
      asserted directly, not inferred from a `paid` filter.
- [ ] A second Device sees none of the first Device's Tickets.
- [ ] A paid Ticket becomes an ordinary Order carrying its label, and the label is captured on it.
- [ ] The count of open Tickets is exposed for `drawer-sessions`' close guard, with the
      resolve-each flow.
- [ ] With `Store.tableLabels` configured, one route renders the grid — free tiles start a new
      labelled order, occupied tiles show item count and total and resume on tap — with free-text
      Tickets beneath. With none configured, the same route is the plain list. **One route.**
- [ ] Occupancy is derived from open Tickets and never stored; a label already in use is hidden
      from the picker, so two orders cannot land on Table 4.
- [ ] A Ticket is moved to a different label without re-ringing.
- [ ] Free-text labels are accepted and unconstrained.
- [ ] Nothing here issues a network request.
- [ ] Both layouts where drawn; WCAG 2.2 AA.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/tickets-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/tickets-390.svg`
- Image · whole-screen · 1280: `design/lofi/pos/tables-1280.svg`
- Image · component: SetAsideDialog · 1280: `design/lofi/pos/set-aside-1280.svg`

`tables-1280` and `tickets-1280` are **one route in two configurations**. 390 is not drawn for
the tables configuration — flag the translation in the build report.

## Relevant files

- `apps/pos/src/routes/` — create: the tickets route (one route, two configurations)
- `apps/pos/src/features/tickets/` — create: list, tables grid, set-aside dialog, move
- `apps/pos/src/features/sale/` — edit: many drafts instead of one, label capture at payment
- `packages/backend/src/order/` — edit: store the ticket label on the Order
- tests — create: independence, discard-writes-nothing, blind-to-drafts, per-Device isolation

## Depends on

- 03 — The paid Order: cash, idempotent submit, and the recorded price
