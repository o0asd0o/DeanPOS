# 047 — A tenant may read and update its own `Tenant` row

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** high — it narrows a locked isolation invariant
- **Asked by:** issue 07's implementer, which hit the collision and escalated rather than editing the locked test
- **Decided by:** **the human, directly.**
- **Narrows:** issue 01's "unreachable" criterion and the assertion at
  `packages/backend/tests/db/with-tenant-scope.test.ts:84`
- **Builds on:** [029](029-how-a-tenant-row-is-created-under-rls.md), which established the
  identical predicate for `INSERT`

## What I chose, and why

`Tenant` gains **`FOR SELECT`** and **`FOR UPDATE`** policies, both
`id = current_setting('app.tenant_id', true)`. **Own row only.** No `INSERT` widening, no `DELETE`
at all.

[Record 046](046-how-tenant-settings-are-stored-and-audited.md) put the five tenant settings on
`Tenant` as columns, following the `Store` precedent. But `apps/api` connects **only** as
`deanpos_app` — never an elevated role — and `Tenant` carried no read policy, so the app could not
read its own settings at all. The two decisions were incompatible as written.

**The assertion that broke was over-specified.** It read:

> `Tenant` is outside tenant RLS and unreachable even from a tenant-scoped connection

What issue 01 actually needed was **not enumerable, and not cross-readable** — a tenant must never
discover that other tenants exist, or read one. "Unreachable" is a stronger claim than that, and it
is the extra strength that collided.

**Own-row-only preserves the property that matters.** A connection can see exactly the tenant it is
already scoped to, whose id it necessarily already had in order to open the scope. There is nothing
to discover: no enumeration, no cross-tenant read, no id disclosure. The `WITH CHECK` on `UPDATE`
means a scoped connection cannot even rewrite its own row's `id` to point at another tenant.

**And this shape is not new.** Record 029 already put a policy on `Tenant` with **exactly this
predicate**, for `INSERT`:

```sql
CREATE POLICY "tenant_provision_insert" ON "Tenant"
  FOR INSERT WITH CHECK ("id" = current_setting('app.tenant_id', true));
```

So the question was never "may `Tenant` carry a policy" — that was answered in the affirmative two
issues ago. It was only ever "may it carry a *read* one", and the same reasoning applies.

## The ranked options

| # | Option | Why not |
|---|---|---|
| **1** | **Own-row `SELECT` + `UPDATE` policy; amend the assertion** | **chosen** |
| 2 | Move the settings to a `TenantSettings` table | Keeps `Tenant` genuinely unreachable, but costs a join on every read, a second row that must be created with every Tenant — **a missing one is a new failure mode** — and its own policies. It also turns issue 07's criterion 1, "a freshly provisioned Tenant has these defaults", from an assertion about **database defaults** into one about seeded rows, which is a weaker guarantee. The human considered and rejected this shape when choosing record 046. |
| 3 | Read the settings through a `SECURITY DEFINER` function | Preserves the invariant verbatim, but record 031 reserved `SECURITY DEFINER` for a **third pre-auth lookup**, and this is an ordinary authenticated read. It brings the heavier mechanism to the lighter problem, and a function body that bypasses RLS is harder to review than a two-line policy. |

## What the amended assertion must prove

Replacing the old zero-rows check. **Do not simply delete it** — it becomes stronger, not weaker:

1. A tenant-scoped connection reading `Tenant` returns **exactly one row, its own**.
2. **Another tenant's row is invisible**, including when addressed directly by id — the same
   discipline every other probe in this repo follows: the row must be proven to exist and be
   readable elsewhere, then proven invisible here.
3. A connection with **no tenant scope set** still reads **zero** rows.
4. `deanpos_app` still holds **no `DELETE`** on `Tenant`, and an `UPDATE` cannot move a row to
   another tenant (the `WITH CHECK`).

Points 3 and 4 are the ones a careless amendment drops.

## How to turn it back

Drop the two policies and `REVOKE UPDATE ON "Tenant" FROM "deanpos_app"`, then move the five
settings to their own table. That is an additive table plus a **backfill**, and a backfill needs
human escalation under `.orc2/ORCHESTRATOR.md`. Cheap today, when no tenant has meaningful settings;
it gets more expensive with every real tenant.

**The reversal cost rises the moment a real deployment exists**, not gradually.

## What should make you reverse this

- **Any need for a tenant-scoped connection to read a `Tenant` row that is not its own.** That
  demand means the model has changed, and the answer is a separate table rather than a wider policy
   — widening this predicate is how enumeration comes back.
- **A second reason to grant `UPDATE` on `Tenant`** beyond these five settings. One narrow reason is
  a policy; two unrelated reasons mean `Tenant` has quietly become a mutable general-purpose row,
  and the settings should move out.
- **`Tenant` gaining a column that is platform-owned rather than tenant-owned** — a billing plan, a
  suspension flag, a trial expiry. Own-row `UPDATE` would let a tenant rewrite it. If that column
  arrives, this policy must become column-scoped or the settings must move.
