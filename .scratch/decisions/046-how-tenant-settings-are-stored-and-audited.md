# 046 — How tenant settings are stored and audited

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** high — money and tax semantics, plus an audit trail that is a security control
- **Asked by:** the orchestrator, for issue 07
- **Decided by:** **the human, directly.** Not the decider. Four questions, four answers.
- **Governs:** issue 07, and the input contract `checkout`, `reporting` and `drawer-sessions` read

## What was already decided, and is not revisited here

Two ADRs settle more of this than it first appears, and neither is reopened:

- **ADR-0005:** all amounts are **integer centavos**; **floats are prohibited in every layer**.
  Intermediates are exact `Millicentavos` (centavos × 1000). Rounding happens once per stored
  figure, half-up.
- **ADR-0010:** the settings are named **`vatEnabled` (default `false`)** and
  **`vatRatePercent` (default `12`)**. A price is always what the customer pays — **VAT is never
  added at checkout, in any configuration**; when enabled, reports and receipts **back the rate out**
  of the recorded total. The rate and enablement in force **are captured on the Order**.

So the two centavo settings — variance tolerance and the cash-movement Override threshold — are
plain integer centavos with no further decision needed, and VAT is never an addition.

## The four decisions

### 1. `vatRatePercent` is an integer percent

`INT`, default `12`. Not basis points, not `DECIMAL`.

Philippine VAT has been a flat 12% since 2006 and no Philippine rate has ever carried a fractional
component. Basis points would make ADR-0010's literal `12` a derived number and add a divide-by-100
to every display site. `DECIMAL` would put a non-integer type into a money path ADR-0005 keeps
integer-only — and Kysely hands it back as a string that someone eventually parses into a float,
which is the exact failure ADR-0005 prohibits.

**The trade-off, stated:** a tenant registered at a fractional rate cannot be represented at all.
Widening later is an additive migration.

**What `checkout` inherits:** an integer percent and the back-it-out rule. Rounding remains
`checkout`'s, at its own named sites — this record adds no rounding site, because a rate is not an
amount.

### 2. The five settings are columns on `Tenant`

Not a settings table, not key-value rows.

`Store` already carries its own two settings as plain columns (`business_day_start`,
`table_labels`, issue 05); this follows that precedent rather than inventing a second shape two
issues later. **Defaults are enforced by the database**, so a freshly provisioned Tenant is correct
with no application code — which is exactly what criterion 1 asserts. A sixth setting is an additive
migration.

| Column | Type | Default |
|---|---|---|
| `timezone` | `TEXT` | `Asia/Manila` |
| `vat_enabled` | `BOOLEAN` | `false` |
| `vat_rate_percent` | `INT` | `12` |
| `variance_tolerance_centavos` | `INT` | `0` |
| `cash_movement_override_threshold_centavos` | `INT` | `0` |

Both centavo columns are **non-negative** — a negative tolerance or threshold has no meaning.
Enforce it with a `CHECK`, not with a comment.

### 3. The audit trail is a new append-only table, with text values

A tenant-owned `TenantSettingsAudit`, and it is append-only **structurally**, following issue 04's
pattern exactly:

- RLS **`ENABLED` + `FORCED`**, policies **in the same migration that creates the table**.
- **`FOR SELECT` and `FOR INSERT` policies only** — no `FOR ALL`. `UPDATE` and `DELETE` default-deny
  at the policy layer rather than relying on a grant a later migration could hand back.
- Plus `REVOKE UPDATE, DELETE` from `deanpos_app`. Belt, and the policies are the braces.
- **Composite `(tenant_id, …)` foreign keys.** Plain FK checks bypass RLS — that is how issue 04
  nearly shipped a cross-tenant write, and the same trap is live here.

**An audit trail that can be edited is not an audit trail.** That is the whole reason for the
structural treatment rather than a convention.

Old and new values are **text**, alongside the setting name. A reader knows the type from the
setting, and the five are scalars. `PlatformAuditLog` was not extended: it would mix platform-admin
actions with tenant actions under one policy, and platform rows must stay invisible to tenants —
one wrong policy there leaks across the most sensitive boundary in the product.

Each row names the **actor**, the **setting**, the **old value**, the **new value**, and **when**.
Criterion 5's dating requirement is satisfied by the row's own timestamp; no separate mechanism.

### 4. `manager` and `cashier` do not see the settings screen at all

No nav entry, and **the route itself refuses**. Read-only was the alternative and it loses: it still
discloses the VAT rate and both thresholds, and issue 07 calls these `admin`-only financial
controls. Server-side refusal is the enforcement; hiding the nav entry is presentation, never
enforcement.

## Three smaller calls, made by the orchestrator, flagged as reversible

These were not put to the human. They are the cheapest thing that satisfies the criteria, and each
is one line to change.

**Timezone is a `Select` over a short curated list, validated server-side against that same list.**
There are ~600 IANA zones, a picker dependency is refused (records 042 and 008 are the precedent),
and this is a Philippines-first product. The list is a shared constant so the client control and the
server validator cannot drift — **that shared-constant part is not optional**, because a client-only
list lets a direct API call put an obsolete or invalid zone into `reporting`.
**Reverse it when** a tenant needs a zone outside the list; the fix is to extend the constant.

**One form, one Save, for all five settings.** Record 040 already chose this shape for the Store
editor and it transfers. **But each changed setting writes its own audit row** — a save that changes
three settings writes three rows, not one. Criterion 4 is per-setting.

**Copy follows the mock and the established conventions.** No terminal full stop on short messages.
The VAT-off state needs one plain sentence explaining that prices already include what the customer
pays — most tenants below the ₱3,000,000 threshold are not registered, and a blank toggle invites
someone to switch it on to "enable" something.

## What must not be built

**Nothing may require reading a current setting to interpret a past sale.** The rule the whole
design rests on: *a setting governs sales made from now on, and the value in force is captured on
the sale.* Turning VAT on next March must not retroactively invent VAT in February. The issue's own
Comments carry the capture assertions forward to `checkout`, which owns the Order.

## How to turn it back

- **The rate type** — one column type change plus its schema line, before any Order captures a rate.
  After `checkout` ships, it is a data migration across every captured Order. **This is the decision
  whose reversal cost changes soonest.**
- **Columns to a table** — an additive table plus a backfill, and a backfill needs human escalation.
- **The audit table** — additive; dropping it is a non-additive migration.
- **The non-admin refusal** — one gate and one nav entry.

## What should make you reverse this

- **A Philippine VAT rate with a fractional component**, or DeanPOS moving to a market that has one.
  That is the named trigger for the integer percent, and the only one.
- **A tenant needing a timezone outside the curated list** — extend the constant; if the list grows
  past what a `Select` can carry, the control is the thing to revisit, not the storage.
- **A sixth, seventh and eighth setting arriving together.** Three at once is the signal that the
  column-per-setting shape has stopped paying, not one.
