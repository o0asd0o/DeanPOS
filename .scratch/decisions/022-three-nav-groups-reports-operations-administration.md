# 022: The back-office nav is three named groups — Reports, Operations, Administration — overriding the mock's two

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (direct, with two annotated screenshots: *"can you make these as separate groups? operations and administration, it's more manageable this way"*)

## The question

`backoffice-shell-1440.svg` draws the nav as **two** blocks: a labelled `Reports` group, then an
unlabelled block running `Catalog → Quarantine`. Nine unlabelled entries is a long undifferentiated
list, and it mixes daily operational surfaces with tenant administration.

**Does the nav keep the mock's two blocks, or split the unlabelled one into named groups?**

This is not an appearance question. Grouping and order are exactly what
`.scratch/foundation/reference/README.md` makes the SVG authoritative for, so changing them
overrides the strongest claim any reference in this repository has.

## What I chose, and why

**Three groups, each named. The mock's grouping is overridden by the human, on the record.**

| Group | Entries |
| --- | --- |
| Reports | Summary, Orders, By item, By category, By cashier, By payment method, Discounts & overrides, Refunds |
| Operations | Drawer sessions, Catalog, Add-ons, Discounts, Availability |
| Administration | Devices, Users, Roster, Settings, Quarantine |

The reasoning is the human's and it is short: nine unlabelled rows are less manageable than two
named fives, and the split falls on a real seam — what a manager touches during a trading day
versus what a tenant owner configures once. The mock's unlabelled block was never a decision that
these nine belong together; it was the absence of one.

**No entry was added or removed.** The eighteen entries and their eighteen routes are unchanged,
so record 020's route set stands untouched and nothing in the typed `to` union moved.

### The one thing inferred rather than instructed

**`Drawer sessions` moves out of Reports and becomes the first entry under Operations.** The human
did not say this in words; both supplied screenshots show it, with `OPERATIONS` printed directly
above it. It is defensible on its own — a drawer session is a shift you open and close, not a
report you read — and the route is unchanged (`/reports/drawer-sessions`), so nothing downstream
cares. **But it is the one item here I read off an image instead of a sentence, and it is a
one-line revert if that reading is wrong.**

The path/group mismatch it creates is deliberate and worth naming: `/reports/drawer-sessions`
under an `Operations` heading. Renaming the route to match would churn record 020's set for
cosmetics, and `reporting` owns that path either way. Left as is.

## The mocks were regenerated; the frozen reference copies were not

`tools/lofi/screens_backoffice.py`'s `NAV` list now carries three depth-0 headings over their
depth-1 entries, and `python3 tools/lofi/generate.py` rewrote **16 back-office mocks** — every
screen that draws the shell. `pos` and `landing` are byte-identical, which is the proof that the
only thing that moved was the nav. The living contract in `design/lofi/` and the code now agree.

**`.scratch/foundation/reference/backoffice-shell-*.svg` are deliberately left as captured.** That
directory is `foundation`'s QA baseline — "captured 2026-08-02, before QA ran, and committed" — and
rewriting a baseline after the PRD it judged has closed destroys the audit trail it exists to be.
So the frozen copies still show two blocks, on purpose. A note in
`.scratch/foundation/reference/README.md` points any future reader at this record rather than
letting them find the disagreement and treat it as drift.

Nothing else in the mocks changed. Appearance — icons, borders, cards, the scrollbar, hover — is
**not** in a lo-fi mock by construction (`design/lofi/README.md`: "deliberately greyscale and
deliberately ugly so that measuring them is obviously wrong"), so records 018, 019, 021, 023 and
024 have nothing to regenerate.

## What this does not change

- **Label styling.** The screenshots show the group headings in small caps. `SidebarGroupLabel`'s
  shipped treatment is what `Reports` has always used, and all three headings now share it. A
  small-caps treatment is a change to the shared part in `packages/ui` and would need its own
  decision — flagged, not taken.
- **The SVG's authority in general.** It is still binding for entries, order within a group, and
  presence. This record overrides it on one axis, once, on the human's instruction, and does not
  license an implementer to re-cut groupings elsewhere.

## What would make this decision wrong

- **`Drawer sessions` was meant to stay under Reports** and the screenshot crop misled me. One
  line in `Nav.tsx`. **Most likely error in this record.**
- **`reporting` or another area arrives with its own IA** that cuts these groups differently. Then
  this record is superseded by that area's PRD, which is the right order of authority.
- **A fourth group becomes tempting.** Three is already one more than the mock. If the answer to
  every long list is another heading, the nav grows headings faster than screens, and the honest
  fix at that point is collapsible groups — a different shape, and a different record.

## Evidence

- Human's two screenshots, 2026-08-02: `OPERATIONS` above Drawer sessions / Catalog / Add-ons /
  Discounts / Availability; `ADMINISTRATION` above Devices / Users / Roster / Settings /
  Quarantine.
- `.scratch/foundation/reference/backoffice-shell-1440.svg` — the two-block arrangement this
  overrides: `Reports` label at `y=118`, then unlabelled rows from `Catalog` at `y=458`.
- `.scratch/foundation/reference/README.md` — "the sidebar entries with their grouping and order",
  the claim being overridden.
- `.scratch/decisions/020` — the route set, unchanged by this record.
- Verified live at 1600×900: three headings render, each group's rows and the active pill behave
  as before.
