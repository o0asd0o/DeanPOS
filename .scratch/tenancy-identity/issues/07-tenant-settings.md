# 07 — Tenant settings

**Status:** done

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

**Closed 2026-08-03.** Merged to `main`; gate green at **424** tests, migration proven from an empty
database. 2 fix rounds, both review rounds by a second model.

**Two records, both decided by the human directly:**
[046](../../decisions/046-how-tenant-settings-are-stored-and-audited.md) (storage and audit shape) ·
[047](../../decisions/047-a-tenant-may-read-and-update-its-own-row.md) (the `Tenant` policy).

**ADR-0005 and ADR-0010 settled more than expected** — integer centavos with floats prohibited in
every layer, and `vatEnabled`/`vatRatePercent` already named with their defaults. The open part was
the rate's *type* (integer percent), where the five settings live (columns on `Tenant`), the audit
table's shape, and what non-admins see (nothing).

**The collision worth remembering:** columns on `Tenant` required the app role to read its own
`Tenant` row, and issue 01's locked test asserted `Tenant` was unreachable from *any* tenant-scoped
connection — zero rows, not even your own. Resolved by narrowing the assertion to own-row-only.
Record 029 had already breached "no policy on `Tenant`" with the identical predicate for `INSERT`,
so the `SELECT`/`UPDATE` pair is consistent rather than novel, and enumeration stays impossible:
you can only ever see the tenant you are already scoped to, whose id you already had. **The amended
test is stronger than what it replaced** — it now also proves another tenant's row invisible when
addressed directly by id, an unscoped connection reading zero, and `UPDATE` unable to move a row
across tenants.

What the review caught:

- **The audit trail could record a false `old_value`.** The pre-diff read did not lock the `Tenant`
  row, so two admins moving the rate `12`→`13` and `12`→`14` would have written audits `12→13` and
  `12→14` — **the real `13→14` transition appearing nowhere.** An audit trail that is quietly wrong
  is worse than one that is missing, and this is a financial control. Same defect as issue 06's, same
  remedy as record 034's.
- **`centavos / 100` put money through a binary float**, which ADR-0005 prohibits in every layer.
- **The concurrency test I accepted in round 1 was unreliable in both directions** — no barrier, so
  unlocked code passed when scheduled serially; independently sorted columns, so correct code flaked
  when `14` won the lock. It now blocks on a real lock and asserts paired rows.
- **The wrong-tenant probes checked two of five settings** on read and one of five on write. A
  per-column regression on the VAT rate or either threshold would have passed.

**Merge note:** `main` moved three times under this lane. The final rebase conflicted on `Nav.tsx` —
`main` had extracted `NAV_GROUPS` into `helpers.ts` so the header's search could reach screens by
name, while this lane hid `Settings` from non-admins. **Both intents were kept**: main's structure,
with the filter applied in `Nav`. `contract.ts` was a pure additive-import collision.
