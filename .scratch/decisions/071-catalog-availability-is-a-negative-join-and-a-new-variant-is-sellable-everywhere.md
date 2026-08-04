# 071: A row means "sold out here" — catalog availability is an exception list, so a new Variant is sellable everywhere and a new Store carries the whole menu

- **Status:** decided
- **Stakes:** high — a data shape with a merged migration behind it, and it deliberately reverses a settled record's polarity
- **Date:** 2026-08-04
- **Asked by:** the human, on the question [067](067-the-availability-screen-stages-toggles-and-saves-once.md) §3 routed out; `.scratch/catalog/PRD.md` `## Scenarios` row 17 (*"Needs its own record before the availability slice"*)
- **Relates to:** [054](054-payment-method-availability-and-its-audit.md) (whose polarity this reverses, on purpose, for a different object — **054 is not overturned**); [067](067-the-availability-screen-stages-toggles-and-saves-once.md) §3/§4 (the procedure this confirms); [069](069-the-catalog-version-is-a-sha256-of-the-payload-per-store.md) and [070](070-the-catalog-version-is-derived-per-request.md) (binding on §6); [046](046-how-tenant-settings-are-stored-and-audited.md) §3, [055](055-availability-enforcement-belongs-to-checkout.md), [038](038-the-store-management-screen.md)

## The question

Availability is a fact about a `(Variant, Store)` pair. **Does a row mean the pair is available, or
that it is sold out?** Everything else follows: what a new Variant does, what a new Store does, how
many rows the table holds forever, and which way the system fails when it fails. The human has
chosen: **a row means UNAVAILABLE; absence means available.** This record makes that official and
settles the six things it opens. A wrong answer costs a manager creating *Kaldereta*, walking to the
counter, and finding it on no terminal.

### Weights, declared before any option was scored

**User ×3** (two users, both hurt by the wrong polarity: the manager who just created a dish, and
the cashier looking for it) · **Business ×1** · **Eng ×2** · **Reversibility ×2** (a merged
migration — the honest constraint here) · **Evidence ×2**. Max 50. **Not changed after scoring.**

## What I chose, and why

**The table is an exception list — an "86 list".** A Variant is sellable at every Store unless a row
says otherwise. The human's three reasons, recorded as the reasoning rather than restated as a
verdict:

1. **Archive already owns "do not sell this."** The PRD calls availability the F&B "86'd" switch and
   *nothing more*, and an exception list is exactly what an 86 list is. Failing open here **cannot**
   cause a withdrawn item to be sold — withdrawal is a different mechanism with its own control and
   its own cascade table.
2. **The positive join breaks the first thing every tenant does.** Create a dish, and it is on no
   terminal until someone visits a second screen and ticks it on per Store. That reads as broken,
   and it recurs for every new dish forever. A fourth outlet would mean ticking 200 boxes.
3. **Table size, secondary but real.** A positive join stores `variants × stores` rows permanently;
   this stores only what is currently out — a handful per service.

### Why this reverses 054, and why that is not an accident

Record 054 chose the **positive** join for payment methods — *"presence of a `(method, store)` row
means available"*, *"the fail-safe direction"*. That was right for its object and **stays decided**.
It does not transfer, because "fail-safe" is a claim about what breaks:

| | Failing closed means | Failing open means |
| --- | --- | --- |
| **Payment method** (054) | GCash is not offered at a new outlet. Annoying, safe, and the till still takes cash. | A tender is offered that nobody can actually settle. |
| **Variant** (this record) | **The dish a manager created five minutes ago does not exist at the till.** | A cashier says *"sorry po, ubos na"* — which happens anyway, and is what the screen exists to reduce. |

For a tender the safe direction is silence; for a dish, silence is the failure. **The two records
together are a deliberate divergence, not an inconsistency** — 054's smaller call 2 now carries a
pointer back here.

## 1. The table

`VariantUnavailability`. **The name is load-bearing, not a style choice:** a reader who knows
`PaymentMethodAvailability` must trip over the `Un-` and re-read, because the two tables mean
opposite things. Deliberately not `VariantAvailability` (a lie) and not `SoldOutVariant` (a third
vocabulary, and "sold out" invites the stock semantics the PRD rules out).

**Columns, copied from the shipped `PaymentMethodAvailability`, not redesigned:** `id`, `tenant_id`,
`variant_id`, `store_id`, `created_at`; `@@unique([variantId, storeId])`; `@@index([tenantId])`. A
model comment states the polarity in one sentence — *a row means this Variant is sold out at this
Store; absence means available.*

- **Three FKs, all `ON DELETE RESTRICT ON UPDATE CASCADE`**, copied from
  `migrations/20260803130000_payment_methods/migration.sql`: plain `tenant_id → Tenant(id)`, plus
  composite `(tenant_id, variant_id) → "Variant"("tenant_id","id")` and
  `(tenant_id, store_id) → "Store"("tenant_id","id")`. `Store` already carries
  `@@unique([tenantId, id])`; **`Variant` must be created with one** or the composite FK cannot be
  built — the clause 054 needed for `PaymentMethod`. No migration here uses `ON DELETE CASCADE`.
- **RLS: copy `PaymentMethodAvailability`'s block, not 046 §3's audit block.** `ENABLE` + `FORCE`,
  one policy `USING ("tenant_id" = current_setting('app.tenant_id', true))`, **default privileges
  left alone**. The policy has no `FOR` clause, so it is `FOR ALL`, and a `FOR ALL` policy with no
  `WITH CHECK` applies `USING` to writes too — the shipped block is complete and must not be "fixed".
- **N: do not copy 046 §3's `REVOKE ALL` / `GRANT SELECT, INSERT`** — the audit treatment. **This
  table is DELETE-heavy by design** (§2), and insert-only would make every "mark available" fail at
  the database while the screen shows the change staged.

**It is not append-only and it is not audited, and that absence is load-bearing.** No
catalog-availability audit table exists, which is exactly what let 067 fire 054 §Q3's escape clause:
an inline toggle here writes no permanently uncorrectable artefact. **If anyone later adds an audit
trail for availability, 054 §Q3's refusal becomes live again and 067 must be re-decided** — a named
trigger, not a remark.

## 2. The procedure — 067 §3 confirmed, not redesigned

`availability.set({ storeId, changes: [{ variantId, available: boolean }] })` stands unchanged.
`available` is an **absolute target**, so polarity is an implementation detail behind the procedure — which is why 067 could fix the input shape before this record existed.

**N: `available: true` is a DELETE. `available: false` is an INSERT** — the inversion an implementer
gets backwards once and never notices:

| Client sends | Server does |
| --- | --- |
| `{ variantId, available: false }` | `INSERT … ON CONFLICT ("variant_id","store_id") DO NOTHING` |
| `{ variantId, available: true }` | `DELETE FROM "VariantUnavailability" WHERE tenant_id = … AND variant_id = … AND store_id = …` |

The negative join **strengthens** 067's idempotence requirement rather than merely satisfying it:
`ON CONFLICT DO NOTHING` and `DELETE` are each idempotent as written, so replaying a payload is a
property of the two statements, not something the handler arranges. All changes in one transaction;
`storeId` authorised, not merely validated (security criterion 4). An empty `changes` array is
**accepted as a no-op** — 067 §1 makes it unreachable from the UI, and rejecting it would be a
validation rule with no user.

## 3. Archiving a Variant that is currently sold out

**The row survives the archive, and un-archiving brings the dish back sold out.**

- **Archive does not touch this table.** Archiving writes one row on the Variant; reaching into a
  second table is the "written down the tree" pattern the PRD refuses in the same breath as
  *"Exclusion is computed from the parent chain"*. Archiving is not a delete, so `RESTRICT` has
  nothing to react to.
- **The alternative is worse and undiscoverable.** Clearing the row on archive makes archive a
  back-door "mark everything available", so a manager who archives and un-archives a dish silently
  un-86s it at every outlet.
- **Named cost:** a dish archived while sold out comes back sold out. Mildly surprising, and
  *visible* — the screen shows it and it is one tap. Silent restoration would not be.
- **Scenario 28** (a Variant un-archived while its MenuItem is still archived) needs nothing here:
  the Variant stays out of the read model via the parent chain, and its row is never consulted.

## 4. Store deactivation — `## Scenarios` row 18

**Rows survive, nothing is cleaned up, and no obligation is added to `tenancy-identity`.**

- A Store is deactivated by `active = false` (038: deactivated, never deleted), so **the `RESTRICT`
  FK is never exercised**. It guards a delete the product does not perform — and if anyone ever
  writes one, it fails loudly rather than orphaning a row. That is why `RESTRICT` is kept.
- The screen's Store `<Select>` lists only Stores the caller may act on (067 §5), which excludes
  deactivated ones, so their rows cannot be edited. Correct: **reactivating restores exactly the
  availability the Store had** — §3's principle, and 038's non-destructive promise.
- A deactivated Store has no Device fetching its read model, so the rows are inert until it returns.
  **No cleanup job, no cascade, no trigger** — each would make a non-destructive action destructive.

## 5. `Mark all available` survives the inversion

067 §4 stands unchanged, and reads better under this polarity:

- "Stage only rows that are currently unavailable" becomes **"stage `available: true` for exactly
  the Variants in scope that have a row"**. The dirty count is the number of rows in scope, so it
  stays literally truthful, and the save is a `DELETE` of those rows. Scope is still every
  search-matched row across every page; it still stages, never writes, and is never disabled.
- **Empty dirty set is a no-op end to end** — nothing sent, nothing written, and the version does
  not move because the content did not change. There is no bump to suppress: 069/070 derive the
  version from content rather than incrementing it on write.

## 6. The read model — and a correction the PRD forces

**Unavailable Variants are NOT excluded from the payload. They ride in it, flagged.** The question
was routed to me as "how the payload *excludes* unavailable Variants"; the PRD says otherwise and
the PRD binds:

> **Story 32.** As a cashier, I want an unavailable Variant to be **visibly unsellable** on the
> terminal, so that I do not promise a customer something we cannot serve.

Story 40 makes archived items *absent entirely*, and the archive cascade table lists what "leaves"
the read model — availability appears in neither. `## Testing Decisions` agrees: *"A Variant marked
unavailable at Store A still appears available at Store B."* **Archived is absent; sold out is
present and marked.** A tile that vanishes tells a cashier the menu is broken; one that is visibly
out tells them what to say. **So the payload carries a boolean per Variant, by anti-join:**

```
NOT EXISTS (SELECT 1 FROM "VariantUnavailability" u
            WHERE u.tenant_id = v.tenant_id AND u.variant_id = v.id AND u.store_id = $storeId)
```

- **N: never an `INNER JOIN` on this table.** It returns only the sold-out items — the exact
  inversion of the intent, and the mirror of the `cash` trap 055 exists to prevent. `NOT EXISTS`
  (or `LEFT JOIN … WHERE u.id IS NULL`) is the shape.
- **It composes with the exclusion chain rather than fighting it:** both are read-time filters that
  write nothing. The parent chain drops archived Categories, MenuItems and Variants; this boolean is
  computed for whatever survives. Neither can half-fail, because neither is a write.
- Only this Store's boolean is in the payload — PRD security criterion 9, unchanged.

### What 069 binds here

The payload is hashed as `jsonb`, so the boolean is content and **flipping one Variant at one Store
moves that Store's version and no other Store's** — which is the property the PRD asserts on its
own. Two clauses follow, and both are traps:

- **N: the row's `created_at` and `id` must never enter the payload** — only the derived boolean. A
  row deleted and re-inserted to the same state would otherwise carry a new timestamp, move the
  version, and re-download the fleet for a no-op: exactly the failure 069 forbids by excluding every
  time-varying field.
- The boolean is a `jsonb` boolean, not a string or a count, so 069's canonicalisation holds and
  070's `catalog.version` returns the same 64 hex characters as `catalog.read`.

## The options, ranked

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Negative join — a row means sold out (the human's choice)** | 5 (15) | 4 | 5 (10) | 2 (4) | 4 (8) | **41** |
| 2 | A materialised boolean row per `(Variant, Store)` — the PRD's literal words | 4 (12) | 3 | 2 (4) | 2 (4) | 3 (6) | **29** |
| 3 | Positive join — a row means available (054's polarity) | 2 (6) | 3 | 3 (6) | 2 (4) | 3 (6) | **25** |
| 4 | Defer | 1 (3) | 2 | 3 (6) | 5 (10) | 1 (2) | **23** |

**1. Chosen.** Wins the user hat outright on both users, and the engineering hat on row count, on
needing no backfill from two other write paths, and on §2's statements being idempotent as written.
Honest at **reversibility 2** — see below.

**2. A boolean column on a materialised row per pair.** The PRD's literal sentence, and it behaves
identically to option 1 *if* the default is `true`. It loses on upkeep: rows must be created on
**every** Variant create and **every** Store create, so two write paths in two areas can each
half-fail and leave a pair with no row and no defined answer — and it stores `variants × stores`
rows forever to express a fact that is usually "none". **The option to move to** if availability
gains a second field (a note, a `sold_out_until`), because a row would then carry data, not a bit.

**3. Positive join, 054's polarity.** Consistent with the only availability table this repository
has — a real argument, and why this record spends a section on the divergence. It loses on the
human's reason 2, which is a first-run defect rather than a preference: every new dish is invisible
until someone ticks it on per Store, forever, and a fourth outlet starts with an empty menu.

**4. Defer.** Included because it must be; ten of its 23 points are reversibility, the inflation records 002 onward left visible. It is also the one option the PRD explicitly refuses — scenario 17 says this needs its own record **before the availability slice**, because today is when it is free.

## How to turn it back

| What | Cost |
| --- | --- |
| **Today, before the migration merges** | **Free.** No `Variant` model, no `VariantUnavailability`, no `catalog.*` or `availability.*` procedure exists — `rg -n 'availability\.' apps packages \| wc -l` is zero. Change three column comments and one anti-join. |
| The procedure (§2) | Unchanged by any reversal: 067's input is absolute targets, so only the two statements behind it swap. One handler file. |
| The read model (§6) | `NOT EXISTS` becomes `EXISTS`. One expression in one `.query.ts`. **Every Store's version moves once**, per 069's deploy clause. |
| **After the migration merges** | **A data migration that inverts the set** — insert the complement of what is there, delete the originals. The complement is the full `variants × stores` cross product, which is precisely the cost option 1 exists to avoid. **This reversal is more expensive than the original implementation.** |

**That last row is why this is `Stakes: high` with a named re-check trigger rather than a
comfortable reversal story.** A decision whose reversal costs more than the build is one I route to
the human — the human made this one, which is the disposal that rule asks for, and the trigger below
is the last moment it is cheap. Formally: superseding record; flip this `Status:` to `overturned`;
update the `LOG.md` lines; write the inverting migration; re-run the gate.

## The PRD text this contradicts — for the orchestrator to apply, verbatim

I may not edit the PRD. **Two edits, both replacements, neither a deletion.** Until they land the PRD and this record
disagree, and a reviewer is right to flag it as blocking.

**1. The `Availability is per Store, and is not stock` paragraph (≈L230).** Its second sentence,
*"A boolean toggle per (Variant, Store)"*, describes option 2. Replace that sentence with:

> A Variant is available at every Store unless a row says otherwise — the table is an exception
> list, so a new Variant is sellable everywhere the moment it is created and a new Store carries the
> whole menu on day one (record 071).

**2. `## Scenarios`, three Notes:**

- **Row 17** → `Answered by 071 — negative join, so a new Store carries the whole menu and a new Variant is sellable everywhere at once. Assert both.`
- **Row 18** → `Answered by 071 §4 — rows survive deactivation, a Store is never deleted, so the RESTRICT FK is never exercised and nothing is cleaned up.`
- **Row 28** → `Answered by 071 §3 — the row survives an archive and the dish returns sold out.`

## What should make you reverse this

- **The availability migration is about to merge and nobody has re-read §1.** The named re-check
  trigger, and the last moment this is free. After it, the reversal costs more than the build.
- **A tenant asks for a dish to be off *by default* at new outlets** — a franchise with a regional
  menu. The one shape this polarity cannot express; successor is option 2 with a per-Store default,
  not flipping the join.
- **Somebody adds an audit trail for catalog availability.** Then 054 §Q3's refusal is live again on
  its original grounds and 067's staged inline toggle must be re-decided with it. §1 names this.
- **A cashier reports the terminal hiding sold-out dishes** rather than marking them. §6 was read
  backwards — one expression, and it moves every version once.
- **A tenant's menu is mostly 86'd most of the time.** The row-count argument inverts and option 2
  becomes cheaper. Nothing else about the decision changes.

## Evidence

**Repository, read 2026-08-04, main checkout:**

- `.scratch/catalog/PRD.md` — **story 32 (`visibly unsellable`) and story 40 (archived items
  `absent entirely`)**, which together decide §6 against the way the question was framed to me;
  `## Testing Decisions`' *"A Variant marked unavailable at Store A still appears available at Store
  B"*; the archive cascade table, which does not list availability; the *"86'd switch, nothing
  more"* paragraph and *"Exclusion is computed from the parent chain, not written down the tree"*;
  `### Chosen approach` — **approach B, picked by the human on 2026-08-04**; `## Scenarios` rows 8,
  17, 18, 26 and 28 (17: *"Needs its own record before the availability slice"*; 18: *"Must be
  decided here, not discovered there"*); security criteria 4 and 9.
- `packages/backend/src/db/prisma/schema.prisma` — `PaymentMethodAvailability` in full
  (`id, tenant_id, payment_method_id, store_id, created_at`; `@@unique([paymentMethodId, storeId])`;
  `@@index([tenantId])`), the shape §1 copies. `Store` carries `active Boolean @default(true)` and
  `@@unique([tenantId, id])` — checked specifically, the first for §4 and the second because the
  composite FK depends on it. **No `Variant`, `MenuItem` or `Category` model exists.**
- `…/migrations/20260803130000_payment_methods/migration.sql` lines 58–87 — the `CREATE TABLE`, two
  composite FKs plus the plain tenant FK all `ON DELETE RESTRICT ON UPDATE CASCADE`, and the RLS
  block: `ENABLE` + `FORCE` + one unqualified (therefore `FOR ALL`) policy on
  `current_setting('app.tenant_id', true)`, **default privileges deliberately left in place**, its
  comment explaining why (*"rows are inserted and deleted directly"*). **This file, not 046's prose,
  is what the new migration copies.** Role `"deanpos_app"`. **No migration in the repository uses
  `ON DELETE CASCADE`** — checked, because §3 and §4 turn on it.
- `054` (the positive join, *"the fail-safe direction"*, smaller call 2 — now carrying a pointer
  back here), `067` §3/§4/§5, `069` (the `jsonb` hash and its excluded time-varying fields), `070`
  (derived per request, the shared query), `046` §3 (the audit treatment §1 refuses to copy), `055`
  (the `cash` trap the `INNER JOIN` no-go mirrors), `038` (deactivated, never deleted).
- **Searched 001–070 for an existing record on catalog availability polarity, exception lists, or
  new-Store defaults: none names any**; 054 is the only adjacent record and this record diverges
  from it explicitly. **`071` is the next free filename — `069` and `070` were written after `068`
  and were checked on disk before writing. No duplicate.**

**External: none consulted, and the absence is deliberate.** Join polarity is a question about this
product's own failure modes and its own documents; the general literature on soft-deletes and
exception tables cannot decide whether a dish or a tender must fail closed, and citing it would be
padding. Every claim above traces to a file in this repository. WCAG is not engaged — nothing here
is user-visible except through 067, which decided it.
