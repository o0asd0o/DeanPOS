# ADR-0011: Open tickets are labelled drafts owned by one Device; tables are labels; fulfilment is a tag

- **Status:** accepted
- **Date:** 2026-08-01
- **Decided by:** human (stakeholder request), after the parked-order deferral in `checkout`
- **Amends:** `checkout`'s "Parking an order to serve the next customer — deferred", and
  ADR-0003's assumption that a Device holds at most one draft at a time

## Context

The `checkout` PRD deferred parked orders with a trigger: *a tenant reporting that the counter
stalls because a cashier cannot set one order aside.* The stakeholder reported it before v1
shipped — customers stand at the counter deciding while the queue builds — and asked for
tickets **together with tables**.

That is two things, and the distinction is the whole decision:

- A **parked draft** is a private object on one terminal. No server state, no merge, no
  conflict. Small feature.
- An **open ticket** in the comparable product is a *shared mutable draft*: two terminals can
  edit the same cart, offline, and the merge has no correct answer. Distributed-systems
  problem, in a product that by design has no merge semantics anywhere (ADR-0003 — the Outbox
  replays completed sales, and a completed sale is immutable).

The requested capability — set an order aside under a name, come back to it — is fully served
by the first. The second is only needed when the terminal that *takes* an order is not the
terminal that *closes* it. A carinderia counter is one terminal.

**The comparison product was read before deciding, not after.** In the Loyverse manual, tables
are §2.14 *How to Use Predefined Open Tickets to Name Tables* — a per-Store list of ticket
names, a picker that hides names already in use, and a *Move ticket* action. There is no floor
plan and no seating state. Dining options are §2.19: a per-Store list, shown on the ticket and
printed on the receipt, acted on nowhere except an optional tax rule. Both are smaller than the
words "tables" and "dining options" suggest, and this decision keeps them that size.

## Decision

### A Ticket is a draft Order with a label, owned by the Device that opened it

- **No new entity.** A **Ticket** is an Order in `draft` state carrying a **ticket label** and
  an opened-at timestamp. Everything already true of a draft stays true: it is local to the
  Device, it lives in the terminal's local storage, it is **never sent to the server**, and it
  enters the Outbox only when it becomes `paid` (ADR-0003).
- **A Device may hold many open Tickets**, not one. That is the only change to the draft
  lifecycle.
- **A Ticket is owned by exactly one Device and is invisible to every other Device.** No
  sharing, no takeover, no lock, no merge — because there is nothing to merge: two terminals
  cannot hold the same Ticket.
- **Resuming a Ticket is opening a draft**, not a state transition. The Order still goes
  `draft → paid`; the state machine of ADR-0005 is untouched.
- **Discarding a Ticket writes nothing anywhere.** A draft never reached the server, so
  discarding one is not a Void and produces no record. Voids and Refunds remain what they are:
  operations on *paid* Orders.
- **A DrawerSession cannot be closed while Tickets are open.** The cashier pays or discards
  each one first. Otherwise the Session summary silently omits money the cashier believes was
  taken, and the next cashier inherits a stranger's carts.

### Tables are labels, not an entity

**This follows the comparison product's model directly** (Loyverse manual §2.14, *How to Use
Predefined Open Tickets to Name Tables*): tables there are not a floor plan or a seating
system — they are a per-Store list of **predefined ticket names**, and "Table 4" is a name a
ticket can be saved under. That is the whole feature, and it is the right size for a
carinderia.

- A Store may configure a **list of table labels** — free strings, ordered, empty by default.
  Empty means the cashier types a label instead of picking one, and a tenant that does not use
  tables sees no table control at all.
- **A table label has no stored state.** No occupancy flag, no floor plan, no covers, no turn
  time. Nothing is written to a table, ever.
- **Occupancy is derived, never stored.** A table is "occupied" if an open Ticket on this
  Device carries its label — a read over the local drafts, computed at render time.
- **A configured table label holds at most one open Ticket**, and the picker **does not offer
  a label that is already taken** (Loyverse §2.14.2: *"The list does not show already occupied
  predefined tickets"*). Free-text labels carry no such constraint — two customers can both be
  "Aling Nena" and that is the cashier's problem, not the product's.
- Because Tickets are Device-owned, that uniqueness is **per Device**. Two terminals could each
  hold a "Table 4". That is a consequence of the single-terminal assumption, not an oversight,
  and it disappears if shared Tickets are ever built.
- **A Ticket can be moved to another label** — renaming it, or moving it from "Table 4" to
  "Table 7" when the customers move. This is Loyverse's *Move ticket* (§2.14.3) and it is
  trivial here: a Ticket is a local draft, so moving one is editing a string. **Splitting and
  merging Tickets are not built** — those are where that product's complexity actually lives,
  and both are shared-draft operations.
- The label is **captured on the Order** at sale time, like every other configuration
  (ADR-0010), so renaming or deleting a table never rewrites a past sale.

### Fulfilment is an uninterpreted tag

- An Order carries an optional **fulfilment tag**: `dine_in` | `take_out` | `delivery` |
  `pick_up`. Captured on the Order, shown in the Orders list, filterable, and **shown on the
  receipt** — which is what the comparison product does with its Dining options (§2.19.2).
- **A fixed four-value enum, not a configurable list.** Loyverse makes dining options a
  per-Store editable list with the first as default (§2.19.1). That is the v2 shape if a tenant
  needs their own words; v1 takes the four names asked for and skips a settings surface for a
  field nothing reads.
- **v1 interprets it nowhere.** No routing, no delivery fee, no separate pricing, no service
  charge, no address, no courier, no preparation queue, no report broken down by it. It is a
  word recorded next to a sale so that the question "how much of last month was delivery?" has
  an answer when someone finally asks it.
- **Noted for v2:** `take_out`, `pick_up`, and `delivery` overlap in ordinary Filipino usage,
  and the difference that will eventually matter is *who carries the food and who pays for
  that*. Settle the taxonomy when a tenant needs it to mean something, not before — changing
  the meaning of a tag nobody acted on is free; changing one that drove a fee is not.

## Consequences

- `checkout` gains a Tickets list, a label prompt, and the resume/discard actions. The cart,
  the pricing arithmetic, and the payment flow are untouched.
- `drawer-sessions` gains one close-time guard: open Tickets block a close.
- `offline-sync` gains **nothing**. Tickets are drafts, drafts are local, and the Outbox still
  carries only completed sales. This is the property that makes the feature cheap, and it is
  the one to defend in review.
- `reporting` gains the ticket label and the fulfilment tag as columns on the Orders list and
  as filters. **Open Tickets appear in no report and in no total** — an unpaid draft is not a
  sale, and counting it would be the most damaging possible bug in this feature.
- Storage on the terminal grows with the number of open Tickets. A stale Ticket from three
  days ago is a cashier problem, not a data problem, but the close-time guard means it cannot
  survive a drawer close.

## Reversing it

Cheap in the direction it is likely to go. Tickets are local objects with no server schema, so
extending them to shared tickets later is additive work on the server, not a migration of
anything that exists. The expensive direction is the one not taken: had v1 shipped shared
mutable drafts, removing them would mean taking a working capability away from a live counter.

The fulfilment tag is deliberately reversible: nothing branches on it, so its taxonomy can
change with a data backfill and no behavioural risk.
