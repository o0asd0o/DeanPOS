# 018: Back-office nav rows get hover feedback and an icon each, because the back office is not the terminal

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (direct, after looking at the shipped back-office sidebar and judging it broken)

## The question

Issue 15 shipped, and the human's first reaction to the running application was that the
sidebar "is not working" — no hover, no transition, no icons. Nothing is broken: every one
of those three absences is a recorded decision doing exactly what it says.

- No hover, no transition — `pointer-events-none` on every row, mandated word-for-word by
  issue 15's third acceptance criterion, which record 017 wrote, which in turn grounds
  itself in record 009's "no non-interactive chrome element … changes on hover".
- No icons — `Nav.tsx` renders labels only. The lo-fi mock
  (`.scratch/foundation/reference/backoffice-shell-1440.svg`) draws no icon, and
  `.scratch/foundation/reference/README.md` makes the mock the authority on **presence**.

**Should the back-office nav rows paint hover feedback and carry icons before any route
exists behind them — and if so, from which icon set?**

What a wrong answer costs: eleven later areas inherit whatever a resting nav row looks like
on the day area 2 ships its first screen. Getting it wrong in the permissive direction
leaves a false affordance in front of users for as long as rows stay unwired. Getting it
wrong in the restrictive direction leaves the product's most-seen surface reading as
unfinished for the same period, and re-opens the same argument every time a human looks at
it.

## What I chose, and why

**Both. Hover feedback is restored and icons are added, and the reason it is not a
violation of record 009 is that record 009's hover rule was written about a thumb on a
touch screen.**

### Hover on rows that are not links, reconsidered

Record 009's hover section makes two distinct statements, and issue 15 inherited them as
one. They are not one.

The standing rule, the part 009 itself calls "the real content of this section", is:
**no information and no affordance in `apps/pos` may be reachable only by hover**, because
the terminal is operated with a thumb where hover does not exist, and because anything that
*appears* on hover drags in WCAG 2.2 SC 1.4.13. That rule is intact here and is not even
engaged. The hover pill reveals nothing. The icon and the label are painted at rest, at
full legibility, at every viewport, with or without a pointer. Nothing in the back-office
nav is reachable only by hover after this change, exactly as before it.

The narrower statement — "no non-interactive chrome element … changes on hover" — is a
sentence about `apps/pos`'s top bar in a record whose title is *terminal shell chrome
states*. Issue 07 routed 009's rules to `apps/backoffice` wholesale (009:332), and that
routing was right for the parts that generalise: no fake data, one focus treatment, nothing
hover-only. It over-reached on this one. The back office is a pointer-driven desktop
application at compact density with a persistent left navigation; the terminal is a
fixed-position touch screen with no navigation at all. A resting-state hover on a
desktop nav row is not the same object as a hover on a terminal's top-bar text, and
treating them as one is what produced a sidebar a human read as broken.

**The cost this decision accepts, stated plainly: for as long as rows are unwired, pointing
at "Orders" paints a pill and clicking does nothing.** That is a false affordance and it is
real. Three things bound it. The rows are `<span>`s, not links or buttons — they are not
focusable, carry no `role`, and are announced by a screen reader as the text they are, so
the false affordance is pointer-only and never reaches assistive technology. The window is
short and closing: area 2 onward exists to put screens behind these entries, and each one
that lands removes a row from the set. And the day a route arrives the diff is still the
two tokens record 017 designed for — swap `<span>` for `<Link>`, pass `isActive` — because
the class string never moved.

### Icons, and whether the mock forbids them

The mock does not forbid them. `LOFI-CONTRACT.md` and the reference README make the SVG the
authority on "the sidebar entries with their grouping and order" — **which entries exist,
and in what sequence.** An icon is not an entry. It adds no navigation target, no group, no
ordering, and no data; every icon here sits beside a label that was already there, and the
entry list is byte-identical before and after.

This is the distinction issue 15 drew itself, running the other way: *"A frame that shows a
Dashboard entry does not add a Dashboard entry to DeanPOS, and an SVG's grey box does not
set a colour."* An icon per row is on the appearance side of that line, and ADR-0013 gave
appearance a named source — the `inspo` frames. `.scratch/foundation/reference/inspo/dashoard.webp`,
the frame the reference README maps to the sidebar, draws exactly one icon per nav row at
the label's left. This change follows the reference set it was pointed at.

**Where this stretches, and I would rather say so than have it found:** an icon *is* an
element on screen, and the greyscale mocks contain none. A reviewer reading "presence" at
its widest reads this as adding elements the mock does not draw. That reading is available
and this record overrides it, on the ground that presence in that sentence is about the nav
*inventory* — the thing eleven areas would build against — and not about every glyph. If
that ground is rejected, the fix is a smaller record, not a revert of the hover half.

### The icon set

**`lucide-react`, and the human's memory of Phosphor is not in this repository.** A
repository-wide search for "phosphor" — every extension, including the reference and
decision directories — returns nothing. Record 007 chose `lucide-react`, put it in
`packages/ui`'s dependencies under the catalog pin, and set `iconLibrary` to `lucide` in
`components.json`, so every future `shadcn` pull lands `lucide-react` imports in generated
files. That pin is the decisive fact: adopting Phosphor does not replace an icon set, it
adds a second one and guarantees both stay, which is the outcome record 007 rejected
explicitly (007:405). Eighteen glyphs at 16px in a nav list is not where that price is
worth paying. Phosphor remains available to a later record with a real reason.

One dependency line moved: `lucide-react: "catalog:"` is now declared in
`apps/backoffice/package.json` as well. It was resolving through hoisting from
`packages/ui` and importing it from an app without declaring it was an undeclared
dependency that a stricter installer would break. Same catalog pin, same single version.

## What issue 15's acceptance criterion becomes

The third criterion is **amended a second time**. Record 017 amended it to add the mounting
sentence; that sentence is untouched. Only the final clause changes. Replace:

> Nav entries stay inert — each is a `SidebarMenuButton asChild` wrapping a `<span>` with
> `pointer-events-none`, so no hover or active feedback fires on a row that is not yet a
> link.

with:

> Nav entries are not yet links — each is a `SidebarMenuButton asChild` wrapping a
> `<span>`, with an icon and a label — but they do paint the skin's resting hover
> (`.scratch/decisions/018`). Nothing is focusable, no `role` is set, and no active state
> is passed until routes exist.

No other criterion changes. The issue-12 raw-value guard is unaffected: no class string
gained a hex or an arbitrary value, and `ui test` (107 assertions, the guard among them)
passes.

## What record 009 says now

**009 is amended, not overturned, and only in its scope.** Its no-hover-on-non-interactive
sentence is now read as governing `apps/pos` — the record's actual subject — and not
`apps/backoffice`. Everything else 009 routed to the back office through issue 07 stands
unchanged and is not weakened by this record: the elements that render nothing at all (the
tenant switcher, sync state, auth, the reporting controls), the single focus treatment, the
landmark count, and above all the standing rule that nothing anywhere may be reachable only
by hover.

Record 017 is **partially superseded**: its mounting decision — one `SidebarProvider`, two
`collapsible="none"` frames, CSS deciding which paints — is untouched and remains the
answer. Its `### The second finding: hover on rows that are not links` subsection is
overturned by this record and carries a pointer to it.

## What areas 2 through 12 may and may not assume

**May assume:**

- A nav entry is `{ label: string; icon: LucideIcon }`. Adding one means adding a glyph;
  there is no unlabelled and no icon-less row.
- The resting hover is the skin's, from `sidebarMenuButtonVariants` in `packages/ui` — it
  is not hand-written in the app and must not be. Change it in one place or not at all.
- Wiring a row is still the two-token diff record 017 promised: `<span>` → `<Link>`, pass
  `isActive`. The black active pill fires with no new CSS and no new class.
- `lucide-react` is the icon set for both applications, at the catalog pin.

**May not assume:**

- That a row is focusable or keyboard-reachable. It is not, until it is a link. Do not add
  `tabIndex`, `role="button"`, or a click handler to a `<span>` to close that gap — wire
  the route instead.
- That hover may carry information. It may not, in either application. 009's standing rule
  survives this record intact.
- That an icon may replace a label, or that a row may collapse to icon-only. That is
  `collapsible="icon"`, which record 017 already flagged as needing its own record because
  of the transitions it drags in.

## How to turn it back

1. Write a superseding record; flip this record's `Status:` to `overturned` with the date
   and reason; update `LOG.md`, and remove the amendment banner from record 017.
2. `apps/backoffice/src/components/NavGroup.tsx` — restore `className="pointer-events-none"`
   on `SidebarMenuButton`, drop the `Icon` element and the `NavItem` type.
3. `apps/backoffice/src/components/Nav.tsx` — the two arrays go back to `string[]`, and the
   `lucide-react` import block goes.
4. `apps/backoffice/package.json` — remove the `lucide-react` line if the icons go with it.
   Leave it if only the hover half is reverted.
5. `packages/ui` — **nothing.** No token, no class string, no generated-file edit.

The two halves revert independently, and that is deliberate: the hover argument rests on
record 009's scope and the icon argument rests on the reference README's reading of
presence. A reviewer who rejects one is not obliged to reject the other.

## What would make this decision wrong

- **A back-office screen is genuinely operated by touch.** A tablet in a back room running
  reports is not far-fetched, and the whole hover argument is that the back office is
  pointer-driven. It would not make the hover harmful — nothing is hover-only — but it
  would make it invisible, and the false affordance would then be a tap that does nothing,
  which is worse than a hover that does nothing. **This is the most likely way this record
  turns out wrong.**
- **The unwired window stays open far longer than assumed.** The false affordance is priced
  as short-lived because area 2 onward is meant to close it. If eighteen rows are still
  unwired a year from now, the honest treatment is `aria-disabled` plus a muted resting
  state, which is a new record.
- **A reviewer holds the reference README's "presence" at its widest.** Stated in full
  above. The icon half falls; the hover half does not.
- **An icon choice reads wrong to the domain.** These are eighteen judgement calls against
  labels, not a decided mapping — `PercentIcon` for "Discounts & overrides" and
  `ShieldAlertIcon` for "Quarantine" are the two I would expect to be argued. Swapping a
  glyph is a one-line change in `Nav.tsx` and needs no record.
- **Phosphor turns out to be a real commitment somewhere outside this repository** — a
  design file, a written brief. Nothing in the repository records it. If such a source
  exists, it beats this record's reasoning and record 007 is the one that has to be
  re-opened, not this one.

## Evidence

- `.scratch/decisions/009-terminal-shell-chrome-states.md:88-97` — the hover section, and
  the scope word `apps/pos` in the standing rule this record leaves intact.
- `.scratch/decisions/017-how-the-back-office-sidebar-is-mounted.md:79-101` — the
  subsection this record overturns, and the two-token wiring diff it designed.
- `.scratch/decisions/007-shared-ui-dependency-set.md:117-121, 405, 540` — the icon-set
  choice, the rejection of a second set, and the `iconLibrary: lucide` pin.
- `.scratch/foundation/reference/README.md` — "the sidebar entries with their grouping and
  order"; the split between the mocks and the `inspo` frames.
- `.scratch/foundation/reference/inspo/dashoard.webp` — one icon per nav row, at the
  label's left.
- `packages/ui/src/components/sidebar.tsx:448` — `sidebarMenuButtonVariants`, carrying
  `hover:bg-sidebar-accent`, `[&>svg]:size-4`, and `[&>span:last-child]:truncate`; the
  reason the app needed no new class for either half of this change.
- `packages/ui/src/theme.css:38` — `--color-sidebar-accent: #e4e4df`, the pill that now
  paints.
- <https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus> — SC 1.4.13, not engaged: the
  hover pill reveals no content.
- Verified live at 1600×900 against the worktree dev server: eighteen glyphs render, the
  resting pill paints on pointer-over. `backoffice check` and `ui test` (107) pass;
  `backoffice test`'s two failures are the pre-existing unset `DATABASE_URI` / `APP_DOMAIN`
  and reproduce on a stashed tree.
