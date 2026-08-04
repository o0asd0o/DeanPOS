# 065: Self-service password change is a second procedure with a *required* `currentPassword` — not a branch on `auth.setPassword`, and not modelled on the PIN

- **Status:** decided
- **Stakes:** **high** — a credential-rotation path, a new verification oracle, and a reversal of record 030's premise for one of two flows.
- **Date:** 2026-08-04
- **Asked by:** the human, via `/triage` and a grilling interview on
  `.scratch/tenancy-identity/issues/16-self-service-password-change.md`
- **Relates to:** [030](030-the-back-office-sign-in-screen.md) (its no-current-password premise, reversed for the non-forced flow only), [032](032-the-password-policy.md), [033](033-throttling-sign-in.md)/[034](034-the-throttle-under-concurrency.md) (the throttle this reuses and the ordering it must not break), [043](043-the-temporary-password-is-typed-not-generated.md) (the admin reset and its no-gos), [058](058-pin-management-is-a-back-office-action.md) (**not** precedent — §1 says why), [063](063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md) Amendment 1 (raised this and deferred it)

## The question

A signed-in User cannot change their own password. `auth.setPassword` refuses unless
`mustChangePassword` is set, deliberately — record 030 omitted a current-password field on the
premise the user *"proved it at sign-in seconds ago"*, which is true only of the forced-change
flow, and without the guard a long-lived stolen session could reset a password with no
re-verification at all. That refusal is a **shipped, named assertion**, not an accident:
`apps/api/tests/forced-password-change.test.ts` — *"an ordinary session (`mustChangePassword: false`)
is refused on `auth.setPassword`"*.

Today the product has an asymmetry: **the PIN has both self-service and admin reset; the password
has only admin reset.** Closing it means adding a verification oracle, which is exactly what 058
refused to do for the PIN. Five sub-questions follow from that, and the human fixed the central
one before the interview began: **`currentPassword` is required.**

**Weights, declared before any option was scored.** **User ×2** (a User who cannot rotate their own
credential without a support call) · **Business ×1** (no revenue; the support call is the same fact
as user impact and is not counted twice) · **Eng cost/risk ×2** · **Reversibility ×2** (a contract
entry and a security check are the sticky artefacts) · **Evidence ×3** (this turns on shipped code,
a shipped test, and two published throttle records, all checkable here). Maximum **50**.
**Not changed after scoring.**

## Scope, stated because the PRD does not carry it

**There is no PRD story for this.** `tenancy-identity/PRD.md:301` says password reset is
admin-initiated and rules out email-based self-service reset in v1, because DeanPOS has no email
transport. **That is about a *forgotten* password and is not reopened.** This record is the other
case — a User who knows their password and wants a different one. It is a deliberate scope
addition on the human's direction, recorded as one rather than presented as a gap being closed.

## What I chose, and why

### 1 — A second procedure, `auth.changePassword`, and 058 is not precedent for a branch

058 says *"`user.changePin` does not exist and must not be created. One write, one procedure."*
Read as a general rule that argues for branching `auth.setPassword` on `mustChangePassword`.

**It has been read wrong.** 058 kept **two** procedures writing the identical column —
`user.setPin` and `user.resetPin`. What it forbade was `changePin`, because set-and-change there
are *the same operation with the same precondition and the same credential*. Forced-change and
self-service change have **different preconditions and different credentials**. That is the
`setPin`/`resetPin` shape, not the `changePin` shape.

```
auth.setPassword    { newPassword }                    — requires mustChangePassword
auth.changePassword { currentPassword, newPassword }   — requires NOT mustChangePassword
```

**The concrete failure a branch invites.** Branching makes `currentPassword` **optional in the
schema**, enforced only by a runtime read of `mustChangePassword`. The day that read is
refactored, moved, or inverted, the field is optional everywhere and the check is gone — with no
schema constraint, no type error, and no test failing. A separate procedure makes it a **required
Zod field**: absence is refused at the contract boundary before any handler logic runs. A security
check that a compiler and a schema both enforce beats one that a boolean read enforces.

It also leaves `forced-password-change.test.ts`'s refusal assertion **green and untouched**. A
branch must rewrite it to expect success-with-`currentPassword`, and rewriting a security test
written on purpose is how a control quietly changes meaning.

**The cost, named: two write paths to `password_hash` now exist.** Both must route through the
existing `updateUserPassword` command, or a future policy change lands in one and not the other.
That is the price of the disjoint preconditions and it is worth it; it is not free.

### 2 — Its own throttle key, not sign-in's

`currentPassword` verification is a guessing oracle and needs a limit. It does **not** get
sign-in's.

Sign-in throttles on `email:` and `ip:` (record 033: keyed on the submitted string, never a found
User row). Reusing those keys means a wrong `currentPassword` **burns the sign-in budget** — so a
user who fumbles their own password change locks themselves out of signing in, and anyone holding
a stolen session can lock the real user out of sign-in for free, without ever guessing correctly.
Wrong dimension. Post-authentication the caller has a `userId`, which is the honest key.

- **Key:** `pwchange:<userId>`
- **Limit:** `PASSWORD_CHANGE_FAILURE_LIMIT = 5`, against the existing `THROTTLE_WINDOW_MS` of 30
  minutes — a legitimate user needs one or two attempts
- **Machinery:** `upsertThrottleFailure` / `releaseThrottleReservation` / `clearThrottleKey`,
  unchanged
- **Lifecycle, mirroring sign-in exactly:** reserve atomically **before** `verifyPassword`;
  release this request's own reservation on success, then clear the key (NIST — *disregard any
  previous failed attempts*); a wrong password leaves the reservation standing

**Record 034's ordering is not optional here.** `verifyPassword` is `scryptSync` and blocks the
whole API for one derivation, so a read-then-write check leaves precisely the concurrency window
034 exists to close. This path inherits the reason, not just the shape.

**Honest about the number: `5` is a judgement, not a derivation.** 033 and 034 argued 10 and 30
from reasoning about spraying and shared addresses. This limit has no such argument behind it —
it is "few, because a person changing their own password knows it." Said plainly so a later
reader does not inherit false confidence, and so tuning it needs no ceremony.

### 3 — Revoke the User's other sessions, keep the caller's

`revokeSessionsForUser` already exists and is called by `deactivate-user` and
`reset-user-password`; its own comment records why — *"deactivation and password reset are both
immediate."* Called unchanged here it would revoke the caller's session too, signing the User out
of the screen they are standing on.

So: `revokeOtherSessionsForUser(db, userId, exceptSessionId)` — the same statement plus
`.where("id", "!=", exceptSessionId)`. It kills an attacker's parallel session immediately, which
is the entire security value; signing the legitimate user out achieves nothing further and
friction at exactly this moment is why people avoid changing passwords.
`ctx.principal.sessionId` is already on the principal, so the exclusion key needs no plumbing.

### 4 — The two remaining failure causes are distinguished

Sign-in's uniform `{ ok: false }` exists to defeat **account enumeration**. The caller of
`changePassword` is already authenticated *as that account* — there is nothing left to enumerate,
and copying the opacity would cost an honest user attempts against a five-try budget while
telling them nothing. 033 already accepts revealing lock state, just not account existence.

`{ ok: true } | { ok: false, reason }` with `reason` one of:

| `reason` | Cause | Copy |
| --- | --- | --- |
| `wrong-current-password` | verification failed | *Current password is incorrect* |
| `throttled` | over the limit | *Too many attempts — try again later* |
| `refused` | not a tenant principal, no `userId`, or `mustChangePassword` set | the generic sentence |

`refused` covers the paths a caller should not be on at all, and does not say which. **Policy
rejection on `newPassword` is not in this union**: `passwordSchema` runs at the oRPC boundary, so
it arrives as a `BAD_REQUEST` carrying the Zod issue and the existing `policyRejectionMessage`
helper already surfaces it. Reuse it; do not invent a fourth reason.

**A property worth keeping, and worth stating so it is not refactored away:** because the schema
runs first, a policy-invalid `newPassword` is rejected **before any hash comparison**. Such a
submission performs no verification and burns no attempt — no probing oracle, and a typo in the
*new* field never spends the budget guarding the *current* one.

### 5 — It refuses when `mustChangePassword` is set

The exact mirror of `setPassword`'s guard, and what keeps the two preconditions disjoint — which
is §1's whole basis. The forced flow finishes first, at `/set-password`.

In practice unreachable from the UI: `_shell`'s guard (record 030) already redirects a must-change
User to `/set-password` before they can reach `/account`. **A server rule no screen can currently
trigger is still the rule**, because the screen is not the enforcement (046 §4).

## The options, ranked — the central question

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Second procedure, `currentPassword` required in schema** | 5 (10) | 4 | 5 (10) | 4 (8) | 5 (15) | **47** |
| 2 | Branch `auth.setPassword`, `currentPassword` optional | 5 (10) | 4 | 3 (6) | 4 (8) | 3 (9) | **37** |
| 3 | Reuse `setPassword`, require `currentPassword` on **both** flows | 3 (6) | 3 | 3 (6) | 3 (6) | 3 (9) | **30** |
| 4 | Leave it — admin reset is the only path | 1 (2) | 2 | 5 (10) | 5 (10) | 2 (6) | **30** |
| 5 | Defer to the implementer | 1 (2) | 1 | 3 (6) | 5 (10) | 1 (3) | **22** |

**2 — branch.** The honest runner-up and the one a careful implementer reaches for, because it
looks like it honours 058. It loses on engineering risk and evidence: an optional security field
and a rewritten security test, for the saving of one contract entry.

**3 — require it on both flows.** Coherent and arguably purer — one procedure, one required
field, no branch. It loses because it reverses 030's premise for the *forced* flow too, where the
premise is actually true, and adds a field to a screen a User reaches while holding a password
they were just handed.

**4 — leave it.** The status quo, and defensible: the PRD asks for nothing here. It scores its 30
almost entirely on being free and reversible. It loses on user impact — a User who suspects their
password is known must call an admin to have it reset, which is the support call 043's
neighbourhood already treats as a cost worth removing.

**5 — defer.** Ten of its 22 points are the reversibility every do-nothing option collects free.
An implementer picking a throttle key for a credential oracle under time pressure is what this
role exists to prevent.

## The exact instruction

| Piece | Decision |
| --- | --- |
| `auth.changePassword` | **New.** `{ currentPassword: passwordSchema, newPassword: passwordSchema }`, both required. Acts on `ctx.principal.userId`; **never an `id` field** |
| `auth.setPassword` | **Unchanged**, guard included. Its refusal test stays green and is not edited |
| Output | `{ ok: true } | { ok: false, reason: "wrong-current-password" | "throttled" | "refused" }` |
| Throttle | `pwchange:<userId>`, limit **5**, existing 30-minute window, reserve-before-hash |
| Sessions | `revokeOtherSessionsForUser(db, userId, ctx.principal.sessionId)` on success |
| Write | Through the existing `updateUserPassword` command — **both** paths, no second writer |
| `Origin` | Inherited: `auth.*` already requires the exact admin-host match. No wiring |
| Migration | **None.** No schema change anywhere |

## What this deliberately does not decide

- **Self-service reset of a *forgotten* password.** Needs email transport; PRD:301 stands.
- **Whether `user.resetPassword` should stop revoking the caller's own session.** Different
  procedure, different actor, untouched.
- **Any change to PIN management.** 058 stands whole, and its grep test is unaffected — but see
  the trigger below.

## How to turn it back

| What | Cost |
| --- | --- |
| Drop the feature | Delete one procedure, one handler, one contract entry, one screen section, one throttle key and constant, one command variant. **No migration, nothing to unwind, `setPassword` never moved** |
| Make `currentPassword` optional after all | One schema edit — **and it restores the oracle without the limit**. It must return *with* a decision about the throttle, never alone |
| Retune the limit | One constant. §2 says the number has no derivation behind it |
| Formally | Superseding record; flip this `Status:` to `overturned` with date and reason; update `LOG.md`; re-run the gate |

## What should make you reverse this

- **The throttle proves wrong in either direction** — legitimate users hitting 5 in 30 minutes, or
  an attacker with a stolen session finding 5 enough. The constant moves; the key does not.
- **A second reader concludes 058 does forbid this shape.** §1 is the argument; if it does not
  hold, the successor is option 2 and the security test must be rewritten openly rather than
  edited in passing.
- **Per-User permissions or a second authentication factor arrive.** Both change what
  re-verification means and this record is rebuilt against them.
- **The `refused` reason turns out to leak something** by letting a caller distinguish "I am not a
  tenant principal" from "my flag is set" through timing. Not believed to be true — both return
  before any hashing — but it is the shape of defect this union invites.

## Evidence

**Read 2026-08-04, on `main` at `ada2f83`:**

- `packages/backend/src/auth/handlers/set-password.ts` — the `mustChangePassword` guard and the
  comment stating record 030's premise and its limit. `apps/api/tests/forced-password-change.test.ts`
  — the refusal assertion in full, including its re-verification that the old hash still matches.
- `packages/backend/src/auth/throttle.ts` and `throttle-policy.ts` — `throttleKeys` keyed on the
  submitted email string; `reserveSignInAttempt`'s atomic upsert; `releaseSignInThrottle` undoing
  only this request's reservation; `clearSignInThrottle` clearing **only** the email key;
  `EMAIL_FAILURE_LIMIT = 10`, `IP_FAILURE_LIMIT = 30`, `THROTTLE_WINDOW_MS = 30 min`.
- `packages/backend/src/auth/db-operations/commands/revoke-sessions-for-user.command.ts` and its
  **two** callers, `user/handlers/deactivate-user.ts` and `user/handlers/reset-user-password.ts`.
  `apps/api/src/context.ts` — `sessionId` is on the tenant principal.
- `packages/contract/src/contract.ts` — the `auth` namespace (`signIn`, `signOut`, `setPassword`,
  `me`) and its exact-`Origin` comment; `setPasswordInputSchema` is `{ newPassword }` only;
  `user.resetPassword` exists and is admin-acting-on-another.
- `apps/backoffice/src/features/set-password/SetPassword.tsx` — `policyRejectionMessage`, the
  existing `BAD_REQUEST`/Zod-issue path. `features/signin/SignIn.tsx` — *"Email or password is
  incorrect"*, the house voice for a form-level failure.
- **Redundancy search, by domain concept rather than wording** (`/triage` check (a)): searched
  credential rotation across the contract and handlers. Found `auth.setPassword` (forced only),
  `user.resetPassword` (admin, another User), `user.setPin` + `user.resetPin` (the two-surface
  pattern this mirrors). **Self-service password change does not exist.**
- **Prior-rejection search** (`/triage` check (b)): **`.out-of-scope/` does not exist in this
  repo** — nothing to search. Nearest prior decisions are 030:530/534 and PRD:301, both rejecting
  self-service *reset* on the absence of email transport, which is a different request.
- Records **030** (§361 the no-current-password premise), **032**, **033**, **034**, **043**,
  **058** (the `setPin`/`resetPin`/`changePin` distinction §1 turns on), **063** Amendment 1,
  **046** §4. `.scratch/decisions/` listed directly: **064 is the highest number and is taken;
  065 is free.** No existing record decides self-service password change, its principal, its
  throttle, or its failure shape.

**External: none.** NIST SP 800-63B is the obvious citation and says nothing that decides this —
its memorised-secret guidance covers composition, length and throttling, all of which records 032
and 033 already applied, and it takes no position on whether a change path must re-verify the
current secret. The argument rests on this codebase's own shipped patterns, which a human can
check line by line above.
