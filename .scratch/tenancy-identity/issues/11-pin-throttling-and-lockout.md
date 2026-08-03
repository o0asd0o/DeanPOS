# 11 — PIN throttling and lockout

**Status:** done

_**Carried in from [record 058](../../decisions/058-pin-management-is-a-back-office-action.md),
before this issue is built.** Issue 10 removed every server-side PIN comparison, which changes what
this issue can be:_

> - _Throttling is **on-device and nowhere else** — unlock is verified in the browser (057 Q1) and
>   **no server procedure verifies a PIN** (058), so no server-side attempt counter exists or may be
>   added._
> - _Keyed **per Device and per User at once** — a per-User counter at 5 so one cashier's fumbling
>   does not close the till, and a per-Device counter at 10 that criterion 4 requires and that
>   switching User cannot reset. **Persisted behind the existing accessor-module pattern so it
>   survives a page reload** — an unthrottled reload is the whole bypass.
>   [Record 059](../../decisions/059-the-pin-lockout-is-keyed-per-device-and-per-user.md) corrects
>   058's "keyed per `userId`", which criterion 4 refutes._
> - _**On-device throttling is not a security boundary and this issue must say so.** Whoever holds
>   the tablet can clear it; 057 already concedes the roster is grindable in ~75 s. It exists against
>   a bystander. Revocation is the mitigation (ADR-0007)._
> - _A server-side attempt counter needs a superseding record — it means a PIN authenticating a
>   request._

## What to build

The only thing standing between a shoulder-surfed Device and a manager's authority. A 4–6
digit PIN has at most a million combinations and in practice far fewer; throttling is not a
nicety here.

Repeated wrong PIN entries lock the terminal for a period. **The lockout is enforced on the
Device, persists across a page reload, and works with no network** — otherwise it is bypassed
by pulling the network cable or hitting refresh, which is precisely the attack it exists to
stop.

## Acceptance criteria

- [ ] Repeated wrong PIN entries lock the terminal for a period; the lock is visible and says
      when it lifts.
- [ ] The lockout survives a page reload — asserted, not assumed.
- [ ] The lockout holds with no network at all.
- [ ] Throttling applies per Device, so it cannot be reset by trying a different User's PIN.
- [ ] A correct PIN after the lock lifts unlocks normally, and the attempt counter resets.
- [ ] Nothing logs the attempted PIN.
- [ ] WCAG 2.2 AA on the locked state, asserted by the existing automated accessibility check.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/pin-unlock-1280.svg`
- Image · whole-screen · 390: `design/lofi/pos/pin-unlock-390.svg`

**Scope of the reference: the locked and error states of the unlock screen only.** The unlock
screen itself is issue 10.

## Depends on

- 10 — PIN unlock and the hash-sync payload

## Relevant files

- `apps/pos/src/features/unlock/**` — the locked state on the unlock screen
- `apps/pos/src/lib/pin-throttle.ts` — **new**; the durable counters and the lock, behind the
  accessor-module pattern
- `apps/pos/tests/unlock-screen.test.tsx` — the reload, cross-User, lift and axe assertions

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 33, 34), ADR-0007, Security
criterion 8._

**Orchestrator note, 2026-08-02 — scope does NOT widen. Corrected after [record 033](../../decisions/033-throttling-sign-in.md).**

An earlier note here said password throttling would probably fold into this issue. **That was
wrong and record 033 refuted it.** Sign-in throttling is being built as its own follow-up issue,
because folding it here would leave sign-in unthrottled for five more issues, and because the two
mechanisms are not one mechanism:

- Yours must live **on the Device and work with no network**, so it cannot live in PostgreSQL.
- A password attacker never opens a browser, so client-side state is worth nothing there.
- The visibility requirements are **opposites, and both are correct**: your criterion 1 says the
  lock *is visible and says when it lifts*; the password lock may never announce itself, because
  a distinct lockout message is an account-enumeration oracle.

**No criterion of this issue changes, and nothing server-side is inherited.** Record 033 offered
`SignInThrottle` under a `pin:` key prefix for a *"server-side counterpart for online attempts"*.
**That counterpart has nothing to count.** Issue 10 and
[record 058](../../decisions/058-pin-management-is-a-back-office-action.md) left **no server
procedure that compares a PIN against a stored hash** — enforced by
`apps/api/tests/pin-no-logging-grep.test.ts` — so no online PIN attempt exists. Throttling here is
**on-device and nowhere else**
([record 059](../../decisions/059-the-pin-lockout-is-keyed-per-device-and-per-user.md)); a
server-side attempt counter would mean a PIN authenticating a request and needs a superseding
record.

**Closed 2026-08-04.** Merged to `main`; gate green at **557** tests. No migration — this issue
touches no file under `packages/backend/`, `apps/api/src/`, or `packages/contract/`. 2 fix rounds —
the cap — reviewed by a second model all three rounds, final verdict PASS on both axes.

**One record:** [059](../../decisions/059-the-pin-lockout-is-keyed-per-device-and-per-user.md),
`Stakes: high`.

**Record 059 corrected record 058**, which is the first time a decision record has amended another
in this PRD. 058's carried-in block said the throttle is "keyed per `userId`"; criterion 4 says
throttling applies per Device *so it cannot be reset by trying a different User's PIN* — per-user
keying permits exactly the attack criterion 4 names. 059 found 058 had scored no keying option at
all, ruled the line a slip rather than a decision, and amended it. The answer is **both counters**:
per-User at 5 so one cashier's fumbling does not close the till, per-Device at 10 that switching
User cannot reset. Either locks, for 2 minutes, with no escalation.

**059 also refused, up front, a trap this codebase already shipped once.**
[Record 035](../../decisions/035-the-throttle-lock-is-deferred-to-hardening.md) documents a
never-opening window in the sign-in throttle, where a persistent attacker re-locks forever and the
owner never gets a gap. 059 required that **while a key is locked nothing is counted and
`lastAttemptAt` is not advanced** — and the review then found the implementation had reintroduced it
anyway, on the *other* counter.

**The honest framing, which 059 insists on:** this is **not a security boundary**. Devtools clears
it, and record 057 concedes the roster grinds in ~75 seconds. It exists against a bystander;
revocation is the mitigation (ADR-0007). The device-clock attack is accepted and deliberately
unmitigated — no server time, no monotonic anchor, no rollback detection — guarded only by the clamp
invariant, which treats any `lockedUntil` more than `PIN_LOCK_MS` away as already expired.

What the review caught, across three rounds:

- **A stored `{}` crashed the unlock screen.** Validation trusted any syntactically valid JSON, so
  one corrupt entry took the till out of service — the opposite of failing open.
- **A correct PIN could not unlock when storage was full or denied**, because `setItem` threw out of
  `recordPinSuccess` before `setActingUser` ran. The throttle module could block a sale.
- **`Infinity` and `users: []` both passed the round-1 shape validation** — `1e400` parses to
  `Infinity` and `typeof Infinity === "number"`; an array is `typeof "object"` and non-null.
- **The never-opening window, reintroduced.** `recordPinFailure` advanced the *unlocked* counter
  while the other was locked, so an in-flight failure consumed Device budget and advanced its
  `lastAttemptAt` — 035's defect in a new mechanism, after 059 had refused it.
- **A successful unlock cleared only the succeeding User's entry**, so Ana stayed locked after Carla
  unlocked correctly, against 059's "clears all locks".
- **Two tests proved nothing.** The "no network" test stubbed `fetch` and then exercised only the
  storage module — deleting the cached-roster fallback entirely would have passed it. And the
  never-opening-window guard's own test passed with the guard removed, because it asserted only the
  locked User's counter while the Device counter advanced underneath.

**The `localStorage` confinement had never been enforced.** Records 056 and 057 assert in prose that
`rg -n 'localStorage' apps/pos` returns only the accessor modules; 059 checked and found **no test
enforcing it**. `apps/pos/tests/local-storage-confinement.test.ts` now does, for
`device-token.ts`, `pin-roster.ts` and `pin-throttle.ts`.

**Gate reliability, measured rather than assumed.** Five consecutive full runs on this lane: three
fully clean, two with a single failure each — `stores-screen.test.tsx` once and
`payment-method/deactivate-reactivate-concurrency.test.ts` once. **Every test this issue owns passed
in all five.** Both unstable tests are pre-existing and load-sensitive; the second is issue 08's
`pg_stat_activity` barrier, which was reviewed as deterministic and is not.
