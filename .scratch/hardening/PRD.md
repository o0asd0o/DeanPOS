# Security hardening

- **Status:** ready-for-agent
- **Area:** 9 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `tenancy-identity`, `catalog`, `checkout`, `offline-sync`, `drawer-sessions`, `reporting`, `observability`, `landing`
- **Blocks:** `release-ops`

> Security is **cross-cutting and has its own area**. Every PRD before this one carries its
> own security acceptance criteria. This area exists for what no feature ticket will ever
> own.

## Problem Statement

Every area so far has done its own security work, and that work has a shape of hole in it
that no amount of per-area diligence closes.

**Nobody owns the sweep.** Area 2 wrong-tenant-probes its procedures. Area 3 probes its
own. Area 4 probes its own. Nothing checks that *every* procedure has a probe — and the one
that ships without one will not announce itself. A hundred careful areas and one careless
handler produce the same outcome as no care at all.

**Nobody owns the written threat model.** Each area answered "which boundary does this
cross" for itself. No document says what the boundaries are, who the adversaries are, and
what has been decided to accept. Without it, the next area's author re-derives the threat
model from memory, and a reviewer has nothing to review against.

**Nobody owns the controls that belong to no feature.** Rate limits, security headers,
dependency advisories, secret rotation, and the adjudication of quarantined Orders are not
part of any user story, so under normal prioritisation they are never built.

**Nobody owns leaving.** A tenant that stops using DeanPOS has data on a shared database.
There is no export and no deletion path, and "we'll write one if someone asks" is the
answer that becomes an emergency.

And one thing is genuinely unresolved: a **stolen enrolled tablet** is the primary threat in
ADR-0007. Revocation is specified in area 2 and enforced on replay by area 5 — but the queued Orders
it quarantines have no human anywhere in DeanPOS who can look at them and decide.

## Solution

Six deliverables, none of which is a feature and all of which are load-bearing.

1. **A written threat model** in the repository: boundaries, actors, assets, the attacks
   considered, the controls, and the risks explicitly accepted. Reviewed as code, not filed
   as a document.
2. **An exhaustive authorisation sweep**, driven by the contract package rather than by
   diligence. Every procedure is enumerated from `packages/contract`, and the suite fails if
   any procedure lacks a wrong-tenant and role-authorisation probe. A new procedure without
   a probe cannot merge.
3. **Rate limits and abuse controls** on the endpoints that invite them — sign-in, PIN
   verification, enrolment, and replay.
4. **Edge hardening**: security headers, a content security policy that does not break the
   service worker, and tests that prove the three origins are actually isolated.
5. **Secrets and dependency policy**: where secrets live, how each is rotated, what happens
   when an advisory lands, and a CI check that notices.
6. **Tenant export and purge**, plus the **quarantine adjudication** screen that gives the
   stolen-tablet story an ending.

## User Stories

**Threat model**

1. As a reviewer, I want a written threat model in the repository, so that a security review has something to review against.
2. As a reviewer, I want each trust boundary named with what crosses it, so that a new area's author does not re-derive it from memory.
3. As an owner, I want accepted risks written down with the reason, so that "we decided that was fine" is a record rather than a recollection.
4. As a reviewer, I want the threat model to be updated in the same change that alters a boundary, so that it does not rot into fiction.

**The authorisation sweep**

5. As a reviewer, I want every procedure enumerated automatically, so that coverage is a fact rather than a claim.
6. As a reviewer, I want the suite to fail when a procedure has no wrong-tenant probe, so that the hole cannot ship.
7. As a reviewer, I want the suite to fail when a procedure has no role-authorisation probe, so that a cashier-reachable admin action is caught by the build.
8. As a reviewer, I want an explicit, justified exemption list rather than silent gaps, so that "this one is genuinely public" is a decision somebody wrote down.
9. As an owner, I want **every id-bearing parameter of every procedure** enumerated and probed, so that a procedure taking three ids cannot pass by having a probe on one of them. The sweep is procedure-level *and* parameter-level; claiming "closed by construction" from procedure coverage alone would be an overclaim.
10. As an owner, I want a wrong-Store request from a legitimate user to be refused, so that a manager at one outlet cannot reach another.
11. As an owner, I want a wrong-Device replay to be refused, so that a terminal cannot submit sales for a store it does not belong to.

**Abuse controls**

12. As an owner, I want sign-in attempts rate-limited, so that a password cannot be brute-forced from the internet.
13. As an owner, I want PIN verification rate-limited server-side, so that the on-device lockout is not the only obstacle.
14. As an owner, I want enrolment attempts rate-limited, so that enrolment codes cannot be guessed at speed.
15. As an owner, I want replay traffic bounded per Device, so that one malfunctioning terminal cannot exhaust the server for every tenant.
16. As an owner, I want expensive report queries bounded, so that a wide date range is not a denial of service.
17. As an operator, I want rate-limit rejections logged and alertable, so that an attack is visible rather than merely deflected.
18. As a cashier, I want a legitimate busy lunch rush to never hit a limit, so that the control does not cost me sales.

**Edge hardening**

19. As an owner, I want security headers set on every response, so that the browser enforces what it can.
20. As an owner, I want a content security policy that blocks injected scripts, so that an XSS has nowhere to go.
21. As a cashier, I want the policy not to break the service worker or offline mode, so that hardening does not cost me the offline sale.
22. As an owner, I want the terminal origin and the back-office origin to be provably isolated, so that ADR-0001's central reason holds in fact and not just in intent.
23. As an owner, I want the API to refuse requests from unexpected origins, so that the CORS allowlist is enforced rather than decorative.
24. As an owner, I want the applications to refuse to be framed, so that clickjacking a payment screen is not possible.

**Secrets and dependencies**

25. As an operator, I want every secret's location and rotation procedure written down, so that rotating one is a checklist and not an investigation.
26. As an operator, I want to rotate the database password, the Sentry DSN, the Slack webhook, and the session secret without a code change, so that rotation is routine.
27. As a **tenant admin**, I want a way to revoke every Device for a tenant at once, so that a compromised store can be shut down in one action.
28. As an operator, I want CI to flag dependencies with known advisories, so that a vulnerable package is caught at merge rather than at exploit.
29. As an operator, I want a stated response time per severity, so that "we'll get to it" has a meaning.
30. As a reviewer, I want the lockfile committed and installs reproducible, so that what CI tested is what ships.
31. As an operator, I want a secret that leaks into a log or an error to be caught by a test, so that the never-log rule is enforced and not merely intended.

**Leaving, and the stolen tablet**

32. As a tenant admin, I want to export all of my data, so that I am not locked in.
33. As a tenant admin, I want the export to be complete and machine-readable, so that it is genuinely usable elsewhere.
34. As a tenant admin, I want to request deletion of my Tenant, so that leaving means leaving.
35. As an operator, I want deletion to require an export first and an explicit confirmation, so that it cannot be a mistake.
36. As an operator, I want deletion to be irreversible and verified, so that "deleted" is true.
37. As a **tenant admin**, I want to see Orders quarantined from revoked Devices at my Tenant, so that the stolen-tablet story has an ending.
38. As a **tenant admin**, I want to accept or reject a quarantined Order with a reason, so that money genuinely collected is not lost and money that was not is not counted. **Admin, not manager** — ADR-0007 makes revocation admin-only and audited, and adjudicating its consequences is the same authority.
39. As an owner, I want every quarantine decision recorded with who made it, so that the adjudication is itself auditable.

## Implementation Decisions

**The threat model** lives in the repository as Markdown and covers, per boundary: what
crosses it, who could be hostile, what they could reach, what stops them, and what has been
accepted. The boundaries are already known from the earlier areas — public internet to API,
back-office origin, terminal origin, enrolled Device, tenant-to-tenant inside one database,
platform admin to tenant, and DeanPOS to its third parties (Sentry, Slack).

It states the accepted risks plainly, because they are real and were chosen: PIN hashes at
rest on tablets (ADR-0007), a low-entropy PIN as a second factor, offline claims re-verified
only on arrival, and recorded non-cash tender amounts — Card, GCash, Maya — that DeanPOS
cannot verify against any provider.

**The authorisation sweep is the centrepiece.** `packages/contract` is a single enumerable
source of every procedure, which is what makes this possible at all. A test enumerates it
and asserts, for each procedure, that a wrong-tenant probe and a role-authorisation probe
exist and pass. Missing coverage fails the gate.

Exemptions are an explicit list with a written reason per entry — health, and any genuinely
unauthenticated procedure. An empty reason is not an exemption.

This is deliberately a **meta-test**: it does not test the procedures, it tests that the
procedures are tested. Individual probes stay in their owning areas, where their fixtures
already live.

**Rate limiting.** Token bucket, per key, applied at the API edge:

| Endpoint class | Key |
| --- | --- |
| Sign-in | IP, and email |
| PIN verification | Device, and user |
| Enrolment | IP |
| Replay | Device |
| Reports and exports | User |

Implemented **in-process**, because there is one API process on one VPS. This is a real
ceiling and must be marked as such in the code with the upgrade path — a shared store is
required the moment the API runs more than one instance, and a limiter that silently
becomes per-instance is worse than none.

Limits are configuration. Rejections are logged with the identifiers from `observability`
and are alertable. **The lunch-rush constraint is a hard requirement**: limits are set from
plausible peak behaviour, and a legitimate cashier must never meet one. A control that costs
sales will be turned off.

**Report and export bounds.** Maximum date range and result size, enforced server-side, so a
wide query cannot be used as a denial of service.

**Security headers**, on every response: HSTS, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `frame-ancestors 'none'`, and a Content Security Policy.

The CSP must be written to permit the service worker and the PWA's caching behaviour on
`pos.`; a policy that breaks offline mode is a regression of the product's central
requirement, not a security win. It is developed against the real terminal, not written from
a template.

**Origin isolation is tested, not asserted.** ADR-0001 justified three origins on the basis
that the browser isolates storage between them. This area proves it: the CORS allowlist
rejects an unexpected origin, and a test demonstrates that back-office origin code cannot
read terminal-origin storage.

**Secrets.** A written inventory: what each secret is, where it lives, who can read it, and
the steps to rotate it. Rotation must be possible without a code change for the database
password, the session secret, the Sentry DSN, and the Slack webhook. Device tokens rotate by
revocation, and a **bulk revoke-all-Devices-for-a-Tenant** action is a deliverable here —
that is what a compromised store actually needs.

A test asserts that known secret shapes never appear in log output or in a Sentry payload,
complementing `observability`'s adversarial scrubbing test from the other direction.

**Dependency policy.** The lockfile is committed. CI runs an advisory check on every change
and fails on critical and high severity; medium and low are recorded and triaged. Stated
response times per severity, and a documented procedure for an advisory with no fix
available. This is policy plus one CI step, not a tool evaluation.

**Tenant export.** A complete, machine-readable dump of a Tenant's data — stores, users
(without credential material), catalog, orders, voids and refunds, drawer sessions, cash movements,
overrides. Admin-initiated, authorised, and recorded.

**Tenant purge.** Hard deletion of a Tenant and everything owned by it, gated on: an export
having been produced, an explicit typed confirmation, and platform-admin authorisation. It
is irreversible and verified afterwards.

**Retention and purge are in tension, and the resolution is written down here.** The plan
records that sales are permanent records and nothing is deleted automatically — statutory
book-keeping expectations in the Philippines run to several years. Purge does not contradict
that: it is offboarding, exercised on request, and the export is what carries the tenant's
retention obligation with them. DeanPOS does not delete a live tenant's history, and does
not hold a departed tenant's data indefinitely on the theory that they might need it.

**Personal data has three categories, and all three are named here** — the threat model,
the export, the purge, the retention schedule, and the never-log list each cover all of them,
because two sibling PRDs delegate their handling to this area and a delegation that lands
nowhere is worse than none:

| Asset | Where it comes from | Belongs to a Tenant? |
| --- | --- | --- |
| User records — names, emails, password and PIN hashes | `tenancy-identity` | yes |
| **Discount references — Senior Citizen and PWD ID numbers** | `checkout` SC17, `reporting` SC12 | yes, but they identify a **customer**, not a User |
| **Waitlist submissions** — name, business, contact, city | `landing` SC7 | **no** — outside tenant RLS |

**Waitlist rows need their own retention rule, because Tenant purge cannot reach them.**
Tenant export and purge are Tenant-scoped by construction; a row belonging to no Tenant is
outside both. `landing` owns the delete action; this area owns the schedule that says a
submission is deleted once converted or declined, and the test that no waitlist row outlives
it.

**Quarantine adjudication, and only adjudication.** Per the amended ADR-0007 the ownership is: `tenancy-identity` owns the `revoked` flag and the check-every-request rule · **`offline-sync` enforces it on the replay endpoint it owns and writes the quarantine row** · this area owns the screen and the decision, and builds neither the check nor the row. `offline-sync` quarantines Orders replayed
from a revoked Device. This area builds the screen where a human resolves them: review each
quarantined Order with its Device, cashier, timestamps, and contents, then accept it into the
ledger or reject it, with a reason. Every decision is recorded with its actor. Without this,
quarantine is a bucket that fills forever and the stolen-tablet path has no ending.

## Testing Decisions

**What makes a good test here.** Assert refusal. Nearly every test in this area asserts that
something did *not* happen: a request was rejected, a header was present, a secret was
absent, a limit engaged. The positive cases are already covered by the areas that own them.

**Seam.** The in-process seam from `foundation`. The browser seam from `offline-sync` is
borrowed for CSP and origin isolation, because those are browser behaviours and cannot be
proven anywhere else.

**The sweep meta-test** is the highest-value artefact in the area and should be built first,
because it will immediately find gaps in areas 2 through 7 — and finding them is the point.
It runs in the ordinary gate, not as an optional suite.

**Rate limiting.** Tested as a pure token-bucket function (deterministic, clock injected)
plus a small number of seam tests proving the middleware engages on the right key and returns
the right status. Additionally, a *lunch-rush* test: a realistic peak burst of legitimate
cashier traffic passes without a single rejection. That test is what protects the control
from being disabled later.

**Headers and CSP.** Asserted on real responses. The CSP is additionally exercised through
the browser seam against the terminal with its service worker active — a policy that passes
a string comparison and breaks offline mode has failed.

**Origin isolation.** Through the browser seam: a request from a disallowed origin is
rejected by CORS, and storage written on one origin is unreachable from the other.

**Secret leakage.** Constructed secrets of each known shape are pushed through logging and
error paths and asserted absent from the output.

**Export and purge.** Export contains every table a Tenant owns — enumerated from the schema
so a new table added later fails this test rather than being quietly omitted. Purge removes
every row for the Tenant and nothing belonging to another, verified by counting both before
and after.

**Quarantine adjudication.** Accept and reject paths, the recorded decision and actor, and
that an unadjudicated quarantined Order never appears in any report figure.

**Deliberately not tested here.** Penetration testing and dependency-scanner behaviour —
the first is an activity, not a suite; the second is a vendor's. Individual per-area
authorisation probes, which stay in their own areas; this area tests that they exist.

## Security Criteria

The whole PRD is security criteria. The ones that constrain *this* area's own
implementation:

1. **The sweep's exemption list is a review surface.** Adding an entry requires a written
   reason and is treated as a security change.
2. **Export and purge are platform-admin authorised**, wrong-tenant probed, and recorded.
   An export procedure is the single highest-value target in DeanPOS.
3. **Purge deletes only the named Tenant.** The test counts other tenants' rows before and
   after; equality is the assertion.
4. **The quarantine screen is admin-only** and shows only the caller's Tenant.
5. **Rate limiting must not become an oracle** — a limited response must not reveal whether
   an account, a Device, or an enrolment code exists.
6. **The in-process limiter's ceiling is documented in code**, with the upgrade path, so a
   second API instance does not silently halve every limit.
7. **The threat model contains no secrets and no live identifiers.**
8. **Untrusted input:** date ranges and result sizes on export, the typed purge
   confirmation, adjudication reasons.
9. **Never logged:** anything on the never-log list from `observability`, plus export
   contents and quarantined Order payloads.

## Out of Scope

- Penetration testing, red teaming, and third-party security audit. Activities, not
  deliverables — though the threat model is what one would be given.
- WAF, DDoS protection, and bot management. The VPS's reverse proxy and the rate limits are
  the v1 answer. **Deferred, trigger:** the first attack that gets through them.
- Multi-factor authentication for the back-office. **Deferred, trigger:** the first tenant
  handling enough revenue to ask, or the first credential-stuffing incident.
- Encryption at rest beyond what the VPS's disk and PostgreSQL provide by default.
  **Deferred, trigger:** a tenant contract that requires it.
- Field-level encryption of sale data. Not proportionate to the data held.
- SOC 2, ISO 27001, PCI DSS, and any certification programme. DeanPOS does not touch card
  data, by decision.
- Formal Data Privacy Act compliance documentation — privacy notices, a DPO, consent
  records. **Deferred, trigger:** self-serve signup, at which point it stops being
  deferrable.
- Automatic dependency upgrade tooling. The policy and the CI check are in scope; a bot is
  not.
- Backup encryption and restore verification. `release-ops`.
- Per-area authorisation probes. They belong to their areas.

## Further Notes

- **Build the sweep first.** It will fail immediately against areas 2 through 7, and that
  failure list is the real work of this PRD. Building it last turns a structural guarantee
  into a tidy-up.
- **The lunch-rush test protects the rate limiter from being deleted.** Controls that
  interfere with service get disabled in week two, and nobody writes that down.
- **A CSP that breaks the service worker is a product regression.** Offline selling is the
  requirement the entire architecture was bent around. Develop the policy against the real
  terminal.
- **Quarantine without adjudication is a leak of a different kind** — collected cash sitting
  in a table nobody can act on. The screen is small and it is the ending to ADR-0007's
  primary threat.
- **Purge is the one irreversible action in DeanPOS.** Export first, typed confirmation,
  platform-admin only, verified after. It should feel heavy.
- The accepted risks are genuinely accepted, not hidden: PIN hashes on tablets, a
  million-combination PIN, offline claims verified only on arrival. Writing them down is
  what makes them decisions instead of oversights.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0001,
ADR-0002, ADR-0003, ADR-0006, ADR-0007. Reuses the in-process seam and borrows the browser
seam from `offline-sync` for CSP and origin isolation. Adds no seam._
