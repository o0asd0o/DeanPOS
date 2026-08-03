# 11 — PIN throttling and lockout

**Status:** ready-for-agent

_**Carried in from [record 058](../../decisions/058-pin-management-is-a-back-office-action.md),
before this issue is built.** Issue 10 removed every server-side PIN comparison, which changes what
this issue can be:_

> - _Throttling is **on-device and nowhere else** — unlock is verified in the browser (057 Q1) and
>   **no server procedure verifies a PIN** (058), so no server-side attempt counter exists or may be
>   added._
> - _Keyed per `userId`, **persisted behind the existing accessor-module pattern so it survives a
>   page reload** — an unthrottled reload is the whole bypass._
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

- `apps/pos/src/features/**` — the throttle state and its durable store
- `packages/backend/src/**` — the server-side counterpart for online attempts
- `packages/contract/src/contract.ts`

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

**No criterion of this issue changes.** What you inherit is the `SignInThrottle` table, reused
under a `pin:` key prefix for the server-side online-attempt half. The Device-side offline lockout
stays your own mechanism, because it must work with no network at all.
