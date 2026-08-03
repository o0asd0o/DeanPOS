# 062: The wrong-tenant probe coverage guard walks the contract at run time and links a probe to a procedure by a tag in the test name — and the teeth are in the helper, not the guard

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-04
- **Asked by:** `.scratch/tenancy-identity/issues/13-wrong-tenant-probe-coverage-guard.md`

## The question

Every procedure must have a test proving one restaurant cannot reach another's data. Today that is a
habit, and the habit failed in **ten of this area's twelve issues** — a probe existed, passed, and
proved nothing. How does a test make it mechanical, and how much of "the probe is a real probe" can a
machine actually check?

## What I chose, and why

**Three parts, and the third is the one that matters.**

**1. The guard imports the contract and walks it at run time.** `contract.ts` is a plain nested
object, and `@orpc/contract@1.14.13` exports a type guard, `isContractProcedure`, verified present in
the installed build — so the walk is a nine-line recursion over `Object.entries` using the vendor's
own leaf test, not a hand-rolled marker check and not a parser. A procedure added tomorrow appears
with no wiring. Static parsing was never in contention: `typescript@7.0.2` no longer exposes
`ts.createSourceFile` at its main entry, so an AST means hand-rolling one, and a hand-rolled parser
of an object literal is worse at the one job — it cannot see a procedure added by a spread or helper.

**2. A probe is linked to a procedure by a tag in its own test name:**
`it("wrong-tenant probe [store.update]: …")`. The guard checks the link **both ways** — every contract
path needs a tag, and every tag must name a real path. Rename `store.update` and the build breaks
that day, in the right place, with the right message. The ceremony is one bracketed token, which is
what makes it survivable in eight areas' time; every alternative asks a future author to remember
something, and this area has just demonstrated twelve times that they won't.

**3. The honest part.** A guard built only from parts 1 and 2 proves a probe *exists* — and would have
passed all ten shipped defects. So the assertions move into `expectWrongTenantRefusal`, which already
exists with 17 call sites, and it stops accepting a caller-supplied opinion about what counts as
refusal. It now takes the owner's result as a required argument and asserts three things the caller
cannot fake: **the owner's result is not empty**, the other Tenant's result **is not equal to it**,
and the other Tenant's result matches a shipped refusal shape. The first kills the most common defect
— a probe asserting the wrong Tenant reads `null` passes against a table with no rows in it; a probe
that must first show the owner reading a real row does not.

**What this cannot catch, flatly, because overselling it is worse than not building it.** The helper
receives a *value*. It cannot see that the value came from a procedure call as the owning Tenant
rather than from `ownerDb`, and it cannot know whether you passed the whole payload or one field of
five. Of the three recurring failure modes: the empty-answer one is **closed**; seeding through the
owner connection is **partly** closed (the row must exist and be non-empty, but is not proven
reachable by its owner); partial column coverage is **not closed at all**. Both residuals stay with
review, and rule 11 says so in the words a reviewer reads. Forbidding `ownerDb` inside a probe block
was considered and refused — shipped probes legitimately use it to assert rows are hidden from the
app-role connection (`device.test.ts:940`).

**The cost, up front: this issue is mostly a retrofit.** ~34 existing probes gain a tag and route
their assertion through the helper. That work *is* issue 13; a guard that skips it is the guard that
passes ten defects.

**Weights, declared before any option existed and not changed afterwards.** User impact ×2 (the
failure guarded against is a cross-tenant leak, the worst outcome this product has); business ×1 (no
revenue spread, and the trust effect is the same fact as user impact — counting it twice would be
dishonest); engineering cost and risk ×3 (eight areas and hundreds of procedures inherit this, so
ceremony compounds — this is where the question lives); reversibility ×2 (a convention every later
area copies is cheap now, dear later); evidence ×2 (it rests on what `@orpc/contract` actually
exports and what Vitest actually isolates, where being 90% right is being wrong). Maximum 50.

## The options, ranked

| Rank | Option | User ×2 | Business | Eng cost/risk ×3 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ------------- | ------------- | -------- | ----- |
| 1 | **Tag in the test name + required helper call; contract walked at run time** | 5 (10) | 4 | 4 (12) | 4 (8) | 5 (10) | **44** |
| 2 | Count `expectWrongTenantRefusal` call sites, no path link | 1 (2) | 3 | 5 (15) | 4 (8) | 2 (4) | **32** |
| 3 | Runtime registration helper, written to a file, checked in `globalTeardown` | 5 (10) | 4 | 2 (6) | 3 (6) | 3 (6) | **32** |
| 4 | Do nothing — keep the habit and the review | 1 (2) | 2 | 5 (15) | 5 (10) | 1 (2) | **31** |
| 5 | Static analysis of test bodies to infer which procedure a probe covers | 4 (8) | 3 | 1 (3) | 2 (4) | 2 (4) | **22** |

**1 — chosen.** Engineering cost is 4 rather than 5 only because of the retrofit; the standing cost on
every future area is one bracketed token.

**2 — count the helper's call sites.** The cheapest thing that could work, and it does not. **A call
site does not say which procedure it covers**, so the guard could report "there are 17 probes" and
never report *which* procedure is uncovered — the whole of criterion 1. Hence user impact 1. It ranks
second purely on costing nothing; that is the shape of the trade-off, not an endorsement.

**3 — a runtime registry.** The genuine runner-up on correctness: probes call
`registerProbe("store.update")`, a teardown check compares the set against the contract. It loses on
mechanism — Vitest isolates test files per worker, so a module-scope registry is not shared and the
design needs a temp file plus `globalTeardown` wiring, and it makes the verdict depend on the whole
suite having run, so `vitest run <one file>` fails spuriously. That is how a gate gets skipped later.

**4 — do nothing.** It wins both cost criteria outright, honestly: zero work, nothing to reverse. It
loses on the two weighted for exactly this — **ten defects in twelve issues is measured evidence the
habit does not hold**, which is why evidence scores 1.

**5 — infer the procedure from the test body.** No ceremony at all, and last because a probe
legitimately calls several procedures (`store.update`'s reads back through `store.get`), so inference
is guesswork, and a guard that guesses wrong trains people to work around it.

**Is it close?** Between 1 and the rest, no — 12 points. Between 2, 3 and 4 it is a scramble in the
low thirties, and that is real: all three are cheap options that do not meet criterion 1.

## What the implementer builds

**Guard:** `apps/api/tests/wrong-tenant-probe-coverage.test.ts`. Imports `contract` from
`contract/src/contract.ts` and `isContractProcedure` from `@orpc/contract`; scans
`apps/api/tests/**/*.test.ts` with `node:fs`, following `payment-method-no-name-branch-grep.test.ts`'s
file collection. The block extractor walks paren depth from the `it(` opening paren, skipping string
and template literals — the technique `pin-no-logging-grep.test.ts` already hand-rolls. Copy the
technique; do not import across test files and do not refactor that file (code standard 1).

Five static checks, with these exact failure messages:

| Check | Message |
| --- | --- |
| Every contract path has a tag | `wrong-tenant probe coverage: no probe for "<path>". Add a test named: wrong-tenant probe [<path>]: <what it proves>` |
| Every tag names a real path | `wrong-tenant probe coverage: tag [<path>] names no procedure in the contract. Retag it or delete it.` |
| The block calls the procedure | `wrong-tenant probe coverage: the probe tagged [<path>] never calls <path>.` |
| The block calls the helper | `wrong-tenant probe coverage: the probe tagged [<path>] does not call expectWrongTenantRefusal.` |
| Not skipped | `wrong-tenant probe coverage: the probe tagged [<path>] is skipped.` — rejects `it.skip`/`it.todo`/`test.skip` on a tagged test, and `describe.skip` anywhere in a file holding a tag |

**Helper:** `apps/api/src/wrong-tenant-probe.ts`, rewritten to one object argument
`{ path, mode, ownerSees, otherGets, otherOwn?, why? }`. `otherGets` is a thunk so a thrown
`ORPCError` is caught. `mode` is **required**, never defaulted. Runtime assertions, in order:

1. `ownerSees` is non-empty — not `null`/`undefined`, not `[]`, not `{ok:false}`, not
   `{authenticated:false}`: `wrong-tenant probe [<path>]: ownerSees is empty — an empty result is
   also the authorised answer, so this probe would pass against a table with no rows in it.`
2. The other Tenant's result is not deep-equal to `ownerSees`:
   `wrong-tenant probe [<path>]: the other Tenant received the owner's own result.`
3. Mode-specific:
   - `"refusal"` — `null`, `[]`, `{ok:false}`, `{authenticated:false}`, or a thrown `ORPCError` with
     code `NOT_FOUND`: `wrong-tenant probe [<path>]: expected a refusal shape (null, [], {ok:false},
     {authenticated:false}) or NOT_FOUND, received <value>.` The existing check that a `NOT_FOUND`
     message must not confirm existence (`/tenant|exists/i`) is **kept verbatim**.
   - `"confined"` — for a procedure with no addressable id, where the other Tenant legitimately gets
     its *own* data: requires `otherOwn`, result must be non-empty and deep-equal it.
     `wrong-tenant probe [<path>]: mode "confined" requires the other Tenant's result to equal otherOwn.`
   - `"shared"` — both non-empty and deep-**equal**; requires `why` of at least 20 characters.
     `wrong-tenant probe [<path>]: mode "shared" requires both Tenants to receive identical data.`

**No caller-supplied `isRefusal` predicate survives.** That parameter was the dishonesty hole; refusal
shapes are a fixed list owned by the helper.

## The sweep, and the exclusions

**There is no exclusions list, and none may be created.** Criterion 4 is met in its strongest form —
all **39** procedures are covered. The awkward cases, enumerated honestly against the contract:

| Procedure | Handling | Reason |
| --- | --- | --- |
| `ping` | `mode: "shared"` | **The only genuinely tenant-neutral procedure.** Verified, not assumed: `getPing` is `selectFrom("Ping").selectAll()` with no tenant predicate, and the spine migration grants `SELECT ON "Ping"` with no `tenant_id` column and no RLS policy. A `shared` probe asserts both Tenants receive identical output — a real assertion that **fails the day `Ping` gains a tenant column**, which an exclusion would not. |
| `platformAdmin.provisionTenant` | `mode: "refusal"` | Deliberately cross-tenant, but its existing probe is right: a tenant-scoped principal is refused. `ownerSees` is a platform admin's successful provision. |
| `auth.signIn`, `terminal.enrol` | `mode: "refusal"` | Unauthenticated, but both have a real tenant dimension already probed — the session lands on the account matched; enrolment lands in the code's own Tenant. |
| `settings.*` and every `list` | `mode: "confined"` | No addressable id, so refusal is not the shape; the assertion is that each Tenant gets its own. |

**Newly uncovered, found by this analysis and part of the sweep:** `device.pendingCodes`,
`device.cancelCode` and `device.generateCode` have no wrong-tenant probe at all today.
`store.create`, `user.create` and `paymentMethod.create` have probes that do not route through the
helper. Everything else needs the tag and the helper call added.

## Where the convention is documented

`docs/agents/code-standards.md`, as **rule 11** — that file is read by `implementer`, `fixer` and
`reviewer`, the three roles that write and judge procedures. Its preamble says "Nine rules" while the
file holds ten sections; replace that count with "Eleven rules" in the same edit. Exact text is in
the hand-back message.

## Smaller calls, all reversible in one commit

**Tag syntax is bracketed** (`[store.update]`, not `: store.update —`) so a dotted path in prose
cannot false-match. **Scan root is `apps/api/tests/**/*.test.ts`**, where probes live today; widening
it is one line. **The guard file is not named `-grep`** unlike its four siblings, because it walks a
live object as well as scanning text.

## What must not be built

- **No exclusions list — not even one entry.** A tenant-neutral procedure takes `mode: "shared"` and
  a written `why`. The moment a list exists it grows.
- **No caller-supplied predicate for what counts as a refusal.**
- **Never widen the guard to make a rename pass.** A renamed procedure failing is the guard working.
- **No `it.skip` or `it.todo` on a tagged probe** — explicitly rejected, because a skipped probe
  otherwise satisfies the tag perfectly.

## How to turn it back

**The guard alone:** delete `apps/api/tests/wrong-tenant-probe-coverage.test.ts` and remove rule 11
from `docs/agents/code-standards.md`. One commit. The tags stay in the test names as inert prose and
cost nothing. This is what the reversibility score of 4 is measured against.

**The helper's signature** is the expensive half and the reason the score is not 5: ~34 call sites in
~14 files under `apps/api/tests/`. Reverting means restoring the two-argument form and re-inlining
each probe's owner-side assertion. All are tests — **no product code imports
`expectWrongTenantRefusal`**, verified, zero non-test call sites. No migration, no schema, no
contract change, nothing to unwind. What accretes on top is probes in eight later areas carrying the
tag; those remain valid tests with or without the guard, so the accreted cost is a token in a name.

## What would make this decision wrong

- **The first time someone satisfies the guard dishonestly** — a tag on a probe whose `ownerSees` is a
  hand-made object literal. The guard cannot see it. If it happens twice, the answer is not a cleverer
  guard; it is that the owner side must come from a named helper the guard can require.
- **A future area's procedures live outside `apps/api/tests/`.** The scan root goes wrong silently —
  the guard reports missing probes that exist. Widen the scan root; never add an exclusion.
- **`@orpc/contract` drops or renames `isContractProcedure`.** Public today at 1.14.13, but the
  package's own `.d.ts` shows sibling exports already carrying `@deprecated` renames
  (`AnyContractProcedure`, `getContractRouter`), so this is a live upgrade risk. The fallback is a
  `"~orpc" in value` check — the same test the guard performs internally.
- **A procedure appears whose tenant dimension nobody can state.** That is a design problem, and it
  goes to a record rather than to `mode: "shared"`.

## Evidence

**Repository, read 2026-08-03/04**, relative to the repo root on branch `main`:

- `packages/contract/src/contract.ts` — the enumeration source. **39 procedures counted by hand:**
  `ping` 1, `store` 6, `user` 8, `paymentMethod` 5, `settings` 2, `platformAdmin` 1, `auth` 4,
  `device` 6, `terminal` 5, `override` 1.
- `apps/api/src/wrong-tenant-probe.ts` — the existing helper, read in full; its caller-supplied
  `isRefusal` predicate is the parameter this record removes.
- `apps/api/tests/` — all 34 files enumerated, every `wrong-tenant` test name read verbatim. **The
  finding that sets Q2:** the names are inconsistent (some open `the wrong-tenant probe:`, some
  `wrong-tenant probe:`) and **none names its procedure path**, so no convention exists to inherit and
  one must be established. 17 helper call sites across ~34 probes; **zero outside tests.**
- `apps/api/tests/tenant-settings.test.ts:147,328` — the best-shaped probes in the repo, and the model
  for `mode: "confined"`.
- `apps/api/tests/pin-no-logging-grep.test.ts:50-79` — the paren-depth scanner this guard's block
  extractor copies, and the precedent for a guard testing its own scanner
  (`describe("scanner regressions")`), which this guard should follow.
- The four shipped mechanical gates (`payment-method-no-name-branch-grep`, `runtime-portability-grep`,
  `import-style-grep`, `tenant-isolation-grep`) all use `node:fs` under Vitest's default `node`
  environment — confirming this runs inside `vp run --no-cache -r test` with no separate command.
- `packages/backend/src/ping/db-operations/queries/get-ping.query.ts` and
  `migrations/20260802065946_tenant_isolation_spine/migration.sql:48-49` — the two facts that make
  `ping` tenant-neutral rather than merely unprobed.
- `node_modules/.bun/@orpc+contract@1.14.13+…/dist/shared/contract.TuRtB1Ca.d.ts:204-212` and
  `dist/index.d.ts` — **verified in the installed build, not from documentation about it:**
  `declare class ContractProcedure { '~orpc': ContractProcedureDef… }`,
  `declare function isContractProcedure(item: unknown): item is AnyContractProcedure`, re-exported
  publicly as `p as isContractProcedure`. This is the fact Q1 turns on.
- `.scratch/decisions/031-how-a-query-with-no-tenant-reads-a-row.md` — read in full. Its closing
  finding is this record's premise: *"The test's letter passes while the property it defends does
  not."* Nothing in it constrains this design.
- `docs/agents/code-standards.md` — rule 1 (hence no refactor of `pin-no-logging-grep.test.ts`),
  rule 5's three-line comment ceiling, and the preamble's stale "Nine rules" against ten sections.

**Searched for and not found, where the absence mattered:**

- **`@orpc/contract` exports no traversal utility** — no `traverseContractProcedures` or equivalent
  yielding a procedure with its path. Checked the installed `dist` and the official docs. This is why
  the guard hand-writes a nine-line recursion, and recording it stops a later reader assuming one was
  missed.
- **No prior art for "enumerate an RPC contract and assert per-procedure test coverage"** as a
  published pattern, in oRPC's docs or elsewhere. The design is assembled from this repository's own
  precedents rather than borrowed — worth knowing before trusting it.
- **No existing record decides this question.** 001–061 checked; 031 and 047 are nearest and both
  decide RLS behaviour, not test coverage. No duplicate.
