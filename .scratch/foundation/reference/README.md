# Reference frames for the `foundation` PRD

Captured 2026-08-02, before QA ran, and committed. QA compares against **these files on disk**
— not against `design/lofi/`, and not by re-fetching anything.

| File | Source | Screen | Width |
| --- | --- | --- | --- |
| `pos-shell-1280.svg` | `design/lofi/pos/sale-grid-1280.svg` | terminal shell chrome | 1280, tablet landscape |
| `pos-shell-390.svg` | `design/lofi/pos/sale-grid-390.svg` | terminal shell chrome | 390, phone |
| `backoffice-shell-1440.svg` | `design/lofi/backoffice/reports-summary-1440.svg` | back-office shell + nav | 1440, desktop |
| `backoffice-shell-390.svg` | `design/lofi/backoffice/reports-summary-390.svg` | back-office shell + nav | 390, phone |
| `LOFI-CONTRACT.md` | `design/lofi/README.md` | what the mocks do and do not decide | — |

## Only the chrome is in scope

Both source mocks draw a full screen, and **most of what they draw belongs to a later area.**
`foundation` built shells. Judging this PRD against the whole frame would fail it for work it
was never asked to do.

**In scope — the terminal (`apps/pos`):** the top bar, the layout frame, and the position of
the regions. **Out of scope:** the cart, the item grid, the category tabs, the search field,
the ticket count, the fulfilment selector, and every control inside them — all `checkout`.

**In scope — the back-office (`apps/backoffice`):** the sidebar entries with their grouping and
order, the top bar, and the content region's frame. **Out of scope:** every figure, chart,
table, filter, date range, and `Export CSV` control in the content region — all `reporting`.

## What renders nothing on purpose

The mocks draw data that does not exist yet. `.scratch/decisions/009-terminal-shell-chrome-states.md`
requires these to render **no element at all** — not a dimmed placeholder, not an empty box —
because fake data in a shell is what eleven later areas would build against:

- `▾ Aling Nena's` — the tenant switcher. Area 2.
- `OFFLINE · 3 queued` — sync state. Area 5.
- `Ana (cashier) · Lock`, `Jomel · admin · Sign out` — auth. Area 2.
- The store filter, date range, `Export CSV`, and the computed-at line with its sync warnings.
  `reporting`.

**Their absence is correct and is not a fidelity finding.**

## How to judge these

`LOFI-CONTRACT.md` is binding: a mock fixes **what is on the screen and in what order, and
nothing else.** Colour, spacing, type, and radii now have a named source too — `packages/ui`
tokens and the theme reference set adopted by `docs/adr/0013-visual-design-system-and-palette-roles.md`
(`.scratch/foundation/reference/inspo/`, mapped file-by-file in the README beside it) — so judging
them is no longer an open question.

So judge **structure, order, presence, state coverage, and accessibility — plus colour, spacing,
type, and radii against `packages/ui` tokens and the theme reference.** What is still off-limits,
unchanged: **do not measure these SVGs.** They are greyscale lo-fi and were never meant to carry a
pixel value; a fidelity finding against a value neither the tokens nor the reference set specifies
is not a finding, it is an open question, and it routes as one.

The states the mocks do not draw were decided in writing, not left to the implementer:
`.scratch/decisions/009-terminal-shell-chrome-states.md` covers loading, error, empty, hover,
disabled, and focus for both shells. That record is part of the contract these frames belong to.
