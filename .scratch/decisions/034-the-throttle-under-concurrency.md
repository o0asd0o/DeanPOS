# 034 — The sign-in throttle holds under concurrency, by reserving before it hashes

- **Status:** accepted
- **Date:** 2026-08-02
- **Stakes:** high — a security control and a denial-of-service bound
- **Asked by:** the orchestrator, during issue 03a's round-2 review
- **Decided by:** **the human, directly.** Not the decider. This record exists so
  record 033 is not read as still describing the shipped mechanism.
- **Amends:** [033 — Throttling sign-in](033-throttling-sign-in.md). Narrows one
  clause; overturns nothing.

## What I chose, and why

`auth.signIn` now **reserves throttle budget in one atomic statement before it
hashes**, and **releases the reservation on success by decrementing** — never by
clearing.

Record 033's mechanism is correct sequentially and unbounded concurrently. As
implemented it read the counter, ran `scryptSync`, then wrote the counter:

1. `isThrottled(db, keys)` — a read
2. `verifyPassword(...)` — `scryptSync`, **measured at 259 ms**, blocking the
   whole single-threaded API
3. `recordSignInFailure(db, keys)` — the write

Nothing is atomic between 1 and 3. **N concurrent requests all read "not locked"
and all reach step 2 before any of them writes.** The derivations serialise
rather than stacking memory — record 033 is right that peak stays at 128 MiB —
but total blocking time is N × 259 ms and the throttle does not bound it. One
attacker holding 100 concurrent connections buys roughly **26 seconds of total
API unavailability**, against the ~2.6 s the per-email limit of 10 was meant to
cap. Record 033 exists to prevent exactly this outage, and never addresses
concurrency at all. This is a gap in it, not a contradiction of it.

**Reserve-and-release closes the window without giving anything back.** The
increment and the limit check become one statement, so the counter a request
sees already includes itself and every request that beat it. A successful
sign-in then decrements *its own reservation* — which is not the same as
clearing, and that distinction is the whole reason this option was taken over
the cheaper one.

## The ranked options

| # | Option | Score | Why not |
|---|---|---|---|
| **1** | **Reserve-and-release** | **chosen** | — |
| 2 | Count attempts before the hash, clear both keys on success | close | Genuinely one line. But clearing the IP key on success overturns record 033's clause that a spraying address must not buy back its budget by finally guessing one account right — an attacker holding one valid credential resets their IP budget at will, on demand. |
| 3 | Defer to `hardening` with a trigger | defensible | Honest: the race is a denial-of-service bound, not a credential bound, and per-email credential-stuffing protection is unaffected. Rejected because it leaves a known outage vector live through nine more issues of this PRD and the whole of `catalog`, and the fix turned out to be small. |
| 4 | A semaphore bounding in-flight derivations | rejected | Addresses the outage directly rather than through the counter, but excess requests must either queue with unbounded latency or be refused — and a refusal is a **fourth failure shape**, which puts the indistinguishability guarantee at risk to solve a problem the counter can already solve. |

## What changes, concretely

- `upsertThrottleFailure` becomes a **single** `INSERT … ON CONFLICT DO UPDATE …
  RETURNING` that increments and returns the new count. One statement, so two
  concurrent callers cannot both see the pre-increment value.
- `sign-in.ts` reserves on **both** keys before `verifyPassword`, and refuses
  when the returned count exceeds the limit. The read-only `isThrottled` check
  disappears from the hot path; the reservation *is* the check.
- On success, a new release decrements both keys, then `clearSignInThrottle`
  clears the **email** key as record 033 already specifies.
- On failure, nothing is released — the reservation simply stands as the
  recorded failure. No second write.

## The one clause this narrows

Record 033 says, of success:

> The IP key is deliberately left alone — an address that has been spraying
> should not buy back its budget by finally guessing one account right.

**That clause survives intact.** A release decrements only the reservation the
request itself just made; every *recorded failure* on the IP key stays. The
narrowing is only that the IP key is now written on success at all — by +1 then
−1, net zero. A shared office is not charged for succeeding.

## The regression test

A concurrency test that passes by accident is worse than none, so it must be
written so it **fails on the current code**:

Fire `EMAIL_FAILURE_LIMIT + 10` sign-in attempts for one email **concurrently**,
released together from a barrier, with `verifyPassword` spied. Assert the spy
was called **at most `EMAIL_FAILURE_LIMIT` times**. Against the pre-fix ordering
every request reaches the hash and the spy count equals the request count, so
the test fails loudly for the right reason.

Separately: one successful sign-in must leave the IP key's count **unchanged**,
not cleared — assert the stored value directly, because clearing and releasing
are indistinguishable from the handler's return.

## How to turn it back

Small, and it stays small:

1. Restore the read-only `isThrottled` call above `verifyPassword` in
   `packages/backend/src/auth/handlers/sign-in.ts`.
2. Move the `recordSignInFailure` call back below the hash.
3. Delete the release call and its `db-operations` command.
4. Revert `upsertThrottleFailure` to its pre-034 form and delete the concurrency
   regression test.

No migration to reverse — `SignInThrottle`'s shape does not change. No stored
data depends on this. Record 033 becomes accurate again by deletion alone.

## What should make you reverse this

**A legitimate burst of concurrent sign-ins being refused.** The reservation
counts in-flight attempts, so a genuine thundering herd — every terminal in a
chain signing in at open — could trip the per-IP limit where the old ordering
would not have. If that is ever observed, the answer is to raise
`IP_FAILURE_LIMIT`, not to remove the reservation; and if raising it far enough
makes the per-IP key useless, drop the per-IP key, which record 033 already
names as its own reversal trigger at a 40-to-39 margin.

## Evidence

- The 259 ms figure is measured, not estimated: mean 258.9 ms over 10 runs under
  `bun`, range 258.2–260.5 ms, reported by issue 03a's implementer.
- The race was found by the round-2 second-model review of issue 03a and
  verified against the code before this record was written.
- Record 033's spraying clause and its 40-to-39 margin are quoted from that
  record, not paraphrased from memory.
