# ADR-0008: Backend module structure — handler-per-file, CQRS-lite, transport bound in the app

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, after evaluating a working sibling codebase
- **Amends:** ADR-0001 (which said "CQRS + hexagonal")

## Context

Every server-side ticket in twelve PRD areas will follow whatever shape is chosen here.
Choosing it badly is not a bad file layout; it is a bad file layout multiplied by a hundred
issues, each one carrying its own `## Relevant files` section and its own merge surface.

A sibling project, **ApxDenta**, already runs a Bun + Hono + Prisma + Kysely +
`prisma-kysely` monorepo in production with the same data-layer decisions DeanPOS made
independently (ADR-0004). Its structure was read in full rather than guessed at, and most
of it is adopted.

## Decision

### Layout

```
apps/api                     Hono shell. entry, env, middleware, and the oRPC binding.
  src/index.ts               app assembly and mount
  src/env.ts                 typed environment
  src/context.ts             builds the request Ctx: db, principal, tenant
  src/middlewares/           cors, rate limit, request id, tenant resolution
  src/routes/<area>.ts       implement(contract.<area>) → backend handlers.  ← the only transport-aware code

packages/backend             the product's server logic. NO transport dependency at all.
  src/db/client.ts           createDb(...) → Kysely<DB>; the single connection choke point
  src/db/prisma/             schema.prisma, migrations, generated types (prisma-kysely)
  src/db/seed.ts, fixtures/
  src/<area>/handlers/<verb-noun>.ts        export { inputSchema, handler }
  src/<area>/db-operations/commands/*.command.ts
  src/<area>/db-operations/queries/*.query.ts
  src/common/                errors, money primitives, pagination, Ctx and HandlerType
```

### Rules

1. **One operation, one file.** A handler file exports exactly `inputSchema` and `handler`.
   `create-order.ts`, `void-order.ts`, `get-catalog.ts`. This is what makes one ticket equal
   one file and makes `## Relevant files` mechanical rather than a judgement call.
2. **Handlers are transport-pure.** Nothing under `packages/backend` imports oRPC, Hono, or
   any HTTP concept. A handler takes `{ ctx, input }` and returns data.
3. **Handlers orchestrate; db-operations touch the database.** A handler validates,
   sequences, and enforces rules. Every Kysely query lives in a `.query.ts` or `.command.ts`
   under `db-operations`.
4. **Commands and queries are separate directories.** This is the CQRS in CQRS-lite: reads
   and writes are separated at the operation layer, not by separate models or stores.
5. **`apps/api/src/routes/<area>.ts` is the only place transport meets logic.** It binds a
   contract procedure to a handler and does nothing else.
6. **No ports, no adapters, no domain entities.** `db-operations` is the seam. Adding a port
   layer on top is explicitly out of scope (ADR-0001 amendment).

### What this buys, concretely

- Swapping the RPC layer touches only `apps/api/src/routes/*`, because handlers never knew
  about it.
- `packages/backend` is unit-testable without booting an HTTP server, which makes
  `foundation`'s in-process seam simpler rather than harder.
- A handler that nobody routed **cannot** happen: oRPC's `implement(contract)` fails
  typecheck on an unimplemented procedure, and `hardening`'s sweep enumerates the contract
  independently.

## What was deliberately not copied from ApxDenta

- **`organizationId` passed in context and filtered by hand in every query.** ApxDenta
  repeats `.where('X.organizationId', '=', organizationId)` in every query, including inside
  join subqueries. That is exactly the failure mode ADR-0002 rejected — one missed clause is
  another tenant's data. DeanPOS adopts the context shape and puts **RLS underneath it**:
  the tenant session variable is set in `createDb`'s connection acquisition, inside the
  transaction, and the hand-written predicate becomes a second line of defence rather than
  the only one.
- **Casting the tenant out of context** (`ctx.organizationId as string`). The Ctx type
  distinguishes an authenticated tenant-scoped principal from an unauthenticated one, so no
  cast is needed.
- **Per-handler `try/catch` with `console.error`.** Errors propagate; one place formats and
  logs them, per `observability`.
- **A seeder exposed as an API route.** Seeding is a script, not an endpoint, in a product
  that holds other people's takings.
- **tRPC and SuperJSON.** oRPC, per ADR-0001.
- **better-auth.** Device-token and offline PIN unlock (ADR-0007) cannot be bought, and
  running two session models side by side means two sets of tables and two revocation paths.

## Consequences

- The handler layer is thin by design. Business rules live in handlers, not scattered into
  queries — a query that enforces a rule is a rule nobody can find.
- `packages/backend` must not grow a dependency on `apps/api`. If it needs one, the
  boundary is wrong.
- The pattern is uniform across all twelve areas. A reviewer can judge structure by looking,
  and an implementer copies the nearest neighbour.
- Adopting a sibling's proven layout means its ergonomics are known rather than hoped for;
  it also means its mistakes are known, which is why the list above is explicit.

## Reversing it

Cheap early and progressively expensive: the layout is mechanical, so a rename or a
regrouping is a scripted move. Introducing ports and adapters later is possible but would
touch every handler, and the reason to do it — swappable persistence — is not a reason
DeanPOS has.

## Evidence

`/Users/jomelortega/Desktop/personals/ApxDenta`, read on 2026-07-31: `packages/domain`
(`src/db`, `src/server/{trpc,types,index,common,utils,routes}`), `apps/server/src/index.ts`,
`packages/schemas`, `packages/error`, and `apps/webapp/src/{routes,features}`.
