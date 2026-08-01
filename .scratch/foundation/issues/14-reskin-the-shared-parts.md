# 14 — Re-skin the shared parts to the reference

**Status:** ready-for-agent

## What to build

Issue 13 committed the parts as the CLI emits them. This issue makes them look like DeanPOS: tokens
from issue 11, shapes from the reference frames, both densities.

Every change lands on top of a vanilla commit, so the diff of this issue **is** the design system.
Keep it that way — a rewrite that no longer resembles its shadcn origin cannot be re-derived when
the component is regenerated, and record 007 bought that property on purpose.

## Visual reference

- Image · component: Sidebar · web: `.scratch/foundation/reference/inspo/dashoard.webp`
- Image · component: Sidebar · web: `.scratch/foundation/reference/inspo/orders.webp`
- Image · component: Card · web: `.scratch/foundation/reference/inspo/dashoard.webp`
- Image · component: Badge · web: `.scratch/foundation/reference/inspo/dashoard.webp`
- Image · component: Table · web: `.scratch/foundation/reference/inspo/orders2-with-table.webp`
- Image · component: FilterStrip · web: `.scratch/foundation/reference/inspo/orders.webp`
- Image · whole-screen · web: `.scratch/foundation/reference/inspo/grid.webp`

`grid.webp` is a specimen sheet, not a screen — it is authoritative for the 8px rhythm and the column
logic and for nothing else, and its 1400/375 frames are not DeanPOS's widths (see issue 10). It is
tagged `whole-screen` because that is the grammar `docs/agents/issue-tracker.md` permits; the
sentence above is what actually bounds it.

Read `.scratch/foundation/reference/inspo/README.md` first. These frames are authoritative for
**appearance only**. None of them decides what any DeanPOS screen contains — that is `design/lofi/`
and the PRDs, and ADR-0013 rejected the reference's information architecture outright.

## The one place the frames are deliberately not followed

The reference draws its `Completed` badge as a **saturated green fill with white text**. ADR-0013
forbids it: white on `#35CCA6` measures 2.03:1 against a 4.5:1 floor, and the accents are barred
from sitting under text.

DeanPOS badges are a **pale tint background with a saturated dot and dark text**. This will look
slightly quieter than the frame, and that is correct, not a fidelity miss. It is the single most
likely thing for a reviewer or QA to raise as a defect, so it is written here and belongs in the
build report too.

## Acceptance criteria

- [ ] **Sidebar** — the reference's resting and active states: a black filled pill on the active
      entry, quiet foreground on the rest, the product mark at the top. The active state is
      `#1E1E1E`, the action colour, per ADR-0013.
- [ ] **Card** — the reference's surface: white on the off-white page ground, generous radius, a
      border quiet enough to read as separation rather than as a box.
- [ ] **Badge** — pale tint plus saturated dot plus dark text, across the status set (green, amber,
      blue, pink). Never an accent fill under a label. See above.
- [ ] **Table** — header row, sortable-column affordance, row separation, and row height per density.
      **The affordance only.** No sorting behaviour, no state, no `@tanstack/react-table` — record
      007's import ban holds and each app owns its own sorting.
- [ ] **The filter strip's three primitives** — `tabs`, `select`, and `input` — skinned to how the
      reference draws them: the segmented row, the quiet search field, the control heights.
      **The strip itself is not assembled here.** `packages/ui` has no screen to assemble it on, and
      extraction into a shared `FilterStrip` is forbidden until a real report proves the shape. Area
      7 composes it from these three. Skinning the parts is this issue; the arrangement is not.
- [ ] **Both densities are applied to every part.** Compact matches the reference. Touch scales type,
      row height, and padding up, and holds `--min-touch-size: 44px` on anything tappable.
- [ ] **Say plainly in the build report that the densities were not looked at.** There is no screen
      in this repository that renders a Card, a Badge, and a Table together, and this issue does not
      add one — a preview route committed to an app is a surface eleven areas would inherit, and it
      is not what was asked for. So the density work here is verified by reading tokens and classes,
      which is weaker than seeing it, and the first consuming screen is where a wrong touch scale
      will actually surface. Do not report "verified at 1280 and 390"; report what was really done.
- [ ] No raw hex and no arbitrary Tailwind values. The guard from issue 12 does not cover
      `packages/ui`, so this is a review criterion here rather than a test failure — which makes it
      easier to breach, not harder to justify.
- [ ] **The focus opt-out is stripped from every part pulled in issue 13.** Stock shadcn ships
      `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50` on most components; in
      Tailwind 4 that `outline-none` sits in the utilities layer and beats `theme.css`'s `@layer
      base` `:focus-visible` rule, so the token outline never renders. This is precisely the blocking
      finding issue 05 closed on `button.tsx`, arriving again on seven more components. Issue 13 was
      told to leave it in place to keep its diff vanilla; removing it is this issue's job and it is
      not optional.
- [ ] Focus indicator is the token outline on every part, opaque, and visible against both the card
      surface and the black action fill.
- [ ] `contrast.test.ts` green, with the same token set issue 11 established. A part that needs a
      colour the palette does not have is a signal to route a question, not to add a token here.
- [ ] Nothing became domain-aware.
- [ ] `check` and `test` pass across the repository.

## Depends on

- 10 — The theme reference set, and what fidelity now means
- 13 — Pull the shared parts from shadcn, unmodified

## Relevant files

- `packages/ui/src/components/**`
- `packages/ui/src/index.ts`

## Comments

_Written from the `/grill-with-docs` session of 2026-08-02. Decision: `docs/adr/0013`._

**What the frames do not contain, and must not be invented here.** `design/lofi/README.md` lists
empty states, loading and skeleton states, most error states, and hover, focus, disabled, and pressed
treatments as deliberately undrawn. The reference set does not fill those gaps either — it draws
resting states of populated screens. Focus is already decided by the token outline; the rest routes
to the `decider` rather than being guessed at in a shared component eleven areas inherit.

`.scratch/decisions/009` already decided loading, error, empty, hover, disabled, and focus **for the
two shells**. Read it before routing anything — the answer may already exist.

**Stripping unused `sidebar` machinery is allowed here** and was deferred from issue 13 for this
reason: the shape is known once the skin is on. If it is stripped, the build report says what went
and why, because a stripped component no longer matches a clean regeneration.
