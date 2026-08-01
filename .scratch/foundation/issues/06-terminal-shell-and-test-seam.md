# 06 — Terminal shell (`apps/pos`) rendering ping, and the test seam

**Status:** ready-for-agent

## What to build

The cashier terminal as its own application on its own origin, with a route that renders the
`ping` row read from PostgreSQL — and the **one test seam** the remaining ten areas will use.

The shell only. Routing, data fetching, layout frame, error state, accessibility. The sale
screen itself is `checkout`.

**The seam is the real deliverable of this PRD.** Completed here and documented for the areas
that follow:

> render a real route (happy-dom + Testing Library) → real TanStack Query → real oRPC client
> from `packages/contract` → a custom `fetch` dispatching into the Hono application in-process
> via `app.request()` → real Kysely → real lane PostgreSQL

No HTTP port, no running server, no mocked client, and no mock of anything DeanPOS owns. One
test through it proves the contract, the handler, the query, the migration, and the render
together. If it is awkward, every later test is awkward — spend the time here.

**Two layouts, not one breakpoint.** Tablet landscape and phone are different designs for the
densest screen in the product. Build the shell that way now rather than retrofitting it in
`checkout`.

**No service worker and no offline behaviour.** Structure the shell so `offline-sync` can add
one without restructuring it; the worker is that area's work.

## Acceptance criteria

- [ ] Vite+ runs the application in development and builds it for production.
- [ ] TanStack Router with typed routes: a link to a removed route fails the build.
- [ ] TanStack Query wired to the oRPC client from `packages/contract`, so later areas add a
      query without re-solving data fetching.
- [ ] **The ping route is the worked example of ADR-0009**: a thin route that routes, guards,
      and renders, and a feature under `src/features/<area>/` that holds the work, with the
      query hook in that feature's `__common/queries.ts`. Ten areas copy this shape, so a
      component tree improvised in `routes/` here becomes the template for every screen in the
      product.
- [ ] A route renders the ping value that is actually in the lane database, proven through
      the seam described above.
- [ ] The seam helper is a documented, reusable function — a rendered route wired to a live
      in-process API and a lane database — and its documentation is written for the next area,
      not for this issue.
- [ ] Tablet-landscape and phone layouts exist as two layouts.
- [ ] WCAG 2.2 AA at the shell level: landmark structure, keyboard focus order, visible focus
      indicator, contrast. **Verified by an automated accessibility assertion in the shell's
      own test** — axe or equivalent, run through the same happy-dom render — not by a claim
      in the build report.
- [ ] When the API cannot be reached, the shell shows a legible error state — never a blank
      screen.
- [ ] Visual language comes from `packages/ui`; nothing domain-aware is added to that package.
- [ ] No service worker, no IndexedDB, no offline caching in this issue.

## Depends on

- 04 — Ping through contract → api → backend, with health and CORS
- 05 — `packages/ui`: tokens, Tailwind preset, primitives

## Relevant files

- `apps/pos/**`
- the shared test-seam helper (render half — server half lands in issue 04)

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/sale-grid-1280.svg`
- Image · whole-screen · 390: `design/lofi/pos/sale-grid-390.svg`

**Scope of the reference: the shell chrome only** — top bar, layout frame, and the position
of the regions. The cart, the item grid, and every control inside them are `checkout`'s work.
Read the notes under each frame; they are part of the contract. Do not measure the SVGs —
spacing, colour, and type come from `packages/ui`.

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 8, 13, 17, 28, 32–34, 36, 37, 39). The Vite+
licence criterion that used to open this issue was removed 2026-08-01: `vp` is installed and
catalog-pinned (ADR-0001 amendment)._

## Carried forward from issue 05

The Tailwind 4 preset wiring is **not yet proven by anything committed.** Issue 05 verified it
in a throwaway scratch app, then threw the app away — correctly, since no consuming app existed
there. This issue is the first real consumer and inherits the burden.

Exercise it rather than assume it: that `packages/ui/src/theme.css` imported by **relative**
path gives the app its tokens with **zero** app-specific Tailwind configuration, that `@source`
resolves relative to `theme.css` so class detection travels with the import, and that the
`touch-min` / `target-min` utilities and the global `@layer base { :focus-visible }` rule
actually emit. `.scratch/decisions/007-shared-ui-dependency-set.md` documents a one-line
fallback for each of these three, so a failure is recoverable — but a silent failure would mean
the shell renders unstyled and every later screen inherits the problem.

Note also that `packages/ui` deliberately ships **only** `button` and `sheet`. If this shell
genuinely cannot be built without a third primitive, that is worth reporting rather than
quietly adding one — it would mean issue 05 mis-scoped, and the next area is supposed to
install what it needs.
