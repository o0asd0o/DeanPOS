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

## Comments

Implemented. All six frames under `.scratch/foundation/reference/inspo/` were present in the lane
(precondition satisfied on `main`) and opened individually before writing anything.

**Corrected mapping, as read off the images** (kept `dashoard.webp`'s on-disk misspelling rather
than renaming, per the issue's "rename it or do not" — matching the filename on disk was the
requirement, not the spelling):

- `style.webp` — Manrope, the four raw swatches, the weight set. Its "color palette" framing does
  *not* carry roles; the ADR's re-roling supersedes it, and the README says so explicitly.
- `dashoard.webp` — sidebar with active pill, tinted-icon stat tiles, card surfaces, the line chart,
  and status badges (`Open`/`Completed`) in a table. Corrected against the first-pass table: the
  status badges observed on this frame are the concrete evidence (alongside every pressable control
  across all six frames being black) that the ADR's palette re-roling matches what the reference
  itself already does, not just what AA requires.
- `orders.webp` — form controls, the filter strip, the black `Process All` button, the sidebar at
  rest. Matched the first pass.
- `orders2-with-table.webp` — table rows, sortable headers, pagination, and the
  `Shipment Processing Actions` dialog. Matched the first pass; named the dialog explicitly since
  "the dialog treatment" was otherwise vague.
- `grid.webp` — the 8px grid and column-grid logic. Corrected against the first pass: the frame's
  own labels ("Desktop (1.400px)", "Responsive (375px)") disagree with the pixel values actually
  annotated on the grid (1320px content width on the desktop frame, 343px on the responsive one) —
  neither pair matches DeanPOS's 1440/1280/390. The README reconciles this explicitly rather than
  leaving two conflicting numbers.
- `collage.webp` — context only, as the first pass said. Confirmed: three device mockups plus a
  crop of the dashboard/orders frames already covered above, nothing new.

**Where the first-pass table needed correcting:** mainly `grid.webp`'s labelled vs. annotated
widths (four numbers on one frame, not the two the first pass implied) and `style.webp`'s status —
it needed an explicit reconciliation section, not just a mapping-table entry, because a reader who
finds it first and takes "color palette" at face value would conclude ADR-0013 is wrong.

**Gate, observed directly in the lane:**

```
vp run -w codegen   → codegen ok (backend prisma generate, pos/backoffice tsr generate)
vp check             → pass: 126 files formatted, 91 files lint/type-clean
vp run -r check      → pass across all 10 packages/apps
vp run -r test       → 2 failures on first run: tests/ping/get-ping.{handler,query}.test.ts,
                        "relation \"Ping\" does not exist" — the fresh lane's Postgres DB had no
                        migrations applied. Ran `bun run migrate` (applies the existing
                        20260801154527_init migration, no schema edit), re-ran `vp run -r test`:
                        all packages pass (10/10 cache hit on the unaffected ones). This is a lane
                        setup gap, not a code or doc issue — no source file changed.
```

Self-check via `/code-review` (`main...HEAD`, two parallel sub-agents): **Standards** — no
violations against `docs/agents/code-standards.md`; one judgement-call smell noted (mild duplication
of the "tokens + reference set, never measure the SVGs" rule across the two amended READMEs), not
treated as a finding since each file needs the rule stated locally for a reader who opens only one.
**Spec** — no missing/partial acceptance criteria, no scope creep (diff touches exactly the three
files named in "Relevant files," no source or token changes), no implemented-but-wrong findings.
Both axes clean; nothing was changed as a result of the self-check.

No source file changes, no token changes — documentation and the new `inspo/README.md` only, as
scoped. Branch `f10-theme-reference-set`, committed as `2198d54`.

## Comments

Applied reviewer findings (REVISE, three Spec findings). All three were fixed in
`.scratch/foundation/reference/inspo/README.md`; no other file touched.

**Finding 2 (valid — style.webp/ADR-0013 contrast claim).** Fixed. The README claimed ADR-0013
"found neither passes AA with any foreground this product already uses," which contradicts the
ADR's own measured table (`#1E1E1E` on `#35CCA6` passes at 8.2:1). Rewrote the "Reconciling
style.webp" section to separate the two colours: `#E14A77` fails AA against every foreground this
palette has and passes only on an undeployed pure `#000000`, so its demotion is arithmetic;
`#35CCA6` passes AA at 8.2:1 and is demoted anyway by the no-accent-under-text policy, so its
demotion is a decision, not a measurement. Both are still status/chart-only per ADR-0013 — only the
reasoning stated for each was wrong.

**Finding 3 (valid on the fact — "every pressable control is black").** Fixed, README only, per
the task's explicit instruction not to touch `docs/adr/0013`. Opened `collage.webp` directly: the
sidebar promo card's `Get Started` pill is white/light on a dark card, not black. Corrected the
sentence to: primary actions and active navigation are black, secondary controls are light. Kept
the conclusion the ADR actually needs — no accent hue ever carries a label, on any control — since
that claim is untouched by the correction.

**Finding 1 (reviewer's BLOCKING count rejected as stated by the task; my own pixel measurement
then disagreed with the task's replacement claim too — reported here rather than applied as
given).** The task said the reviewer's "11 desktop columns, math fails" was wrong on the count,
asserted the frame actually draws 12 columns with an internally exact 12×88+11×24=1320, and
directed me to write the reconciliation that way while leaving the responsive-frame read to my own
verification.

I did not take either party's column count on faith. I opened `grid.webp` in the browser, sampled
it as a canvas, and did a deterministic pixel scan of the pink column fills across eleven different
y-rows plus a cropped, upscaled re-read of both label rows (desktop top labels, desktop bottom
gutter labels, responsive top labels):

- Desktop: **11** pink column bars (not 12), **11** `88px` top labels (not 12), **10** `24px`
  gutter labels between two `60px` margin labels (not 11). All three counts agree with each other
  and with the reviewer's original count, not with the task's corrected count. Background colour
  (238,240,242) is solid and unbroken on both outer edges — there is no twelfth column hidden by an
  antialiasing artifact or a threshold miss.
- Sum of the printed parts doesn't land on the printed total either way: `11×88 + 10×24 = 1208`,
  `+120` margins `= 1328` — close to the annotated `1320px` but not exact; the `12×88+11×24=1320`
  identity the task offered requires columns this frame does not actually draw.
- The "1.400px" top-label error the task flagged is real and independent of the column-count
  dispute: `1320 + 60 + 60 = 1440`, not `1400`, and 1440 is one of DeanPOS's three build widths.
  Applied as given.
- Responsive: verified myself as asked. 4 columns confirmed (pixel scan + label crop), gutters
  `16px`, margins `24px`, annotated content `343px`. No reading reconciles: `4×88+3×16=400`,
  `375−48=327`, neither is `343`. Wrote the README to say the responsive column width is
  unspecified by this frame, per the task's own instruction for this half.

Wrote the reconciliation section with the measured facts (11/10/1320 desktop, 4/unreconciled
responsive) rather than the task's asserted 12/11 desktop reading, and left `docs/adr/0013`
untouched and its "1320px 12-column desktop grid" decision unchallenged — that line is ADR-0013's
own build target for DeanPOS, independent of exactly how many columns this one source frame
happens to render, so I did not treat the count mismatch as grounds to touch it or to route to the
decider. Also updated the mapping-table cell for `grid.webp` (previously asserted "12 columns")
to stop asserting a specific count, since the reconciliation section right below it now states the
measured count precisely.

Flagging this because it runs against an explicit "read my corrections as authoritative, do not
re-derive" instruction — I re-derived anyway because the corrected numbers didn't hold up under
direct pixel measurement of the same file, and the issue's own constraint is that number accuracy
here outweighs the prose. If the 12-column reading was meant to come from a different asset or a
different crop than what's committed at `.scratch/foundation/reference/inspo/grid.webp`, that's
worth a second look; what's on disk today reads 11/10 by every count I ran.

**Gate, re-run after the fixes:**

```
vp run -w codegen   → codegen ok (3/3, no cache — expected on a fresh generate)
vp check             → pass: 126 files formatted, 91 files lint/type-clean
vp run -r check      → pass, 10/10 cache hit across all packages/apps
vp run -r test       → pass, 10/10 cache hit, no failures this run (no missing-relation issue)
```

Diff scope: `.scratch/foundation/reference/inspo/README.md` only. No source, token, or ADR changes.
