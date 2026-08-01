# 10 — The theme reference set, and what fidelity now means

**Status:** ready-for-agent

## What to build

No source file changes. This issue makes the **visual contract for the skin** readable by the
pipeline, and corrects the two documents that currently claim no such contract exists.

ADR-0013 adopts the reference set in `.scratch/foundation/reference/inspo/` as DeanPOS's skin and
shared parts. This issue describes and bounds it.

> **Precondition, and it is not this issue's to satisfy.** The six frames must already be committed
> to `main` before this issue is dispatched. A lane worktree is created from `main` and cannot see
> an untracked file, so an implementer who finds `.scratch/foundation/reference/inspo/` empty or
> missing **stops and reports it**. Do not proceed, do not reconstruct the mapping from this issue's
> table, and do not write a README describing files you cannot open. The table below is a starting
> point to be corrected against the images, not a substitute for them.

**The correction this issue also carries.** Two documents state that colour, spacing, and radii have
no visual authority:

- `design/lofi/README.md` — *"Spacing, type scale, colour, radii, and every interaction state come
  from `packages/ui` tokens and from the nearest existing screen — never from measuring these
  files."*
- `.scratch/foundation/reference/README.md` — *"judge structure, order, presence, state coverage,
  and accessibility — never spacing or proportion."*

Both were correct when greyscale lo-fi was the only reference. Neither is correct now. The lo-fi
mocks still fix **what is on a screen and in what order**, and are still never to be measured — that
is unchanged and stays. What changes is that the skin now has a named source, so "unjudgeable"
becomes "judged against the tokens and the reference set."

## Acceptance criteria

- [ ] The six files under `.scratch/foundation/reference/inspo/` are present in the lane and were
      opened and looked at. If the directory is empty, the precondition above was not met — stop.
- [ ] A `README.md` beside them mapping each file to what it is authoritative for, and — as
      importantly — what it is not. A first pass at the mapping, to be corrected against the files
      themselves rather than trusted:

      | File | Authoritative for |
      | --- | --- |
      | `style.webp` | Manrope, the four brand colours, the weight set |
      | `dashoard.webp` | tile row, card surfaces, sidebar with active pill, status badges, chart treatment |
      | `orders.webp` | form controls, the filter strip, the black action button, the sidebar at rest |
      | `orders2-with-table.webp` | table rows, sortable headers, pagination, the dialog treatment |
      | `grid.webp` | the 8px grid, the 1320px 12-column desktop frame, the 343px responsive frame |
      | `collage.webp` | context only — how the surfaces read together. Authoritative for nothing |

- [ ] That README states plainly that **no frame decides any DeanPOS screen's content or order.**
      ADR-0013 rejected the reference's information architecture; `design/lofi/` and the PRDs keep
      that job. An implementer who opens `orders2-with-table.webp` and builds a Sales Orders screen
      has made the exact mistake the ADR exists to prevent.
- [ ] The style-guide frame is reconciled against ADR-0013 **in that README**, because they disagree
      on purpose: `style.webp` presents `#35CCA6` and `#E14A77` as brand colours, and ADR-0013
      demotes both to status and chart use after measuring that neither can carry a label. A reader
      who finds the frame first must not conclude the ADR is stale.
- [ ] `grid.webp` is reconciled too. It specifies a 1400px desktop and a 375px responsive frame.
      DeanPOS draws its mocks at 1440, 1280, and 390 (`design/lofi/README.md`). The **8px rhythm and
      the column logic** carry over; the specific breakpoints do not, and the README says so rather
      than leaving an implementer to reconcile two width tables at build time.
- [ ] `.scratch/foundation/reference/README.md` amended: fidelity judging now covers colour,
      spacing, type, and radii **against `packages/ui` tokens and the theme reference**, while still
      never measuring a lo-fi SVG. Its existing "only the chrome is in scope" and "renders nothing on
      purpose" sections are untouched and still binding.
- [ ] `design/lofi/README.md` amended in the same spirit: the mocks decide content and order; the
      skin now has a named authority. One or two sentences. Do not restate the ADR.
- [ ] No source file changes, no token changes. Documentation and committed assets only.

## Depends on

- 05 — `packages/ui`: tokens, Tailwind preset, primitives

## Relevant files

- `.scratch/foundation/reference/inspo/**`
- `.scratch/foundation/reference/README.md`
- `design/lofi/README.md`

## Comments

_Written from the `/grill-with-docs` session of 2026-08-02. Decision: `docs/adr/0013`._

**This issue blocks 14 and 15**, the two that re-skin against these frames. It does not block 11,
12, or 13 — the token roles and the component list are settled in ADR-0013 and do not need the
images.

`dashoard.webp` is misspelled. Rename it or do not, but the README's mapping must match whatever is
on disk, because that table is what an implementer greps.

**On what did not need doing.** An earlier draft of this plan closed with an issue re-capturing the
QA frames in `.scratch/foundation/reference/`, assuming a theme change made them stale. It does not.
Those four files are copies of greyscale lo-fi SVGs, not screenshots of the built app, and no skin
change can invalidate them. That issue was dropped and this one replaced it.
