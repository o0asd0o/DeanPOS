# 025: The page ground is `#eff4f7` — cool and a step darker, so a white card has an edge without drawing one

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (direct: the ground value, supplied after record 024 named a darker ground as its follow-up)

## The question

Record 024 took the border off `Card` and named the cost: `#ffffff` on `#fafaf7` is a **1.05:1**
step, so a card held itself apart from the page by almost nothing plus `shadow-sm`. That record
said the honest fix was a darker ground, and that it was a palette decision rather than a side
effect.

**This is that decision, and the human supplied the value.**

## What I chose, and why

**`--color-background: #eff4f7`.** One token. Nothing else in `theme.css` moved.

The card/ground step goes **1.05:1 → 1.11:1**. That is what makes record 024 hold: the card now has
an edge produced by the surfaces themselves, which is the reference's construction, rather than by
a stroke drawn around it. The same step does the same work for `--color-sidebar` (`#ffffff`), which
until now was a 2% difference nobody could see — the sidebar reads as its own surface for the first
time.

**The palette is now mixed-temperature, and that is a real change, not a tweak.** Every other
neutral in the set is warm — `#e4e4df` accent, `#eaeae6` secondary, `#f0f0ed` muted, and the
`#fafaf7` this replaces. `#eff4f7` is cool. On today's screens the two never meet: the warm
neutrals appear on the white sidebar and inside white cards, the cool ground appears behind them.
**On a screen where a `bg-muted` panel sits directly on the page ground they will meet, and the
mismatch will be visible.** Named here so it is diagnosed rather than rediscovered — the fix then
is to cool the other neutrals to match, which is a palette pass and its own record.

## What it unlocked in the same breath

With the step at 1.11:1, `shadow-sm` came off `Card` as well. **The card now has no border and no
shadow — the surface step is its entire edge.** Record 024 is amended to say so. Neither half works
without the other: at the old ground, a card with no stroke and no shadow would have been
invisible, and at this ground the shadow was doing nothing the step was not already doing.

## Contrast, measured

All 107 assertions in `packages/ui/tests/contrast.test.ts` pass. The pairings that name
`background` all lost margin against the old ground, and two of them are now close to the floor:

| Pair | Floor | Was (`#fafaf7`) | Now (`#eff4f7`) |
| --- | --- | --- | --- |
| `foreground` on `background` | 4.5 | 15.94 | 15.05 |
| `muted-foreground` on `background` | 4.5 | 6.52 | 6.16 |
| `border` on `background` | 3.0 | 3.30 | **3.12** |
| `input` on `background` | 3.0 | 3.30 | **3.12** |
| `status-success-tone` on `background` | 3.0 | 3.30 | **3.11** |
| `status-warning-tone` on `background` | 3.0 | 4.25 | 4.01 |
| `status-info-tone` on `background` | 3.0 | 4.73 | 4.47 |
| `status-danger-tone` on `background` | 3.0 | 5.53 | 5.22 |
| `ring` on `background` | 3.0 | 15.94 | 15.05 |

**`border`, `input`, and `status-success-tone` clear SC 1.4.11 by roughly 0.11.** That is the
operative finding: **the ground cannot be darkened again without breaking AA.** A future request
for "a bit more contrast behind the cards" is not a one-token edit any more — it takes `#8a8a8a`
and `#1f9d6b` with it. The suite will catch it; this record is so that whoever trips it knows why
immediately.

## What would make this decision wrong

- **Someone darkens the ground further** without reading the table above. The test fails, which is
  the design — but the instinct will be to relax the assertion rather than move the dependent
  tokens. **Most likely failure mode.**
- **The temperature mismatch surfaces sooner than expected** — a `bg-muted` or `bg-secondary`
  region on the page ground. Then the neutrals get cooled, and this record is the reason.
- **`apps/pos` inherits a ground chosen for a seated desktop.** Both apps share `theme.css`, so the
  terminal has a cool ground too. It has no cards and no screens yet, so nothing depends on the
  step there; deciding whether the terminal diverges is blind until `checkout` builds a screen, and
  that is when to revisit it.
- **`#eff4f7` is outside ADR-0013's four swatches.** So was `#fafaf7` — the ground was always
  derived, never one of the four — so this changes the derivation, not the adoption. If a reviewer
  reads ADR-0013 as fixing the ground, this record is the disagreement to argue with.

## Evidence

- `.scratch/decisions/024` — the borderless card, and the named follow-up this discharges.
- `packages/ui/tests/contrast.test.ts` — 107 pass; ratios above computed with the same WCAG 2.2
  formulas the suite uses.
- <https://www.w3.org/TR/WCAG22/#non-text-contrast> — SC 1.4.11, the 3:1 floor now cleared by 0.11.
- Verified live at 1280×600: card and sidebar both read as surfaces against the ground, with no
  stroke and no shadow on either.
