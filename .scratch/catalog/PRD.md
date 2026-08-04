# Catalog

- **Status:** ready-for-agent
- **Area:** 3 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `tenancy-identity`
- **Blocks:** `checkout`, `offline-sync`, `reporting`

## Problem Statement

A restaurant cannot sell anything DeanPOS does not know about. After
`tenancy-identity` there are Tenants, Stores, Users, and Devices — and nothing to put on
a receipt.

The shape of what is sold is not a flat product list. A carinderia sells *Ulam*, which is
not itself a thing you can buy; you buy *Adobo* or *Munggo*, and you buy it *Whole* or
*Half*, and you might add *Extra rice* or *Itlog*. Getting that hierarchy wrong forces
one of two bad outcomes: a tenant maintaining a combinatorial explosion of one row per
sellable permutation, or a cashier improvising with manual price overrides — which are
manager-gated for good reason and were never meant to be the normal path.

The terminal also needs the whole menu **locally**, because it must sell while offline
(ADR-0003). That makes the catalog not just a set of CRUD screens but a read model that
has to be fetchable in one shot and versioned so a Device knows when it is stale.

## Solution

A four-level model with exactly one place a price lives:

```
MenuItem  ── "Ulam"            no price, not sellable
  └─ Variant  ── "Adobo"       ₱120   ← the price lives here
       └─ ModifierGroup ── "Size"   choose exactly one
            ├─ Modifier ── "Whole"   ×1.0
            └─ Modifier ── "Half"    ×0.5
  Add-on ── "Extra rice"  +₱15        configured once per Tenant, attached to Variants
```

A **Variant** is the unit that has a price and can be sold. **Modifiers** and **Add-ons**
never hold a price of their own — they hold a typed **Delta**, either `absolute`
(± centavos) or `multiplier` (× rate), applied to the Variant's price using the primitives
`foundation` already built and property-tested. The type is stored, never inferred from
the value.

Back-office screens let an admin or manager maintain all of it. A single read-model
procedure returns a Tenant's whole catalog with a version stamp, which the terminal
fetches, caches, and re-fetches when the version moves. Availability — the F&B "we're out
of adobo" toggle — is **per Store**, because one outlet running out does not affect
another.

## User Stories

**Categories**

1. As a manager, I want to group MenuItems into Categories, so that the terminal grid is navigable instead of one long list.
2. As a manager, I want to order Categories, so that the things we sell most are first.
3. As a manager, I want to rename a Category, so that a change in the menu does not require rebuilding it.
4. As a manager, I want to archive a Category rather than delete it, so that past Orders that referenced its items stay intact.

**MenuItems**

5. As a manager, I want to create a MenuItem with a name and a Category, so that it appears on the terminal.
6. As a manager, I want a MenuItem to carry no price, so that pricing is never ambiguous about which form is being priced.
7. As a manager, I want to be told a MenuItem is not sellable until it has at least one Variant, so that a half-finished item never reaches the terminal.
8. As a manager, I want to order MenuItems within a Category, so that the grid matches how we actually sell.
9. As a manager, I want to archive a MenuItem, so that a seasonal dish disappears from the terminal without erasing its history.
10. As a manager, I want to rename a MenuItem, so that a wording fix does not change any past Order.

**Variants**

11. As a manager, I want to create a Variant of a MenuItem with a name and a price, so that *Adobo* can be sold for ₱120.
12. As a manager, I want to enter prices in pesos and centavos and have them stored exactly, so that ₱120.50 is never ₱120.49.
13. As a manager, I want to change a Variant's price, so that a supplier increase can be passed on today.
14. As a manager, I want a price change to affect only future Orders, so that yesterday's receipts still reconcile.
15. As a manager, I want to order Variants within a MenuItem, so that the most common choice is first.
16. As a manager, I want to archive a Variant, so that a discontinued dish stops being sellable without breaking reports.
17. As a manager, I want to see at a glance which Variants are currently unavailable at which Store, so that I know what the counter cannot sell.

**Modifiers**

18. As a manager, I want to attach a ModifierGroup to a Variant, so that *Adobo* can be sold *Whole* or *Half*.
19. As a manager, I want to state whether a ModifierGroup requires a choice, allows one optional choice, or allows several, so that the terminal enforces it instead of the cashier remembering.
20. As a manager, I want a Modifier to adjust the Variant's price by a fixed amount or by a multiplier, so that *Half* can be ×0.5 while *Add sauce* is +₱10.
21. As a manager, I want to choose which kind of adjustment it is explicitly, so that the value 0.5 is never guessed as either 50 centavos or half price.
22. As a manager, I want a default Modifier in a required group, so that the common case is one tap.
23. As a manager, I want to order Modifiers within a group, so that *Whole* comes before *Half*.
24. As a manager, I want to archive a Modifier, so that removing an option does not corrupt past OrderLines.
25. As a manager, I want to reuse the same group shape across many Variants without retyping it, so that maintaining thirty dishes is not thirty times the work.

**Add-ons**

26. As a manager, I want to define an Add-on once for the whole Tenant with its own price adjustment, so that *Extra rice* is one thing and one price.
27. As a manager, I want to attach Add-ons to the Variants they make sense for, so that the cashier is not offered *Extra rice* with a drink.
28. As a manager, I want to allow an Add-on to be taken more than once, so that a customer can have two eggs.
29. As a manager, I want to set a maximum quantity for an Add-on, so that "two eggs" does not become a typo for twenty.
30. As a manager, I want to archive an Add-on, so that withdrawing it is safe.

**Discounts — optional, empty by default**

30a. As a manager, I want to define the Discounts my business gives, so that a cashier applies a named thing rather than editing a price.
30b. As a manager, I want a Discount to be a percentage or a fixed amount, so that both "20% off" and "₱50 off" are expressible.
30c. As a manager, I want to choose whether a Discount applies to a whole order or to a single line, so that only the eligible person's meal is discounted.
30d. As a manager, I want to leave a Discount's value unset so the cashier is prompted, so that a negotiated reduction is still a named Discount.
30e. As a manager, I want to mark a Discount as requiring a manager, so that not every reduction is a cashier's to give.
30f. As a manager, I want to mark a Discount as VAT-exempt, so that a statutory exemption is computed rather than approximated.
30g. As a manager, I want to require a reference on a Discount and label that field myself, so that a Senior Citizen or PWD ID is captured under the name my staff know it by.
30h. As a manager, I want to archive a Discount, so that withdrawing it does not disturb the sales that used it.
30i. As an owner running a shop that gives no discounts, I want the list to start empty and stay empty, so that neither my back-office nor my terminal shows a feature I do not use.
30j. As an owner, I want the back-office to make plain that DeanPOS discounts are applied by a person and never automatically, so that I do not expect a promotions engine.

**Availability**

31. As a manager, I want to mark a Variant unavailable at my Store, so that the terminal stops offering something we ran out of.
32. As a cashier, I want an unavailable Variant to be visibly unsellable on the terminal, so that I do not promise a customer something we cannot serve.
33. As a manager, I want availability to be per Store, so that one outlet running out does not affect another.
34. As a manager, I want to mark it available again in one tap, so that tomorrow's service is not blocked by yesterday's toggle.

**The read model**

35. As a cashier, I want the whole menu to load on the terminal, so that I can sell it all without waiting on the network per tap.
36. As a Device, I want to fetch the entire catalog in one request, so that caching it locally is simple and atomic.
37. As a Device, I want the catalog to carry a version, so that I can tell whether my cached copy is current without re-downloading it.
38. As a Device, I want the version to change whenever anything in the catalog changes, so that a stale menu is detectable.
39. As a cashier, I want the terminal to show only my Store's availability, so that the grid reflects what I can actually sell.
40. As a cashier, I want archived MenuItems and Variants to be absent from the terminal entirely, so that I cannot sell something withdrawn.

**Permissions**

41. As a tenant admin, I want to control the catalog, so that pricing is a management decision.
42. As a manager, I want to maintain the catalog for my Stores, so that day-to-day menu changes do not need an admin.
43. As a cashier, I want to be unable to change prices or the menu, so that pricing integrity does not rest on my restraint.
44. As a tenant admin, I want another Tenant to be unable to see or change my menu, so that my pricing is not public to a competitor on the same platform.

## Implementation Decisions

**The hierarchy.** `Category → MenuItem → Variant → ModifierGroup → Modifier`, plus
`Add-on` defined at Tenant level and linked to Variants. A MenuItem with zero non-archived
Variants is not sellable and is excluded from the terminal read model — it is a
half-finished draft, and the back-office says so plainly rather than silently shipping it.

**Price lives only on Variant** (ADR-0005). Nothing else in this area stores a price.
Modifiers and Add-ons store a `Delta`, discriminated on `absolute` (± `Centavos`) or
`multiplier` (× rate), using the `Delta` type `foundation` defined. The discriminator is a
stored column, never inferred.

**Composition is defined here, applied in `checkout`.** This area owns what a Delta is and
which Deltas may attach to which Variant; computing an OrderLine total is `checkout`'s
job, using `foundation`'s round-once-half-up rule. The two must not both implement the
arithmetic.

**A `multiplier` is stored as an integer per-mille rate, never as a float** — `×0.5` is
`500`, `×1.25` is `1250`. ADR-0005 prohibits floats in every layer including the wire format
and IndexedDB, and per-mille is the encoding that makes `foundation`'s Delta application exact
with no division at all: `Centavos × per-mille` **is** `Millicentavos`. A rate needing more
than three decimal places is rejected at configuration time rather than silently truncated.

**Delta bounds, as numbers rather than adjectives.** A `multiplier` is `0 < m ≤ 10` (that is,
`0 < m ≤ 10000` per-mille); an
`absolute` Delta is within `±100,000` centavos (±₱1,000) **and** may not drive a linked
Variant's effective price below zero. "Sane bounds" is not a criterion a test can fail
against, which is why these are digits.

**Bounds are re-checked on every write that can invalidate them**, not only at
configuration time: changing a Variant's price, linking a ModifierGroup or Add-on to a
Variant, and editing a Modifier's or Add-on's Delta. A negative effective price is
reachable from three directions and blocked at all three; the check is one function called
from each write path.

**Multiplier rounding — and the type that makes it possible.** A `multiplier` Delta on an
integer-centavo price produces a fraction, so `foundation`'s Delta application returns
**`Millicentavos`** (an integer at 1000× scale), not `Centavos`. The fraction therefore
survives composition exactly, with no float anywhere, and `roundLineTotal` collapses the
scale once at the OrderLine total per ADR-0005.

This area must not round a modified price at the Modifier level. That is worth a comment in
the code because it is the obvious wrong thing to do, and because an earlier draft of
`foundation` asserted the opposite — that Delta application always yields an integer
`Centavos`. Both PRDs now state the same rule; if they ever diverge again, **this one is
wrong**, because the primitive lives in `foundation`.

**ModifierGroup selection rules.** A group declares one of: `required-one`,
`optional-one`, or `many` (with an optional maximum). The terminal enforces the rule and
the server re-validates it when the Order arrives — a rule enforced only in the UI is not
enforced.

**Reusable group shapes.** Retyping "Whole / Half" on thirty Variants is the failure mode
that makes tenants abandon a catalog. A ModifierGroup is defined once and attached to many
Variants; attaching is a link, so editing the group updates every Variant using it.

**Add-ons** are Tenant-level with a Delta and an optional maximum quantity, linked to the
Variants they may accompany. An Add-on with no links is offered nowhere.

**Discounts are a Tenant-level list, empty by default** (ADR-0010). They live in this area
because they are back-office CRUD over a priced concept with an archive rule, which is
exactly what this area already is — not because a Discount is part of the menu.

A `Discount` carries: name · `type` (`percent` | `amount`) · `scope` (`order` | `line`) ·
an optional value · `requiresOverride` · `vatExempt` · `requiresReference` with a
tenant-set label · an archive flag.

Constraints enforced here, at write time, so that `checkout` never has to reason about a
malformed one:

- `amount` implies `scope: order`. Distributing a peso amount across lines is a rounding
  argument with no correct answer.
- A `percent` value is `0 < v ≤ 100`; an `amount` value is a positive `Centavos`. A null
  value means *prompt the cashier*, bounded by the same rules at sale time.
- `requiresReference` demands a non-empty label — an unlabelled required field is a field
  nobody fills in correctly.

**A Discount is a definition, not a rule.** It has no conditions, no schedule, no code, and
no eligibility logic. It carries **no stacking logic of its own**; the one permitted
combination — at most one Order-scoped Discount plus at most one per line — is a rule
`checkout` applies (ADR-0010), not a property configured here. It is applied by a person who
decided to apply it. This is the boundary ADR-0010 drew and the one that keeps this out of
promotions-engine territory; the back-office copy should say so where the list is edited.

**Discounts are part of the read model and carry the same version.** The terminal must be
able to apply one offline, so the catalog read model returns the Tenant's non-archived
Discounts alongside everything else, and editing one bumps the same version. A Discount is
also archived, never deleted, for the same reason a Variant is: an Order from March
references it.

**Visual reference.** `ORC2_DESIGN="lofi"`. Mocks are committed:
`backoffice/catalog-list-1440`, `backoffice/menuitem-editor-1440`, `backoffice/addons-1440`,
`backoffice/availability-1440`, `backoffice/discounts-1440`. The Discounts mock draws
**both** the populated list and the empty state, because empty is the default and the
configuration most tenants will keep — it is not an edge case to be improvised at build
time.

**Availability is per Store, and is not stock.** A boolean toggle per (Variant, Store).
Quantity tracking, depletion, and recipes are non-goals for v1 — this is the F&B "86'd"
switch, nothing more. It lives here rather than in a future inventory area because the
terminal needs it and it costs one table.

**The archive cascade, stated per level** — because "everything archives" says nothing
about a live child of an archived parent, and the two plausible guesses differ by whether
a terminal keeps selling something the manager thought they withdrew:

| Archived | Effect on the read model |
| --- | --- |
| Category | its MenuItems, and their Variants, all leave — **children are not separately archived**, they are excluded by their parent |
| MenuItem | its Variants all leave |
| Variant | that Variant leaves; siblings are unaffected; the MenuItem leaves too if it has no non-archived Variant left |
| ModifierGroup | leaves every Variant it was linked to; the Variants stay sellable unless the group was `required-one`, in which case they leave too — a Variant with an unsatisfiable required group is not sellable |
| Modifier | leaves its group; if the group is `required-one` and now has no option, its Variants leave |
| Add-on | leaves every Variant it was linked to; the Variants stay sellable |

Un-archiving a parent restores the children that were never themselves archived.
**Exclusion is computed from the parent chain, not written down the tree**, so archiving a
Category is one row and cannot half-fail.

**Nothing is hard-deleted.** Everything archives. Archived rows are
excluded from the read model and from the back-office's default views, and remain
readable by id.

The reason is **not** that a March receipt needs to render — `checkout` snapshots the
Variant's name and price onto the OrderLine at sale time (ADR-0003, *recorded price*), so a
receipt renders from itself and never joins back to a catalog row. An implementer who reads
"archive is what keeps old receipts working" may conclude the opposite and live-join them,
which is the bug this note exists to prevent. Archive exists so that an **id** referenced
by a report, an Override, or an Order still resolves, and so that withdrawing something is
not destructive.

**The catalog read model.** One query procedure returns a Store's complete sellable
catalog — categories, items, variants, groups, modifiers, add-on links, and that Store's
availability — plus a **version**. The version changes whenever any of that content
changes for that Tenant. It is derived, not hand-maintained: a monotonically increasing
value or content hash computed from the underlying rows, so no write path can forget to
bump it.

This is a CQRS read model in the `foundation` sense: shaped for the consumer, not mirrored
from the write tables. It is optimised for one shot, because the terminal caches it whole.

`offline-sync` owns caching, refresh scheduling, and what the terminal does with a stale
version. This area owns producing the payload and the version correctly.

**Permissions.** `admin` and `manager` may mutate the catalog; `cashier` may read the read
model only. Managers are additionally constrained to their assigned Stores for
availability toggles. Catalog content itself is Tenant-level, so per-Store price
divergence is not possible in v1 — **deferred, trigger:** the first tenant that genuinely
prices differently by outlet.

**Migrations** are forward-only expand/contract (ADR-0006). Every table gets `tenant_id`
with RLS enabled and forced in the same migration that creates it (ADR-0002).

## Testing Decisions

**What makes a good test here.** Assert what a manager can configure and what a cashier
consequently sees. The read model is the observable contract; the table layout is not.
A test asserting a particular join or a repository call is testing structure and will
break on the first refactor that changes nothing a user notices.

**The seam.** Unchanged from `foundation` and `tenancy-identity` — rendered route →
TanStack Query → oRPC client → in-process Hono → Kysely → real lane PostgreSQL. No new
seam. Actors come from `tenancy-identity`: an admin session, a manager session, a cashier,
and an enrolled Device.

**Prior art.** The wrong-tenant probe helper from `tenancy-identity` is applied to every
procedure here without exception, including the read model — a catalog leak is a pricing
leak to a competitor on the same platform.

**Through the seam.**

- A manager creates a Category → MenuItem → Variant, and it appears in the read model for
  their Store.
- A MenuItem with no Variant does not appear in the read model, and the back-office says
  why.
- A Variant marked unavailable at Store A still appears available at Store B.
- An archived Variant vanishes from the read model and is still readable by id.
- A price change alters the read model, and the previous Variant row is left intact rather
  than mutated in place. **The "does not touch a captured price" assertion lives in
  `checkout`**, not here — OrderLines are area 4, so at this area's build point there are
  no price-capturing rows and the test cannot fail.
- A `required-one` group rejects a submission with no choice; a `many` group with a
  maximum rejects one over it. Validated server-side, not only in the UI.
- Editing a shared ModifierGroup changes every Variant linked to it.
- An Add-on offered on one Variant is not offered on another.
- A cashier cannot mutate anything in this area.
- A manager cannot toggle availability at a Store they are not assigned to.
- The version changes after any catalog write **that changes what the read model
  contains**, and does not change after a read. It is a content fingerprint (record 069),
  so a write that leaves the payload identical — a Save with no edits, or a price moved up
  and back down between two fetches — returns the version it already had. That is correct:
  a terminal holding that version holds a correct copy. The property to assert is the one
  that matters and holds in both directions: **equal versions mean equal payloads.**
- **An availability toggle is a catalog write and moves the version** — asserted on its
  own, because it is the one write most likely to be treated as "not really catalog", and
  a version that does not move leaves every offline terminal selling a sold-out dish until
  something else happens to change.
- **The archive cascade, one test per level** — archiving a Category removes its MenuItems
  and Variants from the read model; archiving a MenuItem removes its Variants; archiving
  the last Modifier of a `required-one` group removes that group's Variants; archiving an
  Add-on leaves its Variants sellable. Un-archiving restores what was never itself
  archived.
- **An Add-on quantity above its maximum is rejected server-side**, the same standard the
  ModifierGroup maximum is held to. A limit enforced only by the stepper is not enforced.
- A `multiplier` of `0`, a negative, and `10.01` are rejected; `10` is accepted.
- An `absolute` Delta beyond ±₱1,000 is rejected.
- **A Variant price change that would make a linked Delta produce a negative effective
  price is rejected**, as is linking a group or Add-on to a Variant too cheap for it —
  the same check, from all three write paths.
- A `required-one` group's default Modifier is marked as the default in the read model,
  and a group with no default is accepted.
- Two Tenants with identically-named catalogs never see each other's rows.

**Discounts.**

- A new Tenant's Discount list is **empty**, and the read model returns an empty list rather
  than omitting the field — the terminal must be able to tell "none configured" from "old
  payload shape".
- An `amount` Discount with `scope: line` is rejected at write time.
- A `percent` value of `0`, `100.01`, or a negative is rejected; `100` is accepted.
- An `amount` value that is not exact centavos is rejected.
- `requiresReference` with an empty label is rejected.
- A Discount with a null value is accepted and marked as prompt-at-sale.
- Creating, editing, or archiving a Discount **moves the catalog version**, so a terminal
  caching the menu also picks up a new Discount.
- An archived Discount leaves the read model and is still readable by id.
- A `cashier` cannot create, edit, or archive a Discount.

**Directly, not through the seam.** Delta validation as pure logic: a `multiplier` outside
sane bounds is rejected; an `absolute` Delta that would drive a Variant's effective price
below zero is rejected at configuration time rather than discovered at the till. These are
property-tested against the `foundation` money primitives.

**Deliberately not tested here.** OrderLine total computation — that is `checkout`'s
behaviour and belongs in its tests, not duplicated here. Terminal caching and refresh
behaviour — `offline-sync`. Visual regression of the grid — the design contract is lo-fi.

## Security Criteria

1. **Wrong-tenant probe on every procedure**, including the read model. A menu is
   commercially sensitive.
2. **RLS enabled and forced** on every table created here, in the creating migration.
3. **Authorisation, not just authentication:** `cashier` is read-only in this area,
   enforced server-side. A hidden button is not enforcement.
4. **Store-scoped authority:** a manager toggling availability must be assigned to that
   Store; the Store id in the request is authorised, not merely validated.
5. **Every id in a request is authorised.** Attaching a ModifierGroup to a Variant must
   verify both belong to the caller's Tenant — this is the classic reachable-by-guessing-
   an-id surface in this area.
6. **Untrusted input:** names, prices, delta values and types, sort orders, quantities,
   and every id. Prices are parsed to `Centavos` at the boundary and rejected if not
   exact; a float never enters the system.
7. **Bounds are enforced at configuration time.** Negative prices, absurd multipliers, and
   maximum quantities that invite a typo are rejected when set, not when sold.
8. **Nothing sensitive is logged.** Catalog writes log actor, Tenant, and entity ids —
   not full payloads, which contain a tenant's complete pricing.
9. **The read model returns only the caller's Store's availability**, so a Device cannot
   infer another Store's operations.
10. **A Discount's economic bounds are enforced at write time**, not at the till — a
    `percent` above 100 or a negative `amount` never reaches a terminal that may be offline
    and unable to ask.
11. **`vatExempt` and `requiresOverride` are financial controls.** Only `admin` and
    `manager` may set them. A Discount quietly flipped to VAT-exempt is a tax claim; one
    flipped off `requiresOverride` removes a manager from the loop — so **a Discount is
    versioned rather than updated in place**: an edit writes a new row with an
    `effective_from`, and an Order references the version it applied. That is the audit
    record, it is this area's to create, and it is the same append-only shape
    `tenancy-identity` uses for role and membership.

    Criterion 8 forbids logging full payloads, so the log carries actor, Tenant, Discount
    id, and the fields that changed — never the values. The values are in the row history,
    which is queryable and access-controlled. An earlier draft asked for "both values,
    audited" with no store to put them in and no test; that was a criterion with no
    destination.

## Out of Scope

- Stock quantities, depletion, recipes, ingredients, and any inventory maths. Non-goal for
  v1; availability here is a manual toggle only.
- Purchasing, suppliers, goods-received. Non-goal.
- Promotions, coupons, happy hours, rule-based or time-based pricing, buy-one-get-one,
  customer segments, and stacking rules. Non-goal — ADR-0010 widened discounting to a
  configured, typed list applied by a person, and no further.
- Applying a Discount to a sale, and the Override it may require. Area 4 — this area defines
  Discounts, `checkout` applies them.
- Automatic or conditional application of any Discount. A person decides, every time.
- Per-Store price divergence. **Deferred, trigger:** the first tenant that prices
  differently by outlet.
- Menu item images and any media upload or storage. **Deferred, trigger:** the first
  tenant whose staff cannot work from text tiles. A text-tile grid is sufficient for the
  target user and media storage is a whole integration.
- Kitchen routing, printer categories, course sequencing. Non-goal — counter service only.
- Tax categories, per-item VAT rates, and per-item VAT exemption. **VAT is a Tenant-level
  setting owned by `tenancy-identity`, off by default** (ADR-0010, amending ADR-0005). A
  price is always what the customer pays; where VAT is enabled it is backed out for
  reporting. Mixed VATable and exempt goods within one Tenant are not supported — the
  VAT-exempt *Discount* covers the statutory case, which is a property of the customer, not
  of the dish.
- Bulk import or export of a menu. **Deferred, trigger:** onboarding a tenant with a menu
  too large to type. Worth revisiting before self-serve signup.
- Catalog change history and audit browsing. `hardening` and `reporting` territory.
- Terminal-side caching, refresh, and stale handling. Area 5.
- Order composition and pricing at the till. Area 4.

## Further Notes

- **The example that drove this model is worth keeping in mind:** *Ulam* → *Adobo* /
  *Munggo* → *Whole* / *Half*, plus *Extra rice*. If a change to this area makes that
  example awkward to configure, the change is wrong.
- **The version is the contract with `offline-sync`.** If it can fail to move after a
  write, a terminal will sell yesterday's prices indefinitely and nobody will know. Derive
  it; do not ask a write path to remember to bump it.
- **Shared ModifierGroups are the difference between a usable catalog and an abandoned
  one.** Per-Variant duplication looks simpler in the schema and is unusable at thirty
  dishes.
- **Do not round inside a Modifier.** ADR-0005 rounds once per stored figure, and a modified price is not one — the OrderLine total is. Rounding
  early is the most likely way this area produces totals that disagree with the receipt.
- Availability sits slightly awkwardly between catalog and operations. It is here because
  the terminal needs it in the same payload, and splitting it would mean two fetches for
  one grid.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and
ADR-0002, ADR-0005, ADR-0006. Reuses the seam from `foundation` and the actors and
wrong-tenant probe helper from `tenancy-identity`._

## Direction

### Optimise for

**The cost of maintaining a real 40-item carinderia menu — on day 0 and on the Tuesday the
pork price moves.** Every tie an issue does not settle goes to whichever option makes the
second, third and thirtieth item cheaper than the first. Correctness of the model is
already settled above; what is not settled is whether a manager will keep using it.

### The obvious version, named

Five nav leaves already routed (`catalog`, `add-ons`, `discounts`, `availability`). **Catalog:**
h1 + one sentence + `Add menu item`, one `Card` holding a Categories rail left, a search field, and
a `Table` of `MENU ITEM · CATEGORY · VARIANTS · STATUS · actions` with `useTableView` sort and
`TablePagination`. `Edit` pushes `/catalog/$id` — a full-page form: `Name` `<Input>`, `Category`
`<Select>`, `Archive` top-right, a Variants `Table` with `edit archive`, `+ Add variant` opening a
`Sheet`, a Modifier-groups card with `+ Add modifier group` opening a second `Sheet` over the first,
one `Save` bottom-right, `toast("Saved")`. **Add-ons:** the 038 list card; the editor is a
`SheetForm` with Name, two Delta radios, a value `<Input type="number">`, a max-qty stepper, and a
checkbox list of every Variant in the tenant. **Discounts:** the same list card, the same
`SheetForm`, eight columns. **Availability:** a Store `<Select>`, a search field, a `Table` with an
`[ON|OFF]` switch per row writing on tap, `Mark all available` top-right. **Read model:** one
`catalog.read({ storeId })` returning nested JSON plus a `version` hash.

### Rightly obvious — off the table, do not re-litigate

- The 038 list shape: page header (title, one sentence, one primary action), then a single `Card`
  holding `ListToolbar` + `Table` + `TablePagination`. Nothing between them.
- The 049 detached non-modal right `Sheet` + 050 `SheetForm` for every editor that is a form.
- Up/down `Button` pairs for every reorder, no drag surface (039). Categories, MenuItems, Variants
  and Modifiers are four such lists; the accessible name names the list, not just the index.
- Archive, never delete; `Reactivate` unconfirmed; the word `delete` nowhere (038/041/044).
- 038's two alternating `role="status"` sr-only regions and inline failure copy.
- The Categories rail as the left column of the Catalog screen. It is the terminal's grid order and
  seeing it beside the items is why the mock draws it there.
- Prices in pesos with two decimals always, `Centavos` at the boundary, tabular figures global (013).
- The Discounts empty state as the default configuration, drawn (correctly) in the mock as the
  primary state rather than an edge case.
- One read-model procedure, one shot, version derived not hand-bumped.

### Prohibitions

1. **No `Sheet` opened from inside a `Sheet`.** 049's editor is `modal={false}` with no overlay, so
   two stacked panels have no z-order story, and 050's own note says a nested form's submit bubbles
   into the outer handler and fires a save nobody asked for. A Variant is edited in the row that
   shows it, or the MenuItem editor is a route, not a sheet — pick one and never both.
2. **No `<Select>` for the Delta type.** A dropdown whose two options silently change the meaning of
   the number beside it is exactly how `0.5` becomes ₱0.50. Two radios, and the value field's own
   affix renders `+₱` or `×` and changes as the radio changes, while the number is being typed.
3. **No `type="number"` and no `₱` inside the price field.** `inputMode="decimal"`, the peso sign
   rendered outside the input, parsed to `Centavos` at the boundary. `type="number"` ships a spinner
   on a price and accepts `1e3`.
4. **No multiselect combobox, and no checkbox list of every Variant, on the Add-on editor.**
   `packages/ui` exports no combobox, and 054's `AvailabilityField` at 60 rows is unusable. Link from
   the Variant side where the list is a handful; the Add-ons list keeps `LINKED VARIANTS` as
   read-only text, the way 054 made `Available at` read-only text.
5. **No `toast()` on a catalog save.** `sonner` is exported and it is the reflex. Six screens already
   announce through 038's live regions and show failure inline; a toast reading "Saved" over a row
   that still shows the old price is the pattern 038 refused.
   **Overridden for the Availability screen's page-level Save on 2026-08-04 by the human; see
   decision records 067 §6 and 068. The prohibition stands for every other catalog save, including
   the MenuItem editor.**
6. **No archive-a-Category dialog that reuses 041's Store copy.** Archiving a Category silently takes
   every MenuItem and Variant under it off every terminal. Reuse the `DeactivateDialog` shape; the
   body must state the count it takes with it, or it is a confirm that confirms nothing.
7. **No `Not sellable` badge as the only signal.** The row's action reads `Add a variant`, not
   `Edit`, so the half-finished draft the mock flags is one click from being fixed rather than one
   click from a form the manager has to re-read.
8. **No `+ Add modifier group` that creates a group belonging to the item it was created from.** That
   is the mock's shape and it is the single most likely way this ships as per-item duplication — the
   abandonment cause this PRD's Further Notes name. Creating from an item editor must show the
   existing library first and require an explicit new-group step, and the linked-to count must be
   visible **before** an edit is saved, not after.
9. **No two money formatters.** `₱120.00` in the table and `120` in the editor is how a manager reads
   ₱1,200 as ₱120.0. One helper, two decimals, everywhere.
10. **No silent version.** After a write, the screen states the catalog version it just produced, in
    the region that is already there. `offline-sync` is area 5; until it exists, nothing else in the
    product tells a manager whether the till has the new price. One line of text, not a sync widget.

### Collisions to route, not resolve here

- **`availability-1440` draws an inline `[ ON | OFF ]` per row. Record 054 Q3 refused exactly that
  control on payment methods** — for audit atomicity and one-form-one-Save, neither of which
  obviously transfers: catalog availability has no audit table and is a one-tap mid-service action by
  a manager standing at the counter. This is a genuine collision between a mock and a settled record.
  **`Stakes: high`.** It must not be resolved by an implementer copying `AvailabilityField`.
- **`menuitem-editor-1440` is the obvious version, drawn.** A full-page stacked form with a Save
  bottom-right. It is not wrong, but it answers neither question that decides whether this catalog is
  maintainable — where a shared ModifierGroup is created, and how many Variants a group is linked to
  when you edit it. **`Stakes: high`**, and the reason `## Approaches considered` exists.
- `catalog-list-1440` and `discounts-1440` are **not** flagged. The category rail is right, and the
  Discounts mock drawing the empty state as the default is the least obvious thing in the set.

### Chosen approach

**B — ModifierGroups and Add-ons become a tenant-level library; item editors only link.**
Picked by the human on 2026-08-04.

Concretely, and binding on the issues: **the MenuItem editor is never a creation surface for a
ModifierGroup or an Add-on.** Both are tenant-level objects owned by their own screen, each row
showing its linked-to count. From a Variant you link to what exists; the count is visible *before*
an edit is saved, not after. Prohibition 8 is the enforcement of this and is not negotiable by an
issue.

**Why, in one line:** it is the only one of the three that answers the question the PRD's own
Problem Statement asks — where a shared group lives — and the other two leave it exactly where the
mock put it.

**Evidence, not taste.** Loyverse ships this shape for modifiers: `Items → Modifiers` is a
tenant-level library and item editors only activate what already exists. It ships the opposite for
variants — per-item options, retyped per item — and that half is precisely the duplication this
PRD's Further Notes name as the abandonment cause. The segment leader has the bug in the half of
its model it did not make a library. See `.scratch/catalog/research/loyverse-catalog-structure.md`,
cited to the manual's own pages.

**What B does not settle, and the issues must not pretend it does.** The first-run cost is real:
configuring the first MenuItem means visiting the library first. Do not solve that by re-adding a
create control to the item editor. If it needs solving, it is an empty-state and ordering problem
on the library screen, and it is a question for the `decider`, not a prohibition to erode.

**A and C are not dead.** A's per-row dirty state with a page-level Save is now specified by record
067 for the Availability screen, so A is cheaper than it was scored; C remains the answer if support
load turns out to be *"it's not showing at the till"*. Both are candidates for a later PRD, not for
this one.

## Approaches considered

### A — The catalog is one editable outline on one route

No `/catalog/$id` route and no per-Variant sheet. The right pane of the Catalog screen is an
outline: a MenuItem row that expands to reveal its Variants indented beneath it, price editable in
the cell, attached group and add-on names as read-only chips per Variant. `+ Add variant` appends a
row and focuses its name field. One dirty-state Save per expanded item.

- **Axis: fewer steps to the common task.** The Tuesday price change is click-type-tab, and three
  prices before service never leave the screen. Configuring forty items costs no navigations.
- **Cost.** `Table` + `useTableView` do not nest and have no per-row dirty state, so this is a
  component the codebase does not have. It breaks one-form-one-Save (040/045/054) and walks into the
  hazard 054 Q3 option 3 named by name: dirty cells with the Save elsewhere is how an admin leaves
  believing a change landed. ModifierGroups still have no home. Smallest departure of the three.
- **True when** managers change prices far more often than they add items, and a tenant's menu stays
  under roughly sixty Variants so the outline never pages.

### B — ModifierGroups and Add-ons become a tenant-level library screen; item editors only link

`Add-ons` becomes `Options` (or gains a second Card): ModifierGroups and Add-ons both live there as
tenant-level objects, each showing its linked-to count and an `Applies to` picker. The MenuItem
editor's group and add-on cells become pickers over that library and are never a creation surface.
Linking runs in whichever direction has fewer things to pick — Variant → groups, Variant → add-ons.

- **Axis: survives the case the obvious version silently drops.** The mock's `+ Add modifier group`
  inside a MenuItem teaches every manager that a group belongs to the item they made it from. Thirty
  items later there are thirty `Size` groups with drifting rates, which is the combinatorial
  explosion the model exists to prevent, arriving through the UI instead of the schema.
- **Cost.** First-run is worse: configuring the first item means going somewhere else first. The
  sidebar already carries 22 rows. Two screens must agree about the same objects.
- **True when** groups genuinely repeat across items — which the PRD asserts as its driving example
  (Whole/Half on every ulam) and which is the whole argument for shared groups existing at all.

### C — Every catalog screen carries a live read-model preview

A right-hand pane on Catalog, Add-ons and Availability rendering exactly the tile grid the current
configuration produces for the selected Store: the categories in order, the sellable Variants, the
sold-out tiles, and the gaps where a MenuItem has no Variant. It re-renders from the same read-model
payload the terminal fetches. The archive cascade becomes something you watch happen.

- **Axis: recoverable from the mistake people actually make.** The failures that reach a customer are
  "I thought I withdrew that" and "why isn't Adobo on the till". The cascade table in this PRD has
  six rows and two of them produce disappearances no manager would predict — archiving the last
  Modifier of a `required-one` group removes that group's Variants. Nothing in the product renders
  the read model, which is the only thing that is true.
- **Cost.** It builds a POS grid renderer in the back office, and the POS grid belongs to `checkout`
  (area 4) — either `checkout` reuses this one or the two diverge, and divergence makes the preview a
  lie, which is worse than no preview. It also spends the width the category rail and the table are
  already using at 1440.
- **True when** the cascade rules are as surprising in practice as they are on paper, and the support
  load is "it's not showing at the till" rather than "I can't find where to type it".

### Cut, and why

**Text authoring** — one textarea where the whole menu is typed with indentation encoding the
hierarchy, parsed live into a preview, saved in one transaction. It beats every option above on the
axis the Problem Statement actually names (a forty-item menu in one sitting versus roughly 240
interactions), and the target user already has the menu written down. Cut because it argues directly
with an explicit Out of Scope line whose trigger — *"onboarding a tenant with a menu too large to
type"* — has not fired, and a parser plus its line-numbered error surface is not a thing to build on
a guess. **Named here so that when self-serve signup arrives, this is the option to move to, and
nobody re-derives it from scratch.**

## Scenarios

Status: `?` unreviewed · `Y` must handle · `N` out of scope (reason required) · `L` later (name the slice)

| #  | Scenario                                                                                          | Status | Note |
|----|---------------------------------------------------------------------------------------------------|--------|------|
| 1  | Category archived while a terminal is offline; it keeps selling from the cached menu for hours      | L      | `offline-sync` — cache invalidation is area 5's whole job |
| 2  | Two managers edit the same shared ModifierGroup from two browsers; last write wins silently         | Y      | B makes groups shared, so this is B's cost. Same call as 067 §3 or an explicit divergence — decider |
| 3  | A Variant's price is *lowered* below a linked absolute Delta, going negative from the price side    | Y      | Money semantics. Decider-grade; a negative line total must be impossible, not merely unlikely |
| 4  | The only Modifier of a `required-one` group is archived at 11:40am; its Variants vanish mid-service | Y      | Already row 5 of the PRD's cascade table. Prohibition 6's dialog must state the count it takes |
| 5  | Un-archiving a Category whose MenuItems were *separately* archived while it was away                | Y      | Cascade correctness. Un-archive must not resurrect what was archived on its own |
| 6  | A Variant is renamed while a cashier has it in an open cart on the terminal                         | L      | `checkout` — ADR-0010's capture-at-sale-time governs the cart line |
| 7  | Availability toggled back ON while the terminal is offline and still caches "sold out"              | L      | `offline-sync` |
| 8  | A manager assigned to two Stores toggles availability in a tab left open on the wrong Store         | Y      | Answered by 067 §5 — Store is a route search param, so the draft cannot span two. Assert it |
| 9  | A tenant with 400 Variants fetches the one-shot read model over a phone tether                      | Y      | The read model is this PRD's. Assert a payload bound at a realistic size; do not paginate it |
| 10 | An Add-on's max quantity is lowered from 3 to 1 while a cart already holds 2                        | L      | `checkout` — the stepper enforces at the till |
| 11 | A no-op save (same values) — does the derived version move, and should it                           | Y      | Decided by record 069: the version **does not** move, and the payload is byte-identical. **Use a Variant or an availability no-op — not a Discount** (see 069's carve-out) |
| 12 | Two Modifiers with the same name in two groups linked to one Variant; the cashier sees "Half" twice | L      | Revisit if reported. No uniqueness rule exists and inventing one is scope |
| 13 | A MenuItem is moved to another Category while that Category is being archived in another tab        | Y      | Concurrency on the cascade. Cheap to constrain, expensive to discover |
| 14 | A price pasted as `₱1,200.00`, or typed as `120.505`, or as `1e3`                                   | Y      | Prohibition 3 governs the input; this is its test |
| 15 | Two `required-one` groups on one Variant whose defaults compose (×0.5 × ×0.5) unnoticed             | Y      | Money semantics, decider-grade. Composition order is stored or it is guessed |
| 16 | A Category with zero non-archived MenuItems — does it still render as a tab on the terminal grid    | Y      | Read-model shape, and the terminal has no other source |
| 17 | A new Store is created; nothing says whether its Variants start available or unavailable            | Y      | Routed out of 067 as join polarity. **Needs its own record before the availability slice** |
| 18 | A Store is deactivated in `tenancy-identity` while it still holds availability rows                 | Y      | FK behaviour across an area boundary. Must be decided here, not discovered there |
| 19 | A brand-new tenant's Device enrols and fetches a read model with zero Categories                    | Y      | Empty read model. Cheap, and it is every tenant's first request |
| 20 | A manager's Store assignment is revoked while their Availability screen is open on that Store       | L      | `hardening` — authorisation revocation timing is area 9 |
| 21 | Two managers reorder the same list concurrently and two rows land on the same sort position         | Y      | 039 owns reordering; four lists inherit it. Needs a stated tiebreak |
| 22 | A price goes up and back down between two fetches; a content-hash version is equal at both ends     | Y      | Decided by record 069: the version at both ends is **equal**, and so is the payload, so the terminal's cached copy is correct. A terminal that fetched *during* the window holds the intermediate version and re-fetches, because it differs |
| 23 | A Discount's `requiresReference` label is renamed after sales captured references under the old one | Y      | Assert capture-at-sale, per ADR-0010's principle. One test |
| 24 | Save clicked twice on a slow connection; two Variants named "Adobo" under one MenuItem              | Y      | Idempotency. 067 §3 already requires it for availability; the same must hold here |
| 25 | A group set to `many` with maximum 0 — configured, legal-looking, unsatisfiable                     | Y      | A `CHECK`, not a comment |
| 26 | An Add-on stays linked to a Variant that is later archived; its linked count counts a dead link     | Y      | **Directly undermines B.** The linked-to count is the whole mechanism; a count that lies defeats it |
| 27 | A 60-character Tagalog dish name, or emoji, in a name that has to fit a terminal tile               | Y      | The length bound is this PRD's; tile rendering is `checkout`'s. Set the bound, flag the render |
| 28 | A Variant un-archived while its MenuItem is still archived                                          | Y      | Cascade correctness, and the mirror of row 5 |
