# 08 — The read model contract

**Status:** done
**Category:** feature

## What to build

The seam with `offline-sync`, closed and proven. Issues 01–07 each grew the read model; this one
makes it a contract somebody else can build an entire area against, and asserts the properties
that only hold once everything is in it.

**This is the last issue in the PRD and the first thing area 5 reads.** `offline-sync` owns
caching, refresh scheduling, and what a terminal does with a stale version. This area owns
producing the payload and the version correctly — and the cost of getting the version wrong is not
paid here, it is paid by an unbuilt area that assumed something false.

**One shot, shaped for the consumer.** A CQRS read model in `foundation`'s sense — not mirrored
from the write tables — because the terminal caches it whole. One procedure returns a Store's
complete sellable catalog: categories, items, variants, groups, modifiers, add-on links,
discounts, and that Store's availability, plus the version.

**The version's properties, from records 069 and 070, asserted end to end:**

- `sha256` of the assembled payload **cast to `jsonb`**, per `(tenant, store)`, 64 lowercase hex,
  **opaque**. The `::jsonb` cast is what makes key order and whitespace unable to move it — and
  Kysely's `jsonArrayFrom`/`jsonObjectFrom` build `json`, not `jsonb`, so the cast goes immediately
  before the hash whatever built the value.
- **Equal versions mean equal payloads**, in both directions. This replaced the PRD's older "the
  version changes after any catalog write", which only a counter could satisfy.
- Derived per request; `catalog.version({ storeId })` hashes in the database and returns ~80 bytes,
  never the payload. If checking staleness costs what downloading costs, the mechanism is pointless.
- **No timestamp, no `updated_at`, no `created_at`, no request id, no server clock anywhere in the
  payload.** One such field and the version moves on every fetch, the mechanism is dead, and every
  existing test still passes. This is the likeliest way records 069 and 070 silently stop being
  true, and it is why this issue re-asserts it after everything else has landed.
- **Never `>`, `<`, sorted, parsed, or compared across `(tenant, store)`.** A consumer comparing
  two hashes with `>` is a bug that compiles.

**The stress case is real and named:** 400 Variants over a phone tether (`## Scenarios` row 9).
Assert a payload bound at a realistic size. Do **not** paginate the read model to meet it — one
shot is the point, and pagination moves the complexity into `offline-sync`'s cache atomicity.

## Acceptance criteria

- [x] `catalog.read({ storeId })` returns the complete sellable catalog for that Store in one
      request — categories, items, variants, groups, modifiers, add-on links, discounts,
      availability — plus `version`.
- [x] Every list field is present and empty rather than omitted when it has no rows, so a terminal
      can tell *"none configured"* from *"old payload shape"*.
- [x] `catalog.version({ storeId })` returns a value identical to `catalog.read`'s and **selects
      only the hash column**; a test asserts the payload is not transferred (record 070).
- [x] Equal versions mean equal payloads, asserted in **both** directions.
- [x] A no-op save on a Variant does not move the version; a price moved up and back down between
      two fetches leaves the version equal at both ends, and a terminal that fetched *during* the
      window holds a different one and re-fetches (`## Scenarios` rows 11, 22 — and read record
      069's Discount carve-out: use a Variant or an availability toggle, never a Discount).
- [x] A grep proves no timestamp, `updated_at`, `created_at`, request id or clock value is in the
      payload — a standing assertion, not a one-time check.
- [x] An availability toggle at one Store moves that Store's version and leaves every other
      Store's unchanged.
- [x] A tenant-level change — a Discount, an Add-on, a ModifierGroup — moves **every** Store's
      version, falling out of the mechanism rather than through a special case (record 069 §4).
- [x] Archiving a Category moves the version through the computed payload, not a row scan — the
      exclusion chain is parent-computed and a naive scan misses it (record 069 §5).
- [x] A tenant with 400 Variants produces a payload within a stated size bound, asserted with a
      seeded fixture at that size (`## Scenarios` row 9). The read model is **not** paginated.
- [x] A brand-new Tenant's Device fetches a read model with zero Categories successfully
      (`## Scenarios` row 19).
- [x] Archived MenuItems and Variants are **absent** from the read model; sold-out Variants are
      **present and flagged** (record 071 §6, stories 32 and 40).
- [x] A `cashier` and an enrolled Device may read the read model and mutate nothing.
- [x] Wrong-tenant probes on **every** procedure in this area, the read model included — a catalog
      leak is a pricing leak to a competitor on the same platform. Record 062's coverage guard must
      pass with no exemptions added for this area.
- [x] The version's opacity is documented at the contract, so `offline-sync` cannot read ordering
      into it.

## Relevant files

- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — edit: the assembled payload
- `packages/backend/src/catalog/handlers/queries/catalog-version.ts` — edit: hash-only path
- `packages/contract/src/contract.ts` — edit: document the version as opaque
- `packages/backend/src/catalog/read-model.test.ts` — create: the contract assertions
- `packages/backend/src/catalog/read-model-size.test.ts` — create: the 400-variant bound

## Depends on

- 05 — Add-ons
- 06 — Discounts
- 07 — Availability, per Store

## Comments

- AC1/AC2/AC3/AC5/AC7/AC9/AC12 proven by `apps/api/tests/catalog-read-model.test.ts`, `catalog-variants.test.ts`, and `catalog-availability.test.ts`.
- Kysely specialist consulted and tasked: fluent builders retained for catalog blocks; only the PostgreSQL SHA-256 expression remains typed `sql`, because Kysely does not model `sha256(convert_to(...))`.
- Read-model content now excludes top-level tenant/store keys and timestamps; `catalog.version` selects only the shared query's hash column. MenuItems remain sellable with zero active Variants.
- AC1 ticked — `catalog-read-model.test.ts` "keeps empty categories, excludes drafts, and agrees with catalog.version"; catalog option read tests cover nested groups/modifiers.
- AC2 ticked — `catalog-read-model.test.ts` same case asserts empty `variants`, `modifierGroups`, and `addOns`.
- AC3 ticked — `catalog-read-model.test.ts` same case asserts `catalog.version` equals `catalog.read`; shared query source selects only the hash on the version path.
- AC5 ticked — `catalog-variants.test.ts` "price change moves version; no-op save does not".
- AC7 ticked — `catalog-availability.test.ts` "toggles both levels, scopes versions per Store, and is idempotent".
- AC9 ticked — `catalog-variants.test.ts` "cascade row 1: archiving a Category removes its MenuItems and Variants from the read model".
- AC12 ticked — `catalog-variants.test.ts` archive cases plus `catalog-availability.test.ts` sold-out flag assertions.
- AC14 ticked — `catalog-wrong-tenant.test.ts` has tagged probes for `catalog.read` and `catalog.version`; coverage guard wiring remains present.
- AC15 ticked — opaque version documentation added beside the catalog procedures in `packages/contract/src/routes/catalog/contract.ts`.
- AC4 ticked — `catalog-read-model-contract.test.ts` "AC4: the reported version hashes the delivered payload" proves canonical hash equality, no-op equality, change inequality, and restoration equality.
- AC6 ticked — `catalog-read-model-contract.test.ts` "AC6: the payload builder and read schema contain no time or request fields" is the standing source/schema guard.
- AC8 ticked — `catalog-read-model-contract.test.ts` "AC8: Discount, Add-on, and ModifierGroup changes move every Store version".
- AC10 ticked — `catalog-read-model-contract.test.ts` "AC10: 400 Variants fit one bounded, unpaginated payload".
- AC11 ticked — `catalog-read-model-contract.test.ts` "AC11: a fresh Device reads an empty catalog".
- AC13 ticked — `catalog-read-model-contract.test.ts` "AC13: a cashier reads but cannot mutate, and a Device cannot mutate".
- AC14 completed — `wrong-tenant-probe-coverage.test.ts` and tagged availability probes pass with zero missing paths.
- Issue 08 marked done after the full contract suite passed: 5 files, 45 tests.
