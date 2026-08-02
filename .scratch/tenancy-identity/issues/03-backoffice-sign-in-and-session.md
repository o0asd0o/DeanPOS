# 03 — Back-office sign-in, session, sign-out, and the `Origin` gate

**Status:** ready-for-agent

## What to build

A tenant admin opens the back-office, signs in with an email and a password, and stays signed
in across a browser restart. They sign out and the session is dead server-side, not merely
forgotten by the browser. This is the slice where issue 01's principal stops being a test
construction and starts coming from a real credential.

The session is an opaque server-side id in an httpOnly, Secure, SameSite=Lax cookie scoped to
the registrable domain so the `api.` origin receives it. **Persistent, with an explicit
expiry** — not a session cookie, or every browser restart is a new sign-in. Idle expiry and
absolute expiry both apply. Sign-out revokes the row.

A User provisioned with a temporary password (issue 02) must change it before reaching
anything else.

**The `Origin` gate ships here, with the first cookie-authenticated procedure, because after
this issue there will be dozens.** `SameSite=Lax` is not the control people assume it is:
`pos.`, `admin.`, and `api.` are all same-site under one registrable domain, so a page on the
terminal origin is same-site with the back-office cookie and `Lax` will send it. Every
cookie-authenticated procedure therefore requires an `Origin` header **exactly** matching
`https://admin.<domain>` and refuses otherwise — including on safe methods, since a
state-changing GET is a mistake this rule should also catch. **A missing `Origin` is a
refusal, not a pass.** Device-token procedures are exempt; they carry no ambient credential,
so there is nothing for a foreign origin to ride.

## Acceptance criteria

- [ ] A provisioned admin signs in with email and password and lands in the back-office; the
      tenant on every subsequent request derives from the session, never from the request.
- [ ] The cookie is httpOnly, Secure, SameSite=Lax, scoped to the registrable domain, and
      **persistent with an explicit expiry** — asserted on the `Set-Cookie` header, because
      "survives a browser restart" is exactly what a session cookie does not do.
- [ ] Sessions are server-side and revocable. Sign-out revokes the row; the cookie alone
      cannot resurrect it.
- [ ] Idle expiry and absolute expiry are both enforced, each with its own test.
- [ ] A sign-in failure is indistinguishable between an unknown email and a wrong password —
      **in message and in timing**.
- [ ] A User holding a temporary password is forced to set a new one before any other
      procedure succeeds.
- [ ] Every cookie-authenticated procedure refuses a request whose `Origin` is
      `https://pos.<domain>`, whose `Origin` is a foreign host, and which carries **no**
      `Origin` header — three cases, asserted separately.
- [ ] Nothing logs a password or a session id.
- [ ] Wrong-tenant probes on every procedure this issue exposes.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/login-1440.svg`

## Depends on

- 02 — Platform-admin tenant provisioning

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` — `Session`
- `packages/backend/src/**` — sign-in, sign-out, and session handlers per ADR-0008
- `apps/api/src/app.ts` and `apps/api/src/context.ts` — the cookie principal and the `Origin` gate
- `apps/backoffice/src/routes/**` and `apps/backoffice/src/features/**` — per ADR-0009
- `packages/contract/src/contract.ts`

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 14–20), Security criteria 9, 10, 20.
Multi-factor authentication and email-based self-service password reset are out of scope for
v1; admin-initiated reset arrives in issue 06._
