# 11 — The token layer: re-roled palette, Manrope, and two densities

**Status:** needs-info

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
