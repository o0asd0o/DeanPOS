# 020: Nav entries become real links onto placeholder routes, because a navigation nobody can click cannot be reviewed

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (direct: *"please also have a functioning link with selected ones, just show a placeholder for the actual page"*)

## The question

Record 018 gave the nav rows hover feedback but left them `<span>`s, because no screen exists
behind any entry. That kept the false-affordance window open and left the active pill — the one
piece of the skin ADR-0013 names by name — unexercised and unreviewable.

**Do eighteen unbuilt screens get routes now, so the navigation works end to end, or does the nav
stay unwired until each area builds its own screen?**

## What I chose, and why

**Eighteen file routes, each rendering one shared `Placeholder`, and every nav entry becomes a
typed `Link`.**

The decisive constraint is one this repository already bought and has a test pinning:
`to` is a **typed union** over registered routes (record 008, pinned by
`tests/typed-routes.types.ts`, whose `@ts-expect-error` goes red if the union ever degrades).
A splat route would have been one file instead of eighteen, and it would have paid for that by
collapsing the union to `/` and `/$` — every nav target unchecked, and a typo in a path failing
at runtime instead of at build. Eighteen four-line files is the price of keeping a guarantee that
is already paid for. Each route file is thin exactly as `code-standards` §4 requires; the work
lives in `features/placeholder/Placeholder.tsx`.

**The placeholder says what it is.** Record 009's rule is against **fake data** — a dimmed figure,
an empty reserved box, a control that lies. A card reading *"This screen has not been built yet"*
is the opposite of that: it is the surface telling the truth about its own state. Nothing on it
is styled to look like a report. It is also, per record 019, a `Card` — which makes it the first
consumer in the repository of the surface rule that record was written to establish.

**Active state is `useMatchRoute`, not `Link`'s own `data-status`.** `SidebarMenuButton` keys its
black pill off `data-[active=true]`, which is `isActive`'s output. Reading the match and passing
`isActive` uses the shipped API in both directions; styling off the anchor's `data-status` would
have meant a second, hand-written selector for a state the component already models.

## What this buys, beyond the human's request

The two-token wiring diff record 017 designed and record 018 preserved is now **spent, and it
worked** — `<span>` → `<Link>`, pass `isActive`, no new CSS, no change in `packages/ui`. That
prediction has been load-bearing across three records and is now verified rather than asserted.

The false affordance record 018 accepted as a priced, temporary cost is **gone**, roughly a day
after it was priced. Rows are focusable, keyboard-reachable, and announced as links because they
are links.

## What must not be read into this

- **These routes are not screens, and their paths are not a decided IA.** `reporting` owns what
  lives at `/reports/*`; areas 2–12 own the rest. An area that arrives and finds
  `/reports/summary` already registered replaces the component and keeps or changes the path as
  its PRD requires. Nothing here binds it.
- **The route set is the mock's nav, not a sitemap.** It was derived mechanically from the entries
  `backoffice-shell-1440.svg` already draws. No entry was added, removed, or reordered.
- **`/` is untouched.** It still renders the issue-04 `Ping` health check, and no nav entry points
  at it. The mock's note says the summary screen *is* the back-office landing page, so `/`
  eventually redirects — that is `reporting`'s call and needs a record only if someone wants it
  sooner.

## What changed in code

- `apps/backoffice/src/routes/{catalog,add-ons,discounts,availability,devices,users,roster,settings,quarantine}.tsx`
  and `routes/reports/{summary,orders,by-item,by-category,by-cashier,by-payment-method,discounts-overrides,refunds,drawer-sessions}.tsx`
  — eighteen thin route files.
- `apps/backoffice/src/features/placeholder/Placeholder.tsx` — new.
- `apps/backoffice/src/components/Nav.tsx` — entries gain `to: LinkProps["to"]`.
- `apps/backoffice/src/components/NavGroup.tsx` — `<span>` → `<Link>`, `isActive` from
  `useMatchRoute()`.
- `apps/backoffice/tests/ping-route.test.tsx` — the `pointer-events-none` assertion becomes an
  assertion that the row is an anchor with `href="/reports/orders"`.

## What would make this decision wrong

- **An area's real IA diverges from these paths badly enough that the placeholders mislead
  reviewers** in the meantime. Cheap to fix — rename the file, rename the `to`, the type checker
  finds every caller.
- **Eighteen placeholder routes read as "the product is built" to someone outside this thread.**
  The card says otherwise in plain words on every one of them, which is the mitigation, but a
  screenshot in a status update does not carry that nuance.
- **The `Placeholder` becomes a habit** — an area shipping a half-built screen behind it rather
  than replacing it. If that starts happening, the file should be deleted the day the last real
  screen lands, and that is worth a line in whichever PRD closes it out.

## Evidence

- `.scratch/decisions/008` and `apps/backoffice/tests/typed-routes.types.ts` — the typed `to`
  union, and the guard that fails if it degrades.
- `.scratch/decisions/017:79-101` — the two-token wiring diff, designed three records ago.
- `.scratch/decisions/018` — the false affordance this closes.
- `.scratch/decisions/019` — why the placeholder is a `Card`.
- `.scratch/foundation/reference/backoffice-shell-1440.svg` — the entry list the paths were
  derived from, unchanged.
- Verified live at 1600×900 and 375×812: clicking a row navigates client-side, the black pill
  follows the match, the drawer shows the same at mobile width. `backoffice check` passes across
  40 files. The two `ping-route` tests cannot run in this worktree — they need a live lane
  database and there is no `.env`; the assertion above was updated by reading, not by running.
