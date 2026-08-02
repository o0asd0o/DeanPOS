# 07 — Back-office shell (`apps/backoffice`) rendering ping

**Status:** done

## What to build

The back-office as a separate application on its own origin, with the same wiring as the
terminal and a route rendering the `ping` row. Its bundle and its release cadence are
independent of the terminal's, and the browser — not a convention — is what keeps the
terminal's stored Device credentials out of its reach.

Responsive across the full range: a manager checks on the store from a phone and works from a
desktop, and both are the same application.

The nav skeleton is built here — the `Reports` group and its children first, then the
configuration entries — as structure only. Every screen behind it belongs to a later area.

**This issue is the proof that the seam from issue 06 is reusable.** Consume it unchanged. If
it needs a change to serve a second application, change the helper — never copy it. A second
copy of the test setup is the failure this issue exists to catch.

## Acceptance criteria

- [ ] Vite+ runs and builds the application, wired identically to `apps/pos`.
- [ ] TanStack Router with typed routes; TanStack Query on the oRPC client.
- [ ] Thin routes, fat features per ADR-0009, matching the worked example issue 06
      established — the ping route routes and renders, the feature holds the work, the query
      hook lives in the feature's `__common/queries.ts`.
- [ ] A route renders the ping value from the lane database, through the **existing** seam
      helper, with no app-specific test scaffolding introduced.
- [ ] Responsive from phone to desktop.
- [ ] Nav skeleton present with the `Reports` group first — structure only, no screens.
- [ ] WCAG 2.2 AA at the shell level: landmarks, keyboard focus order, visible focus,
      contrast — asserted by the same automated accessibility check issue 06 introduced.
- [ ] A legible error state when the API cannot be reached.
- [ ] Visual language from `packages/ui`; nothing domain-aware added to that package.
- [ ] It builds as an independent application with its own bundle and its own API base URL
      read from configuration — nothing in it assumes it shares an origin with the terminal.
      That the two are *served* on separate origins is asserted in issue 08, where the proxy
      exists; a path-based deployment defeats ADR-0007 and is not acceptable.

## Depends on

- 06 — Terminal shell (`apps/pos`) rendering ping, and the test seam

## Relevant files

- `apps/backoffice/**`

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/reports-summary-1440.svg`
- Image · whole-screen · 390: `design/lofi/backoffice/reports-summary-390.svg`

**Scope of the reference: the shell chrome and the nav only** — the sidebar entries, their
grouping and order, the top bar, and the content region's frame. Every figure, chart, and
table inside the content region is `reporting`'s work. Do not measure the SVGs.

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 29, 32, 33, 35–37, 39). Depends on 06
rather than on 04+05 deliberately: the seam needs a second consumer to prove it is not
awkward, and that is exactly what this issue is._

**Fixer, 2026-08-02:** applied two review findings and a directed record correction.
`AppShell.tsx` gained `tabIndex={-1}` on `<main>` so the skip link's target can receive
focus (record 009), and its over-ceiling comment was trimmed to three lines. The
regression test asserts `main`'s `tabindex="-1"` attribute rather than `document.activeElement`
after activation — happy-dom's `focus()` (`HTMLElementUtility.ts`) never checks
focusability, so an activeElement assertion passed identically with the fix present or
absent; the attribute check is the seam that actually bites (verified red without the fix,
green with it). `.scratch/decisions/008` gained the omitted `addExtensions: ".tsx"` in
both config snippets plus an amendment line. Gate green; `apps/backoffice` still reports
4 tests. Commit `af525b8`.

---

**Closed by the pipeline.** One review round used (REVISE on two should-fix findings, then PASS
on both axes). Gate green cold in the lane and again on `main`. Merged at `dc26616`. The rebase
was clean — `main` had not moved. Lane database dropped at close.

**The headline result: the seam helper was consumed completely unchanged.**
`git diff main...HEAD -- apps/api/` was **empty**. That is what this issue existed to prove, and
it is the strongest signal in the PRD that the seam is genuinely reusable rather than merely
un-edited — the reviewer additionally confirmed no app-specific scaffolding crept in by another
route: no local `QueryClient`, no copied render wrapper, no second axe invocation, no workaround
against the helper's signature. `renderRoute({ router })` took the second app's own router as-is.

**Two review findings, both fixed:**

1. **The skip link's target could not receive focus.** `<main id="main-content">` had no
   `tabindex`, so the link record 009 requires would not reliably move focus into the content.
   Nothing in the gate caught it: the test asserted the link's `href` but never the focus
   outcome, and axe's `bypass` rule passes on the landmark alone.
2. A four-line comment in `AppShell.tsx` breached the three-line ceiling and restated what the
   JSX already showed.

**An honest deviation worth recording, because it is the right kind.** Asked to prove the skip
link with a `document.activeElement` assertion, the fixer built exactly that — then ran the
prove-it-bites step and found **it could not fail**. It read `happy-dom@20.11.1`'s
`HTMLElementUtility.ts` and found `focus()` checks only `isConnected`, `disabled`, and `inert`,
never `tabindex` or focusability, and confirmed a real link click leaves `activeElement` at
`BODY` while only `location.hash` updates. Rather than ship a guard that passes whether or not
the fix is present, it substituted `expect(main.getAttribute("tabindex")).toBe("-1")` and
reported the substitution plainly. I verified that assertion does bite: stripping `tabIndex`
fails the suite with `expected null to be '-1'`.

The reviewer accepted it — a test that cannot fail reads as coverage while proving nothing, and
is strictly worse than a weaker test that is honestly coupled to the fix. **The real-browser
skip-link focus transition remains unproven**, correctly, since `foundation` deliberately does
no real-browser testing; it should be picked up by whichever area stands up the real-browser
harness (the PRD points at `offline-sync`).

**A stale record was corrected.** Record 008's two config snippets omitted
`"addExtensions": ".tsx"`, while both shipped apps carry it — added in issue 06 to stop
TanStack Router's codegen collapsing route types to `any` silently under
`moduleResolution: "nodenext"`. Since the snippet is what the next front-end area would copy,
it was amended in place with a dated note. I directed that correction rather than spending a
decider round on it: there were no degrees of freedom, the correct value being proven by
committed `@ts-expect-error` fixtures in both apps, and the reviewer had already ruled the
shipped config correct and the snippet merely stale. The reviewer agreed with that handling.

**The nav skeleton** renders the mock's order exactly — a `Reports` group (Summary, Orders, By
item, By category, By cashier, By payment method, Discounts & overrides, Refunds, Drawer
sessions) followed by Catalog, Add-ons, Discounts, Availability, Devices, Users, Roster,
Settings, Quarantine — as plain `<li>` text rather than links, since no route exists behind any
of them and a link would be a fake affordance. Nothing renders for the mock's tenant switcher,
auth footer, store filter, date range, `Export CSV`, computed-at line, or any report figure.

Below `md` the nav moves into a `sheet` behind a `☰`; at `md`+ a persistent `<aside>` holds it.
Only one `<nav>` exists in the DOM at rest, asserted rather than assumed.

**QA FAIL, fixed:** `tests/typed-routes.types.ts`'s guard could not fail — `noUnusedLocals`
made `TS6133` keep the `@ts-expect-error` directive alive regardless of whether `to` was
typed. `_brokenLink` is now `export const brokenLink`, so only `TS2322` keeps the directive
alive. Verified both directions.

**Reopened by QA, 2026-08-02 (round 1).** The `☰` sat outside `<header>`, adding a second
56px row before `<main>` (117px of chrome at 390 instead of the reference's single 56px
bar). Fix: `SheetTrigger` moved inside `<header>` as its `justify-between` end child, with
`<Sheet>` now wrapping both `<header>` and `<SidebarProvider>` so `SheetContent` (portalled,
per `packages/ui/src/components/sheet.tsx`) keeps working from anywhere in the tree. Dropped
`m-4 self-start`, kept `tap-target`, `md:hidden`, `aria-label`. Live-verified at 390×844: header
`contains()` the trigger is `true`, `<main>` now starts at y=61 (was 117); focus trap, `Escape`,
scroll lock, and focus restoration all still work. Desktop at 1440 unchanged — trigger
`display:none`, header shows only the wordmark. `packages/ui` diff against `main` is empty.
`apps/backoffice/tests/ping-route.test.tsx` updated: its header-text assertion expected an
exact `"DeanPOS"` match, which the now-correctly-nested trigger breaks; changed to
`toContain("DeanPOS")` plus an explicit assertion that the trigger is inside `<header>`.
