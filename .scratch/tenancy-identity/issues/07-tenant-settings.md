# 07 — Tenant settings

**Status:** ready-for-agent

## What to build

The settings a Tenant sets once and four later areas read. Four of them are tenant-scoped and
live here:

| Setting | Default | Read by |
| --- | --- | --- |
| Timezone | `Asia/Manila` | `reporting`, every rendered time |
| VAT enabled | **off** | `checkout`, `reporting` |
| VAT rate | `12%` | `checkout`, `reporting` |
| Variance tolerance | `0` **centavos** | `drawer-sessions` |
| Cash-movement Override threshold | `0` **centavos** | `drawer-sessions` |

**VAT defaults to off** (ADR-0010) because most target tenants sit below the ₱3,000,000
registration threshold. A product that ships VAT on hands those tenants figures that are
confidently wrong and a receipt claiming a registration they do not hold. Turning it on
affects sales from that point forward and never reaches last month's takings.

Every setting here obeys the rule the whole design rests on:

> **A setting governs sales made from now on. The value in force is captured on the sale.**
> No report, receipt, or reconciliation ever reads a current setting to interpret a past
> Order.

**These are financial controls, so they are `admin`-only and audited** — actor, and both the
old and the new value. A control that can be widened without a trace is not a control.

The defaults matter as much as the editing. A freshly provisioned Tenant is the configuration
most tenants will run and the one most likely to go untested because it is the boring one.

## Acceptance criteria

- [ ] A freshly provisioned Tenant has VAT **off**, a VAT rate of `12%`, a Variance tolerance
      of `0` centavos, a cash-movement Override threshold of `0` centavos, and the
      `Asia/Manila` timezone — asserted directly on a new Tenant.
- [ ] An `admin` changes each setting and the change takes effect.
- [ ] Only `admin` may change any Tenant setting. `manager` and `cashier` are refused
      server-side, per setting.
- [ ] Every change writes an audit row naming the actor, the setting, the old value, and the
      new value.
- [ ] Turning VAT on, and changing the rate, is dated — the audit trail says when, so a later
      area can tell which sales it applied to.
- [ ] WCAG 2.2 AA on the screen, asserted by the existing automated accessibility check.
- [ ] Wrong-tenant probes on every settings procedure: a Tenant may neither read nor write
      another's VAT rate, tolerance, or timezone.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/settings-sales-1440.svg`

**Scope of the reference: the tenant-level settings on this screen only.** The payment-method
list on the same mock is issue 08.

## Depends on

- 04 — Roles, Store membership, and the authorisation gate

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**`
- `packages/backend/src/**` — settings handlers and the settings audit, per ADR-0008
- `apps/backoffice/src/routes/**` and `apps/backoffice/src/features/**` — per ADR-0009
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 6a, 6c–6e, 6m), ADR-0010, Security
criteria 17 and 18._

_**Obligation carried forward to `checkout`:** the PRD asks for one test per setting proving a
change leaves every existing Order's captured values untouched. No Order exists in this area,
so those assertions transfer to `checkout`, which owns the Order and the capture. This issue
asserts the settings side — defaults, admin-only, and the audit trail — and nothing here may
be built in a way that requires reading a current setting to interpret a past sale._

_**Resolved by [record 047](../../decisions/047-a-tenant-may-read-and-update-its-own-row.md):
own-row `Tenant` reachability, decided by the human directly.** `Tenant` carries own-row-only
`SELECT`/`UPDATE` RLS policies; the old "unreachable even from a tenant-scoped connection"
assertion was over-specified against what issue 01 actually needed (not-enumerable,
not-cross-readable). `packages/backend/tests/db/with-tenant-scope.test.ts` is amended, not
deleted — it now proves exactly-one-own-row, cross-tenant invisibility, zero rows unscoped, no
`DELETE` grant, and that `UPDATE` cannot move a row to another tenant. The suite is green._
