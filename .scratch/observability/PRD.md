# Observability

- **Status:** ready-for-agent
- **Area:** 8 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `checkout`, `offline-sync`, `drawer-sessions`
- **Blocks:** `release-ops`

## Problem Statement

DeanPOS can take money offline, queue it, replay it, and reconcile a drawer — and when any
of that goes wrong in production, the only evidence is a phone call from a restaurant
owner describing what a cashier told them.

Three specific blindnesses:

**A failed sale is invisible.** If submission starts failing for one tenant, nobody knows
until a drawer does not reconcile at the end of the day. By then the terminal holds a queue
nobody has looked at and the cashier has gone home.

**A stalled Outbox is invisible, and it is the worst failure DeanPOS has.** `offline-sync`
deliberately never discards an entry — it retries forever and makes the state visible *on
the terminal*. But nobody at DeanPOS can see a terminal. A tablet that has been failing to
replay for three days looks, from the server, exactly like a tablet that is switched off.

**An error cannot be traced to a tenant, a store, a device, or a sale.** A stack trace with
no context is an anecdote. The support question is always "which restaurant, which
terminal, which order" and nothing currently answers it.

The health endpoint from `foundation` proves a container booted. That is not observability;
it is a pulse.

## Solution

Three layers, each doing one job, wired with the same identifiers so they join up.

**Structured logs.** Every API request emits request-scoped JSON via pino, carrying a
request id, and — whenever they are known — tenant, store, device, user, drawer-session,
and order identifiers. Never values: no payloads, no amounts, no credentials.

**Error tracking.** Sentry in `apps/api`, `apps/pos`, and `apps/backoffice`, tagged with
release, tenant, store, and device, and correlated to logs by the same request id. The POS
buffers events while offline and sends them on reconnect, because the errors most worth
seeing happen precisely when there is no network.

**Alerts on the one path that must never break.** Four, and only four, in v1:

1. Order submission failing at a rate above baseline.
2. A Device whose Outbox is stalled — oldest queued entry older than a threshold.
3. A DrawerSession left open far longer than a plausible shift.
4. The API unhealthy. **Not "unreachable"** — nothing on a dead VPS can report the VPS dead, and external uptime monitoring is deferred in Out of Scope. Sentry's rules fire on events arriving, not on silence.

Each names the tenant, store, and device, so the first question is already answered when
the alert arrives.

## User Stories

**Diagnosis**

1. As an operator, I want every API request logged with a request id, so that one request's story can be reassembled from many lines.
2. As an operator, I want logs to carry tenant, store, device, and user ids, so that I can narrow an incident to a restaurant and a terminal.
3. As an operator, I want a sale-related log line to carry the Order UUID, so that I can follow one sale from submission through replay.
4. As an operator, I want the request id returned to the client on an error, so that a support conversation starts with a reference rather than a description.
5. As an operator, I want the same request id in Sentry and in the logs, so that an exception and its request are one click apart.
6. As an operator, I want logs as JSON, so that filtering by tenant is a query and not a grep and a hope.
7. As an operator, I want log levels I can raise in production without a deploy, so that diagnosing a live incident does not require shipping code.
8. As an operator, I want logs rotated and size-bounded on the VPS, so that a chatty week does not fill the disk and take the API down with it.

**Error tracking**

9. As an operator, I want unhandled exceptions in the API captured with a stack trace and context, so that I learn about them before a tenant calls.
10. As an operator, I want front-end errors from the terminal captured, so that a crash on a tablet is not invisible.
11. As an operator, I want front-end errors from the back-office captured, so that a broken report screen is not discovered by the owner.
12. As an operator, I want errors that happened offline to arrive when the terminal reconnects, so that the outage window is not a blind spot.
13. As an operator, I want every event tagged with the release, so that I can tell whether a deploy caused it.
14. As an operator, I want events tagged with tenant, store, and device, so that I can see whether a problem is one terminal or everyone.
15. As an operator, I want errors grouped sensibly, so that one bug is one issue and not four hundred.
16. As a tenant, I want no personal data, amounts, or credentials in an error report, so that debugging does not become a data leak.

**Alerting**

17. As an operator, I want an alert when Order submissions start failing, so that I find out during service rather than at close.
18. As an operator, I want an alert when a terminal's Outbox has been stalled beyond a threshold, so that money queued on a tablet is not forgotten.
19. As an operator, I want that alert to name the tenant, store, and device, so that I can act without investigating first.
20. As an operator, I want an alert when a DrawerSession has been open implausibly long, so that an unclosed drawer is caught the next morning at the latest.
21. As an operator, I want an alert when the API reports itself unhealthy, so that a degraded box is not reported to me by a customer. A box that is fully down is caught by external uptime monitoring, which is deliberately deferred — that gap is stated, not papered over.
22. As an operator, I want alerts delivered where I already look, so that they are seen rather than archived.
23. As an operator, I want an alert to stop repeating once resolved, so that I do not learn to ignore the channel.
24. As an operator, I want alert thresholds to be configuration rather than code, so that tuning them does not need a release.

**Health and visibility**

25. As an operator, I want a readiness check that reflects whether the API can actually serve, so that a deploy is verified rather than assumed.
26. As an operator, I want to see, per Device, when it last synced and how deep its queue is, so that I can answer "is that terminal okay" without calling the store.
27. As a tenant admin, I want to see when each of my terminals last synced, so that I can chase a store myself.
28. As an operator, I want to know which release each Device is running, so that I can tell whether an update reached it.

**Discipline**

29. As a reviewer, I want a single logging helper used everywhere, so that context cannot be omitted by accident in a new handler.
30. As a tenant, I want nothing sensitive in any log line, so that access to logs is not access to my business.
31. As an operator, I want a stated per-day log size budget that the runbook records, so that "proportionate" is a number somebody can check rather than a hope. Rotation itself is `release-ops`.

## Implementation Decisions

**Logging.** pino in `apps/api`, JSON to stdout, collected by the Docker logging driver on
the VPS with rotation and a size cap. One request-scoped logger is created per request in a
single middleware and passed down; **handlers never construct their own logger**, because
that is how context goes missing.

Standard fields on every line: timestamp, level, request id, route, status, duration. Plus,
when known: `tenantId`, `storeId`, `deviceId`, `userId`, `drawerSessionId`, `orderUuid`.
These are the join keys across all three layers and their names are fixed.

The request id is generated at the edge, accepted from a client-supplied header only when it
matches an expected format, returned in the response, and shown to the user on an error
screen so support can quote it.

Log level is read from the environment and can be raised without a code change.

**What is never logged**, restated because every earlier area declares its own version and
this is where it is enforced. **This list is the union of every sibling PRD's, and it is
this PRD's job to stay complete** — an item forbidden in one area and absent here reaches
pino and Sentry unopposed:

| Category | Source |
| --- | --- |
| Passwords, PINs, PIN hashes, Device tokens, back-office **auth** session ids, enrolment codes | `tenancy-identity` |
| Full Order payloads, tendered amounts | `checkout` |
| **Discount references — Senior Citizen and PWD ID numbers, which identify a real person** | `checkout` SC17, `reporting` SC12 |
| **Floats**, cash counts, and session totals in full payloads | `drawer-sessions` |
| Report payloads and export contents | `reporting` |
| Outbox payloads, full request bodies | `offline-sync` |
| Waitlist submissions | `landing` |

Log identifiers and outcomes, not values.

**"Session id" is two different things and only one is forbidden.** The back-office *auth*
session id is a credential and is never logged. The `drawerSessionId` is an identifier and
is a standard log field — `drawer-sessions` explicitly asks for it to be logged. The
never-log list means the former.

**Audit trails are not logs.** Overrides, cash movements, exports, and revocations are rows
in the database, written by their owning areas. They are queried, retained, and
authorisation-controlled. Logs are operational and disposable. Neither substitutes for the
other, and no area should be tempted to satisfy an audit requirement with a log line.

**Sentry** in all three applications. Releases are tagged from the build so an event can be
attributed to a deploy. Events carry tenant, store, and device tags, and the request id.
`beforeSend` scrubs aggressively by allowlist rather than by denylist — a denylist is one
new field away from leaking.

The POS uses Sentry's offline-capable transport so events raised during an outage are
delivered on reconnect. They are the highest-value events DeanPOS produces.

**Device telemetry — and this area builds both ends of it.** The terminal reports, with each
replay attempt and on a low-frequency heartbeat while online and idle: its Outbox depth, the
age of the oldest queued entry, the timestamp of its last successful sync, and its release
version. It contains no sale content.

**This area builds the POS-side reporter and the API ingestion endpoint.** An earlier draft
called telemetry "the only new data this area asks other areas for" — but `offline-sync`
exposes sync state on the *terminal only*, and its spec contains no heartbeat and no
server-facing telemetry. Neither PRD owned building it, so it would not have been built.
`offline-sync` exposes the local state; **`observability` reports it, receives it, and stores
it**, and that is what makes alerts 2 and 3 and stories 26–28 possible.

**Alerting.** Four rules, delivered to Slack via an incoming webhook, using the channel
already configured for this project. Two come from Sentry's own alert rules (submission
failure rate, API unhealthy); two are server-side scheduled checks over the telemetry and
DrawerSession tables (stalled Outbox, session open too long).

Thresholds live in configuration, not in code. Each alert carries tenant, store, device, and
a link. Alerts de-duplicate and resolve — a stalled device produces one alert and one
resolution, not one every five minutes, because an alert channel people mute is worse than
no alert channel.

**No metrics stack in v1.** No Prometheus, no Grafana, no OpenTelemetry collector. The four
questions that matter are answered by Sentry and two scheduled queries, and a metrics
pipeline is a service to run, secure, and back up for a single-VPS deployment with a
handful of tenants. **Deferred, trigger:** more than a handful of tenants, or a performance
question that logs and Sentry cannot answer.

**Readiness versus liveness.** `foundation` shipped a health endpoint reporting process
liveness and database reachability separately. This area adds readiness — the API answers
"can I serve" including that migrations are at the expected version — and it is what the
deploy in `release-ops` gates on.

## Testing Decisions

**What makes a good test here.** Assert the observable output — the log line's fields, the
scrubbed event, the alert's payload — never that a logger method was called. `expect(
logger.info).toHaveBeenCalled()` is the canonical bad test in this area; capturing pino's
stream and asserting the JSON is the good one.

**Seam.** The in-process seam from `foundation`, with pino's output captured to a stream in
the test. No new seam. The browser seam from `offline-sync` is reused for one case only:
that an error raised while offline is delivered after reconnect.

**Through the seam.**

- A request produces exactly one request-scoped log line with the fixed field names, and the
  request id in the response header matches it.
- An authenticated request carries tenant, store, and — for terminal requests — device ids.
- An Order submission logs the Order UUID and its outcome, and does not log the payload,
  the total, or the tendered amount.
- A client-supplied request id in the wrong format is replaced, not trusted.
- A failing request returns a request id to the client and logs at error level with the same
  id.
- Log level is honoured from configuration.
- **A telemetry heartbeat authenticated by a Device token creates the row a rule reads**,
  carries no sale content, and is wrong-tenant probed. An earlier draft tested the alert
  rules over telemetry rows that nothing was proven to produce.
- **A telemetry post from a revoked Device is refused.**
- **Readiness reports not-ready when a migration is pending**, and ready when it is not —
  story 25 asserted "including that migrations are at the expected version" with no test.
- **The per-Device last-synced and Outbox-depth view returns what the heartbeat wrote**, and
  is scoped to the caller's Tenant.
- **A Device whose reported release is more than one deploy behind the current one is
  flagged** in that view. The threshold comes from `release-ops` story 26; the check is
  this area's, because this area holds the telemetry.

**Scrubbing is tested adversarially.** A deliberately constructed error carrying a PIN, a
Device token, an auth session id, a full Order payload, a **discount reference**, a
**Float**, and a **tendered amount** in its context is passed through the
Sentry `beforeSend`, and the output is asserted to contain none of them. This test is the
point of the allowlist and must fail loudly if the allowlist is widened carelessly.

**Alert rules are pure functions and are tested directly.** Given a set of device telemetry
rows and a threshold, the stalled-Outbox rule fires or does not; given a set of
DrawerSessions and a clock, the open-too-long rule fires or does not. De-duplication and
resolution are tested as state transitions over repeated evaluations — fire once, stay
quiet, resolve once. No network, no Slack, no Sentry in these tests.

**Delivery is tested at the boundary only.** The webhook client is exercised against a local
stub to prove payload shape and failure handling; nothing in the suite posts to a real
Slack channel.

**Through the browser seam.** An error raised while offline is captured and delivered after
reconnect.

**Deliberately not tested here.** Sentry's own grouping and alert-rule engine — that is a
vendor's behaviour, and testing it tests the vendor. Log rotation on the VPS — verified by
the operational check in `release-ops`. Alert *usefulness*, which is a judgement made by
watching real incidents, not an assertion.

## Security Criteria

1. **The never-log list is enforced by an allowlist, not a denylist**, in both the logger's
   serialisers and Sentry's `beforeSend`. A new field is excluded by default.
2. **The adversarial scrubbing test is mandatory** and its fixture must carry **one instance
    of every row in the never-log table above** — including a discount reference, a Float,
    and a tendered amount, which an earlier draft omitted. A SC/PWD ID reaching Sentry is
    personal data at a third party. It must cover PIN, Device token, session
   id, enrolment code, and a full Order payload.
3. **Log lines carry identifiers, never values.** `orderUuid`, not the order; `deviceId`,
   not the token; `userId`, not the email.
4. **A client-supplied request id is untrusted input** — format-validated or replaced, never
   echoed into a log unvalidated.
5. **Error responses to clients stay opaque** (the default set in `foundation`). The request
   id is the only diagnostic detail that crosses the boundary.
6. **Sentry tags carry ids, not names.** A tenant's business name in an error tag is a leak
   into a third-party service that no support workflow needs.
7. **The Sentry DSN and the Slack webhook are secrets**, environment-supplied, absent from
   the repository, and never present in a client bundle beyond what the browser SDK
   requires — which is itself understood to be public and therefore rate-limit-relevant.
8. **Alerts carry ids and links, not figures.** A takings number in a Slack channel is a
   tenant's revenue in a chat log.
9. **Device telemetry carries no sale content** — depth, ages, versions, timestamps only.
10. **Telemetry endpoints are authenticated by Device token** and wrong-tenant probed like
    every other procedure.
11. **Log access on the VPS is root-only**, consistent with the `.env` root-only posture in
    `.scratch/APP-PLAN.md`'s Ops row. ADR-0006 covers migrations and rollback and says
    nothing about secrets; the earlier citation was wrong.

## Out of Scope

- Metrics collection and dashboards — Prometheus, Grafana, OpenTelemetry. **Deferred,
  trigger:** more than a handful of tenants, or a performance question Sentry and logs
  cannot answer.
- Distributed tracing. One API, one database; there is nothing distributed to trace.
- Log aggregation and search infrastructure (Loki, ELK, a hosted log service). Docker's
  rotated JSON on one box, read with `jq`, is proportionate to one VPS.
- Uptime monitoring from outside the VPS. **Deferred, trigger:** the first outage nobody
  noticed because the box that monitors the box was also down.
- Real user monitoring, performance traces, session replay, and analytics of any kind.
- Alerting on business figures — takings below expectation, unusual discounting. That is a
  reporting question and the channel for it is a report, not a page at 3am.
- Audit log browsing UI. The audit rows belong to their owning areas.
- On-call rotation, escalation policies, incident management tooling. One operator.
- Status page.

## Further Notes

- **The stalled-Outbox alert is the reason this area exists.** `offline-sync` guarantees a
  queued sale is never destroyed; it cannot guarantee anybody notices. From the server, a
  broken terminal and a switched-off terminal look identical, and only the telemetry
  heartbeat tells them apart.
- **An alert channel that cries wolf is worse than no channel.** Four rules, tuned
  thresholds, de-duplication, and explicit resolution. Adding a fifth should feel like a
  decision.
- **The scrubbing allowlist is the security boundary of this area.** Sentry is a third party
  and everything sent to it has left the building. Widening the allowlist is a review event.
- **Do not let a log line become an audit record.** They have different retention, different
  access control, and different guarantees. When an area needs to prove who did what, it
  writes a row.
- **Field names are a contract.** `tenantId`, `storeId`, `deviceId`, `userId`,
  `drawerSessionId`, `orderUuid`, `requestId` — fixed here, used everywhere, never
  abbreviated differently in a new handler. Everything downstream joins on them.
- The health endpoint from `foundation` was never observability, and calling it that is how
  a project ends up with a green tick and a silent failure.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0003,
ADR-0006. Reuses the in-process seam; borrows the browser seam from `offline-sync` for a
single offline-error-delivery case. Requests one new signal from the terminal — device
telemetry — which contains no sale content._
