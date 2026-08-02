# 015: A shared component's render test lives with the component, because record 008's seam renders routes and a Badge is not a route

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from issue 14, `.scratch/f14-reskin-shared-parts/`)

## The question

A fixer added four development-only packages to `packages/ui` so it could run a
test that renders a component in a fake browser, and wrote
`packages/ui/tests/badge.test.tsx` to prove a fix for `<Badge asChild>` throwing at
render. No agent may add a dependency on its own, and record 008 deliberately built
**one** place where React components get rendered in tests — inside `apps/api` — so
that no other workspace declares Testing Library. This is a second such place.

So: **where does a `packages/ui` component's render test live, which workspace
declares the tooling to run it, and how is the fake-browser environment turned on for
that test without breaking `contrast.test.ts`, which is the only thing in the whole
repository that checks the colour palette?**

A wrong answer is expensive in the usual eleven-areas way, and specifically: it is the
pattern every future shared component inherits. There are seven such components today
and `sidebar` alone has a state provider, a stored cookie and a keyboard shortcut.

**Not open, and not reopened:** which four packages. Record 008 already chose
`@testing-library/react@16.3.2`, `@testing-library/dom@10.4.1`,
`@vitejs/plugin-react@6.0.5` and `happy-dom@20.11.1`, checked their licences and
their peer ranges, and catalog-pinned two of them. This record does not re-open a
library choice. It decides **who may declare them and where the test file sits.**

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Nobody sees a test file. It is not zero — a render crash is very visible — but three of the four options catch the same class of bug, so it does not separate them. |
| Business impact | ×1 | All four packages are already chosen, already licensed-checked, already in the lockfile. Nothing here separates the options commercially. |
| Engineering cost and risk | ×2 | Whether the thing actually runs under vite-plus, whether the palette check survives, and whether a workspace's own `vp test` covers its own code. |
| Reversibility | ×2 | Seven shared components today and every future one inherits this. The headline risk. |
| Evidence strength | ×2 | vite-plus documents nothing (record 005), and the happy-dom conflict is established from a bug report rather than from documentation. Verification carries. |

Maximum possible total: 40. Same shape as records 006 and 008, for the same reason.

## What I chose, and why

**The four packages stay in `packages/ui`, two of them move to the catalog,
`badge.test.tsx` stays where the fixer put it, and `packages/ui/vite.config.ts`
stays.** The environment is selected by a per-file docblock, exactly as built.

Record 008 is **amended, not overturned** — and so is record 007, on one section
each. Every decision either record made survives. What changes is the reach of two
sentences.

### The fact that decides this, and it is not a preference

Look at what record 008's seam actually exports, and what it has to import to do it:

```
renderRoute, expectNoAxeViolations, assertNoServerImports, screen, within,
fireEvent, waitFor
```

built on `@tanstack/react-router`, `@tanstack/react-query`, `@orpc/tanstack-query`,
`contract`, and `./test-seam.ts` — a live in-process API server with a database.

**Not one of those exports can render a Badge.** `renderRoute` builds a router over
an application's own generated route tree, wraps it in a query provider whose
transport is a real server, and renders that. There is no `render` export at all. To
test `<Badge asChild>` through this seam you would have to either add `render` to it —
a change to the helper that issue 07 says must be consumed "unchanged" — or wrap a
Badge in a route with a database behind it, which is not a test of a Badge.

Record 008's "one render seam" was never a rule about the render *library*. It was a
rule about the *route-rendering harness*: router plus query client plus oRPC client
plus axe, wired once so eleven areas do not each wire it differently. Read its own
list of why the seam could not live in `packages/ui` — "record 007 forbids
`@tanstack/*` imports there." That reason is entirely about the router and the query
client. It says nothing whatever about a bare `render()`.

So the sentence that mattered in 008 — **"neither application declares Testing
Library or axe"** — is still literally true after this record. `apps/pos` and
`apps/backoffice` declare neither. `packages/ui` is not an application; it is the
bottom of the dependency graph, and it is the workspace that owns the components.

### Record 008 told the next agent exactly what to do here, and it was done

This is the part that settles amendment-versus-overturn, so it gets quoting rather
than paraphrase. Record 008, on why Testing Library was left un-pinned:

> **Trigger to revisit:** a second workspace declaring any of them — and treat that
> need as evidence that a second render harness was built outside the seam, which is
> the failure issue 07 exists to catch, and check *that* before adding the pin.

The trigger fired. I ran the check. `packages/ui/tests/badge.test.tsx` is:

```tsx
// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Badge } from "../src/index.ts";

afterEach(cleanup);
```

Seven lines. No router. No query client. No oRPC client. No server. No database. No
axe. **There is no second harness.** There is a call to a library function, in the
workspace that owns the thing being called. Record 008 anticipated this moment and
asked for precisely this check; the check passes, and what follows from it is the pin,
not a refusal.

### The choice is not "one declaration site or two"

This is the argument that ranks the options, and it is worth stating flatly because
the obvious reading of the question gets it backwards.

**Every option that lets shared components have render tests declares Testing Library
somewhere other than `apps/api`.** Consider the only shapes option 3 could take:

- **`packages/ui` imports `apps/api/src/test-seam-react.tsx`.** Dead on two counts.
  Record 007's greppable rule says no file under `packages/ui/` may import
  `contract`, `schemas`, `backend`, `@orpc/*` or `@tanstack/*` — and that file imports
  four of the five, so a `packages/ui` test importing it breaches the rule
  transitively on its first line. Separately, it inverts the dependency graph: ADR-0009
  rule 6 forbids the apps importing each other, and a *package* importing an *app* is
  worse, because `packages/ui` is deliberately the bottom and nothing else in this
  repository points upward.
- **A new workspace holding a bare re-export of Testing Library.** Record 008 already
  rejected an eleventh workspace — it contradicts the PRD's enumerated ten and
  ADR-0001's workspace table, and it needs its own manifest, tsconfig and scripts to
  hold one file. And here is the decisive part: **it still declares the four packages
  somewhere other than `apps/api`.** It moves the second declaration site; it does not
  remove it. An option whose entire purpose is avoiding a second site, and whose only
  workable form has one, is not an option.

So the real question is: **two declaration sites, or no render tests for shared
components.** Once that is visible, keeping what was built is the cheapest of the
two-site answers, and the no-test answer has to survive the next section.

### The no-test option is refuted by the evidence in its own question

`<Badge asChild>` threw at render. It went through a green gate. It then went through
a self-review. Neither caught it. The fixer's **first** attempt at the fix also threw —
`"Slottable to receive a single React element child"` — and the only thing that caught
that was this test.

Record 007 had a reason to expect otherwise, and it is worth naming because it was
reasonable and it turned out to be false:

> The primitives are exercised through the shells' seam tests in issues 06 and 07 …
> `packages/ui` therefore declares no test-environment dependency at all.

That assumed app-level route tests transitively cover the primitives. They cover the
primitives *in the configurations the shells happen to use*. No shell renders a Badge
with `asChild`, so no shell test could have found this, and none did. Seven components
now, several with real behaviour, and eleven areas about to add more: the gap that
assumption leaves grows with every component that ships.

### `badge.test.tsx` stays at `packages/ui/tests/badge.test.tsx`

Beside `contrast.test.ts` and `index.test.ts`, which are already there. Three reasons,
in descending order of how much they matter:

1. **`vp run -F ui test` must cover `packages/ui`.** If the Badge test lives in
   `apps/pos`, a fixer working on a `packages/ui` component runs that workspace's own
   suite, gets green, and ships a broken component. A workspace whose test command does
   not test its own code is worse than a workspace with no test command.
2. **Deleting a component would leave an orphan test in a consumer**, and a
   `packages/ui` change would be reviewed with its test outside the diff.
3. **Neither app should have to know about parts it does not use.** Whichever app you
   picked, the other app's shared-component tests would live in a foreign workspace.

### The environment: a docblock, and the file extension is the rule

`contrast.test.ts` locates the palette with
`fileURLToPath(new URL("../src/theme.css", import.meta.url))`. Under a global
`happy-dom` environment that breaks, and the mechanism is now established rather than
assumed: happy-dom ships its own `URL` implementation which is not compliant with the
platform one, and Vitest issue #3988 reproduces the exact failure —
`"The URL must be of scheme file"` — when a `file://`-based `new URL(...)` runs under
`environment: "happy-dom"`. There is also an open happy-dom issue (#569) confirming its
`URL` mishandles the `base` argument generally. `node:fs` itself is fine; Vitest still
runs in Node and only the DOM globals are swapped. **The break is happy-dom's `URL`,
nothing else.**

So the per-file `@vitest-environment happy-dom` docblock stays, and this is not a
workaround — it is the mechanism record 007 already blessed by name as the sanctioned
per-file escape hatch, and it is first-party documented by Vitest.

Record 008 argued against docblocks, and its argument was right *about the
applications*: "eleven areas of test files each needing a magic comment is a rule that
gets forgotten." In `apps/pos` every test file needs a DOM, so a per-workspace setting
is correct there and stays. `packages/ui` is genuinely the other case — it has a
permanent mix of Node tests (a file read plus arithmetic) and DOM tests — and the
per-workspace setting is what breaks it.

The forgetting risk is real and it is handled by making the environment a property of
something the filesystem already tracks:

> **In `packages/ui/tests/`, `.test.ts` runs under Node and `.test.tsx` runs under
> happy-dom.** Every `.test.tsx` file carries the docblock on its first line, and
> `afterEach(cleanup)` at module scope.

That is a rule a person holds in their head with no config to read, and it is
enforceable by a grep in the house style — the reviewer's check is that both of these
return nothing:

```
rg --files-without-match -g 'packages/ui/tests/*.test.tsx' '^// @vitest-environment happy-dom'
rg --files-without-match -g 'packages/ui/tests/*.test.tsx' 'afterEach\(cleanup\)'
```

`afterEach(cleanup)` is required per-file for the reason record 008 already
established: this repository imports its test functions explicitly from
`vite-plus/test` rather than using globals, so Testing Library's automatic cleanup
never fires. In `apps/api` the seam registers it once at module scope; in
`packages/ui` there is no module every render goes through, so it is one line per
file. **This is deliberately not abstracted into a helper.** One render test file
exists. A three-line `packages/ui/tests/render.ts` is the answer when the fourth one
lands, and it needs no record.

### `packages/ui/vite.config.ts` stays, unchanged

It is needed for `@vitejs/plugin-react`, and it re-declares `setupFiles` for exactly
the reason record 008 gave for the apps — whether a workspace `test` block merges with
or shadows the root's is undocumented, and re-declaring is correct under either answer.
The file the fixer wrote is already right and needs no edit.

**Honest note on `@vitejs/plugin-react`, since the ladder asks.**
`packages/ui/tsconfig.json` already sets `"jsx": "react-jsx"` and already includes
`tests/**/*`, so typechecking the `.tsx` test is covered with no change. Whether
vite-plus's bundled rolldown would *transform* JSX in a test file without the React
plugin **I could not establish** — vite-plus documents nothing. Keeping the plugin
costs one manifest line against a package that is already catalog-pinned and already
installed twice; dropping it risks a transform failure to save nothing. It stays. If a
later reader establishes that the plugin is unnecessary here, removing it is a strict
simplification and needs no new record.

### The two Testing Library packages now get catalog pins

This is the one place the fixer's manifest is wrong, and the repository's own rule
decides it rather than my taste. *Pin once, use many* (records 002, 004, 006, 007,
008) fires at **two declarers** — record 007 pinned `lucide-react` at exactly two, and
record 008 pinned `@vitejs/plugin-react` and `happy-dom` at "two declarers each,
passing on count". `@testing-library/react` and `@testing-library/dom` now have two:
`apps/api` and `packages/ui`.

There is a second reason that is stronger than the count, and it is record 006's
lockstep condition rather than arithmetic. RTL 16 declares `@testing-library/dom` as a
**peer**, so the two move together — and a version skew between the `apps/api` copy
and the `packages/ui` copy means two DOM query implementations with different
`getByRole` semantics in one repository. That presents as a test that passes in one
workspace and fails in the other with no visible cause. One catalog line each makes it
impossible.

`axe-core` does **not** move and does **not** appear in `packages/ui`. See the no-gos.

### Where the accessibility line is drawn, and why it is here

`packages/ui` render tests assert **structure and behaviour**. They do not run axe.

This is not frugality about one more package. axe on an isolated Badge with no
document around it is close to meaningless — a large part of its rule set is about
landmarks, regions, heading order, and page-level relationships that do not exist for a
detached component. The place a page's accessibility can actually be judged is the
route render, which is where `expectNoAxeViolations` already lives, in the seam, with
record 008's exact `runOnly` tag list and its exactly-one-disabled-rule discipline.
Keeping axe in one workspace keeps that discipline in one workspace.

The practical effect is that this record bounds the second declaration site at
**exactly four packages, permanently**. `axe-core` in `packages/ui/package.json` is
the signal that this line has been crossed.

## The options, ranked

Two rankings, because the question is genuinely two questions and answering them on
one table would hide which evidence decided what.

### Where the test lives and who declares the tooling

| Rank | Option | User ×1 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Keep it — `packages/ui` declares the four and owns its render tests** | 4 | 4 | 4 (8) | 5 (10) | 4 (8) | **34** |
| 2 | No render tests for shared components | 1 | 2 | 5 (10) | 5 (10) | 1 (2) | **25** |
| 3 | Move the test into an app and consume record 008's seam | 3 | 3 | 2 (4) | 4 (8) | 3 (6) | **24** |
| 4 | Extend the seam so `packages/ui` can consume it | 3 | 3 | 1 (2) | 2 (4) | 4 (8) | **20** |

**1. Keep what was built — chosen.** Four devDependencies, one config file, two lines
of boilerplate per render test. It scores 4 rather than 5 on engineering cost because
it is honestly a second declaration site and the boilerplate does repeat; it scores 4
rather than 5 on evidence because vite-plus's per-workspace behaviour is still
undocumented and this config file rests on being byte-shaped like the two app configs
that already work. Its reversibility is a genuine 5 and the section below shows the
arithmetic: no file under `packages/ui/src/**` imports any of the four, today or ever.

**2. No render tests for shared components.** Ranked second, which is uncomfortable and
is left visible rather than tuned away — 20 of its 25 points come from engineering cost
and reversibility, which any do-nothing option maximises trivially, the same inflation
records 002, 006, 007 and 008 each chose to show rather than hide. It loses on the two
criteria that carry the actual question. The `asChild` bug shipped through a green gate
*and* a self-review, and the fixer's own first fix attempt threw and was caught only by
this test. `sidebar` ships a state provider, a cookie and a keyboard shortcut. This
option is not "accept slightly less coverage"; it is "the class of bug that just
happened has nothing standing in front of it."

**3. Move the test into an app.** This is the option that honours record 008 literally,
so it had to be scored rather than dismissed, and it is the one a reviewer will
propose. It fails on mechanics before it fails on principle: the seam exports no
`render`, so taking it means editing the helper that issue 07 requires be consumed
unchanged. Then `vp run -F ui test` goes green on a broken `packages/ui` component,
which is the defect that decides its engineering score, and deleting a component leaves
an orphan test in a workspace that never owned it. **This is the option to move to** if
the second declaration site ever causes a concrete problem — and it is cheap to move
to, which is why its reversibility is still 4.

**4. Extend the seam so `packages/ui` consumes it.** Ranked last, and its evidence
score of 4 is *against* it — the evidence is strong and it points one way. The direct
shape breaks record 007's import rule on its first line, because the seam imports
`contract`, `@orpc/tanstack-query`, `@tanstack/react-query` and
`@tanstack/react-router`, and it inverts a dependency graph whose bottom `packages/ui`
deliberately is. The indirect shape — a new workspace — contradicts the PRD's ten
workspaces, contradicts record 008, and **still declares the four packages outside
`apps/api`**, which means it pays the whole cost of a new workspace and does not buy
the thing it exists to buy. Its reversibility of 2 reflects that unwinding a workspace
is manifest, tsconfig, scripts and lockfile.

### How the environment is selected in `packages/ui`

| Rank | Option | User ×1 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Per-file `@vitest-environment happy-dom` docblock; `.test.ts` is Node, `.test.tsx` is DOM** | 4 | 4 | 5 (10) | 5 (10) | 4 (8) | **36** |
| 2 | `test.projects` in `packages/ui/vite.config.ts`, split by filename glob | 4 | 4 | 3 (6) | 4 (8) | 3 (6) | **28** |
| 3 | Global `happy-dom` for the workspace, rework `contrast.test.ts` to survive it | 3 | 4 | 2 (4) | 3 (6) | 2 (4) | **19** |

**1. The docblock — chosen.** Zero configuration, one line per render test, and the
palette check is not touched at all. Vitest documents the control comment and requires
only that it appear before any imports or code. Record 007 already named a per-file
environment directive as its own sanctioned fallback, so this is not a new mechanism in
this repository. It scores 4 on evidence rather than 5 because the placement rule is
documented as "before any imports or code" and no primary source states a stricter
first-line requirement, so the convention above is slightly tighter than the
documentation demands — deliberately, because a rule you can grep is worth more than
the last inch of flexibility.

**2. `test.projects`.** Vitest 4's own named successor to the removed
`environmentMatchGlobs`, and genuinely attractive: it makes the environment a property
of the filename with no line to forget. It loses on two unknowns stacked on each other.
`projects` under vite-plus is undocumented like everything else about vite-plus, and
`projects` entries **do not inherit the parent config by default** — they need
`extends: true` — which puts the root `vitest.setup.ts` at risk of silently not
loading. A missing environment variable in a test is exactly the silent failure record
008 re-declared `setupFiles` to prevent. Two config unknowns to remove one line per
file is rung 6 when rung 3 holds. **It is the pre-decided successor**: if a missing
docblock ever reaches `main` twice, take this and rename the files to
`*.dom.test.tsx`.

**3. Global happy-dom plus reworking `contrast.test.ts`.** The path construction could
be changed to dodge happy-dom's broken `URL`, so this is technically available, and it
is what someone reaching for consistency with the apps will suggest. It loses because
of what it does to the one test that cannot afford it. `contrast.test.ts` is the only
contrast coverage in the entire repository — axe cannot evaluate contrast in a virtual
DOM, which records 007 and 008 both establish — and this option makes it carry a
permanent workaround for a fake browser it does not use, for a defect in that fake
browser's `URL` implementation. It also drags every future Node-only test in
`packages/ui` into a DOM and into the same trap. Its evidence score of 2 is the honest
one: it would be built on the current shape of an upstream bug.

## Record 008 is amended, not overturned — and so is record 007

Stated in each record's own terms, because "amended in passing" is a claim that has to
be checkable.

**Record 008** decided four things. Three are untouched: the generated-and-ignored
route tree with `codegen` in the gate, the `assertNoServerImports` boundary test, and
the axe configuration. The fourth — the render seam — keeps every one of its
conclusions. `apps/api/src/test-seam-react.tsx` remains the single place a **route** is
rendered; `apps/pos` and `apps/backoffice` still declare neither Testing Library nor
axe; the seam is still consumed unchanged. Two sentences narrow:

- "There is one render seam" becomes **"there is one *route* render seam."** A bare
  `render()` of a primitive in the workspace that owns it is not a seam and duplicates
  nothing the seam does — the seam has no `render` export to duplicate.
- The un-pinned single-declarer placement of `@testing-library/react` and
  `@testing-library/dom` ends, **by following record 008's own written trigger**,
  including its instruction to check for a second harness first. That check is recorded
  above and it passed.

Nothing in record 008's reversal sections changes. Its Layer 2 cost estimate gains one
line: swapping the render library now also touches `packages/ui`'s manifest and its
`.tsx` test files, and `rg -l '@testing-library' packages/ui apps` is the number to
quote.

**Record 007** loses exactly one section — "`packages/ui` gets no DOM test
environment" — and it loses it on evidence rather than on taste. Its stated premise was
that "the primitives are exercised through the shells' seam tests", and issue 14 is the
counter-example: no shell renders `<Badge asChild>`, so no shell test could have caught
it. Every other decision in record 007 stands, and one of its rules is confirmed rather
than weakened: **the import ban still applies to test files**, and none of
`@testing-library/react`, `@testing-library/dom`, `@vitejs/plugin-react` or `happy-dom`
is on its list, so `badge.test.tsx` is compliant as written. A reviewer should not flag
it.

Neither record is overturned, because overturning means the earlier decision was wrong
and its outcome is being replaced. Record 008's seam is still there, still one, still
in `apps/api`, still doing exactly what it was built to do.

## What the fixer does

Four concrete changes. Everything else the fixer built is correct and is kept.

### 1. Root `package.json` — the catalog block gains two lines

```json
"@testing-library/react": "16.3.2",
"@testing-library/dom": "10.4.1"
```

Same versions record 008 already chose and licence-checked (both MIT). Nothing is
upgraded here.

### 2. `packages/ui/package.json` — two of the four lines change

```json
"devDependencies": {
  "@testing-library/dom": "catalog:",
  "@testing-library/react": "catalog:",
  "@vitejs/plugin-react": "catalog:",
  "happy-dom": "catalog:"
}
```

The two `catalog:` entries the fixer wrote were already right. The two inline exact
versions become `catalog:`. No package is added and none is removed.

### 3. `apps/api/package.json` — the same two lines become `catalog:`

```json
"@testing-library/react": "catalog:",
"@testing-library/dom": "catalog:"
```

`axe-core: "4.12.1"` stays inline and un-pinned. It still has one declarer and this
record forbids it a second.

### 4. Nothing else

- `packages/ui/vite.config.ts` — **keep as written.** No edit.
- `packages/ui/tests/badge.test.tsx` — **keep where it is.** No edit, no move.
- `packages/ui/tsconfig.json` — no change; `jsx: "react-jsx"` and `include:
  ["src/**/*", "tests/**/*"]` are already correct.
- `packages/ui/tests/contrast.test.ts` — **no change, deliberately.** It stays a Node
  test reading `theme.css` through `import.meta.url`.
- The root `vite.config.ts` and `vitest.setup.ts` — no change.
- `.orc2/config.env` — no change. `ORC2_GATE` is untouched.

Then `vp install`, commit the regenerated `bun.lock`, and run the gate.

**Two things to check in the lockfile diff before committing**, both of which present
as passing tests rather than as install errors:

- `bun.lock` must show **one** `@testing-library/dom` and **one**
  `@testing-library/react`. Two of either is the skew the catalog pin exists to
  prevent.
- `bun.lock` must still show **no top-level `vitest`**. Record 008's standing no-go;
  nothing here should touch it, but this is the change that would.

### The rule the reviewer checks

> In `packages/ui/tests/`, `.test.ts` runs under Node and `.test.tsx` runs under
> happy-dom. Every `.test.tsx` file opens with `// @vitest-environment happy-dom` and
> registers `afterEach(cleanup)` at module scope.

Both greps in the section above return nothing when this holds.

### No-gos

- **No `axe-core` in `packages/ui`.** Accessibility assertions are made against a
  rendered route through the seam's `expectNoAxeViolations`, never against a detached
  component. This is the line that keeps the second declaration site at four packages.
- **No `@tanstack/*`, `@orpc/*`, `contract`, `schemas`, `backend`, or `api` in any file
  under `packages/ui/`** — including test files. Record 007's rule, restated because
  this record is the reason someone might think it had loosened. It has not.
- **No import of `apps/api/src/test-seam-react.tsx` from `packages/ui`.** It is the
  same rule as above and it is the specific mistake this record exists to close off.
- **No global `test.environment` in `packages/ui/vite.config.ts`.** It breaks the only
  contrast check in the repository.
- **No render harness in `packages/ui`** — no router, no query client, no server, no
  provider tree, no `renderRoute` equivalent. A `packages/ui` test calls `render` on a
  component and asserts on the result. Anything more is the failure record 008 named,
  and it means the component is not a primitive.
- **No second `@testing-library/*` version.** They are a lockstep pair; RTL declares
  the DOM package as a peer.
- **No `@testing-library/jest-dom`, no `@testing-library/user-event`, no `jsdom`.**
  Record 008's no-gos, unchanged and inherited by `packages/ui`.

## How to turn it back

Three separable reversals, costed separately because one number would be dishonest.

**Layer 1 — the whole decision, back to no render tests in `packages/ui`. One commit,
and it stays one commit.**

1. Write a superseding record; flip this record's `Status:` to `overturned` with the
   date and reason; update both lines in `LOG.md`.
2. Delete every `packages/ui/tests/*.test.tsx`. Today that is one file.
3. Delete `packages/ui/vite.config.ts`.
4. Remove the four `devDependencies` lines from `packages/ui/package.json`.
5. Move `@testing-library/react` and `@testing-library/dom` back from the root catalog
   to inline exact versions in `apps/api/package.json`; delete the two catalog lines.
6. `vp install`, commit `bun.lock`, run the gate.

**This does not get more expensive with time, and the reason is structural rather than
optimistic:** no file under `packages/ui/src/**` imports any of the four packages, and
none ever can — they are `devDependencies` of a package whose runtime surface is
components. The number that grows is `ls packages/ui/tests/*.test.tsx`, and each of
those files is self-contained and deleted independently. `rg -l '@testing-library'
packages/ui` is the exact cost, measurable at any moment. **Reversibility 5, and it is
honestly 5.**

**Layer 2 — move to option 3 instead (tests live in an app). Bounded by the number of
test files.**

1. Do steps 1, 3, 4 and 5 above.
2. Add `render` to `apps/api/src/test-seam-react.tsx`'s re-exports — one line, and note
   that this is the change issue 07's "consume it unchanged" was written against, so it
   needs saying on the issue.
3. Move each `packages/ui/tests/*.test.tsx` into `apps/pos/tests/` or
   `apps/backoffice/tests/`, repointing `../src/index.ts` to `ui`.
4. `vp install`, commit `bun.lock`, run the gate.

**What voids that estimate:** a `packages/ui` test importing something from
`packages/ui/src/` that is not exported from `src/index.ts`. Grep for relative imports
that are not `../src/index.ts` before quoting a cost.

**Layer 3 — just the environment mechanism, to `test.projects`. One commit, N renames.**

Rename `packages/ui/tests/*.test.tsx` to `*.dom.test.tsx`, delete the docblocks, and
add to `packages/ui/vite.config.ts`:

```ts
test: {
  projects: [
    { extends: true, name: "node", include: ["tests/**/*.test.ts"], environment: "node" },
    { extends: true, name: "dom", include: ["tests/**/*.dom.test.tsx"], environment: "happy-dom" },
  ],
},
```

`extends: true` is not optional — without it the root `vitest.setup.ts` does not load
and the failure is a missing environment variable, not an error.

**What has been built on top of this record by the time any of the above runs:** test
files only. No product source file, no token, no schema, no migration, no contract, and
no handler knows this decision exists.

## What would make this decision wrong

- **A `packages/ui` render test starts needing a router, a query client, a provider
  tree, or a server.** This is the single most likely way this record quietly stops
  being true, and it is the second harness record 008 feared. The answer is **not** to
  build one in `packages/ui`. It is that the component under test is not a primitive
  and belongs in an application feature, where the seam already renders it properly.
  Treat the first such test as a design signal about the component, not as a gap in
  this record.
- **`axe-core` appears in `packages/ui/package.json`.** The four-package bound has been
  crossed and the accessibility discipline record 008 wrote now has two homes. Stop and
  route it back.
- **A `.tsx` test lands in `packages/ui/tests/` without the docblock or without
  `afterEach(cleanup)`.** Once is a grep nobody ran. Twice means the convention does not
  survive contact and the pre-decided answer is Layer 3 — `test.projects`, no new
  record needed.
- **Two `@testing-library/dom` or two `@testing-library/react` versions appear in
  `bun.lock`.** This never presents as an install error. It presents as a test that
  passes in one workspace and fails in the other, with different `getByRole` behaviour
  and no visible cause. The catalog pins added by this record are what prevent it.
- **vite-plus does not honour a per-workspace `vite.config.ts` in `packages/ui` the way
  it does in the apps.** Symptom: the React plugin not applying, so JSX in
  `badge.test.tsx` fails to transform. Unverifiable from documentation, because
  vite-plus publishes none; it rests on the two app configs of the same shape already
  working.
- **happy-dom fixes its `URL` implementation.** This changes nothing — the docblock
  stays correct, and the Node/DOM split in `packages/ui` is about what each test needs,
  not about a bug. It only removes one of the reasons the global setting was rejected.
- **The fourth render test file lands** and the two boilerplate lines have become rot.
  That is the trigger for a three-line `packages/ui/tests/render.ts` holding
  `afterEach(cleanup)` and a re-export of `render`. It needs no record, and it is not a
  second seam — the docblock still cannot live there, because the environment is
  necessarily per-file.

## Evidence

**Repository, read 2026-08-02, in the worktree
`.worktrees/f14-reskin-shared-parts`:**

- `.scratch/decisions/008-frontend-application-dependency-set.md` — the one-seam
  section quoted verbatim above, including its four reasons the seam could not live
  elsewhere and its "Trigger to revisit: a second workspace declaring any of them"
  instruction, which this record follows rather than overrides; the `environment:
  "happy-dom"` per-app placement and the argument against per-file pragmas; the
  `environmentMatchGlobs`-removed note; the RTL-auto-cleanup finding; the
  no-second-Vitest no-go.
- `.scratch/decisions/007-shared-ui-dependency-set.md` — the greppable import ban that
  rules out option 4's direct shape; the "`packages/ui` gets no DOM test environment"
  section this record amends and its stated premise; the per-file
  `// @vitest-environment` directive named as its own sanctioned fallback; the
  pin-once-use-many test applied at two declarers for `lucide-react`; the finding that
  axe cannot evaluate contrast in a virtual DOM, which is what makes
  `contrast.test.ts` the only contrast coverage in the repository.
- `.scratch/decisions/006-rpc-and-validation-dependencies.md` — the lockstep-family
  condition for a catalog pin, applied here to the RTL peer pair.
  `.../004-postgres-driver.md` — the single-declarer no-pin precedent this record ends
  for the two Testing Library packages.
- `apps/api/src/test-seam-react.tsx` — read for its import list
  (`@orpc/tanstack-query`, `@tanstack/react-query`, `@tanstack/react-router`,
  `@testing-library/react`, `axe-core`, `contract/src/index.ts`, `./test-seam.ts`) and
  its exports (`renderRoute`, `expectNoAxeViolations`, `assertNoServerImports`,
  `fireEvent`, `screen`, `waitFor`, `within`). **There is no `render` export**, which
  is the fact that decides option 3 on mechanics. The import list is what makes a
  `packages/ui` consumer breach record 007's ban.
- `packages/ui/tests/contrast.test.ts` — `fileURLToPath(new URL("../src/theme.css",
  import.meta.url))`, the exact construction happy-dom's `URL` breaks.
  `packages/ui/tests/index.test.ts` — seventeen lines, pure Node, the other file the
  global environment would have dragged into a DOM.
  `packages/ui/tests/badge.test.tsx` — the seven-line file quoted above; the check
  record 008 asked for.
- `packages/ui/package.json` — the four devDependencies as the fixer left them, two
  already `catalog:` and two inline. `packages/ui/tsconfig.json` — `"jsx":
  "react-jsx"` and `include: ["src/**/*", "tests/**/*"]`, both already correct, so no
  tsconfig change is needed. `packages/ui/vite.config.ts` — `plugins: [react()]` plus a
  re-declared `setupFiles`, which is record 008's app shape minus the router plugin and
  minus the environment line.
- `packages/ui/src/components/` — twelve files (`badge`, `button`, `card`, `input`,
  `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `table`, `tabs`, `tooltip`).
  The number that makes option 2's exposure concrete.
- Root `package.json` — the `catalog` block, confirming `@vitejs/plugin-react` and
  `happy-dom` are already pinned and that the two Testing Library packages are not.
- `apps/pos/tests/` and `apps/backoffice/tests/` — both import
  `assertNoServerImports` from `api/src/test-seam-react.tsx`, confirming the seam is
  live and consumed, and that neither app declares Testing Library itself.
- `docs/adr/0009-frontend-module-structure.md` rule 6 — the apps may not import each
  other, the direction argument extended to a package importing an app.
  `docs/adr/0001-stack-and-monorepo-shape.md` — the ten-workspace table an eleventh
  would contradict.
- `.scratch/decisions/` searched before deciding, for an existing or orphan record on
  `packages/ui` tests, render tests, happy-dom placement, or Testing Library
  declaration: records 001–014 only, of which 007 and 008 bear on it and neither
  decides it. **No duplicate, no orphan.** `LOG.md` and the directory agree that 014 is
  the highest number.

**External, primary sources, accessed 2026-08-02:**

- <https://vitest.dev/guide/environment> — "Control comments are comments that start
  with `@vitest-environment` and are followed by the environment name." The docblock is
  first-party documented and supported. Also <https://vitest.dev/config/environment>.
  Placement is documented as "before any imports or code"; **no primary source states
  a stricter first-line rule**, so the first-line convention above is this record's,
  chosen because it is greppable.
- <https://v4.vitest.dev/guide/migration.html> — "`environmentMatchGlobs` config
  option. Use `projects` instead", with the worked before/after example. Confirms
  record 008's finding and establishes the successor mechanism.
- <https://vitest.dev/guide/projects> — the `projects` shape: `name`, `include`,
  `exclude`, `environment`, and that **projects do not inherit the parent config by
  default** unless `extends: true` is set. This is the fact that costs option 2 its
  engineering score and it is written into the Layer 3 reversal so it is not
  rediscovered.
- <https://github.com/vitest-dev/vitest/issues/3988> — "new URL throw error when
  environment is `happy-dom`", reporting `"The URL must be of scheme file."` **This is
  the exact failure `contrast.test.ts` hits under a global happy-dom environment**, and
  it is why that option is rejected rather than worked around.
- <https://github.com/capricorn86/happy-dom/issues/569> — "URL constructor is missing
  'base' option", corroborating that happy-dom's `URL` is not compliant with the
  platform one in general, not only for `file://`.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and
no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No primary source establishes exactly which globals Vitest's happy-dom environment
  places on `globalThis`**, so the claim above is deliberately narrow: the observed
  failure is reproduced in the Vitest issue, and the mechanism is stated as "happy-dom's
  `URL` is not compliant" rather than as a claim about `populateGlobal` internals.
- **No primary source states whether `node:fs` has caveats under happy-dom.** Nothing
  suggests it does — Vitest still runs under Node and only DOM globals are swapped —
  and `contrast.test.ts`'s `readFileSync` is not the failing part. Recorded because a
  reader might otherwise assume the file read was the problem.
- **vite-plus publishes no documentation** for per-workspace `vite.config.ts`
  semantics, for `test.projects` support, or for whether a workspace `test` block
  merges with or shadows the root's. Record 005 found the same gap, record 008 found it
  again. Every claim above that depends on vite-plus behaviour is carried by something
  already working in this repository, or named as a risk with a pre-decided fallback.
- **Whether vite-plus's bundled rolldown transforms `.tsx` without
  `@vitejs/plugin-react` could not be established.** Hence the plugin stays, with the
  removal named as a pre-authorised simplification for whoever establishes it.
- **No source, first-party or otherwise, states where a shared component's render test
  belongs in a monorepo.** This is a question about this repository's own records, and
  it is decided from record 008's text and the seam's actual export list rather than
  from an outside opinion. An honest "nothing authoritative found" is the input here.
