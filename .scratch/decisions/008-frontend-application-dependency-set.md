# 008: The front-end application dependency set — a generated route tree that is not committed, and one render seam that lives beside the server one

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/06-terminal-shell-and-test-seam.md`; issue 07 consumes it unchanged)

## The question

`apps/pos` and `apps/backoffice` are two empty React applications. Records 006 and
007 have already named React, the oRPC client, the TanStack Query *adapter*, Tailwind
and the two UI primitives. What is still missing is everything that makes a route
render and a test run: the router, the Query package itself, the React plugin for the
bundler, the DOM environment, the render library, and the accessibility checker.

A wrong answer is expensive in the usual eleven-areas way, but this record carries two
specific traps that a plausible answer walks straight into:

1. The acceptance criterion is **"a link to a removed route fails the build."** TanStack
   Router's typed routes come from a **generated file**. If that file is stale when the
   gate runs, the criterion is nominally satisfied and mechanically false — the build
   goes green on a link to a route that no longer exists.
2. If the generated file is gitignored and nothing regenerates it, a clean clone does
   not compile. **That is exactly the trap that blocked issue 03**, and record 005 exists
   because of it.

Both are answered below, and neither is answered by picking a package.

**Not open, and not reopened:** TanStack Router with typed routes and TanStack Query on
the oRPC client (ADR-0009, the PRD); Vite+ `0.2.5` as runner and bundler with Bun
underneath; thin routes and fat features (ADR-0009); `@orpc/tanstack-query@1.14.13`
(record 006); `react`/`react-dom@19.2.8` and the two `@types` packages (record 007);
`packages/ui` shipping exactly `button` and `sheet` (record 007).

## What I chose, and why

**Nine new third-party packages, across three workspaces. Three decisions inside that
set matter far more than the version numbers.**

### 1. The route tree is generated, is *not* committed, and the gate regenerates it first

TanStack Router's type safety works by generating a route tree file and merging it into
the library's types through a `declare module` block. `<Link to="…">` is then typed
against a union of the paths in that file. Delete a route file, regenerate, and the path
leaves the union — the link stops compiling. That is the whole mechanism, and it has one
weakness: **it is only true of the tree as it exists on disk at typecheck time.**

The project's gate is `vp check; vp run -r check; vp run -r test`. Nothing in it
regenerates anything. I checked when the plugin *does* regenerate, from its own source
rather than from the docs: it hooks `vite: { configResolved }` and `watchChange`. So it
regenerates during `vp dev`, during `vp build`, and — usefully — at Vitest startup. But
Vitest runs **third** in the gate, after both typecheck steps. An implementer who deletes
a route and runs the gate gets a green `vp check` against a stale tree. The criterion
would be a claim, not a property.

So three things change together, and they are one decision, not three:

- **The tree is generated into `apps/<app>/src/generated/routeTree.gen.ts`**, which
  `**/generated/**` already gitignores and which `ORC2_GENERATED_PATHS` already excludes
  from review diffs. This is not an innovation — the PRD already says "Generated output
  lives under a `generated/` directory and is matched by `ORC2_GENERATED_PATHS`". A route
  tree is generated output. The default location, `src/routeTree.gen.ts`, would be the
  only generated file in the repository sitting outside that convention.
- **The root `codegen` script regenerates it**, alongside Prisma, via
  `@tanstack/router-cli`'s `tsr generate` — a standalone generator that needs no dev
  server, no network, and exits non-zero on failure (read from
  `packages/router-cli/src/generate.ts`). Record 005 already made `codegen` a root script
  and already made `prepare` fire it at install, so **a clean clone regenerates the route
  trees before anyone types a gate command, with no new mechanism at all.** This is rung 2
  of the ladder: the trap that blocked issue 03 was already solved, and the solution
  already runs.
- **`ORC2_GATE` gains `vp run -w codegen;` at the front.** This is one line in
  `.orc2/config.env`, and it is the exact string record 005 pre-vetted as its own
  fallback. It costs milliseconds and it is what turns the acceptance criterion from a
  claim into a property: the tree `vp check` reads is always the tree the route files on
  disk imply. It also closes the same latent staleness hole for Prisma's generated types,
  which nobody has hit yet only because no migration has been edited without an install.

**Committing the file instead was the closest call in this record**, and it is ranked
second below rather than dismissed. Two things decided it. The first is the PRD sentence
above. The second is the merge behaviour: a route tree is an **ordered index file**, and
`.orc2/ORCHESTRATOR.md` names ordered index files as the dangerous conflict case — "they
merge cleanly and produce the wrong order". Every one of eleven areas adds routes in a
parallel lane. Committing the tree buys a conflict per lane, forever, on a file whose
correct resolution is always "throw both sides away and regenerate".

I am also recording, because it cuts against me: **one research pass reported a TanStack
FAQ sentence saying the route tree is source code and should be committed. A second pass
could not reproduce it, and could not find any TanStack page stating a position on
version control either way.** I am not claiming TanStack recommends what I chose. I am
claiming their generator is deterministic, standalone, and exits non-zero — which is what
makes ignoring it safe here — and that the repository's own convention says generated
output is ignored.

**And the criterion gets a committed proof, not a demonstration.** Issue 04 already set
this precedent with `apps/api/tests/router-contract.types.ts`: a `@ts-expect-error`
fixture that goes red when the *directive becomes unused*, so it fails in the direction of
the feared regression. The same shape pins typed routes. It is stronger than a one-off
"I deleted a route and it broke", because it keeps failing forever if `to` ever loosens
to `string`.

### 2. There is one render seam, and it lives in `apps/api` beside the server half

This is **the part of this record most reasonable to disagree with**, so it gets the
argument rather than an assertion.

Issue 07 says the seam must be consumed "unchanged" and that "a second copy of the test
setup is the failure this issue exists to catch". The server half is already
`apps/api/src/test-seam.ts`. The render half needs React, Testing Library and axe. Where
does it live?

- Not in `apps/pos` — ADR-0009 rule 6 forbids `apps/backoffice` importing from it.
- Not duplicated — that is the failure issue 07 exists to catch.
- Not in `packages/ui` — record 007 forbids `@tanstack/*` imports there.
- An eleventh workspace would contradict the PRD's enumerated ten and ADR-0001's
  workspace table, and would need its own manifest, tsconfig and scripts to hold one file.

So it lives at **`apps/api/src/test-seam-react.tsx`**, and `apps/api` takes React,
Testing Library, axe-core, the router and Query as **`devDependencies` only**. Both apps
already declare `api` as a devDependency (record 006 anticipated exactly this), so the
helper reaches them through a link that has to exist anyway. The cost is that the thin
Hono shell has React in its development graph; the benefit is that the PRD's "one seam"
is genuinely one thing in one place, rather than two helpers that must be kept in
agreement. `devDependencies` are not installed in a production image, and
`apps/api/src/index.ts` does not import either half, so nothing reaches a runtime bundle.

The helper **re-exports what a test needs** — `renderRoute`, `screen`, `within`,
`expectNoAxeViolations`, `assertNoServerImports` — so eleven areas import from one
place and neither application declares Testing Library or axe at all.

**Trigger to split it into a package:** a third consumer, or `apps/api`'s development
graph becoming a problem for its own build. Neither exists today.

### 3. The devDependency boundary is enforced by a test, not by a sentence

Record 006 wrote the rule and admitted it was weaker than the package simply being
absent: `apps/pos` and `apps/backoffice` may take `api` only in `devDependencies`, and
nothing under either app's `src/` may import `api`, `backend`, `hono`, or `@orpc/server`.

Issue 04 asserted the `packages/backend` half by grep at review time. A grep in an
acceptance criterion is run by whoever remembers. The enforceable version is a test, and
it goes in the seam helper so there is one implementation:

```ts
// apps/api/src/test-seam.ts — exported alongside createTestSeam
export function assertNoServerImports(srcDir: string): void;
```

It walks `srcDir` with `node:fs`, matches
`/\bfrom\s+["'](api|backend|hono|@orpc\/server)(\/[^"']*)?["']/`, and throws listing every
offending file and specifier. Each application gets a three-line test calling it with its
own `src`. It runs in `vp run -r test`, which runs on every issue, which is the only
enforcement that actually happens. No dependency: `node:fs` is rung 3.

*(A `no-restricted-imports` lint rule would be smaller still. vite-plus publishes no
documentation for its lint configuration — record 005 established that — so this is the
version that is guaranteed to work. If vite-plus ever documents oxlint rule
configuration, replacing the test with a lint rule is a strict simplification and needs no
new record.)*

### The smaller calls, each settled

**TanStack Query.** `@tanstack/react-query@5.101.4`, a `dependency` of both apps. It
bundles `@tanstack/query-core@5.101.4` at an exact version, which clears
`@orpc/tanstack-query`'s `>=5.80.2` floor (record 006). Its React peer is `^18 || ^19`,
so **it constrains React 19.2.8 not at all** — record 007 had already checked this and it
still holds at the current release. No `@tanstack/react-router-with-query`: that package
exists, but TanStack's own external-data-loading guide wires Router and Query with
`queryClient.ensureQueryData()` in a route loader and names no adapter package. Rung 4.
No devtools packages — both are separate and optional, and nothing asks for them.

**The React plugin.** `@vitejs/plugin-react@6.0.5`, devDependency. Vite's own
rolldown guide is explicit that **`@vitejs/plugin-react-oxc` is deprecated and will no
longer be updated**, because its Oxc React-refresh transform was merged into
`@vitejs/plugin-react` from v5 "so that it is easier to switch to rolldown-vite". Since
`vite-plus-core@0.2.5` bundles Vite `8.1.4` and Rolldown `1.1.5`, the merged plugin is
the supported path and the deprecated one would have been the confidently-wrong answer.
Its peer is `vite: "^8.0.0"` — the cosmetic unmet-peer warning record 007 predicted.

**The DOM environment.** `happy-dom@20.11.1`, devDependency of both apps, selected by
`test: { environment: "happy-dom" }` in each application's **own** `vite.config.ts`. Not
a per-file pragma: eleven areas of test files each needing a magic comment is a rule that
gets forgotten, and a forgotten pragma fails as `document is not defined` rather than as
anything legible. Not `environmentMatchGlobs` either — **that option was removed in
Vitest 4**, and the repository is pinned to `vitest 4.1.10` inside `vite-plus@0.2.5`.
Scoping it per workspace is what keeps `apps/api` and every `packages/*` test on the
`node` environment, so nothing pays for a DOM it does not use. **Nothing here pulls a
second Vitest**: `happy-dom` is a plain package with six runtime dependencies and no
Vitest relationship, and Testing Library has none either.

**Testing Library.** `@testing-library/react@16.3.2` — and `@testing-library/dom@10.4.1`
**must be declared explicitly**, because RTL 16 moved it from `dependencies` to
`peerDependencies`. Both in `apps/api`'s devDependencies, since that is where the helper
lives.

One consequence has to be written down or it will be discovered as flaky tests: **RTL's
automatic cleanup does not run here.** Its documentation says cleanup "is called
automatically if your testing framework … injects a global `afterEach()` function", and
this repository imports its test functions explicitly from `vite-plus/test` rather than
using globals — record 007's contrast test shows the house style. So `test-seam-react.tsx`
registers `afterEach(cleanup)` itself, at module scope, using `afterEach` imported from
`vite-plus/test`. One line, in the one place every render goes through, so no area ever
has to know.

**No `@testing-library/jest-dom`.** Plain Vitest assertions suffice, and the reason is
not frugality. `getByRole` and `getByText` **throw** when nothing matches, so a presence
assertion is already made by the query itself; `toBeInTheDocument()` on a value that
cannot be absent asserts nothing. The matchers that would earn their place are the
layout-aware ones — `toBeVisible` above all — and those are exactly the ones a virtual
DOM cannot answer, for the same documented reason axe cannot check contrast. So the
package buys six transitive dependencies and a setup-file change in exchange for sugar
over `expect(x).toBeTruthy()`. That is rung 6 when rung 3 holds. **Trigger to revisit:**
a real need for `toHaveAccessibleName`, which is the one matcher with genuine logic behind
it — and note that axe already covers the accessible-name rules it would be used for.
No `@testing-library/user-event` either: the shell chrome has one control and
`fireEvent.click` covers it. The first area with a real form should reconsider, and that
is a two-line record, not this one.

### The accessibility assertion — record 007's recommendation confirmed, and made exact

`axe-core@4.12.1` alone. I re-checked the registry: **it declares no runtime
`dependencies` field at all** — zero runtime dependencies, MPL-2.0, which stays the one
non-permissive licence in the front-end tree and is irrelevant for a development-only
tool. `vitest-axe` and `jest-axe` remain rejected for record 007's reasons.

Record 007 said "disable `color-contrast`". That is right but not specific enough for a
reviewer to tell a justified exclusion from a convenient one, so this record fixes the
exact call:

```ts
const results = await axe.run(container, {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  // Disabled because no virtual DOM can evaluate it: there is no layout and no
  // Range API to sample rendered pixels with. Contrast is covered instead by
  // packages/ui/tests/contrast.test.ts over the token pairs.
  rules: { "color-contrast": { enabled: false } },
});
```

Two things about that object are deliberate.

**`runOnly` scoped to the WCAG tags** rather than an unscoped run. Unscoped, axe also
runs its `best-practice` rules, which are not conformance requirements — a failure there
would be a matter of taste presented as a WCAG violation, and `ORC2_A11Y` says
`WCAG 2.2 AA`. The five tag strings are axe's own, read from its API documentation, and
they are cumulative: 2.2 AA conformance requires the 2.0 and 2.1 criteria too, which is
why all five are listed and not just `wcag22aa`.

**Exactly one rule disabled, and one pre-authorised extension.** Deque's own jsdom
example disables `color-contrast` *and* `link-in-text-block` — the second for the same
root cause, since deciding whether a link is distinguishable without colour also needs
resolved colours. I am **not** disabling it up front, because axe reports a rule it cannot
evaluate as *incomplete* rather than as a *violation*, and the assertion is on
`violations`. If `link-in-text-block` does produce a violation under happy-dom, the
implementer adds it to the same `rules` object **with the same comment**, and that is a
pre-authorised extension of this record, not a re-decision. **No other rule may be
disabled without a new record** — that is the line a reviewer checks.

The assertion reads
`expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])` rather than
`toHaveLength(0)`, so a failure prints what is wrong instead of a number.

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Nobody sees a router package. Every option renders the same shell. |
| Business impact | ×1 | Every candidate is free; all MIT except axe-core's MPL-2.0, which is dev-only. |
| Engineering cost and risk | ×2 | Package count, whether it works under an aliased Vite, and the recurring merge cost of a generated file across eleven parallel lanes. |
| Reversibility | ×2 | Eleven areas write routes and tests on top of this. The headline risk. |
| Evidence strength | ×2 | vite-plus documents almost nothing (record 005), and the "fails the build" criterion is the property most likely to be nominally true and mechanically false. Verification carries. |

Maximum possible total: 40. Same shape as record 006, for the same reason.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **File-based routes generated into `src/generated/`, gitignored, regenerated by `codegen` which the gate runs first** | 4 | 4 | 4 (8) | 5 (10) | 4 (8) | **34** |
| 2 | Same set, but commit `src/routeTree.gen.ts` and drop the CLI, the `codegen` change and the gate change | 4 | 4 | 3 (6) | 5 (10) | 3 (6) | **30** |
| 3 | Option 1 plus `@testing-library/jest-dom` and `@testing-library/user-event` | 4 | 3 | 3 (6) | 4 (8) | 3 (6) | **27** |
| 4 | Hand-written code-based route trees — no plugin, no CLI, no generated file | 3 | 3 | 3 (6) | 3 (6) | 3 (6) | **24** |
| 5 | Defer — let issue 06 install what it hits | 1 | 1 | 1 (2) | 5 (10) | 1 (2) | **16** |

**1. Generated, ignored, regenerated by the gate — chosen.** Nine packages across three
workspaces. It is the only option where the headline acceptance criterion is a mechanical
property rather than a claim, and it reaches that using machinery record 005 already built
and issue 03 already proved. It scores 4 rather than 5 on engineering cost because it
genuinely adds a package (`@tanstack/router-cli`), two small config files, and a one-line
gate change; it scores 4 on evidence because the plugin's exact export spelling and
vite-plus's handling of a per-workspace `test` block could not be verified from
documentation and are named below as things to check on contact.

**2. Commit the route tree.** Ranked second and genuinely close — it is TanStack's default
layout, it removes a package and two config files, and a clean clone compiles with no
generation step at all, which is the one thing option 1 has to work for. It loses on two
facts rather than on taste. The PRD already states that generated output lives under a
`generated/` directory; and the tree is an ordered index file, which ORCHESTRATOR.md names
as the conflict case that "merges cleanly and produces the wrong order", once per lane, for
eleven areas. **This is the option to move to** if `tsr generate` turns out not to work
under `vp exec -F`, and the move costs one commit — see the reversal section.

**3. Add the matcher and interaction packages.** Ranked third because it is what most
React projects do, and someone will propose it. It fails the ladder rather than failing on
quality: the queries already throw on absence, and the matchers worth having are the ones
happy-dom cannot answer. Its reversibility drops to 4 because `toBeInTheDocument()` spreads
through test files quickly and removing it later is a find-and-replace across every area.

**4. Code-based route trees.** Taken seriously because it deletes the entire generated-file
question — no plugin, no CLI, no gitignore call, no staleness. It loses because TanStack's
own routing documentation says file-based routing "raises the ceiling on type-safety by
generating and managing type linkages" and that code-based routing is "not recommended for
most applications", with the parent-route linkage maintained by hand. Eleven areas of
hand-maintained route-tree wiring is a per-area tax paid to avoid a per-repository
mechanism, and moving to file-based later rewrites every route file — which is why its
reversibility is 3 and not 5.

**5. Defer.** Included because it must be, and 10 of its 16 points come from
reversibility, which any do-nothing option maximises trivially — the same inflation
records 002, 006 and 007 each left visible. It fails on the facts: issue 06 cannot begin
without these packages, so deferring hands the choice to whoever opens the issue first,
at speed, and issue 07 then inherits it.

## What the implementer does

Exact, so nothing here is re-decided downstream. **Do not edit any manifest on the
strength of this record alone — this is the instruction for issue 06, not a change to
apply now.** Issue 07 applies the `apps/backoffice` rows and nothing else.

### Root `package.json` — the catalog block gains nine lines

```json
"@tanstack/react-router": "1.170.18",
"@tanstack/router-plugin": "1.168.23",
"@tanstack/router-cli": "1.167.21",
"@tanstack/react-query": "5.101.4",
"@vitejs/plugin-react": "6.0.5",
"happy-dom": "20.11.1"
```

*(Six lines. The other three new packages are deliberately un-pinned — see below.)*

### Root `package.json` — `codegen` gains the two route trees

```json
"codegen": "vp exec -F backend prisma generate && vp exec -F pos tsr generate && vp exec -F backoffice tsr generate"
```

`prepare` already runs `vp run -w codegen`, so a clean clone is covered with no further
change. **Issue 06 adds the `pos` clause; issue 07 adds the `backoffice` clause.** Adding
both in issue 06 would make `codegen` fail until issue 07 lands.

### `.orc2/config.env` line 14

```
ORC2_GATE="vp run -w codegen; vp check; vp run -r check; vp run -r test"
```

This is the line that makes "a link to a removed route fails the build" true rather than
claimed. It is the same string record 005 pre-vetted as its fallback, so it is not a new
shape.

### Per workspace — every line, explicitly

| Workspace | Package | Version | Section | Catalog? |
| --- | --- | --- | --- | --- |
| `apps/pos` | `@tanstack/react-router` | `catalog:` → `1.170.18` | `dependencies` | yes |
| `apps/pos` | `@tanstack/react-query` | `catalog:` → `5.101.4` | `dependencies` | yes |
| `apps/pos` | `@tanstack/router-plugin` | `catalog:` → `1.168.23` | `devDependencies` | yes |
| `apps/pos` | `@tanstack/router-cli` | `catalog:` → `1.167.21` | `devDependencies` | yes |
| `apps/pos` | `@vitejs/plugin-react` | `catalog:` → `6.0.5` | `devDependencies` | yes |
| `apps/pos` | `happy-dom` | `catalog:` → `20.11.1` | `devDependencies` | yes |
| `apps/pos` | `api` | `workspace:*` | **`devDependencies`** | n/a |
| `apps/backoffice` | *(identical to `apps/pos`, in issue 07)* | | | |
| `apps/api` | `@testing-library/react` | `16.3.2` | `devDependencies` | **no** |
| `apps/api` | `@testing-library/dom` | `10.4.1` | `devDependencies` | **no** |
| `apps/api` | `axe-core` | `4.12.1` | `devDependencies` | **no** |
| `apps/api` | `react` | `catalog:` → `19.2.8` | `devDependencies` | yes |
| `apps/api` | `react-dom` | `catalog:` → `19.2.8` | `devDependencies` | yes |
| `apps/api` | `@types/react` | `catalog:` → `19.2.18` | `devDependencies` | yes |
| `apps/api` | `@types/react-dom` | `catalog:` → `19.2.4` | `devDependencies` | yes |
| `apps/api` | `@tanstack/react-router` | `catalog:` → `1.170.18` | `devDependencies` | yes |
| `apps/api` | `@tanstack/react-query` | `catalog:` → `5.101.4` | `devDependencies` | yes |

Already settled elsewhere and unchanged, listed so nothing is missed: both apps carry
`react`, `react-dom`, `ui`, `contract`, `@orpc/tanstack-query` in `dependencies` and
`tailwindcss`, `@tailwindcss/vite`, `@types/react`, `@types/react-dom`, `vite-plus`,
`typescript`, `tsconfig`, `@types/node` in `devDependencies`.

`apps/api`'s `tsconfig.json` gains `"jsx": "react-jsx"`, because one `.tsx` file now lives
under its `src/`.

### Which packages get a catalog pin, and which do not

Applying records 002/004's *pin once, use many*, with record 006's lockstep condition.

**Pinned:**

- **`@tanstack/react-router`, `@tanstack/react-query`.** Three declarers each — both apps
  and `apps/api`'s dev graph. They pass on count, and two copies of either is a runtime
  break rather than duplication: both keep module-level state (a router registry, a query
  cache) that a second copy does not share.
- **`@tanstack/router-plugin`, `@tanstack/router-cli`.** Two declarers each, and — the
  stronger reason — they are a **lockstep family with the router**, which is record 006's
  `@orpc/*` condition rather than the count. Verified from the registry: at these three
  versions the plugin and `@tanstack/react-router` both resolve
  `@tanstack/router-core@1.171.15`, and the plugin and the CLI both resolve
  `@tanstack/router-generator@1.167.21`. That shared generator is exactly what makes the
  Vite plugin and `tsr generate` write **the same file the same way**. Bump one of the
  three and the two generation paths diverge, which presents as a route tree that changes
  depending on which command last ran — a failure that is invisible in git because the
  file is ignored. **The three move together or not at all.**
- **`@vitejs/plugin-react`, `happy-dom`.** Two declarers each, passing on count.

**Not pinned — exact version inline, one declaring workspace:**

- **`@testing-library/react`, `@testing-library/dom`, `axe-core`.** This is `pg`'s
  situation from record 004 and `hono`'s from record 006, and it gets their answer. All
  three exist to serve the render seam, the render seam lives only in `apps/api`, and no
  application declares them because the helper re-exports what tests need. **Trigger to
  revisit:** a second workspace declaring any of them — and treat that need as evidence
  that a second render harness was built outside the seam, which is the failure issue 07
  exists to catch, and check *that* before adding the pin.

**Licences, checked at the registry:** MIT for `@tanstack/react-router`,
`@tanstack/router-plugin`, `@tanstack/router-cli`, `@tanstack/react-query`,
`@tanstack/query-core`, `@vitejs/plugin-react`, `happy-dom`, `@testing-library/react`,
and `@testing-library/dom`. **MPL-2.0** for `axe-core` — file-level copyleft, dev-only,
already noted by record 007. No copyleft reaches a shipped bundle.

### The route generator's configuration — written twice, on purpose

`apps/pos/tsr.config.json` (and the same file in `apps/backoffice`):

```json
{ "generatedRouteTree": "./src/generated/routeTree.gen.ts" }
```

`routesDirectory` is left at its default, `./src/routes`, which is where ADR-0009 already
puts route files. The root route file **must** be named `src/routes/__root.tsx`.

The same value is **also** passed inline to the Vite plugin. That is deliberate
duplication and here is why: `@tanstack/router-generator`'s `getConfig` reads
`tsr.config.json` from the config directory and merges inline options *over* it
(`{ ...fileConfigRaw, ...inlineConfig }`), which I read from its source. Whether the Vite
plugin routes through that same `getConfig` **I could not verify** — its documentation
shows inline options only. Writing the value in both places is correct under either
answer, and costs one string. **No-go: there is no third place.** If the two ever
disagree, the CLI and the plugin write different files and the symptom is a route tree
that flips depending on which command last ran.

### Both applications' `vite.config.ts` — identical

```ts
import { fileURLToPath } from "node:url";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      generatedRouteTree: "./src/generated/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  test: {
    environment: "happy-dom",
    setupFiles: [fileURLToPath(new URL("../../vitest.setup.ts", import.meta.url))],
  },
});
```

Three notes, each of which would otherwise be discovered the hard way:

- **The router plugin must come before the React plugin.** TanStack documents this
  ordering; reversed, the generated tree is transformed before it exists.
- **`setupFiles` is re-declared** rather than inherited from the root config. Whether a
  workspace `test` block merges with or shadows the root's is not documented by vite-plus.
  Re-declaring is correct if it shadows, and harmless if it merges — the root
  `vitest.setup.ts` only reads `.env` into `process.env`, which is idempotent.
- **The exact export name of the plugin (`tanstackRouter`) should be read from the
  package's own types at install.** It has been renamed once historically. The decision
  does not depend on the spelling, and a rename is not a reason to reopen this record.
- **`autoCodeSplitting` is deliberately off.** One route exists. Nothing measures bundle
  size until `release-ops`, and the option adds a Babel pass. Rung 1.

### The router registration, and the committed proof of the criterion

`apps/pos/src/router.ts` builds the router from the generated tree and registers it —
**the `declare module` block is what makes `Link`'s `to` a typed union**, and without it
every link accepts any string and the acceptance criterion is silently false:

```ts
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./generated/routeTree.gen";

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

`apps/pos/tests/typed-routes.types.ts` — committed, and the shape issue 04 established:

```ts
import type { LinkProps } from "@tanstack/react-router";

import "../src/router";

// If this directive ever becomes UNUSED, `to` has stopped being a typed union and
// issue 06's "a link to a removed route fails the build" criterion has silently
// regressed. The gate then goes red, which is the direction we want it to fail in.
// @ts-expect-error - "/__no-such-route" is not a registered route path
const _brokenLink: LinkProps = { to: "/__no-such-route" };
```

`apps/backoffice` gets the identical pair in issue 07.

### The seam helper's public surface

`apps/api/src/test-seam-react.tsx`, documented for the next area rather than for this
issue, exporting exactly:

- `renderRoute(options)` — builds a router over the app's own route tree, wraps it in a
  `QueryClientProvider` whose oRPC client's `fetch` is `createTestSeam()`'s
  `app.request`, renders it, and returns the container plus the seam's `db`. **The
  `QueryClient` is constructed per render with `retry: false`**, so a failing query
  surfaces its error state in one tick instead of retrying three times against a
  deliberately-broken database and timing the test out.
- `expectNoAxeViolations(container)` — the axe call specified above.
- `assertNoServerImports(srcDir)` — the boundary test.
- Re-exports of `screen`, `within`, `fireEvent`, `waitFor` from
  `@testing-library/react`.
- Module-scope `afterEach(cleanup)`.

### No-gos

- **No second Vitest.** Nothing added here declares or peers on `vitest`; the only copy
  is the one inside `vite-plus@0.2.5` (`4.1.10`). If `vitest` ever appears as a
  top-level key in `bun.lock`, stop and treat it as a defect.
- **No `jsdom`.** The PRD names happy-dom. The only sanctioned exception is record 007's
  named fallback — a per-file `// @vitest-environment jsdom` on the single test file, if
  axe crashes under happy-dom — and taking it requires installing `jsdom` and noting it
  on the issue.
- **No import of `api`, `backend`, `hono`, or `@orpc/server` from anything under
  `apps/*/src/`.** Enforced by `assertNoServerImports`, not by review.
- **`api` never appears in either application's `dependencies`.**
- **No `routeTree.gen.ts` committed**, and no `generatedRouteTree` value outside the two
  places named above.
- **No axe rule disabled** beyond `color-contrast`, and `link-in-text-block` only under
  the pre-authorised extension above. Anything else needs a new record.
- **No `@testing-library/jest-dom`, no `@testing-library/user-event`, no `vitest-axe`,
  no `jest-axe`, no `@tanstack/react-router-with-query`, no devtools packages.**
- **No `@vitejs/plugin-react-oxc`** — deprecated by Vite, superseded by
  `@vitejs/plugin-react` v5+.

### Expected install warnings, none of which are defects

Three unmet-peer warnings, all with the same cause record 007 already diagnosed: the
repository resolves `vite` to `npm:@voidzero-dev/vite-plus-core@0.2.5`, whose *declared*
version is `0.2.5` while it *bundles* Vite `8.1.4`.

- `@tailwindcss/vite@4.3.3` — peer `vite "^5.2.0 || ^6 || ^7 || ^8"` (already expected)
- `@vitejs/plugin-react@6.0.5` — peer `vite "^8.0.0"`
- `@tanstack/router-plugin@1.168.23` — peer `vite ">=5.0.0 || >=6.0.0 || >=7.0.0 || >=8.0.0"`, marked optional

## How to turn it back

Three layers with different costs, stated separately because one number would be
dishonest.

**Layer 1 — the generated-vs-committed route tree. One commit, permanently.**

This is the part of the record most likely to need reversing, so it is made cheap on
purpose. To move to option 2:

1. Write a superseding record; flip this record's `Status:` to `overturned` with the date
   and reason; update both lines in `LOG.md`.
2. Change `generatedRouteTree` to `"./src/routeTree.gen.ts"` in the two `tsr.config.json`
   files and the two `vite.config.ts` files; update the one import in each
   `src/router.ts`.
3. Run `vp run -w codegen`, then `git add -f` the two generated files.
4. Drop `@tanstack/router-cli` from both apps and the catalog; drop the two `tsr generate`
   clauses from the root `codegen` script; restore `ORC2_GATE` to
   `"vp check; vp run -r check; vp run -r test"`.
5. `vp install`, commit the regenerated `bun.lock`, re-run the gate.

**This does not get more expensive with time.** The number of route files does not change
the work — it is four config values, one script, one gate line, and two `git add -f`s.
Reversibility 5, and it is honestly 5.

**Layer 2 — the packages themselves. Bounded, and the bound is the seam.**

1. Count the real cost first. `rg -l 'from "@tanstack/' apps` is the number that grows —
   after eleven areas it is one `src/routes/**` tree and one `__common/queries.ts` per
   feature. `rg -l 'test-seam' apps packages` is the number that **does not** grow past
   one per test file, because every render goes through the one helper.
2. Swap the catalog lines and the workspace manifests in the table above; `vp install`;
   commit `bun.lock`.
3. Rewrite `apps/api/src/test-seam-react.tsx` — **one file** — against the replacement
   render library or accessibility checker. This is the entire reason the helper is one
   file in one place, and it is why swapping `axe-core`, Testing Library, or happy-dom
   costs one file however many areas have shipped.
4. Rewrite route files only if the *router* is what changed. Query and Router are
   independent: replacing `@tanstack/react-query` touches `__common/queries.ts` files and
   no routes; replacing `@tanstack/react-router` touches routes and no queries.
5. Re-run the gate.

**What voids that estimate:** a Testing Library or axe type appearing in an application's
own test files rather than coming through the helper's re-exports, or an application
importing `@testing-library/react` directly. Grep for both before quoting a cost — and
note that both apps not declaring those packages is what makes such an import fail to
resolve, which is the point of the un-pinned single-declarer placement.

**Layer 3 — the gate line. One line, but read this first.**

Restoring `ORC2_GATE` is a one-value edit. **Do not do it without replacing the
mechanism**, exactly as record 005 says of its own scripts: reverting returns the
repository to a state where the headline acceptance criterion of issue 06 is no longer
enforced, and the failure is silent — a green gate on a broken link.

**What is not touched by any layer:** no migration, no schema, no handler, no contract,
no `packages/ui` token. Nothing on the server side of this repository, and nothing in the
shared theme, knows any of these packages exist.

## What would make this decision wrong

- **`tsr generate` does not run under `vp exec -F <workspace>`.** vite-plus documents no
  `-F` behaviour at all (record 005), so this rests on `vp exec -F backend prisma
  generate` already working in this repository rather than on documentation. Symptom:
  `codegen` fails with a missing binary or generates into the wrong directory. **Fallback,
  pre-decided so nobody reopens this:** take option 2 — commit the tree at its default
  path — using the five steps above. Note which branch was taken on issue 06.
- **A per-workspace `test` block shadows the root `vite.config.ts` in a way that breaks
  something other than `setupFiles`.** The re-declaration above covers the one known
  interaction. Symptom would be an environment variable missing in an app test.
- **axe crashes under happy-dom** on the three-year-old `isConnected` issue record 007
  found still open. Resolution is that record's named one-line environment directive, not
  a change here.
- **`link-in-text-block` reports a violation rather than an incomplete.** Pre-authorised
  extension above; not a re-decision.
- **The route-tree union stops being narrow.** If a `@tanstack/*` upgrade ever types
  `to` as `string`, `typed-routes.types.ts` goes red on an unused `@ts-expect-error`
  directive — which is the designed behaviour, not a break. Re-check on every router
  upgrade, the same standing instruction record 006 attached to `implement()`.
- **The three `@tanstack/router*` versions drift apart.** They share
  `@tanstack/router-generator`, and a mismatch makes the plugin and the CLI write
  different route trees. Because the file is gitignored, git will not show you this.
  Symptom: a typecheck result that depends on which command ran last. Bump all three or
  none.
- **A second copy of `react`, `@tanstack/react-router`, or `@tanstack/react-query`
  appears in `bun.lock`.** Each presents as a runtime break — a hook dispatch error, a
  router with no registered routes, a query cache that never resolves — never as an
  install error. This is what the catalog pins exist to prevent.
- **`apps/api`'s development graph becomes a problem** — a slow install, or a build that
  cannot tree-shake the React files out. That is the trigger to split the render half into
  its own workspace, and it is a re-scoring of one section, not of this record.

## Evidence

**Repository, read 2026-08-02:**

- `.scratch/foundation/issues/06-terminal-shell-and-test-seam.md` — every criterion this
  record answers, the seam quoted verbatim, the shell-chrome-only scope, and the carried-
  forward Tailwind burden. `.../07-backoffice-shell.md` — "consume it unchanged", "a
  second copy of the test setup is the failure this issue exists to catch", and "no
  app-specific test scaffolding". `.../04-ping-contract-api-health-cors.md` — closed;
  `createTestSeam(options?) => { app, client, db }` at `apps/api/src/test-seam.ts`, living
  in `src/` specifically so the apps can import it cross-workspace, and
  `apps/api/tests/router-contract.types.ts`, the committed `@ts-expect-error` fixture this
  record copies.
- `.scratch/foundation/PRD.md` — "The one seam" under Testing Decisions, quoted verbatim;
  "Generated output lives under a `generated/` directory and is matched by
  `ORC2_GENERATED_PATHS`" (the sentence that decides the route-tree question); story 32
  ("a link to a removed route fails the build"); the ten-workspace layout that ruled out an
  eleventh; "Service workers, IndexedDB and offline behaviour … deliberately not tested
  here".
- `docs/adr/0009-frontend-module-structure.md` — `src/routes/` as the route directory,
  `__common/queries.ts` as the query home, and **rule 6**, which is what rules out putting
  the render helper in `apps/pos`. `docs/adr/0008-backend-module-structure.md` — the
  transport boundary the `assertNoServerImports` check protects.
- `.scratch/decisions/005-prisma-command-scope-and-env.md` — the root `codegen` script,
  the `prepare` hook, and the pre-vetted `ORC2_GATE` string with `codegen` prepended. This
  record reuses all three rather than inventing a mechanism.
  `.../006-rpc-and-validation-dependencies.md` — the `>=5.80.2` Query floor, the lockstep
  catalog condition, and the `api`-as-devDependency rule this record makes enforceable.
  `.../007-shared-ui-dependency-set.md` — React 19.2.8, the `axe-core`-alone
  recommendation, the contrast/virtual-DOM finding, the `:focus-visible` rule, and the
  predicted `@vitejs/plugin-react` peer warning. `.../002` and `.../004` — the catalog
  pin-once-use-many test and the single-declarer precedent.
- `.orc2/config.env` — line 14 `ORC2_GATE`, line 15 `ORC2_GENERATED_PATHS="**/generated/**"`,
  line 2 `ORC2_A11Y="WCAG 2.2 AA"`. Confirmed by search that `ORC2_GATE` appears in this
  file only, so the gate change is a one-line edit. `.orc2/ORCHESTRATOR.md` — "Generated
  files — regenerate, never hand-merge. Ordered barrels and index files are the dangerous
  case: they merge cleanly and produce the wrong order", which is the merge argument above.
- Root `package.json` — the current `catalog` and `scripts` blocks, `overrides.vite`.
  `.gitignore` line 11 `**/generated/**` — **no change needed**, it already covers
  `src/generated/routeTree.gen.ts`. `vite.config.ts` — the root `test.setupFiles` this
  record re-declares. `apps/pos/package.json` — the current four devDependencies.
  `packages/ui/{package.json,src/index.ts,src/theme.css}` — issue 05 landed; `Button`,
  `Sheet`, `cn` are the exported surface.
- `.scratch/decisions/` searched for an existing record on TanStack Router, TanStack
  Query, happy-dom, Testing Library, or axe before deciding: 001–007 only. Record 007
  *recommends* `axe-core` for issue 06 but does not decide the set. **No duplicate.**

**External, primary sources, accessed 2026-08-02.** Registry metadata read from
`registry.npmjs.org/<pkg>/latest` unless a version is named:

- `@tanstack/react-router` **1.170.18**, MIT; peers `react`/`react-dom`
  `">=18.0.0 || >=19.0.0"`; depends on `@tanstack/router-core@1.171.15`,
  `@tanstack/history@1.162.0`, `@tanstack/react-store`, `isbot`.
- `@tanstack/router-plugin` **1.168.23**, MIT; `exports` includes **`./vite`**; peers
  `vite ">=5.0.0 || >=6.0.0 || >=7.0.0 || >=8.0.0"` (optional), `webpack` (optional),
  `@tanstack/react-router "^1.170.18"` (optional); depends on
  `@tanstack/router-core@1.171.15`, **`@tanstack/router-generator@1.167.21`**,
  `@tanstack/router-utils`, `unplugin@^3`, `chokidar@^5`, `zod@^4.4.3`, and three `@babel/*`
  packages.
- `@tanstack/router-cli` **1.167.21**, MIT; `bin` is `bin/tsr.cjs`; depends on
  **`@tanstack/router-generator@1.167.21`**, `yargs`, `chokidar`. **The shared generator
  version across plugin and CLI is the lockstep evidence.**
- `@tanstack/react-query` **5.101.4**, MIT; depends on `@tanstack/query-core@5.101.4`
  exactly; peer `react "^18 || ^19"`. `@tanstack/query-core` **5.101.4**, MIT, no runtime
  dependencies.
- `@vitejs/plugin-react` **6.0.5**, MIT; peer `vite "^8.0.0"`.
  `@vitejs/plugin-react-oxc` **0.4.3**, MIT; peer `vite "^6.3.0 || ^7.0.0"`; **deprecated**.
- `happy-dom` **20.11.1**, MIT; dependencies `ws`, `entities`, `whatwg-mimetype`,
  `buffer-image-size` and three `@types/*`; `engines.node >= 20.0.0`. **No relationship to
  vitest.** (`jsdom` **30.0.1**, MIT, checked for comparison only and not installed.)
- `@testing-library/react` **16.3.2**, MIT; dependency `@babel/runtime` only;
  **`peerDependencies` include `@testing-library/dom "^10.0.0"`** — the fact that forces an
  explicit declaration — plus `react`/`react-dom` `"^18.0.0 || ^19.0.0"` and the two
  `@types` packages as optional peers. `@testing-library/dom` **10.4.1**, MIT.
- `@testing-library/jest-dom` **7.0.0**, MIT; six runtime dependencies
  (`redent`, `aria-query`, `css.escape`, `picocolors`, `@adobe/css-tools`,
  `dom-accessibility-api`); documented Vitest setup is a setup file importing
  `@testing-library/jest-dom/vitest`. **Checked and not installed.**
- `axe-core` **4.12.1**, MPL-2.0; **the `dependencies` field is absent entirely** — zero
  runtime dependencies; `main` is `axe.js`.
- `@tanstack/react-router-with-query` **1.130.17**, MIT — exists, checked, **not
  installed**. `@tanstack/react-router-devtools` **1.167.0** and
  `@tanstack/react-query-devtools` **5.101.4**, both MIT, both optional, **not installed**.
- `@voidzero-dev/vite-plus-core` **0.2.5** bundles `vite 8.1.4` and `rolldown 1.1.5`;
  `vite-plus` **0.2.5** carries `vitest 4.1.10` in its own dependencies. **This is the
  constraint that nothing may pull a second Vitest**, and nothing above does.

**Documentation and source:**

- <https://tanstack.com/router/latest/docs/api/file-based-routing> — `generatedRouteTree`:
  "the path to the file where the generated route tree will be saved, relative to the cwd
  (current working directory)"; defaults `./src/routes` and `./src/routeTree.gen.ts`.
- <https://github.com/TanStack/router> `packages/router-generator/src/config.ts` — read
  directly: `resolveConfigPath` returns `path.resolve(configDirectory, 'tsr.config.json')`,
  `configDirectory` defaults to `process.cwd()`, and merging is
  `{ ...fileConfigRaw, ...inlineConfig }` — **inline wins**. This is why the value is
  written in both places.
- <https://raw.githubusercontent.com/TanStack/router/main/packages/router-plugin/src/core/router-generator-plugin.ts>
  — the generation hooks: `watchChange`, `vite: { configResolved }`, plus webpack/rspack
  equivalents. **`configResolved` is why Vitest regenerates at startup and `vp check` does
  not**, which is the whole reason the gate changes.
- `packages/router-cli/src/generate.ts` — `catch (err) { console.error(err); process.exit(1) }`.
  `tsr generate` fails loudly and needs no server and no network.
- <https://tanstack.com/router/latest/docs/framework/react/guide/type-safety> — the
  `declare module '@tanstack/react-router' { interface Register { router: typeof router } }`
  registration that typed links depend on.
- <https://tanstack.com/router/latest/docs/framework/react/routing/code-based-routing> —
  file-based routing "raises the ceiling on type-safety by generating and managing type
  linkages"; code-based routing is "not recommended for most applications". The basis for
  option 4's score.
- File naming: "The root route file must be named `__root.tsx` and must be placed in the
  root of the configured `routesDirectory`."
- <https://tanstack.com/router/latest/docs/guide/external-data-loading> — Router and Query
  are wired with route loaders and `queryClient.ensureQueryData()`; no adapter package is
  named. The basis for excluding `@tanstack/react-router-with-query`.
- <https://v7.vite.dev/guide/rolldown> — "we have merged the implementation into
  @vitejs/plugin-react so that it is easier to switch to rolldown-vite.
  **@vitejs/plugin-react-oxc is now deprecated and will no longer be updated.**"
- <https://vitest.dev/config/environment.html> — `test.environment: 'happy-dom'`, the
  package must be installed separately, and the `// @vitest-environment happy-dom`
  docblock form. <https://vitest.dev/guide/migration.html> — **`environmentMatchGlobs` was
  removed in Vitest 4**, replaced by `projects`.
- <https://testing-library.com/docs/react-testing-library/api#cleanup> — cleanup "is
  called automatically if your testing framework (such as mocha, Jest or Jasmine) injects
  a global `afterEach()` function into the testing environment"; otherwise "you will need
  to call `cleanup()` after each test". The basis for the module-scope `afterEach(cleanup)`.
- <https://github.com/dequelabs/axe-core/blob/develop/doc/API.md> — `axe.run(context,
  options)`; `{ rules: { 'color-contrast': { enabled: false } } }`;
  `{ runOnly: { type: 'tag', values: [...] } }`; and the tag strings `wcag2a`, `wcag2aa`,
  `wcag2aaa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, `experimental`.
- <https://github.com/dequelabs/axe-core/blob/develop/doc/examples/jest_react/README.md>
  (via record 007) — "to work better with JSDOM … the color-contrast and
  link-in-text-block rules have been disabled". The basis for the pre-authorised extension.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **TanStack does not document a position on committing `routeTree.gen.ts`.** One research
  pass reported an FAQ sentence saying it should be committed; a second pass could not
  reproduce it and found no page stating a position either way. Recorded honestly: the
  decision rests on this repository's own convention and merge model, not on a TanStack
  recommendation, and a reader who finds that FAQ sentence has found a real argument for
  option 2.
- **TanStack does not document the exact TypeScript error for a link to a removed route.**
  The type-safety page states that `to` is type-checked; it does not quote the failure.
  That is precisely why the property is pinned by a committed `@ts-expect-error` fixture
  rather than by a sentence in this record.
- **Whether `@tanstack/router-plugin/vite` reads `tsr.config.json` could not be
  established** — the docs show inline options only, and the plugin's call into
  `getConfig` was not confirmed in source. Handled by writing the value in both places,
  which is correct under either answer.
- **vite-plus publishes no documentation** for React support, per-workspace `vite.config.ts`
  semantics, whether a workspace `test` block merges with or shadows the root's, or lint
  rule configuration. Record 005 found the same gap for `vp exec -F` and `vp install`
  lifecycle scripts. Every claim above that depends on vite-plus behaviour is either
  carried by something already working in this repository or named as a risk with a
  pre-decided fallback.
- **axe-core publishes no list of rules that cannot run in a virtual DOM.** Only the jsdom
  example's two disabled rules exist as evidence, which is why exactly one rule is
  disabled up front and the second is pre-authorised rather than pre-emptive.
