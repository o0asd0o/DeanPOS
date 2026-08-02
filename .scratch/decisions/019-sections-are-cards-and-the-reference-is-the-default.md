# 019: A section of a screen is a `Card`, never a bordered `<div>` — and where the tokens are silent, the reference decides

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (direct: *"the sections should be wrapped in cards — this is a hard rule for implementers/fixers … bordered separate is a bit generic, my decision last time is to adhere with the inspo's look and feel"*)

## The question

Both `AppShell`s separated their regions with a 1px `border-border` rule — `border-b` under the
header, `border-r` beside the back-office sidebar. `--color-border` is `#8a8a8a`, a mid-grey, so
what shipped was a hard grey line between two areas of nearly the same colour. The reference
frames have no such line anywhere: regions are separated by a **white card sitting on the
off-white page ground**, and the sidebar meets the canvas as a surface step, not as a rule.

Two questions, and the second is the one that matters past this week.

**Narrow:** do the shells keep those borders? No — dropped.

**Wide, and the reason this record exists: what does an implementer do when the tokens and the
shared parts leave a visual choice open?** Nothing said "draw a border here". Nothing said not
to either. A generic bordered layout is what a reasonable implementer produces from silence, and
it is what produced a shell the human read as generic. Twelve areas of screens are still unbuilt.
If the answer to silence stays "pick something sensible", the product converges on the default
admin look one reasonable choice at a time, and no single diff is ever wrong enough to reject.

## What I chose, and why

**Two rules, one hard and one that decides the cases the hard one does not list.**

### The hard rule: sections are `Card`s

Every distinct section of a screen — a table and its toolbar, a filter strip, a form group, a
stat row, a detail panel — is wrapped in `Card` from `packages/ui`. Separation between regions
comes from that surface step. **No `border-b` under a header, no `border-r` beside a sidebar, no
`divide-y` between regions, and no hand-rolled `rounded-lg border p-4` standing in for a `Card`.**

The tokens already encode the relationship and were waiting for a consumer: `--color-background`
is `#fafaf7`, `--color-card` and `--color-sidebar` are `#ffffff`. Issue 14 skinned `card.tsx` to
the reference — `rounded-2xl`, `bg-card`, `shadow-sm` — against its criterion *"the reference's
surface: white on the off-white page ground, generous radius"*. Every piece was in place; nothing
consumed it, because `foundation` built shells and the content region belongs to `reporting`. So
this is not new design. It is naming the part that was already chosen, before eleven areas each
decide it again.

What stays legitimate: borders **inside** a shared part — `Card`'s own edge, `Input`'s,
`Table`'s row rules — and a genuine data separator within a card. The test is ownership. A border
that `packages/ui` draws is the design system; a border added in `apps/*/src` is almost always an
implementer rebuilding something the library ships.

### The rule behind the rule: silence resolves to the reference

Where the tokens and the shared parts leave a choice open, the answer is
`.scratch/foundation/reference/inspo/`, and specifically: **adopt what the frames actually
contain.** Do not fall back on a generic pattern because the mock is silent — the lo-fi SVGs are
silent about appearance *by construction*, and ADR-0013 exists precisely because appearance then
had no source. It has one now. Silence in the SVG is a pointer to `inspo/`, not a licence.

**The boundary this does not move.** ADR-0013 adopted the reference's *skin* and *parts* and
rejected its *screens* — Dashboard, Inventory, Purchases, Sales Orders, Banking, Finance — and
that rejection is untouched and is the most likely thing to be got wrong by someone reading this
record on its own. "Elements the product already has, wearing the reference's look" is the whole
of it. An implementer who opens `orders2-with-table.webp` and builds a Sales Orders screen has
made the exact mistake ADR-0013 was written to prevent, and this record makes it no less a
mistake. The promo card at the reference sidebar's foot and the `⌘+Space` palette are the same
class of thing: present in the frames, excluded by name, still excluded.

## What changed in code

- `apps/backoffice/src/components/AppShell.tsx` — `border-b border-border` off the header,
  `md:border-r md:border-border` off the sidebar.
- `apps/pos/src/components/AppShell.tsx` — the same `border-b`. **Deliberately included though
  the human was looking at the back office.** It is the identical defect from the identical
  cause, and leaving it would reintroduce the drift this record exists to stop.
- `docs/agents/code-standards.md` — new section 7, which is where implementers and fixers
  actually read it. This record is the reasoning; that section is the instruction.

`rg -n 'border-[btlr]|divide-' apps/*/src` now returns nothing, and that is the check.

## What this does not decide

- **`--color-border: #8a8a8a` itself.** At 1px on white it is heavier than the reference's
  hairline, and it is now visible on the one surface that survives — `Card`'s own edge, plus
  `Input` and `Table`. Lightening it is a token change reaching every part and every app, so it
  is a separate decision with a contrast re-run behind it, not a side effect of this one.
  **Named as the most likely follow-up.**
- **The inset canvas.** The reference floats the whole shell as a rounded panel on a tinted page.
  `Sidebar` ships `variant="inset"` for exactly that shape, but it drags `duration-200`
  transitions into the chrome, which record 009 bans — the same collision record 017 hit. Still
  open, still needs its own record.
- **Dark mode.** The reference has it; `theme.css` defines one palette. Untouched here.

## What would make this decision wrong

- **A screen genuinely needs a full-bleed region** — a POS item grid running edge to edge is the
  plausible case, and `apps/pos` is where it would surface. Wrapping that in a card would waste
  the terminal's most valuable space. The rule as written would forbid it, and the honest fix is
  an amendment naming the exception, not a fixer quietly ignoring section 7.
- **Card-in-card nesting turns out unavoidable** on a dense screen — a filter strip inside a
  table card inside a page card reads as three stacked shadows and looks worse than one rule
  would have. If that happens, the rule needs a nesting clause; it does not need reversing.
- **"Silence resolves to the reference" gets read as "build the reference's screens."** Guarded
  against above in the strongest terms available, and still the failure mode I would bet on. If
  it happens twice, the answer is to move the screens/skin boundary into `code-standards.md`
  itself rather than leaving it one link away in ADR-0013.

## Evidence

- `.scratch/foundation/reference/inspo/dashoard.webp`, `orders2-with-table.webp` — every section
  a white rounded card on the page ground; no divider rules anywhere in the chrome.
- `.scratch/foundation/reference/inspo/README.md` — `dashoard.webp` authoritative for "card
  surfaces"; the "not authoritative for" column, which is the screens/skin boundary.
- `docs/adr/0013-visual-design-system-and-palette-roles.md` — layers 1 and 2 adopted, layer 3
  rejected.
- `.scratch/foundation/issues/14-reskin-the-shared-parts.md:65, 193` — the Card criterion, and
  the `rounded-xl` → `rounded-2xl` change made against it.
- `packages/ui/src/theme.css:15, 17, 34` — `#fafaf7` ground, `#ffffff` card, `#ffffff` sidebar.
- Verified live at 1600×900: dividers gone, the placeholder `Card` reads as a white surface on
  the off-white ground with no rule between sidebar and content.
