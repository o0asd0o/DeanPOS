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

### Implementer notes (2026-08-02)

Four decisions had no existing record or explicit spec answer and were made to keep this
issue moving. Flagging each plainly rather than presenting it as pre-decided — the `decider`
should confirm or override:

1. **`User.email` is globally unique, not merely unique per Tenant.** Back-office sign-in
   takes only an email and a password, with no tenant selector, and the PRD forbids deriving
   the tenant from client input — so the sign-in lookup needs exactly one account per email
   across every Tenant, or it is ambiguous which Tenant a coincidentally-shared email belongs
   to. Enforced as a `@unique` Postgres index (`User_email_key`), the same "database
   constraint, not an application check" shape record 029 and the `cash` PaymentMethod
   pattern already use elsewhere.
2. **The cross-tenant lookups sign-in and every session-authenticated request need — email →
   account, session id → Tenant — reuse record 029's exact pattern**: `withTenantScope`'s
   single `app.tenant_id` GUC, with the scope value set to the email or the session id
   instead of a real Tenant id, and a narrow, additive RLS policy on `User`
   ("user_login_lookup") and `Session` ("session_self_lookup") that only matches that one
   value. No second session variable, `packages/backend/src/db/client.ts` has a zero-line
   diff, and the existing tenant-matching policies are untouched (see the migration file's
   own comments). This is an extension of record 029's reasoning to two new tables rather
   than a re-decision, but it is a new application of it and worth the reviewer's own look.
3. **Session idle and absolute lifetimes are 30 minutes and 30 days.** No number is named
   anywhere in the PRD, this issue, or a decision record — acceptance criterion 4 requires
   both timers to exist and be tested, so a number had to be picked. See
   `packages/backend/src/auth/session-policy.ts`.
4. **`auth.me`** (`{authenticated, mustChangePassword}`) was added to the contract. It isn't
   named by the issue, but `_shell.tsx`'s `beforeLoad` guard (record 030's requirement) has
   no other way to learn the session's state — the cookie is httpOnly and unreadable from the
   client by design. It carries no other information and is exempt from the
   forced-password-change gate for the obvious reason.

**Known test-environment gap, not a product gap:** the back-office's `happy-dom` test
environment enforces the WHATWG rule that a script cannot read or set the `Cookie` or
`Set-Cookie` headers, so a real, cookie-driven, end-to-end "sign in, land in the shell"
round trip cannot be exercised from `apps/backoffice`'s test suite. That exact round trip
**is** proven end-to-end server-side, under Node, in `apps/api/tests/sign-in.test.ts` and
`apps/api/tests/forced-password-change.test.ts`. The front-end tests instead render the
shell directly through the test seam's existing direct-principal path (`actors.asTenant`,
extended with an optional `mustChangePassword` flag) and drive the sign-in/set-password
*screens'* own states through real form submissions against the real handlers. Worth a
second look if a future issue needs a true end-to-end front-end auth test.

**Nineteen routes moved under `_shell/`, not eighteen** — record 030 counted eighteen; a
nineteenth (`reports/by-item.tsx`) exists in the current tree. `git mv` with no content
edit, per the record, except for the two mechanical adjustments record 030 didn't
anticipate: the `createFileRoute` path string (already documented as tsr's own job) and
each moved file's relative import depth, which the move itself changes by one or two
levels regardless of tooling.

5. **Record 031 applied: the pre-auth policies stop borrowing `app.tenant_id`.** The
   committed migration keyed both `session_self_lookup` and `user_login_lookup` on
   `app.tenant_id` — the same variable every tenant-isolation rule in the schema compares
   against — reasoning that a session id and an email could never collide with a real
   tenant id. Record 031 overturned that: session ids and tenant ids are both
   `randomUUID()`, same generator, same space, so the containment for the session case was
   never true by format, only by the accident that today's two queries happen to run one
   safe statement each. The migration now sets two purpose-named variables,
   `app.session_id` and `app.login_email`, through the same single `set_config` choke
   point in `packages/backend/src/db/client.ts` — added there as `withSessionScope` and
   `withLoginScope`, both delegating to a new private `withScope`, with `withTenantScope`
   kept byte-identical. The dead `OR "id" = current_setting('app.tenant_id', true)` branch
   on `session_tenant_update` is deleted — traced to have no caller, since all three
   `Session` writers run under a real tenant id. `find-user-by-email-for-sign-in.query.ts`
   and `find-session-by-id.query.ts` now call `withLoginScope`/`withSessionScope` instead
   of `withTenantScope`; their public signatures are unchanged. The stale comment on
   `touch-session.command.ts` describing the design the dead branch was written for is
   removed. Three regression tests were added to
   `packages/backend/tests/auth/session-and-login-rls.test.ts`: a session scope cannot
   read `User` or `Store`, a login scope reads exactly one row even with a sibling `User`
   in the same tenant, and a tenant-scoped connection can no longer `UPDATE` a `Session`
   row whose id happens to equal its own tenant id (the regression lock on the deleted
   `OR`). `packages/backend/tests/db/with-tenant-scope.test.ts` and
   `apps/api/tests/tenant-isolation-grep.test.ts` are both a zero-line diff, and
   `set_config` still appears at exactly one call site. `User.email` global uniqueness and
   the 30-minute/30-day session lifetimes are ratified unchanged by the same record; only
   the comment on `session-policy.ts` now cites it instead of describing a guess.
