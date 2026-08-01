# 07 — Back-office shell (`apps/backoffice`) rendering ping

**Status:** ready-for-agent

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
