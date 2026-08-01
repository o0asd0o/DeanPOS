# 05 — `packages/ui`: tokens, Tailwind preset, primitives

**Status:** ready-for-agent

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
