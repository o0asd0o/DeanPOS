# 03a — The password policy and sign-in throttling

**Status:** ready-for-agent

## What to build

The two security controls issue 03 shipped without, because neither existed anywhere in the
documents and both were routed to the human rather than invented in a lane. The human delegated
them back; they are settled by [record 032](../../decisions/032-the-password-policy.md) and
[record 033](../../decisions/033-throttling-sign-in.md).

**Both records are binding and contain the concrete values, the verbatim copy, and the traps.
Read them before writing anything.** This issue exists to give that work a home, not to
re-decide it.

Why now rather than folded into issue 06: **`auth.setPassword` accepts a one-character password
on `main` today**, and `platformAdmin.provisionTenant` carries a live `z.string().min(8)` that
contradicts record 032. Sign-in is unthrottled, which is both a credential-stuffing surface and
a denial-of-service one — every attempt blocks the entire API for one scrypt derivation.

## Acceptance criteria

**Password policy — record 032**

- [ ] A password shorter than the minimum, or longer than the maximum, is refused by the server
      with the named message; the same normalisation runs on the set path and the verify path,
      asserted with a non-ASCII password set once and signed in with once.

**Sign-in throttling — record 033**

- [ ] Repeated failed sign-ins for one email address are refused after a threshold, and the
      refusal is **identical in shape, status and message** to a wrong password — asserted for
      an address that exists **and** for one that does not, in the same test.
- [ ] The failure counter increments for an email that matches no User — asserted directly,
      because the opposite is an account-enumeration oracle.
- [ ] A throttled request does not reach the password hash — asserted, not assumed.
- [ ] Repeated failures from one client address are refused independently of the per-address
      account, and a request with no forwarded address is throttled rather than exempted.
- [ ] A lock lifts by itself after the configured period and a correct password then succeeds;
      a successful sign-in clears that address's counter.

## Depends on

- 03 — Back-office sign-in, session, sign-out, and the `Origin` gate (merged)

## Relevant files

- `packages/backend/src/common/password.ts`, and a new `password-policy.ts`
- `packages/backend/src/auth/handlers/set-password.ts`, `sign-in.ts`
- `packages/backend/src/platform-admin/handlers/provision-tenant.ts` — the live `.min(8)`
- `packages/schemas`, `packages/contract/src/contract.ts`
- `packages/backend/src/db/prisma/schema.prisma` and `migrations/**` — `SignInThrottle`
- `apps/api/src/{app,context,test-seam}.ts`, `packages/backend/src/common/ctx.ts`
- `apps/backoffice/src/features/**` — the set-password screen's hint text
- `docker/Caddyfile` — `X-Forwarded-For`

## Comments

_Cut by the orchestrator on 2026-08-02 as the home record 032 and record 033 both asked for.
Neither record changes an existing acceptance criterion. Issue 03's criterion 5
(message-and-timing indistinguishability) is the constraint record 033 is built around and it
gains a regression lock rather than a weakening._

**Three traps, all named in the records, all easy to get wrong:**

1. **Normalisation is one function**, called from set *and* verify. Divergence is a silent,
   permanent lockout for every non-ASCII user, and no ASCII test catches it.
2. **Increment the counter on every failure, whether or not a User was found.** Counting only
   real accounts is a perfect enumeration oracle. Key on the *submitted email string*, never on
   a found row — response time may vary with what the client sent, never with what the server
   knows.
3. **Check the throttle before the password hash**, mandatorily. `scryptSync` blocks the whole
   API for one derivation, so an unthrottled loop from one machine is a full outage. The
   implementer must **time one `verifyPassword` under `bun` and report the figure** — that is
   the API's per-request block time.

**`SignInThrottle` has no `tenant_id`, no `user_id` and no foreign key, so it gets no RLS** —
the PRD's isolation criterion is scoped to tenant-owned tables. Record 033 makes that a no-go
rather than an omission, because no test in the repo asserts RLS coverage.

**Inherited by `release-ops`:** breach-password screening, as a knowingly recorded deviation
from a NIST `SHALL`. Record 032 lists five trackable clauses. NIST ties the blocklist's required
size to the attempt limit, so records 032 and 033 are load-bearing for each other — **neither is
complete until the blocklist ships**.
