# 027: The app role's password is a development default with a deployment override, and RLS was never the boundary it was claimed to be

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** `.scratch/tenancy-identity/issues/01-tenant-isolation-spine.md` (the "Assumption flagged, not settled by the issue" note, lines 143–149), routed by the orchestrator

## The question

The application connects to PostgreSQL as a restricted role, `deanpos_app`. That role
needs a password. Right now the password is a fixed word written into a tracked
database migration, which means it is in version control, it runs in every
environment including a future production one, and migrations are append-only by
convention so it is awkward to change.

Where should that password actually come from — for a pipeline lane, for a developer's
own machine, and for a real deployment?

A wrong answer costs one of two things. Too little: a multi-tenant point-of-sale ships
with a publicly-known database password and no way to change it without editing an
already-applied migration. Too much: a secret-management mechanism gets built for a
deployment that does not exist yet, and every lane and every clean clone pays for it
daily.

## What I chose, and why

**The password stays exactly where it is, and gets relabelled as what it actually is:
a development default, the peer of the `deanpos`/`deanpos` owner password that
`docker-compose.yml` has carried since issue 03. A deployment overrides it with one
standard SQL command and one environment variable. The migration's SQL is not touched.
Three small changes land now; a secret store is not one of them, and is not mine to
choose.**

Four things carry this.

### 1. The security claim in the shipped comment is backwards, and that is the real defect

The migration and `.env.example` both say, in writing, that the password is
"non-secret" because "RLS FORCED is the real boundary, not this credential."

That is false, and it is the most important finding in this record, because it is a
security claim sitting in two tracked files where issues 02 and 03 will read it.

Row-Level Security decides which rows a connection sees by comparing each row's
`tenantId` against the session setting `app.tenant_id`. Setting that value is not a
privileged operation — it is precisely what `withTenantScope` in
`packages/backend/src/db/client.ts` does, on every request, as `deanpos_app`, a role
that is neither superuser nor owner. The implementer verified this against a live
database: with the tenant set, the app role sees that tenant's Store; with it unset, it
sees nothing. The whole feature depends on the app role being able to set that value
freely.

Which means anyone holding the `deanpos_app` password can set it too, to any tenant id
they like, one after another, and read every tenant in the database. PostgreSQL's own
documentation describes `FORCE ROW LEVEL SECURITY` only in terms of the table *owner*:
"a table owner can choose to be subject to row security with `ALTER TABLE ... FORCE ROW
LEVEL SECURITY`". Nothing in it claims RLS defends against a legitimate credential.

So the correct statement, and the one that replaces the false one:

> **RLS `FORCE` stops the application's own SQL from crossing tenants. It does not stop
> whoever holds the application's credential. Against an outsider, the credential *is*
> the boundary.**

That inversion is why this question could not just be waved through. It does not,
however, mean the fixed password must go today — it means it must stop being described
as harmless, and it must acquire a way to be changed.

### 2. The actual defect is not secrecy, it is that nothing can override it

`docker-compose.yml` already ships `deanpos`/`deanpos` for the *owner* role. Nobody has
called that a leak, and rightly: it is written `${POSTGRES_PASSWORD:-deanpos}`, so an
operator who sets one name in `.env` replaces it, with no code change and no tracked
file edited.

The app role has no such lever. `docker-compose.yml` line 36 reads
`postgresql://deanpos_app:deanpos_app@postgres:5432/...` with no substitution at all, so
the only way to change it in a deployment is to edit a tracked file, and the only way to
change it in the database is a new migration — which would put the *new* password in git
too. The shape is self-perpetuating.

That asymmetry is the whole defect and it costs one line to remove:

```yaml
APP_DATABASE_URI: postgresql://deanpos_app:${APP_DATABASE_PASSWORD:-deanpos_app}@postgres:5432/${POSTGRES_DB:-DeanPOS_dev}
```

exactly mirroring `${POSTGRES_PASSWORD:-deanpos}` one service above. Record 011's no-go
list already says "no secret in `docker-compose.yml`" and treats the substituted default
as compliant; this brings the app role's line into the shape that record already
established rather than contradicting it.

**Deliberately not made overridable: the whole URI.** `${APP_DATABASE_URI:-...}` would
let the host's value — which points at `localhost` — leak into the container, which
would then dial itself. Record 011 named that trap by name and derived the container's
database URL from parts for exactly this reason. Only the password part is
host-independent, so only the password part is a variable.

### 3. Keeping role creation in the migration is right, and `IF NOT EXISTS` already
makes the alternative reachable later

A PostgreSQL role is a cluster-level object — "roles are defined at the database cluster
level, and so are valid in all databases in the cluster" — while a migration is scoped
to one database. That mismatch is a real argument for provisioning the role somewhere
else.

It loses on where the hooks are. Follow the three paths this question names:

- **A lane.** `.orc2/ORCHESTRATOR.md` provisions a lane with exactly two commands —
  `createdb` and a copy of the root `.env` with the database name rewritten. There is no
  other step. Moving role creation out of the migration means adding one to a tracked
  pipeline document that every future lane depends on, and its failure mode is a
  migration aborting mid-file with `role "deanpos_app" does not exist`.
- **A developer's machine.** `scripts/stack.sh`, and the same argument.
- **A deployment.** Record 011 runs `vp run -w migrate` from the host. Same argument
  again.

Three new call sites, to remove a credential from a database that record 011's own
production shape does not publish a port for, in a project with no deployment. That is
rung 1 of the ladder answering "not yet".

And the incumbent already bought the option cheaply. The migration wraps creation in
`IF NOT EXISTS`, so **the day a provisioning script does create the role first, with a
real password, this migration's `CREATE ROLE` becomes a no-op and the applied file never
needs editing.** The grants and the RLS around it are database-scoped and stay where they
belong. That is not luck exploited after the fact — it is the property that makes the
reversibility score below a structural 5 rather than an optimistic one.

Two facts that would otherwise be discovered the hard way, both checked: Prisma
documents **no variable substitution of any kind inside a `migration.sql` file**, so
"parameterise the password in the migration" is not an option that exists; and
PostgreSQL's `CREATE ROLE` page cautions that a plaintext `PASSWORD` literal "might also
be logged in the client's command history or the server log". Together those are why the
no-go below is absolute: a real password never goes in a migration, in this one or a
later one.

### 4. The lane half of the acceptance criterion is not met today, and that is blocking

Issue 01's criterion is that provisioning is "written down where **a lane and a
deployment** both read it". The deployment half is met — `docker-compose.yml` carries it.
The lane half is not:

- `scripts/stack.sh` writes `.env` from a fixed heredoc, and that heredoc has no
  `APP_DATABASE_URI` line. A clean clone therefore runs `vp run -w stack`, gets an
  `.env` without it, and `requireEnv("APP_DATABASE_URI")` throws — the gate goes red on
  the path record 011 exists to keep green.
- The orchestrator provisions a lane by copying the *human's* root `.env`, which
  `stack.sh` will never update because its write block only fires when the file is
  absent. The implementer got a green gate by hand-editing their own lane's `.env`, and
  said so. **The next lane goes red.**

The fix is already in the file. Record 012 hit this precise problem with `VITE_API_URL`
and `stack.sh` carries the answer — a `grep -q '^NAME='` guard that appends the missing
key to an existing `.env`. Copying that three-line block is rung 2 of the ladder, not a
new mechanism, and the sed in ORCHESTRATOR.md then needs no change at all: it rewrites
any line ending `/DeanPOS_dev`, so a lane's `APP_DATABASE_URI` follows its
`DATABASE_URI` onto the lane database automatically.

### What I am refusing, and why

**Choosing a secret store or manager is not mine.** It costs money or an account, it
needs the human's authorisation, and nothing in this project can exercise it yet. When
there is a deployment, that question goes to the human with the two candidates area 10
prefers. Nothing here forecloses it — an operator who has one simply feeds
`APP_DATABASE_PASSWORD` from it.

**Nothing here touches a real deployment,** and no criterion is ticked that would need
one.

### Weights used for the ranking

Declared before any option was written down, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Every option ends in the same place for a user: a deployment with a real password. They differ in the path there and what it costs, not in the destination. |
| Business impact | ×1 | Same reason, and every option is free. The trust consequence is real but it is downstream of the engineering question, not independent of it. |
| Engineering cost and risk | ×2 | This is where all three of the things that actually separate the options land: whether a clean clone and the next lane still gate green, whether a new provisioning mechanism is added before there is anything to deploy, and whether a false security claim is left in a tracked file. |
| Reversibility | ×2 | The artefact is an append-only migration. The question was routed here explicitly because of that, so it is scored explicitly. |
| Evidence strength | ×2 | The whole argument turns on what RLS `FORCE` does and does not protect against, and on whether Prisma can parameterise migration SQL. Both had to be checked against primary sources, and one of them came back without a clean answer (below). |

Maximum possible total: 40. Same shape as records 007, 008 and 011.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Development default in the migration + a deployment override lever; correct the false comments; close the lane gap** | 4 | 4 | 5 (10) | 5 (10) | 4 (8) | **36** |
| 2 | Move role creation into a separate provisioning script, password from the environment everywhere | 4 | 5 | 2 (4) | 3 (6) | 4 (8) | **27** |
| 3 | Migration creates the role with no password; every environment sets one before first use | 3 | 5 | 1 (2) | 3 (6) | 3 (6) | **23** |
| 4 | Do nothing — carry the whole question to `release-ops` | 1 | 1 | 2 (4) | 5 (10) | 2 (4) | **20** |

**1 — Development default plus an override lever, chosen.** Keeps the SQL untouched,
which means nothing to unwind; gives a deployment the same one-variable lever the owner
role has had since issue 03; deletes a false security claim from two tracked files; and
closes the lane gap with a block the repository already contains. It scores 5 on
engineering cost because it is the only option whose lane and clean-clone paths get
*shorter* rather than longer, and 5 on reversibility because `IF NOT EXISTS` means
option 2 remains reachable later without editing an applied migration. Evidence is 4,
not 5, for the one source that came back empty (below).

**2 — A separate provisioning script.** The right answer eventually, and the option to
move to. It is the only one that puts no credential in git at all, which is why it wins
business impact outright at 5. It loses on where the hooks are: three call sites to add
(`scripts/stack.sh`, `.orc2/ORCHESTRATOR.md`'s lane block, and area 10's deploy), a
migration that now carries an out-of-band precondition, and a failure mode — a migration
aborting on a missing role — that reads as a code error to an unattended pipeline when it
is a provisioning error. Reversibility 3 rather than 5 because unwinding it means
re-editing all three call sites and re-checking every lane, not reverting one commit.
Every one of those costs is worth paying the day there is a server; none of them is worth
paying today. **Named trigger: the first real deployment, i.e. the moment area 10 opens.**

**3 — Create the role with no password at all.** Honest about the credential problem and
worse at everything else. `CREATE ROLE deanpos_app LOGIN` with no password cannot
authenticate over TCP, so a clean clone gates red until somebody remembers an extra
command — which is the exact failure record 005 was written to eliminate and record 011
was written to keep eliminated. It buys nothing over option 2 and costs the developer
experience on top.

**4 — Do nothing.** Included because it must be, and **10 of its 20 points are
reversibility**, which any do-nothing option maximises trivially — the same inflation
records 002, 007, 008, 011 and 015 each left visible rather than tuning away. It fails on
two facts rather than on principle. It scores 2 on engineering cost, not 5, because doing
nothing is not free here: `stack.sh` today produces an `.env` that makes a clean clone and
the next lane both go red, and that is a defect issue 01 introduced. And it scores 2 on
evidence because the position it preserves rests on a claim — "RLS FORCED is the real
boundary, not this credential" — that is demonstrably false and would be read as guidance
by issues 02 and 03.

**Is it close?** No. Options 1 and 2 differ by nine points and every one of them comes
from the two ×2 criteria; the gap is real, not an artefact of the weights. What *is*
close to a coin-flip is a smaller question inside option 1: whether
`APP_DATABASE_PASSWORD` is worth adding now at all, or whether documenting "edit the
compose line" would do. It goes in because it is one line, because it makes the file
internally consistent with the owner role directly above it, and because the alternative
asks a deployment to edit a tracked file to hold a credential.

## What issue 01 must change before it merges

Five edits, four files. All of them are safe *now* and get expensive later, because this
migration is committed on a branch and has been applied only to the lane's throwaway
database — nothing on `main` and nothing in `DeanPOS_dev` has it. Prisma "warns if any
migrations have been modified since they were applied", so **after merge, this file's
bytes are frozen.** Do it in this lane.

**1. `scripts/stack.sh` — two additions, both copying the existing `VITE_API_URL`
pattern verbatim.** This is the blocking one: without it, a clean clone and the next lane
both gate red.

Inside the heredoc, directly under the `DATABASE_URI=` line:

```
APP_DATABASE_URI=postgresql://deanpos_app:deanpos_app@localhost:5433/DeanPOS_dev
```

And immediately after the existing `VITE_API_URL` guard block:

```sh
# .scratch/decisions/027 — an .env written before this name existed never gains it.
if ! grep -q '^APP_DATABASE_URI=' .env; then
  echo "APP_DATABASE_URI=postgresql://deanpos_app:deanpos_app@localhost:5433/DeanPOS_dev" >> .env
  echo "Added APP_DATABASE_URI to existing .env."
fi
```

Host and port match the `DATABASE_URI` line above it deliberately — the two must agree,
and whether 5433 is the right port for a lane is a pre-existing question this record does
not reopen. The line must end `/DeanPOS_dev` so ORCHESTRATOR.md's `sed` moves it onto the
lane database along with `DATABASE_URI`. **`.orc2/ORCHESTRATOR.md` needs no change.**

**2. `docker-compose.yml` line 36 — the password becomes a variable:**

```yaml
APP_DATABASE_URI: postgresql://deanpos_app:${APP_DATABASE_PASSWORD:-deanpos_app}@postgres:5432/${POSTGRES_DB:-DeanPOS_dev}
```

Nothing else on that service changes. Its five-line comment block (lines 31–35) is over
the repository's three-line ceiling and should be cut to one line pointing here.

**3. `.env.example` — one new name, and the existing comment corrected.** The
`APP_DATABASE_URI` comment currently asserts "(fixed, non-secret — RLS FORCED is the real
boundary)". Delete that clause; it is the false claim. Add:

```
# The deanpos_app role's password. Overrides the development default in
# docker-compose.yml. Set it in a deployment, together with a one-off
# `ALTER ROLE deanpos_app PASSWORD '<value>';` against the database.
APP_DATABASE_PASSWORD=
```

Record 005's constraint applies to this value and is not optional: the root `migrate`,
`migrate:status` and `dev` scripts source `.env` through a shell, so **the password may
contain no space, `&` or `?`.**

**4. `packages/backend/src/db/prisma/migrations/20260802065946_tenant_isolation_spine/migration.sql`
— comments only, no SQL.** Lines 27–31 become three lines within the ceiling:

```sql
-- The application role: not superuser, not the owner of any tenant-owned table.
-- The password is a development default, overridden per deployment out of band —
-- never in a migration. See .scratch/decisions/027-the-app-role-credential.md.
```

While in the file: the RLS block (lines 50–54) and the `Tenant` block (lines 61–66) are
also over the three-line ceiling in `docs/agents/code-standards.md` §5. Cut them to one
line each pointing at the issue. A reviewer will raise it otherwise, and the file is
frozen after merge.

**5. `.scratch/tenancy-identity/issues/01-tenant-isolation-spine.md`** — replace the
"Assumption flagged" paragraph (lines 143–149) with one line linking this record.

**Nothing else changes.** Not `apps/api/src/env.ts`, not `client.ts`, not the schema, not
a test, not `.orc2/`.

### The one thing a human does, once

The human's own root `.env` predates `APP_DATABASE_URI` and the orchestrator copies it
into every lane. Running `vp run -w stack` after change 1 lands adds the line
idempotently; that is the whole action. It is named here because until it happens, every
new lane gates red for a reason that reads as a code failure.

### No-gos

- **No password, other than the development default already there, ever goes into a
  migration** — not this one, not a later `ALTER ROLE` one. PostgreSQL's own `CREATE
  ROLE` documentation warns a literal "might also be logged in the client's command
  history or the server log", and a migration file is in git forever.
- **No `${APP_DATABASE_URI:-...}` in `docker-compose.yml`.** Only the password part is
  host-independent; the whole URI is the trap record 011 named.
- **No secret store, manager, or provider chosen here.** Refused, routed to the human at
  the point there is a deployment.
- **The `postgres` service's published port does not exist in production.** Record 011
  already says area 10 removes `5433:5432` there. With the app credential now correctly
  understood as a boundary, that instruction is load-bearing rather than tidy.
- **No claim anywhere in the repository that RLS protects against a compromised
  credential.** It protects against the application's own SQL.

## How to turn it back

**Reversing this record.** One commit, four files, no SQL and no migration involved:

1. Write a superseding record; flip this one's `Status:` to `overturned` with the date
   and reason; update both lines in `LOG.md`.
2. Restore `docker-compose.yml` line 36 to the literal, remove `APP_DATABASE_PASSWORD`
   from `.env.example`, remove the two `stack.sh` additions, restore the comment blocks.

The number that bounds this, and the one to re-check before quoting it:
`rg -n 'APP_DATABASE_PASSWORD|APP_DATABASE_URI' --glob '!node_modules'` returns
`.env.example`, `docker-compose.yml`, `scripts/stack.sh`, `apps/api/src/env.ts`, the
migration's comment, and this record. **Six files, and only one of them is code.** Note
that reverting change 1 returns the repository to a state where a clean clone does *not*
gate green — do not revert it without replacing the mechanism.

**Moving to option 2 later, which is the likelier direction.** Additive, and — this is
the point — **it does not edit the applied migration**:

1. Add `scripts/provision-role.sh` taking the password from the environment, running
   `CREATE ROLE` (or `ALTER ROLE` if it exists).
2. Call it from `scripts/stack.sh` before `vp run -w migrate`, from
   `.orc2/ORCHESTRATOR.md`'s lane block after `createdb`, and from area 10's deploy.
3. The migration's `IF NOT EXISTS` then makes its own `CREATE ROLE` a no-op in every
   environment, permanently and silently. The grants and the RLS around it are
   database-scoped and stay exactly as they are.

**What has been built on top of this by then.** Only `apps/api/src/env.ts`'s
`APP_DATABASE_URI` key, which neither reversal touches, and whatever area 10's deploy
script does — which does not exist yet, and which this record is an input to rather than
a constraint on.

## What would make this decision wrong

- **A deployment happens with `APP_DATABASE_PASSWORD` unset.** Then a
  publicly-known password is live on a real database, and the lever this record added
  bought nothing. **This is the failure to watch for.** Area 10's deploy script must
  refuse to run without it, exactly as it must for `POSTGRES_PASSWORD` — the two are now
  the same class of value and there is no longer a reason to treat them differently.
- **PostgreSQL's port is published on a public interface in production.** Today's
  `docker-compose.yml` publishes `5433:5432`. Locally that is right. On a server it turns
  the app credential into an internet-facing one.
- **A migrating role without `CREATEROLE` or superuser is used.** PostgreSQL requires one
  of them for `CREATE ROLE`; the migration aborts. Locally the developer owns their
  cluster and the container's `POSTGRES_USER` is superuser, so this only bites a
  deployment that hardens the migration path. Not a reason to reverse — a reason to
  provision the role first, which is option 2.
- **A developer's cluster already holds a `deanpos_app` role with a different password.**
  `IF NOT EXISTS` silently skips creation and every lane on that cluster fails to
  authenticate, with an error that names neither cause. Known ceiling, accepted; the fix
  is one `ALTER ROLE`.
- **Someone reads the migration and adds an `ALTER ROLE ... PASSWORD '<real>'` migration
  to "rotate" it.** That is the append-only trap closing, and it is a no-go above.
- **A later area needs per-tenant or per-service database roles.** Then the single shared
  cluster-wide role is the wrong shape and this whole record is superseded rather than
  amended.

## Evidence

**Repository, read 2026-08-02**, all in the lane worktree
`/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS/.worktrees/ti01-tenant-isolation-spine`
unless noted:

- `packages/backend/src/db/prisma/migrations/20260802065946_tenant_isolation_spine/migration.sql`
  — line 35 `CREATE ROLE "deanpos_app" LOGIN PASSWORD 'deanpos_app';` inside an
  `IF NOT EXISTS` guard (lines 32–38); the grants at 42–48; `ENABLE`/`FORCE ROW LEVEL
  SECURITY` on `Store` and `Tenant`; and the comment at 27–31 carrying the claim this
  record refutes.
- **`packages/backend/src/db/client.ts`** — `withTenantScope` issuing
  `select set_config('app.tenant_id', ${tenantId}, true)` as the app role. **This is the
  file that makes "RLS is not a boundary against the credential" a fact about the running
  system rather than an inference:** the application's own read path depends on an
  unprivileged role being able to set that value to whatever it likes.
- `docker-compose.yml` — line 36's unsubstituted `deanpos_app:deanpos_app`, against
  lines 6–8's `${POSTGRES_USER:-deanpos}` / `${POSTGRES_PASSWORD:-deanpos}` on the
  service directly above it. The asymmetry the decision removes.
- **`scripts/stack.sh`** — the `if [ ! -f .env ]` heredoc, which contains no
  `APP_DATABASE_URI`, and the `if ! grep -q '^VITE_API_URL='` append block from record
  012, which is the pattern change 1 copies. Together these are the proof that the lane
  half of issue 01's criterion is unmet.
- **`.orc2/ORCHESTRATOR.md` lines 79–91** — lane provisioning is `createdb` plus
  `cp .env` plus `sed -i '' "s|/DeanPOS_dev\$|/DeanPOS_lane_$DB_SLUG|"`. Two facts read
  off this: there is no third hook to hang role provisioning on, and the `sed` is generic
  enough that a correctly-formed `APP_DATABASE_URI` needs no change to it.
- `apps/api/src/env.ts` — `databaseUrl: "APP_DATABASE_URI"` through `requireEnv`, which
  is what throws when the name is absent.
- `vitest.setup.ts` — reads the workspace-root `.env` into `process.env`, first value
  wins. This is why the lane's `.env` is what the gate actually depends on.
- `packages/backend/prisma.config.ts` — `datasource: { url: process.env.DATABASE_URI ?? "" }`,
  and **no shadow-database URL configured**. The pipeline runs `migrate deploy`, which
  does not use one.
- `.env.example` lines 6–12 — the `APP_DATABASE_URI` comment carrying the false claim.
- `docs/agents/code-standards.md` §5 lines 82–85 — "**Hard ceiling: three lines.** No
  comment in this repository may exceed three lines, and no file may carry a
  multi-paragraph block comment."
- `.scratch/tenancy-identity/issues/01-tenant-isolation-spine.md` — the acceptance
  criterion at line 43–44, and the implementer's flagged assumption at 143–149 including
  "updated locally so the gate runs", which is what identifies the lane gap.
- **`.scratch/decisions/011-local-stack-and-versioned-deploy.md`** — the deploy shape;
  the derived-not-copied `DATABASE_URI` for the `api` container and its stated reason;
  the `${POSTGRES_USER:-deanpos}` defaults called non-secret; the no-go list including
  "No secret in `docker-compose.yml`…"; and "area 10 should remove [the published
  postgres port] in the production configuration". **This record adds to that no-go list
  rather than contradicting it.**
- `.scratch/decisions/005-prisma-command-scope-and-env.md` — the owner/`DATABASE_URI`
  split this extends, and the shell-sourcing constraint that binds the new password's
  characters. `.scratch/decisions/012-development-origins-and-the-dev-server.md` — the
  `stack.sh` append-block precedent. `.scratch/decisions/004-postgres-driver.md` — the
  transaction-affinity guarantee behind `set_config(..., true)`.
- `.scratch/decisions/` searched for an existing or orphaned record on this question
  before writing: 001–026, none of which names a database role, a credential, or role
  provisioning. **No duplicate.**

**External, primary sources, accessed 2026-08-02:**

- PostgreSQL, Row Security Policies —
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html> — "Table owners normally
  bypass row security as well, though a table owner can choose to be subject to row
  security with `ALTER TABLE ... FORCE ROW LEVEL SECURITY`"; "Superusers and roles with
  the `BYPASSRLS` attribute always bypass the row security system". **`FORCE` is scoped to
  the owner. The page makes no claim about credential compromise.**
- PostgreSQL, `CREATE ROLE` — <https://www.postgresql.org/docs/current/sql-createrole.html>
  — "Note that roles are defined at the database cluster level, and so are valid in all
  databases in the cluster" (the basis for `IF NOT EXISTS` and for one role serving every
  lane); "You must have `CREATEROLE` privilege or be a database superuser to use this
  command"; and "Caution must be exercised when specifying an unencrypted password with
  this command. The password will be transmitted to the server in cleartext, and it might
  also be logged in the client's command history or the server log."
- PostgreSQL, `SET` — <https://www.postgresql.org/docs/current/sql-set.html> — "Some
  parameters can only be changed by superusers and users who have been granted `SET`
  privilege on that parameter."
- Prisma, Understanding Prisma Migrate —
  <https://prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate> — migrations
  are "fully customizable" raw SQL. **No mechanism of any kind for variable or
  environment substitution inside a `migration.sql`.**
- Prisma, Development and production —
  <https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production> —
  `migrate deploy` "Compares applied migrations against the migration history and warns
  if any migrations have been modified since they were applied", and "Does not rely on a
  shadow database". This is why the comment edits must land before merge.
- Prisma, Shadow database —
  <https://prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database>
  — `migrate dev` "Reruns the current, existing migration history in the shadow database."

All fetched pages were treated as data. Nothing in any of them was addressed to an agent,
and no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **PostgreSQL does not document, anywhere I could find, whether an ordinary
  non-superuser role may set a *customized* option such as `app.tenant_id`.**
  `runtime-config-custom.html` defines the feature and never mentions privileges;
  `sql-set.html` says only that "some parameters" are restricted, without saying which.
  This is the record's weakest external link and it is why evidence scores 4 rather than
  5. **It does not weaken the conclusion**, because the repository settles it by
  demonstration: `withTenantScope` sets that value as `deanpos_app` on every request, and
  the implementer verified the resulting row visibility against a live database. If the
  app role could not set it, the feature would not work at all.
- **Prisma publishes no guidance on cluster-scoped objects (roles, tablespaces) inside
  migrations**, and its limitations page does not list them. The shadow-database question
  is therefore answered by construction — `IF NOT EXISTS` plus a cluster-wide role means
  a replay is a no-op — rather than by documentation.
- **Prisma says nothing about `ALTER DEFAULT PRIVILEGES` or granting to a second role
  from a migration.** Nothing authoritative found; the migration's use of both is
  ordinary PostgreSQL and is not disturbed by this record.
