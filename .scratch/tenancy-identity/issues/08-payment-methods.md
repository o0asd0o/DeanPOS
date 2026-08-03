# 08 — Payment methods

**Status:** ready-for-agent

## What to build

The list of ways a Tenant's customers pay, so that a GCash sale is recorded as GCash and not
as "other". A method is a name, a `kind`, an active flag, and its per-Store availability —
nothing more.

**`cash` is special and the database is what makes it special.** It is seeded at Tenant
creation with `kind: cash`, and it is the only method of that kind: it cannot be renamed,
deactivated, deleted, or duplicated, and no second `cash`-kind method may be created. That is
a **partial unique index**, not an application check — the till can never be configured into a
state where nothing can be sold, and two concurrent attempts prove it.

Everything else is `kind: recorded`: a name, an amount, and nothing else. **DeanPOS contacts
no provider and confirms nothing.** The back-office copy must say so where the methods are
configured — not only in the marketing — so no admin believes a payment is being processed.

Presets offered at setup — Card, GCash, Maya, Bank transfer — are **seed suggestions, not a
fixed enum**. Nothing downstream may branch on a method's name. The only thing code may branch
on is `kind`, which is what keeps `drawer-sessions`' expected cash correct when a tenant adds a
method nobody anticipated.

Methods deactivate rather than delete, so history stays readable. Per-Store availability is a
join, so an outlet with no card machine simply does not offer one — enforced server-side, not
by hiding a button.

This issue amends provisioning (issue 02) to seed `cash`; existing Tenants gain it in the same
migration.

## Acceptance criteria

- [ ] A freshly provisioned Tenant has exactly one PaymentMethod: `cash`, `kind: cash`.
- [ ] `cash` cannot be renamed, deactivated, or deleted, and a second `kind: cash` method is
      refused **by the database** — asserted with two concurrent attempts, not one sequential
      one.
- [ ] A `recorded` method can be created from a preset or from a typed name, renamed, and
      deactivated; deactivating it leaves any record that referenced it readable.
- [ ] Per-Store availability is set per method by an `admin` and stored as one positive join row
      per `(method, Store)` pair; `cash` holds no rows and is available everywhere. The write is
      refused server-side for a non-`admin` and for a `cash` id, and a wrong-tenant probe covers
      it. **The read-side refusal is `checkout`'s — see `## Comments`.**
- [ ] No code anywhere branches on a method's name; `kind` is the only branch. Grep proves it.
- [ ] The configuration screen states plainly that a non-cash method records an amount and
      charges nothing.
- [ ] Only `admin` may change the method list or its per-Store availability; each change is
      audited with the actor and both values.
- [ ] WCAG 2.2 AA on the screen, asserted by the existing automated accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/payment-methods-1440.svg`
- Image · whole-screen · 1440: `design/lofi/backoffice/employees-1440.svg`
- Image · component: editor sheet · 1440: `design/lofi/backoffice/employee-editor-1440.svg`
- Image · component: confirmation · 1440: `design/lofi/backoffice/deactivate-dialog-1440.svg`

**A screen, not a section of the settings dialog.** The tenant-level settings issue 07 built
live in a dialog off the account menu, which holds one row per Tenant and nothing to list;
a list of methods is its own screen. `payment-methods-1440` supersedes the payment-method
half of the old `settings-sales-1440` drawing.

**The other three references are the built basis, not this screen's content**: the list
pattern, the editor sheet, and the deactivate confirmation are already shipped for Stores
and Employees, and this screen follows them. Departures go in the build report.

## Depends on

- 07 — Tenant settings
- 05 — Store management

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` —
  `PaymentMethod`, its per-Store availability join, the partial unique index, and the seed
- `packages/backend/src/**` — provisioning (amended to seed `cash`) and the method handlers
- `apps/backoffice/src/routes/**` and `apps/backoffice/src/features/**` — per ADR-0009
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 6f–6l), ADR-0010, Security criterion 19.
Applying a method to a sale is `checkout`'s; any payment processing, gateway integration, QR
generation, or settlement is a declared non-goal of the product._

_Shares `schema.prisma` and the provisioning handler with issue 02 and shares the settings
screen with issue 07 — do not run this in parallel with either._

_**Obligation carried forward to `checkout`:** criterion 4's second half — "a caller at a Store
where a method is unavailable cannot name it" — has no refusal site in this issue. Nothing here
accepts a payment method against a sale, so the enforcement moves to `checkout`, which owns the
Payment. Decided by [record 055](../../decisions/055-availability-enforcement-belongs-to-checkout.md)._

_The server truth `checkout` enforces against is the join built here, queried directly.
**`checkout` must not read `paymentMethod.list`** — it is `admin`-only, tenant-wide, and
unfiltered by Store. The predicate, and the `cash` disjunct is not optional:_

> _A method `M` may be named on a sale at Store `S` **iff** `M.active` is true **and**
> (`M.kind = 'cash'` **or** a `PaymentMethodAvailability` row exists with
> `payment_method_id = M.id` and `store_id = S`), all under the caller's tenant scope._

_`cash` holds no availability rows by design (record 054), so a plain `INNER JOIN` on
availability refuses cash at every Store and configures a till that cannot sell — the hazard the
partial unique index exists to prevent, arriving through the back door._

_`paymentMethod.list` being `admin`-only starves no one today (`apps/pos` has no sale flow); it
becomes a gap the day `checkout` ships, and record 054 §"Smaller calls" 1 pre-prices that
reversal._
