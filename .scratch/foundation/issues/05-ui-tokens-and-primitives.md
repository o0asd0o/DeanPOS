# 05 — `packages/ui`: tokens, Tailwind preset, primitives

**Status:** done

## What to build

The shared visual language both React applications consume, so that two apps do not drift
into two design systems. A Tailwind preset, the design tokens, and the shadcn primitives —
and nothing that knows what a cart or a report is.

The lo-fi mocks are deliberately greyscale and deliberately ugly: they fix what is on a
screen and in what order, and **nothing else**. Spacing, type scale, colour, radii, and every
interaction state are decided **here**, once, and every later screen reads them from this
package rather than measuring an SVG. That is why this issue exists before either shell.

Touch targets are a token, not a per-screen decision — `apps/pos` is operated with a thumb
on a tablet, at speed, by someone who is not looking carefully.

## Acceptance criteria

- [ ] A Tailwind preset both applications extend, with tokens for colour, spacing, type
      scale, radii, and minimum touch-target size.
- [ ] shadcn primitives installed and re-exported — **only those the two shells actually
      consume in issues 06 and 07**. No speculative component library; the next area installs
      what it needs.
- [ ] Colour tokens meet WCAG 2.2 AA contrast for their intended pairings, **asserted by a
      contrast test over the token pairs** rather than eyeballed, and the visible focus
      indicator is a token rather than a browser default.
- [ ] Both `apps/pos` and `apps/backoffice` can import from it with no app-specific
      configuration.
- [ ] **Nothing in the package is domain-aware.** No component knows about a cart, an order,
      a report, a drawer session, or a tenant. The first one that does belongs in its
      consuming app, and is a review finding here.
- [ ] `check` and `test` scripts present, per issue 01.

## Depends on

- 01 — Monorepo skeleton and the gate

## Relevant files

- `packages/ui/**`
- `design/lofi/README.md` (read-only — the source of what the mocks do and do not decide)

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 30, 31, 36). Not a screen-fidelity issue,
so it carries no visual reference — the mocks constrain screens, not tokens._

**Implementer, 2026-08-02.** Built per decision record 007. `shadcn init` could not detect
a framework in a bare library workspace, so the two primitives were transcribed from the
CLI's own `new-york` style output (confirmed byte-for-byte via `shadcn add --dry-run --view`
after fixing `components.json`'s `style` field) — the fallback the record names explicitly.
`radix-nova` (the interactive default preset) was tried first and rejected: it emits
`color-mix(in oklch, ...)` and an unlisted `--popover` token, which contradicts the
sRGB-hex-only and fixed-token-name constraints.

Chose token values (names were fixed): all 14 contrast pairings the record lists pass WCAG
2.2 AA — see the commit and the report for the full ratio table. `cn` lives at
`packages/ui/src/lib/utils.ts` per the record's no-gos ("No second cn. One helper, in
packages/ui/src/lib/utils.ts") — a self-review flagged this against code-standards rule 3's
default `helpers.ts`-next-to-callers placement, but the decision record's explicit path
takes precedence over the general rule.

Verified "no app-specific configuration" with a throwaway scratch app (not committed):
a two-line stylesheet importing `theme.css` by relative path compiled `bg-primary`,
`target-min`, `touch-min`, and the base `:focus-visible` rule with a bare `tailwindcss` CLI
and no other config.

Gate: `vp check`, `vp run -r check`, `vp run -r test` all pass (lane DB migrated first —
it was unmigrated in the fresh worktree).

**Fixer, 2026-08-02.** Blocking finding: `button.tsx` opted out of the global token focus
outline with `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50` (plus
`focus-visible:ring-destructive/20` on the destructive variant), so `theme.css`'s
`:focus-visible` outline never won and a focused button showed a hardcoded 3px box-shadow
ring instead — breaching both the token-focus-indicator criterion and record 007. Deleted
all four classes from the base and destructive `cva` strings; nothing else in the file
changed. Gate: `vp check`, `vp run -r check`, `vp run -r test` all pass, `packages/ui` still
18 tests.

---

**Closed by the pipeline.** One review round used (REVISE on a blocking finding, then PASS on
both axes). Gate green cold in the lane after the rebase and again on `main`. Merged at
`6d4650e`. Lane database dropped at close.

**The blocking finding was an accessibility defect, not a style nit.** `button.tsx` kept
shadcn's stock `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`. In
Tailwind 4 `outline-none` sits in the utilities layer and beats the `@layer base`
`:focus-visible` rule, so a focused button rendered a 3px box-shadow ring instead of the 2px
token outline — `--color-ring` (`#000000`) at **50% alpha** composited over
`--color-primary` (`#1d4ed8`), dark blue on dark blue, judged well under 3:1. Nothing in the
repository measured it: the contrast test asserts the **opaque** `ring`/`primary` pairing, and
axe cannot evaluate box-shadow contrast in a virtual DOM. Stripping four classes from
`button.tsx` closed all four findings at once — the indicator is now an opaque 2px outline at
2px offset, which renders on the surface *behind* the button and is covered by the declared
`ring`/`background` and `ring`/`primary` pairings.

This matters past one component: `button` is the first primitive, and every later area copies
its shape. A per-component focus opt-in is one eleven areas would have inherited.

**Decision made during this issue:** `.scratch/decisions/007-shared-ui-dependency-set.md` —
**Stakes: high.** Fixes Tailwind 4.3.3 and how a "preset both applications extend" is
expressed when v4 has no `presets` array (a shared `theme.css` `@theme` block imported by
relative path, so `@source` resolution travels with it); shadcn via `--base radix` rather than
the newer Base UI default; the two-primitive limit; token **names** (values left to this
issue); `--min-target-size: 24px` (WCAG 2.2 SC 2.5.8, AA) and `--min-touch-size: 44px`
(SC 2.5.5, AAA) in `px` not `rem`; a dependency-free contrast test; and **React 19.2.8**,
which no manifest had declared until now. It also grants a narrow exemption to code-standards
rule 2 for CLI-generated files under `packages/ui/src/components/`, since splitting them
destroys the reviewable-regeneration diff that is the point of vendoring.

**Tokens must stay six-digit sRGB hex** — never shadcn's default OKLCH — because the contrast
test parses `theme.css` directly and cannot read it. The test also fails if any `--color-*`
token appears in no pairing, so an untested token cannot ship. 14 pairings declared, all
passing; `ring`/`primary` at 3.13 has near-zero headroom above the 3:1 threshold, which is
correct today and will fail loudly if `--color-primary` is ever lightened.

**Obligation carried forward to issue 06:** the Tailwind preset wiring — `@source` resolving
relative to `theme.css`, `@utility` surviving an import, non-namespaced `@theme` emission —
was verified only in a throwaway scratch app that was not committed. Issue 06 is the first
real consumer and inherits that verification burden; its shell test should exercise the shared
`@import` and the `touch-min`/`target-min` utilities rather than assume the wiring works.
