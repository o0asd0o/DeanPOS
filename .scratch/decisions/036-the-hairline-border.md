# 036 — The border is a hairline, below WCAG 1.4.11, knowingly

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** medium — an accessibility criterion this repo tests for, deliberately lowered
- **Asked by:** the human, supplying a visual reference to copy
- **Decided by:** **the human, directly**, presented with three options
- **Relates to:** [013](013-density-mechanism-and-token-names.md), [014](014-the-focus-indicator.md)

## What changed

`--color-border` and `--color-input` go from `#8a8a8a` to `#e5e7eb`. Against
`--color-background` (`#f4f5f6`) that is **1.13:1**, where WCAG 2.2 SC 1.4.11
requires **3:1** for the visual boundary of a user-interface component. Buttons,
inputs and select triggers also move from `rounded-md` to `rounded-full`, and
inputs gain a `bg-card` fill — that part is pure style and carries no criterion.

## Why it is a deviation and not a fix

There was no lighter value available that still passed. `#8a8a8a` measures
3.16:1 — the token was already sitting on the 3:1 floor, and the first
perceptibly lighter grey (`#a3a3a3`) is 2.31:1. The choice was therefore
binary: keep the current stroke, or deviate. The human chose the reference.

The white `bg-card` fill does not rescue it. White on `#f4f5f6` is 1.07:1, so
the fill is a weaker boundary than the stroke it sits inside — the stroke is
the boundary, and the boundary is below the criterion. Saying otherwise would
be arithmetic laundering.

What is **not** weakened: the focus indicator. `--color-ring` stays `#1e1e1e`
at 2px with a 2px offset (record 014), so a keyboard user still gets a
boundary far above 3:1 on the control they are actually operating. The
deviation costs a mouse user scanning an idle form, not a keyboard user
locating focus.

## The guard that remains

`packages/ui/tests/contrast.test.ts` no longer asserts 3:1 for these two
tokens. It asserts **1.1:1**, which is the one thing still worth failing on:
a border that drifts far enough to be the background is a control with no
edge at all. Every other pairing in that file is untouched and still at its
WCAG threshold.

## Reversal

One value in `theme.css` and two thresholds in the contrast test. Bring it
back to `#8a8a8a` if a real user reports losing field edges, if the product
takes on an accessibility conformance commitment, or if a design pass gives
the page a background that makes a darker stroke read as heavy — the reason
the reference gets away with it is that its own page is near-white.
