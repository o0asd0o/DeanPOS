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
| `grid.webp` | The 8px spacing grid; the column-grid *logic* (12 columns, gutters, margins) | The specific pixel breakpoints printed on the frame — see reconciliation below |
| `collage.webp` | Context only — how the surfaces read together across devices | Nothing. No spacing, colour, radius, or layout claim should be drawn from this file alone |

## Reconciling `style.webp` against ADR-0013

`style.webp` presents `#35CCA6` and `#E14A77` as the brand palette with no stated roles beyond
"the palette." ADR-0013 measured both against `packages/ui/tests/contrast.test.ts` and found
neither passes AA with any foreground this product already uses, and demoted both to **status and
chart use only** — a dot, a badge fill, a chart series, never text on top of them.

This is not the frame going stale. `dashoard.webp`'s own `Open`/`Completed` badges already use
saturated fills as status colour, not as button colour, and every pressable control across all six
frames (`Process All`, the active sidebar pill, `Get Started`) is black. The frames and the ADR
agree on usage; only `style.webp`'s "color palette" label overstates it. Per ADR-0013:

- `#1E1E1E` is the action colour.
- `#35CCA6` and `#E14A77` are status/data-visualisation accents only.
- Destructive (void, refund) gets its own darker red, `#C0264F` — not in this frame at all.

A reader who finds `style.webp` first and sees "brand colours" must read this section before
concluding the ADR is stale. It is not; the frame just never had a policy attached to its swatches.

## Reconciling `grid.webp` against DeanPOS's widths

`grid.webp` labels its two frames "Desktop (1.400px)" and "Responsive (375px)," though the
dimension actually annotated on the column grid is 1320px content width (60px margins either
side of 1400) and 343px (24/16-px margins on 375). DeanPOS draws its lo-fi mocks at 1440, 1280,
and 390 (`design/lofi/README.md`) — none of which match either number here.

**The 8px rhythm and the 12-column logic carry over. The specific breakpoints do not.** Build to
DeanPOS's own widths; do not import 1400/375 or try to reconcile two width tables at build time.
