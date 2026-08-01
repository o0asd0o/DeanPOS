# 007: The shared UI package — Tailwind 4's shared theme file, two vendored primitives, and a contrast test with no library behind it

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/05-ui-tokens-and-primitives.md`)

## The question

`packages/ui` is the one package both React applications share, and every screen in
eleven later areas is drawn out of it. Nothing is installed there yet, and **React
itself is not declared in any manifest in the repository** — so this record has to
name a React version as well.

Six things were open and each is settled below: which Tailwind major and what "a
preset both applications extend" concretely means under it; how shadcn primitives
are actually obtained and which Radix packages that really costs; which primitives
the two shells genuinely need; how the WCAG contrast criterion is asserted; where
the focus indicator lives; and what the touch-target token's value should be.

What a wrong answer costs is unusually specific here. A dependency can be swapped.
**A token name cannot** — it is written into a class string on every screen, so
renaming one after eleven areas is a repository-wide find-and-replace with no type
system to catch a miss. And a Tailwind-3-shaped answer built against a Tailwind-4
install would not fail loudly; it would fail as a `tailwind.config.js` nobody reads,
with the tokens silently absent.

**Not open, and not reopened:** Tailwind as the styling engine, shadcn/ui as the
primitive source, `packages/ui` holding primitives and tokens only, and WCAG 2.2 AA
as the target (ADR-0001, the foundation PRD, `ORC2_A11Y`).

## What I chose, and why

### The one thing that changes the shape of the answer

**Tailwind 4 has no `presets` array.** Configuration moved out of JavaScript and
into CSS. So the acceptance criterion "a Tailwind preset both applications extend"
cannot be built the way it is worded, and this is the part most likely to be got
wrong by someone who has used Tailwind 3.

Under Tailwind 4 the criterion is satisfied by a **CSS file**. Tailwind's own
documentation has a section called "Sharing across projects" that shows exactly this
shape — a package exporting a `.css` file containing an `@theme` block, and each
application's stylesheet importing it after importing Tailwind itself. That file is
the preset. Concretely, `packages/ui/src/theme.css` holds the tokens, and each
application's CSS entry point is two lines:

```css
@import "tailwindcss";
@import "../../../packages/ui/src/theme.css";
```

Those two lines are **byte-for-byte identical in both applications**, because
`apps/pos` and `apps/backoffice` sit at the same depth. That is what satisfies "no
app-specific configuration" — there is no configuration, only an import.

One detail makes this work rather than nearly work, and I verified it in Tailwind's
own source history rather than assuming it: `@source` directives — the things that
tell Tailwind where to look for class names — are resolved **relative to the CSS file
that contains them**, and the base is re-set on every `@import`. So `theme.css` can
register its own components directory once, and both applications inherit that
registration for free. Without that property, each application would need its own
`@source` line pointing back at `packages/ui`, and the "no app-specific
configuration" criterion would be broken on day one.

This is also why the import is written as a **relative path and not as `@import
"ui/theme.css"`**. Tailwind documents `@import` of a published npm package, but I
could not find any first-party statement that a *workspace* package name resolves,
and the project's own discussions show people falling back to relative paths in
monorepos. A relative path also keeps the file outside `node_modules`, which
Tailwind's class detection ignores by default. Two reasons, same answer.

### shadcn is a generator, not a dependency — but Radix is a real one

shadcn/ui's own documentation is blunt about this: "This is not a component library.
It is how you build your component library." Components are copied into the
repository and owned there. So **`shadcn` is a development-only tool**, and the
packages that actually ship are the ones the copied files import.

Those are: `radix-ui` (the behaviour — focus management, escape handling, ARIA
wiring), `class-variance-authority` (variant-to-class mapping),
`clsx` + `tailwind-merge` (the `cn` helper every generated file calls), and
`lucide-react` (icons). Five packages, in `packages/ui`'s `dependencies`, and
nowhere else.

**On Radix: one package, not many.** In February 2026 shadcn migrated its components
from the many `@radix-ui/react-*` packages to the single `radix-ui` package, and
Radix's own documentation now says "We recommend installing the `radix-ui` package
and importing the primitives you need." I confirmed it in the generated source rather
than from the changelog: the current `button` imports `{ Slot } from "radix-ui"` and
the current `sheet` imports `{ Dialog as SheetPrimitive } from "radix-ui"`. This
matters more here than it looks. Under the old shape, every later area that adds a
primitive also adds a package to a manifest — eleven areas of small dependency diffs
that nobody reviews carefully. Under the new shape, adding a primitive touches no
manifest at all. Radix also documents per-primitive subpaths for bundlers that
tree-shake better from them, which is the escape hatch if bundle size ever measures
badly.

**And the thing that would have quietly broken this, found in time.** shadcn now ships
three interchangeable primitive bases — Radix, Base UI, and React Aria — and **as of
July 2026 Base UI is the default for new projects.** A bare `shadcn init` in this
repository today would therefore generate components importing
`@base-ui/react/dialog`, not `radix-ui`, and the dependency set in this record would
be wrong on the first command anyone typed. **`--base radix` is mandatory, not a
preference**, and it is written into the instruction below.

I am staying on Radix rather than following the new default, and the brief scoped that
in — but it deserves a reason rather than deference. Base UI has been shadcn's default
for roughly a month. Radix is the base every existing shadcn component, every existing
answer, and Radix's own long-standing accessibility work sits on, and this package
carries the project's WCAG 2.2 AA commitment across eleven areas with no hosted CI to
catch a regression. **Trigger to revisit:** Base UI reaching the point where Radix is
in maintenance rather than active development. That is a re-scoring, not an emergency,
and the switching cost is the same "rewrite the files in
`packages/ui/src/components/`" figure the reversal section already quotes.

**On the icons, which is the closest call in this record.** Two glyphs are needed by
issues 06 and 07: the sheet's close control and the back-office's `☰` at 390. Two
inline SVGs would be about six lines and no dependency, and I took that seriously.
It loses on a line I read rather than assumed — the Radix `sheet.tsx` in shadcn's
registry contains `import { XIcon } from "lucide-react"`. Refusing the icon package
therefore means hand-editing every file the generator ever produces, forever, and
re-editing it after every `shadcn` upgrade. That is a recurring cost paid to avoid a
tree-shakeable dependency that eleven areas of screens will ask for anyway. This is
not the "speculative component library" the acceptance criterion forbids — that
criterion is about components, and the component list below is two.

### The contrast test needs no library at all

The acceptance criterion asks for contrast "asserted by a contrast test over the
token pairs rather than eyeballed". The temptation is a colour library. There is no
need for one: WCAG 2.2's contrast ratio is about twenty lines of arithmetic, and the
W3C publishes the formula normatively — linearise each sRGB channel, weight them
`0.2126 / 0.7152 / 0.0722`, and divide `(L1 + 0.05)` by `(L2 + 0.05)`.

I am not reasoning from first principles about whether that is enough, because **the
sibling project has already shipped exactly this**. `Fashio`'s
`packages/design-tokens/tests/tokens.test.ts` implements the WCAG formula in about
twenty-five lines with zero dependencies, cites the two W3C definitions in a comment,
runs under `vite-plus/test`, and asserts real ratios against real tokens. It also
catches a real defect the eye would not: it flattens a semi-transparent colour over
its background the way a browser composites it, and proves the result fails AA. A
library would not have found that; a hand-written test with a project-specific
assertion did.

DeanPOS improves on it in one way. Fashio keeps its tokens in a TypeScript module and
transcribes them by hand into the CSS `@theme` block, then needs a second test to
prove the transcription has not drifted. DeanPOS has no consumer that needs tokens in
JavaScript, so **`theme.css` is the single source and the test reads that file
directly.** There is no transcription, so there is no drift to guard against, and the
test asserts against the bytes that actually compile into both applications.

That carries one hard constraint, and it is a trap worth naming because the default
path walks straight into it: **colour tokens must be written as six-digit sRGB hex.**
shadcn's Tailwind-4 templates emit `oklch(...)`. WCAG's contrast definition is stated
on sRGB channel values, so an OKLCH palette would force a colour-space conversion into
the test — which is the colour-science dependency this whole section exists to avoid.
The generated palette gets replaced, not kept.

### The contrast test is not redundant with the accessibility check

Issue 06 requires an automated accessibility assertion through the happy-dom render.
It is worth stating why that does not make this test unnecessary, because someone will
otherwise ask.

**axe cannot check contrast in a virtual DOM.** Deque's own documentation says the
`color-contrast` rule is disabled when running against a virtual DOM, because there
is no layout and no `Range` API to sample rendered pixels with. happy-dom has the
same limitation, and its `getBoundingClientRect` is documented as returning zeros. So
the axe run in issues 06 and 07 will report contrast as *incomplete*, not as passing.
**The token-pair test in `packages/ui` is the only thing in the repository that
covers contrast at all.** That is the argument for it, and it is stronger than "the
criterion asked for it".

### Touch target: the number comes from the specification, not from taste

WCAG 2.2 introduced **SC 2.5.8 Target Size (Minimum)** at **Level AA**: "The size of
the target for pointer inputs is at least **24 by 24 CSS pixels**", with exceptions
for spacing, inline targets, user-agent-controlled targets, equivalents, and
essential presentations. The 44-pixel number that everyone reaches for is **SC 2.5.5
Target Size (Enhanced)**, which is **Level AAA**.

So there are two real numbers and DeanPOS needs both, because the two applications
are not the same problem:

- **`--min-target-size: 24px`** — the AA floor. Every interactive element in either
  application meets it. This is conformance, not preference.
- **`--min-touch-size: 44px`** — the AAA enhanced value, and the default for every
  interactive control in `apps/pos`. The terminal is operated with a thumb, at speed,
  by someone not looking carefully, and a mis-tap there rings up the wrong item on a
  real customer's bill.

Neither is a round number I picked; both are W3C normative values, which is precisely
what the brief asked for. The back-office keeps the AA floor because its own mock
draws a dense sidebar at roughly 34-pixel row pitch — applying the terminal's value
there would contradict the mock's density for no accessibility gain, since 34 already
clears 24 comfortably.

**Units are `px`, not `rem`.** The criterion is stated in CSS pixels. A `rem` value is
24 pixels only while the root font size is 16, and would silently become
non-conforming the day anyone changes it.

### The focus indicator, and a place where I deliberately exceed the target

WCAG 2.2 at Level AA requires only that the focus indicator be *visible* (SC 2.4.7).
It sets no thickness and no contrast. The numbers everyone quotes — a 2-pixel
perimeter at 3:1 — are **SC 2.4.13 Focus Appearance, which is Level AAA**. I checked
this specifically because it is widely misreported, and the record should not claim AA
requires something it does not.

I am adopting the AAA numbers anyway, and the reason is the acceptance criterion
itself: "visible" is not a testable property, and this issue is required to *assert*
its accessibility rather than claim it. 2 pixels at 3:1 is the only objective
definition the specification offers, it costs two token values, and it gives the
contrast test something to check.

It lives in `packages/ui/src/theme.css`, as a `@layer base` rule on `:focus-visible`
covering every focusable element in both applications with no per-component opt-in.
`:focus-visible` rather than `:focus`, so a mouse click does not draw a ring but a
keyboard tab always does. A focus treatment that each component has to remember to
apply is a focus treatment that eleven areas will forget.

### How `packages/ui` stays free of the domain — a rule you can grep

"Nothing domain-aware" is unfalsifiable as written, and ADR-0001 already names this
package as the drift risk. The enforceable version is an **import rule**:

> No file under `packages/ui/` may import from `contract`, `schemas`, `backend`,
> `@orpc/*`, or `@tanstack/*`.

That works because a component cannot know what a cart is without the cart's type,
and every domain type in DeanPOS lives in `packages/schemas`. One `rg` invocation
decides it, which is the same mechanism records 004 and 006 already rely on.

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×2 | Unlike records 002, 004 and 006, this is not invisible infrastructure. It *is* the touch target under a cashier's thumb, the contrast a manager reads a total through, and the focus ring a keyboard user navigates by. |
| Business impact | ×1 | Every candidate is free and permissively licensed. Nothing here separates them commercially. |
| Engineering cost and risk | ×2 | Package count, whether the wiring works under the aliased `vite`, and whether the generator fits this monorepo. |
| Reversibility | ×2 | Eleven areas of screens are built on these tokens. This is the headline risk and the section below is honest that one half of it is not cheap. |
| Evidence strength | ×2 | Tailwind 4 changed the configuration model. A confidently-wrong Tailwind-3 answer is the specific failure this record exists to prevent. |

Maximum possible total: 45.

## The options, ranked

| Rank | Option | User ×2 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Tailwind 4 shared `theme.css` + shadcn CLI + single `radix-ui` + hand-written contrast test + two primitives** | 5 (10) | 4 | 4 (8) | 4 (8) | 5 (10) | **40** |
| 2 | Same, but individual `@radix-ui/react-*` packages | 5 (10) | 4 | 3 (6) | 4 (8) | 4 (8) | **36** |
| 3 | Same, but a colour library for the contrast test | 5 (10) | 3 | 3 (6) | 4 (8) | 3 (6) | **33** |
| 4 | Tailwind 3 with a literal JS `presets` array | 4 (8) | 3 | 2 (4) | 2 (4) | 2 (4) | **23** |
| 5 | Defer — let issues 06 and 07 install what they hit | 1 (2) | 2 | 2 (4) | 5 (10) | 1 (2) | **20** |

**1. Tailwind 4 shared `theme.css`, shadcn CLI, single `radix-ui`, hand-written
contrast test, two primitives — chosen.** Five shipping packages plus one development
tool, across one workspace. It is the only option where every load-bearing claim was
checked against the source that owns it: the shared-theme pattern from Tailwind's own
"Sharing across projects" docs, `@source` resolution from the Tailwind pull request
that implemented it, the Radix imports read from shadcn's own registry source rather
than from its changelog, the 24-pixel threshold from the WCAG 2.2 Recommendation
itself, and the contrast implementation from a sibling repository that already runs
it. That verification is also what caught the `--base radix` trap, which would
otherwise have made the manifest wrong on the first command anyone ran. It scores 4
rather than 5 on engineering cost because two Tailwind behaviours could not be
verified by running them and are named in *What would make this decision wrong*; it
scores 4 on
reversibility for the reason the reversal section is explicit about — the primitives
are cheap to walk back and the Tailwind major is not.

**2. Individual `@radix-ui/react-*` packages.** Ranked second, and it is not a bad
option — it is what shadcn shipped until February 2026, so there is far more written
about it, and per-package installs make bundler tree-shaking marginally more obvious.
It loses on the manifest treadmill: every later area that adds a primitive also adds
a dependency line, which is eleven areas of diffs whose only content is a package
name. **This is also the fallback**, spelled out with exact versions below, if the
generator turns out to still emit split imports — and note that choosing it changes
nothing else in this record.

**3. A colour library for the contrast test.** Taken seriously because a hand-rolled
implementation of a published formula is normally exactly the mistake record 002
warned about with property-test generators. It fails here for a reason that does not
apply there: shrinking is genuinely hard and genuinely worth outsourcing, whereas the
WCAG contrast ratio is a closed-form expression printed in the specification, with no
edge cases, no state, and a sibling implementation already in production that this
project can read. Adding a package to compute one arithmetic expression is rung 6 of
the ladder when rung 2 already holds.

**4. Tailwind 3 with a literal `presets` array.** The option that satisfies the
acceptance criterion word-for-word, which is exactly why it had to be scored rather
than dismissed. It fails on every other axis. Tailwind 3 is the previous major; the
sibling project the PRD instructs this repository to copy runs 4.3.3; and choosing 3
means eleven areas of screens written against a configuration model that is already
superseded, with a forced migration later at a cost proportional to the number of
screens. Its reversibility score of 2 is the decisive number and it points the wrong
way — the migration debt is incurred immediately and compounds.

**5. Defer.** Included because it must be, and 10 of its 20 points come from
reversibility, which any do-nothing option maximises trivially — the same inflation
records 002, 004 and 006 each left visible rather than tuned away. It fails on the
facts: issue 05 exists precisely to make these choices once, and deferring hands them
to whichever of issues 06 and 07 hits them first, at speed, without this research —
after which the second application inherits whatever the first one picked, which is
the two-design-systems outcome `packages/ui` was created to prevent.

## What the implementer does

Exact, so nothing here is re-decided downstream. **Do not edit any manifest on the
strength of this record alone — this is the instruction for issue 05, not a change
to apply now.**

### Root `package.json` — the catalog block becomes

```json
"catalog": {
  "vite": "npm:@voidzero-dev/vite-plus-core@0.2.5",
  "vite-plus": "0.2.5",
  "fast-check": "4.9.0",
  "@orpc/contract": "1.14.13",
  "@orpc/client": "1.14.13",
  "@orpc/server": "1.14.13",
  "zod": "4.4.3",
  "react": "19.2.8",
  "react-dom": "19.2.8",
  "@types/react": "19.2.18",
  "@types/react-dom": "19.2.4",
  "tailwindcss": "4.3.3",
  "@tailwindcss/vite": "4.3.3",
  "lucide-react": "1.28.0"
}
```

### Per workspace — every line, explicitly

| Workspace | Package | Version | Section | Catalog? |
| --- | --- | --- | --- | --- |
| `packages/ui` | `radix-ui` | `1.6.7` | `dependencies` | **no** |
| `packages/ui` | `class-variance-authority` | `0.7.1` | `dependencies` | **no** |
| `packages/ui` | `clsx` | `2.1.1` | `dependencies` | **no** |
| `packages/ui` | `tailwind-merge` | `3.6.0` | `dependencies` | **no** |
| `packages/ui` | `lucide-react` | `catalog:` → `1.28.0` | `dependencies` | yes |
| `packages/ui` | `react` | `^19.2.8` | **`peerDependencies`** | n/a |
| `packages/ui` | `react-dom` | `^19.2.8` | **`peerDependencies`** | n/a |
| `packages/ui` | `react` | `catalog:` → `19.2.8` | `devDependencies` | yes |
| `packages/ui` | `react-dom` | `catalog:` → `19.2.8` | `devDependencies` | yes |
| `packages/ui` | `@types/react` | `catalog:` → `19.2.18` | `devDependencies` | yes |
| `packages/ui` | `@types/react-dom` | `catalog:` → `19.2.4` | `devDependencies` | yes |
| `packages/ui` | `shadcn` | `4.16.1` | `devDependencies` | **no** |
| `apps/pos` | `react` | `catalog:` → `19.2.8` | `dependencies` | yes |
| `apps/pos` | `react-dom` | `catalog:` → `19.2.8` | `dependencies` | yes |
| `apps/pos` | `ui` | `workspace:*` | `dependencies` | n/a |
| `apps/pos` | `tailwindcss` | `catalog:` → `4.3.3` | `devDependencies` | yes |
| `apps/pos` | `@tailwindcss/vite` | `catalog:` → `4.3.3` | `devDependencies` | yes |
| `apps/pos` | `@types/react` | `catalog:` → `19.2.18` | `devDependencies` | yes |
| `apps/pos` | `@types/react-dom` | `catalog:` → `19.2.4` | `devDependencies` | yes |
| `apps/backoffice` | *(identical to `apps/pos`)* | | | |
| `apps/backoffice` | `lucide-react` | `catalog:` → `1.28.0` | `dependencies` | yes |

`apps/backoffice` additionally declares `lucide-react` because its `☰` control at 390
lives in application code, not in a primitive.

**Licences, checked:** MIT for `radix-ui`, `clsx`, `tailwind-merge`, `tailwindcss`,
`@tailwindcss/vite`, `react`, `react-dom`, `shadcn`, and both `@types` packages;
**Apache-2.0** for `class-variance-authority`; **ISC** for `lucide-react`. All
permissive, none copyleft. Recorded because DeanPOS is commercial software and nobody
should have to re-check this later.

**`packages/ui` also gets an `exports` block:**

```json
"exports": {
  ".": "./src/index.ts",
  "./theme.css": "./src/theme.css"
}
```

### Which packages get a catalog pin, and which do not

Applying the test records 002, 004 and 006 established — *pin once, use many* — with
record 006's second condition for lockstep families.

**Pinned:**

- **`react`, `react-dom`.** Declared by `apps/pos`, `apps/backoffice`, and
  `packages/ui` once issues 06 and 07 land — three workspaces, and `apps/landing` in
  area 11. It passes the count test outright, and there is a stronger second reason:
  two copies of React in one tree is not duplication, it is a **runtime break** —
  hooks dispatch through module-level state, so a component rendered by one copy
  inside a tree owned by the other throws. One catalog line makes that impossible.
- **`@types/react`, `@types/react-dom`.** Same declarers. Two copies is a
  **type-level break**, exactly the argument record 006 made for `zod`: a
  `ReactNode` produced by one copy does not satisfy a `ReactNode` parameter typed by
  the other, and the error surfaces as an incomprehensible mismatch at a package
  boundary.
- **`tailwindcss` and `@tailwindcss/vite`.** Two declarers today, three in area 11.
  They are additionally a **lockstep pair** — `@tailwindcss/vite@4.3.3` depends on
  `tailwindcss@4.3.3` at an *exact* version — so this is record 006's `@orpc/*`
  condition, not just the count. Bumping one and not the other resolves two Tailwind
  copies and compiles the theme twice.
- **`lucide-react`.** `packages/ui` and `apps/backoffice`, so it passes on count. The
  user-facing reason is better than the count: two icon-set versions across two
  applications means the same concept is drawn two different ways, which is precisely
  the drift `packages/ui` exists to prevent.

**Not pinned — exact version inline, one declaring workspace forever:**

- **`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `shadcn`.**
  This is `pg`'s situation from record 004 and it gets `pg`'s answer. All five exist
  to build primitives, primitives live only in `packages/ui` by ADR-0001, and no
  application ever declares them. **Trigger to revisit:** a second workspace
  declaring any of them — and treat that need as evidence a primitive was built
  outside `packages/ui`, and check *that* before adding the pin.

### How the shared theme is wired — every file

**`packages/ui/src/theme.css`** — the preset. One file, four blocks:

```css
@source "./components";
@source "./lib";

@theme {
  /* Colour tokens, six-digit sRGB hex only — see the no-gos. */
  --color-background: #......;
  --color-foreground: #......;
  --color-card: #......;
  --color-card-foreground: #......;
  --color-primary: #......;
  --color-primary-foreground: #......;
  --color-secondary: #......;
  --color-secondary-foreground: #......;
  --color-muted: #......;
  --color-muted-foreground: #......;
  --color-accent: #......;
  --color-accent-foreground: #......;
  --color-destructive: #......;
  --color-destructive-foreground: #......;
  --color-border: #......;
  --color-input: #......;
  --color-ring: #......;

  /* Target size. Values from WCAG 2.2 SC 2.5.8 (AA) and SC 2.5.5 (AAA). */
  --min-target-size: 24px;
  --min-touch-size: 44px;

  /* Focus indicator. Values from WCAG 2.2 SC 2.4.13, adopted above the AA floor. */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

@utility target-min {
  min-inline-size: var(--min-target-size);
  min-block-size: var(--min-target-size);
}

@utility touch-min {
  min-inline-size: var(--min-touch-size);
  min-block-size: var(--min-touch-size);
}

@layer base {
  :focus-visible {
    outline: var(--focus-ring-width) solid var(--color-ring);
    outline-offset: var(--focus-ring-offset);
  }
}
```

The seventeen colour token names are not a menu — they are exactly the set the two
vendored components reference, and they use shadcn's own vocabulary so that a future
`shadcn add` drops in unmodified. **Do not invent a parallel naming scheme.** The
*values* are issue 05's to choose; this record fixes the names, the units, the
notation, and the assertions.

Spacing, type scale and radii tokens are Tailwind 4's defaults unless a mock forces
otherwise. The mocks are greyscale and explicitly say not to measure them, so there
is nothing to derive a custom scale from, and inventing one would be exactly the
"fresh value invented for this screen" the process forbids.

**`--min-target-size` and `--min-touch-size` are deliberately outside every Tailwind
namespace**, so they emit as plain custom properties and generate no utilities of
their own; the two `@utility` rules are the interface. My two research passes
disagreed about whether named `--spacing-*` keys generate utilities in 4.3, so this
shape sidesteps a question I could not settle. **Fallback if `@utility` in an
imported file misbehaves:** use Tailwind 4's variable shorthand at the call site —
`min-w-(--min-touch-size) min-h-(--min-touch-size)` — which needs **no change to any
token**, only to the class strings in the two components.

**`apps/pos/src/styles.css` and `apps/backoffice/src/styles.css`** — identical, two
lines each:

```css
@import "tailwindcss";
@import "../../../packages/ui/src/theme.css";
```

**Both apps' Vite config** — one plugin, identical:

```ts
import tailwindcss from "@tailwindcss/vite";
```

`@tailwindcss/vite@4.3.3` declares `peerDependencies.vite` as
`"^5.2.0 || ^6 || ^7 || ^8"`, and this repository resolves `vite` to
`npm:@voidzero-dev/vite-plus-core@0.2.5` — a package whose *declared* version is
`0.2.5`, which satisfies none of those ranges. **This produces an unmet-peer warning
and is not a defect.** I am not asserting that from principle: Fashio's `bun.lock`
shows `@tailwindcss/vite@4.3.3` with that exact peer range resolved against the same
`vite` alias, in a repository that builds. `@voidzero-dev/vite-plus-core@0.2.5`
bundles Vite `8.1.4`, so the real compatibility holds; only the version string
disagrees. **Issue 06 should expect the same warning from
`@vitejs/plugin-react@6.0.5`, whose peer is `vite: "^8.0.0"`.**

**`apps/landing` is deliberately outside `packages/ui` in this PRD.** It is scaffolded
only far enough to build and its content is area 11. When area 11 arrives it consumes
**the same `theme.css` unchanged**, through `@tailwindcss/postcss` rather than
`@tailwindcss/vite` — Tailwind documents the PostCSS plugin as the Next.js
integration, and the shared CSS file is integration-agnostic. It needs
`transpilePackages: ["ui"]` only if it also wants the React components, which the
marketing site probably does not. Recorded so area 11 does not re-decide it.

### How the primitives are obtained

Run the generator inside `packages/ui`. **The `--base radix` flag is not optional** —
Base UI is shadcn's default for new projects as of July 2026, and omitting the flag
generates components that import `@base-ui/react/*` and make every dependency line in
this record wrong:

```
vp exec -F ui shadcn init --base radix     # writes components.json only
vp exec -F ui shadcn add button sheet
```

`components.json` for Tailwind 4 leaves the `tailwind.config` field an **empty
string** — shadcn's documentation states this explicitly — with `css` pointing at
`src/theme.css`, `cssVariables: true`, `iconLibrary` set to `lucide`, and aliases
resolving inside `packages/ui`. Commit `components.json`: it is what makes every later
area's `shadcn add` produce the same shape, and it is the only durable record of the
`--base` choice.

Three things to do by hand afterwards, because the generator will get them wrong for
this repository:

1. **Replace the generated colour block entirely.** `shadcn init` emits an OKLCH
   palette. DeanPOS's tokens are six-digit sRGB hex, for the reason in the contrast
   section. Delete the generated `@theme inline` / `:root` indirection too — it exists
   to support a dark mode this PRD does not build, and it puts the real values in a
   block the contrast test would have to chase.
2. **Reconcile `packages/ui/package.json` by hand.** `shadcn add` installs dependencies
   itself and **no documented flag skips that**, so expect it to have written version
   ranges of its own. The versions in the table above are the versions, and the catalog
   is how this repository pins. Check the manifest and `bun.lock` diff before
   committing.
3. **Confirm the generated imports match.** Expected, and read from the current Radix
   base registry rather than inferred: `button.tsx` imports `{ Slot } from "radix-ui"`;
   `sheet.tsx` imports `{ Dialog as SheetPrimitive } from "radix-ui"` and
   `{ XIcon } from "lucide-react"`. The style-level dependency list for this base is
   exactly `["class-variance-authority", "lucide-react", "radix-ui"]`, which is the
   manifest above with `clsx` and `tailwind-merge` arriving via the `utils` item. If
   what lands on disk instead imports the split packages, **drop `radix-ui` and declare
   `@radix-ui/react-slot@1.3.3` and `@radix-ui/react-dialog@1.1.23`** in
   `packages/ui`'s `dependencies`, both un-pinned; nothing else in this record changes.
   If it imports `@base-ui/react/*`, the `--base` flag was missed — re-run `init`, do
   not adapt the manifest.

**If the CLI cannot be made to work against `vp` and this workspace layout, transcribe
the two component files from shadcn's documentation instead.** That fallback changes
no dependency, no version, and no token — the dependency set is invariant to how the
files arrive. Do not treat a failing generator as a reason to reopen this record.

### The exact minimum primitive set

**Two, plus the helper the generator installs alongside them.**

| Primitive | Why it is needed by issues 06 and 07 |
| --- | --- |
| `button` | Both shells. The terminal's `Lock` control, both shells' error-state retry, and every back-office nav entry — `asChild` is what lets a TanStack Router `<Link>` wear button styling without nesting an anchor in a button. |
| `sheet` | `design/lofi/backoffice/reports-summary-390.svg` draws the sidebar behind a `☰`. That is shell chrome and issue 07's nav skeleton, so it is in scope. It is built on Radix's Dialog, which brings the focus trap, Escape handling, `aria-modal`, scroll lock, and focus restoration — the parts of an off-canvas drawer that are AA-relevant and that hand-rolling gets wrong. |
| `lib/utils.ts` (`cn`) | Not a component; the helper every generated file imports. |

**Explicitly not installed, with the reason for each, so the next area does not
re-argue them:**

- **`alert`** — the "legible error state" both shells need is a `<div role="alert">`
  with token classes and a `<Button>`. shadcn's alert is a styled div with no
  behaviour; vendoring it buys nothing the mock asks for.
- **`separator`** — an `<hr>` or a border utility. Rung 4 of the ladder.
- **`collapsible`** — the back-office mock draws `Reports` expanded with no disclosure
  control, and `.scratch/reporting/PRD.md` says foundation's sidebar carries `Reports`
  as a single entry that *becomes* a group in area 7. There is no state to collapse.
- **`dropdown-menu`** — the tenant switcher `▾ Aling Nena's` has nothing to list until
  `tenancy-identity` exists. Render it as a static, non-interactive label; area 2
  installs the primitive when it has tenants.
- **`card`, `table`, `input`, `select`, `label`, `badge`, `tabs`, `tooltip`** — report
  and catalog content. Later areas.
- **`skeleton`, `sonner`/`toast`, `dialog`** — `design/lofi/README.md` lists loading
  states, most error states, and interaction treatments under "Not drawn, on purpose".
  There is nothing to build from, and `sheet` already vendors the Dialog primitive if
  a modal is ever needed.

### How the contrast test is implemented

One file, `packages/ui/tests/contrast.test.ts`, no dependencies. It reads
`../src/theme.css`, extracts every `--color-*: #rrggbb` declaration, implements the
two W3C definitions, and asserts a table of pairings.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

// WCAG 2.2 relative luminance and contrast ratio.
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
```

with `relativeLuminance` weighting the three linearised channels
`0.2126 / 0.7152 / 0.0722`, and `contrastRatio` returning
`(lighter + 0.05) / (darker + 0.05)`.

**The pairings asserted**, by role, at the thresholds WCAG 2.2 AA sets:

| Pairing | Threshold | Criterion |
| --- | --- | --- |
| `foreground` on `background` | 4.5 | 1.4.3 |
| `foreground` on `card`, `card-foreground` on `card` | 4.5 | 1.4.3 |
| `muted-foreground` on `background`, and on `muted` | 4.5 | 1.4.3 — it is body copy, not decoration |
| `primary-foreground` on `primary` | 4.5 | 1.4.3 — this is the `PAY` control |
| `secondary-foreground` on `secondary` | 4.5 | 1.4.3 |
| `accent-foreground` on `accent` | 4.5 | 1.4.3 |
| `destructive-foreground` on `destructive` | 4.5 | 1.4.3 |
| `border` on `background`, `input` on `background` | 3.0 | 1.4.11 |
| `ring` on `background`, on `card`, and on `primary` | 3.0 | 1.4.11, and the 2.4.13 figure adopted above |

**One assertion matters more than the individual ratios, and it is what stops this
test rotting:** the test must **fail if `theme.css` declares a `--color-*` token that
appears in no pairing.** Without that, adding a colour in area 4 silently adds an
unchecked colour. With it, the test grows with the palette and the failure message
tells the next implementer exactly what they forgot.

Assert with `toBeGreaterThanOrEqual` against the threshold, **not** `toBeCloseTo`
against a hand-written ratio. A ratio written by hand is a number that will be
"corrected" to match a changed colour; a threshold is the requirement.

### `packages/ui` gets no DOM test environment

The contrast test reads a file and does arithmetic — plain Node, no `happy-dom`, no
Testing Library, no `axe-core`. **The primitives are exercised through the shells'
seam tests in issues 06 and 07**, which is where the PRD's one seam already lives and
where a render is a real render of a real route. Adding a second, weaker render
harness inside `packages/ui` would duplicate the seam this project spent its
highest-value effort on. `packages/ui` therefore declares no test-environment
dependency at all.

### Standing exemption from code standard 2

`docs/agents/code-standards.md` rule 2 says a file exports exactly one component.
shadcn's `sheet.tsx` exports six. These two documents contradict, and the reviewer
would find it on issue 05, so it is settled here rather than mid-review:

> **Files under `packages/ui/src/components/` are exempt from code standard rule 2.**
> Every other file in the repository is not.

The reason is that the value of vendoring is that regeneration is a reviewable diff.
Splitting a generated file by hand destroys that permanently — every future
`shadcn add` and every `shadcn migrate` would diff against a structure upstream has
never seen. The exemption is narrow on purpose: it covers generated primitives, not
anything written by hand.

### No-gos

- **No colour value anywhere except `theme.css`.** No hex literal, no `rgb()`, no
  `oklch()` in a component, a route, a feature, or an inline style. This is what makes
  the contrast test meaningful; without it the test proves a palette nobody uses.
  `rg -n '#[0-9a-fA-F]{6}' apps packages --glob '!**/theme.css'` should return nothing.
- **No OKLCH, HSL, or `color-mix()` in the colour tokens.** Six-digit sRGB hex only,
  so the contrast test needs no colour-space conversion.
- **No `rem` for the two target-size tokens.** WCAG states the threshold in CSS
  pixels.
- **No import in `packages/ui` from `contract`, `schemas`, `backend`, `@orpc/*`, or
  `@tanstack/*`.** This is the greppable form of "nothing domain-aware".
- **No dark mode in this PRD.** Nothing asks for one, and it would double the contrast
  test's surface. If a later area adds one, it adds a second palette *and* a second
  pass of the same pairing table over it.
- **No second `cn`.** One helper, in `packages/ui/src/lib/utils.ts`, for the same
  reason there is one `roundLineTotal`.
- **No primitive added to `packages/ui` "because a later area will want it".** Each
  area installs what its own screens consume.
- **No `@tailwindcss/postcss` in `apps/pos` or `apps/backoffice`.** One Tailwind
  integration per application; `apps/landing` uses the PostCSS one in area 11 because
  Next.js has no Vite pipeline, and that is the only exception.

### What this constrains for issues 06 and 07 — very little, and one warning

- **React 19.2.8 constrains nothing downstream.** `@tanstack/react-router@1.170.18`
  peers `react >=18.0.0 || >=19.0.0`; `@tanstack/react-query@5.101.4` peers
  `react ^18 || ^19`; `radix-ui` and `@radix-ui/react-slot` peer
  `^16.8 || ^17.0 || ^18.0 || ^19.0`; `lucide-react` peers up to `^19.0.0`;
  `@testing-library/react@16.3.2` supports React 19. Every version issues 06 and 07
  would reach for accepts it.
- **The accessibility assertion is issue 06's to install, and it should be
  `axe-core` alone** — no wrapper. `vitest-axe` is on npm at `0.1.0` from four years
  ago with only a pre-release since, and its own README documents a happy-dom bug;
  `jest-axe` is Jest-only. `axe-core@4.12.1` has zero runtime dependencies and a
  documented `axe.run(container)` returning `{ violations, incomplete, ... }`, which is
  all the criterion needs. Note its licence is **MPL-2.0** — file-level copyleft,
  irrelevant for a development-only test tool, but worth knowing it is the one
  non-permissive licence in the front-end tree.
- **The happy-dom warning, stated plainly because it is the one thing that could
  surprise issue 06.** A 2023 happy-dom issue reporting an axe crash on
  `Node.prototype.isConnected` is still open. Current `axe-core` guards that
  assignment behind `if (!('isConnected' in window.Node.prototype))` and happy-dom does
  define that getter, so the crash should not occur — but **I could not find a recent
  first-party confirmation and am not claiming one.** If it does crash, the fix is a
  per-file `// @vitest-environment jsdom` directive on that one test, which changes
  nothing about the PRD's seam. Separately and definitely: **disable the
  `color-contrast` rule** in the axe run, because no virtual DOM can evaluate it, and
  point the comment at `packages/ui/tests/contrast.test.ts`, which is what actually
  covers contrast.
- **Every interactive element in `apps/pos` carries `touch-min`; every interactive
  element in `apps/backoffice` carries at least `target-min`.** Neither shell decides
  its own number.

## How to turn it back

This decision has three layers with very different reversal costs, and giving one
number for them would be the dishonest version of this section.

**Layer 1 — the primitives and their packages. Cheap, and it stays cheap.**

1. Write a superseding record; flip this record's `Status:` to `overturned` with the
   date and reason; update both lines in `LOG.md`.
2. Count the real cost first. `rg -l 'from "ui"' apps` is the number that **does not
   change** — applications import `Button` and `Sheet` by name and never learn what is
   underneath. The number that does change is
   `ls packages/ui/src/components/ | wc -l`, which is a couple of files today and
   perhaps twenty-five to thirty after eleven areas.
3. Rewrite those component files against the replacement primitive library, keeping
   every exported name and prop identical. Swap the five lines in `packages/ui`'s
   `dependencies`. `vp install`, commit the regenerated `bun.lock`.
4. Re-run the gate: `vp check; vp run -r check; vp run -r test`.

**What voids that estimate:** a Radix type appearing in an exported signature from
`packages/ui`, or an application importing `radix-ui` directly. Grep for both before
quoting the cost.

**Layer 2 — the token values. Free, permanently.**

Editing a colour, a size, or the ring width is one file, `theme.css`, and the contrast
test re-proves conformance on the same run. This is the entire point of tokens and it
is the one part of this record that does not get more expensive with time.

**Token *names* are the opposite.** They are written into class strings on every
screen, with no type system to catch a miss, so renaming one after eleven areas is a
repository-wide find-and-replace verified only by eye. That asymmetry is why this
record fixes the names now and leaves the values to issue 05.

**Layer 3 — the Tailwind major. Not cheaply reversible, and this is the honest part.**

Reversing Tailwind 4 → 3 means rewriting `theme.css` as a JavaScript preset *and*
rewriting every class string that uses v4-only syntax — the `(--var)` shorthand, the
`@utility` classes, the logical-property utilities. That is every screen in the
product, and it grows with every area merged. **After two or three areas this stops
being a reversal and becomes a rewrite.**

I am deciding it anyway rather than routing it to the human, and the reason is that
the reversal that matters is not backwards. Tailwind 4 is the current major, the
sibling project the PRD instructs this repository to copy already runs `4.3.3`, and
`@voidzero-dev/vite-plus-core@0.2.5` bundles a Vite that `@tailwindcss/vite@4.3.3`
supports. The realistic future move is 4 → 5, which is a documented upgrade with a
first-party codemod, not an unwinding. **The re-check trigger is Tailwind 5's
release**, at which point the number to weigh is how many screens exist.

**What is not touched by any of the three layers:** no migration, no schema, no
handler, no contract. Nothing on the server side of this repository knows that
`packages/ui` exists.

## What would make this decision wrong

- **shadcn's default base is already not Radix.** This is not a risk to watch for; it
  is the state today — Base UI became the default for new projects in July 2026, with
  React Aria as a third option. A later area running `shadcn add` in a workspace whose
  `components.json` has been lost, regenerated, or copied from a tutorial will silently
  emit a Base UI component, and `packages/ui` will then hold two primitive libraries
  and two focus-management implementations. **`components.json` staying committed and
  correct is what prevents this, and the emitted imports must be checked before
  committing any future `shadcn add`.** This is the single most likely way this record
  quietly stops being true.
- **`tailwind-merge` falls behind Tailwind.** `3.6.0` states support for Tailwind
  `4.0` through `4.3`, and this repository is on `4.3.3`. A Tailwind bump past `4.3`
  without a matching `tailwind-merge` release does not error — it **mis-merges class
  strings**, which presents as a component ignoring a `className` override. Treat the
  two as a pair when bumping.
- **A colour reaches a screen without going through a token** — an inline hex, an SVG
  `fill`, an image. The contrast test would stay green while the rendered page failed.
  The `rg` no-go above is the guard; if it ever returns a hit, this record's
  conformance claim is void until it is fixed.
- **`@utility` inside an imported CSS file does not behave as documented.** I verified
  it from Tailwind's documentation but not by running it. Symptom: `touch-min` and
  `target-min` produce no CSS. The fallback is written above and costs two class
  strings.
- **Non-namespaced `@theme` variables stop being emitted to `:root`.** The docs say
  `@theme` variables become CSS variables at `:root`, but they do not *guarantee* it
  for names outside a namespace. Symptom: `var(--min-touch-size)` resolves to nothing
  and the minimum sizes vanish silently. The fix is one line — move those three
  declarations from `@theme` to `:root` in the same file.
- **axe under happy-dom.** Covered above. Resolution is a one-line environment
  directive on one test file, not a change to this record.
- **Tailwind 5 ships.** Layer 3's re-check trigger.
- **A second copy of `react` or `@types/react` appears in `bun.lock`.** That is the
  failure the catalog pins exist to prevent, and it presents as either a hook
  dispatch error at runtime or an incomprehensible type mismatch at a package
  boundary — never as an install error.

## Evidence

**Repository, read 2026-08-02:**

- `.scratch/foundation/PRD.md` — stories 30, 31, 34, 35, 36; "Front-end shells"; the
  one seam; `apps/landing` scaffolded only far enough to build; "`packages/ui` drifts
  by accident, not by decision".
- `.scratch/foundation/issues/05-ui-tokens-and-primitives.md` — every acceptance
  criterion this record answers. `.../06-terminal-shell-and-test-seam.md` — the
  axe-or-equivalent criterion, the shell-chrome-only scope. `.../07-backoffice-shell.md`
  — the nav skeleton and the responsive range.
- `docs/adr/0001-stack-and-monorepo-shape.md` — `packages/ui` is "Tailwind preset,
  design tokens, shadcn primitives. **Primitives only**"; and the consequence that
  names it the drift risk. `docs/adr/0009-frontend-module-structure.md` rule 5 —
  "`src/components/` is app-shared, `packages/ui` is product-shared".
- `docs/agents/code-standards.md` rule 2 — the one-component-per-file rule this record
  grants a narrow exemption from, and rule 5's instruction to point at a decision
  record rather than re-argue it in a comment.
- `design/lofi/README.md` — "A mock fixes what is on the screen and in what order.
  Nothing else"; the "Not drawn, on purpose" list that rules out `skeleton` and
  `toast`. `design/lofi/backoffice/reports-summary-390.svg` — the `☰`, which is the
  whole reason `sheet` is in the minimum set.
  `design/lofi/backoffice/reports-summary-1440.svg` — the sidebar, the `Reports` group
  drawn with no disclosure control, and the tenant switcher.
  `design/lofi/pos/sale-grid-{1280,390}.svg` — the top bar, and "Cart becomes a bottom
  sheet", which belongs to `checkout` and not here.
- `.scratch/reporting/PRD.md` — "`foundation`'s sidebar carries one `Reports` entry,
  which becomes a group" in area 7. This is what rules out `collapsible`.
- Root `package.json` and all ten workspace manifests — **`react` is declared
  nowhere**, which is why this record names a version. Existing `catalog` block;
  `overrides: { vite: "catalog:" }`; `devEngines.packageManager` naming Bun 1.3.13.
- `vite.config.ts` — `lint.options.typeAware`, `run.cache`, and the root
  `test.setupFiles`. `packages/ui/{package.json,tsconfig.json,src/index.ts}` — the
  placeholder state this record replaces.
- `.scratch/decisions/002`, `004`, `006` — the catalog pin-once-use-many test, the
  no-pin-for-a-single-declarer precedent, and record 006's lockstep-family extension.
  Searched `.scratch/decisions/` for an existing record on Tailwind, shadcn, Radix,
  React, or design tokens before deciding: 001–006 only, none names any of them. **No
  duplicate.**

**Sibling project `../Fashio`, read 2026-08-02 — prior art for the toolchain, as the
PRD instructs:**

- `apps/storefront/package.json` — `tailwindcss@^4.3.3` and `@tailwindcss/vite@^4.3.3`,
  in a repository whose root `catalog` aliases `vite` to
  `npm:@voidzero-dev/vite-plus-core@0.2.5`, identically to DeanPOS.
- `bun.lock` — `@tailwindcss/vite@4.3.3` with `peerDependencies: { vite: "^5.2.0 || ^6
  || ^7 || ^8" }` resolved against that alias, and `tailwindcss@4.3.3` with zero
  dependencies. **This is the evidence that the unmet-peer warning is cosmetic**, and
  it is a fact about a working repository rather than an inference.
- `apps/storefront/src/styles/global.css` — `@import "tailwindcss"` followed by a
  hand-written `@theme` block with sRGB hex colours and per-token contrast reasoning
  in the comments.
- `packages/design-tokens/tests/tokens.test.ts` — the WCAG contrast implementation
  this record adopts: `channelToLinear` with the `0.04045 / 12.92 / ((c+0.055)/1.055)^2.4`
  form, `relativeLuminance` at `0.2126/0.7152/0.0722`, `contrastRatio` as
  `(lighter+0.05)/(darker+0.05)`, and both W3C definition URLs cited in the file. **Rung
  2 of the ladder holds: this is already solved, in this developer's own code,
  under this test runner.**
- Also read and **not** copied: Fashio's TypeScript-module-plus-transcription token
  shape, which exists to serve a React Email app DeanPOS does not have, and which
  needs a second test to guard the transcription.

**External, primary sources, accessed 2026-08-02.**

*W3C — WCAG 2.2 Recommendation and definitions:*

- <https://www.w3.org/TR/WCAG22/#target-size-minimum> — SC 2.5.8, **Level AA**: "The
  size of the target for pointer inputs is at least 24 by 24 CSS pixels", with the
  Spacing, Equivalent, Inline, User Agent Control and Essential exceptions. The source
  of `--min-target-size`.
- <https://www.w3.org/TR/WCAG22/#target-size-enhanced> — SC 2.5.5, **Level AAA**: "at
  least 44 by 44 CSS pixels". The source of `--min-touch-size`.
- <https://www.w3.org/TR/WCAG22/#contrast-minimum> — SC 1.4.3, Level AA: 4.5:1, with
  the 3:1 large-text exception.
- <https://www.w3.org/TR/WCAG22/#non-text-contrast> — SC 1.4.11, Level AA: 3:1 for
  "visual information necessary to identify user interface components and their
  current state". The source of the border, input and ring thresholds.
- <https://www.w3.org/TR/WCAG22/#focus-visible> — SC 2.4.7, Level AA: "the keyboard
  focus indicator is visible", **and nothing about thickness or contrast**.
- <https://www.w3.org/TR/WCAG22/#focus-appearance> — SC 2.4.13, **Level AAA**: "at
  least as large as the area of a 2 CSS pixel thick perimeter" and "a contrast ratio
  of at least 3:1 between the same pixels in the focused and unfocused states". The
  source of the two focus-ring token values, adopted above the required level and
  labelled as such.
- <https://www.w3.org/TR/WCAG22/relative-luminance.html> — the linearisation formula,
  the `0.2126 / 0.7152 / 0.0722` coefficients, and `(L1 + 0.05) / (L2 + 0.05)`.

*Tailwind CSS:*

- <https://tailwindcss.com/docs/theme> — the "Sharing across projects" section, whose
  worked example is a package's `theme.css` holding `@theme` and an application's
  `app.css` doing `@import "tailwindcss"` then `@import "../brand/theme.css"`. **This
  is what "a preset both applications extend" means under Tailwind 4.** Also the
  namespace table, and "Theme variables are converted to regular CSS variables at
  `:root`".
- <https://tailwindcss.com/docs/upgrade-guide> — "JavaScript config files are still
  supported for backward compatibility, but they are no longer detected automatically
  in v4."
- <https://tailwindcss.com/docs/detecting-classes-in-source-files> — automatic
  detection "automatically ignores ... `node_modules`", and `@source` as the explicit
  registration for a library's files.
- <https://github.com/tailwindlabs/tailwindcss/pull/14446> — "the relative root should
  always be relative to the CSS file that contains the directive", with the base
  overwritten on every `@import` substitution. **The property that makes the shared
  `@source` work with no per-application configuration.**
- <https://tailwindcss.com/docs/adding-custom-styles> and
  <https://tailwindcss.com/docs/functions-and-directives> — `@utility` syntax, and
  that custom utilities support Tailwind's variants.
- <https://tailwindcss.com/blog/tailwindcss-v4> — the arbitrary-value shorthand
  changing from `bg-[--brand-color]` to `bg-(--brand-color)`. The fallback syntax above.
- <https://tailwindcss.com/docs/installation/framework-guides/nextjs> — Next.js uses
  `@tailwindcss/postcss`. The area-11 path.
- <https://tailwindcss.com/docs/installation/using-vite> — `@tailwindcss/vite` as the
  Vite integration.

*shadcn/ui and Radix:*

- <https://ui.shadcn.com/docs> — "This is not a component library. It is how you build
  your component library."
- <https://ui.shadcn.com/docs/tailwind-v4> — "For Tailwind CSS v4, leave the
  `tailwind` config empty in the `components.json` file."
- <https://ui.shadcn.com/docs/monorepo> — "Every workspace must have a
  `components.json` file"; keep `style`, `iconLibrary` and `baseColor` identical
  across workspaces.
- <https://ui.shadcn.com/docs/changelog/2026-02-radix-ui> — the migration from
  `import * as DialogPrimitive from "@radix-ui/react-dialog"` to
  `import { Dialog as DialogPrimitive } from "radix-ui"`.
- <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default> and
  <https://ui.shadcn.com/docs/changelog/2026-07-react-aria> — **Base UI is the default
  base for new projects as of July 2026**; Radix remains supported; existing projects
  keep their base. The reason `--base radix` is mandatory.
- <https://ui.shadcn.com/docs/installation> — `shadcn init --base radix|base|aria`.
- <https://ui.shadcn.com/docs/cli> — the `add` command "add[s] components and
  dependencies to your project"; documented flags are `--dry-run`, `--diff`, `--view`,
  `--yes`, `--overwrite`, `--all`, `--silent`, and **none of them skips the dependency
  install**.
- <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/radix/ui/button.tsx>
  — `import { Slot } from "radix-ui"`.
- <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/radix/ui/sheet.tsx>
  — `import { Dialog as SheetPrimitive } from "radix-ui"` and
  `import { XIcon } from "lucide-react"`. **This is the line that settles the icon
  question**: the generated file imports it, so refusing the package means editing
  generated output forever.
- <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/sheet.tsx>
  — the same component importing `@base-ui/react/dialog`, which is what the default
  base would have produced.
- <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/_registry.ts>
  — the style-level dependency list `["class-variance-authority", "lucide-react",
  "radix-ui"]`, and `dependencies: ["radix-ui"]` on both `button` and `sheet`.
- <https://radix-ui.com/docs/primitives/overview/getting-started> — "We recommend
  installing the `radix-ui` package and importing the primitives you need", and the
  per-primitive subpaths for tree-shaking.

*Registry metadata, read from `registry.npmjs.org/<pkg>/latest`:*

`react` **19.2.8** MIT · `react-dom` **19.2.8** MIT, peer `react ^19.2.8` ·
`@types/react` **19.2.18** MIT · `@types/react-dom` **19.2.4** MIT ·
`tailwindcss` **4.3.3** MIT, no runtime dependencies ·
`@tailwindcss/vite` **4.3.3** MIT, depends on `tailwindcss@4.3.3` exactly, peer
`vite "^5.2.0 || ^6 || ^7 || ^8"` ·
`@tailwindcss/postcss` **4.3.3** MIT, **no peer dependencies** ·
`radix-ui` **1.6.7** MIT · `@radix-ui/react-slot` **1.3.3** and
`@radix-ui/react-dialog` **1.1.23**, both MIT, both peering
`react "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc"` ·
`class-variance-authority` **0.7.1** **Apache-2.0**, depends only on `clsx ^2.1.1` ·
`clsx` **2.1.1** MIT, zero dependencies · `tailwind-merge` **3.6.0** MIT, zero
dependencies, states Tailwind `4.0`–`4.3` support ·
`lucide-react` **1.28.0** **ISC**, peer `react "^16.5.1 || ^17 || ^18 || ^19"` ·
`shadcn` **4.16.1** MIT · `axe-core` **4.12.1** **MPL-2.0**, zero runtime
dependencies · `@testing-library/react` **16.3.2** MIT ·
`@tanstack/react-router` **1.170.18** MIT, peer `react ">=18.0.0 || >=19.0.0"` ·
`@tanstack/react-query` **5.101.4** MIT, peer `react "^18 || ^19"` ·
`@vitejs/plugin-react` **6.0.5** MIT, peer `vite "^8.0.0"` ·
`@voidzero-dev/vite-plus-core` **0.2.5**, bundling `vite 8.1.4` and `rolldown 1.1.5` ·
`vite-plus` **0.2.5**, with `vitest 4.1.10` in its own `dependencies`.

*axe and the virtual DOM:*

- <https://github.com/dequelabs/axe-core/blob/develop/doc/examples/jest_react/README.md>
  — "to work better with JSDOM (which has limited support for necessary DOM APIs), the
  color-contrast and link-in-text-block rules have been disabled".
- <https://github.com/dequelabs/axe-core/issues/595> — the missing `Range` API is why
  colour contrast cannot be evaluated in a virtual DOM.
- <https://raw.githubusercontent.com/dequelabs/axe-core/develop/lib/core/imports/polyfills.js>
  — the `isConnected` polyfill is guarded by
  `if (window.Node && !('isConnected' in window.Node.prototype))`.
- <https://raw.githubusercontent.com/capricorn86/happy-dom/master/packages/happy-dom/src/nodes/node/Node.ts>
  — happy-dom defines `isConnected` as a getter on the prototype, which is what that
  guard tests for.
- <https://github.com/capricorn86/happy-dom/issues/978> — open since 2023, last
  activity April 2026, no recent confirmation either way.
- <https://github.com/dequelabs/axe-core/blob/develop/doc/API.md> — `axe.run` and its
  `{ violations, incomplete, passes, inapplicable }` result shape.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and
no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **`ui.shadcn.com/r/button.json` and `/r/sheet.json` both return 404.** The item JSON
  was read from the repository's registry source instead, which is the thing that
  actually generates it — so the import lines above are read, not inferred. Recorded
  because a reader trying to re-verify from the documented registry URL will hit the
  same 404.
- **Whether `shadcn add` writes `package.json` is not documented**, and no flag to skip
  its dependency install is documented either. Hence the instruction to reconcile the
  manifest by hand and read the lockfile diff rather than trusting it.
- **Tailwind's `@import` of a bare *workspace* package specifier is undocumented.**
  Published npm packages are documented to work; workspace names are not mentioned
  either way, and Tailwind's own discussions show relative paths being used in
  monorepos. Hence the relative import, which also happens to be the better answer for
  `@source` resolution.
- **My two research passes contradicted each other on whether named `--spacing-*` keys
  generate utilities in Tailwind 4.3.** Rather than pick a side, the token names were
  chosen to sit outside every namespace, which makes the question moot.
- **No first-party statement recommending jsdom over happy-dom for axe** exists from
  Deque, Testing Library, or Vitest. The guidance about virtual DOMs is generic; the
  happy-dom-specific claim is a three-year-old open issue with no recent
  reproduction. Recorded as an unknown rather than as a finding.
- **No recorded contrast-ratio implementation was found anywhere in DeanPOS**, so this
  record is not re-deciding one — the only prior art is the sibling's, and it is cited
  above rather than paraphrased.
