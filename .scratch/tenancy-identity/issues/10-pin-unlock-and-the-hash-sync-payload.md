# 10 — PIN unlock and the hash-sync payload

**Status:** ready-for-agent

## What to build

A cashier walks up to an enrolled terminal, taps four to six digits, and is serving in
seconds — **with no network at all**, because an outage is exactly when the queue does not
stop. They set their own PIN on first use so nobody else knows it, change it if someone sees
them enter it, and an admin can reset a forgotten one without a support call. A cashier locks
the terminal when they step away, so the next person enters their own PIN.

**The rule that governs every line of this issue:** the Device proves *which tenant and
store*; the PIN proves *which person*. **A PIN never authenticates a request.** Any server path
that accepts a PIN as proof of identity — with or without a Device token — is a defect, and
unlock in particular is refused without a valid, unrevoked Device token. **Setting, changing and
resetting a PIN are back-office actions authenticated by the signed-in password session, which
is a stronger factor than the PIN it writes; they require no Device token and they verify no
PIN** — see [record 058](../../decisions/058-pin-management-is-a-back-office-action.md).

PIN hashing uses **PBKDF2-HMAC-SHA-256 via WebCrypto**, with **its own parameters in its own
file** — see [record 057](../../decisions/057-pin-unlock-verifies-locally-with-pbkdf2.md). It is
deliberately not the scrypt record 028 chose for passwords: scrypt cannot run in a browser, and
criterion 4 requires the terminal to verify a PIN with no network at all.

_Amended 2026-08-03, twice. This paragraph first named `Bun.password` argon2id, which
[record 028](../../decisions/028-password-hashing-runs-on-both-runtimes.md) had already removed from
the backend — the tests run on Node, where `Bun` does not exist. Correcting it to scrypt then
surfaced the real problem: `node:crypto` does not exist in a browser either, and WebCrypto has no
scrypt, so criteria 2 and 4 could not both hold. Record 057 resolved it._

**The sync payload is this area's worst exposure and it is asserted on the payload itself**,
not on the device's behaviour. ADR-0007 calls the PIN hashes at rest on a Device a deliberate,
bounded credential exposure; a tradeoff nobody asserts is just an exposure. The bounds are the
test:

- exactly that Store's **active** Users' PIN hashes — no other Store's, no deactivated User's
- **no password hash, for anyone, ever**
- no email, no role beyond what unlock needs, no other Store's User ids
- a Device asking for a Store it is not enrolled at is refused

Membership follows issue 04: a `cashier` or `manager` must be a member of the Device's Store
or unlock is refused; an `admin` is exempt and may unlock any Device in their Tenant.

## Acceptance criteria

- [ ] A User sets their own PIN, and changes it, from the account menu in the back office; an
      `admin` resets a forgotten one from the user editor, which clears it so the User sets a
      new one. The PIN is 4–6 digits, and **no procedure ever verifies a submitted PIN against
      a stored hash** (record 058).
- [ ] PIN hashing uses **PBKDF2-HMAC-SHA-256 via WebCrypto** (record 057) with **its own
      parameters in its own file**, chosen knowing the hash sits on a tablet and must be
      verified by a browser with no network; the hash/verify round-trip **and RFC 7914 §11's
      published vectors** are tested **directly, not through the seam**. It deliberately does
      **not** share the password primitive of record 028 — `node:crypto` does not exist in a
      browser and WebCrypto has no scrypt, so criterion 4 could not otherwise hold. The
      password policy of record 032 does not apply to PINs — a PIN is a second factor to
      Device possession and its guess budget is issue 11's, not its length.
- [ ] Unlock succeeds with the right PIN and fails with the wrong one, and **fails outright
      without a valid, unrevoked Device token** — asserted as its own case.
- [ ] Unlock works with no network, against the locally synced hashes.
- [ ] A `cashier` or `manager` who is not a member of the Device's Store cannot unlock it; an
      `admin` can unlock any Device in their Tenant.
- [ ] Locking the terminal returns it to the PIN prompt and clears the acting User.
- [ ] The sync payload for Store X contains PIN hashes for exactly Store X's **active** Users,
      and no password hash, no email, no other Store's User ids — asserted on the payload.
- [ ] Deactivating a User removes their hash from the next payload; reactivating restores it.
- [ ] A Device requesting the payload for a Store it is not enrolled at is refused.
- [ ] Nothing logs a PIN or a PIN hash. Log the User id and the Device id.
- [ ] WCAG 2.2 AA on the unlock screen at both viewports, asserted by the existing automated
      accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/pin-unlock-1280.svg`
- Image · whole-screen · 390: `design/lofi/pos/pin-unlock-390.svg`

## Depends on

- 09 — Device enrolment, the Device principal, and revocation
- 06 — User management

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` — the PIN
  hash on `User`
- `packages/backend/src/**` — PIN handlers and the sync-payload handler per ADR-0008
- `apps/pos/src/routes/**` and `apps/pos/src/features/**` — the unlock screen
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 28–32, 35, 36), ADR-0007, Security
criteria 4, 15, 16._

_**Deliberately not tested here:** offline PIN unlock in a real browser. The hash-sync and
verification logic is tested at the seam; exercising it with a real service worker and
IndexedDB needs the browser seam, which is `offline-sync`'s. That area must cover it — the
PRD names it so it is not lost. Throttling and lockout are issue 11._
