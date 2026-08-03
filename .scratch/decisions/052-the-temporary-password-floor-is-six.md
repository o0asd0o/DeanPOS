# 052 — A temporary password's floor is six, and it is not the password policy

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** high — a credential length, lowered on purpose
- **Asked by:** the human, who pre-accepted the objection ("yes accept this")
- **Decided by:** the human; this record states the split that makes it safe to say yes to
- **Relates to:** [032](032-the-password-policy.md), [043](043-the-temporary-password-is-typed-not-generated.md), [051](051-the-temporary-password-may-be-generated-in-the-browser.md)

## What changed

`generateTemporaryPassword` now returns **six upper-case alphanumerics** with
`I`, `O`, `0`, `1` removed — a value an admin can read down a phone line or
across a counter without a support call.

Six is below record 032's floor of eight, so a second schema exists rather than
the floor moving:

- `passwordSchema` — **8 minimum**, unchanged. Guards `auth.setPassword` and
  `platformAdmin.provisionTenant`: the passwords a person chooses and keeps.
- `temporaryPasswordSchema` — **6 minimum**, new. Guards `user.create` and
  `user.resetPassword` only.

Without the split, a generated value would have been refused by the very API
the button feeds — the button would have produced a password that cannot be
saved.

## Why six is defensible here and nowhere else

A temporary password is not a credential in the sense 032 governs. It is issued
by an admin, it survives exactly one sign-in, and `mustChangePassword` means the
session it opens can reach only `auth.me`, `auth.setPassword` and
`auth.signOut` — no tenant data, no other procedure (issue 03 criterion 6).

**The exposure is real and worth naming:** 32⁶ ≈ 1.07 × 10⁹. That is trivial
offline if the hash ever leaks, and it is only ~10⁹ online because record 033's
throttle stands in front of it — ten failures per email, thirty per address,
thirty-minute windows. **This value's security rests on the throttle and on the
forced change, not on its own entropy.** If either is weakened, this record is
the first thing that has to move.

## Reversal

One constant in `packages/schemas/src/password.ts` and one in the generator.
Existing temporary passwords are already hashed and already single-use, so
raising the floor affects only the next one issued — this is the cheap
direction, unlike record 032's, where raising strands live accounts.
