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
