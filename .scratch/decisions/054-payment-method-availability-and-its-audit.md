# 054: Payment-method changes get their own audit table, availability is one read-only column in the list and a checkbox set in the sheet, and no switch is drawn in the table

- **Status:** decided
- **Stakes:** high — a new append-only audit table (a security control), an `admin`-only gate, and a claim about charging that a user is shown
- **Date:** 2026-08-03
- **Asked by:** the orchestrator, for `.scratch/tenancy-identity/issues/08-payment-methods.md` (criteria 4, 6, 7, 8)
- **Relates to:** [046](046-how-tenant-settings-are-stored-and-audited.md) (audit shape); [038](038-the-store-management-screen.md)/[040](040-the-store-editor.md)/[041](041-the-deactivation-dialog-body-copy.md)/[044](044-the-users-list.md)/[045](045-the-user-editor.md)/[049](049-the-editor-is-a-detached-sheet.md)/[050](050-the-sheet-form-shell.md) (the built list/editor pattern)

## The question

Three, on one screen. **Q1:** where a payment-method audit row lives, given that an availability
change has three identifying parts and not one setting name. **Q2:** the mock draws one column per
Store, so a tenant with twelve has no drawable table, and the mock is 1440-only. **Q3:** the mock
draws `[ ON ]/[ OFF ]` inline, implying a write per toggle, against four records that already fixed
one-form-one-Save.

**Q3 decides Q2:** once the availability cells are not controls they collapse into one column and the
twelve-store problem disappears; if they stayed controls, twelve switch columns would be worse still.

A wrong answer costs three ways — an audit trail that cannot be corrected because it cannot be
`UPDATE`d, a screen unusable at the fourth outlet, and a per-toggle write that leaves availability
half-set when a phone drops signal mid-tap.

## What was already decided, and is not revisited

- **ADR-0010, verbatim:** *"The method's **name is captured on the Payment** at sale time. Renaming or
  deleting a method never changes history."* That makes the on-screen note below true; it is a
  constraint carried to `checkout`, not implemented here. ADR-0010 is **silent on per-Store
  availability** — that half comes from the issue and the PRD.
- **046 §3, inherited by whichever table Q1 picks:** RLS `ENABLED`+`FORCED`, policies in the same
  migration, **`FOR SELECT`/`FOR INSERT` only**, `REVOKE ALL` then `GRANT SELECT, INSERT`, composite
  `(tenant_id, …)` FKs because plain FK checks bypass RLS.
- **Consumed whole and not restated:** the issue's no-gos (`cash` as a partial unique index, `kind`
  as the only branch, the nav entry); 038's list `Card` + `ListToolbar` + `useTableView` +
  `TablePagination` + the `overflow-x-auto py-1` wrapper (**`py-1` load-bearing**, 038 §5); 049's
  non-modal `Sheet`; 050's `SheetForm`; 040 §4's state table; 041's dialog-copy rule.
- **No new dependency, component, token or colour.** `packages/ui` exports no `Switch` and no
  `Checkbox`; 045 already answered that with a native unstyled `<input type="checkbox">`.

### Weights, declared before any option was scored

**User ×3** (an owner configures this once with no support line; for Q1, "user" is the auditor reading
the trail back) · **Business ×1** (nothing earns; one fact — a method wrongly offered is a sale
recorded against a tender nobody took) · **Eng cost/risk ×2** (separates Q1 outright: two options are
`ALTER`s on a merged append-only table) · **Reversibility ×2** (the screen is free forever; the table
and the save shape are not) · **Evidence ×2** (mock, ADR-0010, the shipped migration and four records
disagree in places). Maximum 50. **Not changed after scoring.**

## Q1 — A new `PaymentMethodAudit`, copying 046 §3's structure exactly

`TenantSettingsAudit` keys a change to one `setting` string and two text values; an availability
change is `(method, store, on/off)`. Encoding that as `payment_method.<id>.store.<id>` is a composite
key smuggled into a text column no FK can check and no query can join — on a table where a malformed
row can **never** be corrected, because `UPDATE` and `DELETE` are policy-denied. 046 §3 already
refused to extend `PlatformAuditLog` for the same class of reason: **the structure is the pattern;
the table is not shared.**

**Columns:** `id`, `tenant_id`, `actor_user_id`, `payment_method_id`, `store_id`, `field`,
`old_value`, `new_value`, `created_at`; `@@index([tenantId])`.

- **`store_id` is nullable and is the discriminator** — `NULL` = a change to the method itself,
  non-null = availability at that Store. Joinable, not encoded in a string. One table, not two, keeps
  **one** policy pair; 046's point is that every policy is a place to get it wrong.
- **`field` is `TEXT`, one of `created` · `name` · `active` · `available`**; values stringified with
  `String()`, as the shipped `diffTenantSettings` does.
- **Three `CHECK`s, because an append-only row cannot be fixed later** (046: *enforce it with a
  `CHECK`, not with a comment*): `"field" IN ('created','name','active','available')`;
  `("field" = 'available') = ("store_id" IS NOT NULL)`; `("old_value" IS NULL) = ("field" = 'created')`.
- **Three composite FKs**, all `ON DELETE RESTRICT ON UPDATE CASCADE`, plus plain
  `tenant_id → Tenant(id)`: `(tenant_id, actor_user_id) → "User"("tenant_id","id")`,
  `(tenant_id, payment_method_id) → "PaymentMethod"("tenant_id","id")`,
  `(tenant_id, store_id) → "Store"("tenant_id","id")`. **`Store` and `User` already carry
  `@@unique([tenantId, id])`; `PaymentMethod` must be created with one** or the FKs cannot be built.
- **Copy the RLS block from `migrations/20260803010000_tenant_settings/migration.sql`**, table name
  swapped. 046's prose says `REVOKE UPDATE, DELETE`; the shipped migration does the stronger
  `REVOKE ALL` then grants two verbs back. **Follow the migration, not the prose.**

**What writes rows:** one row per changed pair, all rows from one save sharing one transaction and
one `created_at` (046's per-setting rule plus 045 §4 clause 2's one-instant-per-save). Creating GCash
available at three Stores writes four rows. **Provisioning's `cash` seed writes no row and
`actor_user_id` stays `NOT NULL`** — a nullable actor is how an audit trail starts admitting rows
nobody signed.

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **New `PaymentMethodAudit`, 046 §3's structure exactly** | 4 (12) | 4 | 4 (8) | 3 (6) | 5 (10) | **40** |
| 2 | Defer to the human | 1 (3) | 2 | 3 (6) | 5 (10) | 1 (2) | **23** |
| 3 | Generalise 046's table into a tenant-wide audit | 3 (9) | 3 | 1 (2) | 1 (2) | 2 (4) | **20** |
| 4 | Extend `TenantSettingsAudit` with nullable method/store columns | 2 (6) | 3 | 2 (4) | 1 (2) | 2 (4) | **19** |

**1. Chosen.** Additive, changes no merged migration, every structural clause copied from a file that
already runs. Reversibility 3 honestly: dropping it is a non-additive migration, as 046 said of its own.

**2. Defer.** Ranking second is the finding — both alternatives to a new table score *below doing
nothing*. Ten of its 23 points are reversibility, the inflation records 002 onward left visible.

**3. Generalise into a tenant-wide audit.** Nicest to read back: one trail, one query, one place to
add the next area. It loses on cost and reversal together — renaming a merged table, migrating its
rows, widening its policy and rewriting `packages/backend/src/tenant-settings/`, for a convenience
nothing has asked for. **The option to move to** when a third area needs an audit.

**4. Extend `TenantSettingsAudit`.** Smallest-looking diff, loses hardest: two nullable columns and
two composite FKs bolted onto an append-only table whose existing rows have neither, a `setting`
column meaning two things depending on the row, and a name that stops describing its contents. The
three `CHECK`s above are only expressible on a table built for them.

## Q2 — One `Available at` column at any Store count; the table still scrolls at 390

The per-Store columns collapse into a single `Available at` column: the available Store names
comma-separated in the order the sheet lists them; **`All stores`** when available at every active
Store; **`None`** at none. That is 044's `Stores` column on the Users list unchanged — rung 2, the
same fact (a set of Stores held against one row) rendered how this codebase already renders it.

**This crosses the mock and is recorded rather than absorbed**, the move 038 made on nav entries and
044 on the `NAME` column. Three reasons, none of them taste:

1. **The mock is drawn at two Stores and cannot be drawn at twelve.** Unlike 044's case — a mock
   showing a *fully configured* state the product could not reach — this shows a *minimal* state that
   stops working as the tenant grows. It answers a question it was never asked.
2. **A column whose header is tenant data is a pivot, not a column.** `useTableView` takes
   `sortValues: Record<K, …>` over a fixed key set and `TableHead` sets `aria-sort` per key; a Store
   set varying per tenant has no fixed `K`, so the shipped helper would have to be replaced.
3. **Order and hierarchy are preserved.** The mock's order is `METHOD · KIND · <availability> ·
   STATUS · actions`; one column sits in the same slot.

**At the narrowest width nothing new is built:** five columns inside `overflow-x-auto py-1`, no
breakpoint at 390, density not switched (013 clause 3); checkable with
`rg -n '\b(sm|md|lg|xl|2xl):' apps/backoffice/src/features/payment-methods`. **Honest limit: twelve
columns would not have failed WCAG either** — SC 1.4.10 Reflow (AA) permits horizontal scroll for
two-dimensional content, and its 320px figure is met by that exception. Option 2 loses on usability
and on the sort helper, not on accessibility.

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **One `Available at` column; names, `All stores`, or `None`** | 5 (15) | 4 | 5 (10) | 5 (10) | 4 (8) | **47** |
| 2 | One column per Store, horizontal scroll (the mock, literally) | 2 (6) | 3 | 2 (4) | 4 (8) | 4 (8) | **29** |
| 3 | Card-per-method below a breakpoint, table above | 3 (9) | 3 | 2 (4) | 3 (6) | 1 (2) | **24** |
| 4 | Defer to the human | 1 (3) | 2 | 3 (6) | 5 (10) | 1 (2) | **23** |
| 5 | Columns up to N Stores, then collapse | 2 (6) | 3 | 1 (2) | 3 (6) | 1 (2) | **19** |

**2. The mock literally.** 4 on evidence because it is drawn, 4 on reversal because it is one file.
It loses on the three reasons above plus a fourth the mock cannot show: `Malabon` in a `<th>` reads
as a column topic when it is a value (SC 2.4.6, SC 1.3.1).

**3. Card-per-method at narrow widths.** Better at 390 in isolation. 038 already refused this shape
for the whole back office — *"a shape nobody drew, inherited by eleven areas"* — and reversing that
on the sixth screen to copy 038 is a product-wide change in one screen's clothes.

**5. Columns up to N, then collapse.** Two layouts, two test surfaces, an `N` nobody has written —
040's refusal to invent a name length, applied to a breakpoint count.

## Q3 — Availability is a checkbox set in the sheet, saved once. No inline switch.

The list's availability cells are **read-only text**. Availability is edited in the sheet as a
`<fieldset><legend>Available at</legend>` holding one native `<input type="checkbox">` per active
Store — 045's Stores control unchanged, unstyled, with the global `:focus-visible` as its focus
indicator. One `<form>`, one Save, one round trip: 040 §3, 045 §4, 046 and 050 all say this, and this
is the fifth screen to inherit it rather than the first to break it.

**The audit interaction decides it, and runs against intuition.** An inline switch writes **one
permanently uncorrectable audit row per tap**, so turning a method off at three outlets is three
independent writes with three failure points; the second failing leaves the method off at one Store,
on at two, and an audit trail faithfully recording a state the admin never intended. A sheet Save
writes **one row per changed pair, in one transaction, sharing one `created_at`** — every pair moved
or none did. That is 040's refusal of per-action saves (*"most easily ships looking fine and corrupts
order under a flaky connection"*) with a permanent artefact attached.

**Honestly: the switch is buildable accessibly**, `role="switch"` with a name like `GCash at Malabon`.
It is **not** refused on WCAG grounds — it is refused on save semantics and audit atomicity. **The
editor also has no `kind` control:** every created method is `recorded` and `cash` has no editor, so
a select with one reachable option is 009's control that does nothing.

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Checkbox set in the sheet, one Save, one transaction** | 4 (12) | 5 | 5 (10) | 5 (10) | 4 (8) | **45** |
| 2 | Inline switches, one write and one audit row per toggle (the mock) | 4 (12) | 3 | 2 (4) | 2 (4) | 4 (8) | **31** |
| 3 | Inline switches staging a draft, one page-level Save bar | 3 (9) | 3 | 2 (4) | 3 (6) | 3 (6) | **28** |
| 4 | Defer to the human | 1 (3) | 2 | 3 (6) | 5 (10) | 1 (2) | **23** |

**2. Inline switches.** Ties option 1 on the user hat and deserves to — "turn Maya off at Cubao" is
one tap instead of open-sheet, untick, Save. It loses on engineering and reversal: a per-pair
procedure later screens copy, a pending and error state per cell, and audit rows that cannot be
undone. **The option to move to** if admins toggle far more often than they rename or add; the
successor needs an idempotent per-pair procedure and its own record.

**3. Inline switches over a draft, page-level Save.** Keeps the drawn control *and* the atomic write.
It loses on a real hazard — a table of dirty unsaved cells with the Save bar elsewhere on the page is
how an admin walks away believing a change landed — and needs a dirty-state pattern the codebase does
not have; 040 refused a "discard changes?" prompt on exactly that ground.

## Smaller calls made here, flagged as reversible

1. **`admin`-only, and the route itself refuses** — 046 §4's treatment, not 038 §6's read-only: this
   is tenant-wide configuration, and refusing outright removes the Store-visibility projection 044 §2
   clause 3 needed. *Reverse when* a manager asks what methods their outlet offers; successor is
   038 §6 **plus that projection, which is not optional**.
2. **Availability is a positive join — presence of a `(method, store)` row means available**, current
   state only, no effective dating; `PaymentMethodAudit` is the sole history, because two copies of
   one fact is 045 §4 clause 3's hazard. **Named cost:** a new Store starts with `cash` alone, so
   adding an outlet means visiting this screen. That is the fail-safe direction.
3. **`cash` is available everywhere unconditionally, holds no join rows, renders `All stores`, has no
   `Edit`, and its actions cell reads `Always on`.** Turning cash off at a Store would configure a
   till into a state where nothing can be sold — the hazard the partial unique index prevents.
4. **Create defaults every Store checked** — a method just added is one you intend to take, and the
   admin is already in the sheet to untick what does not apply.
5. **Presets are a native `<datalist>` on the Name `<Input>`** — Card, GCash, Maya, Bank transfer —
   not a `Select`, not four buttons, not an enum; rung 4, one element, and typing an unanticipated
   name still works. *Fallback if it renders badly:* four `Button variant="outline"` filling the Name
   field; the field's `id`, label and copy do not change.
6. **`Kind` displays capitalised** (`Cash` · `Recorded`), matching 044's role values.
7. **No first-run empty state is built** — every tenant has `cash`, so the unfiltered list is never
   empty and 009 forbids building a state that cannot be true. The filtered-no-match state is
   whatever `StoreListCard` already renders, copied, not re-decided.

## Every string, verbatim

Short messages and labels carry **no terminal full stop**; descriptive prose of two or more sentences
does. Anything not listed transfers from 038/040/044/045 by substituting "payment method" for "store".

| Where | String |
| --- | --- |
| Page heading (h1) | `Payment methods` |
| Page description | `What a cashier can record a sale against, and where.` |
| List action | `Add method` |
| Column headers | `Method` · `Kind` · `Available at` · `Status` · `Actions` (sr-only) |
| Kind values | `Cash` · `Recorded` |
| Available at | the Store names comma-separated · `All stores` · `None` |
| Status badges | `Active` · `Deactivated` |
| Cash row, actions cell | `Always on` |
| Search field | label `Search methods`, placeholder `e.g. GCash` |
| The note, line 1 | `A new tenant starts with cash only` |
| The note, body | `Only cash reaches the drawer. Every other method records an amount and authorises nothing — no gateway, no QR code, no settlement. The name is recorded on each sale as it stood at the time, so renaming a method never changes past sales.` |
| Editor heading, Name field | `New method` / `Edit {saved name}`; `Name` |
| Availability legend | `Available at` |
| Availability hint | `Unchecking a store stops this method being offered there. Sales already recorded against it stay as they are.` |
| Availability, no Stores | `Add a store first, then you can choose where this method is offered` |
| Submit, dismiss | `Create method` → `Creating…` / `Save changes` → `Saving…`; `Cancel` |
| Failure copy | editor `Couldn't save the payment method`; list `Couldn't update the payment method` |
| Confirm dialog | title `Deactivate {name}?`; buttons `Cancel` · `Deactivate` |
| Confirm dialog body | `This method stops being offered at the till, sales already recorded against it stay attributed to it, and Reactivate brings it back` |
| Live region (038's) | `Method created` · `Saved` · `{name} deactivated` · `{name} reactivated` |

**The word `delete` appears nowhere** — copy, accessible name, component name or procedure name.
Check: `rg -in 'delete|permanently' apps/backoffice/src/features/payment-methods` returns nothing.
The mock's dashed-border note ("Code branches on KIND, never on a name…") is a **designer's
annotation, not user-facing copy** — the reading 041 gave `users-1440.svg`'s "Nothing is deleted".

## What must not be built

- **No `Switch` or `Checkbox` in `packages/ui`.** The checkbox is the platform's, unstyled (045 §1
  clause 3). Adding one is a shared-component record, not a class string in this form.
- **No second audit path.** Every change to the list or to a `(method, store)` pair goes through the
  same transaction that writes `PaymentMethodAudit`. A write that skips it is the failure this record
  exists to prevent, and it cannot be detected afterwards.
- **The save procedure is never the procedure that changes `active`** (040 §3, 045 §4 clause 4).
  Procedure names are the implementer's; the split is not.
- **No `kind` control, no branch on a method's name, no invented `maxLength`.** 040's refusal to
  invent a name length stands; until the contract states a bound, a rejected name renders as
  `Couldn't save the payment method`.
- **No count, total or "N more" that would disclose a Store** — moot while admin-only, and it stops
  being moot the moment smaller call 1 is reversed.

## How to turn it back

| What | Cost |
| --- | --- |
| Columns, copy, `All stores`/`None`, the note, the absent empty state | One commit under `apps/backoffice/src/features/payment-methods/`. Free, permanently. |
| Availability control (Q3 → option 2 or 3) | The draft state is already the right shape — a set of Store ids — so the sheet control swaps in one file. **The expensive half is the procedure:** a per-pair toggle is a contract entry, a handler, and a per-cell pending/error state. Count first: `rg -n 'paymentMethod\.' apps packages \| wc -l` — **zero today**. |
| `Available at` → per-Store columns (Q2 → option 2) | One file, plus replacing `useTableView`'s `sortValues` key set with something admitting dynamic keys. |
| Admin-only gate (smaller call 1) | One route gate, plus 038 §6's read-only treatment **and** 044 §2 clause 3's server-side Store projection. |
| `PaymentMethodAudit` (Q1 → option 3 or 4) | Adding it is additive. **Dropping it is a non-additive migration**, and once a tenant writes rows it is a data migration into whatever replaces it. **This is the reversal cost that changes soonest — the day issue 08 merges, not gradually.** |

Formally: write a superseding record; flip this `Status:` to `overturned` with the date and reason;
update both `LOG.md` lines; edit the files above; re-run the gate.

## What should make you reverse this

- **An admin toggles availability far more often than they rename or add methods** — Q3 option 2's
  trigger and the most likely way this ages badly. One admin saying "I just want to turn it off for
  today" is the trigger firing, not a pattern to study.
- **`Available at` wraps to three lines in every row** — Q2's trigger; the successor is not the drawn
  columns, it is `All stores except Cubao` for the majority case. Copy, not architecture.
- **A third area needs an audit trail** — Q1 option 3's trigger. Two tables is a pattern; three is a shape.
- **Someone adds a Store and their cashiers cannot take GCash the next morning** — smaller call 2's
  named cost. If it happens twice the successor is a prompt on Store creation, **not** flipping the
  join's polarity, which is how a new outlet silently offers a tender it cannot take.
- **`<datalist>` renders unusably in a browser a tenant actually uses** — the value I am least
  confident about; nothing in `apps/` has rendered one. Fallback pre-decided in smaller call 5.
- **`role="status"` is not announced by real assistive technology** — the standing unknown from
  records 009, 030, 038, 039, 044 and 045; the always-present region is their named fallback.

## Evidence

**Repository, read 2026-08-03, main checkout (the lane worktree does not exist):**

- `.scratch/tenancy-identity/issues/08-payment-methods.md` — the nine criteria; "Per-Store
  availability is a join"; "enforced server-side, not by hiding a button".
  `design/lofi/backoffice/payment-methods-1440.svg`, read in full — `MALABON`/`CUBAO` as column
  headers, `[ ON ]`/`[ OFF ]` cells, `always on` in cash's actions cell, both note blocks, four footnotes.
- `packages/backend/src/db/prisma/schema.prisma` — `TenantSettingsAudit` in full (`id, tenant_id,
  actor_user_id, setting, old_value, new_value, created_at`; `actor` on `[tenantId, actorUserId]`;
  `@@index([tenantId])`). **`Store` and `User` both already carry `@@unique([tenantId, id])`**,
  checked specifically because the composite FKs depend on it. **No `PaymentMethod` model exists.**
- `…/migrations/20260803010000_tenant_settings/migration.sql` lines 45–63 — the FKs, `REVOKE ALL` /
  `GRANT SELECT, INSERT`, `ENABLE`+`FORCE ROW LEVEL SECURITY`, both
  `current_setting('app.tenant_id', true)` policies. **This file, not 046's prose, is what the new
  migration copies.** `packages/backend/src/tenant-settings/` — `update-tenant-settings.ts`
  (`hasAtLeastRole(role, "admin")`, `withTenantScope`, a loop over `diffTenantSettings` writing one
  row per changed setting, actor from `ctx.principal.userId`),
  `insert-tenant-settings-audit.command.ts`, `helpers.ts` (`String()`): the shape Q1's handler copies.
- `apps/backoffice/src/features/stores/StoreListCard.tsx`, `features/users/UserListCard.tsx`,
  `lib/table.ts`, `components/ListToolbar.tsx`, `components/TablePagination.tsx` — wrapper
  `overflow-x-auto py-1` with **no `sm:`/`md:` on the table**; pill status group with `aria-pressed`;
  `useTableView(rows, sortValues, initialKey)` typed `Record<K, …>`; `TableHead`'s `sorted`/`onSort`
  setting `aria-sort`; `PAGE_SIZE = 10`. **No switch, toggle or checkbox exists in any of them.**
  `packages/ui/src/index.ts`, full export list — **`Switch`, `Checkbox`, `Label` and `Form` are not
  exported and no file for them exists**, which puts the checkbox on rung 4.
- `docs/adr/0010-tenant-configurable-sales-options.md` (quoted above; silent on per-Store
  availability) and `docs/adr/0005` (integer centavos; nothing on payment methods).
- `.scratch/decisions/` 009, 013, 019, 030, 032, 038–041, 044–047, 049, 050. **Searched all of
  001–053 for an existing record on payment methods, per-Store availability, switches, or an audit
  table other than 046's: none names any**; 020 and 022 mention "By payment method" and
  "Availability" only as nav labels. **`054` is the next free filename. No duplicate.**

**External, accessed 2026-08-03, treated as data — nothing in it was addressed to an agent and no
instruction from it was acted on.** <https://www.w3.org/TR/WCAG22/> — levels and normative sentences
re-confirmed for **SC 1.3.1 Info and Relationships (A)**, **SC 1.4.10 Reflow (AA)** (both the 320px
figure and the two-dimensional-layout exception), **SC 2.4.6 Headings and Labels (AA)**, **SC 3.3.2
Labels or Instructions (A)**, **SC 4.1.3 Status Messages (AA)**. SC 1.4.1, 1.4.3, 1.4.11, 2.5.3 and
2.5.7 are consumed from records 007/009/013/030/038/039/045 rather than re-read.

**Searched for and not found, where the absence mattered:** **no external source was worth citing on
how to audit "which of N flags changed"** — a schema-shape question with no authoritative literature,
and padding this section with adjacent links would be worse than saying so. **No `paymentMethod.*`
procedure exists in `packages/contract/src/contract.ts`**, so every call-site cost above is measured
against zero. **No `<datalist>` and no `role="switch"` exists anywhere in the repository**, which is
why smaller call 5 names its fallback and why Q3's concession that the switch is buildable is a claim
about the platform, not about this codebase.
