# 035 — The throttle's self-lifting lock is deferred to `hardening`, knowingly

- **Status:** accepted
- **Date:** 2026-08-02
- **Stakes:** high — an availability defect in a security control, accepted on purpose
- **Asked by:** the orchestrator, after issue 03a's round-2 fix
- **Decided by:** **the human, directly**, at the 2-round cap, presented with three options
- **Relates to:** [033](033-throttling-sign-in.md), [034](034-the-throttle-under-concurrency.md)
- **Lands in:** `hardening` — `.scratch/hardening/PRD.md`

## What I chose, and why

Issue 03a **merges as built**, carrying a known degradation, and the fix is
deferred to `hardening` with the trigger written down below.

Record 034's reservation replaced the read-then-hash-then-write ordering. In
implementing it the fixer also deleted the lock record 033 specified —
`lockThrottleKey`, `findLockedThrottleKeys`, `THROTTLE_LOCK_MS`, and all use of
the `locked_until` column — and let the count plus the 30-minute staleness
window carry the whole mechanism. **Record 034 authorised the reservation. It
did not authorise removing the lock.**

The consequence is specific. `upsertThrottleFailure` sets `updated_at = now()`
on **every** attempt, including refused ones, and the window only resets when
`updated_at` is older than `THROTTLE_WINDOW_MS`. So an attacker attempting once
every 29 minutes renews the window forever: `failures` never decays and the
account owner gets **no window at all**. Under the deleted lock, `locked_until`
expired on a fixed schedule and the owner had a gap each cycle to sign in and
clear their own counter.

Issue 03a's criterion — *"a lock lifts by itself after the configured period and
a correct password then succeeds"* — therefore holds only while the attack has
stopped.

**Why this was still the right call.** `main` today has no throttle at all: an
unthrottled loop from one machine blocks the entire API for 259 ms per attempt
indefinitely. What merges is strictly better than that on the axis the control
exists for. The residual is that a sustained attacker can hold one known email
address locked — a property every per-account throttle carries to some degree,
which NIST accepts and record 033 already reasoned about. The gap here is one of
**degree**, not kind: the lock made the lockout intermittent, and its removal
makes it continuous.

## The ranked options

| # | Option | Score | Why not |
|---|---|---|---|
| **1** | **Merge as built, defer to `hardening`** | **chosen** | — |
| 2 | Take a third fix round | close | The fix is ~4 lines and mechanical: stop bumping `updated_at` once a key is at its limit, so the window expires from the last *counted* attempt. Rejected only because it would have been the third round against a documented cap of two, and the last unreviewed change is exactly where a fix relocates a defect — round 2 is itself the proof of that. |
| 3 | Escalate, do not merge 03a | rejected | Would have stopped the run: issue 04 builds on this auth surface and QA checkpoint A covers 01–04. Too expensive for a degradation that is strictly less bad than the status quo. |

## What `hardening` inherits — the exact fix

**1. The window must expire from the last *counted* attempt, not the last
attempt.** In `upsert-throttle-failure.command.ts`, do not advance `updated_at`
once the key is already at or over its limit. The limit is already a parameter
at the call site, so this stays one atomic statement — record 034's whole
mechanism survives untouched:

```
"updated_at" = CASE WHEN "SignInThrottle"."failures" >= <limit>
                    THEN "SignInThrottle"."updated_at" ELSE now() END
```

**2. Drop the dead `locked_until` column.** `schema.prisma` and migration
`20260802100000_password_policy_and_sign_in_throttling` both still carry it and
nothing reads or writes it. It merges dead. Dropping it later is a
**non-additive** migration, so it needs the usual escalation — cheaper to fold
into `hardening`'s own migration than to raise on its own.

**3. The test that proves it**, and it must fail on what merges today: lock a key
by exhausting its limit, then keep attempting **throughout** the window, advance
past `THROTTLE_WINDOW_MS`, and assert a correct password now succeeds. The
existing test only advances time with no attempts in between, which is precisely
the case that still works.

## How to turn it back

Nothing to reverse — this record defers rather than changes. To undo the
deferral, apply the three items above; each is small and none touches record
034's reservation ordering or record 033's key scheme.

## What should make you reverse this — bring it forward, do not wait for `hardening`

- **Any report of a user locked out with no self-service recovery**, or any
  support path that exists only to unlock accounts. That is this defect
  surfacing as a person's problem.
- **Any credential-stuffing attempt observed against a real deployment.** The
  degradation is harmless until someone is actually attacking; the day one is,
  the intermittent lock is the difference between degraded and unusable.
- **`release-ops` shipping the breach-password blocklist** (record 032). NIST
  ties the blocklist's required size to the attempt limit, so 032, 033 and this
  record are load-bearing for each other and that is the natural moment to
  revisit all three.

## Evidence

- The renewal behaviour was traced through
  `packages/backend/src/auth/db-operations/commands/upsert-throttle-failure.command.ts`
  and `throttle.ts` on the branch, not inferred from the fixer's report.
- Worked example: attempts at t=0..10 lock the key. At t=29, `staleBefore` is
  t=−1 and `updated_at` is t=10; `10 < −1` is false, so the count increments and
  `updated_at` becomes 29. At t=58 the same holds against `staleBefore` t=28.
  The window never opens.
- The 259 ms per-derivation figure is measured, not estimated (record 034).
