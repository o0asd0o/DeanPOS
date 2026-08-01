# 03 — Data layer and the lane database

**Status:** done

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

### Implementer notes (2026-08-01)

Implemented on branch `foundation-03-data-layer`, commit `c2b327b`.

- Versions landed: `kysely@^0.28.2`, `pg@8.22.0` (exact, per
  `.scratch/decisions/004-postgres-driver.md`), `prisma@^6.3.0`,
  `prisma-kysely@^1.8.0` — matching the ApxDenta floor named in this issue's
  brief.
- `createDb({ databaseUrl }): Kysely<DB>` in `packages/backend/src/db/client.ts`
  is the only place `pg`, `Pool`, or `Kysely` is constructed anywhere in the
  repo. Grep proof: `grep -rn 'from "pg"' --include="*.ts" .` (excluding
  `node_modules`) returns exactly one hit, `client.ts`. Same for
  `grep -rn "new Pool(" ...` and `grep -rn "new Kysely" ...`.
- `prisma-kysely` output lands at `packages/backend/src/db/prisma/generated/`
  (matched by `**/generated/**`, gitignored, not committed) and regenerates
  from a clean checkout via `vp exec prisma generate` alone — verified by
  deleting the directory and regenerating it.
- Demonstrated the dropped-column criterion: changed `get-ping.query.ts` to
  select a non-existent `not_a_real_column`, ran `vp check`, got
  `TS2769: No overload matches this call` pointing at the `.select([...])`
  call — a compile-time failure, not a runtime one — then reverted.
- `vp exec` and `vp test` do not read the workspace-root `.env` themselves
  (`vp exec` never loads it; `vp test` runs each package with that package's
  directory as `cwd`, and Bun's own `.env` autoload only checks `cwd`). Added
  `vitest.setup.ts` (workspace root, wired via `vite.config.ts`'s
  `test.setupFiles`) that reads the root `.env` with `node:fs` and fills in
  `process.env` for whichever keys aren't already set. No new dependency —
  this is the shared point every package's test run goes through, so it was
  fixed there once rather than per-package.
- `docker compose up` needed one fix beyond the ApxDenta-style default: the
  `postgres:18` image refuses to start against a volume mounted at
  `/var/lib/postgresql/data` (it wants `/var/lib/postgresql` since 18, so it
  can lay out `pg_ctlcluster`-style version directories underneath). Mounted
  the volume at `/var/lib/postgresql` instead. Verified end to end with
  `docker compose -p deanpos-verify -f docker-compose.yml up -d`, waited for
  the healthcheck to report `healthy`, ran `pg_isready` inside the container,
  then `down -v`. It bound host port 5432 as `0.0.0.0:5432` without
  colliding with the locally-running Postgres 18.3 (which listens on
  `127.0.0.1:5432` only) — the lane database was unaffected, verified by
  reading the seeded `Ping` row through `psql` before and after.
- No extra database was created. The provisioned lane database
  (`DeanPOS_lane_foundation_03_data_layer`) was migrated, read, and left in
  place; the only other Postgres instance touched was the throwaway Docker
  Compose verification above (`deanpos-verify`, already torn down with
  `down -v`, nothing left running).
- Ran `/code-review` (Standards + Spec axes, both against `main`): both came
  back with zero findings.
- Noticed but did not fold in: the deprecation warning Prisma prints on every
  invocation (`package.json#prisma` config is deprecated in favour of a
  `prisma.config.ts` file, removed in Prisma 7). Cosmetic only, doesn't affect
  the gate; not part of this issue's scope to migrate config formats.

### Fixer notes (2026-08-02)

Applied `.scratch/decisions/005-prisma-command-scope-and-env.md` verbatim: root
`package.json` gained `codegen`/`migrate`/`migrate:status`/`prepare` scripts,
`.orc2/config.env`'s three command settings and the four matching strings in
`.orc2/ORCHESTRATOR.md` now point at `vp run -w ...`, and
`docs/adr/0004-prisma-schema-kysely-runtime.md` carries the amendment. Ran the
record's acceptance test from a clean clone: `vp install` did fire the root
`prepare` hook and left `packages/backend/src/db/prisma/generated/types.ts` in
place, so `ORC2_GATE` was left as specified — the fallback was not needed.

Also applied three minor review findings: `.env.example` now names
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` (values still blank)
alongside the decision's own comment and `DATABASE_URI`; `.gitignore`'s
generated-output comment now names `vp run -w codegen` instead of
`bunx prisma generate`. The third minor (the migration-comment nit) was left
alone per the reviewer's own verdict that it's optional.

---

**Closed by the pipeline.** One review round used. Reviewer verdict was REVISE in round 0 on a
**blocking** finding, then PASS on both axes after round 1. Gate green cold in the lane
worktree after the rebase, and again on `main` after the fast-forward. Merged to `main` at
`3e97d2a`. Lane database `DeanPOS_lane_foundation_03_data_layer` dropped at close; no `_test`
sibling was created.

**The blocking finding, and why it mattered.** `vp exec prisma generate` — the command
`.orc2/config.env` and ADR-0004 both declared, and the one the orchestrator runs at the
repository root after every merge — did not work there. `prisma` is declared only in
`packages/backend`, so Bun links its binary only into that workspace. Because the generated
Kysely types are gitignored and `client.ts` imports them, a fresh clone plus `vp install`
did not reach a green gate and `main` would have gone red after any merge touching the
schema. The lane's own gate was green only because the implementer's local `generated/`
directory still existed on disk.

That was a contradiction between three binding documents — `config.env`/ADR-0004,
`ORCHESTRATOR.md`'s merge procedure, and this issue's "everything lives inside
`packages/backend`" — so it went to the `decider` rather than to a fixer.

**Decisions made during this issue, both binding on later areas:**

- `.scratch/decisions/004-postgres-driver.md` — **Stakes: high.** `pg@8.22.0` with Kysely's
  built-in `PostgresDialect`, `packages/backend` only, no catalog pin, no dialect package,
  no `pg-native`. Adopts the sibling project ApxDenta, which runs `pg` on Bun in production.
  Carries a forward warning for area 2: the tenant variable must be set with
  `set_config('app.tenant_id', $1, true)` — transaction-local — because a bare `SET`
  persists on the pooled connection after release and hands the next request another
  tenant's identity.
- `.scratch/decisions/005-prisma-command-scope-and-env.md` — **Stakes: high.** Resolves the
  contradiction above. The three `ORC2_*` commands become root `package.json` scripts
  (`vp run -w codegen|migrate|migrate:status`), each scoping into the workspace with
  `vp exec -F backend`; the migrate scripts source the root `.env` themselves, because
  Prisma searches for `.env` in the working directory, the schema's directory, and
  `./prisma/` only — it never walks up to a monorepo root. A root `prepare` hook makes
  `vp install` alone regenerate the types. ADR-0008's layout and record 004 survive
  untouched. ADR-0004 carries an amendment line pointing at the record.

**Verified independently, not taken on report:** a genuinely fresh `git clone` with no
`.env`, then `vp install` alone, now fires `prepare`, regenerates
`packages/backend/src/db/prisma/generated/types.ts`, and passes `vp check` and
`vp run -r check`. `vp run -r test` still fails there — the DB-backed test needs a
provisioned database, which a bare clone has neither `.env` nor PostgreSQL for.

The reviewer ruled that is **not** a defect of this issue: the PRD's "clean checkout plus
`vp install` reaches a green gate with no manual step" clause sits inside the Vite+ licence
paragraph and is about the toolchain holding no token, which is now satisfied; a running
PostgreSQL is environment the PRD contemplates separately in stories 46 and 47. The failure
is also loud rather than silent, which is the correct behaviour — a test that skipped itself
when `DATABASE_URI` was absent would hide a real gate gap.

**Obligation carried forward to issue 08:** stories 46 and 47 must document the database
prerequisite and the one-command start — copy `.env.example`, set `DATABASE_URI`,
`docker compose up`, then the gate — so the clean-clone-to-green path is closed there
rather than going quiet.
