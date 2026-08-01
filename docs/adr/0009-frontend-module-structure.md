# ADR-0009: Frontend module structure — thin routes, fat features

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, after evaluating a working sibling codebase (ApxDenta)

## Context

`apps/pos` and `apps/backoffice` are separate React applications (ADR-0001) sharing only
`packages/ui`, `packages/contract`, and `packages/schemas`. Without a stated convention they
will diverge into two codebases that look like different products, and every screen ticket
will re-decide where a component belongs.

## Decision

Both applications use the same layout, adapted from ApxDenta's `apps/webapp`:

```
src/routes/                  TanStack Router files. THIN — routing, guards, layout nesting,
                             and one imported component. No markup, no business logic, no
                             data shaping.
  _protected/                auth-gated group
  (auth)/                    route groups for layout, not for URLs

src/features/<area>/
  <Area>.tsx                 the screen's root component
  __types.ts                 types local to the feature
  __helpers.ts               pure helpers, unit-tested next to the file
  __columns.tsx              table column definitions where relevant
  __common/queries.ts        the feature's TanStack Query hooks over the oRPC client
  components/                components used only by this feature
  add/ list/ update/ view/   one folder per user action, when the feature has several

src/components/              shared across features within this app. NOT design primitives —
                             those live in packages/ui
src/hooks/  src/lib/  src/providers/  src/constants/
```

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

### Rules

1. **A route file renders a feature and nothing else.** If a route file grows logic, that
   logic belongs in the feature.
2. **A feature owns its data fetching.** Query hooks live in `__common/queries.ts`, not
   scattered through components.
3. **`__`-prefixed files are feature-local by convention** and sort to the top, which is
   also where a reader wants them.
4. **Action subfolders (`add/`, `list/`, `update/`) mirror the backend's handler-per-file
   split**, so a vertical slice reads the same on both sides.
5. **`src/components/` is app-shared, `packages/ui` is product-shared.** A component that
   knows what a cart or a report is never goes to `packages/ui` (ADR-0001).
6. **`apps/pos` and `apps/backoffice` do not import from each other.** Anything genuinely
   shared moves to a package, deliberately.

## Consequences

- A screen ticket has an obvious change surface, which makes `## Relevant files` accurate
  and lets the orchestrator parallelise safely.
- The two applications stay recognisably one product without sharing a router or a bundle.
- The POS's two layouts (tablet and phone, per `checkout`) are variants within a feature,
  not separate features — the data and the actions are identical.

## Reversing it

Mechanical. This is a convention, not a coupling; a regrouping is a scripted move at any
point.

## Evidence

`/Users/jomelortega/Desktop/personals/ApxDenta/apps/webapp/src`, read on 2026-07-31:
`routes/` with `_protected` and `(auth)` groups, and `features/<area>/` with `__types`,
`__helpers`, `__columns`, `components/`, `__common/queries.ts`, and action subfolders.
