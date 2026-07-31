# ADR-0002: Tenants share one database, isolated by `tenant_id` + Postgres RLS

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

DeanPOS is multi-tenant: one deployment serves many unrelated restaurants, with
public self-serve signup as the eventual goal. Tenant isolation is the highest-stakes
irreversible choice in the schema, because it cannot be changed once real sales exist.

## Decision

One database, one schema, one migration run. **Every tenant-owned row carries
`tenant_id`**, and **Postgres Row-Level Security is enabled on every such table**.
The request's tenant is set as a session variable in the connection; RLS policies
enforce scoping in the database.

## Consequences

- A forgotten `WHERE tenant_id = ...` becomes an empty result, not another
  restaurant's revenue. RLS is the safety net, the repository layer is the first line.
- **Every repository test must include a wrong-tenant probe.** A test that only proves
  "my tenant sees my data" proves nothing about isolation.
- Migrations run once. Per-tenant restore is not possible without a filtered export —
  accept it, or note it as a gap for the hardening PRD.
- The Kysely adapter must never open a connection without setting the tenant variable.
  That is a single choke point and it belongs in one place.

## Reversing it

Schema-per-tenant or database-per-tenant remains possible but requires a full data
migration plus a provisioning story. The cost is proportional to tenant count at the
time of the switch, not to code size.
