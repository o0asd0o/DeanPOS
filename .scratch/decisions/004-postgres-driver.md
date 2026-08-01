# 004: Kysely talks to PostgreSQL through `pg`, the same driver the sibling project runs

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-01
- **Asked by:** `.scratch/foundation/issues/03-data-layer-and-lane-database.md`

## The question

Kysely runs every database query (ADR-0004), but Kysely does not talk to
PostgreSQL by itself — it needs a driver underneath it. Nothing in any ADR or
decision record had named one. This picks it.

The choice is not cosmetic for two reasons. First, the server runs on **Bun**,
not Node, so "the default Node driver" is an assumption that has to be checked
rather than assumed. Second, area 2 will set the tenant's identity as a
database session variable on the same connection that then runs the query
(ADR-0002). If the driver can hand the statements of one transaction to
different physical connections, tenant isolation breaks silently — one
restaurant seeing another's takings, with no error anywhere.

**Settled elsewhere, not reopened here:** PostgreSQL as the engine
(record 001), and Prisma-owns-schema / Kysely-owns-runtime with
`prisma-kysely` for types (ADR-0004). This record only fills the gap
underneath Kysely.

## What I chose, and why

**`pg` — the standard PostgreSQL driver for JavaScript — with Kysely's
built-in `PostgresDialect`.** No extra dialect package, no third option.

The deciding reason is that we are not guessing. **ApxDenta**, the sibling
project ADR-0008 already copied the backend layout from, runs this exact
combination in production, on Bun, with the same Kysely and the same
`prisma-kysely` setup. Its connection factory
(`/Users/jomelortega/Desktop/personals/ApxDenta/packages/domain/src/db/client.ts`)
is eleven lines and constructs precisely what this record prescribes. Its
server is started with `bun run` in both development and production, and its
CI runs on Bun with no Node fallback — so "does `pg` work on Bun" is not a
question we have to answer from documentation, because a working system
already answers it. The project's own PRD prefers copying a working sibling
over designing, and this is the clearest case of that available.

I checked the Bun-compatibility worry properly rather than taking the
sibling's word for it, because it was the one thing that could have made the
obvious answer wrong. The `pg`-on-Bun bug reports that turn up in a search —
hanging on disconnect, hanging on query, connection refused — are all from the
Bun 1.0 and 1.1 era of 2023 and 2024, and **all of them are closed**. Current
Bun is 1.3.13. Bun's own documentation names `pg` and calls it a "great
option". The only `pg`-related Bun issue still open concerns `pg-native`, an
*optional* native add-on that is not installed unless you ask for it, and we
are not asking for it — so it does not apply, and this record makes that a
no-go so nobody adds it later and inherits the bug.

On the isolation constraint, I read Kysely's driver source rather than trusting
the description. Kysely's PostgreSQL driver takes a single dedicated client out
of the pool with `pool.connect()`, runs `BEGIN`, every statement, and `COMMIT`
on that one client, and only then returns it to the pool. Transaction-affinity
is therefore guaranteed by construction, not by configuration — **there is no
pool setting to get right, and no way to get it wrong from the pool side.**
That satisfies what area 2 needs. The real hazard sits one level up in area 2's
own code and is named in the instructions below, so that it is written down
before anyone hits it rather than after.

The two alternatives both lose to the same argument: neither buys anything this
project needs, and both trade a proven combination for an unproven one. The
`Bun.sql` option is the more tempting of the two, since it is a driver with no
dependency at all — and it is the one I would most want to be right. It is not.
The strongest concrete evidence I found about `Bun.sql` is an **open** Bun issue,
active this year, reporting that its connection pool does not honour its own
`max` setting and leaks connections. That is the precise failure mode that
hangs a lane's test process, in a project whose gate creates and drops a
database per lane on a local machine with no hosted CI. Adopting it would also
mean depending on a single-maintainer community dialect and welding the data
layer to one runtime.

**What would make this wrong:** a `pg` failure on Bun that reproduces in our
lane gate — a hang on `db.destroy()`, or a transaction whose statements land on
different connections. Either one is a reversal trigger, not a bug to work
around, and the reversal is one file.

## The options, ranked

Weights declared before scoring. **Engineering cost/risk ×2** and **evidence
strength ×2**; user, business, and reversibility ×1. Reasoning: nobody sees a
driver, and all four options are equally reversible behind `createDb`, so those
criteria barely discriminate. What separates them is whether the thing
demonstrably works on our runtime and what it costs to keep working. Weights
were not changed after scoring. Maximum is 35.

| Rank | Option | User | Business | Eng cost/risk ×2 | Reversibility | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ------------- | ----------- | ----- |
| 1 | **`pg` + built-in `PostgresDialect`** | 5 | 5 | 5 (10) | 5 | 5 (10) | **35** |
| 2 | `postgres.js` + `kysely-postgres-js` | 4 | 3 | 3 (6) | 5 | 3 (6) | **24** |
| 3 | `Bun.sql` + community `kysely-bun-sql` | 2 | 2 | 2 (4) | 4 | 2 (4) | **16** |
| 4 | Defer — decide when area 2 needs it | 1 | 1 | 1 (2) | 5 | 1 (2) | **11** |

This one is not close, and I want to be clear that the gap is real rather than
manufactured: option 1 is the only one with a production system behind it on
our runtime, and it is simultaneously the option with the fewest packages.
That combination is rare enough to be worth naming.

**1. `pg` with Kysely's built-in `PostgresDialect` — chosen.** Two packages
(`pg` at runtime, `@types/pg` for types), MIT, no dialect package because
Kysely ships the dialect itself, and no build or runtime configuration change.
Perfect evidence score: the sibling runs it on Bun in production, Kysely's own
source confirms the transaction-affinity property area 2 depends on, and Bun's
documentation endorses the package by name.

**2. `postgres.js` via `kysely-postgres-js`.** A genuinely respectable option
and the one to move to if `pg` ever disappoints. `postgres.js` is actively
maintained (3.4.9, April 2026) and the dialect is published by the Kysely
organisation itself under MIT with a low open-issue count, so this is not a bus-
factor-one gamble. It ranks second on plain arithmetic: it adds a third package
to the chain, it introduces a second set of connection semantics nobody here has
operated, and it earns nothing in exchange — there is no problem with `pg` that
it solves for us. Its evidence score of 3 is not a criticism of the package; it
reflects that no evidence connects it to *this* project's runtime and gate the
way the sibling connects `pg`.

**3. `Bun.sql` via the community `kysely-bun-sql` dialect.** The zero-dependency
appeal is real and I took it seriously. Three things sink it. The open,
currently-active Bun issue reporting that `Bun.sql`'s pool ignores its `max`
and leaks connections lands directly on ADR-0006's local gate, where a leaked
pool is a hung test run rather than a slow one. The dialect is one individual's
project outside the Kysely organisation. And it welds the data layer to Bun —
today that is free, because Bun is the runtime; it stops being free the moment
that changes, and unlike the other options it makes that change expensive. Bun
itself does not claim `Bun.sql` supersedes `pg`; its docs say the opposite.

**4. Defer.** Included because it must be, and it loses on the facts rather than
on principle. `createDb` is issue 03's actual deliverable and cannot be written
without a driver, so deferring does not postpone the decision — it blocks the
foundation and hands the choice to whichever implementer hits it first, at
speed, without this research. Note that 5 of its 11 points come from
reversibility, which any do-nothing option maximises trivially. Left visible
rather than tuned away.

## How to turn it back

Cheap now, and it stays cheap — this is the rare decision whose reversal cost
does **not** grow with the code built on top of it, and that is worth stating
because it is the reason the stakes are survivable.

The reason is `createDb` itself. Issue 03 makes "exactly one function opens a
connection" an acceptance criterion, and ADR-0008 fixes that function at
`packages/backend/src/db/client.ts`. Every query in every area receives a
`Kysely<DB>` and never learns what is underneath it. So:

1. Write a superseding record naming the new driver, and flip this record's
   `Status:` to `overturned` with the date and the reason.
2. Edit **one file**, `packages/backend/src/db/client.ts` — swap the dialect
   construction. The exported signature `createDb(...) → Kysely<DB>` does not
   change, so **no caller changes**, however many areas have shipped by then.
3. Swap `pg` and `@types/pg` for the replacement in
   `packages/backend/package.json`. If the replacement needs a dialect package,
   add it there too.
4. Re-run the gate. A lane creating, migrating, reading, and dropping its own
   database exercises the whole driver path, so a driver regression shows up as
   a failing gate rather than as a production surprise.

**The one thing that could make step 2 not enough**, and the thing to check
before promising this reversal: whether anything has since imported from `pg`
*outside* `client.ts` — a `pg` type in a function signature, or a `PoolClient`
passed around. Nothing should, and issue 03's grep criterion is what keeps it
true. Grep for `from "pg"` first; if that returns one file, this reversal is a
one-file change and the estimate holds. If it returns several, the reversal
costs whatever those several cost, and the boundary has already eroded.

## What the implementer does

Exact, so nothing here is re-decided downstream.

**Packages.** Both in `packages/backend/package.json`, and **only** there — not
in `apps/api`, which receives the `Kysely<DB>` instance and never constructs
one. (ApxDenta declares `pg` in both its domain package and its server app;
that is one of the things not to copy, because DeanPOS's `apps/api` has no
reason to reach the driver.)

```json
"dependencies": {
  "pg": "8.22.0"
},
"devDependencies": {
  "@types/pg": "8.20.3"
}
```

`pg` is a plain runtime **`dependency`** — it is what executes queries.
`@types/pg` is types only and is a **`devDependency`**. `pg` is MIT, engines
`node >= 16`, and pulls a small first-party tree (`pg-pool`, `pg-protocol`,
`pg-types`, `pg-connection-string`, `pgpass`, `pg-cloudflare`).

**No catalog pin.** Exact versions go directly in `packages/backend`, no
`"catalog:"` reference. The catalog's demonstrated purpose in this repo is one
version across *several* declaring workspaces — `vite-plus` is shared by every
workspace, and record 002 catalog-pinned `fast-check` explicitly because four
more areas will declare it later. Neither applies here: `packages/backend` is
the only workspace that will ever declare `pg`, because it holds the only
function that opens a connection. A catalog entry with one consumer is
indirection with no payoff. **Trigger to revisit:** the moment a second
workspace needs `pg`, catalog-pin it — but treat that need as a signal the
choke point has been breached, and check that before adding the pin.

**Dialect.** `PostgresDialect`, imported from `kysely` itself. Do **not** add
a dialect package. The factory is ApxDenta's, unchanged:

```ts
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

const dialect = new PostgresDialect({
  pool: new Pool({ connectionString: databaseUrl, max: 10 }),
});
return new Kysely<DB>({ dialect });
```

**Transaction-affinity for area 2's tenant variable — read this before writing
area 2.** The question "must the pool be configured to guarantee affinity" has
a definite answer: **no, and there is no such setting.** Kysely's
`PostgresDriver` calls `pool.connect()` to take one dedicated client, runs
`BEGIN`, every statement, and `COMMIT` on that same client, and releases it only
afterwards. A transaction's statements cannot be split across connections. The
`max: 10` above is a pool size, not a correctness control — change it freely.

The hazard is elsewhere, and it is in area 2's own SQL, so it is written down
here in advance:

- Set the tenant variable **transaction-locally**, with
  `set_config('app.tenant_id', $1, true)` — the third argument `true` is what
  makes it local to the transaction. A bare `SET` (or `set_config(..., false)`)
  persists on the pooled connection after it is released, and the next request
  to borrow that connection inherits another tenant's identity. That is the
  tenant leak ADR-0002 exists to prevent, and the pool is what makes it
  reachable.
- It must run **inside** `db.transaction().execute(...)`, per ADR-0002 and
  ADR-0008. Set outside a transaction, it lands on an arbitrary borrowed
  connection and protects nothing.
- **No-go:** do not put a connection pooler in *statement* mode (PgBouncer and
  similar) between the app and PostgreSQL. Transaction mode preserves
  `SET LOCAL`; statement mode does not, and would break isolation without any
  code change. Not a concern today — production is Docker Compose — but it is
  the kind of infrastructure addition that looks harmless later.

**Lane shutdown.** Every test that calls `createDb` must `await db.destroy()`
in teardown. Kysely's `destroy()` calls `pool.end()`, which drains the pool and
lets the process exit; skipping it leaves open sockets and hangs the lane.
ApxDenta does exactly this in its tests, and ADR-0006's local gate makes it
mandatory rather than tidy.

**No-go: `pg-native`.** Do not install it, and do not enable it. It is an
optional peer of `pg` and is absent unless explicitly added. It has an open Bun
incompatibility (a native-binding load failure on Bun 1.3.10+), so adding it
would import a live bug for a performance benefit this project has not measured
a need for. The pure-JavaScript `pg` path is the supported one on Bun.

**PostgreSQL version.** No constraint. `pg` 8.22.0 works against local 18.3 and
the Docker Compose production instance; PostgreSQL 18 introduced no client-side
change that affects it, and SCRAM-SHA-256 has been supported since `pg` 7.9.
Nothing in this record pins a PostgreSQL major.

**Front-end leakage.** `pg` cannot reach a browser bundle, on one condition
that must hold: `apps/pos` must not depend on `packages/backend`. Today it does
not — `apps/pos` reaches the server through `packages/contract`, and neither
`packages/contract` nor `packages/schemas` will depend on `packages/backend`.
Declaring `pg` in `packages/backend` alone is therefore sufficient. **Honest
gap:** nothing mechanically enforces this. ADR-0008 states the boundary in the
other direction only (`packages/backend` must not depend on `apps/api`), and
there is no lint rule, dependency-cruiser config, or gate step enforcing either
direction. It is prose. That is not this record's question to fix, but issue 03
already requires a grep proving there is no second connection path, and the same
grep step is the natural place to also assert that no front-end workspace
resolves `packages/backend`. Flagging it for whoever writes that criterion.

## Evidence

**Repository, read 2026-08-01:**

- `/Users/jomelortega/Desktop/personals/ApxDenta/packages/domain/src/db/client.ts`
  — the sibling's factory: `PostgresDialect` over `new Pool({ connectionString, max: 10 })`,
  nothing Bun-specific in it.
- ApxDenta `apps/server/package.json` — `"dev": "... bun run --hot src/index.ts"`,
  `"start": "bun run dist/src/index.js"`; `pg: ^8.13.1`. Its `.github/workflows/ci.yml`
  uses `oven-sh/setup-bun@v2` with no Node fallback, and `apps/server/src/index.ts`
  exports Bun's native `{ port, fetch, hostname }` server shape. This is what
  establishes that `pg` runs under Bun rather than under Node.
- ApxDenta `inventory.test.ts:149`, `stocks.test.ts:138` — `await db.destroy()`
  as test teardown; no explicit `pool.end()` anywhere.
- `docs/adr/0004-prisma-schema-kysely-runtime.md`, `docs/adr/0002-tenant-isolation-shared-db-with-rls.md`,
  `docs/adr/0008-backend-module-structure.md`, `.scratch/decisions/001-database-engine.md`,
  `.scratch/foundation/issues/03-data-layer-and-lane-database.md`, root `package.json`.
- `.scratch/decisions/` searched for an existing driver record before deciding:
  001, 002, 003 only. None names a driver.

**External, accessed 2026-08-01:**

- Kysely `PostgresDriver` source —
  https://raw.githubusercontent.com/kysely-org/kysely/master/src/dialect/postgres/postgres-driver.ts
  — `acquireConnection` calls `pool.connect()` for a dedicated client;
  `beginTransaction`/`commitTransaction`/`rollbackTransaction` execute on that
  same connection; `releaseConnection` calls `client.release()`; `destroy()`
  calls `pool.end()`. This is the primary source for the transaction-affinity
  claim and for the `db.destroy()` teardown requirement.
- `pg` on npm — https://registry.npmjs.org/pg/latest — 8.22.0, MIT,
  `engines.node >= 16`, `pg-native` optional.
- `@types/pg` on npm — https://registry.npmjs.org/@types/pg/latest — 8.20.3.
- Bun SQL documentation — https://bun.sh/docs/api/sql — states you can use
  "postgres.js, pg, and node-postgres in Bun too. They're great options."
  Quoted as data, not instruction.
- Closed `pg`-on-Bun issues, all verified closed:
  https://github.com/oven-sh/bun/issues/6121 (opened 2023-09-27, closed 2023-10-14),
  /6071 (closed 2023-10-14), /5499 (closed 2023-09-16, not planned),
  /11205 (closed 2024-06-29), /10273 (closed 2026-07-24).
- Open and **not applicable**: https://github.com/oven-sh/bun/issues/28131 —
  `pg-native` native-binding failure on Bun 1.3.10+. Applies only to the
  optional native add-on, which this record forbids.
- Open and **counting against option 3**:
  https://github.com/oven-sh/bun/issues/23215 — `Bun.sql` PostgreSQL pool does
  not enforce `max`, connections grow unbounded. Opened 2025-10-03, still active
  in 2026.
- `kysely-postgres-js` — https://github.com/kysely-org/kysely-postgres-js —
  3.0.0, MIT, published under the Kysely organisation, 3 open issues.
- `postgres.js` — https://github.com/porsager/postgres — 3.4.9, released
  2026-04-05, actively maintained.
- `kysely-bun-sql` — https://github.com/lacion/kysely-bun-sql — community
  dialect for `Bun.sql`, single maintainer, outside the Kysely organisation.

**Searched for and not found, where the absence mattered:**

- Any PostgreSQL 18-specific caveat for `pg`, in its CHANGELOG, its releases, or
  the PostgreSQL 18 release notes. Nothing. This absence is why the record states
  no version constraint rather than hedging.
- Any first-party Kysely dialect for `Bun.sql`. Kysely ships none; only the
  community package above exists.
- Any stated rule in this repository about what belongs in the root `catalog`.
  None exists — ADR-0001 and issue 01 explain why `vite-plus` is pinned but
  state no general rule. The no-catalog-pin decision above is therefore reasoned
  from the two existing precedents, not from a documented convention, and is
  the part of this record most reasonable to disagree with.
