# Handoff — `tenancy-identity`, issues 01–03

Written 2026-08-02 at the end of an unattended `/run-prd tenancy-identity` run.
Scope of this document: **issues 01, 02 and 03 only** — what merged, what was decided, and
what the next session must not re-derive or accidentally undo.

## Where the run stopped

| | |
|---|---|
| **Merged** | 01, 02, 03 — all closed, both review axes PASS, `main` green |
| **In progress** | **nothing** — no agent running, no worktree open, no lane database |
| **Next** | issue **04**, then **QA checkpoint A** (covers 01–04, cap **1** fix round) |
| **`main`** | `0394e29`, gate green: 243 tests, `vp check` 182 files 0 errors |
| **Lane state** | clean — only `DeanPOS_dev` exists, no `DeanPOS_lane_*` |

Two decisions were delegated by the human near the end and are being settled by the `decider`
as records **032** (password policy) and **033** (sign-in throttling). **Check
`.scratch/decisions/` for both before starting issue 04** — 033 in particular may widen issue
11's scope, and issue 11 has a note saying so.

## Resume command

```bash
git -C /Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS status --short
```

Tree must be clean. Then `/run-prd tenancy-identity` picks up at issue 04. `.orc2/ORCHESTRATOR.md`
is the procedure; `.scratch/tenancy-identity/QA-PLAN.md` **overrides** its QA trigger and round
cap for this PRD.

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
- **Records 032 and 033**, once written — present them at the checkpoint with the other five.
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
- **Issue 11** — probable scope widening from PIN-only to both credentials, with the timing-oracle
  and 128 MiB denial-of-service constraints that pull against each other.

## QA plan, because it overrides the orchestrator

`.scratch/tenancy-identity/QA-PLAN.md` stages QA into four checkpoints and sets a cap of **1** fix
round, not the orchestrator's 2. Checkpoint **A** runs after issue **04** merges, covers 01–04,
and its negatives are the deliverable. **If A does not pass in one round, the run stops there** —
nothing downstream is worth building on an unproven spine.

The design reference is already captured at `.scratch/tenancy-identity/reference/` (8 SVGs,
committed `83c3396`). **Do not re-capture per checkpoint.**
