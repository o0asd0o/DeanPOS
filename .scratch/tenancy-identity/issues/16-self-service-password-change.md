# 16 — Self-service password change

**Status:** needs-triage

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

## Why this is `needs-triage` and not `ready-for-agent`

`auth.setPassword` **refuses unless `mustChangePassword` is set**, and that refusal is deliberate.
`packages/backend/src/auth/handlers/set-password.ts:17–21`:

> Record 030 omitted a current-password field on the premise the user *"proved it at sign-in
> seconds ago"* — true only for the forced-change flow. Without this guard a long-lived stolen
> session could reset the password with no re-verification at all.

So the procedure cannot simply have its guard removed. It needs a `currentPassword` field, and
adding one reverses record 030's premise for the non-forced path.

**Direction taken by the human, 2026-08-04: `currentPassword` is required.** The record below
still has to be written — it fixes the shape, the throttle and the failure copy — but the central
question is answered and should not be reopened by the decider.

**Record 058 is not precedent for refusing the field, and the record must say why.** 058 deleted
`currentPin` because a 4–6 digit PIN is exhaustible in ~75 s (record 057 Q1) and is worthless
without an enrolled terminal, so an unmetered guessing endpoint cost more than the field
defended. **A password is the opposite secret**: it is policy-bound (record 032), throttled at
sign-in (record 033/034), long, and it is the credential everything else in the product hangs
off. The two answers differing is correct, not inconsistent — but a reader will assume otherwise
unless it is written down.

## What the record must decide

1. **The input shape.** `{ currentPassword, newPassword }` on a distinct procedure, or on
   `auth.setPassword` with the current-password check conditional on `mustChangePassword`? A
   second procedure keeps the forced-change path exactly as it is; one procedure with a branch
   keeps a single write. Name which, and why.
2. **Throttling.** A `currentPassword` field is a verification oracle. Sign-in's throttle
   (`packages/backend/src/auth/throttle.ts`, records 033/034) already exists and is keyed by email
   and client IP — decide whether this path reuses it, gets its own key, or needs neither because
   the caller already holds a session. **A wrong answer here is the whole risk of the issue**; 058
   refused `currentPin` precisely for want of one.
3. **What happens to other sessions.** Does changing a password revoke the User's other sessions?
   `Session` rows carry `revoked_at` and `findSessionById` already checks it, so revoking is
   available. Not deciding this is itself a decision — say which.
4. **Failure shape and copy.** A wrong `currentPassword` must not distinguish itself from any
   other failure in a way that helps an attacker, and the copy has to tell an honest user what to
   fix. Record 030's single form-level sentence is the existing pattern.
5. **Whether `mustChangePassword` interacts.** A User mid-forced-change reaching `/account`
   should not have two ways to set a password.

## Acceptance criteria

_Provisional — the record above finalises them. Do not start until its `Status:` is `decided`._

- [ ] A signed-in User of any role changes their own password from `/account` by supplying the
      current one.
- [ ] A wrong current password is refused, and the refusal is throttled per the record's answer
      to question 2.
- [ ] The forced-change flow at `/set-password` is **unchanged** — same route, same copy, same
      procedure behaviour for a User with `mustChangePassword` set.
- [ ] The new password is subject to the same policy as every other (record 032), and the
      confirm-match check stays client-side.
- [ ] No password, current or new, appears in any log, error message, audit row, live region,
      URL or query key — record 043's no-gos, which already cover PINs, apply unchanged.
- [ ] A User acts only on themselves: the procedure reads `ctx.principal.userId` and takes no
      `id` field, exactly as `user.setPin` does.
- [ ] Other-session behaviour matches the record's answer to question 3, and is tested either way.

## Depends on

- **15 — Back-office authorisation for non-admin roles.** This adds a third section to the
  `/account` screen issue 15 builds. It cannot start before that screen exists.
- 03a — Password policy and sign-in throttling (the policy and the throttle this reuses or
  deliberately does not)

## Relevant files

- `packages/backend/src/auth/handlers/set-password.ts` — the guard at :20 and the comment
  explaining it; the record's starting point
- `packages/backend/src/auth/throttle.ts` — the existing sign-in throttle, for question 2
- `packages/backend/src/auth/password-policy.ts` — `passwordSchema`, unchanged
- `packages/backend/src/common/password.ts` — `verifyPassword`, `DUMMY_PASSWORD_HASH`
- `packages/backend/src/auth/db-operations/queries/find-session-by-id.query.ts` — `revoked_at`,
  for question 3
- `packages/contract/src/contract.ts` — wherever question 1 lands
- `apps/backoffice/src/routes/_shell/account.tsx` — built by issue 15; this adds a section

## Constraints

- **No new dependency.** `@testing-library/user-event` is refused (record 042); `happy-dom`
  implements no activation behaviour, so dispatch a real `MouseEvent` for clicks.
- Server-side refusal is the enforcement; hiding a form is presentation, never enforcement
  (record 046 §4).
- Migrations purely additive; a drop, rename or backfill escalates to a human. Nothing here is
  expected to need one.
- Comments cap at three lines, and never narrate reviews, rounds, or findings.
- WCAG 2.2 AA, asserted by the existing automated accessibility check.
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
the top. **Route to the decider before implementation**; the human has already fixed the central
answer (`currentPassword` required), so the record's work is questions 1–5, not re-deciding that._
