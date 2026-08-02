# 024: The `Card` has no border — the surface step and the shadow are the edge

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (direct: _"can you also make this not have a black border? the inspo doesn't have that"_)

## The question

Record 019 removed every ad-hoc divider from the shells and made `Card` the unit of separation.
That left `--color-border` — `#8a8a8a`, a mid-grey — visible on exactly one thing: the ring around
every card. Record 019 named this as its most likely follow-up and declined to take it.

**Does the card keep its border?**

## What I chose, and why

**No. `border` comes off `Card`; `bg-card` and `shadow-sm` are the edge. `--color-border` is
untouched.**

The reference is unambiguous — `dashoard.webp` and `orders2-with-table.webp` draw card surfaces as
white on a light ground with a soft shadow and **no stroke** — and after record 019 a card ring is
the loudest line left in the product.

**The token was not changed, and that is the substance of this decision.** Lightening
`--color-border` globally was the obvious-looking move and it is wrong. That token is also
`Input`'s edge, `Select`'s, and `Table`'s row rules, and a form control's boundary is a **UI
component boundary** under WCAG 2.2 SC 1.4.11 _Non-text Contrast_ — 3:1 against its adjacent
colour, Level AA. `#8a8a8a` on `#ffffff` clears that; a hairline chosen to flatter a card would
not, and the failure would land on the one place in the product where a missing edge costs a user
something. A card is decorative chrome with no such floor. So the correct edit is the narrow one:
remove the border from the part that does not need it, and leave the token that other parts depend
on exactly where the contrast test put it.

**Where it was edited.** `packages/ui/src/components/card.tsx` — one class string, in a `className`
slot that already existed. That is the same class of edit issue 14 made and record 017 called
mechanically re-appliable after a `shadcn` regeneration, as against a structural change that has to
be re-authored by hand. The generated baseline issue 13 bought is not spent by this.

## Amended the same day: the shadow came off too

Once `.scratch/decisions/025` deepened the page ground to `#f4f5f6`, the human removed `shadow-sm`
as well. **The card's edge is now the surface step alone** — `#ffffff` on `#f4f5f6`, 1.11:1 — with
no stroke and no shadow.

That is a stronger version of the same decision rather than a different one: this record's claim
was that a card is held by its surface, not by a line drawn around it, and a shadow is a softer
line. It only became viable after 025; at the old 1.05:1 ground, removing both would have left the
card invisible. The "cost" section below was written before 025 and describes the ground as it then
was — kept as written, since it is the argument that produced 025.

Everything below still stands, and the WCAG reasoning about `--color-border` is untouched.

## The cost, stated plainly

**`--color-card` is `#ffffff` and `--color-background` is `#fafaf7` — a 2% step.** With the border
gone, the card is held apart from the page by that step plus `shadow-sm`, and it is subtler than
the reference, where the canvas is a distinctly grey ground under pure-white cards. Verified live
at 1280×600: the card still reads as a surface, but it is quiet.

**The honest fix is a darker page ground, not a card border.** That is a palette change — it moves
every screen in both apps and wants the contrast suite re-run — so it is a decision, not a side
effect of this one. **Named here as the follow-up most likely to be wanted**, and the reason this
record does not simply reverse if a reviewer finds the card too quiet: the answer would be to
deepen the ground, not to put the ring back.

## What would make this decision wrong

- **A card on a white surface, not on the page ground** — a card inside a dialog, say. There the
  2% step is zero and the card has no edge at all. `shadow-sm` alone may not carry it, and the
  first screen that does this should say so rather than adding a local border.
- **Dark mode.** One palette exists today. A shadow on a dark surface is nearly invisible, so a
  dark theme will need a border or a lighter surface, and this record does not pre-empt that.
- **Someone reads this as "borders are gone from `packages/ui`."** They are not. `Input`,
  `Select`, and `Table` keep theirs, and the WCAG floor above is why.

## Evidence

- `.scratch/foundation/reference/inspo/dashoard.webp`, `orders2-with-table.webp` — card surfaces
  with shadow, no stroke.
- `.scratch/decisions/019` — where this was named and deferred.
- `packages/ui/src/theme.css:15, 17, 32` — `#fafaf7` ground, `#ffffff` card, `#8a8a8a` border.
- `packages/ui/tests/contrast.test.ts` — the suite that pins the token this record did not touch.
- <https://www.w3.org/TR/WCAG22/#non-text-contrast> — SC 1.4.11, the 3:1 floor for UI component
  boundaries.
- `ui check` and `ui test` (107) pass after the change; `backoffice check` passes across 41 files.
