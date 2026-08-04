# 16 — Self-service password change

**Status:** done
**Category:** enhancement

## What to build

A signed-in User changes their own password from the `/account` screen issue 15 builds, by
entering their current password and a new one.

**This is a deliberate scope addition, not a gap being closed.** The PRD carries no story for it.
`PRD.md:301` says password reset is admin-initiated — a tenant admin sets a temporary password
that must be changed on next sign-in — and explicitly rules out email-based self-service reset in
v1 because DeanPOS has no email transport. **That decision is about a *forgotten* password and is
not reopened here.** This issue is the other case: a User who knows their password and wants a
different one, which today they cannot do without asking an admin to reset them.

Requested by the human, 2026-08-04, alongside the account-viewing surface in issue 15.

## Decided — record 065

Every open question this issue was raised with is now answered by
[record 065](../../decisions/065-self-service-password-change-is-a-second-procedure-with-a-required-current-password.md).
Read it before starting. Do not re-litigate; if something looks wrong, say so and stop.

**A second procedure, not a branch.** `auth.setPassword` keeps its `mustChangePassword` guard and
its shipped refusal test **untouched**. The new one is:

```
auth.changePassword { currentPassword, newPassword }   — both REQUIRED in the schema
```

Both preconditions are disjoint and each is enforced by its own handler: `setPassword` requires
`mustChangePassword`, `changePassword` refuses when it is set. Record 058's *"one write, one
procedure"* is **not** precedent for branching — 058 kept `user.setPin` **and** `user.resetPin`
writing the same column, and forbade `changePin` only because set-and-change there share a
precondition and a credential. These two do not.

**Its own throttle key.** `pwchange:<userId>`, limit `PASSWORD_CHANGE_FAILURE_LIMIT = 5`, reusing
the existing 30-minute window and the existing `upsertThrottleFailure` /
`releaseThrottleReservation` / `clearThrottleKey` machinery unchanged.

Sign-in's `email:`/`ip:` keys are **not** reused: a failed change would burn the sign-in budget,
so a user who fumbles their own password change would lock themselves out of signing in, and
anyone holding a stolen session could lock the real user out for free without ever guessing right.

**Record 034's ordering carries over and is not optional.** Reserve atomically **before**
`verifyPassword` — it is `scryptSync` and blocks the whole API for one derivation, so a
read-then-write check leaves exactly the concurrency window 034 exists to close. On success,
release this request's own reservation, then clear the key. A wrong password leaves the
reservation standing.

**Sessions.** On success, revoke the User's **other** live sessions and keep the caller's:
`revokeOtherSessionsForUser(db, userId, exceptSessionId)` — the existing `revokeSessionsForUser`
statement plus `.where("id", "!=", exceptSessionId)`. `ctx.principal.sessionId` is already on the
principal. Calling the existing command unchanged would sign the User out of the screen they are
standing on.

**Failure shape.** Sign-in's uniform `{ ok: false }` defeats *account enumeration*; the caller
here is already authenticated as that account, so there is nothing to enumerate and the opacity
would only cost an honest user attempts against a five-try budget.

| `reason` | Cause | Copy |
| --- | --- | --- |
| `wrong-current-password` | verification failed | *Current password is incorrect* |
| `throttled` | over the limit | *Too many attempts — try again later* |
| `refused` | not a tenant principal, no `userId`, or `mustChangePassword` set | the generic sentence |

**Policy rejection is not in that union.** `passwordSchema` runs at the oRPC boundary, so a weak
`newPassword` arrives as a `BAD_REQUEST` carrying the Zod issue and the existing
`policyRejectionMessage` helper surfaces it. Reuse that helper; do not invent a fourth reason.

**Keep this property — it is load-bearing, not incidental.** Because the schema runs first, a
policy-invalid `newPassword` is rejected **before any hash comparison**, so such a submission
performs no verification and burns no attempt. A typo in the *new* field must never spend the
budget guarding the *current* one.

**Two write paths to `password_hash` now exist.** Both must route through the existing
`updateUserPassword` command. A second writer is a defect.

**`Origin` is inherited** — `auth.*` already requires the exact admin-host match. No wiring.
**No migration, no schema change.**

## Acceptance criteria

- [ ] A signed-in User of any role changes their own password from `/account` by supplying the
      current one, and stays signed in afterwards.
- [ ] `auth.changePassword` takes no `id` field and acts only on `ctx.principal.userId`.
- [ ] A wrong current password returns `reason: "wrong-current-password"` and does not change the
      stored hash.
- [ ] The sixth wrong attempt inside the window returns `reason: "throttled"`, and the throttle
      key is `pwchange:<userId>` — **a failed change does not consume the caller's sign-in
      budget**, asserted directly.
- [ ] A successful change clears the throttle key; a failed one leaves the reservation standing.
- [ ] The reservation is taken **before** `verifyPassword`, and two concurrent wrong attempts
      cannot both pass a pre-increment read (record 034's property, asserted as 034's own tests
      assert it).
- [ ] A policy-invalid `newPassword` is refused at the boundary, performs **no** verification, and
      burns **no** attempt.
- [ ] A successful change revokes the User's other live sessions and **not** the caller's: a
      second session for the same User stops working, the caller's next request still succeeds.
- [ ] `auth.changePassword` refuses with `reason: "refused"` when `mustChangePassword` is set.
- [ ] **`auth.setPassword` is unchanged and `forced-password-change.test.ts` is not edited** — its
      "an ordinary session is refused" assertion still passes as written.
- [ ] Both write paths go through `updateUserPassword`; no second writer exists.
- [ ] No password, current or new, appears in any log, error message, audit row, live region, URL
      or query key (record 043's no-gos). Extend the existing no-password-logging grep test to
      cover the new handler.
- [ ] The automated accessibility check passes on the `/account` password section.
- [ ] No migration is added.

## Depends on

- **15 — Back-office authorisation for non-admin roles.** This adds a third section to the
  `/account` screen issue 15 builds. **It cannot start before that screen exists.**
- 03a — Password policy and sign-in throttling (the policy it reuses and the throttle machinery it
  borrows without sharing keys)

## Relevant files

- `packages/contract/src/contract.ts` — the `auth` namespace gains `changePassword`; its input and
  output schemas
- `packages/backend/src/auth/handlers/change-password.ts` — new
- `packages/backend/src/auth/handlers/set-password.ts` — **read only, unchanged**
- `packages/backend/src/auth/throttle.ts` and `throttle-policy.ts` — the new key helper and
  `PASSWORD_CHANGE_FAILURE_LIMIT`
- `packages/backend/src/auth/db-operations/commands/revoke-sessions-for-user.command.ts` — gains a
  caller-excluding sibling
- `packages/backend/src/auth/db-operations/commands/update-user-password.command.ts` — the single
  writer, reused
- `apps/api/src/routes/auth.ts` — wires the new procedure
- `apps/api/tests/forced-password-change.test.ts` — **read only, must not be edited**
- `apps/backoffice/src/routes/_shell/account.tsx` — built by issue 15; this adds a section
- `apps/backoffice/src/features/set-password/SetPassword.tsx` — source of `policyRejectionMessage`,
  reused
## Constraints

- **No new dependency.** `@testing-library/user-event` is refused (record 042); `happy-dom`
  implements no activation behaviour, so dispatch a real `MouseEvent` for clicks.
- Server-side refusal is the enforcement; hiding a form is presentation, never enforcement
  (record 046 §4).
- Migrations purely additive; a drop, rename or backfill escalates to a human. Nothing here is
  expected to need one.
- Comments cap at three lines, and never narrate reviews, rounds, or findings.
- WCAG 2.2 AA, asserted by the existing automated accessibility check.
- **`auth.setPassword` and `apps/api/tests/forced-password-change.test.ts` are read-only.** The
  refusal assertion there is deliberate; a change that needs it edited is the wrong change.
- **Record 058 stands and is not touched**: no server procedure compares a submitted **PIN**
  against a stored hash, enforced by `apps/api/tests/pin-no-logging-grep.test.ts`. A password
  comparison is a different thing; make sure the grep test still means what it says afterwards.

## Gate

`--no-cache` must come **before** the task specifier. `vp run -r test --no-cache` forwards the
flag to vitest, leaves vp's own task cache on, and silently replays a previous verdict. Confirm
the run reports `0/10 cache hit`, not `10/10`.

    vp run -w codegen
    vp check
    vp run --no-cache -r check
    vp run --no-cache -r test

Baseline on `main` is **589 tests**, before issue 15.

## Comments

_Raised 2026-08-04 from record 063's Amendment 1, which added account self-service to the
cashier's surface and found this path blocked. Not sliced from the PRD — see the scope note at
the top. Routed to the decider and answered — see `## Decided` above and
[record 065](../../decisions/065-self-service-password-change-is-a-second-procedure-with-a-required-current-password.md)._

---

> *This was generated by AI during triage.*

## Triage Notes — 2026-08-04

**Category:** `enhancement` · **State:** `needs-triage` → `ready-for-agent`

**Redundancy check (a).** Searched by domain concept — credential rotation — across the contract
and the handlers, not by the request's wording. Three neighbours, none of them this:

| Procedure | What it does | Why it is not this |
| --- | --- | --- |
| `auth.setPassword` | sets own password | refuses unless `mustChangePassword` |
| `user.resetPassword` | admin sets another User's temporary password | admin acting on someone else (records 043, 040 §3) |
| `user.setPin` / `user.resetPin` | self-service **and** admin reset | the two-surface pattern this mirrors |

**Not already implemented.** The finding worth carrying: **the PIN has both self-service and admin
reset; the password has only admin reset.** This closes that asymmetry, and that framing is what
made the second-procedure shape the obvious one.

**Prior-rejection check (b).** **`.out-of-scope/` does not exist in this repo** — nothing to
search. The nearest prior decisions, both read: record 030 (:530, :534) and `PRD.md:301` reject
self-service *reset* on the absence of email transport. **A forgotten password is a different
request** and is not reopened. No prior rejection of change-while-signed-in.

**Verification (c) — confirmed, and stronger than the issue first claimed.** The blocker is not
incidental. `apps/api/tests/forced-password-change.test.ts` carries a deliberately named
assertion — *"an ordinary session (`mustChangePassword: false`) is refused on `auth.setPassword`"* —
which signs in an ordinary admin, calls `setPassword`, asserts `{ ok: false }`, and then
re-verifies that the old hash still matches. **Consequence:** any single-procedure shape must
rewrite that test. That fact decided question 1 on its own.

**Grilled**, five questions, dependency-ordered. All five resolved; recorded as
[065](../../decisions/065-self-service-password-change-is-a-second-procedure-with-a-required-current-password.md).

**Two loose ends the answers forced, closed without a further question:** the `reason` enum needs
a third member (`refused`) for the paths that are neither wrong-password nor throttled; and the
throttle lifecycle mirrors sign-in's exactly (reserve before hash, release own reservation on
success, then clear).

**Accepted assumptions, carried into the record rather than hidden.** A stolen back-office session
is out of scope as a threat to *solve* — the session revocation only declines to make it worse.
`PASSWORD_CHANGE_FAILURE_LIMIT = 5` is a judgement with no derivation behind it, unlike records
033/034's 10 and 30; record 065 §2 says so in those words.

**Why `ready-for-agent` rather than `ready-for-human`.** Nothing here needs judgement an agent
cannot exercise once 065 is read: no external access, no design decision, no manual testing.
`ready-for-human` is reserved for work an agent must not attempt.

**Still blocked on sequencing, not on specification.** `## Depends on` names issue 15, which is
not built. `/account` must exist before this attaches a section to it.

---

**Closed 2026-08-04.** Merged to `main`; gate green at **713** tests from an empty database. 1 fix
round of the 2 available, plus one test the orchestrator added directly. Reviewed both rounds by a
second model — Codex was rate-limited, so the judgement ran on Opus 5 — final verdict **PASS on both
axes**. No migration, and `auth.setPassword` and `forced-password-change.test.ts` are byte-unchanged
as the issue required.

**One undeclared source change, reviewed and kept:** `apps/api/src/middlewares/must-change-password.ts`
gained `/rpc/auth/changePassword` in its exempt list, so the handler's own guard produces
`reason: "refused"` rather than a bare transport 403. Verified narrow — the match is exact-string, the
`RPCHandler` carries no batching plugin that could smuggle another procedure through that path, and
the handler guards before any database work, so a User with `mustChangePassword` set gains no
capability. **The cost is named: enforcement for this path now rests on one handler line with no
middleware backstop**, and the test that covers it is named after that fact so the coupling is not
rediscovered.

**One declared deviation from record 065:** `currentPassword` uses `signInPasswordSchema`, not the
`passwordSchema` its instruction table specifies. A current password predating a policy change stays
submittable, and it hands a caller no free "is my password too short" probe. Recorded in
`contract.ts` where the next reader meets it; **record 065's table now misdescribes the shipped
contract.**

What the review caught:

- **The criterion that mattered was untested.** "A failed change does not consume the caller's
  sign-in budget" was proved by asserting a later sign-in succeeded — but the test's own loop signed
  in successfully six times, and a successful sign-in *deletes* the `email:` throttle row. Pointing
  `changePassword` at sign-in's keys would have left every test green. It now reads the `email:` and
  `ip:` rows directly, before and after.
- **`otherAfter` in the new wrong-tenant probe was a constant thunk** — it closed over a hash read
  before the other Tenant acted, which is exactly the hole rule 11 documents as unverifiable. **The
  defect was copied verbatim from the shipped `auth.setPassword` probe**; both are reshaped so the
  thunk performs a live re-read that brackets the other Tenant's write.
- **A principal with no `sessionId` succeeded while revoking nothing** — and the `/account` success
  test drove exactly that principal, so the UI asserted "Password changed" over a silent no-op. It
  now refuses, before the throttle reservation and before any hashing, and the seam always carries a
  session.
- Two `afterAll` teardowns deleted `SignInThrottle` rows with an unscoped `LIKE 'pwchange:%'`, which
  would have wiped a concurrently-running suite's live reservations.

**Carried forward, not fixed here:** `auth-wrong-tenant-probe.test.ts`'s `auth.signOut` probe has the
same stale-`otherAfter` shape, and the reviewer's judgement is that the right fix is a sweep across
every probe plus a helper change — `expectWrongTenantRefusal` taking `otherBefore` as a thunk it
invokes itself, which makes the stale-closure shape *unwritable* rather than merely discouraged by a
paragraph in rule 11. Spun out rather than folded in.
