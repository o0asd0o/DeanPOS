# 06 — Discounts

**Status:** done
**Category:** feature

## What to build

The named reductions a business gives, so a cashier applies *Senior Citizen* rather than editing a
price. A Discount lives in this area because it is back-office CRUD over a priced concept with an
archive rule — not because it is part of the menu (ADR-0010).

A Discount carries: name · `type` (`percent` | `amount`) · `scope` (`order` | `line`) · an
optional value · `requiresOverride` · `vatExempt` · `requiresReference` with a tenant-set label ·
an archive flag.

**It is a definition, not a rule.** No conditions, no schedule, no code, no eligibility logic, and
**no stacking logic of its own** — the one permitted combination, at most one order-scoped plus at
most one per line, is a rule `checkout` applies. It is applied by a person who decided to apply
it. The back-office copy must say so where the list is edited, so nobody expects a promotions
engine.

**Empty is the default and the configuration most tenants will keep.** The mock draws the empty
state as the primary state rather than an edge case, and that is correct — build it that way. The
read model returns an **empty list**, never an omitted field, so a terminal can tell *"none
configured"* from *"old payload shape"*.

**A Discount is versioned rather than updated in place** (Security Criterion 11). `vatExempt` and
`requiresOverride` are financial controls: one quietly flipped to VAT-exempt is a tax claim, one
flipped off `requiresOverride` removes a manager from the loop. So an edit writes a **new row with
an `effective_from`**, and an Order references the version it applied — the same append-only shape
`tenancy-identity` uses for role and membership. The log carries actor, Tenant, Discount id and
which fields changed, never the values; the values live in the row history, which is queryable and
access-controlled (Criterion 8).

**That versioning has a consequence for record 069 that the implementer must not trip over.**
Because an edit writes a new row with a new id, and that id is in the payload, a "no-op" save on a
Discount **does** move the catalog version — correctly, because the terminal genuinely needs the
new row. This is 069's named carve-out. Do not use a Discount to test `## Scenarios` row 11.

## Acceptance criteria

- [x] A `Discount` table with `tenant_id`, RLS enabled and forced in the creating migration,
      `@@unique([tenantId, id])`, and an `effective_from` supporting the versioned-row shape.
- [x] An edit writes a **new row**, never an `UPDATE` of the old one; the prior row stays readable
      and an Order can reference the version it applied.
- [x] Constraints refused **at write time**, so `checkout` never reasons about a malformed one:
      `amount` implies `scope: order` — an `amount` with `scope: line` is rejected; a `percent`
      value is `0 < v ≤ 100`, so `0`, `100.01` and a negative are rejected and `100` is accepted;
      an `amount` value is positive `Centavos` and one that is not exact centavos is rejected;
      `requiresReference` with an empty label is rejected.
- [x] A null value is accepted and marked prompt-at-sale, bounded by the same rules at sale time.
- [x] Only `admin` and `manager` may set `vatExempt` and `requiresOverride`; a `cashier` cannot
      create, edit, or archive a Discount at all, enforced server-side.
- [x] The audit log carries actor, Tenant, Discount id, and which fields changed — **never the
      values** (Security Criterion 8). A test asserts no value reaches the log.
- [x] A new Tenant's list is empty, and the read model returns `discounts: []` rather than
      omitting the field.
- [x] The empty state is built as the primary state, from the mock, not improvised.
- [x] Creating, editing, or archiving a Discount moves the catalog version; an archived Discount
      leaves the read model and stays readable by id.
- [ ] A `requiresReference` label renamed after sales captured references under the old one does
      not alter those captures — assert capture-at-sale per ADR-0010's principle
      (`## Scenarios` row 23).
- [x] The screen states plainly that DeanPOS discounts are applied by a person and never
      automatically.
- [x] No `toast()` on save; announcement through record 038's live regions, failure inline.
- [x] Wrong-tenant probes on every procedure this issue exposes.
- [x] WCAG 2.2 AA, asserted by the existing automated accessibility check.

## Closure

Closed as `done` on 2026-08-09 after implementation and acceptance review. The five new
`catalog.*Discount` wrong-tenant probes pass against the local database; migration deploy is
clean; backend, API, and backoffice typechecks pass. Scenario row 23 remains intentionally
unticked: capture-at-sale is deferred to `checkout`, with the carry-forward note in
`.scratch/checkout/discount-capture.md`.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/discounts-1440.svg`

The mock draws **both** the populated list and the empty state. `## Direction` calls the empty
state drawn as the primary configuration *"the least obvious thing in the whole set"* and marks
this mock as **not** carrying a collision — follow it as drawn. The editor is record 049's
detached non-modal `Sheet` with 050's `SheetForm`; the list is 038's shape.

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` — edit: `Discount`
- `packages/backend/src/db/prisma/migrations/<new>/migration.sql` — create: table, RLS, `CHECK`s
- `packages/backend/src/catalog/handlers/commands/` — edit: discount commands, versioned writes
- `packages/backend/src/catalog/handlers/queries/read-catalog.ts` — edit: the discounts list
- `apps/backoffice/src/routes/_shell/discounts.tsx` — edit: replace the placeholder
- `apps/backoffice/src/features/discounts/` — create
- `apps/backoffice/tests/discounts-screen.test.tsx` — create

## Depends on

- 01 — Categories, MenuItems, and the read model's first shot
