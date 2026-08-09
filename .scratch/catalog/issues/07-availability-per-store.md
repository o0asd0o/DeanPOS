# 07 — Availability, per Store

**Status:** done
**Category:** feature

## What to build

The F&B "we're out of adobo" switch. Per `(Variant, Store)`, because one outlet running out does
not affect another. **This is not stock** — no quantities, no depletion, no recipes.

**This issue is almost entirely pre-decided. Read records 067, 068 and 071 in full before writing
anything; they are the specification and this section only summarises them.**

**071 — the shape.** A row in `VariantUnavailability` means the Variant is **86'd** at that Store.
Absence of a row means available. So a new Variant is sellable everywhere the moment it is
created, and a new Store carries the whole menu on day one. This deliberately reverses record
054's polarity for payment methods; 054 stays `decided` and both records cross-reference.

**071 — two traps that compile.** The table is **DELETE-heavy**, so it must **not** copy record
046 §3's insert-only grant — that fails every "mark available" at the database while the screen
shows success staged. And the row's `id` and `created_at` must **never** enter the read-model
payload, or toggling a dish off and back on moves the version and re-downloads the fleet for a
no-op, against record 069.

**071 §6 — the payload does not exclude sold-out Variants.** Story 32 requires an unavailable
Variant be *visibly unsellable* on the terminal; story 40 makes archived items absent entirely.
Archived is absent; sold out is **present and flagged**. The payload carries a per-Variant boolean
via `NOT EXISTS(...)` scoped to the requested Store. **Never an `INNER JOIN`** — that returns only
the sold-out set, the mirror of record 055's `cash` trap.

**067 — the screen.** Inline toggles that mutate **local draft state only**, and one page-level
Save committing every changed pair in one transaction. No write on tap. The Save bar is a
`CardFooter` rendered **only while dirty** — its presence is the signal — `sticky bottom-0
bg-card`, outside 038's `overflow-x-auto py-1` wrapper. A dirty row is marked twice
(`data-state="selected"` plus the word `Unsaved`) for SC 1.4.1. Leaving is blocked by
`useBlocker` into the shipped `Dialog`, with `enableBeforeUnload` on the same predicate. The
control is a native `<input type="checkbox" className="size-4 accent-primary">` per record 045 —
**no `role="switch"`** — with `aria-label="{variant} at {store}"`; the mock's `On`/`Off` text stays
but is `aria-hidden`.

**067 — the Store is a route search param**, `/availability?store={id}`, so changing the Store
*is* a navigation and the same guard covers it. A draft can never span two Stores
(`## Scenarios` row 8).

**068 — the announcement.** This screen is the **one** catalog save that uses a `toast()`;
`## Direction` prohibition 5 is overridden here and only here. Because sonner's `Toaster` is
itself an `aria-live` region, 038's `role="status"` regions must go **silent on save** or one save
is heard twice; the visible `CardFooter` line must not gain `role="status"`, `aria-live` or
`aria-atomic`. The catalog version renders in both the toast and the visible line, as one string
constant. **No pending toast** — sonner 2.0.7 has no delay threshold, so a fast save flashes; the
Save button's `Saving…` + `aria-busy` is the pending state. Failure stays **inline**, never
`toast.error`.

## Acceptance criteria

- [x] `VariantUnavailability` per record 071 §1 — `id, tenant_id, variant_id, store_id,
      created_at`, `@@unique([variantId, storeId])`, `@@index([tenantId])`, composite FKs and the
      RLS block copied from `migrations/20260803130000_payment_methods`. **Not insert-only**, and
      not audited.
- [x] `availability.set({ storeId, changes: [{ target, available }] })` per record 067 §3:
      absolute targets, one transaction, idempotent per pair — `available: true` is a `DELETE`,
      `available: false` is `INSERT … ON CONFLICT DO NOTHING`. The payload carries **only touched
      pairs**, never the visible page. Stale is last-writer-wins, no version check. The response
      returns the catalog version.
- [x] A new Variant is sellable at every Store, and a new Store carries the whole menu, both
      asserted (`## Scenarios` row 17).
- [x] An unavailable Variant's row **survives** archiving the Variant; un-archiving returns the
      dish sold out (record 071 §3, `## Scenarios` row 28).
- [x] Rows survive Store deactivation; nothing is cleaned up and nothing is added to
      `tenancy-identity` (record 071 §4, `## Scenarios` row 18).
- [x] `Mark all available` **stages, never writes**, scoped to every search-matched row across all
      pages rather than the current page, staging only rows that currently have one; an empty
      dirty set is a no-op (record 067 §4).
- [x] The Save bar appears only while dirty; a dirty row carries two independent signals; leaving
      the route with unsaved changes is blocked and offers the shipped `Dialog`.
- [x] Changing the Store navigates and is covered by the same guard; a draft never spans two
      Stores (`## Scenarios` row 8).
- [x] The read model carries a per-Variant availability boolean for the requested Store via
      `NOT EXISTS`, and a Variant unavailable at Store A is still available at Store B.
- [x] An availability toggle moves **that Store's** version and **no other Store's** — asserted
      separately, because it is the write most likely to be treated as "not really catalog"
      (record 069, and the PRD's `## Testing Decisions`).
- [x] Toggling a dish off and back on returns the version it started with — the row's `id` and
      `created_at` are not in the payload (record 071, record 069).
- [x] On save, exactly one assistive-technology announcement fires. A test asserts 038's
      `role="status"` regions are **not** written to on save (record 068).
- [x] Availability procedures have an `admin` floor (D4); Store authority is asserted through
      `getStore` plus `canAccessStore`, with wrong-tenant coverage required below.
- [x] The read model authorises `storeId` for tenant callers and restricts device callers to their
      own Store (Security Criterion 9).
- [x] `MenuItemUnavailability` exists per record 077 with the same shape, composite FKs, RLS, and
      default full CRUD grant treatment as `VariantUnavailability`.
- [x] The SQL hash and TypeScript payload both include the availability boolean for the same
      requested Store.
- [x] `catalog.read` and `catalog.version` authorise `storeId` for tenant and device callers.
- [x] Wrong-tenant probes on every procedure this issue exposes.
- [x] WCAG 2.2 AA, asserted by the existing automated accessibility check, including SC 3.3.4.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/availability-1440.svg`

The mock draws inline `[ON|OFF]` per row. Record 067 keeps that ergonomics and changes the save
semantics — staged, one page-level Save. **Do not resolve any gap here by copying
`AvailabilityField` from payment methods**; that is the exact silent overrule 067 was written to
prevent.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `VariantUnavailability`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create: table, RLS, FKs
- `packages/backend/src/catalog/handlers/commands/set-availability.ts` — create
- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — edit: the `NOT EXISTS` boolean
- `apps/backoffice/src/routes/_shell/availability.tsx` — edit: replace the placeholder, add the
  `store` search param
- `apps/backoffice/src/features/availability/` — create
- `apps/backoffice/tests/availability-screen.test.tsx` — create

## Depends on

- 02 — Variants, the price, and the archive cascade

## Comments

Record 077 settles the widening to MenuItems plus Variants, server pagination, the admin floor, and the one changed empty-state string. The implementation follows the repository's flat `availability/handlers` layout rather than the stale `catalog/handlers/commands` path named below.

Record 071 names a re-check trigger the orchestrator must honour: **before this issue's migration
merges**, re-read 071 §1. After the merge the reversal costs more than the build — undoing the
negative join means a data migration inserting the full `variants × stores` complement.
