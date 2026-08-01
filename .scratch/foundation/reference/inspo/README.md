# The theme reference set

Six frames, adopted by `docs/adr/0013-visual-design-system-and-palette-roles.md` as DeanPOS's
**skin and parts** — never as screens. This README maps each file to what it is authoritative for
and, as importantly, what it is not. Opened and looked at directly, not inferred from filenames.

**No frame decides any DeanPOS screen's content or order.** ADR-0013 rejected the reference's own
information architecture (Dashboard, Inventory, Purchases, Sales Orders, Banking, Finance) —
`design/lofi/` and the PRDs keep that job, unchanged. An implementer who opens
`orders2-with-table.webp` and builds a Sales Orders screen has made the exact mistake the ADR
exists to prevent: DeanPOS has no such screen, and a Shopify-admin-shaped one is not a translation
of anything in `design/lofi/`.

`dashoard.webp` is misspelled on disk. This table matches the filename as it actually exists —
grep against this file, not against the correct spelling.

| File | Authoritative for | Not authoritative for |
| --- | --- | --- |
| `style.webp` | Manrope; the four raw swatches (`#35CCA6`, `#E14A77`, `#FFFFFF`, `#1E1E1E`); the weight set (Regular/Medium/Semi Bold/Bold) | Which of the four is the *action* colour — see reconciliation below |
| `dashoard.webp` | Sidebar with an active pill; stat tiles with tinted icon squares; card surfaces; the line-chart treatment; status badges (`Open`/`Completed`) in a table | The dashboard screen itself — DeanPOS has no dashboard route with these tiles; the accuracy gauge and the `⌘+Space` palette (ADR-0013 excludes both by name) |
| `orders.webp` | Form controls (select, date, text) in the "Process Orders" panel; the filter strip (`Order Type: All` / `Status All` / `Date All` / `Customer All` pill row plus search + Filters button); the black primary action button (`Process All`); the sidebar at rest | The Sales Orders screen or its fields — not a DeanPOS screen |
| `orders2-with-table.webp` | Table rows and sortable column headers (`▾` glyphs); pagination (`« First ‹ Back 1 2 3 … Next › Last »`); the dialog/modal treatment (`Shipment Processing Actions`) | The Sales Orders screen, its detail panel, or its specific fields |
| `grid.webp` | The 8px spacing grid; the column-grid *logic* (fixed columns, gutters, margins) | The specific column counts, gutter widths, and breakpoints printed on this frame — see reconciliation below |
| `collage.webp` | Context only — how the surfaces read together across devices | Nothing. No spacing, colour, radius, or layout claim should be drawn from this file alone |

## Reconciling `style.webp` against ADR-0013

`style.webp` presents `#35CCA6` and `#E14A77` as the brand palette with no stated roles beyond
"the palette." ADR-0013 measured both against `packages/ui/tests/contrast.test.ts` and demoted
both to **status and chart use only** — a dot, a badge fill, a chart series, never text on top of
them — but the two colours got there differently. `#E14A77` fails AA against every foreground this
palette already has (2.03:1 white, 4.32:1 `#1E1E1E`); it passes only on a pure `#000000` the
palette deliberately does not add, so its demotion is arithmetic. `#35CCA6` passes AA comfortably
against `#1E1E1E` at 8.2:1; its demotion is a **policy** choice — no accent hue carries a label,
full stop — not a contrast failure. A reader who needs to reopen this later is arguing arithmetic
for the pink and policy for the green; they are not the same kind of decision.

This is not the frame going stale. `dashoard.webp`'s own `Open`/`Completed` badges already use
saturated fills as status colour, not as button colour. Primary actions and active navigation
across the six frames — `Process All`, the active sidebar pill — are black; secondary controls are
light (`collage.webp`'s `Get Started` pill sits white-on-dark on a promo card, not black). What
survives that correction is the claim the ADR actually needs: no frame ever asks `#35CCA6` or
`#E14A77` to carry a label, on any control, primary or secondary. Per ADR-0013:

- `#1E1E1E` is the action colour.
- `#35CCA6` and `#E14A77` are status/data-visualisation accents only.
- Destructive (void, refund) gets its own darker red, `#C0264F` — not in this frame at all.

A reader who finds `style.webp` first and sees "brand colours" must read this section before
concluding the ADR is stale. It is not; the frame just never had a policy attached to its swatches.

## Reconciling `grid.webp` against DeanPOS's widths

The frame's own top labels, "Desktop (1.400px)" and "Responsive (375px)," are not the reliable
numbers — the annotated values on the grid itself are, and they disagree with the top labels:

**Desktop.** Counted directly off the frame: 11 columns (11 `88px` labels), 10 internal gutters
(10 `24px` labels between two `60px` margins), annotated content width `1320px`. The "1.400px" top
label is simply wrong: `1320 + 60 + 60 = 1440`, not `1400` — and 1440 *is* one of DeanPOS's own
three build widths (`design/lofi/README.md`). Summing the printed parts (`11 × 88 + 10 × 24 =
1208`, `+ 120px` margins `= 1328`) still doesn't land exactly on the printed `1320px` either; that
residual is the source asset's own rounding, not a DeanPOS number to chase. None of this changes
ADR-0013's decision to build DeanPOS's grid as a 1320px 12-column system — that is a design choice
made independently of how many columns this particular frame happens to draw, and it stands.

**Responsive.** Counted directly off the frame: 4 columns, all labelled `88px` — the same label as
the desktop columns, carried over rather than measured for this frame — with `16px` gutters and
`24px` margins, and an annotated content width of `343px`. No reading reconciles: `4 × 88 + 3 × 16
= 400px`; margins alone imply `375 − 48 = 327px`. Neither matches the printed `343px`. **The
responsive column width is unspecified by this frame.** Do not adopt 343, 400, or 327 as a DeanPOS
number.

**The 8px rhythm and the general column-grid logic carry over. The specific column counts, gutter
widths, and breakpoints printed on this frame do not.** Build to DeanPOS's own widths (1440, 1280,
390); do not import any number from this frame, and do not try to reconcile two width tables at
build time.
