# 03 — Data layer and the lane database

**Status:** ready-for-agent

## What to build

A PostgreSQL database that any lane can create from checked-in migrations, drop, and read
from through Kysely — with exactly one place in the codebase where a connection is opened.

**Everything here lives inside `packages/backend`, at the paths ADR-0008 fixes** —
`src/db/prisma/` for the schema, the migrations, and the generated types, and
`src/db/client.ts` for the connection factory. That layout is not open in this PRD.

`schema.prisma` is the source of truth (ADR-0004). Migrations are Prisma-generated SQL,
checked in, applied with `prisma migrate deploy` through the manager (`vp exec`). `prisma-kysely`
emits Kysely table interfaces into a `generated/` directory that review diffs exclude. Kysely
executes every runtime query; the Prisma client is not a runtime dependency of
`packages/backend`.

The first migration creates the single-row **ping** table that area 04 reads through. It has
no domain meaning and is expected to be deleted when a real slice replaces it.

**The connection factory is the deliverable, not the ping table.** One function, the only
place a connection is acquired. Area 2 adds the tenant session variable there and nowhere
else; if a second code path can obtain a connection, tenant isolation has no choke point and
that is a finding in this issue, not in area 2.

Postgres runs locally via Docker Compose — the database service only. The remaining services
and the reverse proxy are issue 08.

## Acceptance criteria

- [ ] `schema.prisma` is the only schema definition; the first migration creates the ping
      table and is committed as SQL.
- [ ] A lane can create its own database from the checked-in migrations and drop it, without
      touching another lane's state.
- [ ] `prisma-kysely` output lands under `generated/` and is matched by
      `ORC2_GENERATED_PATHS`; it is not hand-edited.
- [ ] A test reads the ping row through Kysely against a live lane database.
- [ ] A query naming a dropped or renamed column fails the gate rather than failing at runtime.
- [ ] Exactly one function opens a database connection — `createDb` in
      `packages/backend/src/db/client.ts`, per ADR-0008 — and it is documented as the tenant
      choke point for area 2. Grep proves there is no second path.
- [ ] `packages/backend` does not depend on the Prisma client at runtime.
- [ ] Docker Compose brings up PostgreSQL locally with no cloud credentials; connection
      details come from environment variables with a `.env.example` carrying names and no values.

## Depends on

- 01 — Monorepo skeleton and the gate

## Relevant files

- `packages/backend/src/db/prisma/**` — `schema.prisma`, migrations, and the `prisma-kysely`
  generated types (ADR-0008; the generated output is still matched by `**/generated/**`)
- `packages/backend/src/db/client.ts` — the single connection choke point
- `packages/backend/package.json`
- `docker-compose.yml` (database service only — issue 08 adds the rest)
- `.env.example`

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 21–27). `docker-compose.yml` is shared
with issue 08; the two must not run in parallel._
