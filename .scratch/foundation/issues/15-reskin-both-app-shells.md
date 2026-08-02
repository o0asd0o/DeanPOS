# 15 — Re-skin both app shells

**Status:** ready-for-agent

## What to build

The two shells built in issues 06 and 07 wear the new skin, and the back-office sidebar moves from
the hand-assembled `sheet` + `<aside>` arrangement onto the pulled `sidebar`.

This is the issue where the theme becomes visible. It is also the one with the most ways to break
something already decided, so read the two sections below before touching a file.

## Visual reference

**Structure, order, and presence — unchanged, and still binding:**

- Image · whole-screen · 1280: `.scratch/foundation/reference/pos-shell-1280.svg`
- Image · whole-screen · 390: `.scratch/foundation/reference/pos-shell-390.svg`
- Image · whole-screen · 1440: `.scratch/foundation/reference/backoffice-shell-1440.svg`
- Image · whole-screen · 390: `.scratch/foundation/reference/backoffice-shell-390.svg`

**Appearance:**

- Image · component: Sidebar · web: `.scratch/foundation/reference/inspo/dashoard.webp`
- Image · component: Sidebar · web: `.scratch/foundation/reference/inspo/orders.webp`

**The two sets answer different questions and neither overrides the other.** The SVGs say what is on
the screen and in what order. The frames say what it looks like. A frame that shows a Dashboard entry
does not add a Dashboard entry to DeanPOS, and an SVG's grey box does not set a colour. Read
`.scratch/foundation/reference/README.md`, which issue 10 amended for exactly this split.

## What must not change

`.scratch/decisions/009` requires these to render **no element at all** — not a placeholder, not a
dimmed box — because fake data in a shell is what eleven later areas would build against. It governs
**both** shells: it was routed from issue 06, and issue 07 *"applies the same rules to
`apps/backoffice`"* (009:332). `.scratch/foundation/reference/README.md` restates the back-office
list; 009 is the authority behind it.

- `▾ Aling Nena's`, the tenant switcher — area 2
- `OFFLINE · 3 queued`, sync state — area 5
- `Ana (cashier) · Lock` and `Jomel · admin · Sign out`, auth — area 2
- the store filter, date range, `Export CSV`, and the computed-at line — `reporting`

**Their absence is correct.** The reference frames draw a populated user chip, a notification bell,
and a search field in exactly these positions. Do not add them because the frame has them. That is
the single most likely defect in this issue.

Equally: `Nav.tsx` renders its entries as plain text, not links, because no screen exists behind any
of them yet. The active pill is a **style**, and nothing is active until there are routes. Style it,
do not wire it.

## Acceptance criteria

- [ ] Both shells render in Manrope, from the self-hosted file, with no network request for a font.
      Verify by looking at the network panel or the served asset — not by trusting the token.
- [ ] `apps/backoffice` uses the compact density; `apps/pos` uses touch, with the 44px floor holding
      on every tappable control in the chrome.
- [ ] The back-office sidebar is the pulled `sidebar`, skinned per issue 14: black active pill, quiet
      resting entries, `Reports` and `Configuration` groups in their existing order.
- [ ] **Everything the old shell got right survives the swap.** Issue 07 chose `sheet` for the narrow
      viewport specifically for its focus trap, `Escape` handling, `aria-modal`, scroll lock, and
      focus restoration; issue 05's blocking finding was a focus indicator quietly opted out of.
      Re-verify each on the new sidebar rather than assuming shadcn brought them — `sidebar` uses
      `sheet` underneath, but the wiring is its own.
- [ ] Skip link, landmarks, and the `<nav aria-label>` all still present and still correct. The
      landmark count is fixed by `.scratch/decisions/009`.
- [ ] The terminal shell keeps its top bar, layout frame, and region positions as the SVG has them.
      The cart, item grid, category tabs, search, ticket count, and fulfilment selector remain absent
      — all `checkout`, all out of scope, per `.scratch/foundation/reference/README.md`.
- [ ] The issue-12 guard passes on both apps: no raw hex, no arbitrary values in `apps/*/src`.
- [ ] `check` and `test` pass across the repository, including both shells' existing tests.

## Depends on

- 10 — The theme reference set, and what fidelity now means
- 12 — A styling standard, and a test that enforces it
- 14 — Re-skin the shared parts to the reference

## Relevant files

- `apps/pos/src/components/**`
- `apps/pos/src/styles.css`
- `apps/backoffice/src/components/**`
- `apps/backoffice/src/styles.css`

## Comments

_Written from the `/grill-with-docs` session of 2026-08-02. Decision: `docs/adr/0013`._

**This closes the theme work for the two React applications, and only those.** After it, areas 2
through 12 build their screens on a settled skin — the reason ADR-0013 put these issues in
`foundation` and blocked area 2 behind them. Every screen in the product is still unbuilt; nothing
gets skinned twice.

**`apps/landing` is deliberately not touched.** It is Next.js, does not depend on `ui`, does not
import `theme.css`, and has no page yet — wiring a marketing site to a token layer before it has
content is speculative. ADR-0013 hands area 11 a named obligation: adopt this font, palette, and
compact scale, and come under the issue-12 guard. Do not treat "the theme is done" as covering it.

**Issue 05 left an obligation that applies here too.** The Tailwind wiring — `@source` resolving
relative to `theme.css`, `@utility` surviving an import — was verified in a throwaway scratch app
that was never committed. Issue 06 inherited that burden. The density scale added in issue 11 is new
wiring of the same kind, and this is its first real consumer in both apps.

**A fidelity finding against a value the SVGs do not contain is not a finding.** It is a question,
and it routes as one. What changed with ADR-0013 is that colour, spacing, type, and radii now *do*
have a source — the tokens and the `inspo` frames — so they became judgeable. Structure still comes
from the SVGs and is judged the way it always was.

## Comments

**Implemented.** Both `AppShell`s took background/foreground/border tokens and a bold wordmark;
`apps/backoffice`'s sidebar content now comes from `packages/ui`'s pulled `sidebar.tsx` parts
(`SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, and the
now-exported `sidebarMenuButtonVariants` cva), skinned per issue 14 (black active pill, quiet
resting rows). Entries render as inert `<span>`s, not links or buttons — nothing is wired.

**The mobile/desktop split deliberately stays the CSS `md:` breakpoint + `Sheet` from issue 07,
not `Sidebar`'s own offcanvas.** `Sidebar`/`SidebarProvider`/`SidebarMenuButton` all gate on
`useSidebar()` -> `useIsMobile()` -> `window.matchMedia`, which happy-dom (the render-test
environment for both apps) does not implement — mounting them would fail every render test that
touches the shell. A JS-driven mobile switch is also exactly the first-paint flash record 009
rules out for the sibling shell, so this isn't only a test-environment workaround. Issue 14's
Comments section left this choice open ("No app has consumed `Sidebar` yet ... issue 15" ), so
it is not re-litigating a settled decision.

**The five `sheet` behaviours, re-verified on the swapped-in nav content, in a live browser at
375×812:**
- Focus trap — confirmed via the accessibility tree (`FocusScope` wraps the content; tabbing
  stays inside while open).
- Escape — closes the sheet.
- `aria-modal` — **not present.** Traced to the pinned `@radix-ui/react-dialog@1.1.23`'s own
  `DialogContentImpl` (`role: "dialog"` is set; `aria-modal` is not, in either the modal or
  non-modal branch). This is untouched by this issue — `packages/ui/src/components/sheet.tsx`
  has no diff here — and was already true before this issue for any `Sheet` consumer. Reporting
  it as a pre-existing gap, not a regression.
- Scroll lock — confirmed (`document.body`'s computed `overflow` is `hidden` while open).
- Focus restoration — confirmed (closing via Escape returns visible focus to the trigger button).

**Manrope and the touch scale, verified in a live browser, not just by reading `theme.css`:**
the font request in the network panel resolves to `packages/ui/src/fonts/Manrope-Variable.woff2`
under `@fs`, no external host. At `data-density="touch"`, computed `--tap-size` is `44px` and
`--spacing` is `0.3125rem` (`h-9` renders at 45px) — the ×1.25 scale holds the 44px floor as
record 013 predicted; no correction needed.

**One `packages/ui` export added:** `sidebarMenuButtonVariants` (from `sidebar.tsx`, re-exported
from `index.ts`) so `apps/backoffice` can apply the pulled pill styling to a non-interactive
`<span>` without duplicating the cva string. Not in the issue's `Relevant files` list; flagged
here rather than silently included.

Gate run independently: `vp run -w codegen; vp check; vp run -r check; vp run -r test` — all pass.
