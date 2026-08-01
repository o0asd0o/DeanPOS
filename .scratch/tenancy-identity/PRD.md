# Tenancy & identity

- **Status:** ready-for-agent
- **Area:** 2 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`
- **Blocks:** `catalog`, `checkout`, `offline-sync`, `drawer-sessions`, `reporting`, `hardening`

## Problem Statement

DeanPOS is one deployment serving many unrelated restaurants, but after `foundation`
there is no notion of a restaurant at all — no Tenant, no Store, no User, and no way for
anybody to sign in. Every subsequent area writes rows that belong to somebody, and none
of them can be built until "belongs to" is a thing the database enforces rather than a
thing the code remembers.

Two failure modes make this area unusually unforgiving:

**A tenant sees another tenant's sales.** One missing `WHERE tenant_id = ?` in one query
out of hundreds leaks a competitor's revenue. Code review does not reliably catch the
absence of a clause, and the volume of queries only grows.

**A cashier cannot sign in because the internet is down.** The terminal must complete
sales offline (ADR-0003), which means authentication cannot depend on reaching the
server. Every conventional web-auth answer fails this requirement, and retrofitting
offline unlock after `checkout` is built means rewriting the terminal's entire session
model.

## Solution

Tenancy is enforced by PostgreSQL, not by discipline. Every tenant-owned table carries
`tenant_id`, has Row-Level Security enabled and forced, and is read through a connection
whose tenant is set from the authenticated principal at the single choke point
`foundation` established. A query that forgets its tenant filter returns nothing.

Identity splits by surface, because the two surfaces have genuinely different needs:

- **Back-office** (`admin.` origin): ordinary email + password sessions in an httpOnly
  cookie. Online only. This is a desk, not a counter.
- **Terminal** (`pos.` origin): the Device is enrolled once by an admin and holds a
  long-lived token; a User unlocks it with a 4–6 digit PIN. PIN hashes for that Store's
  Users are synced to the Device, so unlock works with no network at all.

On top of both sits one authorisation model — `cashier`, `manager`, `admin` — and the
**Override**: a manager's PIN entry that authorises an action a cashier may not perform
alone, recorded against that action with the approving User and a reason. Overrides work
offline, because a manager standing at the counter during an outage is exactly when they
are needed.

## User Stories

**Tenant and Store**

1. As a platform admin, I want to provision a Tenant, so that a new restaurant can start using DeanPOS.
2. As a platform admin, I want to create the Tenant's first admin User, so that the restaurant can take over its own setup.
3. As a tenant admin, I want to create Stores under my Tenant, so that each outlet is tracked separately.
4. As a tenant admin, I want to edit a Store's name and details, so that a rename does not require support.
5. As a tenant admin, I want to deactivate a Store rather than delete it, so that its historical sales remain intact and attributable.
6. As a tenant admin, I want to see only my own Tenant's Stores, so that the platform is not a shared address book.

**Tenant settings**

6a. As a tenant admin, I want to set my Tenant's timezone, so that a business day means what it means where my shop is.
6b. As a tenant admin, I want to set each Store's business-day start time, so that a shop closing at 2am does not split its night across two days.
6c. As a tenant admin who is VAT-registered, I want to turn VAT on and set the rate, so that my receipts and reports show it.
6d. As a tenant admin who is not VAT-registered, I want VAT to be off by default and stay off, so that nothing in the product implies a registration I do not hold.
6e. As a tenant admin, I want turning VAT on to affect only sales from that point forward, so that enabling it does not invent VAT on last month's takings.
6f. As a tenant admin, I want to configure the payment methods my business accepts, so that a GCash sale is recorded as GCash.
6g. As a tenant admin, I want cash to always exist and be undeletable, so that the till can never be configured into a state where nothing can be sold.
6h. As a tenant admin, I want to pick from suggested methods — Card, GCash, Maya, Bank transfer — so that setup is a few taps rather than typing.
6i. As a tenant admin, I want to name a payment method myself, so that what appears in my reports is the word my staff use.
6j. As a tenant admin, I want to choose which payment methods are available at which Store, so that an outlet without a card machine does not offer one.
6k. As a tenant admin, I want to retire a payment method without erasing it from past sales, so that history stays readable.
6l. As a tenant admin, I want it made plain that a non-cash method records an amount and charges nothing, so that I do not believe DeanPOS is processing payments.
6m. As a tenant admin, I want to set the cash Variance tolerance for my Tenant, so that my stores are held to a figure I chose.

**Users and roles**

7. As a tenant admin, I want to create a User with an email, a role, and an admin-set temporary password, so that staff can sign in without an email being sent. There is no invitation — no email transport exists.
8. As a tenant admin, I want to assign a User to one or more Stores, so that a cashier at one outlet cannot operate another.
9. As a tenant admin, I want to change a User's role, so that a promotion does not require a new account.
10. As a tenant admin, I want to deactivate a User, so that a departing employee immediately loses access without erasing their sales history.
11. As a tenant admin, I want a deactivated User's past Orders and Overrides to remain attributed to them, so that the audit trail survives staff turnover.
12. As a manager, I want to see which Users are assigned to my Store, so that I know who can open a DrawerSession.
13. As a cashier, I want to be unable to see or change anything about other Users, so that the system does not depend on my restraint.

**Back-office authentication**

14. As a tenant admin, I want to sign in to the back-office with my email and password, so that I can manage the restaurant.
15. As a manager, I want to sign in to the back-office from my phone, so that I can check on the store without going in.
16. As a signed-in user, I want my session to survive closing and reopening the browser, so that I am not signing in constantly — which means a **persistent** cookie with an explicit expiry, not a session cookie.
17. As a signed-in user, I want to sign out, so that a shared computer does not leave my account open.
18. As a signed-in user, I want my session to expire after a period of inactivity, so that an abandoned browser is not an open door.
19. As a tenant admin, I want to reset a User's password when they forget it, so that a lockout is resolved in-house.
20. As a user, I want a failed sign-in to tell me nothing about whether the email exists, so that the system cannot be used to enumerate staff.

**Device enrolment**

21. As a tenant admin, I want to enrol a terminal against a specific Store, so that every sale it takes is attributed correctly.
22. As a tenant admin, I want enrolment to use a short-lived, single-use code, so that an enrolment link cannot be reused or shared.
23. As a tenant admin, I want to name each Device, so that "Counter 2" is meaningful in reports and in the device list.
23a. As a tenant admin, I want each Device to carry a short code that is **unique within its Store**, so that the order numbers it prints — `C2-0421` — identify one sale in that shop and not two.
23b. As a tenant admin, I want enrolment to refuse a code already used by another Device in the same Store, so that uniqueness is enforced rather than remembered.
24. As a tenant admin, I want to see every enrolled Device with the time it was last seen, so that I notice a terminal that stopped reporting.
25. As a tenant admin, I want to revoke a Device immediately, so that a lost or stolen tablet stops being a till.
26. As a tenant admin, I want a revoked Device to be unable to sync anything further, so that revocation is real and not advisory.
27. As a cashier, I want the terminal to stay enrolled across restarts and network outages, so that a reboot mid-service does not require an admin.

**PIN and offline unlock**

28. As a cashier, I want to unlock the terminal with a short PIN, so that I can start serving in seconds.
29. As a cashier, I want PIN unlock to work with no network, so that an outage does not stop the queue.
30. As a cashier, I want to set my own PIN on first use, so that nobody else knows it.
31. As a cashier, I want to change my PIN, so that I can respond if someone sees me enter it.
32. As a tenant admin, I want to reset a User's PIN, so that a forgotten PIN does not need a support call.
33. As a manager, I want repeated wrong PIN entries to lock the terminal for a period, so that a stranger cannot guess their way in.
34. As a manager, I want that lockout to work offline, so that it is not trivially bypassed by pulling the network cable.
35. As a cashier, I want to lock the terminal when I step away, so that the next person must enter their own PIN.
36. As a manager, I want the terminal to know which PINs belong to my Store only, so that a Device holds no more credentials than it needs.

**Authorisation and Override**

37. As a manager, I want certain actions to require my approval, so that a cashier cannot void, refund, or discount unsupervised.
38. As a manager, I want to authorise an action by entering my PIN on the cashier's terminal, so that approval does not require me to sign in separately.
39. As a manager, I want my approval recorded with my name, the action, and a reason, so that the audit trail names a person.
40. As a manager, I want Overrides to work offline, so that an outage does not block a legitimate refund.
41. As a manager, I want an Override to authorise exactly one action, so that an approval cannot be reused for a second void.
42. As a tenant admin, I want to review Overrides that occurred at my Stores, so that I can spot a pattern.
43. As a cashier, I want a clear prompt when an action needs a manager, so that I know to call one rather than guess.

**Tenant isolation**

44. As a tenant admin, I want it to be impossible to read another Tenant's data by changing an id in a request, so that isolation does not depend on the front end.
45. As a tenant admin, I want a query that omits its tenant filter to return nothing rather than everything, so that a coding mistake is a bug and not a breach.
46. As a manager, I want a Device enrolled at one Store to be unable to submit sales for another Store, so that attribution cannot be forged from the terminal.
47. As a platform admin, I want my own access to be distinct from any Tenant's, so that platform operations are not performed while impersonating a customer.

## Implementation Decisions

**The tenant is derived, never supplied.** The tenant identity comes from the
authenticated principal — the back-office session or the Device token — and never from a
request header, a query parameter, a request body, or the subdomain. Any code path that
reads a tenant from client-controlled input is a defect regardless of what it then
checks.

**Row-Level Security.** Every tenant-owned table has RLS `ENABLED` **and `FORCED`, so
that the table owner does not bypass it**. The application connects as a role that is
neither superuser nor table owner. Policies compare `tenant_id` to a session setting
(e.g. `app.tenant_id`) set at the single connection choke point `foundation` built,
inside the same transaction as the query. A connection returned to the pool must not
carry a previous request's tenant.

`Tenant` itself and platform-admin tables sit outside tenant RLS by construction; they
are reachable only through platform-admin paths.

**Data model.**

- `Tenant` — the isolation root. Carries the settings below.
- `Store` — belongs to a Tenant; deactivated, never deleted. Carries a business-day start
  time, defaulting to `00:00`.
- `PaymentMethod` — belongs to a Tenant; a name, a `kind` (`cash` | `recorded`), an active
  flag, and its per-Store availability.
- `User` — belongs to a Tenant; has an email, a password hash, a PIN hash, a `Role`
  (`cashier` | `manager` | `admin`), and an active flag.
- `UserStore` — which Stores a User may operate. **Append-only with an `effective_from`
  timestamp**, never updated or deleted; un-assigning writes a closing row.
- `UserRole` — the User's role over time. **Append-only with an `effective_from`
  timestamp.** `User` carries the current role as a denormalised convenience; `UserRole`
  is the truth.
- `Device` — belongs to a Store; has a name, a **short code unique within its Store**, a
  hashed token, a last-seen timestamp, and a revoked flag.

**The Device code is load-bearing, not decoration.** `checkout` builds every Order number from
it — the code plus a per-Device sequence, because a server-allocated sequence is impossible
offline. If two Devices in one Store share a code, `C2-0421` names two different sales, and a
refund can be paid against the wrong one. **Uniqueness is a constraint enforced at enrolment**,
per Store, not a naming convention an admin is trusted to follow. It is also what lets a
cashier find a sale rung on the *other* terminal (`checkout` order lookup) — without it there
is nothing safe to search by. A code is not reused after a Device is revoked, because old
receipts still carry it.

**A Device is not moved between Stores.** It is revoked and re-enrolled, because a Device
carries Store-scoped local state — cached catalog, sales settings, table labels, PIN hashes,
and the recent-Orders store holding one Store's sales and their customer discount references.
Re-pointing a Device at another Store without clearing that state would show the new Store's
cashier the old Store's sales while offline, where no server check can intervene. **Enrolment
starts from empty local state**, which makes re-enrolment the safe path and a move the unsafe
one.
- `EnrolmentCode` — short-lived, single-use, bound to a Store.
- `Session` — back-office sessions, server-side, revocable.
- `Override` — the approving User, the action type, a reason, a timestamp, the Device and
  Store, and the id of the record it authorised. Written once, never updated.

Deactivation is a flag everywhere. Nothing that a sale can reference is ever hard-deleted.

**Tenant settings, and the shape they all share.** This area owns the settings that other
areas read. Every one of them follows the same rule, which is the rule that makes them safe:

> **A setting governs sales made from now on. The value in force is captured on the sale.**
> No report, receipt, or reconciliation ever reads a current setting to interpret a past
> Order. Same principle as the recorded price (ADR-0003), and the reason ADR-0010 is
> reversible at all.

The settings:

| Setting | Default | Read by |
| --- | --- | --- |
| Timezone | `Asia/Manila` | `reporting`, every rendered time |
| Business-day start (per Store) | `00:00` | `reporting`, `drawer-sessions` |
| VAT enabled | **off** | `checkout`, `reporting` |
| VAT rate | `12%` | `checkout`, `reporting` |
| PaymentMethod list | **`cash` only** | `checkout`, `drawer-sessions`, `reporting` |
| Variance tolerance | `0` **centavos** | `drawer-sessions` |
| Cash-movement Override threshold | `0` **centavos** | `drawer-sessions` |
| Table labels (per Store) | **empty list** | `checkout` |

**Table labels are a Store-scoped ordered list of free strings, empty by default** (ADR-0011).
A label is not a resource: nothing tracks occupancy, nothing prevents two Tickets carrying the
same label, and an empty list means the terminal shows no table control at all and the cashier
types a label instead. Editing or removing a label never rewrites a past sale, because the
label is captured on the Order like every other configuration.

**VAT defaults to off** (ADR-0010) because most target tenants sit below the ₱3,000,000
registration threshold. A product that ships VAT on hands those tenants figures that are
confidently wrong and a receipt that claims a registration they do not hold.

**PaymentMethods.** `cash` is seeded at Tenant creation with `kind: cash`, and is the only
method of that kind: it cannot be renamed, deactivated, deleted, or duplicated, and no
second `cash`-kind method may be created — enforced by a partial unique index, not by an
application check. Everything else is `kind: recorded`: a name, an amount, and nothing else.
DeanPOS contacts no provider and confirms nothing, and the back-office copy must say so
where the methods are configured, not only in the marketing.

Presets offered at setup — Card, GCash, Maya, Bank transfer — are **seed suggestions, not a
fixed enum**. Nothing downstream may branch on a method's name; the only thing code may
branch on is `kind`, which is what keeps `drawer-sessions`' expected cash correct when a
tenant adds a method nobody anticipated.

Methods deactivate rather than delete, and per-Store availability is a join, so an outlet
with no card machine simply does not offer one.

**Visual reference.** `ORC2_DESIGN="lofi"`. Mocks are committed:
`backoffice/login-1440`, `backoffice/devices-1440`, `backoffice/users-1440`,
`backoffice/settings-sales-1440`, `pos/pin-unlock-{1280,390}`, `pos/device-enrolment-1280`.

**Discounts are not here.** The Discount list is back-office CRUD over a priced concept and
lives with the catalog; only its *application* and its Override are this area's business.

**Password and PIN hashing.** Both use Bun's built-in argon2id (`Bun.password`); no new
dependency. Password and PIN parameters are configured separately — the PIN's are chosen
knowing the hash sits on a tablet.

**PIN hashes at rest on the Device are a deliberate, bounded exposure** (ADR-0007).
Bounds: only Users assigned to that Device's Store, only their PIN hashes, never their
password hashes, and never any other Store's. On-device attempt throttling with a
lockout that persists across a page reload, so pulling the network does not reset it.

**A PIN is a second factor to Device possession, never a credential on its own.** Any
server path that accepts a PIN without a valid, unrevoked Device token is a defect.

**Device token.** A high-entropy opaque token issued at enrolment, stored **hashed**
server-side, presented by the terminal in an `Authorization` header — not a cookie, so
the terminal is structurally immune to CSRF. Enrolment is: an admin generates a
single-use, short-lived `EnrolmentCode` bound to a Store; the terminal exchanges it once
for a token; the code is consumed.

**Revocation is checked on every request, including replay.** A revoked Device's queued
Orders arriving later are **quarantined, not silently accepted and not silently dropped**
— they are recorded for a human to adjudicate, because they may represent real money
already collected from real customers.

**Who owns which part**, because three areas touch this and only one may own each piece:

| Piece | Area |
| --- | --- |
| The `revoked` flag, the revoke action, and the rule that every authenticated request checks it | **this area** |
| Enforcing that check on the replay endpoint, and writing the quarantine row | `offline-sync` — it owns replay |
| The adjudication screen, accept/reject, and the recorded decision | `hardening` |

This area builds the check and tests it on the procedures it exposes. It does **not** own
the replay-time enforcement, because the replay endpoint does not exist yet. ADR-0007 and
`.scratch/APP-PLAN.md` were amended to this split on 2026-07-31; before that they placed
replay enforcement in `hardening`, which owns no endpoint.

**Back-office session.** An opaque server-side session id in an httpOnly, Secure,
SameSite=Lax cookie scoped to the registrable domain so the `api.` origin receives it.
Idle expiry plus absolute expiry. Sign-out revokes server-side, not just client-side.

**The cookie needs a CSRF control that the Device token does not, and here it is.**
`SameSite=Lax` stops a *cross-site* request, but `pos.`, `admin.`, and `api.` are all
same-site under one registrable domain — so a page on the terminal origin is same-site
with the back-office cookie and `Lax` will send it. The Device token is in an
`Authorization` header and is structurally immune; the session cookie is not, and the two
must not be assumed to share that property.

**Every cookie-authenticated procedure requires an `Origin` header exactly matching
`https://admin.<domain>`, and refuses otherwise** — including on safe methods, since a
state-changing GET is a mistake this rule should also catch. A missing `Origin` is a
refusal, not a pass. Device-token procedures are exempt: they carry no ambient credential,
so there is nothing for a foreign origin to ride.

**Password reset is admin-initiated.** A tenant admin sets a temporary password that must
be changed on next sign-in. There is no email-based self-service reset in v1, because
DeanPOS has no email transport and adding one is a whole integration. This is a
deliberate v1 limitation, not an oversight.

**Store membership, per role and per surface.** "Membership answers *where*" is not
enough on its own — the two surfaces ask different questions of it.

| | Terminal (`pos.`) | Back-office (`admin.`) |
| --- | --- | --- |
| `cashier` | must be a member of the Device's Store, or unlock is refused | sees only their own published Shifts and their own session summaries |
| `manager` | must be a member to unlock or approve an Override there | scoped to assigned Stores on every read and write |
| `admin` | **exempt** — an admin may unlock any Device in their Tenant | sees the whole Tenant; `UserStore` rows are not required |

**Expected cash is `manager` and `admin` only.** `drawer-sessions` and `reporting` both gate
on "the right to see expected cash"; that right **is the Role**, not a grantable per-User
permission. DeanPOS has no per-User permissions and adding one for a single flag would make
it the only one in the product. One rule, four surfaces: the close-time reveal, the running
summary, session history, and every report.

So: **`admin` is exempt from membership; `cashier` and `manager` are not.** A cashier with
no `UserStore` row can sign in to nothing on either surface — they have no Store to act in
and nothing to read. An admin with no `UserStore` row is normal and expected.

**"At that time" is answerable because role and membership are effective-dated.** An
Override created offline on Monday and replayed on Wednesday is re-verified against the
role and Store membership that were in force **on Monday**, not against today's. With a
mutable `Role` column and an undated `UserStore`, that sentence would be unimplementable —
a manager demoted on Tuesday would retroactively invalidate a legitimate Monday approval,
and nothing would record which it was.

Append-only rows with `effective_from` are the whole mechanism: one extra column and no
deletes, decided before any code exists, where it is free. `hardening` needs the same
history for its audit, so it is not a cost carried for one feature.

**Authorisation model.** `cashier` < `manager` < `admin`, plus Store membership. Role
answers *what kind of action*, membership answers *where*, subject to the admin exemption
above. Both are checked server-side
on every procedure; the front end hides what it must, but hiding is never the
enforcement.

**Override mechanism.** An Override is created by a manager entering their PIN on the
terminal at the moment of the action. It is bound to one action instance and is consumed
by it — one approval, one void. It carries a reason. When online, the server verifies the
manager's PIN and role. When offline, the terminal verifies against the locally synced
PIN hash and records the Override alongside the Order; on replay the server
**re-verifies** that the named User held the manager role and was assigned to that Store
at that time, and quarantines the Order if not.

The set of actions requiring an Override is fixed by ADR-0005: void a paid Order, refund
(whole or line), manual line price override, and closing a DrawerSession with a
Variance beyond threshold. This area builds the mechanism; `checkout` and `drawer-sessions`
attach it to their actions.

**Platform admin.** Tenant provisioning is admin-run; self-serve signup is not in v1.
Platform-admin identity is separate from any Tenant's users and its actions are audited.
It does not act by assuming a Tenant's user account.

**Migrations** follow ADR-0006 — forward-only, expand/contract. Enabling RLS on a table
is part of the same migration that creates it; a table that exists for even one release
without its policy is a table somebody queries without one.

## Testing Decisions

**What makes a good test here.** Assert what an actor can and cannot reach, never how the
code reached that conclusion. `expect(policyCheck).toHaveBeenCalled()` proves nothing; a
request from Tenant B's session returning zero rows for Tenant A's Store proves
everything.

**The seam.** The one established in `foundation` — a rendered route → TanStack Query →
oRPC client → in-process Hono via `app.request()` → Kysely → real lane PostgreSQL. This
area does not add a seam; it adds **actors** to the existing one. The seam helper gains
the ability to construct a request as: a given Tenant's back-office session, a given
enrolled Device, or an unauthenticated caller.

Real PostgreSQL is non-negotiable for this area, because RLS is the thing under test and
it does not exist anywhere else.

**The wrong-tenant probe suite is the centrepiece.** For every procedure this area
exposes, and as a reusable pattern for every area after it: seed two Tenants with
similar-looking data, authenticate as Tenant A, and address Tenant B's ids directly.
Expect not-found or empty — never Tenant B's row, and never an error message that
confirms the row exists. A procedure without a wrong-tenant probe is not considered
tested, and the helper that expresses this probe is a deliverable of this PRD.

Additionally, prove RLS is doing the work rather than the application layer: issue a
query deliberately missing its tenant predicate through the same connection path and
assert it returns nothing. If that test passes only because the repository added a
filter, RLS is not actually enforced and the test is lying.

**Also tested through the seam.** Sign-in and sign-out; session expiry and revocation;
enrolment code single-use and expiry; Device token acceptance and rejection; revoked
Device rejection; PIN unlock success and failure; PIN throttling and lockout persistence;
role gating on every procedure; Store-membership gating, including the admin exemption and
a cashier with no `UserStore` row reaching nothing on either surface; a persistent session
cookie carrying an explicit expiry rather than being a session cookie; Override creation and
single-use consumption.

**The PIN-hash sync payload, which is this area's worst exposure and had no test.**
ADR-0007 calls it a deliberate credential-exposure tradeoff; a tradeoff nobody asserts is
just an exposure. Asserted **on the payload**, not on the device's behaviour:

- The sync payload for Store X contains PIN hashes for exactly Store X's **active** Users
  — no other Store's, and no deactivated User's.
- It contains **no password hash**, for anyone, ever.
- It contains no email, no role beyond what unlock needs, and no other Store's User ids.
- Deactivating a User removes their hash from the next payload (Security criterion 16),
  and reactivating restores it.
- A Device requesting the payload for a Store it is not enrolled at is refused.

**The back-office CSRF control.** A cookie-authenticated procedure called with an `Origin`
of `https://pos.<domain>`, with a foreign origin, and with **no** `Origin` header is
refused in all three cases — asserted per case, because "same-site is not same-origin" is
exactly the assumption this control exists to break.

**Override re-verification is tested here as a procedure, not as a replay.** This area
exposes "re-verify this Override against the role and Store membership in effect at its
stated time" and tests it directly against the effective-dated history: a manager demoted
*after* the Override still verifies; a manager demoted *before* it does not; the same two
cases for Store membership. Driving it through an actual Outbox replay needs the replay
endpoint, which is `offline-sync`'s — a later area — and this PRD depends only on
`foundation`. `offline-sync` must call this procedure and says so in its own spec.

**Tenant settings, tested at their defaults first.** A freshly provisioned Tenant is the
configuration most tenants will run, and it is the one most likely to go untested because
it is the boring one.

- A new Tenant has VAT **off**, exactly one PaymentMethod (`cash`, `kind: cash`), a
  Variance tolerance of zero, and `Asia/Manila`.
- `cash` cannot be renamed, deactivated, deleted, or duplicated; creating a second
  `kind: cash` method is refused **by the database**, asserted with two concurrent attempts.
- A `recorded` method can be created, renamed, made available per Store, and deactivated;
  deactivating it does not affect any Order that used it.
- Per-Store availability is enforced server-side — a Device at a Store with no card machine
  cannot submit a Payment naming one.
- Changing the VAT rate, changing the timezone, changing the business-day start, and
  renaming a method **leave every existing Order's captured values untouched** — one test
  per setting, because this is the property the whole design rests on.
- Only `admin` may change any Tenant setting; `manager` and `cashier` are refused
  server-side, and each change is audited with the actor and both values.
- Wrong-tenant probes on every settings procedure — a Tenant may not read or write
  another's VAT rate or method list.

**Tested directly, not through the seam.** Password and PIN hash verification round-trips
and parameter configuration — pure functions over a hashing primitive.

**Deliberately not tested here.** Offline PIN unlock in a real browser: the hash-sync and
verification *logic* is tested at the seam, but exercising it with a real service worker
and IndexedDB needs the browser seam deferred to `offline-sync`. That area must cover it,
and this PRD names it so it is not lost.

**Negative tests outnumber positive ones in this area, deliberately.** The interesting
behaviour is what is refused.

## Security Criteria

1. **Tenant is derived from the authenticated principal only.** Reading it from client
   input fails review even when followed by a check.
2. **RLS is `ENABLED` and `FORCED` on every tenant-owned table**, and the application
   role is neither superuser nor owner. A table created without its policy in the same
   migration is a finding.
3. **Every procedure has a wrong-tenant probe.** No exceptions, including read-only ones.
4. **A PIN never authenticates alone.** No valid Device token, no PIN acceptance.
5. **Device tokens are stored hashed**, are high-entropy, and appear in no log, no error
   message, and no URL.
6. **Revocation is enforced on every request including replay**, and revoked-Device
   Orders are quarantined for a human rather than dropped or accepted.
7. **Enrolment codes are single-use, short-lived, and Store-bound**, and consuming one is
   atomic — a race must not mint two Devices from one code.
8. **PIN throttling and lockout survive a page reload and work with no network.**
9. **Sign-in failures are indistinguishable** between unknown email and wrong password,
   in message and in timing.
10. **Sessions are server-side and revocable**; sign-out revokes server-side. Cookies are
    httpOnly, Secure, SameSite=Lax.
11. **The Override audit row is append-only** and names the approving User, the action,
    the reason, the Device, and the Store.
12. **An offline Override is re-verified on replay** against the role and Store
    membership that were in effect at the time.
13. **Authorisation is server-side on every procedure.** Hiding a button is presentation,
    not enforcement.
14. **Untrusted input:** email, password, PIN, enrolment code, Device token, every id in
    every request. All validated at the contract boundary; ids are additionally
    authorised, not merely validated.
15. **Never logged:** passwords, PINs, PIN hashes, Device tokens, session ids, enrolment
    codes. Log the User id and the Device id instead.
16. **Deactivation is immediate.** A deactivated User's existing sessions are revoked and
    their PIN hash is removed from Devices on next sync.
17. **Tenant settings are `admin`-only and audited**, recording the actor and both the old
    and new value. VAT and the Variance tolerance are financial controls; a control that
    can be widened without a trace is not a control.
18. **A setting change never reaches a completed sale.** Any code path that reads a current
    Tenant setting to interpret, re-price, or re-render a past Order is a review finding —
    it silently rewrites history the first time a setting changes.
19. **The `cash` PaymentMethod's uniqueness and undeletability are database constraints**,
    not application checks. Downstream code branches on `kind`, never on a name.
20. **Cookie-authenticated procedures enforce an exact `Origin` match on
    `https://admin.<domain>`.** `SameSite=Lax` is not sufficient: `pos.`, `admin.`, and
    `api.` are same-site under one registrable domain, so `Lax` sends the back-office
    cookie on requests from the terminal origin. A missing `Origin` is refused.
21. **Role and Store membership are append-only and effective-dated.** An `UPDATE` to a
    `UserRole` or `UserStore` row is a review finding — it destroys the history that
    offline Override re-verification reads.

## Out of Scope

- MenuItems, Variants, Modifiers, Add-ons, the Discount list, and all catalog CRUD. Area 3.
  This area owns the Tenant settings in the table above; it does not own the Discount list.
- Applying a PaymentMethod, a Discount, or VAT to a sale. Area 4 — this area configures,
  `checkout` applies.
- Any payment processing, gateway integration, QR generation, or settlement. Every non-cash
  PaymentMethod records an amount and authorises nothing. Declared non-goal.
- Orders, payments, voids, refunds — this area builds the Override mechanism, not the
  actions that consume it. Area 4.
- The Outbox, the replay endpoint, the service worker, and the actual on-device sync
  transport. Area 5 — this area defines what replay must check, not how replay works.
- DrawerSessions, Floats, cash Variance. Area 6.
- Self-serve tenant signup, billing, plan limits. Not in v1.
- Email transport of any kind, and therefore email-based password reset, verification
  emails, and invitation emails. Admin-set temporary passwords instead.
- Multi-factor authentication for the back-office. Reasonable to want; not v1.
- SSO, SCIM, directory sync.
- Rate limiting at the edge, the written threat model, and the tenant export/purge path.
  Area 9 — this area supplies the per-endpoint controls it will build on.
- Audit log browsing UI beyond a manager reviewing Overrides at their own Stores.

## Further Notes

- **This is the highest-stakes area in the plan.** ADR-0002 is irreversible once real
  sales exist. If something here feels ambiguous during implementation, it is worth
  stopping for a decision rather than picking a reading.
- **The wrong-tenant probe helper outlives this PRD.** Eight later areas will call it. It
  deserves the same care as the seam helper in `foundation`.
- **The connection choke point from `foundation` is load-bearing here.** If more than one
  code path opens a database connection, tenant scoping cannot be guaranteed and this
  area cannot be completed correctly — raise it as a blocker rather than adding a second
  place to set the session variable.
- **Offline auth is where this area is most likely to be got subtly wrong.** The rule to
  hold on to: the Device is what proves *which tenant and store*; the PIN is what proves
  *which person*. Neither alone is sufficient, and the server must re-check both on
  replay because everything the terminal asserts while offline is a claim, not a fact.
- A 4–6 digit PIN has at most a million combinations and often far fewer in practice.
  Throttling is not a nicety here; it is the only thing standing between a shoulder-surfed
  Device and a manager's authority.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and
ADR-0001, ADR-0002, ADR-0005, ADR-0006, ADR-0007. Reuses the seam established in
`foundation`; adds actors to it rather than a new seam._
