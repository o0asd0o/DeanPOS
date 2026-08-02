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

**Round 1 fix (fixer, 2026-08-02).** Applied seven findings from review round 1:

1. `badge.tsx` — the `statusDotVariant` lookup map replaced with inline conditionals on the dot's
   `className`, checked against a typed `isStatusVariant` guard instead of an untyped
   `Record<string, string>` key lookup.
2. `badge.tsx` — `asChild` was broken for every variant: the body always rendered two children
   (`{dotClassName ? <span/> : null}{children}`), and `Slot.Root` throws unless it resolves to
   exactly one element. Fixed by moving the status dot to a plain sibling and wrapping only
   `children` in `Slot.Slottable`, which is the shape Radix's `Slot` expects (the dot becomes a
   child of the slotted element, `Slottable`'s target keeps the merged props). Added
   `packages/ui/tests/badge.test.tsx` — two render tests, `asChild` with the default variant and
   with `variant="success"`, using `@testing-library/react` (already used in `apps/api`). This
   required adding `@testing-library/react`, `@testing-library/dom`, `happy-dom`, and
   `@vitejs/plugin-react` as `packages/ui` devDependencies and a `packages/ui/vite.config.ts`
   (the package had none); the test file opts into the `happy-dom` environment per-file via a
   `@vitest-environment` docblock rather than globally, because `contrast.test.ts` reads
   `theme.css` off `import.meta.url` and happy-dom's URL resolution broke that when set globally.
3. `theme.css` — added `* { border-color: var(--color-border); } ` to `@layer base`. Tailwind 4's
   default border colour is `currentColor`, not a token, so the bare `border` utility on `card.tsx`
   and `table.tsx` was painting at the text colour (`#1e1e1e`) instead of `--color-border`
   (`#8a8a8a`). A rule, not a token — the 35-token set is unchanged and `contrast.test.ts` is
   still 49 green assertions. Build report's false claim about `border` corrected in place, below.
4. `tap-target` applied to `select.tsx`'s `SelectItem`, `tabs.tsx`'s `TabsTrigger`, `input.tsx`'s
   `Input`, `sidebar.tsx`'s `SidebarGroupAction`, `sidebarMenuButtonVariants` (the menu-button base,
   covering every row), `SidebarMenuAction`, and `SidebarMenuSubButton` (a sidebar control the
   finding's two line numbers didn't name but which is the same class of tappable primitive), and
   conditionally on `badge.tsx`'s root (`asChild && "tap-target"`, since a non-link badge should not
   be forced to a 44px floor).
5. `tabs.tsx` — `p-[3px]` replaced with `p-0.75` (rescales with `--spacing`: 3px at compact,
   3.75px at touch). Audited the rest of `packages/ui/src/components` for the same
   arbitrary-bracket-dimension pattern (`grep -n '\[[0-9]' *.tsx`, filtered to excerpts that
   weren't a Radix CSS var, a keyframe, or a non-dimension grid template): `tabs.tsx:24` was the
   only hit. `card.tsx`'s `grid-rows-[auto_auto]` and `grid-cols-[1fr_auto]` are not dimensions.
6. `table.tsx` — `TableHeader` gained `[&_tr]:bg-muted` for a distinct header surface, per
   `orders2-with-table.webp`.
7. `sidebar.tsx` — `sidebarMenuButtonVariants`'s base class gained `text-sidebar-foreground/70`
   for quiet resting rows; the `hover:` and `data-[active=true]:` foreground overrides are
   attribute/pseudo-class selectors with higher CSS specificity than the added plain-class rule,
   so they still win regardless of source order — unchanged.

Gate re-run in the worktree: `vp run -w codegen`, `vp check`, `vp run -r check`, `vp run -r test` —
all green, including `packages/ui`'s 53 tests (49 contrast + 2 index + 2 new badge render tests).

**Stripping unused `sidebar` machinery is allowed here** and was deferred from issue 13 for this
reason: the shape is known once the skin is on. If it is stripped, the build report says what went
and why, because a stripped component no longer matches a clean regeneration.

## Build report (implementer, 2026-08-02)

**What was skinned, per part.**

- **Badge** — four new variants, `success`/`warning`/`info`/`danger`, each `bg-status-<role>-tint
  text-foreground`. A dot (`bg-status-<role>-tone`, `size-1.5 rounded-full`) renders before the
  label when one of those variants is active; the four accent tones never sit under text, only in
  the dot. `destructive`'s `text-white` was changed to `text-destructive-foreground` — the same
  defect record 013's evidence section names for `button.tsx` ("a regenerated `button.tsx` uses
  `text-white` instead of `text-destructive-foreground`"), found here on a second file and fixed
  for the same reason: the asserted pairing is what makes the label's contrast a checked claim
  instead of an assumption.
- **Sidebar** — `SidebarMenuButton`'s `data-[active=true]` state moved from `bg-sidebar-accent`
  (the hover neutral) to `bg-sidebar-primary` / `text-sidebar-primary-foreground` (`#1e1e1e` /
  white), which is the black filled pill the criterion names. Radius on the button moved
  `rounded-md` → `rounded-full` so the active state reads as a pill; resting rows stay unfilled
  text (`text-sidebar-foreground`), matching "quiet foreground on the rest." The product mark
  itself is not added here — `SidebarHeader` is an unstyled slot that already accepts children,
  and the mark's actual content (wordmark, per-app) is app content, not something a shared
  primitive in `packages/ui` may know about without becoming domain-aware. Issue 15 is where an
  app supplies it.
- **Card** — radius moved `rounded-xl` → `rounded-2xl` for a more generous read. The border stays
  the plain `border` utility. **Correction, round 1 fix:** this report's original claim that the
  bare utility "resolves to `--color-border`" was false — Tailwind 4's default border colour is
  `currentColor`, not a token, so `border` painted at `#1e1e1e` (the text colour) until this round
  added a global `* { border-color: var(--color-border); }` rule to `theme.css`'s `@layer base`.
  That is the fix, not a per-element class; it makes every bare `border` in `packages/ui` correct.
- **Table** — `TableHead` takes an optional `sortable` boolean; when true it renders a
  `ChevronsUpDown` glyph (already-installed `lucide-react`, used elsewhere in `sidebar.tsx` and
  `select.tsx`) after the label. No sort state, no click handler, no `@tanstack/react-table` —
  purely the affordance the criterion asks for. Row height and cell padding were already
  `--spacing`-relative (`h-10`, `p-2`) from the vanilla pull, so both densities apply to the table
  with no further change.
- **Tabs, Select, Input** — `tabsListVariants` and `TabsTrigger` moved `rounded-lg`/`rounded-md` →
  `rounded-full` for the segmented-row look. `Select` and `Input` are otherwise unchanged beyond
  the focus-opt-out strip below; their heights (`h-9`/`h-8`) were already density-relative.
  Composing them into the filter strip itself is explicitly out of this issue's scope and was not
  done.

**Focus opt-out removal, confirmed per file.** `rg -n
'outline-none|outline-hidden|focus-visible:ring|focus-visible:border|focus-visible:outline' packages/ui/src/components`
now returns nothing. Removed from:

- `badge.tsx` — `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`
  (base) and the destructive variant's `focus-visible:ring-destructive/20
  dark:focus-visible:ring-destructive/40`.
- `input.tsx` — `outline-none` and `focus-visible:border-ring focus-visible:ring-[3px]
  focus-visible:ring-ring/50`.
- `select.tsx` — `SelectTrigger`'s `outline-none focus-visible:border-ring focus-visible:ring-[3px]
  focus-visible:ring-ring/50`, and `SelectItem`'s `outline-hidden`. The latter isn't literally the
  `outline-none` shape the issue quotes, but it is the same opt-out by effect — Radix moves real DOM
  focus onto listbox items during keyboard navigation, and `outline-hidden` suppresses the visible
  indicator there exactly as `outline-none` does elsewhere. Left in, it would have been an eighth
  place issue 15 or a reviewer would have had to catch later.
- `tabs.tsx` — `TabsTrigger`'s `focus-visible:border-ring focus-visible:ring-[3px]
  focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring`, and
  `TabsContent`'s `outline-none`.
- `sidebar.tsx` — `ring-sidebar-ring outline-hidden ... focus-visible:ring-2` removed whole (not
  just the `ring-2` width) from `SidebarGroupLabel`, `SidebarGroupAction`,
  `sidebarMenuButtonVariants`, `SidebarMenuAction`, and `SidebarMenuSubButton` — five sites, matching
  "sidebar ships its own `focus-visible:ring-2`" named in the brief. Removing `ring-sidebar-ring`
  alongside `ring-2` rather than leaving it as a dead color declaration keeps the shape consistent
  with `button.tsx`'s already-fixed precedent, which carries no focus-related classes at all.

Nothing in `button.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, or `skeleton.tsx` carried the
opt-out; confirmed by the same grep before and after.

**Sidebar machinery — nothing stripped.** No app has consumed `Sidebar` yet (issue 15 is the first),
so which of the collapsible/mobile/rail/tooltip machinery is actually unused can't be told apart
from what issue 15 needs next. Removing any of it now would be a guess this issue has no way to
verify against a real consumer. Left the structure exactly as issue 13 pulled it; only colour,
radius and the focus classes above changed.

**Densities — not looked at, as the criterion requires saying plainly.** No screen in this
repository renders a Card, a Badge and a Table together, and this issue does not add one. What was
actually done: every dimension touched (radius, gaps, padding, heights) already used
`--spacing`-relative Tailwind utilities (`h-*`, `p-*`, `gap-*`, `size-*`) inherited unchanged from
the vanilla pull, so both `[data-density="compact"]` and `[data-density="touch"]` rescale them by
construction (record 013's mechanism) — verified by reading the classes and `theme.css`, not by
rendering. No new hard-coded pixel value was introduced by this issue's edits, so nothing new
escapes that rescaling. The touch scale itself was not seen rendered; record 013 already names
issue 15 as the re-check trigger, and that still holds.

**No question routed.** Every colour used (`status-*-tint`, `status-*-tone`, `sidebar-primary`,
`sidebar-primary-foreground`, `border`, `card`, `foreground`) was already in the 35-token set from
record 013; `contrast.test.ts`'s 49 assertions stayed green unmodified.

**Gate, run in the worktree:** `vp check`, `vp run -r check`, `vp run -r test` — all green,
including `packages/ui/tests/contrast.test.ts` (49 tests). Self-reviewed with `/code-review`
(Standards + Spec sub-agents): Standards axis found no hard violations; a raised "accessibility
regression" (focus outline removed with nothing replacing it) is not one — `theme.css`'s
`:focus-visible` rule (record 007, colour corrected by record 014) is what renders once the
per-component opt-out is gone, which is the entire mechanism issue 05 already established and this
issue applies seven more times. Spec axis raised the missing build report (this section), the
sidebar product mark (addressed above — app content, not `packages/ui`'s), the card border
(addressed above — the only token available), and flagged `SelectItem`'s `outline-hidden` removal
as scope creep (addressed above — same opt-out by effect, in scope).

**Record 015 applied (fixer, 2026-08-02).** One correction: the two Testing Library
devDependencies moved from literal versions to `catalog:`.

1. Root `package.json` catalog gained `@testing-library/react: 16.3.2` and
   `@testing-library/dom: 10.4.1` — record 008's already-checked versions, unchanged.
2. `packages/ui/package.json` — `@testing-library/dom` and `@testing-library/react` changed
   from `10.4.1`/`16.3.2` to `catalog:`. `@vitejs/plugin-react` and `happy-dom` were already
   `catalog:` and left alone.
3. `apps/api/package.json` — same two changed to `catalog:`. `axe-core: "4.12.1"` left inline,
   untouched.
4. `vp install`, `bun.lock` regenerated and committed.

Nothing else touched: `packages/ui/vite.config.ts` is byte-for-byte (no `environment` line),
`badge.test.tsx` unedited in place, `contrast.test.ts` untouched, root config/tsconfigs/
`.orc2/config.env` untouched.

**Convention going forward, per record 015:** in `packages/ui/tests/`, `.test.ts` runs under
Node and `.test.tsx` runs under happy-dom. Every `.tsx` render test opens with
`// @vitest-environment happy-dom` and registers `afterEach(cleanup)` at module scope — RTL's
auto-cleanup never fires here because there is no module every render passes through.

Verified:

- `bun.lock` diff shows exactly one `@testing-library/dom` and one `@testing-library/react`
  entry changed from literal to `catalog:` in each of `packages/ui` and `apps/api`, plus one new
  line each added to the root catalog — one declaration of each version, no duplicate, no
  top-level `vitest`.
- `rg --files-without-match -g 'packages/ui/tests/*.test.tsx' '^// @vitest-environment happy-dom'`
  → empty.
- `rg --files-without-match -g 'packages/ui/tests/*.test.tsx' 'afterEach\(cleanup\)'` → empty.
- `vp run -w codegen` → clean. `vp check` → pass (140 files formatted, 104 files typechecked,
  0 errors). `vp run -r check` → pass across all 10 workspaces.
- `vp run -r test` → all workspaces green; `vp run --no-cache -F ui test` (forced uncached) →
  **3 test files, 53 tests passed** in `packages/ui`.

Committed to `f14-reskin-shared-parts` at `2a67f5b` on top of `85a9ff0`. Repo root checkout
(`/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS`, branch `main`) was never
touched — confirmed clean via `git status` there.
