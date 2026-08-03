# 048 — The back office gets a content-column header, and it is not a banner

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** medium — amends a shipped landmark decision
- **Asked by:** the human, directly
- **Decided by:** the human; this record states what was built and what was preserved
- **Relates to:** [021](021-the-wordmark-is-the-sidebars-header.md), [030](030-the-back-office-sign-in-screen.md), [042](042-user-event-is-refused-because-happy-dom-has-no-activation-behaviour.md)

## What was added

A bar at the top of the content column, above `<main>`: a search field on the
left, then notifications and an account menu on the right. This is the row the
reference draws on every screen
(`.scratch/foundation/reference/inspo/orders2-with-table.webp`), which is where
appearance is decided (ADR-0013).

- **Search was removed on 2026-08-03**, by the human. It shipped inert — no
  endpoint existed — and an affordance that does nothing is worse than none.
  The Users list keeps its own scoped search field.
- **Notifications** opens a menu that says "Nothing yet." There is no
  notification source; an empty state is honest where a spinner would not be.
- **Account** opens a menu holding the current role, a link to `/settings`, and
  **Sign out**, which is where sign-out now lives.

## What record 021 keeps

021 removed a full-width `<header>` and put the page's one banner in the
sidebar. That still holds: **this bar is a `<div>`, not a `<header>`**, and it
sits inside the content column rather than above the sidebar. The page still
has exactly one `<header>`, it is still the sidebar's, and `axe` still passes —
a second top-level `<header>` would be a duplicate banner
(`landmark-no-duplicate-banner`), which is the failure 021 was protecting
against under a different name. The `md:hidden` `☰` row is untouched.

021's own framing anticipated this: it called the reference's top row "the
*screen* header", belonging to the screen rather than to the site. That is what
this is.

## Sign-out moved

`SignOutButton` (sidebar footer) is deleted; `UserMenu` owns the mutation and
the confirm dialog. Two sign-out affordances would be worse than one in the
conventional place. The dialog is **controlled**, not a `DialogTrigger`: a
trigger inside a menu item unmounts with the menu when it closes, so the dialog
never opens. `apps/backoffice/tests/user-menu.test.tsx` drives the real path —
open the menu, choose Sign out, cancel or confirm.

## Reversal

Delete `AppHeader`, `NotificationsMenu` and `UserMenu`, and put a sign-out
control back in `SidebarFooter`. Nothing outside `apps/backoffice/src/components`
knows the bar exists; `packages/ui` gained a `DropdownMenu`, which stands on its
own.
