# 029: A transaction may create exactly the Tenant it is already scoped to — an INSERT-only policy, no privilege escalation and no second session variable

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** `.scratch/tenancy-identity/issues/02-platform-admin-tenant-provisioning.md` ("Blocker 2" under `## Comments`), routed by the human

## The question

`Tenant` is the table every other table hangs off. Issue 01 shipped it locked: row-level
security on, no policy at all, which in PostgreSQL means "nobody but a superuser sees or
touches a row". Issue 01 then pinned that shut with a test.

But provisioning a restaurant means creating a `Tenant` row, and the application connects
as a deliberately unprivileged database role. So the one row the product exists to create
is the one row the database refuses to create.

How does that row get written, without handing the application a general way around the
isolation rules that protect every other table?

A wrong answer costs the whole area. Too little and provisioning cannot ship. Too much and
the escape hatch built here becomes the pattern eight later areas copy — at which point a
multi-tenant point-of-sale has a documented, blessed way for application code to step
outside tenant isolation, and the first mistake made through it is a restaurant reading
another restaurant's orders.

## What I chose, and why

**One line of SQL, in issue 02's own migration, and no change to any TypeScript file:**

```sql
CREATE POLICY "tenant_provision_insert" ON "Tenant"
  FOR INSERT WITH CHECK ("id" = current_setting('app.tenant_id', true));
```

In plain words: **a database transaction may create exactly the one Tenant it has already
declared itself to be working on, and may never read it back.** Nothing else about
`Tenant` changes — it stays unreadable, unchangeable and undeletable from the application,
exactly as issue 01 left it.

Four things carry this, and the first one is the whole decision.

### 1. `FOR INSERT` is not a narrower version of the policy that broke the test — it is a different thing

The implementer's reverted attempt was `CREATE POLICY ... USING (...)`. With no `FOR`
clause a policy defaults to `FOR ALL`, and PostgreSQL says of that case:

> "Additionally, `ALL` policies will be applied to both the selection side of a query and
> the modification side, using the `USING` expression for both cases if only a `USING`
> expression has been defined."

That is why it let an ordinary tenant read its own `Tenant` row, and why issue 01's locked
test went red. The fix is not to soften the condition. It is to stop writing a read rule at
all:

> "An `INSERT` policy cannot have a `USING` expression, as it only applies in cases where
> records are being added to the relation."

An `INSERT` policy is structurally incapable of making a row visible. There is no
expression in it that a `SELECT` ever evaluates. So for reads, `Tenant` still has *no
applicable policy*, and:

> "If row-level security is enabled for a table, but no applicable policies exist, a
> 'default deny' policy is assumed, so that no rows will be visible or updatable."

**Issue 01's locked test therefore passes unchanged, and not by luck or by a narrower
predicate — by the shape of the feature.** `packages/backend/tests/db/with-tenant-scope.test.ts`'s
`"Tenant is outside tenant RLS and unreachable even from a tenant-scoped connection"`
issues a `SELECT`, and nothing this record adds is on the `SELECT` path. Not one character
of that file changes, and the contradiction the issue warned might exist between issues 01
and 02 **does not exist**.

Two mechanical details that would have broken this if they had gone the other way, both
checked rather than assumed:

- **`insertTenant` does not use `RETURNING`.** `packages/backend/src/platform-admin/db-operations/commands/insert-tenant.command.ts`
  is `db.insertInto("Tenant").values(values).execute()` — no returning clause. That matters,
  because PostgreSQL says "If a data-modifying query has a `RETURNING` clause, `SELECT`
  permissions are required on the relation, and any newly inserted or updated rows … must
  satisfy the relation's `SELECT` policies". A `RETURNING` here would demand exactly the read
  policy this record refuses to add. **This is the sentence that turns a passing suite red
  the day someone adds `.returningAll()` to that command**, and it is written into the no-gos
  below.
- **The `User.tenant_id` foreign key to `Tenant` does not need to read `Tenant`.**
  "Referential integrity checks, such as unique or primary key constraints and foreign key
  references, always bypass row security to ensure that data integrity is maintained."

### 2. It costs nothing in TypeScript, because the handler already does the right thing

`packages/backend/src/platform-admin/handlers/provision-tenant.ts` already mints the new
tenant's id and opens `withTenantScope(ctx.db, tenantId, …)` on it. That was written to
avoid a second `set_config` call site, and it turns out to be the correct security shape as
well: the provisioning transaction runs **inside the new tenant's own scope**, which is the
narrowest scope that exists. It can write the new `Tenant`, that tenant's first `User` and
that tenant's audit row, and it can touch nothing else in the database — not another
tenant's rows, not another tenant's `Tenant` row, not its own on a second visit.

So:

- **`packages/backend/src/db/client.ts` gets a zero-line diff.** There is still exactly one
  code path that sets a database session variable, still transaction-local, still
  `set_config(..., true)`. `apps/api/tests/tenant-isolation-grep.test.ts` passes unchanged.
  The "second path makes this area uncompletable" warning issue 01 carries is not engaged at
  all, which is the single most important property of this option and the reason the other
  three lose.
- **`deanpos_app` stays non-superuser and non-`BYPASSRLS`.** Nothing is granted, nothing is
  escalated, no function runs as anyone else. The migration's existing refuse-to-proceed
  guard on `rolsuper OR rolbypassrls` remains the whole story.

### 3. What this deliberately does *not* claim, stated plainly

**The database cannot tell a platform admin from a tenant, and this record does not pretend
otherwise.** Both arrive over the same connection as the same role. What the database
enforces is narrower and honest: *whoever* is connected may create the tenant they are
already scoped to, and nothing more.

The distinct-principal criterion is met one layer up, and it is asserted rather than
assumed:

- `ctx.platformAdmin` is a `PlatformAdminPrincipal` with no `tenantId` (`packages/backend/src/common/ctx.ts`),
  and `provision-tenant.ts` returns `null` immediately when it is absent.
- Two shipped tests already prove the refusal end to end through `expectWrongTenantRefusal`
  — a tenant-scoped caller and an unauthenticated caller. Both pass today.

And the database is a real second line rather than a decoration, because of a fact worth
following through: a tenant-scoped session's `app.tenant_id` is derived from its principal
and never supplied by a client — issue 01's rule, enforced by a grep test. So the only value
such a session can hold is its **own, already-existing** tenant id, and the only insert the
new policy would permit it is a duplicate of that id, which the primary key rejects. To
reach a *fresh* id you have to be code that mints a UUID, and the only such code is the
provisioning handler, which is gated on the platform-admin principal.

That is why `apps/api/tests/platform-admin-provision-tenant.test.ts`'s sixth test — "RLS,
not the application layer, blocks a tenant-scoped connection from minting another Tenant" —
**still passes with this policy in place**: it inserts a random UUID while scoped to an
existing tenant, the `WITH CHECK` returns false, and PostgreSQL raises. That test is not
weakened, and it is the assertion that keeps this paragraph true if someone later widens the
policy.

### 4. The two escalating options buy no extra safety for real cost

Both `SECURITY DEFINER` and a second session variable are usually reached for here, and
both fail the same way: **neither can distinguish a platform admin either.** A
`SECURITY DEFINER` function is called over the same pooled connection by the same role, so
"only this function may create tenants" reduces to "only application code may create
tenants" — which is already true. It pays for that with a function running as the table
owner, a `search_path` that must be pinned or it is a privilege-escalation bug, an
`EXECUTE` grant to revoke from `PUBLIC`, and a second place where the rules about `Tenant`
live. A second session variable pays for it with a second thing `client.ts` sets, a second
scoping helper any handler can reach for, and a policy on `Tenant` that is a genuine
tenant-isolation bypass rather than a one-row permission.

### Secondary clause, same file and same principle: the audit log becomes append-only in the database

Issue 02's migration currently gives `PlatformAuditLog` a `FOR ALL USING ("tenant_id" =
current_setting('app.tenant_id', true))` policy. Its comment above the grants says the table
is append-only, and the grants say so (`SELECT, INSERT`, no `UPDATE`/`DELETE`) — but the
policy contradicts the intent in one direction that matters: it makes every platform-admin
audit row **readable by the tenant it names**, including the `platform_admin_id` of a
principal that issue 02 exists to keep separate from tenants. Nothing reads that table
today, so nothing leaks today; the day a tenant-facing report joins it, it does.

The same one-word change closes it, in the same unmerged file, at the same cost:

```sql
CREATE POLICY "platform_audit_log_append" ON "PlatformAuditLog"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
```

Provisioning still writes its audit row; no tenant-scoped connection can read one. The
existing audit test reads through `ownerDb` and is unaffected (see the note on superusers
under "What would make this decision wrong"). This is included here rather than left for
later because after merge it costs a whole new migration, and because it is the identical
question — how a platform-admin artefact relates to tenant RLS — applied to the sibling
table three lines further down the same file.

Also decided, and equally cheap while the file is unmerged: **`REVOKE UPDATE, DELETE ON
"Tenant" FROM "deanpos_app"`.** Issue 01's blanket `GRANT SELECT, INSERT, UPDATE, DELETE ON
"Tenant"` is currently inert because RLS denies those commands, but a dead grant plus a
future carelessly-written policy is how a tenant silently gains the ability to rename or
delete itself. Issue 02's migration already does exactly this for `User` and
`PlatformAuditLog`; `Tenant` is the one table it left on issue 01's blanket grant.

### Weights used for the ranking

Declared before any option was written down, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Every option that works ends in the same place for a restaurant owner: they get provisioned and they cannot see anyone else's data. The options do not differ in what a user experiences, and saying so is more honest than manufacturing a spread. |
| Business impact | ×1 | Same. All are free and none changes what can be sold. |
| Engineering cost and risk | ×3 | Every constraint the question actually has is an engineering-risk constraint: one `set_config` call site, a non-superuser role, no `BYPASSRLS`, a locked test, and a shape eight later areas inherit. This is where the options separate and it is weighted to say so. |
| Reversibility | ×2 | The artefact is an append-only migration and a database privilege boundary. Both are the kind of thing that is cheap today and expensive after merge, which is exactly why the question was routed here. |
| Evidence strength | ×2 | The decision rests entirely on precise PostgreSQL semantics — what an `INSERT` policy does and does not do — where being 90% right is being wrong. |

Maximum possible total: 45.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×3 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **`FOR INSERT WITH CHECK (id = current_setting('app.tenant_id'))` on `Tenant`** | 4 | 4 | 5 (15) | 5 (10) | 5 (10) | **43** |
| 2 | A narrowly-scoped `SECURITY DEFINER` function owned by the migration owner | 4 | 4 | 2 (6) | 3 (6) | 4 (8) | **28** |
| 3 | Do nothing — provisioning is not an application feature in v1; tenants are seeded out of band | 1 | 1 | 2 (6) | 5 (10) | 2 (4) | **22** |
| 4 | A second session variable, `app.platform_admin`, set through `client.ts` | 4 | 4 | 1 (3) | 2 (4) | 3 (6) | **21** |
| 5 | A separate connection role for provisioning | 4 | 3 | 1 (3) | 1 (2) | 3 (6) | **18** |

**1 — The `INSERT`-only policy, chosen.** One statement in one unmerged migration. No
TypeScript diff anywhere, no second session variable, no second connection, no privilege
escalation, and no test weakened — issue 01's locked test and issue 02's own RLS test both
pass with the policy in place, for structural reasons rather than by tuning a predicate.
Engineering cost is 5 because the *only* artefact is the policy. Evidence is 5 because every
load-bearing claim is a quoted sentence from PostgreSQL's own reference pages, including the
two that could have sunk it (`RETURNING` and foreign keys). Reversibility is 5 on a measured
basis, not an optimistic one — see below.

**2 — A `SECURITY DEFINER` function.** The textbook answer, and the runner-up. It is the
option to move to if `Tenant` ever needs a privileged operation that is genuinely more than
one insert — a provisioning routine that also seeds a `Store`, say, or a tenant *merge*. It
loses today on three things. It escalates privilege by design, which means the record would
have to specify a pinned `search_path`, `REVOKE EXECUTE … FROM PUBLIC`, and an argument
whitelist, and each of those is a way to get it wrong that option 1 does not have. It does
not buy the distinct-principal guarantee it appears to buy, because it is invoked by the
same role over the same connection. And it splits the rules about `Tenant` between a policy
and a function body, so the next person reading the migration has to find both. Reversibility
3, not 5: dropping it means a new migration *and* rewriting the handler and its db-operation
back to a plain insert.

**3 — Do nothing.** Included because it must be. **10 of its 22 points are reversibility**,
which every do-nothing option maximises trivially — the same inflation records 002, 007,
008, 011, 015 and 027 each left visible rather than tuning away. It means the first
acceptance criterion of issue 02 cannot be met and a restaurant is created by a human
running SQL, which is not a product. Its evidence score is 2 because the position it
preserves — that `Tenant` is simply unreachable — was never a decision, it was issue 01
explicitly deferring this question to issue 02.

**4 — A second session variable.** Superficially the most "correct-looking" option, and the
worst on the constraint that actually binds. Issue 01 states in as many words that a second
path setting database session state makes this area uncompletable, and the grep test that
enforces it exists because that warning was taken seriously. Even confined to `client.ts` it
means a second scoping helper — `withPlatformAdminScope` or a flag on `withTenantScope` —
and from that moment any handler can opt into a mode whose policy is a real tenant-isolation
bypass on `Tenant`, keyed on a value the process sets about itself. Reversibility 2: removing
it means removing a policy, a helper, and every call site that adopted it, and helpers of
this kind acquire call sites quickly.

**5 — A separate connection role.** Loses hardest and is worth stating why, because it is the
intuitive answer. It needs a second role in the migration, a second credential (which record
027 just finished making one hard problem rather than two), a third environment variable
through `stack.sh`, `.orc2/ORCHESTRATOR.md`, `.env.example` and `docker-compose.yml`, and a
second connection pool live inside the running API — the exact thing issue 01 says to raise as
a blocker rather than build. Reversibility 1: it is a role in an applied migration plus
deployment plumbing, which is record 027's "unwind a migration already merged" case.

**Is it close?** No. Option 1 beats option 2 by fifteen points and thirteen of them come from
the ×3 criterion, which is where the question genuinely lives. The one thing that *is* close
to a judgement call rather than a derivation is the secondary clause on `PlatformAuditLog`:
nothing reads that table today, so the change is bought purely on "the file is frozen after
merge and this costs one word now".

## How the hard constraints are honoured

| Constraint | How |
| --- | --- |
| Exactly one code path sets a session variable, in `createDb`/`withTenantScope`, transaction-local | `packages/backend/src/db/client.ts` gets a **zero-line diff**. `apps/api/tests/tenant-isolation-grep.test.ts` passes unchanged. |
| Issue 01's locked test may not be weakened | `packages/backend/tests/db/with-tenant-scope.test.ts` gets a **zero-line diff** and passes. An `INSERT` policy has no `USING` expression, so it is not on the `SELECT` path. **There is no issue-01/issue-02 contradiction.** |
| Platform-admin identity stays a distinct principal | Enforced in `ctx`/handler and asserted by two shipped negative tests. The database cannot distinguish principals and this record says so explicitly rather than claiming it does; what the database adds is that the only insert reachable from a tenant-scoped session is a primary-key duplicate of its own id. |
| `deanpos_app` stays non-superuser and non-`BYPASSRLS` | Nothing is granted or escalated; the migration's existing `rolsuper OR rolbypassrls` guard is untouched. No `SECURITY DEFINER` anywhere. |

## What issue 02 must change

**One file.** `packages/backend/src/db/prisma/migrations/20260802080203_platform_admin_tenant_provisioning/migration.sql`:

1. Replace the five-line placeholder comment at the end of the file (lines 76–80) with the
   policy and a comment inside the repository's three-line ceiling:

   ```sql
   -- A transaction may create exactly the Tenant it is already scoped to, and can
   -- never read it back: an INSERT policy has no USING expression, so Tenant stays
   -- default-deny for SELECT. See .scratch/decisions/029.
   CREATE POLICY "tenant_provision_insert" ON "Tenant"
     FOR INSERT WITH CHECK ("id" = current_setting('app.tenant_id', true));

   REVOKE UPDATE, DELETE ON "Tenant" FROM "deanpos_app";
   ```

2. Change the `PlatformAuditLog` policy (lines 73–74) from `FOR ALL USING` to
   `FOR INSERT WITH CHECK`, renaming it `platform_audit_log_append`.

No `TO "deanpos_app"` clause on either policy — issue 01's two policies carry none, the
behaviour is identical here, and a lone divergence is something a reviewer has to stop and
reason about.

**Nothing else changes.** Not `client.ts`, not `schema.prisma`, not `provision-tenant.ts`,
not `insert-tenant.command.ts`, not `ctx.ts`, not the test seam, and not one line of any
test file.

**This must land before merge.** Record 027 established the reason and it applies again:
`migrate deploy` "warns if any migrations have been modified since they were applied", and
this migration has been applied only to the lane's throwaway database. Issue 01's migration
is already on `main` and applied to `DeanPOS_dev`, which is exactly why the policy goes in
issue 02's migration and not in issue 01's, where it arguably "belongs".

**No issue file's acceptance criteria change.** Issue 01's criterion — "`Tenant` is outside
tenant RLS and unreachable from a tenant-scoped principal" — remains literally true: a
tenant-scoped principal cannot read, update or delete a `Tenant`, and the only row it could
insert is one that already exists. Issue 02's criteria are unchanged and all become
reachable.

## No-gos

- **No `RETURNING` on any `Tenant` write, ever, while this policy is the only one on the
  table.** `.returningAll()` or `.returning("id")` on `insert-tenant.command.ts` turns a
  green suite red with an error about `SELECT` policies that reads as unrelated. If a
  returned row is ever needed, the value is already in hand — the handler mints the id.
- **No `USING` expression on `Tenant`, and no `FOR ALL` policy on it.** That is the exact
  change the implementer correctly reverted, and it re-breaks issue 01's locked test.
- **No `SECURITY DEFINER` function anywhere in this repository without its own decision
  record** naming its `search_path`, its `EXECUTE` grants, and what it may touch.
- **No second code path setting a database session variable**, and no second connection
  pool. Issue 01's warning stands and this record does not spend it.
- **No `BYPASSRLS` and no superuser on `deanpos_app`.** The migration's existing guard is
  load-bearing, not decorative.

## How to turn it back

**Before merge:** delete the two `CREATE POLICY` lines and the `REVOKE` from the migration.
One commit, one file, nothing applied anywhere but a throwaway lane database. Provisioning
stops working, so this is only a real reversal in combination with picking option 2.

**After merge:** a new migration containing

```sql
DROP POLICY "tenant_provision_insert" ON "Tenant";
```

That is the entire cost, and it is why reversibility scores 5 rather than optimistically:
there is no table change, no column, no data migration, no backfill, and nothing to unwind —
a policy is metadata. The applied file is never edited, which is record 027's rule.

**Moving to option 2 later**, the likelier direction, is additive in the same way: a new
migration creates the `SECURITY DEFINER` function and drops the policy; `insert-tenant.command.ts`
becomes a function call; `provision-tenant.ts` may keep `withTenantScope` exactly as it is.
**Two files and one migration**, measured rather than estimated:
`rg -l 'insertInto\("Tenant"\)' --glob '!node_modules'` returns
`packages/backend/src/platform-admin/db-operations/commands/insert-tenant.command.ts` and two
test files that insert fixtures as the owner role. **One production call site, today and after
eight more areas** — because the policy is reachable only through the one command file, and
because RLS is enforced by the database rather than by anything code imports, so it has no
call sites of its own to grow.

**What will have been built on top of it by then.** Every later privileged write path that
copies this shape. That is the real cost of reversing, and it is why the shape chosen is the
one that adds no mechanism: there is nothing for a later area to inherit except "scope the
transaction to the row you are creating, and give the table an `INSERT`-only policy", which
survives a move to option 2 unchanged.

## What would make this decision wrong

- **A platform admin needs to *read* `Tenant`.** The first back-office screen listing all
  tenants, or a provisioning flow that checks whether a name is taken, cannot be served by
  this record — deliberately, because the read side is where a general bypass would have to
  be invented. **This is the named re-check trigger**, and when it arrives the question is a
  new record, not a widened policy. The likeliest right answer then is option 2 or a
  platform-admin-scoped connection used only by platform-admin procedures, both of which
  this record leaves reachable.
- **The migrating role stops being a superuser.** The whole test suite — issue 01's fixtures
  and issue 02's assertions — reads and writes `Tenant`, `User` and `PlatformAuditLog`
  through `DATABASE_URI` with no tenant set. Those tables are `FORCE ROW LEVEL SECURITY`, so
  the owner is subject to policies too; the reads work only because superusers "always bypass
  the row security system". This is a **pre-existing** property of issue 01's test design that
  this record inherits rather than introduces, and it is stated here because it is invisible,
  it is not asserted anywhere, and the day a hardened environment runs migrations as a
  non-superuser owner the failures will look like RLS bugs rather than like a role attribute.
- **Someone adds a `Tenant` policy for a different reason and gives it a `USING` expression.**
  Two permissive policies are OR-ed, so a single careless `FOR ALL` re-opens the read side and
  issue 01's locked test is the only thing that would catch it. That test is therefore
  load-bearing rather than historical, and must not be deleted as "covered by issue 02".
- **Tenant ids stop being unguessable.** The record leans on `randomUUID()` and on the primary
  key to make "insert the tenant you are scoped to" harmless. Sequential or client-supplied
  tenant ids would break the second half of that argument.
- **A later area needs two tenants written in one transaction** — a merge, a transfer, a
  split. `set_config` is transaction-local and single-valued, so this shape cannot express it,
  and stretching it is how the general bypass gets built by accident. That is a new record.

## Evidence

**Repository, read 2026-08-02**, all paths relative to the lane worktree
`/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS/.worktrees/ti02-platform-admin-tenant-provisioning`
(branch `ti02-platform-admin-tenant-provisioning`, commit `bac0f86`, committed deliberately
red):

- `packages/backend/src/db/prisma/migrations/20260802065946_tenant_isolation_spine/migration.sql`
  — `ALTER TABLE "Tenant" ENABLE`/`FORCE ROW LEVEL SECURITY` with no policy (lines 66–67); the
  blanket `GRANT SELECT, INSERT, UPDATE, DELETE ON "Tenant"` (line 50) that the `REVOKE`
  narrows; the `Store` policy's `USING`-only shape (lines 60–61), which is the precedent for
  omitting a `TO` clause; and the `rolsuper OR rolbypassrls` guard (lines 35–39). **Applied to
  `DeanPOS_dev` and merged — frozen.**
- `packages/backend/src/db/prisma/migrations/20260802080203_platform_admin_tenant_provisioning/migration.sql`
  — the unmerged file this record changes: the `User` and `PlatformAuditLog` policies (63–74),
  the `REVOKE`/`GRANT` pattern the `Tenant` `REVOKE` copies (53–61), and the placeholder
  comment at 76–80 that routed the question here.
- `packages/backend/tests/db/with-tenant-scope.test.ts` lines 84–90 — **the locked test.** A
  `SELECT`, which is why an `INSERT` policy cannot affect it.
- `apps/api/tests/platform-admin-provision-tenant.test.ts` lines 145–151 — the RLS proof that
  keeps the "only a primary-key duplicate is reachable" argument honest; and lines 66–98, the
  `ownerDb` reads that depend on the migrating role being a superuser.
- `packages/backend/src/platform-admin/handlers/provision-tenant.ts` — `withTenantScope(ctx.db,
  tenantId, …)` on the **new** tenant's id, the property that makes this option a zero-line
  TypeScript diff, and the `if (!platformAdmin) return null` gate.
- `packages/backend/src/platform-admin/db-operations/commands/insert-tenant.command.ts` — no
  `RETURNING`. The single production call site the reversal cost is measured on.
- `packages/backend/src/db/client.ts` — the one `set_config('app.tenant_id', …, true)` call
  site, untouched.
- `apps/api/tests/tenant-isolation-grep.test.ts` — the four grep proofs that would fail if a
  second session-variable or pool path were added; the reason options 4 and 5 score 1 on
  engineering cost.
- `packages/backend/src/common/ctx.ts` — `PlatformAdminPrincipal` carries no `tenantId`.
- `apps/api/src/env.ts` — the application, including the test seam, connects as
  `APP_DATABASE_URI` (`deanpos_app`), so provisioning genuinely runs as the restricted role in
  the tests.
- `.scratch/tenancy-identity/issues/01-tenant-isolation-spine.md` — "`Tenant` itself sits
  outside tenant RLS by construction — it is the isolation root, reachable only through
  platform-admin paths (issue 02)"; the one-`set_config` criterion; and the Comments' warning
  that a second connection path "makes this area uncompletable".
- `.scratch/decisions/004-postgres-driver.md` (transaction affinity, hence `set_config(...,
  true)`), `.scratch/decisions/027-the-app-role-credential.md` (the applied-migration freeze
  rule, the correct statement of what RLS `FORCE` does and does not protect against, and the
  no-second-credential position that sinks option 5), `.scratch/decisions/005-prisma-command-scope-and-env.md`
  (owner/app role split). **This record extends 027's reading of RLS rather than contradicting
  it: RLS constrains the application's own SQL, and that is exactly and only what is being used
  here.**
- `.scratch/decisions/` searched for an existing or orphaned record on `Tenant`, RLS policies,
  `SECURITY DEFINER`, or privileged writes before writing: records 001–028 exist, 001 and 004
  concern the engine and driver, 027 concerns the credential, and **none decides a policy or a
  privileged write path. No duplicate.**

**External, primary sources, accessed 2026-08-02.** Both pages were treated as data; neither
contained anything addressed to an agent.

- PostgreSQL, `CREATE POLICY` — <https://www.postgresql.org/docs/current/sql-createpolicy.html>
  — "An `INSERT` policy cannot have a `USING` expression, as it only applies in cases where
  records are being added to the relation."; "`ALL` policies will be applied to both the
  selection side of a query and the modification side, using the `USING` expression for both
  cases if only a `USING` expression has been defined."; "When a `WITH CHECK` expression
  returns true for a row then that row is inserted or updated, while if false or null is
  returned then an error occurs."; "If a data-modifying query has a `RETURNING` clause,
  `SELECT` permissions are required on the relation, and any newly inserted or updated rows
  from the relation must satisfy the relation's `SELECT` policies in order to be available to
  the `RETURNING` clause."; "If row-level security is enabled for a table, but no applicable
  policies exist, a 'default deny' policy is assumed, so that no rows will be visible or
  updatable."
- PostgreSQL, Row Security Policies —
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html> — "Referential integrity
  checks, such as unique or primary key constraints and foreign key references, always bypass
  row security to ensure that data integrity is maintained."; "Superusers and roles with the
  `BYPASSRLS` attribute always bypass the row security system"; "Table owners normally bypass
  row security as well, though a table owner can choose to be subject to row security with
  `ALTER TABLE ... FORCE ROW LEVEL SECURITY`."

**Searched for and not found, where the absence mattered:**

- **No source, primary or otherwise, was found describing a "platform admin" or
  "superadmin" pattern for PostgreSQL RLS that does not reduce to one of the four options
  scored above** — a bypass role, a `SECURITY DEFINER` function, a second session setting, or
  a per-command policy. The absence is worth recording because it means option 1 is not a
  clever trick found elsewhere; it is the ordinary reading of the per-command policy table,
  and its safety comes from the question being narrower than the pattern usually is (one
  insert of one row whose id the caller already committed to).
- **PostgreSQL documents nothing about whether an unprivileged role may set a *customized*
  option such as `app.tenant_id`** — record 027 hit the same gap and settled it by
  demonstration in the repository. Unchanged here, and it is a premise this record inherits
  rather than a new one it introduces.
