# 06 — Terminal shell (`apps/pos`) rendering ping, and the test seam

**Status:** done

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

**2026-08-02 — fixer, two should-fix findings applied.** Trimmed the three over-ceiling
block comments in `apps/api/src/test-seam-react.tsx` to ≤3 lines each, pointing at
`.scratch/decisions/008`. Strengthened `apps/pos/tests/ping-route.test.tsx` to read the
seeded `message` via the `db` handle instead of asserting the literal `"pong"`; proved it
bites by rendering a hardcoded string in `Ping.tsx`, watching the test fail, then reverting.
Gate green, `apps/pos` reports 3 tests.

**2026-08-02 — fixer, decision record 010 applied.** Split `routes/__root.tsx` into itself
plus `components/AppShell.tsx` per record 010's verbatim bodies: the root now hands the
router one imported component and holds no JSX. Also carried record 010's two document edits
(`docs/agents/code-standards.md` section 4, `docs/adr/0009-frontend-module-structure.md`) and
its amendment sentence in `.scratch/decisions/009-terminal-shell-chrome-states.md`'s reversal
section. `rg -n '</|/>' apps/*/src/routes` returns nothing. Gate green, `apps/pos` still
reports 3 tests, no test or manifest changed.

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

---

**Closed by the pipeline.** One review round used (REVISE on two should-fix findings, then PASS
on both axes). Gate green cold in the lane after the rebase and again on `main`. Merged at
`5b042f3`. Lane database dropped at close.

**The seam is complete, and it is what ten later areas inherit.**
`renderRoute<TRouter extends AnyRouter>({ router, ...seamOptions }) => { container, db }`,
plus `expectNoAxeViolations(container)` and `assertNoServerImports(srcDir)`, at
`apps/api/src/test-seam-react.tsx` — beside the server half, because ADR-0009 rule 6 blocks an
app→app import and an eleventh workspace would contradict the PRD's ten. It renders the
caller's **own** router and injects `{ queryClient, orpc }` through TanStack Router's
render-time context override rather than rebuilding it, so the app under test is byte-identical
to production and nothing is `apps/pos`-specific. Issue 07 consumes it unchanged.

**The ADR-0009 worked example**: thin route (`routes/index.tsx` wires one feature and nothing
else) → fat feature (`features/ping/Ping.tsx`) → query hook in `features/ping/__common/queries.ts`.

**Two review findings, both in files the whole product copies:**

1. The seam helper carried three multi-paragraph JSDoc blocks, breaching the three-line comment
   ceiling in the file every later seam test is read against. Trimmed to pointers at record 008,
   which already holds the prose.
2. The ping test asserted `getByText("pong")` — a hardcoded literal — while holding a live `db`
   handle it never read. The behaviour was genuinely live, but the *guard* would have kept
   passing if the render stopped reflecting the database and started printing a constant. Now
   reads the seeded value through the handle and asserts against it. Proven to bite by making
   the component render a divergent constant and watching the test fail.

**A contradiction surfaced and was settled: `.scratch/decisions/010-the-word-layout-in-the-routes-layer.md`.**
ADR-0009 called `src/routes/` "THIN — routing, guards, **layout**, and a single feature
component"; code-standards rule 4 said "DON'T put **layout**, markup, or business logic in a
route file." Same word, opposite instruction. The decider ruled rule 4's reading wins — "layout"
in ADR-0009 means layout *nesting*, never markup — and made the rule **zero-exception, root
included: a route file contains no JSX**, testable by `rg -n '</|/>' apps/*/src/routes` returning
nothing.

It overruled the reviewer, which had judged `__root.tsx` acceptable as a framework-mandated file
with nothing to delegate to. Its grounds: issue 06 calls that file the worked example ten areas
copy, so a worked example carrying the sole exception means **the exception is what gets
copied** — and the premise was false anyway, since `ErrorState` and `NotFoundState` already lived
in `components/` and the frame was the lone holdout. The frame moved to
`apps/pos/src/components/AppShell.tsx`; `docs/agents/code-standards.md` section 4 and ADR-0009
were rewritten so the two documents now say one thing, and record 009 was amended to match.

**Also decided during this issue**, both binding on issue 07 and later areas:

- `.scratch/decisions/008-frontend-application-dependency-set.md` — **Stakes: high.** TanStack
  Router/Query, the React plugin, happy-dom, Testing Library, and `axe-core@4.12.1`. Makes the
  `routeTree.gen.ts` codegen part of the root `codegen` script, so `ORC2_GATE` now begins
  `vp run -w codegen` — without it the router plugin regenerates at Vitest startup, *after* both
  typecheck steps, and `vp check` would go green against a stale route tree. axe runs the five
  WCAG tags with **only** `color-contrast` disabled, because axe cannot evaluate contrast in a
  virtual DOM and `packages/ui`'s token-pair test is what covers it.
- `.scratch/decisions/009-terminal-shell-chrome-states.md` — **Stakes: medium.** What the shell
  renders in the states the lo-fi mock does not draw. The mock's `OFFLINE · 3 queued` and
  `Ana (cashier) · Lock` render **no element at all** — not dimmed placeholders — because there
  is no tenancy, offline sync, or auth yet, and fake data in a shell is what eleven areas would
  then build against.

**A trap issue 07 will hit identically.** Under `moduleResolution: "nodenext"`, TanStack
Router's codegen emits extension-less relative imports that fail to resolve **silently**,
because the generated file carries `@ts-nocheck`. That collapses `routeTree`, `router`, and
everything touching `Register`/`RegisteredRouter` to `any` — including `useRouteContext` in
unrelated files — while the gate stays green. Fixed with `addExtensions: ".tsx"` in **both**
`tsr.config.json` and the Vite plugin's inline config. A regression is caught by
`apps/pos/tests/typed-routes.types.ts`: the collapse makes a link to a non-existent route legal,
which turns its `@ts-expect-error` into an unused directive and reds the gate.

**Standing minor, not fixed:** the Tailwind preset wiring was exercised (a production build,
grepped for `--color-background`, `.touch-min`, and the `:focus-visible` rule, all emitted from
the relative `theme.css` import with zero app config) but nothing **committed** guards it —
happy-dom applies no PostCSS, so the seam test cannot see computed styles. The obligation as
written was to exercise rather than assume, which is met; a committed guard is net-new work no
document requires.

**QA FAIL, fixed:** `tests/typed-routes.types.ts`'s guard could not fail — `noUnusedLocals`
made `TS6133` keep the `@ts-expect-error` directive alive regardless of whether `to` was
typed, so a collapse to `string` would not have gone red. `_brokenLink` is now `export const
brokenLink`, so only `TS2322` keeps the directive alive. Verified both directions.
