# Handoff — `tenancy-identity`, issues 01–04

> **Superseded section below.** The original handoff covered 01–03. Issues **03a** and **04** have
> since merged and **QA checkpoint A was deferred without being run**. Read this block first; the
> older text after it is still accurate for 01–03.

## Update, 2026-08-03

| | |
|---|---|
| **Merged** | 01, 02, 03, 03a, 04 — all closed, `main` green at **311** tests |
| **In progress** | **nothing** — no agent running, no worktree open, no lane database |
| **Next** | issue **05** (Store management), unblocked; then 06, 07, 08 |
| **QA checkpoint A** | **DEFERRED — not run, not passed.** See `QA-PLAN.md`; no verdict was recorded because none was earned |

**Checkpoint B now covers 01–08, not 05–08**, unless A is run first. The unverified surface is
named in `QA-PLAN.md` — the important one is that **sign-in has never been exercised in a real
browser**, and the `happy-dom` cookie blind spot has already hidden exactly that bug once.

### Decisions made since the last handoff — both `Stakes: high`, both taken by the human directly

- [**034** — the throttle holds under concurrency](../decisions/034-the-throttle-under-concurrency.md).
  The shipped ordering read the counter, ran a **measured 259 ms** `scryptSync` blocking the whole
  API, then wrote the counter — so N concurrent requests all read "not locked" and all reached the
  hash. The reservation is now the check: one atomic upsert before the hash, released by
  **decrementing** on success, never clearing.
- [**035** — the self-lifting lock is deferred to `hardening`](../decisions/035-the-throttle-lock-is-deferred-to-hardening.md).
  Implementing 034 also removed record 033's lock. Refused attempts now advance `updated_at`, so an
  attacker attempting once every 29 minutes keeps a known address locked indefinitely. **Merged
  knowingly**; the fix, the dead `locked_until` column, and the missing test are all named on
  `.scratch/hardening/PRD.md`.

### Three invariants issue 04 added — do not undo them

8. **`UserRole` is the sole authority for the live gate.** `User.role` is a display copy read by
   nothing. **Issue 06 must write both in the same transaction** or the copy silently diverges.
9. **A `User` with no `UserRole` row cannot sign in** — refused with the same indistinguishable
   `{ ok: false }`, and **no `Session` row is created**. This is by design; no backfill was written.
10. **`UserRole` and `UserStore` are append-only structurally** — `FOR SELECT` / `FOR INSERT`
    policies only, plus `REVOKE UPDATE, DELETE`. Their foreign keys are **composite**
    `(tenant_id, user_id)` / `(tenant_id, store_id)`, because plain FK checks bypass RLS.

### Two traps found this session, worth not repeating

- **`vp run -w migrate` cache-hits and prints "All migrations have been successfully applied"
  without running.** It cost an hour. Migrate directly instead:
  `set -a && . ./.env && set +a && cd packages/backend && bunx prisma migrate deploy --schema=src/db/prisma/schema.prisma`,
  and verify with `psql "$DATABASE_URI" -c "select count(*) from pg_tables where schemaname='public'"`.
- **`codex exec` hangs on "Reading additional input from stdin…"** when launched detached. Redirect
  `< /dev/null`. A run that hangs this way produces a large `trace.log` and no findings file, which
  reads exactly like a model failure and is not one.

- **An implementer wrote into the main checkout, not only its worktree** (issue 05, 2026-08-03). It
  left `packages/backend/src/db/prisma/schema.prisma` modified on `main` with the lane's own change.
  Caught by the human, verified byte-identical to the lane commit, and discarded — nothing was lost.
  The agent had itself reported that "`Bash` and the `Edit`/`Read`/`Write` tools intermittently read
  from different filesystem views" in that worktree, which is the likely cause.
  **Check `git status` on `main` after every agent returns.** A stray file there is one `git commit -a`
  away from putting unreviewed lane work on the integration branch.

- **`SignInThrottle` rows persist across test runs, and `ip:no-forwarded-for` is a key every test
  shares** (found 2026-08-03). `apps/api/src/app.ts:109` falls back to the literal
  `"no-forwarded-for"` whenever a request carries no `X-Forwarded-For`, which is every test that does
  not set one. Nothing cleans the table, so the count accumulates run over run — `DeanPOS_dev` held
  **124 rows** with that key at `failures: 4`.

  **Consequence: the suite is only reliably green against a fresh database.** Lanes get one, so the
  pipeline never sees it; a developer running the suite twice against `DeanPOS_dev` does. The test
  `a successful sign-in decrements the IP key rather than clearing it` is the one that fails first,
  because it asserts a decrement from a count it assumes it controls.

  **This is a test-isolation defect, not a throttle defect** — the mechanism is behaving exactly as
  records 033/034 specify. The fix belongs with whoever owns the seam: either give each test its own
  forwarded address, or clean the table in `afterAll` the way the other suites clean theirs.

### Open for the human

- **`DeanPOS_dev` holds 2 `User` rows with no `UserRole` row.** They are stale test residue and they
  can no longer sign in. Harmless, but that is why, not a bug.
- **The password-record divergences are DEFERRED TO v2 by the human, 2026-08-03.** Not lost, not
  fixed. [Record 032](../decisions/032-the-password-policy.md) still reads `Status: decided` and is
  titled "fifteen characters and no other rule"; the code disagrees with it in two places, and both
  are deliberate:
  - **`PASSWORD_MIN_LENGTH` is 8, the record says 15** (commit `6320b07`, which also updated the copy
    and the `minLength` attributes, so the code is at least self-consistent). Record 032's central
    argument is that 8 is the allowance NIST §3.1.1.2 item 1 reserves for systems **with a second
    factor**, and issue 03 puts MFA out of scope for v1; OWASP splits on the same axis independently.
    **Nothing overturned the record in writing** — the divergence is real and undocumented at the
    record itself.
  - **A password reveal toggle now exists** on the sign-in and set-password fields. This one is *not*
    a violation: record 032 called it "**the named follow-up of this record**", deferred only because
    a control's placement, states and accessible name are record 030's screen territory, not a policy
    record's. The toggle landing is the follow-up happening — by hand, without the record.
  - **No strength meter, and it is not deferred to `hardening` or anywhere.** The policy removed every
    composition rule, so a meter would score compliance with rules that no longer exist. The one real
    signal — breach screening — is deferred to **`release-ops`** as a knowingly recorded deviation
    from a NIST `SHALL`.

  **For v2:** one superseding record covering both divergences, flipping 032's status rather than
  editing it in place. Until then, treat 032 as accurate on *reasoning* and stale on *the number*.
- **Decision records are now capped at 300 lines** (`.claude/agents/decider.md`). Records 034 and 035
  are the first written under it. Records 001–033 were deliberately left untouched — rewriting them
  would damage the audit trail that makes reversal real.

---

## Where the run stopped

| | |
|---|---|
| **Merged** | 01, 02, 03 — all closed, both review axes PASS, `main` green |
| **In progress** | **nothing** — no agent running, no worktree open, no lane database |
| **Next** | issue **03a** (recommended first), then **04**, then **QA checkpoint A** (covers 01–04, cap **1** fix round) |
| **`main`** | see `git log`; gate was green at 243 tests, `vp check` 182 files 0 errors |
| **Lane state** | clean — only `DeanPOS_dev` exists, no `DeanPOS_lane_*` |

Two decisions the human delegated are **settled**: records **032** (password policy) and **033**
(sign-in throttling). Both disagreed with the human's stated direction in part — read the
disagreements, they are the useful bit. Their work has a home: **issue `03a`**, newly cut and
`ready-for-agent`.

**Issue `03a` should be run before issue 04.** `auth.setPassword` accepts a one-character
password on `main` today, `provisionTenant` carries a live `.min(8)` that contradicts record 032,
and sign-in is unthrottled — which is a denial-of-service surface as much as a credential one,
because every attempt blocks the whole API for one scrypt derivation.

## Resume command

```bash
git -C /Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS status --short
```

Tree must be clean. Then `/run-prd tenancy-identity` — it selects the lowest-numbered unblocked
issue, which is `03a`. `.orc2/ORCHESTRATOR.md` is the procedure;
`.scratch/tenancy-identity/QA-PLAN.md` **overrides** its QA trigger and round cap for this PRD.

## What each issue actually delivered

**01 — tenant isolation spine.** `Tenant` and `Store`, RLS `ENABLED`+`FORCED` created in the same
migration, restricted role `deanpos_app` (non-superuser, non-`BYPASSRLS`), `set_config(..., true)`
inside `createDb`, and the reusable wrong-tenant probe. 2 rounds.

**02 — platform-admin tenant provisioning.** `User`, `PlatformAdmin`, `PlatformAuditLog`,
`platformAdmin.provisionTenant`, scrypt password hashing, and a `Ctx` discriminated union that
makes "tenant and platform-admin at once" unrepresentable. 1 round, 2 decision records.

**03 — back-office sign-in and session.** `Session` with RLS, sign-in/sign-out/set-password/`auth.me`,
per-request `Ctx` from the session cookie, the exact-`Origin` CSRF gate, idle and absolute expiry,
and the `_gate` / `_shell` route split. 2 rounds, 2 decision records.

## Decisions made during this run — all `Stakes: high`

Read these before touching anything they govern. They are binding until overturned.

| # | Title | Governs |
|---|---|---|
| **027** | The app role's password is a development default with a deployment override | `deanpos_app` credential, `scripts/stack.sh`, applied-migration freeze |
| **028** | Passwords are hashed with `node:crypto` scrypt | all password hashing, both runtimes |
| **029** | A transaction may create exactly the Tenant it is already scoped to | `Tenant` INSERT policy, privileged writes |
| **030** | The back-office sign-in screen, its states and its error copy | sign-in UI, failure copy, sub-1440 behaviour |
| **031** | Two named GUCs for pre-auth lookups | `app.login_email`, `app.session_id`, all pre-auth reads |
| **032** | The password policy — NIST SP 800-63B-4, **15** characters not 8 | `setPassword`, `provisionTenant`, issue 10's PINs |
| **033** | Throttling sign-in — one table, two keys, checked before the hash | `signIn`, `SignInThrottle`, issue 11's server half |

## Invariants — do not undo these

Each was expensive to establish and at least one was already broken once and caught.

1. **Exactly one `set_config` call site**, `packages/backend/src/db/client.ts:29`. Issue 01 states
   a second path makes this area uncompletable. Guarded by `apps/api/tests/tenant-isolation-grep.test.ts`.
2. **`packages/backend/tests/db/with-tenant-scope.test.ts` is locked** — `Tenant` unreachable from
   *any* tenant-scoped connection, not merely another tenant's. Two agents have now tried to
   weaken it; both were stopped.
3. **`app.tenant_id` carries a tenant id and nothing else.** Record 031 overturned an overload that
   also put a session id or an email in it. Pre-auth lookups use `app.login_email` / `app.session_id`.
   A **third** such lookup means `SECURITY DEFINER`, not a third GUC — noted on issue 06.
4. **No runtime branch in the hashing path** — no `typeof Bun !== "undefined"`, no dual
   implementation. Production is Bun, tests are Node; record 028 exists because Bun ships
   `crypto.argon2` as a stub that throws.
5. **`deanpos_app` stays non-superuser and non-`BYPASSRLS`**, and gets no `DELETE` where the domain
   says rows are deactivated or revoked rather than deleted.
6. **Physical column is `tenant_id`** (`@map("tenant_id")`); the generated Kysely field is
   `tenant_id`, the public contract keeps `tenantId`.
7. **Sign-in failure is identical in message *and* timing** between unknown email and wrong
   password. Copy is verbatim: `Email or password is incorrect`, no trailing full stop.

## Traps this run hit — worth not repeating

- **The scratchpad is shared between agents.** A stale `findings.md` from issue 02 made issue 03's
  first review return the wrong issue's verdict. The reviewer refused to forward it, which is the
  only reason it did not merge on a bad review. **Clear the scratchpad between issues.**
- **Fixers hand-patch the lane database** when Prisma's agent-consent guard blocks `migrate reset`,
  and one edited a recorded migration checksum. Both times the fix was to drop the lane database,
  recreate it empty, and re-run migrations — which is the only way to prove the *committed*
  migration stands alone. **Do not accept a fixer's green after it touched the database by hand.**
- **`vp run -r test` caches.** Use `--no-cache` for the gate, or you are replaying an agent's run
  rather than running your own.
- **A red `main` on arrival is usually stale codegen or an uninstalled dependency**, not a defect.
  `vp install && vp run -w codegen` first, every time.
- **`happy-dom` cannot test cookies** — it enforces the WHATWG rule that scripts cannot read or set
  `Cookie`/`Set-Cookie`. This blind spot hid a real bug: sign-in was broken in a real browser while
  236 server-side tests passed. Fixed, but **the blind spot remains** — see below.

## Open for the human at QA checkpoint A

- **The `happy-dom` cookie blind spot.** QA should exercise sign-in through a **real browser**, not
  the test suite. That is the only thing that closes it.
- **Records 032 and 033 disagreed with the human's direction**, and those disagreements should be
  reviewed rather than assumed correct:
  - **032 set the password minimum at 15, not the 8 the human named.** SP 800-63B-4 §3.1.1.2
    reserves 8 for systems with a **second factor**; issue 03 puts MFA out of scope for v1, so
    that is the one clause this product cannot claim. OWASP splits on the same axis independently.
  - **033 refused to fold password throttling into issue 11**, which the human had directed. Issue
    11 is four issues downstream, so folding would leave sign-in unthrottled for five more issues;
    and the two are not one mechanism — issue 11's must work **offline on the Device**, and their
    visibility requirements are exact opposites, both correct. Issue 11 inherits the table under a
    `pin:` key prefix, not the mechanism. **Issue 11's note has been corrected accordingly.**
  - **033's closest call, stated plainly by the decider: per-account-only scored 39 to 40.** One
    point is not a separation. If a legitimate shared office is ever refused, drop the per-IP key —
    that is one constant, and cheaper than adding the key would have been.
- **Pre-existing debt, deliberately untouched:** 18 `_shell` route files carry inline
  `() => <Placeholder />` wrappers violating ADR-0009's no-JSX-in-routes rule. They pre-date this
  PRD; issue 03 only relocated them by `git mv`. Worth one cleanup issue, not a feature slice.
- **`foundation` issue 12 remains escalated** from the previous run — unrelated to this PRD but
  still open.

## Risks carried onto issues, not lost

Each is annotated on the issue that will hit it, committed as `0394e29`:

- **Issue 04** — nothing asserts that the migrating role is a superuser under `FORCE ROW LEVEL
  SECURITY`, which is the only reason `ownerDb` reads work. A hardened environment migrating as a
  non-superuser owner would make every failure read as an RLS bug.
- **Issue 06** — the third-pre-auth-lookup trap, and the coupling between global `User.email`
  uniqueness and the `user_login_lookup` policy. They move together or not at all.
- **Issue 11** — **corrected**: scope does *not* widen. It inherits the `SignInThrottle` table
  under a `pin:` key prefix for its server-side half only; its Device-side offline lockout stays
  its own mechanism because it must work with no network.
- **Issue 10** — criterion 2 **amended by me**: it still said `Bun.password` argon2id, which record
  028 made a no-go and which a merged grep test now fails. This was record 028's finding surfacing
  late, not a new decision.

## QA plan, because it overrides the orchestrator

`.scratch/tenancy-identity/QA-PLAN.md` stages QA into four checkpoints and sets a cap of **1** fix
round, not the orchestrator's 2. Checkpoint **A** runs after issue **04** merges, covers 01–04,
and its negatives are the deliverable. **If A does not pass in one round, the run stops there** —
nothing downstream is worth building on an unproven spine.

The design reference is already captured at `.scratch/tenancy-identity/reference/` (8 SVGs,
committed `83c3396`). **Do not re-capture per checkpoint.**
