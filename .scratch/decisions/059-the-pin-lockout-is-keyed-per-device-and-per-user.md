# 059: The PIN lockout is keyed per Device **and** per User at once — acceptance criterion 4 governs, record 058's "keyed per `userId`" was simply wrong, and there is no server-side half left to build

- **Status:** decided
- **Stakes:** **high** — an access-control path to a till, a claim a cashier reads, and a lockout whose worst failure mode (a permanently closed register) is the one [035](035-the-throttle-lock-is-deferred-to-hardening.md) already shipped once.
- **Date:** 2026-08-04
- **Asked by:** the human, for `.scratch/tenancy-identity/issues/11-pin-throttling-and-lockout.md` (Q1–Q5)
- **Relates to:** [058](058-pin-management-is-a-back-office-action.md) (one clause corrected; 058 stays `decided`), [057](057-pin-unlock-verifies-locally-with-pbkdf2.md) (Q1's arithmetic decides the honesty statement; Q3's grep expectation amended; Q4's "no lockout strip" deferral discharged), [033](033-throttling-sign-in.md)/[034](034-the-throttle-under-concurrency.md)/[035](035-the-throttle-lock-is-deferred-to-hardening.md), [056](056-the-device-principal-its-token-and-its-two-screens.md) (accessor-module pattern; its interval ban), [042](042-user-event-is-refused-because-happy-dom-has-no-activation-behaviour.md), [009](009-terminal-shell-chrome-states.md)

## The question

Five, on one issue. **Q1** criterion 4 says throttle per Device, record 058's carried-in block says key per `userId`, and they are opposites. **Q2** the numbers. **Q3** where the durable state lives and its shape. **Q4** the locked state's UI and accessibility. **Q5** whether the server-side half the issue still lists has anything left to do. A wrong answer closes a register in the middle of service, or leaves open the bypass the whole issue exists to close. **Weights, declared before any option was scored.** **User ×3** — a locked till stops a queue, and 057 already caps what security this control can buy, so user impact is the axis that actually separates the options · **Business ×1** · **Eng cost/risk ×2** · **Reversibility ×2** · **Evidence ×2**. Maximum **50**. **Not changed after scoring.** Q2's numbers are calibration inside Q1's chosen shape and Q5 is a factual confirmation, so neither carries its own table; the alternatives are named in the open.

## Already decided, not revisited

- **This is not a security boundary and this record says so plainly.** Whoever holds the tablet clears `localStorage` from devtools; 057 concedes the whole roster grinds in **~75 s** on one rented GPU. The lockout exists against a **bystander** who will not open a console. **Revocation is the mitigation (ADR-0007), and nothing here changes that.**
- **On-device and nowhere else** (058) · **no new dependency** (042) · **nothing new in `packages/ui` and no new token** (057 Q4) · **`localStorage` behind one accessor module per key-set** (056 Q3) · **acting User is memory-only and Lock touches no storage key** (057 Q5).

## Q1 — Criterion 4 governs. Record 058's line was wrong, and it is corrected here.

**Two counters, one storage object, evaluated together.** A **per-`userId`** counter locks one cashier at **5** consecutive failures. A **per-Device** counter — one per terminal, incremented by *every* wrong attempt regardless of who was picked — locks the whole till at **10**. Either lock in force refuses the attempt.

**058's bullet said "Keyed per `userId`". That is simply wrong and I am not softening it.** Per-`userId` keying is defeated by clicking a different tile — the exact attack criterion 4 names in the criterion itself — and 058 never scored keying at all; its ranked options are about PIN *management*, and the line is a slip carried into a scope it did not analyse. Criterion 4 is a ratified acceptance criterion. It governs. 058 stays `decided`; the clause is amended, the way 057 §4's string was.

**But per-Device alone is the answer that closes a register**, and a busy counter shares one terminal between several people. Ana's five fat-fingered attempts must not stop Boy serving. The two-counter shape costs one extra field in the same JSON object and about ten lines, and it is the whole difference between "one cashier locks herself out for two minutes" and "the till is shut mid-service". That is not speculative generality — it is the business fact the question was asked against.

**What resets what, exhaustively:**

| Event | Effect |
| --- | --- |
| A **successful unlock by any User** | Zeroes the Device counter **and** that User's counter, clears every lock. Deliberately unlike 033's IP key, which is never cleared: 033's key spans strangers on the public internet, while a correct PIN here is physical proof of a legitimate person standing at that terminal (NIST's *"the verifier SHOULD disregard any previous failed attempts"*, via 033). |
| A **lock expiring** | That key's counter returns to **0** — a fresh budget, never escalation (033's step 4). |
| **`now - lastAttemptAt > PIN_ATTEMPT_WINDOW_MS`** | That key's counter restarts at 1. **While a key is locked no attempt is counted and `lastAttemptAt` is not advanced** — that is [035](035-the-throttle-lock-is-deferred-to-hardening.md)'s renewal defect refused at design time rather than inherited. |
| A page reload · switching User · clearing the PIN field · a failed roster pull | **Nothing.** The reload case is the whole bypass; the switch case is criterion 4. |

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Per-Device counter *and* per-User counter, both durable, either one locks** | 5 (15) | 5 | 4 (8) | 5 (10) | 4 (8) | **46** |
| 2 | Per-Device only, exactly as criterion 4 reads | 3 (9) | 3 | 5 (10) | 5 (10) | 4 (8) | **40** |
| 3 | Per-User only (058's line as written) | 4 (12) | 3 | 5 (10) | 5 (10) | 1 (2) | **37** |
| 4 | Defer with a trigger | 1 (3) | 1 | 4 (8) | 5 (10) | 1 (2) | **24** |

**2 — per-Device only.** The honest runner-up, the literal reading of criterion 4, and the least code. It loses on the one fact the weights were set for: at a counter shared by four people, one person's mistakes take the till from the other three and there is no operator path to lift it. Dropping to it later is deleting the `users` map and one branch. **3 — per-User only.** Loses on evidence, not taste: criterion 4 names the attack it permits, in the issue this record serves. Ranked because it is what 058 wrote down. **4 — defer.** Ten of its 24 points are the reversibility every do-nothing option collects free, and the issue is `ready-for-agent` with a contradiction in it; deferring means it gets picked at a keyboard.

## Q2 — 5 / 10 / two minutes, no escalation. 033's numbers do not transfer.

**`apps/pos/src/lib/pin-throttle.ts` holds the policy beside its accessors** — one file, because the policy is client-only and has no second reader (rung 2, not a second module):

```
PIN_USER_FAILURE_LIMIT   = 5
PIN_DEVICE_FAILURE_LIMIT = 10
PIN_LOCK_MS              = 2 * 60 * 1000
PIN_ATTEMPT_WINDOW_MS    = 15 * 60 * 1000
```

**Two minutes is the mock's own `2:00`, and 033's numbers do not transfer: 033's thirty minutes is a closed register.** 033 bounds a 15-character password on a public endpoint where the throttle is also the only thing keeping a blocking 259 ms KDF from holding the API down. None of those three facts is true here — nothing server-side is at risk, `deriveBits` does not block (057 Q2), and the cost of being too strict falls on a queue of customers rather than on an attacker.

**The arithmetic, stated rather than asserted.** 10 attempts per 2 minutes is 300 guesses an hour against 1,110,000 candidates — about **154 days** of continuous guessing to exhaust the keyspace. The same attacker, holding the tablet, gets the whole roster offline in **75 seconds** (057). **So the throttle's entire value is that a bystander will not stand at a counter poking a keypad for a fortnight.** That is the only claim this record makes for it. **Five and ten are judgement**: a person wrong five times running has forgotten their PIN, not mistyped it; ten across a terminal is two full budgets. Both are one-constant changes.

**No escalation on repeat, deliberately.** Escalation needs memory of prior locks, which needs a decay rule for that memory — precisely the shape that produced 035's never-opening window. `ponytail: fixed 2-minute lock, no escalation. Add escalation only if a real till reports sustained hammering past a lock — and add the decay rule in the same commit.`

## Q3 — `apps/pos/src/lib/pin-throttle.ts`, key `deanpos.pin.throttle`, one JSON object

```json
{
  "device": { "failures": 0, "lockedUntil": null, "lastAttemptAt": null },
  "users": { "<userId>": { "failures": 0, "lockedUntil": null, "lastAttemptAt": null } }
}
```

All three time fields are **epoch milliseconds or `null`**, never ISO strings — every use is a `Date.now()` comparison, and 057's `syncedAt` is ISO only because it is a wire field. A `users` entry whose `failures` is 0 and whose `lockedUntil` is `null` is **deleted on write**, so the map stays bounded by the roster.

**Four exports, so the screen holds no arithmetic:** `readPinThrottle()`, `pinLockUntil(state, userId): number | null` (the later of the two locks, or `null`), `recordPinFailure(userId)`, `recordPinSuccess(userId)`. `readPinThrottle` parses inside `try/catch` and returns a **fresh empty state** on anything malformed or absent — copy `pin-roster.ts` exactly.

**It fails open, and that is the polarity.** Corrupt storage must not close a till, and a control that 057 already concedes is clearable from devtools gains nothing from failing closed. **No-go: this module never calls `clearPinRoster()` or `clearDeviceToken()`, never gates anything but the unlock form, and never blocks a sale.**

**The clock attack: yes, it defeats this, and I am doing nothing about it.** `Date.now()` is attacker-controlled on a device the attacker holds — but that attacker can equally run `localStorage.removeItem("deanpos.pin.throttle")`, and 057's 75 seconds already prices what they get. Server time, a monotonic anchor, `performance.now()` and clock-rollback detection are all **refused**: they cost real code against a threat model where the cheaper bypass stays open.

**One line is taken, and it guards the opposite direction — a lock that never lifts:**

> **Invariant, and the most important line in this record: if `lockedUntil - Date.now() > PIN_LOCK_MS`, the lock is treated as already expired.** No stored value, however corrupt and whatever the clock has done, can produce a lock longer than two minutes. `ponytail: one clamp instead of clock validation — the failure this product has already shipped once (035) is a permanent lockout, not a bypassed one.`

**057 Q3's grep expectation is amended a second time:** `rg -n 'localStorage' apps/pos` must now return exactly `device-token.ts`, `pin-roster.ts`, `pin-throttle.ts`. **Finding, checked rather than assumed: no test enforces that today.** 056 and 057 both state it as an expectation and neither wrote it. Adding the third file is the moment it becomes load-bearing, so this issue adds `apps/pos/tests/local-storage-confinement.test.ts` — walk `apps/pos/src`, assert the set of files containing `localStorage` equals those three.

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **`localStorage`, one key, one accessor module, epoch-ms fields** | 5 (15) | 4 | 5 (10) | 5 (10) | 4 (8) | **47** |
| 2 | Fold the counters into `deanpos.pin.roster` | 4 (12) | 3 | 2 (4) | 3 (6) | 3 (6) | **31** |
| 3 | IndexedDB behind the same accessor shape | 4 (12) | 3 | 2 (4) | 4 (8) | 2 (4) | **30** |
| 4 | `sessionStorage` | 1 (3) | 2 | 5 (10) | 5 (10) | 1 (2) | **27** |

**2 — fold into the roster.** No new key, no new file — and it loses outright on one mechanical fact: 057 replaces the roster **whole** on every successful `pinSync`, so every sync would silently clear the lockout, a bypass reachable by pulling and restoring the network. **3 — IndexedDB.** Async, reserved with the service worker for `offline-sync` (057), no safer against same-origin script. **4 — `sessionStorage`.** Fails criterion 2 the moment the tab is closed rather than reloaded — the attacker's move.

## Q4 — the strip ticks, and 056's interval ban does not reach it

**056's ban does not apply here, and the reason is which side owns the truth.** 056 refused a ticking countdown of an *enrolment code's* TTL because the **server** enforces that expiry and a client countdown would be a second, drifting source of truth reaching `0:00` while the code still worked. 057 then wrote "no lockout strip, no countdown, no interval" scoped to *issue 10's screen*, deferring the strip here by name. **In this issue the client is the only source of truth** — there is no server to disagree with — so the ban expires by its own terms and the mock's `2:00` is buildable as drawn.

- **The strip is built where the 1280 mock draws it: full column width, immediately below the keypad grid, inside the `<form>`.** The 390 mock draws no strip; it renders identically at both widths, as the keypad does.
- **Visible copy, ticking, with no live-region role of any kind:** `Too many attempts — locked for {m:ss}` for a Device lock; `Too many attempts — {displayName} locked for {m:ss}` for a User-only lock (that second string is reversible copy). `m:ss` is `Math.ceil((lockedUntil - Date.now()) / 1000)` — **ceil**, so it reads `2:00` at the instant of locking and never sits on `0:00`. **One `setInterval(…, 1000)` in a `useEffect` keyed on the lock instant, existing only while locked, cleared on unmount and on lift**, setting a `now` state; when `now >= lockedUntil` the strip and the lock disappear together. That is the whole lift mechanism — no second timer.
- **What a screen reader hears, and it is exactly twice.** A **permanently mounted `sr-only` `<p role="status">`** whose text changes on **engage** and on **lift**, and at no other moment. `role="status"` (polite), not `role="alert"`: the wrong-PIN alert has already fired and interrupting again is noise. **The ticking node is never inside it** — a live region re-announcing every second is itself a WCAG 4.1.3 failure, and is the trap this question was really about.

| Moment | `role="status"` text |
| --- | --- |
| Device lock engages | `Too many attempts. This till is locked for 2 minutes` |
| User lock engages | `Too many attempts. {displayName} is locked for 2 minutes. Another user can still unlock this till` |
| Any lock lifts | `The lock has lifted. Try your PIN again` |
| Next digit entered | `` (empty) |

- **Nothing unmounts.** While a **Device** lock is in force, the picker tiles, all ten digit keys, Backspace and Unlock carry `aria-disabled="true"`; the PIN `<Input>` gains `readOnly` (never `disabled`). While only a **User** lock is in force, **the picker stays fully enabled** — that is the point of two counters — and choosing another User clears the strip in the same render. `aria-disabled` over `disabled` is the shipped pattern (057 Q4, `Enrolment.tsx`), and it is load-bearing here: the cashier's focus is on Unlock when the lock engages, and **focus does not move, by design**. Unmounting the keypad would drop focus to `<body>` and hide the reason at the same instant.
- **The lock replaces the error, never joins it.** Engaging a lock sets the PIN field to `""` and clears `That PIN is not correct`; the two messages are never on screen together (009: no state that cannot be true).
- **WCAG 2.2 SC 2.2.1 is met by its Essential Exception**, verbatim: *"The time limit is essential and extending it would invalidate the activity."* A lockout that can be extended or turned off is not a lockout. Named here because a reviewer will stop on the countdown. Targets and focus are 057 Q4's rules unchanged.

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Ticking `m:ss` with no live role + a two-state `sr-only role="status"`** | 5 (15) | 4 | 4 (8) | 5 (10) | 5 (10) | **47** |
| 2 | Static coarse text (`locked for about 2 minutes`) + one `setTimeout` to lift | 3 (9) | 4 | 5 (10) | 5 (10) | 3 (6) | **39** |
| 3 | Absolute wall-clock (`locked until 3:42 PM`), no timer at all | 2 (6) | 3 | 5 (10) | 5 (10) | 3 (6) | **35** |
| 4 | The strip inside `role="alert"`, ticking | 2 (6) | 2 | 4 (8) | 5 (10) | 1 (2) | **28** |

**2 — static text plus one `setTimeout`.** Genuinely lazier and the honest runner-up; a `setTimeout` is one line against six. It loses because a cashier facing a queue watches a number that does not move and cannot tell a lockout from a dead terminal — and the mock draws a clock, not a duration. **3 — absolute time.** Needs a wall clock the cashier may not have, and locale formatting for a two-minute wait. **4 — inside the alert.** Fails SC 4.1.3 by re-announcing every second. Ranked because it is the one an implementer reaches for by default.

## Q5 — Confirmed: there is no server-side half, and the issue's own text must stop saying there is

**The reading is correct.** After issue 10 and 058, **no server procedure compares a submitted PIN against a stored hash**: `terminal.pinSync` emits hashes, `user.setPin` writes one, `user.resetPin` clears one, and `apps/api/tests/pin-no-logging-grep.test.ts` asserts no non-test file under `packages/backend/src` or `apps/api/src` imports `verifyPin`. There are no server-side PIN attempts, so a `pin:` key on `SignInThrottle` would count zero rows forever. **Nothing is inherited from 033 but a lesson.** A throttle on `terminal.pinSync` was considered and refused: it is authenticated by a 256-bit bearer token (056) with nothing to guess. **This issue touches no file under `packages/backend/`, `apps/api/src/` or `packages/contract/`.**

**Replace the whole `## Relevant files` block with:**

> ## Relevant files
>
> - `apps/pos/src/features/unlock/**` — the locked state on the unlock screen
> - `apps/pos/src/lib/pin-throttle.ts` — **new**; the durable counters and the lock, behind the accessor-module pattern
> - `apps/pos/tests/unlock-screen.test.tsx` — the reload, cross-User, lift and axe assertions

**Replace the orchestrator note's final paragraph (the one beginning `**No criterion of this issue changes.** What you inherit is the `SignInThrottle` table…`) with:**

> **No criterion of this issue changes, and nothing server-side is inherited.** Record 033 offered `SignInThrottle` under a `pin:` key prefix for a *"server-side counterpart for online attempts"*. **That counterpart has nothing to count.** Issue 10 and [record 058](../../decisions/058-pin-management-is-a-back-office-action.md) left **no server procedure that compares a PIN against a stored hash** — enforced by `apps/api/tests/pin-no-logging-grep.test.ts` — so no online PIN attempt exists. Throttling here is **on-device and nowhere else** ([record 059](../../decisions/059-the-pin-lockout-is-keyed-per-device-and-per-user.md)); a server-side attempt counter would mean a PIN authenticating a request and needs a superseding record.

**Replace the second bullet of the carried-in record 058 block at the top of the issue with:**

> - _Keyed **per Device and per User at once** — a per-User counter at 5 so one cashier's fumbling does not close the till, and a per-Device counter at 10 that criterion 4 requires and that switching User cannot reset. **Persisted behind the existing accessor-module pattern so it survives a page reload** — an unthrottled reload is the whole bypass. [Record 059](../../decisions/059-the-pin-lockout-is-keyed-per-device-and-per-user.md) corrects 058's "keyed per `userId`", which criterion 4 refutes._

## What must not be built

- **No server-side attempt counter, no `pin:` key on `SignInThrottle`, no contract change, no migration.** If an implementer's answer needs one, it is a superseding record.
- **No escalating lock, no permanent lock, no lock any human must lift** — there is no operator surface at a till (033's rule, 035's scar). **No clock validation, server time, `performance.now()` or rollback detection** — the clamp is the whole defence.
- **No second `setInterval` anywhere, no interval when unlocked, no timer on the roster or the Device token**, and **no delay, debounce or artificial timing** on the unlock path.
- **Nothing logs the attempted PIN, its length or any prefix** — only counts and timestamps are stored (criterion 6). **No auto-clear of the roster or the Device token on a lock** (056's no-go).

## How to turn it back

| What | Cost |
| --- | --- |
| **The numbers (Q2)** | Four constants in `apps/pos/src/lib/pin-throttle.ts`. Existing stored state stays valid — the clamp makes a shorter `PIN_LOCK_MS` take effect on the next render, not on the next lock. |
| **Drop to per-Device only (Q1 → option 2)** | Delete the `users` map from the state type, one branch in `pinLockUntil`, one string in the strip. **Three functions, one screen, one test — bounded because the screen holds no arithmetic.** Dropping to per-User only is the same shape, opposite branch, **but it reopens criterion 4 and needs a superseding record, not an edit.** |
| **Storage or key (Q3)** | `apps/pos/src/lib/pin-throttle.ts`, one file, **two importers** (`Unlock.tsx` and its test). The accessor module is what keeps it two. Deleting `deanpos.pin.throttle` orphans one key; nothing reads it. |
| **The strip, the tick, the copy (Q4)** | One commit under `apps/pos/src/features/unlock/`. Free, permanently. |
| **The whole issue** | One revert. **No migration, no contract, no server file, no data.** The cheapest record in the 056–059 group to unwind, which is why several calls in it are flagged reversible rather than escalated. Formally: superseding record, flip this `Status:` to `overturned` with date and reason, update both `LOG.md` lines, re-run the gate. |

## What should make you reverse this

- **A till is reported locked with a queue at it.** The failure this record's weights were set against. Successor: lower `PIN_DEVICE_FAILURE_LIMIT`'s *cost* by cutting `PIN_LOCK_MS` to 60 s, before touching the limits. **The trigger is the first such report, not a second.**
- **Anyone demonstrates a lock that outlives two minutes.** The clamp has failed and it is the invariant everything else rests on.
- **A cashier is observed defeating the lock by switching User.** Criterion 4's attack, live — the cross-User test is the only thing standing between this design and 058's line.
- **A PIN is ever accepted without a valid Device token, or a server procedure gains a PIN comparison.** Both void the honesty statement rather than tune it, and the second is caught by the existing grep test.
- **`offline-sync` encrypts the roster at rest and `release-ops` ships a POS CSP.** Then 057's 75 seconds stops being the cheapest bypass, the clock attack becomes the cheapest one instead, and Q3's refusal is worth re-reading. **This is the assumption I am least confident about.**
- **The POS gains a second screen behind the gate.** The lock currently gates one form; `UnlockGate` moving up (057 Q4) is the moment to check it still gates the right thing.

## Evidence

**Repository, read 2026-08-04, worktree `.worktrees/11-pin-throttling` (branch `main`, read-only):**

- The issue in full, **including the carried-in 058 block and the 2026-08-02 orchestrator note** — the two texts Q1 and Q5 correct. **Both SVGs read in full:** in `pin-unlock-1280.svg` the strip is `x=300 y=760 w=684 h=30`, dashed, **immediately below the keypad**, reading `Too many attempts — locked for 2:00`, with the note *"The lockout strip is the throttled state; it persists across a page reload."* **`pin-unlock-390.svg` draws no strip at all** — the mock is silent at 390 and this record fills it.
- Records **058** (§"Issue 11", the four lines), **057** (Q1's 75 s table, Q3's roster-replaced-whole rule and grep expectation, Q4's deferral of this strip and its `aria-disabled` pattern, Q5's Lock rule), **033** (the numbers, the NIST quotes, the reset rules), **034**, **035** (the never-opening window, traced), **056** (Q5's countdown refusal and the "no interval… in this issue" no-go — **scoped to issue 09's server-owned TTL**, which is why it does not reach here), **042**, **009**.
- `apps/pos/src/features/unlock/Unlock.tsx`, `UnlockGate.tsx`, `lib/pin-roster.ts`, `lib/device-token.ts`, `lib/acting-user.tsx` in full — the `role="alert"` slot, the `canUnlock` guard, the `pending` re-entry guard, the accessor shape `pin-throttle.ts` copies. `apps/api/tests/pin-no-logging-grep.test.ts` — the `verifyPin` import check making Q5 a fact, not a claim. `apps/pos/tests/unlock-screen.test.tsx` — the `expectNoAxeViolations` at 1280 and 390 criterion 7 reuses.
- **Checked and absent, and it mattered: no test asserts the `apps/pos` `localStorage` confinement.** `rg -n 'localStorage' apps/pos` returns `pin-roster.ts` and `device-token.ts`; `rg localStorage apps/*/tests` returns nothing. 056 and 057 both assert it in prose only — hence the new test in Q3. `.scratch/decisions/` listed directly: **001–058 exist, 059 is free, none decides PIN throttling, lockout keying or the locked state. No duplicate.**

**External, accessed 2026-08-04, treated as data — nothing in it was addressed to an agent and no instruction from it was acted on.** **W3C WCAG 2.2** — <https://www.w3.org/TR/WCAG22/> — SC 2.2.1 Timing Adjustable, **Essential Exception quoted verbatim above**; SC 4.1.3 Status Messages cited by number, because the fetched rendering summarised the normative sentence rather than reproducing it. **NIST SP 800-63B-4 §3.2.2 and the OWASP Authentication Cheat Sheet were not re-fetched:** every clause used here (the 100-attempt upper bound, the waiting-period range, *"disregard any previous failed attempts"*, the lockout-as-denial-of-service warning) is quoted from **record 033**, which transcribed them from the primary sources on 2026-08-02. Re-citing them as freshly read would be dishonest.

**Searched for and not found, where the absence mattered: no authority publishes a lockout threshold or duration for a shared-terminal PIN.** NIST and OWASP both address one subscriber against a remote verifier; neither addresses a device several people share where the lock's cost falls on a queue. Q2's numbers therefore rest on the arithmetic in the open above and on the mock's own `2:00` — both checkable here — and are labelled judgement rather than dressed in a citation.
