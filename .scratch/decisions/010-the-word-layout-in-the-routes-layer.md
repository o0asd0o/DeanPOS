# 010: The word "layout" in the routes layer — ADR-0009 means nesting, not markup, so no route file contains JSX

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** the reviewer of `.scratch/foundation/issues/06-terminal-shell-and-test-seam.md`, after the implementer flagged the conflict rather than picking a side

## The question

Two binding documents use the same word to say opposite things.

`docs/adr/0009-frontend-module-structure.md` describes `src/routes/` as "THIN — routing,
guards, **layout**, and a single feature component". So layout belongs in a route file.

`docs/agents/code-standards.md` rule 4 says "DON'T put **layout**, markup, or business logic
in a route file". So layout does not belong in a route file.

Which reading is right, what changes in each document so neither restates the conflict, and
what test a reviewer applies to a route file from now on.

What a wrong answer costs: issue 07 builds the back office's root and nav skeleton
immediately, and eleven later areas add ordinary routes to two applications. Left unresolved,
every screen ticket's reviewer either invents the boundary or escalates it again. Resolved the
wrong way — by simply letting the ADR's word win — rule 4's actual intent ("a route file that
grows past wiring means a feature is missing") stops being enforceable, and the routes
directory becomes where markup accumulates because nobody can say when it has become too much.

### Weights, declared before any option was scored

Not changed afterwards.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Every option renders byte-identical output to a cashier. Weighting this higher would be theatre. It is not zero only because ADR-0009's stated purpose is stopping the two applications from diverging into "different products", and one option genuinely risks that. |
| Business impact | ×1 | Nothing here costs or earns. The one real business fact is throughput: an unresolved wording conflict is a decider round-trip on every screen ticket across eleven areas, in two applications. |
| Engineering cost and risk | ×2 | This is a rule about where code goes, applied by hand a few hundred times. Cost and enforcement risk are most of what separates the options. |
| Reversibility | ×2 | A convention copied by two applications and eleven areas. Cheap to reverse today, and the cost grows with every shell written under it. |
| Evidence strength | ×3 | This is a question about what a document *meant*, and the document names the codebase it was adapted from. The prior art and the ADR's own second use of the word settle it. An option that ignores them is deciding by taste on a question that has facts. |

Maximum possible total: 45.

## What I chose, and why

**"Layout" in ADR-0009 means layout *nesting* — which screens sit inside which shell — and
never layout *markup*. Read that way the two documents already agree, and the standard is the
one that says it clearly. So the rule for both applications is: a route file contains no JSX
at all, including `__root.tsx`.**

Three facts decided this, and none of them is a preference.

**One. The ADR uses the word twice, three lines apart, and the second use is unambiguous.**
Line 22 of the same block reads `(auth)/  route groups for layout, not for URLs`. A route
group is a folder in parentheses that TanStack Router treats as purely organisational — it
cannot contain markup, because it is a directory. There, "layout" plainly means *how routes
nest*. The word means the same thing three lines earlier. (The ADR uses "layout" in a third
sense further down — "the POS's two layouts (tablet and phone)" — which is visual arrangement
and is already settled as a CSS media query by record 009. Three senses in one document is why
this reached a decider.)

**Two. The codebase the ADR was adapted from puts no markup in any route file.** ADR-0009
cites `/Users/jomelortega/Desktop/personals/ApxDenta/apps/webapp/src` as its evidence. Read on
2026-08-02, that project's `routes/__root.tsx` is eighteen lines and renders `<Outlet />` and
nothing else. Its one pathless layout route, `_protected/layout.tsx`, is fourteen lines: a
`beforeLoad` redirect guard and `component: Protected`. The shell — sidebar, header, `<main>`,
`<Outlet />` — is in `features/protected/Protected.tsx`, and the header and sidebar are
components under `src/components/`. Its leaf routes are `createFileRoute(...)({ component: X })`
with a loader. Prior art the ADR was *derived from* is the strongest available evidence about
what the ADR meant, and it says: routes declare the nesting, components hold the frame.

**Three. The "there is no feature to delegate to" premise is false, and the lane already
disproves it.** The argument for excusing `__root.tsx` is that a framework-mandated root file
has nothing to hand off to. But the issue-06 lane hands off its error chrome to
`apps/pos/src/components/ErrorState.tsx` and its not-found chrome to
`components/NotFoundState.tsx` already. ADR-0009 defines `src/components/` as "shared across
features within this app", and a shell frame is the most shared thing an application has. The
frame was the one piece that stayed inline, and there is no property of it that the two
components beside it do not also have.

**And the framework makes the strict rule free.** TanStack Router's documentation states: "If
a route's `component` is left undefined, it will render an `<Outlet />` automatically." So a
layout route that only guards or only groups writes no component at all, and a root or layout
route that does have chrome names one imported component. There is no case where the framework
forces JSX into a route file, which is exactly why a bright line is affordable here and an
exception is not needed.

### What this means for the three kinds of route file

The question asked whether these three could take different answers. They can, and they
deliberately do not — but for different reasons, and the reasons are what a reviewer needs.

- **`__root.tsx`** — framework-mandated, always matched, its component always rendered. It
  hands the router **one imported shell component**. The shell renders the frame, the header
  and the `<Outlet />`.
- **Pathless layout routes** (`_protected.tsx`, `_protected/layout.tsx`, `(group)/route.tsx`)
  — these are where the routes layer's *real* layout authority lives. Creating one **is**
  putting layout in the routes layer, and it is encouraged. What they hold is the guard, the
  loader and the nesting; if the shell they establish has chrome, that chrome is an imported
  component. If they only guard or only group, they **omit `component`** and the framework
  supplies the `<Outlet />`.
- **Ordinary leaf routes** — one imported feature component, plus route-level concerns. This
  half was never actually in dispute; both documents already agreed on it.

### Why rule 4's intent survives — and is stronger than before

Rule 4 exists so that "a route file that grows past wiring means a feature is missing" stays
checkable. Under the old wording it was not: "how much layout is too much layout" is a matter
of taste, and taste does not survive eleven areas and two applications. Under this resolution
the threshold is zero and the check is a read: **is there JSX in this file?** A route file
cannot grow past wiring, because growing past wiring requires markup and markup is not allowed
in the file at all.

### Where the shell goes, exactly

`apps/<app>/src/components/AppShell.tsx`, exporting `AppShell`. Not `features/shell/`:
ADR-0009's `features/<area>/` folders map to PRD areas and own a capability's data and actions,
and today's shell owns no data — record 009 fixes it at the literal text `DeanPOS` with the
other two top-bar slots rendering no element. `src/components/` is the ADR's own home for
"shared across features within this app", and it is where the lane's two other chrome
components already sit.

**If the shell ever needs its own query hook** — area 2 `tenancy-identity` is the candidate —
it becomes `features/shell/` under ADR-0009 rule 2, a one-file move. The likelier shape is
that area 2 adds a *child* component for the identity slot and `AppShell` stays chrome. Named
here so nobody re-decides it under time pressure.

## The options, ranked

| Rank | Option | User ×1 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×3 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **"Layout" means nesting; no JSX in any route file; shell to `src/components/`** | 3 | 5 | 4 (8) | 4 (8) | 5 (15) | **39** |
| 2 | Same reading, but the shell goes to `src/features/shell/` | 3 | 4 | 3 (6) | 4 (8) | 4 (12) | **33** |
| 3 | Defer — mark the ADR line non-normative, let each reviewer judge | 2 | 1 | 5 (10) | 5 (10) | 1 (3) | **26** |
| 4 | Codify the exception — root and pathless layout routes may hold frame markup, leaf routes may not | 3 | 3 | 3 (6) | 3 (6) | 2 (6) | **24** |
| 5 | The ADR wins literally — amend rule 4 to permit layout markup in route files | 2 | 2 | 2 (4) | 2 (4) | 1 (3) | **15** |

**1. Nesting, no JSX anywhere, shell in `components/` — chosen.** The only option where both
documents become literally true with no exception carved into either, and the only one whose
reading is supported by the ADR's own second use of the word *and* by the codebase the ADR
cites as its evidence. Its engineering score is 4 rather than 5 because it does cost something
real and permanent: one extra file and one extra import per shell, forever, and one file to
split in the lane now. Its reversibility is 4 rather than 5 for the reason the reversal section
gives — the cost is bounded by the number of shells, not the number of routes, but it is not
zero.

**2. Same reading, shell in `features/shell/`.** Genuinely close, and it is what ApxDenta
literally does: its shell composition lives in `features/protected/Protected.tsx`. It loses on
two facts rather than on taste. ApxDenta's shell is auth-gated and calls `useSession()` — it
has data, which is what makes it a feature; DeanPOS's shell has none by record 009's decision.
And `features/<area>/` in this project mirrors the PRD's areas, so a `shell` feature invents an
area that no PRD names, with an empty `__common/queries.ts` shape around nothing. Ranked second
rather than dismissed because if the shell does acquire a query, this becomes the right answer
and the move is one file.

**3. Defer.** Included because it must be, and 20 of its 26 points come from engineering cost
and reversibility, which any do-nothing option maximises trivially — the same inflation records
002, 006, 007 and 009 each left visible rather than tuned away. It ranks above option 4 only on
the tie-break rule, having scored 26 to 24 on its own. It fails on the thing that matters: the
reviewer already ruled this "will recur for every app and ordinary route", and deferring means
issue 07 decides it by precedent in a lane, at speed, and eleven areas inherit whatever that
lane happened to do.

**4. Codify the exception — roots and layout routes may hold the frame.** This is the
reviewer's own position written down, and it is the option I expected to choose before reading
ApxDenta. It ranks fourth for one reason: the exception has no edge. "A root file with no
feature to delegate to" is not a checkable property — it is an argument, and it is an argument
that wins slightly more often each time it is made, until a pathless layout route with a
sidebar, a breadcrumb bar and a toolbar is "basically a root". Its evidence score is 2 because
nothing outside this repository supports it: the codebase the ADR cites does the opposite in
exactly the two file kinds the exception would cover. Its reversibility is 3 because unwinding
it means finding every file that took the exception and judging each one.

**5. The ADR wins literally.** Scored honestly rather than dismissed, because "the more
specific document wins" is a real principle and ADR-0009 is the more specific document. It
fails because the specific document's own evidence contradicts the literal reading, and because
it is the one option that defeats rule 4's stated intent outright: with layout permitted in
route files there is no line at all, and "a route file that grows past wiring means a feature is
missing" becomes a sentence nobody can act on. Last on evidence, last on user impact, since
letting two applications each grow their own route-level markup is precisely the divergence
ADR-0009's Context section exists to prevent.

Options 3 and 4 did not tie; 3 scored 26 and 4 scored 24. Recording it because the ranking looks
odd: a do-nothing option placing above a real one is the arithmetic being honest about how much
of a defer's score is free reversibility.

## The test a reviewer applies

Checkable by reading the file. No judgement, no threshold.

> **A route file contains no JSX.** Every component a route hands the router — `component`,
> `pendingComponent`, `errorComponent`, `notFoundComponent` — is a bare identifier imported
> from `features/` or `components/`. A layout route that only guards or only groups omits
> `component` entirely.

Cheap first pass, because every JSX element must be closed by either `</` or `/>`, and a
TypeScript generic such as `createRootRouteWithContext<RouterContext>()` produces neither:

```
rg -n '</|/>' apps/*/src/routes
```

Returns nothing. Anything it returns is either a breach or a route file that needs a human
glance — there is no third case worth arguing about.

Scope, so this is not over-applied:

- The rule covers files under `src/routes/` only. **`src/router.tsx` is not a route file**; its
  one-line `defaultErrorComponent: ({ reset }) => <ErrorState onRetry={reset} />` adapter is not
  a breach and must not be reported as one.
- Chrome may not be hidden inside the routes directory under a `-` prefixed folder. TanStack
  Router excludes `-` prefixed files from the route tree, so they would pass a per-file read;
  they are still the wrong layer, and the directory-level grep above is what catches them.
- The second half of rule 4 is unchanged and still applies: `features/` never imports from
  `routes/`.

## What the fixer applies — verbatim, nothing to re-decide

Four edits. Two documents, one decision record, one lane.

### 1. `docs/agents/code-standards.md` — replace all of section 4

Replace from the line `## 4. Routes stay thin. Features hold the work` through the line ending
`Create the feature; do not grow the route.` with exactly:

````markdown
## 4. Routes stay thin. Features hold the work

```
routes/     route-level concerns ONLY — params, guards, redirects, data loading,
            metadata, error boundaries, and which screens nest inside which
            shell. Whatever this project's router calls this directory
            (pages/, app/, routes/) is the same layer.
features/   the actual UI and logic, in one folder per capability.
components/ chrome shared across this app's features — the shell frame, the
            header, the primary nav, the shared state blocks.
```

**The test is mechanical: a route file contains no JSX.** Every component a route hands the router — `component`, `pendingComponent`, `errorComponent`, `notFoundComponent` — is a bare identifier imported from `features/` or `components/`, never an inline function returning markup. `rg -n '</|/>' apps/*/src/routes` returns nothing.

This holds for all three kinds of route file, and the root is not an exception:

- **`__root.tsx`** hands the router one imported shell component. That component renders the frame and the `<Outlet />`.
- **Pathless layout routes** (`_protected.tsx`, `_protected/layout.tsx`, `(group)/route.tsx`) declare *which screens nest inside which shell*. That nesting **is** the layout the routes layer owns, and it is the whole of it. A layout route that only guards or only groups **omits `component` entirely** — TanStack Router renders an `<Outlet />` for it automatically.
- **Ordinary leaf routes** hand the router one imported feature component.

- DO make a route file import one component and wire the route-level concerns around it.
- DO create a pathless layout route when several screens share a shell. That file is routing, not markup.
- DON'T put markup, layout, or business logic in a route file. "Layout" as a route-level concern means the nesting; the shell's JSX is a component elsewhere (ADR-0009, amended 2026-08-02, and `.scratch/decisions/010-the-word-layout-in-the-routes-layer.md`).
- DON'T hide chrome inside the routes directory under a `-` prefixed folder. Those files are excluded from the route tree but they are still the wrong layer.
- DON'T import anything from `routes/` inside `features/`. **The dependency points one way: routes → features.** A feature reaching back into a route is a finding.
- A route file that grows past wiring means a component is missing. Create it — in `features/` if it owns a capability's data and actions, in `components/` if it is chrome that several features sit inside — and do not grow the route.

This section governs files under `src/routes/`. `src/router.tsx` is not a route file; a one-line `defaultErrorComponent` adapter there is not a breach.
````

### 2. `docs/adr/0009-frontend-module-structure.md` — two edits

**(a)** In the Decision block, replace these two lines:

```
src/routes/                  TanStack Router files. THIN — routing, guards, layout, and a
                             single feature component. No business logic, no data shaping.
```

with exactly:

```
src/routes/                  TanStack Router files. THIN — routing, guards, layout nesting,
                             and one imported component. No markup, no business logic, no
                             data shaping.
```

**(b)** Immediately after that code block's closing fence, and before `### Rules`, insert
exactly (matching the amendment style already used in `docs/adr/0004-prisma-schema-kysely-runtime.md`):

```markdown
**Amended 2026-08-02** (`.scratch/decisions/010-the-word-layout-in-the-routes-layer.md`): the
`src/routes/` line above read "routing, guards, layout, and a single feature component", which
contradicted code standard 4's "DON'T put layout, markup, or business logic in a route file".
The word meant **layout nesting** — the `_protected/` and `(auth)/` files that declare which
screens sit inside which shell, the same sense as "route groups for layout, not for URLs" two
lines below it — and never layout markup. ApxDenta's `apps/webapp`, which this ADR is adapted
from, holds no markup in any route file: `__root.tsx` renders `<Outlet />` and nothing else,
`_protected/layout.tsx` is a redirect guard plus `component: Protected`, and the shell's JSX
lives in `features/protected/Protected.tsx`. So: **no route file in either application contains
JSX**, the root included. A shell frame is a component under `src/components/`; a screen is a
component under `src/features/`; a route file names one of them and wires the route-level
concerns around it. Code standard 4 carries the reviewer's test.
```

### 3. `.scratch/decisions/009-terminal-shell-chrome-states.md` — one sentence

Record 009 is **not overturned** and none of its decisions change. Its "How to turn it back"
section names a file path that this record moves. Replace:

```
error block's arrangement, or the `md` boundary is an edit to two files:
`apps/pos/src/routes/__root.tsx` (the frame and the header) and the shared state component
under `apps/pos/src/components/`.
```

with exactly:

```
error block's arrangement, or the `md` boundary is an edit to two files:
`apps/pos/src/components/AppShell.tsx` (the frame and the header — moved out of
`routes/__root.tsx` by record 010, which forbids JSX in any route file) and the shared state
component under `apps/pos/src/components/`.
```

Step 2 of that section ("Edit the two files above in `apps/pos`, and their two counterparts in
`apps/backoffice`") stays as written and is still correct. `LOG.md`'s line for record 009 names
no file path and does not change.

### 4. The issue-06 lane — yes, it changes. I disagree with the reviewer, and here is exactly how much

**One file splits into two. No behaviour changes, no test changes, no manifest changes.** The
lane renders identical output before and after; the seam test, the axe calls and record 009's
QA checks all pass unchanged, because none of them names `RootLayout` — `rg` for it across the
worktree returns only its own declaration and use inside `__root.tsx`.

I disagree with the reviewer's conclusion, not with its reasoning about `__root.tsx` being
special. It is special. But the excuse offered for it — no feature to delegate to — is not true
in this lane, where `ErrorState` and `NotFoundState` already sit in `apps/pos/src/components/`
being delegated to. Leaving the frame inline makes the lane internally inconsistent on the very
file that issue 06 calls "the worked example of ADR-0009" that "ten areas copy". A worked
example that carries the one exception is the worst possible template, because what gets copied
is the exception.

**New file `apps/pos/src/components/AppShell.tsx`:**

```tsx
import { Outlet } from "@tanstack/react-router";

// The shell frame and header. What renders here and why: .scratch/decisions/009.
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex justify-between p-4">
        <span>DeanPOS</span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        <main id="main-content" className="flex-1 md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**`apps/pos/src/routes/__root.tsx` becomes, in full:**

```tsx
import { createRootRouteWithContext } from "@tanstack/react-router";

import { AppShell } from "../components/AppShell.tsx";
import type { RouterContext } from "../lib/router-context.ts";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
});
```

The old file's two-line comment does not survive the move and must not be reproduced in either
file: it explained why layout was in a route file, and after this record there is no such thing
to explain. The one line above `AppShell` is a pointer to a decision record, which is what code
standard 5 asks for.

`apps/pos/src/routes/index.tsx`, `features/ping/`, `components/ErrorState.tsx`,
`components/NotFoundState.tsx` and `router.tsx` are **unchanged** — all five already comply.

**Issue 07 (`apps/backoffice`) builds to the same shape from the start:**
`routes/__root.tsx` names `AppShell`; `apps/backoffice/src/components/AppShell.tsx` holds the
skip link, the `<header>`, the `<nav aria-label="Primary">` position and
`<main id="main-content">` per record 009. The nav's own markup gets
`apps/backoffice/src/components/PrimaryNav.tsx` if it is more than a couple of links — that is
code standard 2 applying normally, not a new instruction.

## How to turn it back

Cheap now; the cost grows with the number of **shells**, not with the number of routes, which
is the whole reason this scores 4 on reversibility rather than 2.

1. Write a superseding record; flip this record's `Status:` to `overturned` with the date and
   reason; update both lines in `LOG.md`.
2. Restore section 4 of `docs/agents/code-standards.md` from git — the pre-2026-08-02 text is
   one revert hunk in one file.
3. Remove the amendment paragraph from `docs/adr/0009-frontend-module-structure.md` and restore
   the two lines of its Decision block. Same shape: one revert hunk.
4. Restore the sentence in record 009's "How to turn it back".
5. Inline each shell back into its route file: for every `AppShell.tsx`, paste its JSX into the
   route file that names it and delete the component file. **Count first** — `rg -l 'AppShell'
   apps` is the true cost, and today it is two files per application, so four in total once
   issue 07 lands. Add one file per pathless layout route with chrome created after this record;
   `rg -l 'createFileRoute\(.\/_' apps/*/src/routes` finds them.
6. Re-run the gate. Nothing else moves: no manifest, no token, no migration, no contract, no
   test. Every one of these steps is a text move with no behaviour attached, which is why this
   is affordable at any point.

Leaf routes are not part of any reversal. They were already thin under both documents' original
wording, and nothing this record does touches them.

## What would make this decision wrong

- **Route-level `errorComponent` / `pendingComponent` turn out to need prop adapters
  routinely.** TanStack Router hands those components its own props (`error`, `reset`, `info`),
  and this lane's `ErrorState` takes `onRetry`. `src/router.tsx` adapts it in one line today,
  which the rule permits because that file is not a route file. If a *route-level* one is ever
  needed, the strict rule forces either a component whose props already match the router's, or a
  wrapper file that exists only to satisfy a grep. **The second of those is the failure
  signal.** If it happens more than twice, the narrow amendment is "an inline adapter that only
  renames or forwards props, with no elements of its own, is not markup" — and that amendment
  should be written as a superseding record, not adopted quietly.
- **This rule forbids something ApxDenta actually does.** Its
  `_protected/(physical-asset)/peripherals/inventory/new.tsx` wraps a lazily-imported form in a
  padding `<div>` and a `<React.Suspense>` fallback, inline, in a leaf route. I read that and
  chose the stricter line anyway: ADR-0009 adapts the sibling, it does not clone it, and code
  standard 4 already banned markup in leaf routes before this record — that half was never in
  dispute. But it is the honest counterexample, and if this project's create/edit routes end up
  wanting the same wrapper, it will surface as the same friction as the point above.
- **The shell acquires its own data.** Area 2 `tenancy-identity` adds a store, a terminal and a
  cashier to the header. If `AppShell` grows a query hook, it belongs in `features/shell/` under
  ADR-0009 rule 2, which is option 2 of this ranking and a one-file move. That does not make this
  record wrong; it makes the second-ranked option right *later*, which is the normal shape of a
  close call.
- **TanStack Router changes its conventions** so that some route file must contain JSX — a
  `head`/document convention, or a `shellComponent`. The rule's whole affordability rests on
  "component omitted renders an `<Outlet />` automatically", which is documented behaviour today
  and is the sentence to re-check at any major-version bump. Record 008 pins the router family
  at `1.170.18` in lockstep, so the bump is a deliberate, visible event.
- **A reviewer starts using the grep as the whole judgement.** `rg -n '</|/>'` is a first pass,
  not the standard. A route file with no JSX and three hundred lines of loader logic passes the
  grep and breaches rule 4's intent. That case has not appeared yet and is not worth pre-empting
  with a second rule, but it is what to watch for.

**This one is not close.** The two lower-ranked serious options lose by 6 and 15 points on
weighted evidence that is documentary rather than judgemental, and the tie-break rule was not
needed. Where I am least confident is the destination folder, not the rule: option 2 lost by 6
and would win the day the shell gains a query.

## Evidence

**Repository, read 2026-08-02:**

- `docs/adr/0009-frontend-module-structure.md` — the full Decision block. The `src/routes/`
  line's "routing, guards, layout, and a single feature component"; **line 22's `(auth)/  route
  groups for layout, not for URLs`**, which is the decisive internal evidence; rule 1 "A route
  file renders a feature and nothing else"; rule 2 (a feature owns its data fetching); the
  `src/components/` definition "shared across features within this app"; the Consequences line
  about the POS's two layouts being "variants within a feature", which is the ADR's third use of
  the word; the Context section's stated purpose — stopping the two applications diverging into
  "two codebases that look like different products"; and the Evidence section naming ApxDenta.
- `docs/agents/code-standards.md` — rule 4 in full, including its stated intent "A route file
  that grows past wiring means a feature is missing. Create the feature; do not grow the route",
  and the closing section "When this file and the existing code disagree", which routes exactly
  this class of question here.
- `docs/adr/0004-prisma-schema-kysely-runtime.md` lines 29–33 — the repository's existing
  **amendment style**, `**Amended <date>** (record path): …` appended under the block it amends,
  written by record 005. Followed verbatim above rather than invented.
- `docs/adr/0001-stack-and-monorepo-shape.md` line 60 — "They share tokens, not layout", a
  fourth sense of the word, noted and not touched.
- `.scratch/decisions/009-terminal-shell-chrome-states.md` — read in full. Its normative
  sections ("What the implementer does", the no-gos, the QA checks) name **no file path**; the
  path this record moves appears only in its "How to turn it back". That is why 009 is amended
  and not overturned.
- `.scratch/decisions/` 001–009 searched for an existing record on the routes/features split,
  ADR-0009, or the code standards: none. Record 005 is the closest precedent in *kind* — a
  document-versus-document contradiction resolved by amending one document and leaving the other
  untouched. **No duplicate.**
- Worktree `.worktrees/foundation-06-terminal-shell`, read not edited:
  `apps/pos/src/routes/__root.tsx` (25 lines, verbatim above), `routes/index.tsx` (9 lines,
  already thin), `features/ping/Ping.tsx`, `features/ping/__common/queries.ts`,
  `components/ErrorState.tsx`, `components/NotFoundState.tsx`, `router.tsx` (its
  `defaultErrorComponent` arrow), `tsr.config.json` and `vite.config.ts` (file-based generation
  into `src/generated/routeTree.gen.ts`, no route-convention overrides). `rg 'RootLayout'`
  across the worktree returns two hits, both inside `__root.tsx` — **nothing else references it,
  so the split touches no test.** No `_layout` or pathless route exists anywhere yet.
- `.scratch/foundation/issues/06-terminal-shell-and-test-seam.md` — "**The ping route is the
  worked example of ADR-0009**… Ten areas copy this shape, so a component tree improvised in
  `routes/` here becomes the template for every screen in the product." This sentence is why I
  did not take the exception.
  `.../07-backoffice-shell.md` — "Thin routes, fat features per ADR-0009, matching the worked
  example issue 06 established", and the nav skeleton built "as structure only".

**Sibling codebase, read 2026-08-02** — `/Users/jomelortega/Desktop/personals/ApxDenta/apps/webapp/src`,
the source ADR-0009 names:

- `routes/__root.tsx`, 18 lines: `createRootRouteWithContext<MyRouterContext>()({ component: () => <Outlet />, notFoundComponent: () => <NotFound /> })`. **No frame, no header, no shell.**
- `routes/_protected/layout.tsx`, 14 lines: a `beforeLoad` redirect guard and `component: Protected`. **The only pathless layout route in the project, and it holds no markup.**
- `features/protected/Protected.tsx`, 30 lines: `SidebarProvider` → `AppSideBar` → `SidebarInset` → `Header` → `<main><Outlet /></main>`. **This is where the shell lives.**
- `components/side-bar/AppSideBar.tsx`, `components/header/Header.tsx` — the chrome pieces.
- Leaf routes `_protected/dashboard.tsx` (6 lines), `(clinic)/patients.tsx` (24, with loader and
  an inline `pendingComponent`), `(clinic)/staff-list/index.tsx` (31, `React.lazy`),
  `(clinic)/staff-list/$staffId.tsx` (17) — all `{ component: X }` plus route-level concerns.
- The counterexample, recorded rather than hidden:
  `_protected/(physical-asset)/peripherals/inventory/new.tsx`, 32 lines, wraps its feature
  component in an inline padding `<div>` and a `<React.Suspense>` fallback. A handful of
  create/edit routes do this; the list and view routes do not.

**External, primary sources, accessed 2026-08-02.** TanStack Router official documentation:

- <https://tanstack.com/router/latest/docs/framework/react/guide/outlets> — "**If a route's
  `component` is left undefined, it will render an `<Outlet />` automatically.**" This is the
  sentence that makes a zero-exception rule affordable, and it is the one to re-check on a major
  bump. Also: "`<Outlet />` doesn't take any props and can be rendered anywhere within a route's
  component tree. If there is no matching child route, `<Outlet />` will render `null`."
- <https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts> — the root
  route "has no path", "is **always** matched", and "its `component` is **always** rendered".
  Pathless layout routes "are used to wrap child routes with additional components and logic"
  without requiring a matching `path`. Route groups in `()` are "purely organizational and do
  not affect the route tree or component tree in any way" — which is why `(auth)/` cannot
  possibly mean markup in ADR-0009's line 22.
- <https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions> —
  "The root route file must be named `__root.tsx`"; the `_` prefix marks pathless layout routes;
  the `_` suffix un-nests; "**Files and folders with the `-` prefix are excluded from the route
  tree and can be used to colocate logic in route folders**" — the enforcement hole the
  directory-level grep closes.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No documentation, first-party or otherwise, states that a root or layout route *should*
  contain its layout markup inline.** The TanStack pages describe what these files are *for*
  (wrapping child routes with components and logic) and are silent on where the wrapping
  component's code lives — it is a project convention, not a framework one. That silence is why
  the ADR's own prior art is the strongest evidence available and why it carries the ×3 weight.
- **No prior decision record, ADR, or issue in this repository has ever ruled on where a shell
  frame lives.** The word "layout" appears in four documents in four different senses and in no
  case with a definition. This record supplies the missing one for the routes layer only; the
  ADR-0001 sense ("they share tokens, not layout") and the record-009 sense (tablet versus
  phone) are deliberately untouched.
