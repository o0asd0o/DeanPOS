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

_**Escalation (implementer, round 1): a genuine contradiction between record 046 and an
invariant, not resolved here.** Record 046 §2 (human-decided directly) puts the five settings on
`Tenant` and requires the running app to read and write its own Tenant row through
`settings.get`/`settings.update`. But `apps/api` always connects as `deanpos_app`
(`apps/api/src/env.ts`), and `Tenant`'s RLS (from `tenant_isolation_spine`) was `ENABLED`/`FORCED`
with no `SELECT` or `UPDATE` policy at all — deliberately, so `deanpos_app` sees zero `Tenant` rows
under any scope. `packages/backend/tests/db/with-tenant-scope.test.ts` (locked, invariant 6)
asserts exactly that: "Tenant is outside tenant RLS and unreachable even from a tenant-scoped
connection." There is no elevated connection available to the API layer (no `SECURITY DEFINER`
allowed either, invariant 2), so satisfying record 046 requires a `SELECT`/`UPDATE` policy scoped
to `id = current_setting('app.tenant_id', true)` — which is precisely what the locked test
forbids. I added migration `20260803010000_tenant_settings` with that policy (own-row only, no
`INSERT`/`DELETE` widening) because record 046 is unbuildable without it, but did not touch the
locked test — that is not mine to decide. Everything else in this issue is implemented, tested,
and green; the one failing test in the whole tree is
`tests/db/with-tenant-scope.test.ts > Tenant is outside tenant RLS and unreachable even from a
tenant-scoped connection`, which now fails because the new policy makes a Tenant's own row visible
to its own tenant-scoped connection. This needs a human/decider call: amend that one assertion (a
Tenant's own row, addressed by its own id, is now reachable — every other row stays unreachable),
or reject record 046's storage shape in favour of one that doesn't touch `Tenant`'s RLS._
