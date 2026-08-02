# 11 — The token layer: re-roled palette, Manrope, and two densities

**Status:** done — palette re-roled to record 013's 35 tokens (verified name-for-name), Manrope
self-hosted as one variable woff2, both densities in `theme.css`. 49 contrast assertions green.
`--color-ring`/`--color-sidebar-ring` are `#1e1e1e` per record 014 — the ring is asserted against
every surface it can be drawn on, never against `primary`, whose pixels `outline-offset` guarantees
it never touches.

**Reopened once after merge, and re-closed.** The first pass shipped two defects: `--color-ring` at
`#7a7a7a` (settled by record 014), and a live WCAG 2.5.5 regression — `apps/pos` fell from a 44px
tap floor to 24px because `tap-target` reads a density that no app had activated. Both fixed; both
found by review *after* the merge, which is the part worth remembering.

## What to build

`packages/ui/src/theme.css` currently holds a placeholder: blue `#1d4ed8` on zinc greys, no font
token, one spacing scale. ADR-0013 replaces it. This issue is that replacement and nothing else —
no component is touched, no shell is re-skinned.

Three things land together because they are one file and one test.

**The palette, re-roled.** ADR-0013 measured the supplied brand colours: `#E14A77` fails AA with
white (3.86:1) and with this palette's near-black (4.32:1), and `#35CCA6` passes only on near-black.
Pure `#000000` on the pink does pass at 5.45:1 — so the exclusion is a **policy**, not an
impossibility, and buying a legible pink button would mean a second, blacker foreground token
existing to serve one accent. The reference frames agree with the policy: every pressable element in
them is black. So `#1E1E1E` is the action colour, the accents are status and chart use only, and
destructive gets its own darker red.

**Manrope, self-hosted.** ADR-0003 makes the terminal offline-first. A font fetched from Google at
runtime renders in a fallback face on a terminal that has not seen the network, which is most of a
service. One variable file, in the repository, served by the app.

**Two densities.** The reference set is a seated desktop admin; `apps/pos` is a counter tablet.
`packages/ui` already carries the distinction — `--min-target-size: 24px` against
`--min-touch-size: 44px` — but nothing consumes it as a scale. One token system, two scales:
compact for `apps/backoffice` and `apps/landing`, touch for `apps/pos`.

**The mechanism for the second scale is not decided, and it is not this implementer's to pick.**
Tailwind 4 has no `presets` array — record 007 already worked around that once for the shared
`@theme` block. How a second scale is *activated* is an architecture choice eleven areas inherit,
and three plausible shapes exist: a `data-` attribute on the app root with token overrides, a pair
of `@utility` scales selected per component, or separate imported blocks per app. Pick differently
in two issues and the apps end up with incompatible density rules that only surface when a shared
part is used in both.

**The token *names* are not this implementer's to pick either**, for the same reason and by the same
precedent: record 007 fixed the old names and left this issue's predecessor only their values. A set
invented here would be snapshotted by its own assertion, and issues 13 and 14 would then "preserve"
a set nobody specified. There is also a live trap in the naming — shadcn's generated components use
`accent` to mean *hover surface*, which collides head-on with this ADR's meaning of "accent" as a
status hue. Two different things cannot share that token.

**Both questions go to the `decider` before any token is written.** This issue is `needs-info` until
a record exists; spending a lane to discover that is waste. Stated so they can be answered without
re-reading this file:

> 1. How is the touch density activated in `apps/pos` and the compact density in `apps/backoffice`,
>    given Tailwind 4's shared-`@theme`-by-relative-import arrangement from record 007 — and what
>    contract must an app root satisfy for a shared component to render at the right scale?
> 2. What is the exact `--color-*` token name set for ADR-0013's roles — surfaces, the black action
>    colour, the destructive red, and the four status hues each with a tint and a tone — given that
>    generated shadcn components already consume `primary`, `muted`, `border`, `ring`, and `accent`,
>    and that `accent` means hover surface to them and status hue to us?

Implement the answers, link the record from this issue, and set `ready-for-agent` then. Do not
pre-empt either.

**Both answered.** `.scratch/decisions/013-density-mechanism-and-token-names.md` decides them
together, and this issue is now `ready-for-agent`. In short:

1. **Density** — one `data-density` attribute on `<html>`, `touch` in `apps/pos` and `compact` in
   `apps/backoffice`. Compact is the base `@theme` scale; touch re-declares `--spacing` at ×1.25
   plus six `--text-*` overrides inside `@layer base`. No `packages/ui` component reads the
   attribute, branches on it, or takes a `density` prop. The record's four-clause contract is
   binding, including why the attribute goes on `<html>` and never on a shell element.
2. **Token names** — `accent` stays shadcn's, meaning *hover surface*. ADR-0013's accents take a
   `status-` prefix, each as a `-tint`/`-tone` pair. The record carries the exact 35-token list and
   38 pairings; **transcribe both verbatim** rather than re-deriving them.

Three flags from the record that this issue must not discover the hard way:

- `#35CCA6` measures 2.03:1 on white, so it **cannot** be `status-success-tone`. The tones are
  darker siblings of the brand hues, the same move ADR-0013 already made for destructive.
- No `--color-chart-*` set, and no vocabulary hidden behind `@theme inline` — `contrast.test.ts`'s
  regex cannot see through it.
- The ×1.25 touch scale is derived from the 44px floor but has never been seen on a real screen.
  Its re-check trigger is issue 15, and the fix costs one number.

## Acceptance criteria

- [ ] Colour tokens express ADR-0013's roles: `#1E1E1E` as the action colour (primary, active nav,
      focus ring); `#FFFFFF` and the reference's off-white page ground as surfaces; `#35CCA6` and
      `#E14A77` reachable **only** as status and chart accents, each with a pale tint for
      backgrounds and a saturated tone for icons and dots; amber and blue added to that status set,
      as the reference's tile row uses four hues, not two.
- [ ] A destructive token that holds white text at AA — ADR-0013 names roughly `#C0264F`, the brand
      pink's darker sibling. Void and refund do not get an unreadable button.
- [ ] **No accent token is ever a background for text.** Whatever expresses this — naming, a comment
      block, or the absence of a foreground pair — it must be legible to the next implementer, who
      will otherwise reach for `bg-success` and put a label on it.
- [ ] Every token named for its **job**, never its value. This is the whole reason dark mode is a
      later addition of values rather than a refactor (ADR-0013).
- [ ] Manrope committed as a self-hosted variable font covering 400/500/600/700, wired as the font
      token, with a system fallback stack. No CDN, no `@import` from Google.
- [ ] Tabular figures on. Manrope ships `tnum`; money columns, receipts, and cash counts must align
      digit-for-digit, and a proportional-figure money column is a defect on a POS.
- [ ] A spacing, type, and radius scale on the reference's 8px grid, in two densities, with the
      touch scale honouring `--min-touch-size: 44px` on anything tappable.
- [ ] `packages/ui/tests/contrast.test.ts` updated and green. Note its two existing behaviours before
      editing: it parses `--color-*: #rrggbb` **directly out of the CSS**, so tokens stay six-digit
      sRGB hex and never shadcn's OKLCH; and it **fails if any declared token appears in no
      pairing**, so every accent tint added here needs its pairing declared with it.
- [ ] A new assertion listing **the exact token names from the decision record**, failing if one goes
      missing. The existing test only checks that whatever is declared is covered — a token silently
      deleted, or rewritten in a syntax the regex cannot see, leaves the suite green. Issues 13 and 14
      both run `shadcn add` against this file and both are told to preserve this set; without this
      assertion "preserve" is unverifiable and the reviewer is grading a claim rather than a result.
      The list is copied from the record, not authored here — an assertion that snapshots whatever
      the implementer happened to write verifies nothing.
- [ ] The focus indicator stays a token and stays an opaque outline. Issue 05's blocking finding was
      exactly this — a component opting out of it — and that outline is what the `ring` pairings
      measure.
- [ ] `check` and `test` scripts still pass across the repository.

## Depends on

- 05 — `packages/ui`: tokens, Tailwind preset, primitives

## Relevant files

- `packages/ui/src/theme.css`
- `packages/ui/tests/contrast.test.ts`
- `packages/ui/src/fonts/**` (new)
- `packages/ui/package.json`

## Comments

_Written from the `/grill-with-docs` session of 2026-08-02. Decision: `docs/adr/0013`._

**Values are yours to choose; names and roles are not.** This mirrors how issue 05 ran — record 007
fixed the token names and left the values to the issue. ADR-0013 fixes the roles and the anchor
colours; the tints, the scale steps, and the exact destructive red are this issue's to pick, subject
to the contrast test.

**Do not add a dark set.** ADR-0013 defers it, and there is a trap waiting: `contrast.test.ts` reads
declarations into a flat map, so a second block reusing the same token names silently overwrites the
first and the suite goes green while light mode goes unchecked. Dark mode requires restructuring that
test, and that is a later issue's problem.

**`ring`/`primary` had 3.13:1 against a 3:1 floor under the old palette** — near-zero headroom, and
issue 05 recorded that it would fail loudly if primary were ever lightened. Primary is becoming
`#1E1E1E`, which moves that pairing the safe direction. Confirm it rather than assume it.

**Reopened 2026-08-02, two defects found post-merge.** `.scratch/decisions/014-the-focus-indicator-colour.md`
ruled the shipped `--color-ring: #7a7a7a` wrong: a positive `outline-offset` means the ring's pixels
never land on `primary`, so pairing `ring` against `primary`/`sidebar-primary` measured a geometry
that does not occur. Fix: `--color-ring` and `--color-sidebar-ring` both `#1e1e1e` (ADR-0013's own
action colour — the issue's acceptance criterion was already correct and is unchanged);
`:focus-visible` stays byte-identical, only the two hex values moved; `contrast.test.ts`'s pairing
table now asserts `ring` against every ground it can sit beneath (`background`, `card`, `popover`,
`secondary`, `muted`, `accent`, `sidebar`, `sidebar-accent`, the four `status-*-tint`s) instead of
against `primary`/`sidebar-primary`, taking the suite from 38 to 45 pairings and 41 to 48
assertions; added a 49th assertion that `--focus-ring-offset` stays ≥1px, since at 0 the ring is
invisible against `primary` while the contrast test would stay green. Separately: this issue's
mechanical rename of `touch-min` (unconditional 44px) to `tap-target` (24px unless
`[data-density="touch"]`) left `apps/pos`'s minimum target at 24px, because no app set the density
attribute — issue 15's job, not yet done. Fixed at the root, ahead of issue 15, per record 013's own
clause 1: `data-density="touch"` on `apps/pos/index.html`'s `<html>`, `data-density="compact"` on
`apps/backoffice/index.html`'s, both explicit, neither on a shell element (Radix portals `sheet`,
`sidebar`, `select` into `document.body`, so a shell-scoped attribute would leave portalled surfaces
compact). This activates the ×1.25 touch scale across the whole of `apps/pos` for the first time;
issue 15 still owns the visual re-check and the `index.html` assertions record 013 named as its
trigger — nobody has looked at it rendered yet.

## Implementation notes

Branch `f11-token-layer`. `packages/ui/src/theme.css` and `packages/ui/tests/contrast.test.ts`
rewritten per record 013; token names, the 38 pairings, and the density mechanism transcribed
verbatim from the record. Values (mine to choose):

- `background` `#fafaf7`, `foreground`/`primary` `#1e1e1e`, `card`/`popover` `#ffffff`
- `secondary`/`muted`/`accent` distinct near-white greys (`#eaeae6`/`#f0f0ed`/`#e4e4df`) so hover
  and quiet-fill surfaces stay visually distinguishable from each other
- `destructive` `#c0264f` (the brand pink's darker sibling, per ADR-0013)
- `border`/`input` `#8a8a8a`; `ring`/`sidebar-ring` `#1e1e1e` — the action colour, per record 014:
  `outline-offset` keeps the ring's pixels off `primary`, so it is asserted against every ground it
  can actually sit on, not solved to also clear a fill it never touches
- Status tones are darker siblings of the brand hues, not the raw brand values: `success-tone`
  `#0f7a55` (brand green `#35CCA6` measures 2.03:1 on white and fails outright), `warning-tone`
  `#8a5a00`, `info-tone` `#1d5fc2`, `danger-tone` `#a31c46` (distinct from `destructive`, per the
  record's "state you read vs. button you press" distinction)

Measured ratios (all pass, computed with the same relative-luminance/contrast formulas as
`contrast.test.ts`, cross-checked by the 48 passing assertions in that file, per record 014):
`ring` (`#1e1e1e`) against every ground it can sit beneath — `background` 15.94:1, `card`/
`popover`/`sidebar` 16.67:1, `muted` 14.60:1, `secondary` 13.82:1, `accent`/`sidebar-accent`
13.07:1 (worst case), the four `status-*-tint`s 14.00–14.68:1 — all far clear of the 3:1 floor;
`border`/`background` 3.30:1, status tones on their tints 4.69–6.27:1, status tones on
`background`/`card` 5.10–7.47:1. Full pairing list and margins are in the scratchpad script used
to derive the values (not committed — the authoritative check is `contrast.test.ts` itself).

Manrope: downloaded the variable TTF (`ofl/manrope/Manrope[wght].ttf`, weight axis 200–800) from
the `google/fonts` GitHub repository (SIL OFL 1.1) and converted to `woff2` with `fonttools`
(a local, uninstalled build tool — not added as a project dependency). Committed as
`packages/ui/src/fonts/Manrope-Variable.woff2` plus `OFL.txt` and a `README.md` recording the
source, conversion method, and license. Wired as `--font-sans` (not `--font-manrope`, per the
record), weight range 400–700, with the system fallback stack from the record's file shape.
`font-variant-numeric: tabular-nums` on `:root` in `@layer base`, global as specified.

Four existing `target-min`/`touch-min` call sites (`packages/ui/src/components/sheet.tsx`,
`apps/backoffice/src/components/AppShell.tsx` and `ErrorState.tsx`,
`apps/pos/src/components/ErrorState.tsx`) were renamed to `tap-target` in this issue rather than
left for issue 14. Record 013 lists these as "renamed by issue 11 or 14" without resolving which;
leaving them referencing utilities this issue deletes from `theme.css` would have been a silent
tap-target regression (Tailwind drops an unknown utility with no build error), so they were fixed
here as a mechanical one-line className rename — no component logic, layout, or design changed.
**Both app roots are now wired** — `data-density="touch"` on `apps/pos/index.html` and
`data-density="compact"` on `apps/backoffice/index.html` — done in the reopen below to close the
44px regression, not in the original pass. **Issue 15 no longer introduces the attribute; it owns
only the `index.html` assertions and the visual verification of the ×1.25 touch scale**, which
remains its named re-check trigger per record 013. No `packages/ui` component reads or branches on
the attribute, and no dark set was added.

Self-check: ran `/code-review` (Standards + Spec sub-agents) against the diff. Standards flagged
one real hard violation — a 4-line comment on the `[data-density="touch"]` block exceeded the
repo's 3-line comment ceiling (`docs/agents/code-standards.md` rule 5) — fixed by trimming it to
3 lines while keeping the "Record 013" pointer. It also flagged the new `fonts/README.md` as
mildly redundant with the commit message; kept it, since a README next to a committed binary is
more discoverable than a commit message six months from now, and the issue's instruction to
record provenance "in the commit or a short note beside it" reads as either, not both-required.
Spec axis found no missing, partial, or wrong requirements, and no scope creep.

Gate commands run and green: `vp run -w codegen`, `vp check`, `vp run -r check`,
`vp run -r test` (all packages, 41/41 in `contrast.test.ts`, full suite passing repo-wide).

Nothing in record 013 turned out to be wrong or unimplementable as written.
