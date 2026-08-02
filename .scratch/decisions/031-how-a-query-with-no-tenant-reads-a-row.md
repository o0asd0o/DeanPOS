# 031: A query that has no tenant yet gets its own named key, not a borrowed one — two purpose-built session variables through the one existing choke point

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md` (`## Comments`, implementer notes 1–3), routed by the human

## The question

Two reads in this product happen **before** anyone knows which restaurant is asking:
sign-in has to find an account from an email address, and every authenticated request
has to find its session row from a cookie. Every table in the database is protected by a
rule that says "you may only see rows belonging to the restaurant this connection
declared itself to be working for". These two reads have no restaurant to declare.

How do they read their one row without weakening that protection for everything else?

A wrong answer is not a bug that shows up as a failing test. It is a rule that still
looks correct, still passes, and quietly stops meaning what eight later areas will
assume it means.

## What I chose, and why

**The two pre-auth reads get their own named keys — `app.login_email` and
`app.session_id` — set through the same single place in the code that already sets the
tenant key, and never mixed with it.**

The implementer's version put all three values — a restaurant id, a session id, and an
email address — on the one variable called `app.tenant_id`. That is the decision being
overturned, and here is the plain reason.

### The mechanism was sound; the name it travelled under was not

Give the implementer full credit first, because the *shape* it found is right and I am
keeping it. Both lookups are for a single row, addressed by a value the caller already
knows and that is unique across the whole database. So the database rule can be "you may
see exactly the one row matching the key this transaction opened with" — a one-row
permission, not a general escape hatch. That is genuinely narrow, it needs no new
credential, no privileged function, and no second connection. It is the right answer.
Every option below keeps it.

The problem is that it was carried on the variable named `app.tenant_id`.

That variable is the single thing this entire product's data separation rests on. Every
protection rule in the database, today and for the next eight areas, is written as "this
row's restaurant matches `app.tenant_id`". Issue 01 built a test whose whole purpose is
to prove that value can never come from the person making the request — and record 029,
which authorised the last change in this area, leaned on exactly that in as many words:

> a tenant-scoped session's `app.tenant_id` is derived from its principal and never
> supplied by a client — issue 01's rule, enforced by a grep test

**As committed, that sentence is no longer true.** `apps/api/src/context.ts` takes the
session cookie — a string the browser sends, which anyone can set to anything — and
passes it, unvalidated and unauthenticated, into `set_config('app.tenant_id', …)`. The
sign-in handler does the same with whatever email address is typed into the form. An
anonymous stranger now chooses the value of the variable that every isolation rule in the
schema is compared against.

So the answer to the question the human put most sharply — is this an extension of record
029, or the thing record 029 refused wearing different clothes? — is: **it is closer to
the thing 029 refused.** Not because a second variable is forbidden (I am adding two), but
because 029's whole argument for why the database is a real second line of defence, and
not decoration, was that this one value is never attacker-chosen. The committed migration
spends that guarantee and does not replace it.

### To be clear about what is and is not true today: nothing leaks

I checked this rather than assuming it, and I am not going to overstate the finding. **No
data is currently exposed.** An attacker who sets their cookie to a real restaurant's id
gets a transaction scoped to that restaurant — but the only statement that runs inside it
is `SELECT … FROM "Session" WHERE id = <that same value>`, which matches nothing. The
containment is real. It is just being provided by the hand-written `WHERE` clause of two
specific queries, not by the database. The database rule has been reduced to a thing that
agrees with whatever the query already asked for.

That is the precise defect: **the second line of defence has been made to depend on the
first line.** This project's entire thesis is that those are independent.

### The implementer's own safety argument is half wrong, and I verified which half

Its containment argument was that a UUID and an email address cannot collide, so the
three meanings can share one variable without interfering. For email versus restaurant
id, that holds — an email contains an `@` and a UUID cannot.

**For session id versus restaurant id it is false, and not marginally so.** Both are
produced by the identical call, `randomUUID()`, in `sign-in.ts:34` and
`provision-tenant.ts:28`. They are the same format drawn from the same space. The two id
spaces the argument relies on being distinguishable are literally indistinguishable. The
odds of an accidental collision are negligible, but "negligible odds" is a different and
much weaker claim than "cannot collide", and the value is chosen by an attacker rather
than drawn at random, so the odds argument is not the one that applies anyway.

A design that needs a coincidence-of-formats proof to be safe should not be the design.
With two named variables, the proof is not needed at all: when a login transaction is
open, `app.tenant_id` is simply **not set**, so every restaurant-keyed rule in the schema
compares against nothing and denies. It fails shut by construction rather than by
arithmetic.

### One clause of it is dead code, and it widens the rule for nothing

`session_tenant_update` carries `OR "id" = current_setting('app.tenant_id', true)`. Its
comment says this serves "the idle-refresh bump made inside the session_self_lookup
transaction, which never sets a real tenant id".

**That code path does not exist.** `apps/api/src/context.ts:43` opens a *new* transaction
scoped to `session.tenant_id`, a genuine restaurant id, and calls `touchSession` inside
it. I traced all three writers to the `Session` table and every one runs under a real
restaurant id: `insertSession` under `user.tenant_id` (`sign-in.ts:37`), `revokeSession`
under `ctx.principal.tenantId` (`sign-out.ts:15`), `touchSession` under
`session.tenant_id`. The comment at `touch-session.command.ts:3–5` describes an earlier
design that was changed and is now simply inaccurate.

So the `OR` grants permission to modify session rows to serve a caller that does not
exist — and because session ids and restaurant ids share the `randomUUID()` space, what
it actually grants is: any restaurant may modify the session row whose id happens to
equal its own restaurant id. It goes.

### What I am changing, in one sentence

The two one-row lookups keep working exactly as they do now, through the same functions
with the same signatures; they just stop borrowing the name of the thing that protects
everything else.

### Does this break record 029's no-go on a second session variable?

It narrows it, and I would rather say so directly than route around it.

Record 029's no-go reads "No second code path setting a database session variable, and no
second connection pool." The connection-pool half is untouched. On the variable half,
what 029 was refusing is stated in its own option 4: a variable whose policy would be *"a
genuine tenant-isolation bypass rather than a one-row permission"*, reached through *"a
second scoping helper any handler can reach for"* to *"opt into a mode"* that steps
outside its tenant.

The two variables here are the opposite kind. They grant strictly **less** than
`app.tenant_id` grants — one row, addressed by a unique key — and they cannot widen any
restaurant-keyed rule, because those rules see nothing while a pre-auth variable is the
one that is set. And the capability itself is not new: `withTenantScope(db, someEmail, …)`
already does exactly this today. The only question is whether it travels under an honest
name.

That is what settles it. **Under the committed design, a pre-auth escape cannot be found
by searching for it** — it is textually identical to ordinary tenant scoping, and the only
way to enumerate the call sites is to read every `withTenantScope` call in the repository
and judge its second argument by eye. Under this record, `rg 'withLoginScope|withSessionScope'`
returns the complete list, forever.

The narrowed no-go, which replaces 029's fourth bullet going forward:

> No second session variable that **widens** what a transaction may reach beyond its own
> tenant. A variable that **narrows** — set only in `client.ts`, only transaction-local,
> and keyed to a single row by a column with a unique index — is permitted. There are
> exactly two, they are named in this record, and a third is a new record.

Everything 029 was actually protecting survives literally: one file sets session state,
every call is transaction-local, `deanpos_app` stays unprivileged, and issue 01's grep
test passes **unchanged**. In fact the number of `set_config` occurrences in the source
goes from one to one — the three helpers share a single private one.

### Weights used for the ranking

Declared before any option was written down, and **not changed afterwards.** They are the
same weights record 029 used, deliberately: this is the same class of question about the
same mechanism, and re-tuning them for a follow-up would make the two records
incomparable.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Every option that works ends in the same place: the manager signs in and cannot see anyone else's restaurant. There is no user-visible spread here and manufacturing one would be dishonest. |
| Business impact | ×1 | Same. All are free, none changes what can be sold. |
| Engineering cost and risk | ×3 | Every real constraint is an engineering-risk constraint: one `set_config` call site, an unprivileged role, a locked test, and — the one this question turns on — what every future policy author on `User` and `Session` inherits. |
| Reversibility | ×2 | The artefact is an append-only migration plus a contract about what a database variable means. Cheap now, expensive after merge. |
| Evidence strength | ×2 | It rests on precise PostgreSQL row-security semantics, where being 90% right is being wrong. |

Maximum possible total: 45.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×3 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Two purpose-named variables, `app.login_email` and `app.session_id`, through the same choke point** | 4 | 4 | 5 (15) | 5 (10) | 5 (10) | **43** |
| 2 | Two `SECURITY DEFINER` lookup functions; no new read policy at all | 4 | 4 | 2 (6) | 3 (6) | 4 (8) | **28** |
| 3 | Do nothing — ship the overload as committed | 4 | 4 | 2 (6) | 2 (4) | 2 (4) | **22** |
| 4 | Rename `app.tenant_id` to `app.scope` and keep one variable | 4 | 4 | 1 (3) | 1 (2) | 3 (6) | **19** |
| 5 | A separate least-privilege role used only for pre-auth lookups | 4 | 3 | 1 (3) | 1 (2) | 3 (6) | **18** |

**1 — Two purpose-named variables, chosen.** The artefacts are four edited lines in one
unmerged migration, about ten lines in `client.ts`, and a one-word change in each of two
query files. Engineering cost is 5 because it *removes* mechanism rather than adding it:
`app.tenant_id` goes back to meaning one thing, the dead `OR` clause disappears, and the
pre-auth escape becomes greppable. Evidence is 5 because every load-bearing claim is a
quoted sentence from PostgreSQL's own reference pages, including the two that could have
sunk it (permissive policies are OR-ed; `UPDATE` applies `SELECT` policies when it reads a
column). Reversibility is 5 on a measured basis — see below.

**2 — `SECURITY DEFINER` lookup functions.** The textbook answer and the genuine runner-up,
and it is in one way *stronger* than the winner: it adds no read policy to `User` or
`Session` at all, so a future policy author inherits nothing whatsoever. It loses on cost
and on brittleness. It escalates privilege by design, so the record would have to specify
a pinned `search_path` (or it is a privilege-escalation bug), `REVOKE EXECUTE … FROM
PUBLIC`, and a `GRANT EXECUTE` to `deanpos_app` — three separate ways to get it wrong that
option 1 does not have. And a function returning a table row hard-codes that table's
column list into a migration, so **every future column added to `User` or `Session`
requires a new migration to rewrite the function**, which is a permanent tax the winner
does not levy. Reversibility 3: undoing it needs a new migration *and* rewriting both
query files. **This is the option to move to if the trigger below fires**, and record
029's standing requirement that any `SECURITY DEFINER` function get its own record still
applies to it.

**3 — Do nothing, ship as committed.** Included because it must be, and it is not
ridiculous: it costs nothing today and nothing is currently exposed. It scores 2 on
engineering risk rather than 1 because the containment is real *right now*. It scores 2 on
reversibility, and that number is the one worth explaining, because reverting the SQL
itself is trivially cheap — the same one-file edit the winner needs. What is expensive is
that **the thing accreting on top of it is un-greppable.** Once `withTenantScope(db,
anyString, …)` is the blessed pre-auth idiom, the set of places that scope a transaction
to attacker-controlled input cannot be enumerated by search; recovering it means a manual
eye-audit of every `withTenantScope` call in the repository, and that cost grows with every
area. Evidence 2 because its stated justification is partly false on inspection (the
format-collision argument, above) and because record 029 does not support it — 029 depends
on the premise this option removes.

**4 — Rename the one variable to `app.scope`.** The "honest name for what it actually
carries" option, and I looked at it seriously before rejecting it. Two things kill it.
Mechanically, `app.tenant_id` is written into issue 01's and issue 02's migrations, **both
merged and applied to `DeanPOS_dev`, and therefore frozen under record 027's rule** — a
rename means a new migration that drops and re-creates every policy on `Store`, `User`,
`Tenant`, `PlatformAuditLog` and `Session`, plus `client.ts` and the grep test.
Reversibility 1: that is record 027's "unwind a migration already merged" case, by
definition. More importantly, it institutionalises the ambiguity instead of removing it —
it makes vagueness the official contract for eight later areas, so every future policy
author must ask "which kind of scope is this?" forever. It fixes the honesty problem and
keeps the safety problem.

**5 — A separate least-privilege role for pre-auth lookups.** The intuitive answer, and it
loses hardest for reasons already settled twice. It needs a second credential — record 027
just finished making that one hard problem rather than two — a third environment variable
threaded through `stack.sh`, `docker-compose.yml`, `.env.example` and
`.orc2/ORCHESTRATOR.md`, and a second connection pool inside the running API, which issue
01 says in as many words to raise as a blocker rather than build. It would also fail
`tenant-isolation-grep.test.ts`'s `new Pool(` assertion outright.

**Is it close?** No. Option 1 beats option 2 by fifteen points and nine of them come from
the ×3 criterion, which is where the question genuinely lives. The one judgement call
rather than a derivation is the `nullif` wrapper described below, which is bought purely on
"it costs eight characters now and removes a paragraph of reasoning from every future
reader".

## What issue 03 must change

**Verdict on the migration: it must be EDITED before merge. Not shipped as-is, and not
replaced with a second migration.**

That the bytes are still free **matters, and it is the reason this is cheap.** The file
has been applied only to the lane's throwaway database, never to `DeanPOS_dev` and never
to `main`. Record 027 established the rule (`migrate deploy` "warns if any migrations have
been modified since they were applied") and record 029 applied it the same way one issue
ago. Editing in place costs one commit. Had this already merged, the same fix would need a
second migration dropping and re-creating four policies, and the reversibility score in the
table would have been 3 rather than 5.

### 1. `packages/backend/src/db/prisma/migrations/20260802090000_backoffice_sign_in_and_session/migration.sql`

Replace lines 30–58 with:

```sql
-- Pre-auth has no tenant yet, so the lookup key travels on its own variable
-- and `app.tenant_id` stays unset — every tenant-keyed policy in the schema
-- then compares against nothing and denies. See .scratch/decisions/031.
CREATE POLICY "session_self_lookup" ON "Session"
  FOR SELECT USING ("id" = nullif(current_setting('app.session_id', true), ''));

-- Ordinary tenant isolation, unrelated to the pre-auth policy above. UPDATE
-- also applies SELECT policies when it reads a column (its WHERE), so this is
-- what makes touch-session's and revoke-session's rows visible to them.
CREATE POLICY "session_tenant_select" ON "Session"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));

CREATE POLICY "session_tenant_insert" ON "Session"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

CREATE POLICY "session_tenant_update" ON "Session"
  FOR UPDATE USING ("tenant_id" = current_setting('app.tenant_id', true));

-- Sign-in's one-row read, keyed on the globally-unique email. Permissive, so
-- it is OR-ed with "user_tenant_isolation" — which is exactly why it must key
-- on a variable that is never set in a tenant-scoped transaction.
CREATE POLICY "user_login_lookup" ON "User"
  FOR SELECT USING ("email" = nullif(current_setting('app.login_email', true), ''));
```

Statement by statement, that is four changes:

1. `session_self_lookup` — `'app.tenant_id'` becomes `'app.session_id'`, wrapped in `nullif`.
2. `session_tenant_select` — **unchanged.** It is correct and it is not part of the overload.
3. `session_tenant_insert` — **unchanged**, same reason.
4. `session_tenant_update` — the entire `OR "id" = current_setting('app.tenant_id', true)`
   branch is **deleted**. It has no caller (traced above).
5. `user_login_lookup` — `'app.tenant_id'` becomes `'app.login_email'`, wrapped in `nullif`.

Everything above line 30 — the table, the index, the foreign key, the grants, the
`ENABLE`/`FORCE` — is correct and unchanged. So is `CREATE UNIQUE INDEX "User_email_key"`
on line 2 (ratified below).

**On the `nullif(…, '')` wrapper, since a reviewer will ask why it is on two policies and
not the other three.** PostgreSQL documents that `current_setting(name, true)` returns NULL
"if there is no such setting" — but on a *pooled* connection where an earlier transaction
already set a customised option, the variable exists for the rest of the session and
reverts at transaction end to its reset value. I could not find a primary source stating
whether that reset value is NULL or the empty string for a placeholder option; record 027
hit the same documentation gap from the other direction. Rather than resolve it by
argument, `nullif` makes it not matter: unset or reset, the comparison is against NULL and
the row is denied. It is applied only to the two new pre-auth policies because that is
where an empty string could actually match something (an `email` column can hold `''`; a
`tenant_id` column holds a UUID under a foreign key and cannot). The three tenant-keyed
policies are left textually identical to the frozen ones in issues 01 and 02, which is
worth more to a reviewer than local consistency.

### 2. `packages/backend/src/db/client.ts`

`withTenantScope` keeps its exported name, signature and behaviour **byte-identical** —
that is what leaves issue 01's locked test at a zero-line diff. One private helper is
extracted and two siblings added:

```ts
// The one place any database session variable is set (issue 01, record 004).
// Transaction-local, so a pooled connection carries nothing into the next
// request. `setting` is always a literal from the three helpers below.
const withScope = <T>(
  db: DatabaseInstance,
  setting: string,
  value: string | null,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> =>
  db.transaction().execute(async (trx) => {
    if (value !== null) {
      await sql`select set_config(${setting}, ${value}, true)`.execute(trx);
    }
    return fn(trx);
  });

export const withTenantScope = <T>(
  db: DatabaseInstance,
  tenantId: string | null,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.tenant_id", tenantId, fn);

// Pre-auth: no tenant exists yet. A purpose-named variable leaves
// `app.tenant_id` unset, so every tenant-keyed policy denies while these are
// open, and both call sites stay greppable. See .scratch/decisions/031.
export const withLoginScope = <T>(
  db: DatabaseInstance,
  email: string,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.login_email", email, fn);

export const withSessionScope = <T>(
  db: DatabaseInstance,
  sessionId: string,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.session_id", sessionId, fn);
```

Both interpolations are Kysely bind parameters, so the statement reaches PostgreSQL as
`set_config($1, $2, true)` — the setting name is never string-concatenated, and it is
always one of three literals in this file.

`apps/api/tests/tenant-isolation-grep.test.ts` passes **unchanged**: `set_config(` still
appears in exactly this one file, and the single occurrence still matches `/,\s*true\s*\)$/`.

### 3. `packages/backend/src/auth/db-operations/queries/find-user-by-email-for-sign-in.query.ts`

Swap `withTenantScope` for `withLoginScope` in the import and the call. The exported
function's name, signature and return type do not change. Update the comment to cite record
031 rather than 029.

### 4. `packages/backend/src/auth/db-operations/queries/find-session-by-id.query.ts`

Same, with `withSessionScope`.

### 5. `packages/backend/src/auth/db-operations/commands/touch-session.command.ts`

Delete the comment on lines 3–5. It states that this runs "inside the same self-lookup
transaction as find-session-by-id.query.ts", which is not true of the shipped code
(`apps/api/src/context.ts:43` opens a fresh tenant-scoped transaction) and is the note that
made the dead `OR` branch look justified. No code change.

### 6. `packages/backend/tests/auth/session-and-login-rls.test.ts` — add three assertions

The existing tests in this file pass **unchanged**, because they exercise `findSessionById`
and `findUserByEmailForSignIn` through their public signatures. Three cases are added, and
they are the runnable proof that this record's central claim is a property rather than a
sentence:

1. Inside `withSessionScope(sessionId, …)`, selecting from `User` and from `Store` returns
   `[]` — proving `app.tenant_id` is genuinely unset and tenant rules deny.
2. Inside `withLoginScope(email, …)`, selecting all of `User` returns exactly the one
   matching row, with a second user seeded in the same tenant to prove it is one row and
   not a tenant's worth.
3. Inside `withTenantScope(tenantId, …)`, an `UPDATE` on a `Session` row whose `id` equals
   that `tenantId` affects zero rows — the regression test that keeps the deleted `OR`
   branch deleted.

**Nothing else changes.** Not `packages/backend/tests/db/with-tenant-scope.test.ts` (zero-line
diff — `withTenantScope` is untouched), not `apps/api/src/context.ts`, not `sign-in.ts`,
`sign-out.ts`, `set-password.ts`, `insert-session.command.ts`, `revoke-session.command.ts`,
`schema.prisma`, the contract, or any front-end file. **No issue's acceptance criteria
change**, and no new dependency is added.

## Secondary clause 1: `User.email` stays globally unique — ratified

**Decision: ratify.** The implementer's reasoning is sound and, on inspection, it is more
load-bearing than it realised.

Its argument was that sign-in takes an email and a password with no restaurant selector,
and the PRD forbids deriving the restaurant from anything the client sends, so one email
must mean one account. The two alternatives are both closed off by decisions already made:
picking the restaurant from the subdomain is banned by issue 01's grep test (`hostname`,
`subdomain`), and a "which restaurant?" picker after the password check would tell any
stranger which businesses an email address belongs to. Global uniqueness is what is left.

**What it did not say, and what makes it a hard requirement rather than a preference:
`user_login_lookup` is only a one-row permission because the email index is global.** If
email were unique per restaurant instead, `USING ("email" = …)` would match one row *per
restaurant that shares the address* — a genuine cross-tenant read, created by the same
policy text. The two decisions are welded together, and that is written into the no-gos.

**The consequence, named plainly.** Two unrelated restaurants whose manager shares one
email address cannot both exist. The second provisioning attempt fails on
`User_email_key`, and the platform admin sees a unique-constraint error which is also, in
a small way, a cross-tenant disclosure — it reveals that the address is already in use
somewhere on the platform. The realistic victim is not a restaurant group (those are one
tenant with several `Store` rows) but a bookkeeper or consultant with back-office access at
two separate clients, who must use a different address at each. That is a real
inconvenience and it is the price of having no tenant selector on the sign-in screen.

**The re-check trigger:** the first support request from a person who needs the same
address at two restaurants. The migration path then is per-restaurant uniqueness plus a
disambiguation step *after* the password is verified — which is a new record, must be taken
together with a redesign of `user_login_lookup`, and is not a change anyone should make to
one of the two in isolation.

## Secondary clause 2: session lifetimes stay 30 minutes idle and 30 days absolute — ratified, and now anchored

**Decision: ratify both numbers, unchanged.** `packages/backend/src/auth/session-policy.ts`
needs no code edit. What changes is that they stop being invented; the comment should cite
this record instead of saying a number had to be picked.

They were guesses, and they landed on defensible ground:

- **30 days absolute is exactly NIST SP 800-63-4's stated ceiling for AAL1**: "A definite
  reauthentication overall timeout SHALL be established, which SHOULD be no more than 30
  days at AAL1." Issue 03 requires a persistent cookie that survives a browser restart, so
  the absolute timer has to be long; 30 days is the longest a standard endorses, not an
  arbitrary round number.
- **30 minutes idle is stricter than NIST requires at AAL1** (no inactivity timeout is
  required at all) **and stricter than the one hour it names for AAL2.** It sits at the top
  of OWASP's 15–30 minute band for lower-risk applications. For a back office on a computer
  in a restaurant's shared office, that is the right end of the band.

The honest tension, stated rather than smoothed over: OWASP suggests 4–8 hours absolute for
an office worker, so 30 days is much looser than that guidance. The product requirement in
issue 03 — survive a browser restart, do not re-authenticate every day — is what overrides
it, and the idle timer is what carries the actual risk reduction. In practice **idle is the
binding constraint almost always**; the 30-day timer only ever fires for someone who uses
the back office at least twice an hour for a month.

**The re-check trigger, and it is specific:** PCI DSS v4.0 requirement 8.2.8 mandates
re-authentication after **15 minutes** idle, and it applies to accounts with administrative
capability that can reach cardholder data. The back office is out of that scope today
because it displays no card data. **The day any back-office screen shows a card number,
even truncated, the idle timeout must drop to 15 minutes**, and that is a one-constant edit
in `session-policy.ts`.

## No-gos

- **`app.tenant_id` is set from a principal, never from anything a client sends.** This is
  issue 01's rule and record 029's premise, and it is now also this record's. A cookie
  value, a form field, a header or a query parameter reaching that variable is the defect
  this record exists to remove.
- **No third pre-auth variable without a new record.** Two is a pair; three is a pattern,
  and patterns get copied. If a third pre-auth lookup appears, the answer is option 2, not
  `app.something_else`.
- **A pre-auth transaction runs exactly one statement.** Both scopes make a whole row
  readable — including `User.password_hash` — and the safety of that rests on nothing else
  running while the scope is open. A second statement inside `withLoginScope` or
  `withSessionScope` needs a fresh look.
- **`User.email` may not become per-tenant-unique while `user_login_lookup` exists.** It
  turns a one-row permission into a cross-tenant read, silently, with no policy text
  changing. The two must move together.
- **No `RETURNING` on a `Session` or `User` write made under a pre-auth scope**, for the
  reason record 029 gives about `Tenant`: `RETURNING` demands `SELECT` policies.
- Record 029's remaining no-gos stand unamended — no `SECURITY DEFINER` without its own
  record, no second connection pool, no `BYPASSRLS`, no superuser on `deanpos_app`. Only its
  fourth bullet is narrowed, in the wording given above.

## How to turn it back

**Before merge** (where this is today): revert one commit. Four lines of the unmerged
migration go back to `'app.tenant_id'` and regain the `OR` branch; `client.ts` collapses to
its current two exports; two query files re-import `withTenantScope`; the three added tests
are deleted. Nothing has been applied outside the lane's throwaway database, so there is
nothing to unwind. This is the reversal the score of 5 is measured against.

**After merge:** a new migration containing

```sql
DROP POLICY "session_self_lookup" ON "Session";
DROP POLICY "user_login_lookup" ON "User";
CREATE POLICY "session_self_lookup" ON "Session"
  FOR SELECT USING ("id" = current_setting('app.tenant_id', true));
CREATE POLICY "user_login_lookup" ON "User"
  FOR SELECT USING ("email" = current_setting('app.tenant_id', true));
```

plus deleting two helpers from `client.ts` and changing two import lines. Policies are
metadata: no table change, no column, no backfill, nothing to migrate. The applied file is
never edited, which is record 027's rule.

**Measured call-site cost, not estimated.** `withLoginScope` and `withSessionScope` have
**one production call site each** —
`packages/backend/src/auth/db-operations/queries/find-user-by-email-for-sign-in.query.ts`
and `.../find-session-by-id.query.ts` — because both are wrapped inside a named query
function that everything else calls. `sign-in.ts` and `apps/api/src/context.ts` call those
functions, not the helpers, so they do not move. That number is designed not to grow: the
no-go above forbids a third.

**Moving to option 2 later**, the likelier direction, is additive in the same way: a new
migration creates the two `SECURITY DEFINER` functions and drops the two policies, and the
same two query files become function calls. The two helpers then disappear from
`client.ts`. **Two files and one migration**, and no other area is touched, because nothing
imports RLS — it is enforced by the database.

**What will have been built on top of it by then.** Only whatever later areas copy the
shape. That is the real reversal cost, and it is why the chosen shape adds no mechanism a
later area can inherit wrongly: there is nothing to copy except "if a read has no tenant,
give it its own named key and one row", which survives a move to option 2 unchanged.

## What would make this decision wrong

- **A third pre-auth lookup appears** — a password-reset token in issue 06 is the obvious
  candidate, and admin-initiated reset is already named as arriving there. Two named
  variables is a pair; three is a pattern that will be copied badly. **This is the named
  re-check trigger, and the answer when it fires is option 2**, whose extra cost is worth
  paying once three call sites justify it.
- **A pre-auth transaction needs a second statement.** The one-row containment is
  per-transaction, and it holds today because exactly one query runs inside each scope.
- **Session ids stop being unguessable, or stop coming from `randomUUID()`.** The whole
  `session_self_lookup` permission rests on the id *being* the credential. A sequential or
  derivable session id makes the policy grant a readable row to anyone who can count. This
  is the sibling of record 029's "tenant ids stop being unguessable" trigger.
- **Someone adds a `FOR ALL` policy with a `USING` clause to `User` or `Session`.**
  Permissive policies are OR-ed, so one careless policy re-opens a read path, and record
  029's warning about this applies verbatim to both tables now.
- **The `Session` idle bump moves back inside the self-lookup transaction.** That was the
  design the deleted `OR` branch was written for. If a future change genuinely wants it,
  the answer is an `UPDATE` policy keyed on `app.session_id` — not on `app.tenant_id`.
- **A hardened environment runs migrations as a non-superuser owner.** Inherited from
  record 029 and unchanged here: the entire test suite reads and writes these tables through
  `DATABASE_URI` with no tenant set, and that works only because superusers bypass row
  security. It is invisible and asserted nowhere.

## Evidence

**Repository, read 2026-08-02**, all paths relative to the lane worktree
`/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS/.worktrees/ti03-backoffice-sign-in-and-session`
(branch `ti03-backoffice-sign-in-and-session`, commit `64c24bb`, gate green — 233 tests):

- `packages/backend/src/db/prisma/migrations/20260802090000_backoffice_sign_in_and_session/migration.sql`
  — the unmerged file this record edits. Lines 33–34, 39–43, 48–52, 57–58 are the four
  policies at issue; line 2 is the global email index; lines 24–28 the grants and
  `ENABLE`/`FORCE`.
- `apps/api/src/context.ts` lines 33–58 — **the finding.** Line 35 passes the raw cookie
  string into `findSessionById`, hence into `set_config('app.tenant_id', …)`. Line 43 opens
  a *separate* transaction on `session.tenant_id`, which is what makes the `OR` branch dead.
- `packages/backend/src/auth/db-operations/queries/find-session-by-id.query.ts` and
  `.../find-user-by-email-for-sign-in.query.ts` — the only two `withTenantScope` call sites
  in the repository whose second argument is not a tenant id. Verified by reading all 25
  call sites, production and test.
- `packages/backend/src/auth/handlers/sign-in.ts` line 34 (`randomUUID()` for the session
  id) and `packages/backend/src/platform-admin/handlers/provision-tenant.ts` line 28
  (`randomUUID()` for the tenant id) — **the two lines that disprove the
  formats-cannot-collide argument for the session case.** Also `sign-in.ts:37`,
  `sign-out.ts:15`, `context.ts:43`: all three `Session` writers run under a real tenant id.
- `packages/backend/src/auth/db-operations/commands/touch-session.command.ts` lines 3–5 —
  the stale comment describing the design the `OR` branch was written for.
- `packages/backend/src/db/client.ts` — the single `set_config` call site this record keeps
  single.
- `packages/backend/tests/db/with-tenant-scope.test.ts` — **the locked test**, read in full.
  It imports and exercises `withTenantScope` only, so preserving that export's signature
  gives it a zero-line diff.
- `apps/api/tests/tenant-isolation-grep.test.ts` lines 25–34 and 50–65 — the assertions the
  new helpers must survive, and the reason a cookie-sourced value slipped past: the
  client-input check matches on `.header(`/`.query(`/`hostname`/`searchParams`, none of
  which a cookie read trips. **The test's letter passes while the property it defends does
  not**, which is why this needed a decision rather than a failing build.
- `packages/backend/tests/auth/session-and-login-rls.test.ts` — the existing coverage, which
  passes unchanged because it goes through the query functions' public signatures.
- `packages/backend/src/db/prisma/migrations/20260802080203_platform_admin_tenant_provisioning/migration.sql`
  lines 65–66 — `user_tenant_isolation` is `FOR ALL` with a `USING` clause and no `FOR`,
  so it is the policy `user_login_lookup` is OR-ed with. **Merged and applied, therefore
  frozen** — the fact that sinks option 4.
- `.scratch/decisions/029-how-a-tenant-row-is-created-under-rls.md` — the record this one
  extends and partially narrows; its no-go list, and the "never supplied by a client"
  sentence that is the premise at stake. `027-the-app-role-credential.md` (the
  applied-migration freeze rule; the no-second-credential position that sinks option 5),
  `004-postgres-driver.md` (transaction affinity, hence `set_config(…, true)`),
  `005-prisma-command-scope-and-env.md`, `001-database-engine.md`.
- `.scratch/tenancy-identity/issues/01-tenant-isolation-spine.md` — the one-`set_config`
  criterion and the "a second path makes this area uncompletable" warning.
- `.scratch/decisions/` searched before writing for an existing or orphaned record on RLS
  policies, pre-auth lookups, session variables, session lifetimes or email uniqueness:
  001–030 exist, 030 is the sign-in *screen* (visual), 029 is the `Tenant` INSERT policy.
  **None decides this question. No duplicate.**

**External, primary sources, accessed 2026-08-02.** Every page was treated as data; none
contained anything addressed to an agent.

- PostgreSQL, `CREATE POLICY` — <https://www.postgresql.org/docs/current/sql-createpolicy.html>
  — "All permissive policies which are applicable to a given query will be combined together
  using the Boolean 'OR' operator."; "Typically an `UPDATE` command also needs to read data
  from columns in the relation being updated (e.g., in a `WHERE` clause …). In this case,
  `SELECT` rights are also required on the relation being updated, and the appropriate
  `SELECT` or `ALL` policies will be applied in addition to the `UPDATE` policies."; "Any
  rows for which the expression returns false or null will not be visible to the user (in a
  `SELECT`), and will not be available for modification (in an `UPDATE` or `DELETE`)."; "`ALL`
  is the default." — the first sentence is the blast-radius fact, the second is why
  `session_tenant_select` must stay, and the third is why an unset variable fails shut.
- PostgreSQL, System Administration Functions —
  <https://www.postgresql.org/docs/current/functions-admin.html> — "If there is no such
  setting, `current_setting` throws an error unless `missing_ok` is supplied and is `true`
  (in which case NULL is returned)."; "If `is_local` is `true`, the new value will only apply
  during the current transaction."
- NIST SP 800-63-4, *Digital Identity Guidelines: Authentication and Authenticator
  Management* — <https://pages.nist.gov/800-63-4/sp800-63b.html> — "A definite
  reauthentication overall timeout SHALL be established, which SHOULD be no more than 30 days
  at AAL1. An inactivity timeout MAY be applied but is not required at AAL1."; and at AAL2,
  "no more than 24 hours" with an inactivity timeout of "no more than 1 hour". **This is
  revision 4, published September 2025; the original SP 800-63B was withdrawn 2025-08-01.**
- OWASP Session Management Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html> —
  "Common idle timeouts ranges are 2-5 minutes for high-value applications and 15-30 minutes
  for low risk applications."; absolute "between 4 and 8 hours" for a full-day office worker.
- PCI Security Standards Council FAQ on requirement 8.2.8 —
  <https://pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/what-is-the-purpose-of-pci-dss-requirement-8-2-8-which-requires-users-to-reauthenticate-after-15-minutes-of-idle-time/>
  — 15 minutes idle, scoped to accounts that can reach cardholder data, with an explicit
  carve-out for point-of-sale terminals handling one card number at a time. **Out of scope
  today; the named future trigger.** A secondary write-up was also surfaced during research
  and is deliberately not cited.

**Searched for and not found, where the absence mattered:**

- **No primary source documents the reset value of a PostgreSQL *customised* option (a
  `foo.bar` placeholder) after a transaction that set it with `is_local => true` ends** —
  specifically, whether `current_setting(…, true)` then returns NULL or the empty string.
  Record 027 hit an adjacent gap and settled it by demonstration. Rather than assert an
  answer, this record makes the question irrelevant with `nullif(…, '')` on the two policies
  where an empty string could match a real value. The absence is recorded because a future
  reader will otherwise wonder why the wrapper is there.
- **No source was found describing a "pre-authentication lookup under RLS" pattern that does
  not reduce to one of the five options scored above** — a dedicated variable, a
  `SECURITY DEFINER` function, a bypass role, a separate connection, or keying a policy on a
  value the caller supplies. The absence is worth recording because it means option 1 is not
  a trick borrowed from elsewhere; it is the ordinary reading of the per-command policy
  table, and its safety comes from the lookup being narrower than the general case — one
  row, addressed by a column with a unique index.
