# 006: The oRPC packages, and zod 4 without the zod integration package

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/04-ping-contract-api-health-cors.md`)

## The question

oRPC is the remote-procedure layer and Hono is the transport shell — both fixed by
ADR-0001 and ADR-0008 and not reopened here. What was never written down is **which
actual packages get installed, at which versions, in which of the ten workspaces**,
and — the fork with a real cost either way — **whether the project validates with
zod 3 or zod 4**.

A wrong answer is expensive in a specific way. Eleven areas after this one write
procedures against whatever shape is chosen, so the cost of changing it is not the
cost of editing a manifest; it is the cost of every procedure, every schema, and
every test written on top of it in the meantime.

## What I chose, and why

**Six packages, zod 4, and deliberately *not* the package whose name suggests you need
it.**

The finding that decided almost everything: **oRPC does not care which validation
library you use.** Its contract package depends on `@standard-schema/spec`, a small
shared interface that several validation libraries implement, and oRPC's own
documentation says it "supports Zod, Valibot, Arktype, and any other Standard Schema
library for input and output validation." I checked the published package metadata
directly rather than taking that on trust: `@orpc/contract`, `@orpc/server`, and
`@orpc/client` declare **no dependency on zod at all**, of any kind, at any version.

That matters because there *is* a package called `@orpc/zod`, and the obvious
assumption is that you need it to use zod with oRPC. You do not. Reading what it
actually pulls in settles it — `@orpc/zod` depends on `@orpc/openapi` and
`@orpc/json-schema`. It is a tool for converting zod schemas into an OpenAPI
document. **DeanPOS does not produce an OpenAPI document.** Nothing in any ADR, in
the foundation PRD, or in `hardening`'s coverage sweep asks for one; the sweep
enumerates the contract itself, which is the whole point of the contract being
hand-written. So this package is a capability the project does not have a use for,
and it is not installed.

Removing it removes the only thing in the entire set that constrains the zod major.
`@orpc/zod` is the package that requires `zod >= 3.25.0`; without it there is no
constraint at all, and the choice becomes a plain one about which zod to write eleven
areas of schemas in. That is **zod 4** (`4.4.3`), and zod's own documentation for
library authors says it plainly: "For any new library — or any new major version of
an existing library — target Zod 4 only."

I want to be explicit that the sibling project is not evidence here, because the brief
correctly warned it would not be. ApxDenta pins `zod ^3.25.51`, and it also runs
`@hono/zod-openapi ^0.18.3` — an OpenAPI package DeanPOS does not use, on a tRPC stack
DeanPOS deliberately diverges from. Its zod major is a fact about its OpenAPI tooling,
not a recommendation this project inherits. This is the first decision in this run
where copying the sibling gives no answer, and the record says so rather than
manufacturing one.

**On the test seam, which was the thing most likely to make an obvious choice wrong.**
The whole project rests on being able to build a real oRPC client over a `fetch`
function we supply, so that a test can dispatch into the Hono application in-process
with no port and no running server. I verified both halves against first-party
documentation rather than reasoning that it ought to work. oRPC's `RPCLink` takes a
`fetch` option, documented with the signature
`(request: Request, init?: RequestInit, options?: { context?: ClientContext }) => Promise<Response>`.
Hono's testing documentation states that `app.request()` accepts "an instance of the
Request class" and returns a Response, with no server started. Those two signatures
meet exactly. The seam is not a hope; it is two documented interfaces that fit.

**On the typecheck property**, which issue 04 has as an acceptance criterion and
`hardening` depends on: I could **not** confirm it from the documentation, and I am
saying so rather than quoting a sentence that sounds close. The `implement` docs page
claims the router is "type-checked" and that oRPC "enforces your contract at runtime"
— runtime enforcement is a weaker claim than the one the PRD needs. So I read the
type source instead, which is the thing that actually owns the answer. oRPC types the
router argument as `ContractedRouter<TContract, …>`, and that type maps over the
contract as `[K in keyof T]` **with no optional modifier**. Every key of the contract
is therefore a required property of the router object, and a procedure nobody
implemented is a compile error. The property holds — but it holds because of an
implementation detail rather than a documented promise, so it is listed below as
something to re-check on every oRPC upgrade rather than assumed forever.

**Why no `@hono/*` adapter.** oRPC mounts on Hono through its own generic Fetch
handler, `RPCHandler` from `@orpc/server/fetch`, passed `c.req.raw`. oRPC's Hono page
documents exactly this and names no adapter package; `@orpc/server`'s published
exports map contains a `./fetch` entry and no `./hono` entry. There is nothing for a
third-party adapter to do. This is rung 4 of the ladder — the platform already covers
it — and it keeps a package out of the tree.

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Nobody sees an RPC library. Every option delivers a working app. |
| Business impact | ×1 | Same — all candidates are MIT and free. |
| Engineering cost and risk | ×2 | Package count, whether the seam works, whether the typecheck property holds. |
| Reversibility | ×2 | Eleven areas write procedures on top of this. This is the headline risk. |
| Evidence strength | ×2 | The seam is the constraint most likely to falsify an obvious answer, so verification carries. |

Maximum possible total: 40. Same shape as records 002 and 004, for the same reason —
invisible infrastructure, where cost, removal, and proof are what separate candidates.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **oRPC 1.14.13 core set + zod 4, no `@orpc/zod`** | 4 | 4 | 5 (10) | 4 (8) | 5 (10) | **36** |
| 2 | Same, but add `@orpc/zod` on the `zod4` subpath | 4 | 3 | 3 (6) | 4 (8) | 4 (8) | **29** |
| 3 | oRPC `2.0.0-beta.23` + zod 4 | 4 | 2 | 2 (4) | 3 (6) | 2 (4) | **20** |
| 4 | `@orpc/zod` + zod 3, following the sibling's major | 3 | 3 | 2 (4) | 2 (4) | 3 (6) | **20** |
| 5 | Defer — let issue 04 choose | 1 | 1 | 1 (2) | 5 (10) | 1 (2) | **16** |

Options 3 and 4 tied at 20 and were **broken toward the more reversible option**, per
process: the beta line is a version bump to walk back, zod 3 is eleven areas of schemas
to rewrite.

**1. oRPC 1.14.13 core set with zod 4 — chosen.** Six third-party packages total across
four workspaces, all MIT, all ESM. It is simultaneously the option with the fewest
packages and the only one where every load-bearing property was verified against a
first-party source: the custom-`fetch` option from oRPC's own docs, `app.request()`
from Hono's own docs, the missing-procedure compile error from oRPC's type source, and
every version and peer range from the npm registry. It scores 4 rather than 5 on
reversibility only because the contract *style* — not the packages — is what eleven
areas inherit; see the reversal section, which is honest about which half is cheap.

**2. Add `@orpc/zod` on its `zod4` subpath.** Ranked second and worth taking seriously,
because it is the option someone will propose later. `@orpc/zod@1.14.13` does ship a
`./zod4` export and does accept `zod >= 3.25.0`, so the common belief that the stable
line is zod-3-only is simply wrong, and I am recording that because it would otherwise
be re-argued. It loses on cost, not on correctness: it drags `@orpc/openapi` and
`@orpc/json-schema` into the tree to provide OpenAPI generation that this project has
no requirement for, and it adds a third package that must be kept in version lockstep
with the rest of the family. **This is the option to move to the day DeanPOS needs to
publish an OpenAPI document** — a partner integration, a public API — and not before.

**3. The `2.0.0-beta.23` line.** Genuinely tempting: it is zod-4-native, so the zod
question would not even arise. Rejected on stakes. This is the foundation of a product
that holds other people's takings, eleven areas are queued behind it, and there is no
hosted CI to catch a regression — I could not establish a stable-release date or any
statement about the beta's API stability, so its evidence score is a 2 and honestly
earned. **Trigger to revisit: oRPC 2.0 reaching stable**, at which point the migration
cost across however many areas have shipped is the number to weigh.

**4. zod 3, following the sibling.** The option the brief specifically asked me to test
rather than assume, and it fails the test. Nothing in the chosen package set requires
zod 3; the sibling's pin is explained by OpenAPI tooling this project does not use.
Its reversibility score of 2 is the decisive number: choosing zod 3 means every schema
in eleven areas is written in zod 3, and moving to 4 later is a rewrite of all of them.
The asymmetry runs the other way too, and it is worth knowing — see the reversal
section, where zod 4 turns out to contain its own escape hatch.

**5. Defer.** Included because it must be, and it loses on the facts. Ten of its
sixteen points come from reversibility, which any do-nothing option maximises
trivially — the same inflation record 002 flagged, left visible rather than tuned away.
It fails because issue 04 cannot begin without these packages, so deferring does not
postpone the decision; it hands it to whoever opens the issue first, at speed, without
this verification, and then eleven areas inherit whatever they picked.

## What the implementer does

Exact, so nothing here is re-decided downstream. **Do not edit any manifest on the
strength of this record alone — it is the instruction for issue 04, not a change to
apply now.**

### Root `package.json` — the catalog block becomes

```json
"catalog": {
  "vite": "npm:@voidzero-dev/vite-plus-core@0.2.5",
  "vite-plus": "0.2.5",
  "fast-check": "4.9.0",
  "@orpc/contract": "1.14.13",
  "@orpc/client": "1.14.13",
  "@orpc/server": "1.14.13",
  "@orpc/tanstack-query": "1.14.13",
  "zod": "4.4.3"
}
```

### Per workspace — every line, explicitly

| Workspace | Package | Version | Section | Catalog? |
| --- | --- | --- | --- | --- |
| `packages/schemas` | `zod` | `catalog:` → `4.4.3` | `dependencies` | yes |
| `packages/contract` | `@orpc/contract` | `catalog:` → `1.14.13` | `dependencies` | yes |
| `packages/contract` | `@orpc/client` | `catalog:` → `1.14.13` | `dependencies` | yes |
| `packages/contract` | `zod` | `catalog:` → `4.4.3` | `dependencies` | yes |
| `packages/backend` | `zod` | `catalog:` → `4.4.3` | `dependencies` | yes |
| `apps/api` | `@orpc/server` | `catalog:` → `1.14.13` | `dependencies` | yes |
| `apps/api` | `hono` | `4.12.33` | `dependencies` | **no** |
| `apps/pos` | `@orpc/tanstack-query` | `catalog:` → `1.14.13` | `dependencies` | yes |
| `apps/backoffice` | `@orpc/tanstack-query` | `catalog:` → `1.14.13` | `dependencies` | yes |

Plus the workspace links these imply, which are not third-party packages but must be
declared: `packages/contract` depends on `schemas`; `apps/api` depends on `contract`
and `backend`; `apps/pos` and `apps/backoffice` depend on `contract`.

**`packages/backend` declares `zod` and nothing else from this record.** No
`@orpc/*`, no `hono`, ever — ADR-0008 rule 2 and issue 04's acceptance criterion. It
needs zod because ADR-0008 rule 1 requires each handler file to export an
`inputSchema`, which is a zod schema. That schema is the *same shape object* imported
from `packages/schemas`, not a second definition of it.

**Every one of these is a `dependency`, not a `devDependency`.** Each is executed at
runtime: zod validates, the contract is the runtime procedure definition, the client
issues calls, the server dispatches them. This is the opposite of record 002's
`fast-check` placement and for the opposite reason — that never ships, these are what
ships.

### Why `hono` alone gets no catalog pin, and why the `@orpc/*` set does

Record 004 set the test as *pin once, use many*: `fast-check` was pinned because
several workspaces declare it; `pg` was not, because exactly one ever will. Applying
it here:

- **`zod` — pin.** Three workspaces declare it (`schemas`, `contract`, `backend`) and
  both front ends resolve it transitively. It passes the test outright, and there is a
  second reason that is stronger than the first: two different zod versions resolving
  in one repository is not duplication, it is a **type-level break**, because a schema
  built by one copy does not satisfy the `Standard Schema` interface as seen by the
  other. A single catalog line is what makes that impossible.
- **`hono` — no pin.** One workspace declares it, forever. `apps/api` is the only place
  a transport library may exist at all, by ADR-0008. This is `pg` exactly, and it gets
  `pg`'s answer: the exact version inline. **Trigger to revisit:** a second workspace
  needing `hono` — and treat that need as evidence the transport boundary has been
  breached, and check *that* before adding the pin.
- **The four `@orpc/*` packages — pin, and this extends record 004's test rather than
  applying it.** Taken one at a time, three of them have a single declaring workspace
  and would score "no pin". I am pinning them anyway, on a second condition that record
  004 never had to consider: **they are a lockstep-versioned family**, and I verified
  that from the registry rather than assuming it. `@orpc/server@1.14.13` depends on
  `@orpc/client@1.14.13` and `@orpc/contract@1.14.13` at *exact* versions, and
  `@orpc/tanstack-query@1.14.13` declares an *exact* peer dependency on
  `@orpc/client@1.14.13`. Bumping one of four inline versions and forgetting another is
  therefore not a slow drift that surfaces later — it is an immediate peer conflict or
  two resolved copies of `@orpc/client`, with the second copy breaking client typing
  across the contract boundary. One catalog block makes the bump atomic and reviewable
  in a single diff. **This is the part of this record most reasonable to disagree
  with**, since it reads the spirit of record 004 over its letter, and I would rather
  flag that than bury it.

### How the client is built over a custom `fetch` — the exact shape issue 04 needs

Issue 04 builds the server half of this; issues 06 and 07 reuse it unchanged. Build it
**once**, in `packages/contract`, as a factory taking the `fetch` function as an
argument — not three times, in two apps and a test helper. That is why `@orpc/client`
is a dependency of `packages/contract` rather than of each app: the injection point for
`fetch` is the one thing the seam and both browsers must share.

```ts
// packages/contract — the single client construction path
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export function createClient(options: {
  url: string;
  fetch?: (request: Request, init?: RequestInit) => Promise<Response>;
}): ContractRouterClient<typeof contract> {
  return createORPCClient(new RPCLink(options));
}
```

In production the `fetch` argument is omitted and oRPC uses the global. In the seam it
is supplied, and this is the whole trick — the `Request` goes straight into the Hono
application and a `Response` comes back, with no port, no listener, and no mock:

```ts
// the seam: no server, no port
const client = createClient({
  url: "http://api.test/rpc",
  fetch: (request, init) => app.request(request, init),
});
```

Both halves of that are documented, and neither is inferred:

- oRPC, `RPCLink` options — the `fetch` option, typed
  `(request: Request, init?: RequestInit, options?: { context?: ClientContext }) => Promise<Response>`,
  with a worked example overriding fetch behaviour.
  <https://orpc.dev/docs/client/rpc-link>
- Hono, testing — "You can also pass an instance of the Request class", and "All you
  need to do is create a Request and pass it to the Hono application to validate the
  Response". <https://hono.dev/docs/guides/testing>
- Typing the client from the **contract** rather than from the router —
  `const client: ContractRouterClient<typeof contract> = createORPCClient(link)`.
  <https://orpc.dev/docs/client/client-side>

The `url` is required by `RPCLink` and, when a custom `fetch` is supplied, is only
used to build the `Request`'s URL — nothing dials it. Give it the configured origin so
the CORS assertions in issue 04 have a real `Origin` to work against.

### Mounting the handler on Hono — no adapter package

```ts
import { Hono } from "hono";
import { RPCHandler } from "@orpc/server/fetch";
import { implement } from "@orpc/server";
```

`handler.handle(c.req.raw, { prefix: "/rpc", context })` inside a Hono middleware,
returning `c.newResponse(response.body, response)` when `matched` is true and calling
`next()` otherwise. **Do not add `@hono/trpc-server`, `@hono/zod-openapi`, or any other
`@hono/*` package.** ApxDenta declares both; both belong to its tRPC and OpenAPI stack
and neither has a job here.

### What this constrains for issues 06 and 07 — the answer is "almost nothing"

`@orpc/tanstack-query@1.14.13` peer-depends on `@tanstack/query-core` at `>=5.80.2`,
with **no upper bound**, and declares no React peer at all — it is built on the
framework-agnostic core. `@tanstack/react-query@5.101.4` bundles
`@tanstack/query-core@5.101.4`, which satisfies it comfortably. So issues 06 and 07
choose their own TanStack Query version freely; the only rule is **not below 5.80.2**.
Nothing here touches TanStack Router at all.

Use `@orpc/tanstack-query`, **not `@orpc/react-query`**. Both are published at 1.14.13
and, checked directly, *neither carries a deprecation flag on npm* — so this is a
judgement rather than a rule being followed. oRPC's documentation for the react-query
package now lives under a `tanstack-query-old/` path while `@orpc/tanstack-query` is
the documented integration, and the latter needs no React peer. Recording it so issues
06 and 07 do not each re-decide it, and so the reasoning is visible if it turns out to
be wrong.

### A boundary this interacts with — read before writing issue 06

Record 004 states that `pg` cannot reach a browser bundle "on one condition that must
hold: `apps/pos` must not depend on `packages/backend`." The seam is about to make that
sentence need a qualifier, and it is better said now than discovered in review.

Issue 06's test renders a route and dispatches into the Hono application, so `apps/pos`
must be able to import that application — which means a **`devDependency` on the `api`
workspace**, and therefore `hono`, `@orpc/server`, `packages/backend`, and `pg` all
appear somewhere in `apps/pos`'s development graph. The rule that keeps record 004's
guarantee intact is narrow and must be stated as such:

> `apps/pos` and `apps/backoffice` may depend on `api` **only** in `devDependencies`,
> and no module under either app's `src/` may import from `api`, `backend`, `hono`, or
> `@orpc/server`. The seam helper and the tests are the only permitted importers.

Production `dependencies` are what a bundler follows from the entry point, so a
dev-only link cannot reach a shipped bundle. But this is now enforced by that rule
rather than by the package simply being absent, which is weaker, and record 004
already flagged that nothing mechanically enforces these boundaries. Issue 04's
existing grep criterion is the natural place to also assert that no file under
`apps/*/src/` imports `hono` or `@orpc/server`.

### No-gos

- **No `@orpc/zod`, `@orpc/openapi`, or `@orpc/json-schema`.** No OpenAPI document is
  produced in v1. Adding them is a decision, not a convenience.
- **No `zod` import anywhere under `apps/*/src/`** that defines a *new* shape. Shapes
  live in `packages/schemas`; a second definition of a validated shape is a review
  finding, for the same reason a second `round` is.
- **No `@orpc/*` or `hono` in `packages/backend`,** in either section.
- **No second zod major.** Do not import from `zod/v3` in product code. The subpath
  exists and is the reversal path described below; using it casually recreates the
  two-copies type break the catalog pin exists to prevent.

## How to turn it back

This decision has two halves with very different reversal costs, and collapsing them
into one number would be the dishonest version of this section.

**The cheap half: the zod major.** This is the surprise, and it is worth stating
plainly because it is what makes the zod-4 choice safe rather than brave. `zod@4.4.3`
publishes a `./v3` subpath in its own exports map — verified in the registry metadata,
not assumed. So the zod 3 implementation ships *inside* the zod 4 package. Reversing to
zod 3 does not mean reinstalling anything; it means changing import specifiers from
`zod` to `zod/v3`, which is a mechanical find-and-replace across schema files, with the
type system catching every site it misses. The reverse direction — the one option 4
would have committed us to — has no such escape hatch. This asymmetry is most of why
zod 4 won.

**The expensive half: the contract style.** Reversing the *packages* is bounded:

1. Write a superseding record naming the replacement; flip this record's `Status:` to
   `overturned` with the date and reason, and update both lines in `LOG.md`.
2. **Count the real cost before promising anything.** Two counts, and they are the
   number:
   - `rg -l 'from "@orpc/' apps packages` — every hit is a file to rewrite. Today: zero.
     After eleven areas, it is `packages/contract/src/**` in full plus one
     `apps/api/src/routes/<area>.ts` per area.
   - `rg -l 'from "zod"' apps packages` — the schema surface. This one grows fastest,
     because every area adds shapes.
3. Replace the four `@orpc/*` catalog lines and the `hono` line in `apps/api`; edit the
   five workspace manifests in the table above; `vp install`; commit the regenerated
   `bun.lock`.
4. Rewrite `packages/contract` in the replacement's contract syntax, and rewrite every
   `apps/api/src/routes/<area>.ts` binding. **This is the actual work**, and it is one
   file per area plus the whole contract package.
5. Rewrite the seam helper's client construction — **one file**, because the factory in
   `packages/contract` is the only place a client is built. This is the single largest
   reason to build it once rather than three times, and it is why the instruction above
   insists on it.
6. Re-run the gate: `vp check; vp run -r check; vp run -r test`.

**What is *not* touched, and this is the point of ADR-0008.** `packages/backend` holds
every handler and every db-operation in the product, and imports no transport library,
so **not one handler changes** however many areas have shipped. No migration is
touched. No data moves. That is what keeps a high-stakes dependency choice inside my
mandate: the reversal is bounded by the number of areas, and it is bounded to the
*thinnest* files in each area — one route binding apiece.

**What would void this estimate:** an `@orpc/*` type appearing in an exported signature
in `packages/backend`, or a route binding under `apps/api/src/routes/` growing product
logic. Either erodes the boundary that makes step 4 one file per area. Check both
before quoting a reversal cost.

## What would make this decision wrong

- **`implement()` stops rejecting an unimplemented procedure at compile time.** This is
  the property issue 04 must demonstrate and `hardening`'s sweep relies on, and I
  established it from oRPC's *type source* rather than from a documented promise — the
  docs claim only runtime enforcement. **Re-check it on every `@orpc/*` upgrade**, and
  treat issue 04's demonstration of it as a permanent regression test, not a one-off
  ceremony.
- **oRPC 2.0 reaches stable.** Option 3 becomes worth re-scoring. The number that
  decides it is how many `apps/api/src/routes/*.ts` files exist by then.
- **A requirement for a published OpenAPI document appears** — a partner integration or
  a public API. That is option 2's trigger, and it is an addition rather than a
  reversal: `@orpc/zod` on its `zod4` subpath, no zod change.
- **`@orpc/tanstack-query` stalls or is folded back into another package.** The whole
  family shares a release train and a small maintainer group; a stall affects all four
  at once, which is a concentration this record accepts and names.
- **A second copy of `@orpc/client` or `zod` appears in `bun.lock`.** That is the
  failure mode the catalog block exists to prevent, and it will present as confusing
  type errors across the contract boundary rather than as an install error.

## Evidence

**Repository, read 2026-08-02:**

- `docs/adr/0001-stack-and-monorepo-shape.md` — oRPC, Hono, the workspace table, and
  the catalog-pinning mechanism. `docs/adr/0008-backend-module-structure.md` — rules 1,
  2, and 5; the `implement(contract)` claim; "tRPC and SuperJSON" listed among what was
  deliberately not copied from ApxDenta.
- `.scratch/foundation/PRD.md` — "Contract" and "Backend structure" sections; the one
  seam, quoted verbatim under "Testing Decisions"; security criterion 8.
- `.scratch/foundation/issues/04-ping-contract-api-health-cors.md` — the
  unimplemented-procedure typecheck criterion, and the no-transport-in-backend
  criterion. `.../06-terminal-shell-and-test-seam.md` — the render half of the seam,
  and the TanStack Query criterion.
- `.scratch/decisions/002-property-testing-for-money.md` — the catalog pin-once-use-many
  precedent and the `dependencies` vs `devDependencies` reasoning about front-end
  bundles. `.../004-postgres-driver.md` — the no-pin-for-one-declarer precedent, and the
  `apps/pos` must-not-depend-on-`packages/backend` condition this record qualifies.
- Root `package.json` — the existing `catalog` block. All ten workspace manifests —
  none currently declares zod, oRPC, or Hono; `packages/schemas` confirmed to have no
  zod at all, as the brief stated.
- `.scratch/decisions/` searched for an existing record on RPC packages, zod, or Hono
  before deciding: 001–005 only, none names any of them. No duplicate.

**External, primary sources, accessed 2026-08-02.** Registry metadata read from
`registry.npmjs.org/<pkg>/latest`:

- `@orpc/contract` **1.14.13**, MIT, `"type": "module"`, exports `.` and `./plugins`;
  dependencies include **`@standard-schema/spec@^1.1.0`**; **no zod peer dependency**.
  This is the fact the whole record turns on.
- `@orpc/server` **1.14.13**, MIT, ESM; exports include **`./fetch`** and **no
  `./hono`**; `peerDependencies` are **`ws`** and **`crossws`**, both marked optional —
  **no zod, no hono**. Depends on `@orpc/client@1.14.13` and `@orpc/contract@1.14.13`
  at exact versions.
- `@orpc/client` **1.14.13**, MIT, ESM; exports include **`./fetch`**; no peer
  dependencies.
- `@orpc/tanstack-query` **1.14.13**, MIT; `peerDependencies`
  **`{"@orpc/client": "1.14.13", "@tanstack/query-core": ">=5.80.2"}`** — the exact
  client pin is the lockstep evidence, and the absence of a React peer is why it is
  preferred over `@orpc/react-query`.
- `@orpc/zod` **1.14.13**, MIT; exports **`.` and `./zod4`**; dependencies
  **`@orpc/openapi@1.14.13`** and **`@orpc/json-schema@1.14.13`**; `peerDependencies`
  **`{"zod": ">=3.25.0", "@orpc/server": "1.14.13", "@orpc/contract": "1.14.13"}`**.
  The OpenAPI dependencies are what disqualify it here; the `./zod4` export is what
  disproves the "stable line is zod 3 only" belief.
- `@orpc/react-query` **1.14.13** and `@orpc/react` **1.14.13** both exist and **carry
  no npm deprecation flag** — recorded because it makes the choice above a judgement.
- `zod` **4.4.3**, MIT, ESM; exports map includes **`.`, `./v3`, `./v4`, `./mini`** —
  the `./v3` entry is the basis of the cheap-reversal claim.
- `hono` **4.12.33**, MIT, ESM, `engines.node >= 16.9.0`, **zero dependencies**.
- `@tanstack/react-query` **5.101.4**, MIT, depends on `@tanstack/query-core@5.101.4`,
  peer `react ^18 || ^19` — satisfies oRPC's `>=5.80.2` floor.

**External documentation and source:**

- <https://orpc.dev/docs/procedure> — "oRPC supports Zod, Valibot, Arktype, and any
  other Standard Schema library for input and output validation." The validator-agnostic
  claim, from the project that owns it.
- <https://orpc.dev/docs/client/rpc-link> — the `fetch` option, its signature
  `(request: Request, init?: RequestInit, options?: { context?: ClientContext }) => Promise<Response>`,
  and a worked example. The custom-fetch half of the seam.
- <https://orpc.dev/docs/client/client-side> — `createORPCClient` from `@orpc/client`,
  `RPCLink` from `@orpc/client/fetch`, and
  `const client: ContractRouterClient<typeof contract> = createORPCClient(link)` for
  typing from a contract rather than a router.
- <https://orpc.dev/docs/adapters/hono> — the Hono mounting snippet using `RPCHandler`
  from `@orpc/server/fetch` with `c.req.raw`, `prefix`, and `matched`. Names no adapter
  package.
- <https://hono.dev/docs/guides/testing> — `app.request()` accepts "an instance of the
  Request class"; "All you need to do is create a Request and pass it to the Hono
  application to validate the Response." The in-process half of the seam.
- <https://raw.githubusercontent.com/middleapi/orpc/main/packages/server/src/router.ts>
  — `ContractedRouter<T, TInitialContext>` maps `{ [K in keyof T]: … }` **with no
  optional modifier**, making every contract key a required property.
- <https://raw.githubusercontent.com/middleapi/orpc/main/packages/server/src/implementer-router.ts>
  — `router<T extends ContractedRouter<TContract, any>>(router: T): T`. Together with
  the line above, this is the compile-error property, established from source because
  the documentation does not state it.
- <https://zod.dev/library-authors> — "For any new library — or any new major version
  of an existing library — target Zod 4 only", and the note that the `zod/v4` subpath
  has existed since 3.25.0.
- Repository is `github.com/middleapi/orpc`; homepage `https://orpc.dev`. All `@orpc/*`
  packages are MIT and ESM-only.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and
no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **The `implement()` compile-error property is not stated in oRPC's documentation.**
  <https://orpc.dev/docs/contract-first/implement-contract> claims the router is
  "type-checked" and that oRPC "enforces your contract at runtime" — runtime
  enforcement is weaker than what the PRD requires. The property was established from
  the type source instead, which is why it is listed as an upgrade re-check rather than
  as a guarantee.
- **Which zod version first implemented Standard Schema could not be confirmed** from
  the spec's own site or repository README; both fetches returned only the interface
  definitions and no implementers list. This does not change the decision — oRPC names
  Zod as supported in its own documentation, and `@orpc/zod` accepts `zod >= 3.25.0`
  with a dedicated `zod4` export — but the precise first-supporting version is asserted
  by nobody I could reach, so it is not asserted here either.
- **No stable-release date or API-stability statement for oRPC 2.0** could be found.
  This is the whole reason option 3 scored 2 on evidence.
- **No `@orpc/server` peer dependency on `hono`** exists, so no version of Hono is
  imposed. `4.12.33` is simply the current release.
- **ApxDenta was checked and is not precedent**, exactly as the brief said: it runs
  tRPC 11, `@hono/trpc-server`, `@hono/zod-openapi`, and `zod ^3.25.51`. None of those
  packages appears in this decision, and its zod major travels with OpenAPI tooling
  DeanPOS does not use. This is the second decision in this run — after record 002 —
  where the usual "copy the sibling" argument yields nothing.
