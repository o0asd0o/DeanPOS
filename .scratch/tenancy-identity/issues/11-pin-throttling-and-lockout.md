# 11 — PIN throttling and lockout

**Status:** ready-for-agent

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
