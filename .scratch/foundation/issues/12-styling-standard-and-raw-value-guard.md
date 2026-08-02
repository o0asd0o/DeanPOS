# 12 — A styling standard, and a test that enforces it

**Status:** needs-info — **escalated to the human. Round cap reached, not merged.**

The work is built and the gate is green on branch `f12-styling-standard` (worktree and lane database
kept alive so this can be resumed rather than rebuilt). Two fix rounds were spent and the guard
still mis-classifies real code. The written standard — rule 6 in `docs/agents/code-standards.md` —
is complete and uncontested; **only the executable guard is outstanding.**

**Why it stopped here.** Each round closed the previous defect and exposed a narrower one of the
same kind. The guard is a line-oriented scanner with no notion of syntax, and every fix has been a
better approximation of a parser:

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

**The question for you, which is why this is not another round.** The reviewer's prescribed fix is
to lex string and template contents independently before scanning. That is a third rewrite, and it
is the point at which "a regex over source text" has become a small parser. Worth deciding rather
than drifting into:

- **Ship the guard as it stands**, with the false positives documented and the `// design-exempt:`
  hatch covering them. The false *negative* is the real cost: a raw value inside a string array is
  exactly how someone would write one.
- **Lex strings properly** — one more round, and the guard becomes something with its own
  maintenance burden that eleven areas depend on.
- **Narrow the guard to `className` attribute contents only**, which is where the rule actually
  bites, and accept that it sees nothing else. Smaller than lexing, and closer to the stated intent.
- **Ship rule 6 without the test.** The issue itself argues against this — *"a rule with no test is
  forgotten by area 4"* — but it is a real option if the guard's cost has outrun its value.

**Issue 15 depends on this issue** and is therefore blocked until you rule. Issues 13 and 14 do not.

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
