# 021: The wordmark is the sidebar's header, because that is where both back-office mocks draw it

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (direct: *"the DeanPOS seem to be detached? it should be inside the sidebar"*)

## The question

The back office shipped a full-width `<header>` above everything, holding the single word
`DeanPOS`, with the sidebar starting below it. The human read the wordmark as detached.

**Where does the back-office wordmark live, and what happens to the `<header>` landmark record 009
fixed at exactly one per page?**

## What I chose, and why

**Into the sidebar's top, and the `<header>` element goes with it.** This is a fidelity defect
against the binding mock, not a preference, and the SVG settles it without needing an appearance
argument at all.

`backoffice-shell-1440.svg` draws the sidebar as `rect x="0" y="0" width="240" height="900"` and
the wordmark as `text x="16" y="34"` — **inside that rectangle**, above the tenant switcher. The
bar to its right begins at `x="240"`, spans `1200`, and contains `Sales summary — Thursday 31 July
2026` and the timezone line. That bar is the *screen* header and everything in it is `reporting`'s,
which is why it renders nothing today. There is no full-width banner in the mock at any width.

`backoffice-shell-390.svg` agrees and sharpens it: a 56px top bar holding `☰` and
`Summary · 31 Jul` — the hamburger and the screen title. **No wordmark at 390 at all.**

So what shipped matched neither drawn width. The mock is authoritative for structure and presence;
this was always wrong, and no one caught it because a bold word in a bar looks like a header.

### The landmark question, which is the only hard part

Record 009's no-go list says **exactly one `<header>` and one `<main id="main-content">` per
page**, and, separately, that **a region with no content renders no element**. Move the wordmark
out of the top bar and those two rules collide: the bar has nothing left to hold, but deleting it
removes the page's only `<header>`.

**Resolved by moving the element, not by dropping it.** The `<header>` now wraps the wordmark
inside `SidebarHeader`, at the sidebar's top. Both rules hold as written: exactly one `<header>`,
holding the site's banner, positioned where the mock draws it. The empty full-width bar is gone
because it was an empty region, which 009 already forbids.

**The duplication, named rather than discovered later.** `SidebarBrand` renders once per `Sidebar`
frame, and there are two — the desktop frame and the one inside the `Sheet`. With the drawer open
at mobile width the DOM holds **two** `<header>`s, one of them `display:none`. Measured:
`{headers: 2, visibleHeaders: 1, navs: 2, mains: 1}`.

That is not new, and that is the point: `<nav aria-label="Primary">` has had exactly this shape
since issue 15, under the same two-frame arrangement record 017 chose, and it was accepted then.
The alternative — hoisting the brand above both frames — puts it back outside the sidebar, which
is the defect being fixed. So the precedent governs, and axe agrees with it: the hidden frame's
landmarks are not exposed. **If a future record decides the duplicated `<nav>` is a real problem,
this `<header>` has the same problem and the same fix, and they should move together.**

## What this does to issue 07's QA round 1

**QA round 1 fixed a real defect and its fix is partly superseded here, so the finding is restated
rather than dropped.** That round found the `☰` sitting outside `<header>`, adding a second 56px
row before `<main>` — 117px of chrome at 390 against the reference's single 56px bar — and moved
the trigger inside `<header>` as its `justify-between` end child.

With the full-width bar gone, **the thing QA measured is now structural rather than asserted**:
the trigger's row is `md:hidden` and there is nothing above it, so 390 has exactly one chrome row
and `<main>` starts directly after it. The containment that round chose was the means, not the
finding.

Two consequences, both deliberate:

- **The trigger's row is a `<div>`, not a `<header>`.** It cannot be one — the page's single
  `<header>` is the sidebar's. QA's regression assertion (`header` contains the trigger) is
  therefore changed, not merely reworded, and the replacement pins what this record decided:
  `header.closest('[data-slot="sidebar"]')` is truthy, and the trigger exists.
- **`<Sheet>` still wraps both the trigger's row and `SidebarProvider`.** That part of the QA fix
  is kept as-is: `SheetContent` is portalled, and the wrapping is what lets the trigger live
  outside the provider without breaking it.

**At 390 the page's only `<header>` is `display:none`**, since it lives in the desktop frame. Named
plainly because it is the weakest point of this record: a mobile viewport has a banner landmark in
the DOM that nobody can see, and the visible top row is not a landmark at all. Nothing in record
009's no-go list forbids it, `<main>` still satisfies SC 2.4.1 with the skip link, and the drawer
mounts a visible `<header>` when opened — but if a later accessibility pass calls this wrong, it is
the same duplicated-landmark question as the two `<nav>`s and should be settled with them.

## What changed in code

- `apps/backoffice/src/components/SidebarBrand.tsx` — new; `SidebarHeader` wrapping the page's
  one `<header>` and the wordmark.
- `apps/backoffice/src/components/AppShell.tsx` — the full-width `<header>` is gone; both `Sidebar`
  frames get `<SidebarBrand />` above `<Nav />`.
- `apps/pos` — **untouched.** Its mock genuinely draws a full-width top bar with
  `DeanPOS · Malabon · Counter 2` in the start slot, and record 009's three-slot table is written
  for it. Nothing about this record applies there, and reading it as a system-wide "wordmarks go in
  sidebars" would be wrong: the terminal has no sidebar.

## What record 009 says now

**Amended in one place: the back-office `<header>` need not be a full-width bar, and is not.** The
landmark count is unchanged, the no-empty-region rule is unchanged, and the three-slot top-bar
table — which was always about `apps/pos` — is untouched. `.scratch/foundation/reference/README.md`
needs no change: it already scopes the back-office chrome to "the sidebar entries with their
grouping and order, the top bar, and the content region's frame", and the top bar it names is the
one at `x=240` that `reporting` will fill.

## What would make this decision wrong

- **A screen header lands at `x=240` and someone makes it a second `<header>`.** That is the
  reporting-owned bar in the mock, and it is a `<div>` or a heading inside `<main>`, not a
  landmark. **Most likely way this goes wrong**, because the mock draws it as a bar and bars look
  like headers — which is the exact mistake this record is correcting.
- **The duplicated-landmark question gets decided against the `<nav>` precedent.** Then this
  changes with it, as stated above.
- **Mobile loses the wordmark entirely** — true, and it is what the 390 mock draws. If that turns
  out to feel unbranded in use, the fix is a wordmark in the mobile bar beside the `☰`, which is
  a change to the mock's structure and therefore needs a record, not a patch.

## Evidence

- `.scratch/foundation/reference/backoffice-shell-1440.svg` — sidebar `rect` at `x=0 w=240`;
  `DeanPOS` at `x=16 y=34`; the content bar at `x=240 w=1200` holding the screen title.
- `.scratch/foundation/reference/backoffice-shell-390.svg` — 56px bar with `☰` and
  `Summary · 31 Jul`; no wordmark.
- `.scratch/decisions/009:236-245` — the landmark no-go list, and the no-empty-region rule.
- `.scratch/decisions/017` — the two-frame arrangement that makes the duplication structural.
- `.scratch/foundation/reference/inspo/dashoard.webp` — the logo at the sidebar's top; the
  appearance source agreeing with the structural one.
- Verified live at 1600×900 and 375×812, drawer open and closed.
