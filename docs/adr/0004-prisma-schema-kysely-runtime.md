# ADR-0004: Prisma owns schema and migrations; Kysely owns runtime queries

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

The engine is PostgreSQL (`.scratch/decisions/001-database-engine.md`). The
architecture is CQRS-lite (ADR-0008), so every query stays inside a db-operation and no
generated type leaks into a handler. The pipeline also needs a concrete migrate command
before it can isolate lane databases.

## Decision

- **Schema definition and migrations: Prisma.** `schema.prisma` is the source of truth;
  migrations are Prisma-generated SQL, checked in.
- **Types: `prisma-kysely`**, which emits Kysely table interfaces from the Prisma schema.
- **Runtime queries: Kysely.** The Prisma client is not used at runtime.

Pipeline commands:

```
ORC2_MIGRATE_CMD        bunx prisma migrate deploy
ORC2_MIGRATE_STATUS_CMD bunx prisma migrate status
ORC2_CODEGEN_CMD        bunx prisma generate
```

## Consequences

- Generated Kysely types are build output. They are regenerated, never hand-edited,
  and excluded from review diffs via `ORC2_GENERATED_PATHS`.
- A schema change is a two-step ritual: edit `schema.prisma`, then regenerate. A slice
  that edits one without the other fails the gate — which is the point.
- Prisma's RLS support is irrelevant here because Prisma is not in the query path;
  the tenant session variable is set by the Kysely connection layer (ADR-0002).
- Migrations are **forward-only, expand/contract** (ADR-0006). Prisma's `migrate dev`
  is a local-only tool; `migrate deploy` is what runs anywhere else.

## Reversing it

Dropping Prisma for a hand-rolled migration runner is contained — the runtime never
depended on it. Dropping Kysely for Prisma client is the expensive direction, because
every adapter query would be rewritten.
