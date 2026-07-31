# Glossary — DeanPOS

Canonical vocabulary. Use these words in issue titles, test names, types, and column
names. The **Not** column lists synonyms that are decided against, not style preferences.

## Tenancy & access

| Term | Means | Not |
| --- | --- | --- |
| **Tenant** | One restaurant business. The isolation unit — every row carries `tenant_id`. | account, org, company, client |
| **Store** | One physical outlet of a Tenant. Sales, DrawerSessions, and Shifts are per-Store. | branch, location, site |
| **User** | A person who signs in: cashier, manager, or admin. | staff, employee, operator |
| **Role** | `cashier` \| `manager` \| `admin`. Determines what may be authorised, not merely who is logged in. | permission group, level |
| **Device** | An enrolled terminal, bound to one Store, holding a long-lived token. Sales are attributed to a Device. | terminal (in code), register, till |
| **PIN** | 4–6 digit secret a User enters to unlock a Device. Hashed; verifiable offline. | passcode, password |

## Catalog

| Term | Means | Not |
| --- | --- | --- |
| **MenuItem** | A sellable concept with no price of its own, e.g. *Ulam*. Never sold directly. | product, item, SKU |
| **Variant** | A priced, sellable form of a MenuItem, e.g. *Adobo*, *Munggo*. **Price lives here.** | option, choice, SKU |
| **Modifier** | An adjustment on a Variant that changes what is served, e.g. *Whole*, *Half*. Carries a typed delta. | size, option |
| **Add-on** | An extra selected at sale time, e.g. *Extra rice*, *Itlog*. Configured once per Tenant, attachable to Variants. | extra, topping, upsell |
| **Delta** | A Modifier's or Add-on's price adjustment. Typed as `absolute` (±centavos) or `multiplier` (×rate) — never inferred. | adjustment, discount |

## Sales

| Term | Means | Not |
| --- | --- | --- |
| **Order** | One customer's purchase. States: `draft → paid → (voided \| refunded)`. | ticket, transaction, sale (in code), bill |
| **OrderLine** | One Variant + its chosen Modifiers and Add-ons, with the price captured **at sale time**. | line item, cart item |
| **Payment** | An amount tendered against an Order, under one PaymentMethod. | tender, transaction |
| **PaymentMethod** | A tenant-configured way of paying: `cash`, or a named **recorded tender** (Card, GCash, Maya, Bank transfer). `cash` always exists and is the only one that reaches the drawer. DeanPOS authorises nothing. | payment type, tender type, gateway |
| **Discount** | A tenant-configured, typed reduction a cashier applies on purpose: name, `percent` \| `amount`, Order- or line-scoped, optionally VAT-exempt, optionally requiring a reference. Off by default. | promotion, coupon, deal, offer |
| **Override** | A manager approval attached to an action a cashier may not perform alone. Names the approving User. | approval, unlock |
| **Manual override** | An untyped price change on one OrderLine, always manager-approved. **Not a Discount** — a Discount is named and configured, a manual override is a one-off. Reported separately. | discount, markdown |
| **Void** | Manager-approved cancellation of a whole **paid** Order. Writes a new record; never mutates the Order. | cancel, delete |
| **Refund** | Manager-approved return of money for a whole Order or one OrderLine. Writes a new record. | return, reversal, void |

## Cash control

| Term | Means | Not |
| --- | --- | --- |
| **DrawerSession** | One cashier's session on one Device, from open to close. Every Order belongs to a DrawerSession. | shift, session, day, drawer, till |
| **Float** | Cash declared in the drawer at DrawerSession open. | opening balance, starting cash |
| **Cash count** | Cash physically counted at DrawerSession close. | closing balance |
| **Variance** | Cash count − expected. Non-zero beyond threshold requires an Override. | discrepancy, short, over |
| **Running summary** | The *open* DrawerSession's figures so far, readable mid-session. Elsewhere called an X-report. | X-report, mid-shift report |
| **Session summary** | The *closed* DrawerSession's final figures, including count and Variance. Elsewhere called a Z-report. | Z-report, end-of-day report |

**`Shift` never means a DrawerSession.** A DrawerSession is about *cash*; a Shift is about
*labour*. They are related in practice — a cashier usually opens a DrawerSession during a
Shift — but they are separate records with separate lifecycles, and v1 does not link them.

## Workforce

| Term | Means | Not |
| --- | --- | --- |
| **Shift** | A scheduled block of work: one User, one Store, a start and an end. Rostering only. | drawer session, till session, duty |
| **Roster** | The set of published Shifts for a Store over a period. | schedule (as a noun for the artefact), rota |
| **Publish** | The act that makes a Roster visible to staff. An unpublished Roster is a draft the manager is still editing. | release, send |

## Sync

| Term | Means | Not |
| --- | --- | --- |
| **Outbox** | The Device's local IndexedDB queue of Orders not yet acknowledged by the server. | queue, buffer, cache |
| **Replay** | Sending Outbox entries to the server. Idempotent on the client-generated Order UUID. | sync, upload, push |
| **Recorded price** | The price the customer actually paid, captured on the Device. The server stores it verbatim and never re-prices. | expected price, current price |

## Rules that are vocabulary, not implementation

- All money is **integer centavos**, PHP, never a float.
- **A price is always what the customer pays.** VAT is never added at checkout.
- **VAT is a Tenant setting, off by default** (ADR-0010). When on, the configured rate is
  *backed out* of the recorded total for reports and receipts. When off, no VAT figure
  exists anywhere. Most target tenants are below the VAT threshold and must not show one.
- **Discounts and PaymentMethods are Tenant-configured lists, empty and cash-only by
  default** (ADR-0010). The out-of-the-box product is cash, no VAT, no discounts.
- **Whatever configuration was in force is captured on the Order** — VAT enablement and
  rate, Discount name/type/value, PaymentMethod name. A report reads what the sale said,
  never what the settings say now. Same principle as *recorded price*.
- Rounding happens **once, at the OrderLine total, half-up**.
- `paid` is irreversible. Nothing after it edits an Order.
- **A sale happened when the Device says it happened.** Device time determines the business
  day, hour, and period in every report. Server receipt time is retained only to show sync
  lag and to detect implausible clock skew. Decided in `reporting`.
- A **business day** runs from the Store's configured start time in the Tenant's timezone
  (default `Asia/Manila`, `00:00`) to the same time next day. UTC never appears in the UI.
