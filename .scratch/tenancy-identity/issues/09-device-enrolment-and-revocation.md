# 09 — Device enrolment, the Device principal, and revocation

**Status:** ready-for-agent

## What to build

The whole life of a terminal: an admin enrols it against a Store, it holds a long-lived token
across reboots and outages, and an admin kills it the moment it is lost.

**Enrolment.** An admin generates a short-lived, **single-use** code bound to one Store, and
names the Device — "Counter 2" is what appears in reports. The terminal exchanges the code
once for a high-entropy opaque token; the code is consumed, atomically, so a race cannot mint
two Devices from one code. The token is stored **hashed** server-side and presented by the
terminal in an `Authorization` header — not a cookie, so the terminal is structurally immune
to CSRF and exempt from issue 03's `Origin` gate.

**The Device code is load-bearing, not decoration.** `checkout` builds every Order number from
it — the code plus a per-Device sequence, because a server-allocated sequence is impossible
offline. If two Devices in one Store share a code, `C2-0421` names two different sales and a
refund can be paid against the wrong one. **Uniqueness is enforced at enrolment, per Store**,
not a naming convention an admin is trusted to follow. A code is not reused after a Device is
revoked, because old receipts still carry it.

**A Device is never moved between Stores.** It is revoked and re-enrolled. A Device carries
Store-scoped local state — cached catalog, sales settings, table labels, PIN hashes, and
recent Orders — and re-pointing it without clearing that state would show the new Store's
cashier the old Store's sales while offline, where no server check can intervene. **Enrolment
starts from empty local state**, which is what makes re-enrolment the safe path.

**Revocation is real, not advisory.** The `revoked` flag is checked on **every** authenticated
request, and a revoked Device can do nothing further. The admin device list shows every
Device with the time it was last seen, so a terminal that stopped reporting is noticed.

**Who owns which part of revocation** — three areas touch it, one owner each:

| Piece | Area |
| --- | --- |
| The `revoked` flag, the revoke action, and the rule that every authenticated request checks it | **this issue** |
| Enforcing that check on the replay endpoint, and writing the quarantine row | `offline-sync` |
| The adjudication screen, accept/reject, and the recorded decision | `hardening` |

This issue builds the check and tests it on the procedures it exposes. The replay endpoint
does not exist yet and is not this area's to build.

## Acceptance criteria

- [ ] An admin generates an enrolment code bound to one Store, with a name and a short code
      for the Device.
- [ ] The code is single-use and short-lived: a second exchange fails, an expired code fails,
      and **two concurrent exchanges mint at most one Device**.
- [ ] The Device short code is unique within its Store — enrolment refuses a code already in
      use there — and is not reissued after that Device is revoked.
- [ ] The token is high-entropy, stored hashed, and appears in no log, no error message, and
      no URL.
- [ ] A Device-token request derives its Tenant and Store from the Device, never from the
      request; a Device cannot act for another Store.
- [ ] Device-token procedures are exempt from the `Origin` gate, and cookie procedures do not
      accept a Device token — the two principals do not substitute for one another.
- [ ] The token survives a terminal restart and a network outage without an admin.
- [ ] Enrolment begins from empty local state; no path re-points an enrolled Device at another
      Store.
- [ ] The device list shows every Device with its last-seen time, and last-seen updates on
      activity.
- [ ] Revoking a Device is immediate: every subsequent authenticated request from it is
      refused, asserted on more than one procedure.
- [ ] Only `admin` may generate a code, name a Device, or revoke one; each action is audited.
- [ ] WCAG 2.2 AA on both screens, asserted by the existing automated accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/devices-1440.svg`
- Image · whole-screen · 1280: `design/lofi/pos/device-enrolment-1280.svg`

## Depends on

- 05 — Store management
- 04 — Roles, Store membership, and the authorisation gate

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` — `Device`,
  `EnrolmentCode`, the per-Store code uniqueness constraint
- `packages/backend/src/**` — enrolment, revocation, and the Device principal per ADR-0008
- `apps/api/src/context.ts` — the Device-token principal
- `apps/backoffice/src/routes/**`, `apps/backoffice/src/features/**` — the devices screen
- `apps/pos/src/routes/**`, `apps/pos/src/features/**` — the enrolment screen
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 21–27), ADR-0007, Security criteria
5, 6, 7. Merged from the originally-drafted enrolment and revocation slices — one Device
lifecycle, one ticket._

_The service worker, IndexedDB, the Outbox, and the actual on-device sync transport are
`offline-sync`'s. This issue stores the token durably on the terminal by the simplest means
the shell already supports; it does not build the sync layer._
