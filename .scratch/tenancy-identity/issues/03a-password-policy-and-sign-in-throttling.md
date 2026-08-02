# 03a — The password policy and sign-in throttling

**Status:** done

## What to build

The two security controls issue 03 shipped without, because neither existed anywhere in the
documents and both were routed to the human rather than invented in a lane. The human delegated
them back; they are settled by [record 032](../../decisions/032-the-password-policy.md) and
[record 033](../../decisions/033-throttling-sign-in.md).

**Both records are binding and contain the concrete values, the verbatim copy, and the traps.
Read them before writing anything.** This issue exists to give that work a home, not to
re-decide it.

Why now rather than folded into issue 06: **`auth.setPassword` accepts a one-character password
on `main` today**, and `platformAdmin.provisionTenant` carries a live `z.string().min(8)` that
contradicts record 032. Sign-in is unthrottled, which is both a credential-stuffing surface and
a denial-of-service one — every attempt blocks the entire API for one scrypt derivation.

## Acceptance criteria

**Password policy — record 032**

- [ ] A password shorter than the minimum, or longer than the maximum, is refused by the server
      with the named message; the same normalisation runs on the set path and the verify path,
      asserted with a non-ASCII password set once and signed in with once.

**Sign-in throttling — record 033**

- [ ] Repeated failed sign-ins for one email address are refused after a threshold, and the
      refusal is **identical in shape, status and message** to a wrong password — asserted for
      an address that exists **and** for one that does not, in the same test.
- [ ] The failure counter increments for an email that matches no User — asserted directly,
      because the opposite is an account-enumeration oracle.
- [ ] A throttled request does not reach the password hash — asserted, not assumed.
- [ ] Repeated failures from one client address are refused independently of the per-address
      account, and a request with no forwarded address is throttled rather than exempted.
- [ ] A lock lifts by itself after the configured period and a correct password then succeeds;
      a successful sign-in clears that address's counter.

## Depends on

- 03 — Back-office sign-in, session, sign-out, and the `Origin` gate (merged)

## Relevant files

- `packages/backend/src/common/password.ts`, and a new `password-policy.ts`
- `packages/backend/src/auth/handlers/set-password.ts`, `sign-in.ts`
- `packages/backend/src/platform-admin/handlers/provision-tenant.ts` — the live `.min(8)`
- `packages/schemas`, `packages/contract/src/contract.ts`
- `packages/backend/src/db/prisma/schema.prisma` and `migrations/**` — `SignInThrottle`
- `apps/api/src/{app,context,test-seam}.ts`, `packages/backend/src/common/ctx.ts`
- `apps/backoffice/src/features/**` — the set-password screen's hint text
- `docker/Caddyfile` — `X-Forwarded-For`

## Comments

_Cut by the orchestrator on 2026-08-02 as the home record 032 and record 033 both asked for.
Neither record changes an existing acceptance criterion. Issue 03's criterion 5
(message-and-timing indistinguishability) is the constraint record 033 is built around and it
gains a regression lock rather than a weakening._

**Three traps, all named in the records, all easy to get wrong:**

1. **Normalisation is one function**, called from set *and* verify. Divergence is a silent,
   permanent lockout for every non-ASCII user, and no ASCII test catches it.
2. **Increment the counter on every failure, whether or not a User was found.** Counting only
   real accounts is a perfect enumeration oracle. Key on the *submitted email string*, never on
   a found row — response time may vary with what the client sent, never with what the server
   knows.
3. **Check the throttle before the password hash**, mandatorily. `scryptSync` blocks the whole
   API for one derivation, so an unthrottled loop from one machine is a full outage. The
   implementer must **time one `verifyPassword` under `bun` and report the figure** — that is
   the API's per-request block time.

**`SignInThrottle` has no `tenant_id`, no `user_id` and no foreign key, so it gets no RLS** —
the PRD's isolation criterion is scoped to tenant-owned tables. Record 033 makes that a no-go
rather than an omission, because no test in the repo asserts RLS coverage.

**Inherited by `release-ops`:** breach-password screening, as a knowingly recorded deviation
from a NIST `SHALL`. Record 032 lists five trackable clauses. NIST ties the blocklist's required
size to the attempt limit, so records 032 and 033 are load-bearing for each other — **neither is
complete until the blocklist ships**.

---

**Implemented 2026-08-02, branch `03a-password-policy-and-sign-in-throttling`.**

**`verifyPassword` timing under `bun` (record 033's obligation): mean 258.9 ms over 10 runs
(range 258.2–260.5 ms)**, on this machine, at `ln=17, r=8, p=1`. That is the per-request block
time of the whole API for the duration of the pipeline this issue implements — confirms the
throttle-before-hash ordering is load-bearing, not precautionary, and is well inside the range
where record 033 suggested moving to async `crypto.scrypt` becomes the next question worth
asking (not done here — out of scope for this issue).

**What was built:**

- `packages/schemas/src/password.ts` — the canonical `PASSWORD_MIN_LENGTH` (15, lowered to 8
  by record 032's amendment of 2026-08-03) /
  `PASSWORD_MAX_LENGTH` (128), `normalizePassword` (trim → NFC), `passwordSchema` (the full
  policy, for set/provision) and `signInPasswordSchema` (normalise + bound only, no minimum).
  Lives in `schemas` rather than `backend` so `contract` can import it without depending on
  `backend`. `packages/backend/src/auth/password-policy.ts` re-exports it under the
  `session-policy.ts`-style local path every backend handler imports from — one canonical
  source, never a second place stating a password rule.
- `packages/contract/src/contract.ts` — `setPasswordInputSchema.newPassword` and
  `provisionTenantInputSchema.adminPassword` now use `passwordSchema` (the `.min(8)`
  contradiction is fixed); `signInInputSchema.password` uses `signInPasswordSchema` (normalise
  + `.max(128)`, never the minimum).
- `packages/backend/src/common/password.ts` — `scryptSync` now receives
  `Buffer.from(password, "utf8")` in both `hashPassword` and `verifyPassword`. No signature
  change. This is a fresh lane database with no pre-existing hash, so the record's "confirm one
  existing dev hash still verifies" check has no row to check against — noted rather than
  skipped.
- `packages/backend/src/db/prisma/schema.prisma` + a new migration
  (`20260802100000_password_policy_and_sign_in_throttling`) — `SignInThrottle(key, failures,
  locked_until, updated_at)`, no `tenant_id`, no `user_id`, no foreign key, no RLS, applied to
  the lane database.
- `packages/backend/src/auth/throttle-policy.ts`, `throttle.ts`, and three new
  `db-operations` (a query for the locked-key lookup, an upsert-on-failure command, a
  lock-and-reset command, a clear-on-success command) — the pre-hash check, keyed on
  `email:<trimmed, lowercased>` and `ip:<address>`, incrementing on every failure regardless of
  whether a `User` was found.
- `packages/backend/src/auth/handlers/sign-in.ts` — throttle check before `verifyPassword`,
  failure recording on refusal, success clears the email key only (IP key is deliberately left
  alone, per the record).
- `packages/backend/src/common/ctx.ts`, `apps/api/src/{context,app}.ts` — `Ctx` gains
  `clientIp: string`; `app.ts` reads `X-Forwarded-For` once per `/rpc` request (defaulting to
  the literal `"no-forwarded-for"` when absent — fails closed) and both `createContext` and
  `buildContextFromSession` take it as a parameter.
- `docker/Caddyfile` — `header_up X-Forwarded-For {http.request.remote.host}` inside the `api.*`
  block, replacing rather than appending.
- `apps/backoffice/src/features/set-password/SetPassword.tsx` — the hint paragraph with
  `aria-describedby`, and `minLength={15}` on both password inputs (no `maxLength`, per the
  no-go). A server policy rejection (oRPC input-validation error) is distinguished from a
  genuine transport failure and rendered in record 030's existing alert block instead of "Can't
  reach the server." (round 1 fix).

**Tests (all new, all failing before the corresponding implementation, all green now):**

- `packages/schemas/tests/password.test.ts` — `normalizePassword`, `passwordSchema`,
  `signInPasswordSchema`: minimum/maximum boundaries with the named messages, NFC equivalence,
  code-point counting against an emoji string (`.length` would see double), trim-then-length
  ordering.
- `apps/api/tests/password-policy.test.ts` — server-side refusal (shorter/longer than policy)
  on `auth.setPassword` and `platformAdmin.provisionTenant` (the `.min(8)` fix, specifically),
  boundary acceptance at exactly 15, and the required regression lock: a non-ASCII password
  (`café puerta azul veinte`, combining form) set once via `setPassword` and signed in with once
  in a different Unicode form plus stray whitespace — proving the one normalisation function is
  genuinely shared.
- `apps/api/tests/sign-in-throttle.test.ts` — all five acceptance criteria: identical
  shape/status/message for a throttled known vs. unknown email in the same test; the failure
  counter incrementing for an unknown email (asserted directly against the `SignInThrottle`
  row); a throttled request never calling `verifyPassword` (asserted via `vi.spyOn`, not
  inferred from timing); the per-address counter tripping independently of any one account and
  the no-forwarded-header case sharing one bucket rather than being exempted; and a lock lifting
  itself (simulated by moving `locked_until` into the past rather than waiting 30 real minutes)
  with a subsequent success clearing the email counter.

**Fixed collaterally (mechanical consequences of typing `Ctx.clientIp` as required, not new
behaviour):** `packages/backend/tests/health/get-health.handler.test.ts`,
`packages/backend/tests/ping/get-ping.handler.test.ts` (added the new field to their inline
`Ctx` literals), and `apps/backoffice/tests/set-password-screen.test.tsx` (the mismatch test's
fixture passwords were 12 characters — bumped to real fifteen-plus-character strings that still
mismatch, since the new native `minLength=15` was silently blocking the test's form submission
before React's `onSubmit` ran).

**Gate, run in order, all green:**
`vp run -w codegen`, `vp check` (repo root), `vp run -r check`, `vp run -r test`
(20 files / 75 tests in `apps/api` alone; full monorepo run green with no regressions).

**Disagreements with the records:** none. Both were implemented as written; no contradiction
found between the two records or with issue 03's existing criteria.

**Left for a human/decider, not decided here:**
1. `release-ops`'s breached-password blocklist remains unimplemented, exactly as both records
   say it must be — a separate provider/dependency decision, not a lane decision.

---

**Round 2, 2026-08-02 — [record 034](../../decisions/034-the-throttle-under-concurrency.md).**
The description above of the throttle mechanism (the pre-hash `isThrottled` read, the
lock-and-reset write, the `locked_until` column) is superseded by this section; it is left
unedited above as the as-built history of round 1, not the current mechanism.

The round-1 ordering read the counter, ran `scryptSync`, then wrote the counter — nothing
atomic between the read and the write, so N concurrent requests all read "not locked" and all
reach the hash. `sign-in.ts` now **reserves on both keys, atomically, before `verifyPassword`**,
via a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` per key
(`upsertThrottleFailure`), and refuses when the returned count exceeds the key's limit. The
reservation *is* the check; `isThrottled`, `lockThrottleKey`, and `findLockedThrottleKeys` are
deleted along with the `locked_until`-driven lock — a key's count now decays only through the
existing staleness window (`THROTTLE_WINDOW_MS`), and `THROTTLE_LOCK_MS` is deleted as unused.
On success, a new `releaseSignInThrottle` decrements both keys (undoing this request's own
reservation), then `clearSignInThrottle` deletes the email key exactly as before. On failure,
nothing further is written — the reservation stands as the recorded failure.

New regression tests in `apps/api/tests/sign-in-throttle.test.ts`: firing `EMAIL_FAILURE_LIMIT
+ 10` concurrent sign-ins for one email and asserting `verifyPassword` was called at most
`EMAIL_FAILURE_LIMIT` times (written to fail against the round-1 ordering first — confirmed:
it called `verifyPassword` all 20 times before this fix); and a successful sign-in leaving the
IP key's stored `failures` value unchanged rather than deleted.

**Closed 2026-08-02.** Merged to `main`; gate green at 268 tests, migration proven from an
empty database. 2 fix rounds, both review rounds by a second model.

Two decisions were made during it, both **`Stakes: high`** and both taken by the human directly
rather than the decider:

- [**034** — the throttle holds under concurrency](../../decisions/034-the-throttle-under-concurrency.md).
  The shipped ordering read the counter, ran a **measured 259 ms** `scryptSync` blocking the whole
  API, then wrote the counter — so N concurrent requests all read "not locked" and all reached the
  hash. The reservation is now the check: one atomic upsert before the hash, released by
  **decrementing** on success, never by clearing, which is what keeps record 033's spraying clause
  intact.
- [**035** — the self-lifting lock is deferred to `hardening`](../../decisions/035-the-throttle-lock-is-deferred-to-hardening.md).
  Implementing 034 also removed record 033's lock. Refused attempts now advance `updated_at`, so an
  attacker attempting once every 29 minutes keeps a known address locked indefinitely and the owner
  never gets a gap. **Merged knowingly** — `main` had no throttle at all — with the fix, the dead
  `locked_until` column, and the test that would catch it all named on `.scratch/hardening/PRD.md`.

**The `verifyPassword` figure the issue asked for: 258.9 ms mean under `bun`** (range 258.2–260.5,
10 runs). That is the API's per-request block time, and the reason throttle-before-hash is
mandatory rather than preferred.
