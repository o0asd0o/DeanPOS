# 12 — A styling standard, and a test that enforces it

**Status:** done — rule 6 written, and the guard rebuilt on a real AST after the human ruled.

**This issue was escalated twice and the second escalation changed the design.** The history below
is kept because it is the evidence for record 016, not as a record of thrash.

The guard was a line-oriented text scanner. It was rebuilt five times; each round closed one class
of defect and revealed another, and every prescribed fix was a step toward a parser written by hand.
The last text version threw on valid code — a `className=` inside a comment failed the build — which
is worse than the hole it closed, because the first agent to hit a false rejection deletes the test.

**The human ruled twice.** First: scan `className` contents only, and prohibit a `className` being
assembled outside the attribute — the two together make the guard sound rather than merely quieter,
because narrowing the scan alone just moves the hiding place into a variable. Then, when text
scanning failed again: adopt a parser. `.scratch/decisions/016` chose `@typescript/typescript6`,
Microsoft's first-party shim, because this repo's `typescript@7.0.2` is the native Go port with no
`createSourceFile`. One devDependency, one declarer, one import site.

`test-seam.ts` went 403 → 275 lines: the entire hand-rolled lexer deleted, the value-detection
regexes kept. All five outstanding defects closed as a consequence of parsing rather than as five
more special cases. 54 assertions in `test-seam.test.ts`.

**What the guard still cannot see, stated rather than papered over:** a class assembled inside an
imported function, or a value arriving through a prop at runtime. It catches the mistake that will
actually happen thirty times — someone typing a hex into a `className` — and it no longer fails
silently or falsely.

**The recurring defect worth remembering:** four separate rounds found the written rule and the
executable rule disagreeing. An implementer reads the comment, not the code.

<details><summary>The five text-scanner rounds, kept as evidence</summary>

1. Round 1 — a prefixed-utility regex missed Tailwind *arbitrary properties* (`[color:red]`).
2. Round 2 — the unprefixed pattern false-positived on three valid Tailwind variants and on an
   unspaced TypeScript index signature, and still missed a *nested* arbitrary property.
3. Round 3 — balanced outer-bracket scanning fixed all six of those, and then failed on strings and
   tuples. **Verified by running the exported helper, not by reading the regex:**

   | Input | Wanted | Got |
   | --- | --- | --- |
   | `const classes = ["[color:red]"];` | flag | **passes** — false negative |
   | `const classes = ["[&:hover]:underline"];` | pass | **flags** — false positive |
   | `type Result = [ok: string] \| [error: Error];` | pass | **flags** — false positive |

   The scanner treats an enclosing JS array literal or a TS labelled tuple as a Tailwind candidate,
   and skips the nested group that actually holds the raw value.

4. Round 4 — after narrowing to `className`, string concatenation, `cn(identity("bg-[#fff]"))`,
   `style={s}` and a comment brace all slipped; fail-closed was added, and *that* introduced throws
   on valid files.
5. Round 5 — comments, template literals and regex literals containing `className=` broke the build;
   JSX spreads, commented-out `cva` bindings and local `*Variants` functions all passed.

</details>

## What to build

`docs/agents/code-standards.md` is what the `reviewer` grades against. It has five rules — change
scope, one component per file, helper placement, routes versus features, commenting — and **not one
word about styling**. Nothing today stops an implementer writing `bg-[#35CCA6]` or `p-[13px]` into a
screen.

That gap matters more here than in a repository a person types into. Areas 2 through 12 are roughly
thirty screens, and they are written by pipeline agents reading an issue and a mock. A convention
nobody wrote down is a convention no implementer was ever told, and the drift will not announce
itself — it arrives as the fourth slightly-different table.

Two additions, and both are needed. The written rule teaches; the test catches. A rule with no test
is forgotten by area 4. A test with no rule gets worked around by a fixer who never learned why it
exists.

## Acceptance criteria

- [ ] A new numbered section in `docs/agents/code-standards.md`, after rule 5 and before *"When this
      file and the existing code disagree"*. It says: colour, spacing, type, radii, and shadow come
      from `packages/ui` tokens; no raw hex and no arbitrary Tailwind values in application code; use
      the shared part where one exists rather than restyling a `<div>` into a near-copy of it. Match
      the file's existing voice — short, specific, and it explains *why* once rather than repeating
      the rule three ways.
- [ ] That section names the accent constraint from ADR-0013 explicitly, because it is the one a
      reasonable implementer will otherwise get wrong: the status accents are dots, chart series, and
      icons on a pale tint of themselves. **They never sit under text.** Reaching for a green
      background and putting a label on it is the predictable mistake.
- [ ] An assertion helper in `packages/ui` — `assertNoRawDesignValues(dir)` or similar — mirroring
      how `api/src/test-seam-react.tsx` already serves `no-server-imports.test.ts` in both apps. The
      design system owning the design guard is the coherent home for it.
- [ ] **Its import path is declared, and it is not the package root.** `packages/ui/package.json`
      exports only `.` and `./theme.css` today. Add a `./test-seam` export rather than re-exporting
      through `src/index.ts` — the root is the component surface issue 13 is also editing, and
      routing a test helper through it creates a collision the `Relevant files` sets do not predict.
      A deep import into an undeclared subpath will simply fail to resolve.
- [ ] A thin test in each app consuming that helper over its own `src/`, mirroring
      `apps/{pos,backoffice}/tests/no-server-imports.test.ts`.
- [ ] The helper fails on six- and three-digit hex literals, and on **every** Tailwind arbitrary
      value — `-[13px]`, `-[#fff]`, `-[oklch(...)]`, and equally `shadow-[...]`,
      `grid-cols-[repeat(3,minmax(0,1fr))]`, `w-[calc(...)]`. Not a subset of them. A check that
      rejects lengths and colours only is narrower than the rule it enforces, which means the
      standard says one thing and the gate permits another — and the gate is what an unattended
      implementer actually learns from.
- [ ] It does **not** fail on arbitrary **variants and selectors** — `[&_svg]:size-4`,
      `[data-state=open]:`, `[aria-invalid]:`. Those are how shadcn components are written and have
      nothing to do with design values. Getting this boundary wrong makes the test useless in either
      direction: too tight and every pulled component trips it, too loose and it catches nothing.
- [ ] A narrow escape hatch, with the syntax fixed **here** rather than invented by whoever needs it
      first: `// design-exempt: <reason>` on the line immediately above the offending line, where
      `<reason>` is at least four words. Anything else — a different marker, a trailing comment, an
      empty reason — does not suppress. Without a hatch the first legitimate one-off blocks the
      pipeline and the fixer's cheapest move is deleting the test; without a fixed syntax every agent
      invents its own and the reviewer has nothing to grep. The reviewer judges whether reasons are
      good; the test only checks one is present and non-trivial.
- [ ] Scope is `apps/pos/src` and `apps/backoffice/src` — named explicitly, not globbed as
      `apps/*/src`, which would silently include `apps/landing`. Landing is out of scope for the
      whole theme (ADR-0013) and gets its guard in area 11; the standard says so rather than leaving
      a glob to imply coverage that does not exist.
- [ ] The helper also fails on `style={{ ... }}` in application code. Without it the written rule and
      the gate diverge again by a different route: `style={{ padding: 13 }}` is a raw design value the
      class-name check cannot see. A blanket ban is right here — inline style has no legitimate use in
      these two apps today, and the escape hatch covers the day it does.
- [ ] `packages/ui/src/components/` is excluded: those files are
      CLI-generated, record 007 already grants them an exemption from code-standards rule 2 to keep
      the regeneration diff reviewable, and they are five files reviewed by hand rather than thirty
      written unattended.
- [ ] The test is proved to bite — a raw value added temporarily, the failure observed, the value
      removed — and that proof is in the build report. Issue 09 set this precedent for guard tests.
- [ ] `check` and `test` pass across the repository.

## Depends on

- 11 — The token layer: re-roled palette, Manrope, and two densities

## Relevant files

- `docs/agents/code-standards.md`
- `packages/ui/src/test-seam.ts` (new)
- `apps/pos/tests/design-values.test.ts` (new)
- `apps/backoffice/tests/design-values.test.ts` (new)

## Comments

_Written from the `/grill-with-docs` session of 2026-08-02. Decision: `docs/adr/0013`._

**Name the ceiling in a `ponytail:` comment rather than pretending there isn't one.** This is a
regex over source text. It bans `style={{` outright, but it still cannot see a colour assembled at
runtime or a value arriving through a prop. It catches the mistake that will actually happen thirty
times — someone typing a hex into a `className` — and it is not a proof of token purity. Claiming
more than that in the report is worse than the gap.

**Depends on 11 for the standard's wording, not for the test's logic.** The prohibition is
value-shaped and does not care what the tokens are, but a standard that cannot name the tokens it
points at is a standard nobody can follow.

**Round 1 fix (applied all three findings):**

1. **Blocking — arbitrary properties.** Added `ARBITRARY_PROPERTY =
   /(?<![\w-])\[[^\]\s[]*:[^\]\s[]*\]/` in `packages/ui/src/test-seam.ts` alongside the existing
   prefixed pattern. It requires no utility prefix before `[` and a colon inside the brackets,
   which is what separates `[color:red]` from a selector or variant. Excluding `[` from the
   content classes was necessary to stop the pattern crossing into a nested bracket — the first
   version false-positived on shadcn's `[&_svg:not([class*='size-'])]:size-4` in
   `packages/ui/src/components/button.tsx`, matching from the outer `[` to the inner `]`.
   Tightening it (rather than exempting) fixed that. Updated the `ponytail:` comment on the new
   pattern to name this ceiling instead of restating the old one.
2. **Should-fix (Spec) — scope.** Rule 6 in `docs/agents/code-standards.md` now states the guard's
   scope explicitly: `apps/pos/src` and `apps/backoffice/src`, `apps/landing` excluded and covered
   by its own guard in area 11.
3. **Should-fix (Standards) — behaviour tests.** Added `packages/ui/tests/test-seam.test.ts`
   (16 tests) exercising `assertNoRawDesignValues` directly against temp-directory fixtures:
   must-fail cases (arbitrary property, arbitrary property with a unit, prefixed arbitrary value,
   6- and 3-digit hex, inline style), must-pass cases (arbitrary variant, attribute selector,
   selector without a value, the `supports-[display:grid]:grid` variant-with-inner-colon case,
   array indexing, ordinary token classes), and the escape hatch (valid exemption suppresses;
   under-four-words, trailing-comment placement, and a different marker all do not). The two app
   tests are unchanged — still the thin clean-tree assertions.

**Verification against real TypeScript:** ran the guard over `apps/pos/src`, `apps/backoffice/src`,
and `packages/ui/src`. Both apps: clean. `packages/ui/src` flags only `test-seam.ts:13` — the
`INLINE_STYLE` regex literal matching its own source text; `packages/ui/src/components/` is
excluded from the guard's scope by the issue and is clean now that the pattern is tightened.
Checked the TS index-signature edge case named in the finding directly: `{ [key: string]: T }`
(prettier's spacing) does not match — the space after `:` falls outside `[^\]\s[]*`. `{
[key:string]: T }` (no space) would match; no such construct exists in the scanned trees, and
prettier enforces the space, so this is not live risk today.

**Proof of bite (arbitrary property specifically):** added
`export const X = () => <div className="[color:red]" />;` to `apps/pos/src`, ran `vp test` in
`apps/pos` — `tests/design-values.test.ts` failed with `Raw design values found in:
src/App.tsx:1`. Removed the file; reran — clean.

**Gate:** `vp run -w codegen` (Prisma + tsr generate, ok), `vp check` (all files formatted, no
lint/type errors), `vp run -r check` (all 10 packages/apps pass), `vp run -r test` (10/10, all
green, including the 16 new tests). No `relation "Ping" does not exist` — no migration issue hit.

Commit `abb244c` on `f12-styling-standard`.

---

**Implementer report (branch `f12-styling-standard`).**

Added `docs/agents/code-standards.md` rule 6 (tokens over raw hex/arbitrary Tailwind values,
the shared-part-before-restyling line, and ADR-0013's accent-under-text trap named explicitly),
`packages/ui/src/test-seam.ts` exporting `assertNoRawDesignValues(dir)`, a `./test-seam` export
in `packages/ui/package.json`, and a `design-values.test.ts` in each of `apps/pos/tests/` and
`apps/backoffice/tests/`, importing from `"ui/test-seam"`.

**Guard's exact matching rules** (all regex over raw source text, `.tsx?` files only):
- `HEX_LITERAL = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/` — 3- or 6-digit hex, not
  part of a longer run.
- `ARBITRARY_VALUE = /[\w-]+-\[[^\]\s]*\](?!:)/` — a word/hyphen run immediately followed by
  `-[...]` with no trailing colon. This is what separates Tailwind's arbitrary-*value* syntax
  (`bg-[#fff]`, `p-[13px]`, `shadow-[...]`, `grid-cols-[repeat(3,minmax(0,1fr))]`, `w-[calc(...)]`
  — always the end of the class token) from arbitrary *variant/selector* syntax (`[&_svg]:size-4`,
  `[data-state=open]:`, `[aria-invalid]:`, and the `data-[state=open]:` form already used in
  `packages/ui/src/components/`) — variants are always followed immediately by `:`.
- `INLINE_STYLE = /style=\{\{/` — unconditional ban, per the issue.
- Escape hatch: `EXEMPT_COMMENT = /^\s*\/\/\s*design-exempt:\s*(.+)$/` on the line immediately
  above, reason split on whitespace and required to have 4+ non-empty words.
- Scope: the helper takes a `dir` and both app tests call it with `"src"` from inside
  `apps/pos` / `apps/backoffice` respectively — `apps/pos/src` and `apps/backoffice/src` only,
  never a glob, `apps/landing` and `packages/ui/src/components/` never reached.

**Proof the guard bites.** Temporarily edited `apps/pos/src/components/ErrorState.tsx`: added
`bg-[#35CCA6]` to a `className` and `style={{ padding: 13 }}` on the `Button`, ran `vp test` in
`apps/pos` — `design-values.test.ts` failed with `Raw design values found in:
src/components/ErrorState.tsx:12` and `:15`, both lines correctly identified. Then re-tested the
escape hatch: replaced the offenders with a `const probe = "#35CCA6"` preceded by
`// design-exempt: temporary probe for the guard's escape hatch` on the line above, plus a
`data-[state="open"]`-style attribute and `tap-target` — `vp test` passed (4/4), confirming the
exemption suppresses and the existing `tap-target`/attribute usage does not false-positive.
Reverted with `git checkout -- apps/pos/src/components/ErrorState.tsx`; `git status` confirmed a
clean tree before committing.

**`ponytail:` comment, verbatim** (`packages/ui/src/test-seam.ts`): "a regex over source text,
not a CSS parser or a runtime check — it cannot see a colour assembled dynamically or a value
arriving via a prop. It catches the raw hex / arbitrary-value mistake, nothing more." No claim of
token purity.

**Gate**, all run from the worktree with the PATH prepend:
- `vp run -w codegen` — Prisma + both apps' `tsr generate`, clean.
- `vp check` — 130 files formatted, 94 files lint/type clean.
- `vp run -r check` — all 10 workspace packages/apps pass.
- `vp run -r test` — all packages/apps pass, including the two new `design-values.test.ts`
  (1/1 each) alongside the existing suites (pos 4/4, backoffice 5/5 total across all app tests).

**Self-check via `/code-review`** (Standards + Spec sub-agents against `main...HEAD`): Standards
flagged two comments in `test-seam.ts` exceeding rule 5's three-line ceiling — fixed by trimming
both to 2–3 lines. It also flagged the phrase "forgotten by area 4" in the new rule 6 as an
undefined term relative to this file's own rule-numbering vocabulary; reworded to "forgotten a
few screens in" (the issue's own wording refers to PRD *areas*, a different vocabulary than this
file's numbered *rules*, and the file never defines "area"). It also noted the two app-level
`design-values.test.ts` files are byte-identical — a `Duplicated Code` judgement call, but below
rule 3's two-or-more-callers-in-one-folder threshold since they live in different apps; left as
is, matching the existing `no-server-imports.test.ts` precedent exactly. Spec review confirmed
the guard's regex logic against every must-fail/must-not-fail example in the acceptance criteria
by hand and found no mismatch, confirmed scope and import-path criteria are met by construction,
and flagged that the "proof it bites" needed to land in the build report — it now has, above.

**Nothing in the issue could not be implemented as written.**

---

**Round 2 fix (final round — both findings applied).**

1. **Blocking — nested-bracket false positives/negatives.** Replaced the `ARBITRARY_PROPERTY`
   regex in `packages/ui/src/test-seam.ts` with `hasArbitraryProperty(line)`: for each `[`,
   scan forward tracking bracket depth to the matching outer `]`. If that `]` is followed by
   `:`, it's a variant — ignore. Otherwise, if the content at depth 1 (the outer bracket's own
   level, not inside any nested bracket) contains a `:`, it's an arbitrary property — flag.
   This is balanced-bracket scanning, not another lookahead. Verified against all six reviewer
   rows: `[&:hover]:underline`, `[@supports(display:grid)]:grid`, and
   `[&[data-state="open:now"]]:block` now pass (outer close followed by `:`, even with a nested
   bracket inside); `[grid-template-columns:[a]_1fr_[b]_2fr]` now fails (top-level colon, no
   trailing `:`); `{ [key:string]: T }` now passes with no formatter dependency (its outer
   close is followed by `:`, regardless of the missing space) — the previous version relied on
   prettier inserting a space, which `vp test` does not guarantee; the shipped shadcn selector
   `[&_svg:not([class*='size-'])]:size-4` still passes. Added all six as regression cases in
   `packages/ui/tests/test-seam.test.ts` (test count 16 → 22): five to the must-pass table, one
   (the nested-bracket property) to the must-fail table.
2. **Minor — escape-hatch boundary untested.** Changed the "under four words" fixture in
   `test-seam.test.ts` from a two-word to a three-word reason (`brand mark colour`), so the
   `>= 4` boundary is actually exercised — a wrong `>= 3` would now fail this test.

**Self-check on the new code:** the new `hasArbitraryProperty` comment ran 4 lines on first
draft (rule 5's ceiling is 3); trimmed to 3 before committing.

**Re-proof against real trees**, `assertNoRawDesignValues` called directly via a scratch script
(not through the app tests, so `apps/landing` and `packages/ui/src/components/` scoping is
unaffected):
- `apps/pos/src` → clean
- `apps/backoffice/src` → clean
- `packages/ui/src` → clean (round 1 flagged `test-seam.ts:13` — its own comment contained
  the literal `[color:red]`; the comment was rewritten for this round's fix and no longer
  contains a bracket literal, so nothing trips now. Not a deliberate fix — a side effect of
  rewording the comment. Still outside the guard's declared scope either way.)

**Proof of bite (round 2, the exact defect class from the finding):** temporarily added
`[&:hover]:underline [grid-template-columns:[a]_1fr_[b]_2fr]` to the `className` on
`apps/pos/src/components/ErrorState.tsx:12`, ran `vp test` in `apps/pos` —
`design-values.test.ts` failed with `Raw design values found in: src/components/ErrorState.tsx:12`,
correctly flagging only the nested arbitrary property and not the valid variant on the same
line. Reverted with `git checkout -- apps/pos/src/components/ErrorState.tsx`; `git status`
confirmed a clean tree before committing.

**Gate**, all run from the worktree with the PATH prepend:
- `vp run -w codegen` — Prisma + both apps' `tsr generate`, clean.
- `vp check` — 131 files formatted, 95 files lint/type clean.
- `vp run -r check` — all 10 workspace packages/apps pass.
- `vp run -r test` — all packages/apps pass; `packages/ui` 65/65 (test-seam.test.ts 22/22),
  both apps' `design-values.test.ts` 1/1 each, all other suites unchanged and green.

Root checkout at `/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS` confirmed
clean and on `main` before finishing.

---

**Human ruling applied (branch `f12-styling-standard`, rebased onto `main` at `13e159a`).**

The human widened the acceptance criteria rather than asking for a fourth regex round. Two rulings,
both applied in `packages/ui/src/test-seam.ts`:

**Ruling 1 — scan `className` contents only.** `assertNoRawDesignValues` no longer reads a file's
TypeScript as undifferentiated text. It regex-locates every `className=` occurrence, then extracts
the attribute's value — a quoted string, or the balanced `{...}` expression container — using
string-aware bracket matching (`matchBalanced`/`skipString`, both kept from round 2). Only that
extracted text is scanned by the existing hex/prefixed-arbitrary-value/`hasArbitraryProperty`
logic, which is otherwise untouched. `style={{ ... }}` stays banned by the same unconditional
line-regex as before, independent of the className logic.

This dissolves the three defects structurally: `const classes = ["[color:red]"]` and
`type Result = [ok: string] | [error: Error]` are never inside a `className`, so they are never
visited at all — not filtered out by a smarter pattern, just never reached.

**Ruling 2 (new) — `className` must not be assembled elsewhere.** Each extracted value is now also
shape-checked. Allowed: a string literal, or a `cn(...)` call whose every argument is a string
literal, the identifier `className`, a `cond && "literal"` expression (found via the *last*
top-level `&&`, so `cond` can itself contain `===`/`&&` without derailing the check), or a bare
`identifier(...)` call (treated as a cva variants call — see the ponytail note in the file on what
this can't verify). Anything else — a bare identifier, a template literal, an element-access lookup,
a ternary — trips a second, separately worded offender list ("className assembled outside the
attribute ..."), kept distinct from the raw-value list so the two rules are independently visible
in a failure.

One correctness fix found while re-verifying against real trees: a `//` or `/* */` comment sitting
between two `cn(...)` arguments (common in the vendored components' multi-line calls) was being
read as part of the following argument and misclassified as "assembled." Added `stripComments`
(string-aware, same skip-string primitive) applied per-argument before classification. This isn't
a new capability, it's a bug in the ruling-2 scan surfaced by testing against `packages/ui/src`,
not a defect in application code.

**`docs/agents/code-standards.md` rule 6** now states the assembly prohibition and names the
alternative in the same paragraph — the component's own variant prop first, `cn(...)` with an
inline condition where a class must genuinely vary — using the exact badge example from the
ruling, kept in the file's existing voice.

**The six named cases, observed:**

| Case | Expectation | Observed |
| --- | --- | --- |
| `const classes = ["[color:red]"];` | passes the raw-value scan | passes — not inside a `className`, never visited |
| same array, then `<div className={classes} />` | rejected by the assembly rule | rejected — `className assembled outside the attribute ...` |
| `const classes = ["[&:hover]:underline"];` | not flagged | passes |
| `type Result = [ok: string] \| [error: Error];` | not flagged | passes |
| `className={styles}`, a template literal, `Record<string,string>[key]` | rejected by the new rule | all three rejected — `className assembled outside the attribute ...` |
| `className={cn("p-4", condition && "bg-muted", className)}` | accepted | accepted |
| `className="tap-target"` | accepted | accepted |

Both checks and the boundary between them are asserted directly in
`packages/ui/tests/test-seam.test.ts`, not left as a gap: a dedicated describe block writes the
array-literal/tuple cases and asserts they pass the *whole* guard, then a second test in the same
block reuses the identical array as a `className` value and asserts it throws specifically with
`/assembled outside the attribute/` — so the report and the test agree on which rule owns which
case. Test count: 22 → 32 (10 new: 1 raw-value-inside-`cn()` case, 3 structural-dissolution cases,
4 assembly-rejection cases, 3 assembly-acceptance cases, less 1 removed — the old bare
"array indexing" test, now covered more precisely by the new structural-dissolution block).

**Guard run over real trees** (`assertNoRawDesignValues`, called directly, not through the app
tests):
- `apps/pos/src` — clean.
- `apps/backoffice/src` — clean. Confirms the issue's own pre-adoption audit still holds after
  `main`'s move: apps/pos and apps/backoffice have zero expression `className`s today, so ruling 2
  changes nothing observable in either app yet.
- `packages/ui/src` — **not clean, but every offender is inside `packages/ui/src/components/`**,
  which is excluded from the guard's declared scope by the issue's own acceptance criteria (CLI-generated,
  reviewed by hand). Reported for completeness, not a gate blocker:
  - Raw-value list: 15 lines across `card.tsx`, `input.tsx`, `select.tsx`, `sidebar.tsx`,
    `table.tsx`, `tabs.tsx`, `tooltip.tsx` — all genuine shadcn arbitrary-value syntax
    (`grid-rows-[auto_auto]`, `transition-[color,box-shadow]`), correctly flagged, not bugs.
  - Assembly list: `sidebar.tsx:204` and `:215` — a ternary (`variant === "floating" ... ? "..." : "..."`)
    passed as a `cn(...)` argument. The ruling's allowed shapes for a `cn()` argument are string
    literal / `className` / `cond && "literal"` / cva call — a ternary isn't among them. This means
    the human's pre-adoption count ("packages/ui is 28-of-28 ... literal, the className prop, or a
    cva call") no longer holds exactly for `sidebar.tsx`, one of the seven components `main` added
    since. Not a gate issue (component files are out of scope), but flagged as requested since it
    changes the audit's premise.
  - `test-seam.ts:239` self-flags on its own regex/comment text (the literal string "className" appearing
    inside the file's own source, e.g. in the `CLASSNAME_ATTR` regex definition) — same
    self-reference artifact rounds 1–2 hit, harmless, `test-seam.ts` is not in either app's scanned
    tree.

**Proof of bite, both rules in one edit.** Temporarily changed
`apps/pos/src/components/ErrorState.tsx`: `className="p-4 text-foreground"` → `className="p-4 text-[#35CCA6]"`,
and `className="tap-target"` → `className={probeClasses}` (with a throwaway
`const probeClasses = "size-4";` so the file still type-checks). `vp test` in `apps/pos`:

```
FAIL  tests/design-values.test.ts > styling standard > uses no raw design values under src/
AssertionError: expected [Function] to not throw an error but 'Error: Raw design values found in:\ns…' was thrown
Error: Raw design values found in:
src/components/ErrorState.tsx:14

className assembled outside the attribute (use a component variant, or cn(...) with literal/className/cond && "literal"/cva arguments — code-standards.md rule 6) in:
src/components/ErrorState.tsx:17
```

Both rules fired, at the correct lines, in the same run. Reverted with
`git checkout -- apps/pos/src/components/ErrorState.tsx`; `vp test` back to green; `git status`
clean before committing.

**Gate**, all from the worktree with the PATH prepend:
- `vp run -w codegen` — Prisma + both apps' `tsr generate`, clean (also ran via `vp install`'s
  postinstall after the rebase).
- `vp check` — 144 files formatted (one fix needed in `test-seam.ts`, applied by `vp check --fix`),
  108 files lint/type clean.
- `vp run -r check` — 10/10 workspace packages/apps pass.
- `vp run -r test` — 10/10 pass, including `packages/ui` 85/85 (`test-seam.test.ts` 32/32) and both
  apps' `design-values.test.ts` 1/1.

Root checkout at `/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS` was not touched —
`git status` there confirmed clean and on `main` before finishing this round.

Files changed: `packages/ui/src/test-seam.ts`, `packages/ui/tests/test-seam.test.ts`,
`docs/agents/code-standards.md`. No package.json/export changes needed — `./test-seam` was already
declared.

---

**Coordinator follow-up applied (same branch, same commit series).** The `sidebar.tsx:204/215`
finding from the previous round was correct and needed a fix, not just a note: the allowed
`cn(...)` argument shapes were missing `cond ? a : b`, an accident of enumeration rather than a
decision — `a ? "left-0" : "right-0"` is the same "every branch is a literal" shape as
`cond && "literal"`, already permitted.

**Change:** added `splitTernary` in `packages/ui/src/test-seam.ts` — finds the first top-level `?`
(skipping `?.` optional chaining and anything inside strings/brackets), then the `:` that closes
*that* ternary by tracking a ternary-nesting depth so a ternary inside the true-branch doesn't
steal the wrong `:`. `classifyCnArg` now recurses into both branches via itself (so a branch can be
a literal, `className`, another ternary, `cond && "literal"`, or a cva call — any allowed form, not
just a literal) and accepts only if neither branch is `assembled`. `cond` is never scanned, same
treatment as the left side of `&&`. Updated the offender message and rule 6's allowed-shapes list
in `docs/agents/code-standards.md` to name `cond ? a : b` alongside the existing forms, so the
written rule and the test agree.

**Tests added** in `packages/ui/tests/test-seam.test.ts`: `cn(a ? "left-0" : "right-0")` accepted;
`cn(a ? styles : "right-0")` rejected with `/assembled outside the attribute/` (one branch is a
bare identifier, not a literal or another allowed form). Test count 32 → 34, all passing
(`packages/ui` test file 87/87 including these).

**Real-tree re-scan**, `assertNoRawDesignValues` called directly:
- `apps/pos/src` — clean.
- `apps/backoffice/src` — clean.
- `packages/ui/src` — the assembly list no longer contains `sidebar.tsx:204` or `:215`; the
  "28-of-28 literal/prop/cva" property the human verified before adopting the ruling holds again.
  Remaining flags, unchanged from the prior round and out of scope either way:
  - 15 raw-value lines across `card.tsx`, `input.tsx`, `select.tsx`, `sidebar.tsx`, `table.tsx`,
    `tabs.tsx`, `tooltip.tsx` — genuine shadcn arbitrary-value syntax inside
    `packages/ui/src/components/`, excluded by the issue's own scope.
  - `test-seam.ts` itself, self-flagged once on its own source text (the literal string
    `"className"` appears in `CLASSNAME_ATTR`'s regex definition and now also in the updated
    offender-message string) — not in either app's scanned tree, harmless, same artifact as
    rounds 1–2.

**Proof of bite (the exact case from the coordinator's probe).** Ran `assertNoRawDesignValues`
against a scratch file directly:

```
<div className={cn(a ? styles : "right-0")} />
```
```
className assembled outside the attribute (use a component variant, or cn(...) with
literal/className/cond && "literal"/cond ? a : b/cva arguments — code-standards.md rule 6) in:
.../X.tsx:1
```

then, on the same file rewritten as `<div className={cn(a ? "left-0" : "right-0")} />`, no throw.

**Gate**, all from the worktree with the PATH prepend:
- `vp run -w codegen` — clean.
- `vp check` — 144 files formatted, 108 clean.
- `vp run -r check` — 10/10 (6 cache hits, 4 rebuilt on the touched files).
- `vp run -r test` — 10/10, `packages/ui` 87/87 (`test-seam.test.ts` 34/34), both apps'
  `design-values.test.ts` 1/1 unchanged.

Root checkout at `/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS` confirmed clean
and on `main` before finishing.

---

**Review round 3 (REVISE, four real holes) applied (same branch).** All four were confirmed
against the exported helper, not just read about, and fixed without reaching for a parser
(`typescript@7.0.2` in this repo is the native Go port and exposes no `createSourceFile` — a
decider question, out of scope for this round).

1. **Concatenation.** `isStringLiteral` previously checked only the first/last character. Rewrote
   it to require `skipString(...)` starting at index 0 to close exactly at the last character of
   the trimmed text — `"p-4 " + styles + " text-sm"` now fails because the first `"` closes at
   index 5, not at the end. Same function is shared by `classifySite` and `classifyCnArg`, so the
   fix applies to a bare `className="..."` value and to every `cn(...)` argument at once — one fix
   point, not two.

2. **`style` in any form.** Replaced the exact-text `style=\{\{` regex with the same
   attribute-finder used for `className` (`findAttributeSites`, generalized to take the attribute
   name). Every `style=` occurrence — `style={{ ... }}`, `style={s}`, `style={getStyle()}` — is now
   an unconditional offender; only the `design-exempt` hatch suppresses it. This also caught three
   pre-existing occurrences in `packages/ui/src/components/sidebar.tsx` (118, 175, 593) that the
   old single-line `style=\{\{` regex missed because the file formats the opening `{` and `{` on
   separate lines — a real gap in the old check, now closed as a side effect, and still out of the
   guard's declared scope.

3. **Calls inside `cn()`.** `isCallExpression` (waved through every bare call) is now
   `isSanctionedCall`: the callee must be bound in the same file by a `const X = cva(...)`
   initialiser (tracked per-file via a small regex scan, `collectCvaNames`) **or** its name must
   end in `Variants`. `cn(identity("bg-[#fff]"))` and `cn(getClasses())` are now rejected —
   neither name qualifies. Real call sites in `packages/ui/src/components`, checked directly:

   | Call | Same-file `cva(...)` binding | `Variants` suffix |
   | --- | --- | --- |
   | `badgeVariants({ variant })` (badge.tsx) | yes | yes |
   | `buttonVariants({ variant, size, className })` (button.tsx) | yes | yes |
   | `sidebarMenuButtonVariants({ variant, size })` (sidebar.tsx) | yes | yes |
   | `tabsListVariants({ variant })` (tabs.tsx) | yes | yes |

   All four satisfy both rules today (each is defined and called in the same file); the
   Variants-suffix rule exists for the case none of the four currently need — a component calling
   another file's exported variants function.

4. **Fail closed.** `matchBalanced`/`splitTopLevelArgs`/`lastTopLevelAnd`/`splitTernary` now route
   every character through one shared `skipNonCode`, which skips strings **and** `//`/`/* */`
   comments (previously only strings). This is the root-cause fix, not a patch on the symptom: a
   `/* { */` inside `cn(...)` no longer perturbs the outer bracket count, so
   `cn(/* { */ "bg-[#fff]")` now extracts correctly **and** the raw value inside it is caught —
   stronger than merely refusing to scan. As a backstop for whatever this doesn't cover,
   `findAttributeSites` now throws (naming the file and line) whenever a `className=`/`style=`
   occurrence's value genuinely can't be extracted — an unterminated string, an unbalanced
   `{...}`, or no recognizable value shape at all — instead of silently skipping it. Verified this
   path is live, not just written: `className={cn("a"` (a truncated attribute) throws
   `.../Component.tsx:1: cannot find the end of the className expression` rather than passing.

**All five probe inputs, re-checked:**

| Input | Before | After |
| --- | --- | --- |
| `className={"p-4 " + styles + " text-sm"}` | passed | rejected — assembled |
| `className={cn(identity("bg-[#fff]"))}` | passed | rejected — assembled |
| `className={cn(getClasses())}` | passed | rejected — assembled |
| `style={s}` (s a variable) | passed | rejected — raw value (style is unconditional) |
| `className={cn(/* { */ "bg-[#fff]")}` | passed silently | rejected — raw value (extraction now succeeds and sees it) |

Plus the two requested legitimate-idiom regressions: `cn(a ? b ? "x" : "y" : "z")` (nested ternary,
all-literal branches) accepted; `cn("p-4", buttonVariants({ size }))` accepted.

**`docs/agents/code-standards.md` rule 6** now states the cva rule exactly as implemented —
same-file `cva(...)` binding or a `Variants`-suffixed name — instead of the looser "a cva variants
call" that had drifted from the code in round 2's ruling text.

**Comment ceiling.** Compressed the four over-length comments (top-of-file ponytail note,
`isSanctionedCall`, `findAttributeSites`, `assertNoRawDesignValues`) to 3 lines each; audited every
remaining comment in the file against the same limit.

**`ponytail:` comment, verbatim:** "catches a hex/arbitrary value, an assembled className, or any
inline style, and fails loud (not silently) on unparsable input. Still can't see a class built
inside an imported function, or via a prop."

**Tests:** `packages/ui/tests/test-seam.test.ts` 34 → 44 (10 new: the five probe inputs, the two
legitimate-idiom regressions, the fail-closed throw, plus one covering a same-file cva binding
without a `Variants` suffix). `packages/ui` test file 97/97.

**Real-tree re-scan**, `assertNoRawDesignValues` called directly:
- `apps/pos/src` — clean.
- `apps/backoffice/src` — clean.
- `packages/ui/src` — unchanged raw-value list (15 lines, genuine shadcn arbitrary values) plus
  the three newly-caught multi-line `style={` occurrences in `sidebar.tsx` noted above (118, 175,
  593), all inside the excluded `components/` directory. **Assembly list is empty** —
  `sidebar.tsx:204`/`:215` (the round-2 ternary false positive) stay fixed, and nothing else in
  `packages/ui/src` trips the tightened call-site rule. `test-seam.ts` no longer self-flags: its
  own source text used to contain the literal string `"className"` inside a regex/message; it
  still does, but that's expected and, as before, irrelevant since `test-seam.ts` is never in
  either app's scanned tree.

**Proof of bite**, both new fixes in one edit, `apps/pos/src/components/ErrorState.tsx` (reverted
after): `className={"p-4 " + "text-foreground"}` and `style={probeStyle}` (a `const probeStyle = {
padding: 13 }` above the component). `vp test` in `apps/pos`:

```
FAIL  tests/design-values.test.ts > styling standard > uses no raw design values under src/
Error: Raw design values found in:
src/components/ErrorState.tsx:14

className assembled outside the attribute (use a component variant, or cn(...) with literal/className/cond && "literal"/cond ? a : b/cva arguments — code-standards.md rule 6) in:
src/components/ErrorState.tsx:14
```

Both the concatenation and the style-via-variable violations fired at the correct line. Reverted
with `git checkout -- apps/pos/src/components/ErrorState.tsx`; `vp test` back to green; `git
status` clean before committing.

**Gate**, all from the worktree with the PATH prepend:
- `vp run -w codegen` — clean.
- `vp check` — 144 files formatted (one reflow needed in the test file, applied by `vp check
  --fix`), 108 clean.
- `vp run -r check` — 10/10.
- `vp run -r test` — 10/10, `packages/ui` 97/97 (`test-seam.test.ts` 44/44), both apps'
  `design-values.test.ts` 1/1 unchanged.

Root checkout at `/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS` confirmed clean
and on `main` before finishing this round.

**AST rebuild, per `.scratch/decisions/016-the-parser-behind-the-raw-design-value-guard.md`.**
`assertNoRawDesignValues` is rewritten on `@typescript/typescript6@6.0.2`, TypeScript's own
compiler API, in place of the hand-rolled text scanner. Roughly 250 of the file's 403 lines
(`skipNonCode`, `skipString`, `matchBalanced`, `splitTopLevelArgs`, `lastTopLevelAnd`,
`splitTernary`, `stripComments`, `findAttributeSites`, and their supporting regexes) are deleted
outright; only the class-string-level checks (`HEX_LITERAL`, `ARBITRARY_VALUE`,
`hasArbitraryProperty`, `hasRawValue`, `EXEMPT_COMMENT`, `isExempt`, `collectFiles`) and the
reporting shell survive. All five previously-known defects close as a consequence of parsing —
see the record for the mapping.

The one behavioural change record 016 mandates: a call `name(...)` in a `className` value is now
allowed only if `name` is bound in-file by `const name = cva(...)`, **or** `name` is imported into
the file, ends in `Variants`, and has no other local declaration. A same-file
`function getVariants()` no longer passes on the suffix alone — code-standards.md rule 6 updated
to state this exactly.

**Coordinator's finishing round — three findings, two closed as real bugs, one confirmed already
correct.**

1. **`React.createElement` bypassed the walk.** The visitor handled JSX attributes and JSX-spread
   object literals but not a `createElement(tag, { className, style })` props object. Added
   `visitObjectLiteralProps`, shared between the spread case and a new `isCreateElementCallee`
   check (matches a bare `createElement(...)` or `<ns>.createElement(...)`, e.g. `React.createElement`).
   Verified: `React.createElement("div", { className: "bg-[#fff]" })` now flags
   (`Raw design values found in:`), previously passed silently.

2. **cva collection accepted `let`/`var`.** Rule 6's contract is `const X = cva(...)`; the collector
   was reading `isVariableDeclaration` nodes directly, which have no const/let/var flag of their
   own — that flag lives on the enclosing `VariableDeclarationList`. Rewrote the collector to walk
   `VariableDeclarationList` (`setParentNodes` is `false`, so this is the only place the flag is
   visible) and require `node.flags & ts.NodeFlags.Const` before adding a name to the `cva` set;
   anything else (`let`, `var`, or a `const` not initialised to `cva(...)`) goes to `otherLocal`.
   Verified: `let tone = cva("p-4"); tone = getClasses; cn(tone())` now flags as assembled;
   `const tone = cva("p-4"); cn(tone())` still passes.

3. **Parameter shadowing a cva name — probed, not changed.** Constructed the scenario named in the
   finding (`const tone = cva(...)` at module scope, a function parameter also named `tone`, used
   as a bare identifier: `cn(tone)`). This already flags correctly and needed no code change: a
   bare identifier is only ever allowed when it is literally `className`, so a shadowing parameter
   used this way was never going to slip through, independent of any cva/import bookkeeping. Left
   `isVariantsCall`'s precedence untouched, as instructed.

4. **Two comments over the three-line cap, one inaccurate.** The file-level `ponytail:` comment
   (was 4 lines, and referenced only "the name suffix" as sufficient) and the `classifyCnArg` doc
   comment (was 4 lines) both compressed to 3 lines; both now state the import requirement exactly
   as implemented — const-bound `cva(...)`, or imported and `*Variants`-named with no other local
   declaration.

All four probes added as regression tests in `packages/ui/tests/test-seam.test.ts`, describe block
"coordinator's finishing round" — including the two that already passed, so the parameter-shadow
and const-cva-still-works cases are pinned rather than incidental.

**Gate, all from the worktree with the PATH prepend:**
- `vp run -w codegen` — clean.
- `vp check` — 144 files formatted, 108 clean.
- `vp run -r check` — 10/10.
- `vp run -r test` — 10/10; `packages/ui` 107/107 (`test-seam.test.ts` 54/54, up from 50); both
  apps' `design-values.test.ts` 1/1, real trees (`apps/pos/src`, `apps/backoffice/src`,
  `packages/ui/src`) clean.

**Bite re-proved** on `apps/pos/src/components/AppShell.tsx` (`bg-[#35CCA6]` added to line 6),
`vp run -F pos test` failed at `src/components/AppShell.tsx:6`, reverted, reran green. `git status`
in the worktree shows only the guard and its test file changed; the root checkout at
`/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS` confirmed clean before finishing.

rule 6 in `docs/agents/code-standards.md` already said `const X = cva(...)` explicitly — the
implementation now matches that wording exactly (previously it silently accepted `let`/`var` too);
no doc wording change was needed for the const tightening.
