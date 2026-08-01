# DeanPOS — app-wide plan

Output of the `/plan-app` grilling session, 2026-07-31. Each area below becomes **one
PRD** via `/to-spec`, then tickets via `/to-tickets`. The order is recorded as
`ORC2_BUILD_ORDER` in `.orc2/config.env`.

## What DeanPOS is

A **multi-tenant SaaS point-of-sale for counter-service food businesses** —
order-then-pay, no tables, no open tabs. One deployment serves many unrelated
restaurants. v1 is an MVP; public self-serve signup is the eventual goal, not the
first release.

**The one path that must never break:** a cashier takes an order and completes a cash
payment — including when the network is down.

## Non-goals (v1)

Carried into every PRD. A ticket that reaches for one of these is out of scope.

- Accounting sync, government e-invoicing, fiscal printer compliance.
- Loyalty, coupons, or any **rule-based** promotions engine — no conditions, schedules, codes, BOGO, segments, or stacking rules. Discounts are a tenant-configured, typed list applied by a person (ADR-0010), plus the manual manager-approved line override.
- Payment processing of any kind. Non-cash PaymentMethods — Card, GCash, Maya, Bank transfer — **record an amount and authorise nothing**. No gateway, no QR, no settlement.
- Statutory reporting. DeanPOS produces business reports, not BIR ones. The VAT toggle and the VAT-exempt Discount exist so an owner's own figures are correct, not so the product claims compliance.
- Purchasing, suppliers, goods-received. Stock is not tracked in v1.
- Dine-in tables, open tabs, kitchen tickets, split bills.
- Multi-currency.
- Customer records / customer-facing displays / self-checkout. **Deferred, trigger:** the first tenant who asks for receipts tied to a named customer.
- Hardware peripherals (receipt printer, scanner, cash drawer, card terminal). **Deferred, trigger:** first paying tenant who cannot operate without a printed receipt.
- Phone layout for the back-office is in scope; **no offline support** for the back-office at all.
- Time and attendance — clock-in, clock-out, hours worked. **Deferred, trigger:** the first tenant who asks DeanPOS to tell them who actually turned up. Area 12 rosters *intent*; it does not observe *reality*.
- Payroll of any kind — wage rates, computed pay, overtime, night differential, holiday pay, statutory deductions, commission, tips. Payroll is a regulated domain and a separate product.
- Leave and absence management.
- Employee profile data beyond what access control needs: contact details, contracts, ID documents, emergency contacts.
- Performance measurement per staff member beyond the sales already attributed to them.

## Fixed decisions

| | |
| --- | --- |
| Stack | TS monorepo managed by **Vite+ (`vp`)**, Bun as runtime and package-manager backend, root `catalog` pinning versions, oxlint + oxfmt via `vp check` — shape copied from the sibling project **Fashio**. `apps/landing` Next.js · `apps/pos` React+Vite+ PWA · `apps/backoffice` React+Vite+ · `apps/api` thin Hono shell · `packages/backend` server logic + db · `packages/contract` oRPC · `packages/schemas` zod · `packages/error` · `packages/ui` tokens + primitives · `packages/tsconfig` |
| Architecture | **CQRS-lite** (ADR-0008, amending ADR-0001): handler → db-operation → Kysely, commands and queries split at the db-operation layer. No ports, no adapters, no domain entities. Handlers are transport-pure; `apps/api/src/routes/*` is the only transport-aware code. Frontend: thin routes, fat features (ADR-0009). Layout adapted from the sibling project **ApxDenta** |
| Origins | `deanpos.app` · `pos.deanpos.app` · `admin.deanpos.app` · `api.deanpos.app`. Separate origins are what makes the POS's Device token and PIN hashes browser-isolated from the back-office (ADR-0001, ADR-0007) |
| Tests | Vitest primary, everywhere |
| Data | Postgres · Prisma schema+migrations · `prisma-kysely` types · Kysely at runtime |
| Tenancy | Shared DB, `tenant_id` on every row, Postgres RLS |
| Money | PHP, integer centavos; exact `Millicentavos` intermediates. Round half-up **once per stored figure** — exactly three: the OrderLine total, the Order-scoped Discount amount, and the Refund amount. A price is always what the customer pays; VAT is never added |
| Optional by tenant | **VAT** (off by default, rate configurable) · **Discounts** (empty list by default, typed and person-applied) · **PaymentMethods** (`cash` only by default; others are recorded tenders, never authorised). ADR-0010. The out-of-the-box product is cash, no VAT, no discounts |
| Offline | IndexedDB Outbox, client UUID, idempotent replay, server honours recorded price |
| Auth | Device enrolment token + per-User PIN unlock (offline-capable); back-office email+password |
| Deploy | main → **locally-run gate** (no hosted CI) → image → single VPS + Docker Compose. Forward-only expand/contract migrations; rollback = redeploy prior image |
| Observability | pino structured logs (tenant + store + device + order id) · Sentry · healthcheck |
| Ops | `.env` root-only on the VPS · nightly `pg_dump` off-box · **rehearsed** restore script |
| Design | lo-fi mocks in `design/lofi` (44 SVGs, committed; regenerate with `python3 tools/lofi/generate.py`) · WCAG 2.2 AA |
| Viewports | Back-office: fully responsive, phone → desktop. POS terminal: **tablet landscape and phone** — two designs, not one breakpoint |

ADRs: `docs/adr/0001`–`0012`. Glossary: `CONTEXT.md`. Lo-fi mocks: `design/lofi/README.md`.

### The Loyverse review, 2026-07-31

The plan was checked against the Loyverse POS manual — the product the target tenants
already use, focusing on sales and reporting. Five changes, three explicit refusals.

| Found | Outcome |
| --- | --- |
| No transaction-level surface anywhere | **Orders list added** to `reporting`, and made the drill target for every aggregate. An unauditable total is not a report |
| No mid-session till read | **Running summary added** to `drawer-sessions`, gated by the same right as the expected-cash reveal |
| Payment methods hard-coded `cash \| card_manual` | **Tenant-configurable** (ADR-0010). GCash is not a card |
| VAT fixed at 12% for everyone | **Tenant setting, off by default** (ADR-0010). Most target tenants are below the registration threshold |
| No way to express a Senior Citizen / PWD discount | **Typed Discount list** (ADR-0010), off by default, with VAT exemption and a required reference |
| Back-office receipt cancellation | **Rejected.** ADR-0005 holds — Void and Refund at the terminal, with a reason and an approver |
| Per-table column customisation, saved views | **Rejected.** Fixed columns plus CSV |
| Separate mobile dashboard app | **Rejected.** The back-office is responsive; its landing page is the Summary report |

### The second Loyverse pass, 2026-08-01 — stakeholder changes

Five requests, taken against the same manual. Two produced ADRs because they reverse
earlier decisions.

| Asked for | Outcome |
| --- | --- |
| Tickets, together with tables — customers stand at the counter deciding | **Built, as the cheap version** (ADR-0011). A Ticket is a labelled draft owned by one Device: no server state, no sharing, no merge. This is the trigger `checkout` wrote down for its own parked-order deferral, reported before v1 shipped |
| Tables for the POS, referencing Loyverse | **A Tables grid over the same Tickets** (ADR-0011). Loyverse §2.14 makes tables a per-Store list of *predefined ticket names* with occupied ones hidden from the picker — not a floor plan. DeanPOS copies that: a label with no stored state, occupancy derived from open Tickets, `Move ticket` in, split and merge out |
| Payment method at the top right, level with amount due; GCash and Maya branded | **Both** (`checkout`, story 22d/22e). Method is asked before the keypad, and the keypad, quick tender, and change become cash-only controls. Marks come from each provider's official brand kit, and the authorises-nothing copy stays put — a familiar logo is exactly what would imply an integration |
| Dine in / take out / delivery / pick up as a tag, deeper in v2 | **A fixed four-value tag, interpreted nowhere** (ADR-0011). Loyverse §2.19 makes dining options a configurable per-Store list; that is the v2 shape. Nothing branches on it, so changing its meaning later is a backfill |
| A refunds report, and customer receipts — record + print, or store in S3? | **Refunds report added** (ninth report). **Receipts are rendered from the Order on demand, never stored** (ADR-0012) — the Order already captures every input verbatim, so a bucket buys a second source of truth, a personal-data store to retain and delete, and a cloud dependency, for a document that is already derivable |

## The areas, in build order

| # | Slug | Covers | Lives in | Depends on |
| - | ---- | ------ | -------- | ---------- |
| 1 | `foundation` | Monorepo under `vp` (Bun beneath it), catalog-pinned Vite+, Vitest, `vp check` gate, Docker Compose w/ Postgres, Hono skeleton + healthcheck, **two** React shells (`apps/pos` PWA + `apps/backoffice`), `packages/ui` tokens/preset/primitives, `packages/contract` oRPC wiring, Prisma+`prisma-kysely`+Kysely wiring, three-origin routing + wildcard TLS + CORS allowlist, one deployable end-to-end slice, the money/rounding helper with property tests | all | — |
| 2 | `tenancy-identity` | Tenant, Store, User, Role. RLS policies + the connection-level tenant variable. Back-office email+password sessions. Device enrolment and revocation. PIN set/change, PIN unlock, offline PIN hash sync. The authorisation model and Override mechanism. **Tenant settings: timezone, business-day start, VAT, PaymentMethods, Variance tolerance, per-Store table labels** | `api` + both apps | 1 |
| 3 | `catalog` | MenuItem → Variant → Modifier, Add-ons, typed Deltas, **the Discount list**, back-office CRUD, catalog read model for the terminal | `api` + `backoffice` | 1, 2, 7 |
| 4 | `checkout` | The sale screen. Cart, OrderLine build from Variant+Modifiers+Add-ons, price capture, **Payment against a configured PaymentMethod** (chooser at the top, GCash/Maya branded), **Discount application**, order state machine, Void, Refund, manual line override, receipt view. **Tickets: labelled drafts, the Tables view, and the fulfilment tag** (ADR-0011). **Two layouts: tablet landscape and phone** | `api` + `pos` | 1, 2, 3 |
| 5 | `offline-sync` | Service worker + app shell precache, local catalog cache, IndexedDB Outbox, client-UUID stamping, idempotent replay endpoint, reconnect/backoff, duplicate handling, **revoked-device enforcement on replay and writing the quarantine row**, offline-visible sync status | `api` + `pos` | 1, 2, 3, 4 |
| 6 | `drawer-sessions` | DrawerSession open with Float, Orders bound to DrawerSession, close with Cash count, Variance calculation, Override on out-of-threshold variance, offline drawer-session close, **running summary + session history on the terminal** | `api` + `pos` | 1, 2, 4, 5 |
| 7 | `reporting` | **Nine reports under one `Reports` section** — Summary (the back-office landing page), **Orders list + drill-in**, by item, by category, by cashier, by payment method, discounts & overrides, **refunds**, drawer sessions. **The customer receipt as the Orders drill leaf, rendered on demand and never stored** (ADR-0012). Conditional VAT, CSV export in two shapes. Device timestamps are the business truth | `api` + `backoffice` | 1, 2, 3, 4, 5, 6 |
| 8 | `observability` | pino request-scoped structured logs with tenant/store/device/order ids, Sentry with release + tenant tagging, healthcheck, an alert on failed payment and on stalled Outbox replay | `api` + both apps | 1, 4, 5, 6 |
| 9 | `hardening` | Written threat model. Wrong-tenant authorisation tests against every reachable object. **Quarantine adjudication** — revocation is enforced on replay by area 5, which owns the endpoint; area 9 owns the screen that decides what happens to what it caught. PIN throttling. Rate limits. CORS allowlist + origin-isolation tests. Secret handling + rotation. Dependency/advisory policy. Tenant export + purge path | all | 2, 3, 4, 5, 6, 7, 8, 11 |
| 10 | `release-ops` | Environments, gated deploy script to VPS (no hosted CI), expand/contract migration safety check, rollback drill, **PWA cache-bust on deploy**, nightly backup, **rehearsed** restore, runbook | all | 1, 5, 8, 9 |
| 11 | `landing` | `apps/landing` marketing site, pricing, waitlist/signup entry | `landing` | 1, 8, 9 |
| 12 | `workforce` | **Rostering only.** Shift = one User, one Store, start and end. Create/edit/copy Shifts, assign staff, publish a Roster, staff view their own schedule, conflict and double-booking detection | `api` + `backoffice` | 1, 2 |

### Merges considered and rejected

- `observability` into `foundation` — a healthcheck is not observability, and folding it in means it never gets the alert on the never-break path.
- `offline-sync` into `checkout` — it is the largest single risk in the plan (ADR-0003) and needs its own acceptance criteria and its own QA pass.
- `drawer-sessions` into `checkout` — cash reconciliation is a separate vertical with a separate actor concern (manager Override on Variance).
- **POS and back-office as one app — rejected 2026-07-31**, see ADR-0001. Offline scope, credentials at rest, and two different shells. Bundle size was not part of the argument.
- **`workforce` folded into `drawer-sessions` — rejected 2026-07-31.** A DrawerSession already has an open time, a close time, and a User, so hours-worked looks nearly free there. It is not: it would make one record mean both *cash accountability* and *labour*, which is exactly the synonym collision the glossary exists to prevent. Rostering is a separate area with a separate word.

### The `Shift` rename, 2026-07-31

`Shift` originally meant the cash-drawer session. Once rostering entered scope, that word
collided head-on with how every restaurant manager uses it. Resolved in favour of the
users' language, before any code existed:

| Was | Is now | Means |
| --- | --- | --- |
| `Shift` | **`DrawerSession`** | A cashier's cash-drawer session on one Device — open, count, close |
| — | **`Shift`** | A scheduled block of work: one User, one Store, start and end |

The area slug `shifts-cash` became `drawer-sessions`. Nothing links a DrawerSession to a
Shift in v1; they are separate lifecycles that happen to overlap in practice.

## Security is cross-cutting *and* area 9

Every PRD above carries its own security acceptance criteria, answering, for that area:
which boundary does it cross · what must be **authorised** rather than merely
authenticated · what input is untrusted · what does it log that it must not.

Area 9 exists for what no feature ticket will ever own: the threat model, the
wrong-tenant probe suite, device revocation, rate limits, secrets rotation, retention
and purge.

## Open, deliberately

- ~~**Vite+ licence in CI**~~ — **closed 2026-08-01.** `vp` v0.2.5 is installed locally and pinned in the root catalog exactly as `../Fashio` pins it; there is no hosted CI to hold a token (ADR-0006). What `foundation` still proves is that a clean checkout plus `vp install` reaches a green gate unattended.
- ~~**Device clock skew**~~ — **closed by `reporting`, 2026-07-31.** Device time is the business truth for when a sale occurred; server receipt time is retained only for sync lag and skew detection. Recorded in `CONTEXT.md`.
- **Self-serve signup** — the eventual goal, not v1. Tenant provisioning is admin-run until a tenant asks otherwise.
- **Domain name** — `deanpos.app` is a placeholder throughout. The three-subdomain shape is the decision; the registrable domain is not. Settle it in `foundation` before the TLS cert is issued.
- **`packages/ui` boundary** — primitives and tokens only. The first component that knows what a cart or a report is has crossed the line, and that is a review finding.
- ~~**Monorepo task runner**~~ — **closed in `foundation`, 2026-07-31; revised 2026-08-01.** **Vite+ (`vp`) manages the monorepo** — installs, catalog, `vp run -r`, `vp check` — with **Bun as the runtime and package-manager backend**. No Turborepo; `vp` already caches tasks. *Deferred, trigger:* the gate slow enough that somebody skips it.
- ~~**Linter/formatter**~~ — ~~**closed in `foundation`, 2026-07-31.** Biome.~~ **Revised 2026-08-01: oxlint + oxfmt via `vp check`.** They ship with the manager and are configured in one `vite.config.ts` block; Biome would be a second binary doing what `vp` already does. Shape copied from `../Fashio`. Not reopened.
