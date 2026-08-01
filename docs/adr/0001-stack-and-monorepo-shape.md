# ADR-0001: Stack and monorepo shape

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

Empty repo. Everything downstream — how a slice is built, tested, and gated — depends
on this being fixed once rather than re-argued per ticket.

## Decision

A Bun + TypeScript monorepo:

| Path | Is | Origin |
| --- | --- | --- |
| `apps/landing` | Marketing site. **Next.js**, its own build. | `deanpos.app` |
| `apps/pos` | The cashier terminal. **React + Vite+ + Tailwind + shadcn/ui + TanStack Router + TanStack Query**, built as an offline-capable PWA. Tablet and phone, touch-first. | `pos.deanpos.app` |
| `apps/backoffice` | Catalog, users, devices, reports. Same React stack, **no service worker, no offline**. Responsive phone → desktop. | `admin.deanpos.app` |
| `apps/api` | **Hono** shell. Entry, env, middleware, and the oRPC binding of contract to handler. **Holds no product logic.** | `api.deanpos.app` |
| `packages/backend` | The product's server-side logic and its database. See ADR-0008. | — |
| `packages/contract` | The **oRPC** contract bridge. Hand-written, imported by `apps/api`, `apps/pos`, and `apps/backoffice`; end-to-end typesafety is enforced by the gate, not by convention. | — |
| `packages/schemas` | Zod shapes, shared by both front ends and the backend. Shapes only — no transport. | — |
| `packages/error` | Error taxonomy: base error, error codes, HTTP mapping, schema errors. | — |
| `packages/ui` | Tailwind preset, design tokens, shadcn primitives. **Primitives only** — no POS-shaped or admin-shaped components. | — |
| `packages/tsconfig` | Shared TypeScript configuration. | — |

### Amendment, 2026-07-31: CQRS-lite, not hexagonal

This ADR originally specified "CQRS + hexagonal architecture" for the API. After evaluating
a working sibling codebase (see ADR-0008), that is **superseded**: the architecture is
**CQRS-lite** — handler → db-operation → Kysely, with commands and queries separated at the
db-operation layer, and no ports, adapters, or domain entities.

Why: hexagonal's payoff is swappable infrastructure and a domain layer isolated from it.
DeanPOS has one database, one consumer, and no plausible swap; ADR-0004 already keeps ORM
types out of the query path. What hexagonal would add is a port, an adapter, and a mapper
per slice — per-slice ceremony that was flagged as a cost when the original decision was
made. The db-operations boundary provides the seam that actually gets used.

Also amended: product logic moved out of `apps/api` and into `packages/backend`, so it is
testable without booting Hono.

### Why the POS and the back-office are separate apps on separate origins

Amended 2026-07-31, before any code existed. The original decision put both in one
`apps/app` SPA. Three already-decided requirements make that untenable:

1. **Offline scope.** The POS needs a service worker and a precached shell (ADR-0003);
   the back-office must never be offline. One SPA means one service-worker scope over
   both, so either admin chunks get precached onto a tablet or the manifest is
   hand-tuned indefinitely.
2. **Credentials at rest.** The POS holds a Device token and synced PIN hashes in
   IndexedDB (ADR-0007). On a shared origin, a back-office XSS reads them. Separate
   origins make that boundary browser-enforced rather than convention-enforced. This
   is the decisive reason.
3. **Different shells.** Touch-first tablet/phone sale screen versus a responsive
   desktop admin, with different auth (Device + PIN versus email + password) and
   different route guards. They share tokens, not layout.

Bundle size is **not** a reason — route-level lazy loading already covers it.

Origins are subdomains of one registrable domain, so cookies remain same-site and CORS
is an allowlist rather than a `SameSite=None` workaround.

- Runner and bundler for `apps/app`: **Vite+** (VoidZero).
- Primary test tool: **Vitest**, everywhere.
- ~~Package manager and runtime: **Bun**.~~ **Amended 2026-08-01:** **Vite+ (`vp`) is the
  monorepo manager; Bun is the runtime and the package-manager backend under it.** `vp`
  owns installs, the dependency catalog, workspace task running, and `check` (format, lint,
  typecheck in one command). Bun is declared in `devEngines.packageManager`, produces the
  committed `bun.lock`, and is the runtime `apps/api` serves on. The sibling project
  **Fashio** already runs exactly this shape, and copying a working configuration is the
  whole argument.
- ~~Linting and formatting by a separate tool.~~ **Amended 2026-08-01:** **oxlint and oxfmt
  via `vp check`.** They ship with Vite+, are configured in one `vite.config.ts` block, and
  run type-aware. Biome was the earlier answer and is dropped — adding a second binary to do
  what the manager already does is a tool to install, configure, and keep in agreement.
- Hosting: a single VPS running Docker Compose (app, api, Postgres). The whole stack
  must run locally with no cloud credentials.

Payload CMS was recommended and **rejected**; the back-office is hand-built inside
`apps/app`.

## Consequences

- The back-office admin is real work, not a free CMS panel — it is its own PRD area.
- Three origins means a wildcard TLS certificate, a CORS allowlist, and one more
  Compose service. Roughly a day inside the Foundation PRD, against a rewrite of the
  router, service worker, and auth guards if the split happens later.
- `packages/ui` is the new drift risk. It stays primitives and tokens; the moment a
  component knows what a cart or a report is, it belongs in its app.
- CQRS + hexagonal imposes per-slice ceremony (port, adapter, command/query handler)
  that an MVP does not strictly need. Accepted deliberately; it is the cost of the
  chosen architecture, not a finding for a reviewer to raise per ticket.
- ~~**Vite+ is commercial tooling with a licence tier.** CI needs its token or it silently
  falls back to plain Vite. This must be handled in the Foundation PRD, not discovered
  in a red pipeline.~~ **Resolved 2026-08-01:** `vp` v0.2.5 is installed and working on the
  development machine, and Fashio pins it through the root `catalog` as
  `vite-plus@0.2.5` with `vite` overridden to `@voidzero-dev/vite-plus-core@0.2.5`.
  DeanPOS pins the same way. There is no hosted CI to hold a token (ADR-0006), so the
  remaining exposure is a new machine, not a red pipeline.
- **`vp` is now on the critical path for every command in the repo.** Install, gate, test,
  and build all route through one binary. That is the point — one manager, one config — but
  it means a `vp` regression stops all work, and the version is pinned in the catalog for
  exactly that reason.
- `packages/contract` is the coupling point: a change there breaks two apps at once,
  which is the intent — the gate catches drift instead of production.

## Reversing it

Per-app and cheap early: `apps/landing` and `apps/app` are independent builds. The
expensive commitment is CQRS + hexagonal in `apps/api` — its cost grows with every
handler merged. Count them before promising a reversal.
