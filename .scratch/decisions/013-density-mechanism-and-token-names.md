# 013: Two densities from one attribute on `<html>`, and `accent` stays shadcn's word

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** `.scratch/foundation/issues/11-token-layer-palette-manrope-densities.md` (both stated questions)

## The question

Two questions, one file, one test, so one record.

1. **How does `apps/pos` get the touch scale and `apps/backoffice` the compact one**, when
   both applications import the *same* `packages/ui/src/theme.css` by the same two lines
   (record 007), and Tailwind 4 has no per-project configuration to differ in? And what
   must an application's root do so that a component shared by both renders at the right
   scale?
2. **What are the exact `--color-*` token names** for ADR-0013's roles, given that the
   components already on disk use `accent` to mean *hover surface* and ADR-0013 uses the
   word "accent" to mean *status hue*?

**What a wrong answer costs.** Nothing is skinned yet, so today both answers are one file.
After issues 13, 14 and 15 they are twelve components and two shells; after areas 2–12 they
are roughly thirty screens of class strings with no type system behind them. A wrong density
mechanism additionally costs something a rename does not: a shared `Button` that cannot tell
which application it is in will silently render at 36px under a cashier's thumb, which is a
WCAG target-size failure that no test in this repository can see.

### Weights, declared before any option was scored

Same weights as record 007, and for the same reasons — this is the same file, the same
consumers and the same asymmetry. Not changed after ranking.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×2 | This *is* the tap target under a thumb and the contrast of a badge label. Not infrastructure. |
| Business impact | ×1 | Every option is free. Nothing separates them commercially. |
| Engineering cost and risk | ×2 | Whether the mechanism works under Tailwind 4's real emission model, and how many files each option touches per component added. |
| Reversibility | ×2 | Cheap today, ruinous in three areas. That asymmetry is the reason the question was routed rather than guessed. |
| Evidence strength | ×2 | The whole mechanism rests on *how Tailwind 4 emits utilities*. One documentation fetch contradicted itself on exactly this point, so it was settled against the source. |

Maximum total: 45.

**Checked `.scratch/decisions/` before deciding:** 001–012 exist, `013` is free, and none of the
twelve answers either question. Record 007 fixed the *previous* seventeen token names and both
target-size tokens; this record extends and, in one narrow place, supersedes it. **No duplicate,
no orphan.**

## What I chose, and why

### One: density is an attribute on `<html>`, and nothing else

**`apps/pos` sets `<html data-density="touch">`. `apps/backoffice` sets
`<html data-density="compact">`.** That is the entire mechanism, and no component anywhere
knows it happened.

It works because of a fact about Tailwind 4 I verified from Tailwind's own documentation
rather than assumed, and it is the single load-bearing claim in this record: **a Tailwind 4
utility does not contain a value, it contains a `var()` reference to the theme variable.**
Tailwind's padding documentation states the generated rule for `p-<number>` literally as
`padding: calc(var(--spacing) * <number>)`. The same holds for the type scale and the radius
scale. Because the `var()` sits inside the utility's own declaration, it is resolved **on the
element that wears the class**, not at `:root` — so re-declaring `--spacing` on an ancestor
rescales every spacing utility beneath it, with no second class, no variant, and no component
edit.

So the two scales are the same tokens with different values in different subtrees:

- **Compact is the base scale**, declared in `@theme`. It is Tailwind's own default spacing
  (`--spacing: 0.25rem`, i.e. 4px), which puts the reference set's 8px grid on the even steps
  — `p-2` is 8px, `gap-4` is 16px, `p-6` is 24px.
- **Touch is the same scale × 1.25**, declared once in a `@layer base` rule scoped to
  `[data-density="touch"]`, plus a type scale that is bumped, plus a tap floor that switches.

**Why 1.25 and not a number I liked the look of.** 1.25 is the smallest whole-pixel rescale
(4px → 5px) that lifts shadcn's own default control height, `h-9`, from 36px to **45px** —
over the 44px touch floor record 007 took from WCAG 2.2 SC 2.5.5. In other words the factor is
chosen so that a stock, unmodified shadcn button is already big enough for a thumb in
`apps/pos` without anybody remembering to make it so. That is a derived number, not taste. Its
honest cost is that the touch rhythm is a 10px grid rather than an 8px one: the reference set's
8px grid is the **compact** grid, and touch is that grid scaled, which is what ADR-0013's "one
system with two scales, not two design systems" means in practice.

**Why it must be `<html>` and not the shell `<div>`.** `sheet`, `sidebar`'s narrow-viewport
drawer, and `select`'s popper are Radix portals: they mount into `document.body`, which is
*outside* any element the React tree owns and *inside* `<html>`. Put the attribute on a shell
`<div>` and every portalled surface in `apps/pos` — the whole mobile navigation, every
dropdown — silently reverts to compact. This is not a style preference; it is the reason the
other placements are wrong.

**The tap floor becomes one utility instead of two.** Record 007 gave `apps/pos` the class
`touch-min` and `apps/backoffice` the class `target-min`, chosen at the call site. That worked
while the applications wrote their own class strings. It cannot work for a component in
`packages/ui` that is rendered by both and has no way to ask which one it is in — which is
precisely the second half of question 1. So:

> **`--min-target-size: 24px` and `--min-touch-size: 44px` stay exactly as record 007 set
> them, with their W3C provenance intact.** They stop being classes and become the two values a
> third token selects between. `--tap-size` is `var(--min-target-size)` at base and
> `var(--min-touch-size)` under touch, and **`tap-target` is the one utility**, replacing
> `target-min` and `touch-min`.

Note what that buys: the conformance floor is still stated in `px`, so it does not move if
anyone changes the root font size, while the *rhythm* scales in `rem`. The two things that
should behave differently do.

**Records 007 and 009 are amended in passing, not overturned.** Record 007's downstream
instruction "Every interactive element in `apps/pos` carries `touch-min`; every interactive
element in `apps/backoffice` carries at least `target-min`" becomes **"every interactive
element in either application carries `tap-target`"**. Record 009 lines 191–192 say the same
thing and change the same way. Nothing else in either record moves; no decision in them is
reversed. Four call sites exist today and are listed in the reversal section.

### Two: `accent` keeps shadcn's meaning, and ADR-0013's "accent" becomes `status-`

The collision the issue names is real and it has an asymmetric answer, so this one is not
close.

`accent` in a generated shadcn component means **the pale neutral a row or a menu item turns
when you hover it**. It is already on disk twice — `button.tsx` lines 14 and 16 carry
`hover:bg-accent hover:text-accent-foreground` — and it will arrive again on `sidebar`, `table`,
`tabs`, `select`, and every component any of the next eleven areas pulls. Taking the name away
from shadcn means hand-editing generated output on every `shadcn add`, forever, which is the
recurring cost record 007 already refused once over the icon package.

Taking it away from *us* costs one prefix. So:

- **`--color-accent` / `--color-accent-foreground` keep shadcn's meaning: the hover surface,
  and it is a quiet neutral, not a hue.**
- **ADR-0013's four status hues are `--color-status-<role>-tint` and
  `--color-status-<role>-tone`**, over four roles: `success`, `warning`, `info`, `danger`.

**Consequence for every component already generated: none.** Not one class string in
`button.tsx` or `sheet.tsx` changes because of this decision, and no future `shadcn add` needs
its `accent` classes touched.

**Why those four role names.** Named for the job, never the value, which is ADR-0013's rule and
the thing that makes a dark set a later addition of values rather than a refactor. They map onto
the reference's four tile hues as `success`→green, `warning`→amber, `info`→blue, `danger`→pink
— and that last mapping is a good fit rather than a leftover, because ADR-0013's destructive red
`#C0264F` is described there as "the brand pink's darker sibling". The danger family and the
destructive action are the same family, at two saturations, for two different jobs.

**`destructive` and `status-danger` are both kept, and they are not duplicates.**
`--color-destructive` is a **button you press** — a filled control with a white label, for void
and refund. `--color-status-danger-*` is a **state you read** — a tint with a dot in it, on a
badge or a table row. The prefix is what tells the next implementer which one they are holding.

**`-tint` and `-tone`, and why the suffixes are the safety rule.** Issue 11 requires that "no
accent token is ever a background for text" be legible to the next implementer. The structure
says it rather than a comment:

- A **`-tint`** is a pale background. It *is* allowed under text, and the pairing
  `--color-foreground` on each tint at 4.5:1 in the contrast test is what makes that legal.
  This is the badge ADR-0013 and issue 14 describe: pale tint, saturated dot, dark text.
- A **`-tone`** is a dot, an icon, or a chart series. **No `-tone` token has a `-foreground`
  partner and none appears as a background in any pairing**, so there is no token to put a label
  on. An implementer who writes `bg-status-success-tone` and adds text has no foreground token to
  reach for and no assertion covering them, which is the moment they should stop.
  The reviewer's grep is `rg 'bg-status-[a-z]+-tone' apps packages`, which must return nothing.

**A finding issue 11 needs before it picks values, because it changes one of them.** ADR-0013's
green `#35CCA6` measures **2.03:1 against white**. Contrast is symmetric, so that is the ratio
whether the green is the text or the dot — it fails the 3:1 non-text floor of SC 1.4.11 as a
`-tone`. `--color-status-success-tone` therefore **cannot be `#35CCA6`**; it must be a darker
sibling of it, exactly as ADR-0013 already did for destructive. The brand green survives as the
family, not as the literal value. The same check applies to the other three tones and to
`#E14A77` at 3.86:1 on white.

**No `--color-chart-*`.** `shadcn init` injects `--chart-1` through `--chart-5`; issue 13 reverts
them with the rest of the injected palette. ADR-0013 already says the status accents *are* the
data-visualisation colours, and a second vocabulary for the same four hues is the drift
`packages/ui` exists to prevent. **Trigger to revisit:** the first report screen in area 7 that
genuinely needs more than four series — at which point the question is "what is the fifth
status role", not "add five nameless chart slots".

### Three, briefly, because guessing it wrong is expensive and the fix is one line

Two things sit inside the same file and the same acceptance criteria, and neither has two
plausible answers worth a table.

**The font token is `--font-sans`.** Not `--font-manrope`. Tailwind's default theme declares
`--default-font-family: --theme(--font-sans, initial)`, so overriding `--font-sans` in `@theme`
is what actually changes the body face; a token named anything else generates a `font-manrope`
utility that somebody has to remember to apply, on every element, forever.

**Tabular figures go on globally**, as `font-variant-numeric: tabular-nums` on `:root` in
`@layer base`, not as a `tabular-nums` class on money columns. The property inherits, DeanPOS
has almost no prose for proportional figures to flatter, and the alternative's failure mode is
one forgotten class on one receipt column — which issue 11 itself calls "a defect on a POS".

## The token list — transcribe this block

This is the complete and final `--color-*` set. **Thirty-five tokens.** Issue 11 copies these
names into the new assertion in `contrast.test.ts` verbatim; issues 13 and 14 preserve exactly
this set and revert anything `shadcn add` injects beyond it.

```
--color-background
--color-foreground
--color-card
--color-card-foreground
--color-popover
--color-popover-foreground
--color-primary
--color-primary-foreground
--color-secondary
--color-secondary-foreground
--color-muted
--color-muted-foreground
--color-accent
--color-accent-foreground
--color-destructive
--color-destructive-foreground
--color-border
--color-input
--color-ring
--color-sidebar
--color-sidebar-foreground
--color-sidebar-primary
--color-sidebar-primary-foreground
--color-sidebar-accent
--color-sidebar-accent-foreground
--color-sidebar-border
--color-sidebar-ring
--color-status-success-tint
--color-status-success-tone
--color-status-warning-tint
--color-status-warning-tone
--color-status-info-tint
--color-status-info-tone
--color-status-danger-tint
--color-status-danger-tone
```

**Roles, so no value is chosen blind.** Values remain issue 11's, per record 007's precedent.

| Token | Role |
| --- | --- |
| `background` / `foreground` | The reference's off-white page ground, and `#1E1E1E` text on it |
| `card` / `card-foreground` | `#FFFFFF` panel on that ground (issue 14: "white on the off-white page ground") |
| `popover` / `popover-foreground` | The `select` menu and any floating surface. Same values as `card`; a separate name because `select` reaches for it |
| `primary` / `primary-foreground` | **`#1E1E1E`** and white. ADR-0013's action colour: every pressable fill |
| `secondary` / `secondary-foreground` | The quiet button and the pressed-chip surface |
| `muted` / `muted-foreground` | Quiet fill, and secondary body copy — **body copy, so 4.5:1, not decoration** |
| `accent` / `accent-foreground` | **Hover surface only. A neutral, never a hue.** shadcn's meaning, unchanged |
| `destructive` / `destructive-foreground` | ADR-0013's ≈`#C0264F` and white. Void and refund |
| `border` / `input` / `ring` | Separation, field outline, and the `@layer base` focus outline |
| `sidebar*` (8) | shadcn's own sidebar vocabulary. `sidebar-primary` is the black active pill of issue 14; `sidebar-accent` is the hover on a resting entry |
| `status-<role>-tint` (4) | Pale background. Legal under text. Badge and row fills |
| `status-<role>-tone` (4) | Saturated dot, icon, chart series. **Never under text.** No foreground partner exists |

**The three status roles that are not obvious:** `warning` is amber, `info` is blue, `danger` is
the pink family. `success` is the green family.

## The pairing table — also transcribe this

`contrast.test.ts` fails if a declared token appears in no pairing, so this table and the token
list above are one artefact. **Thirty-eight pairings.** The first fourteen are the existing file
unchanged.

| Foreground | Background | Threshold | SC |
| --- | --- | --- | --- |
| `foreground` | `background` | 4.5 | 1.4.3 |
| `foreground` | `card` | 4.5 | 1.4.3 |
| `card-foreground` | `card` | 4.5 | 1.4.3 |
| `muted-foreground` | `background` | 4.5 | 1.4.3 |
| `muted-foreground` | `muted` | 4.5 | 1.4.3 |
| `primary-foreground` | `primary` | 4.5 | 1.4.3 |
| `secondary-foreground` | `secondary` | 4.5 | 1.4.3 |
| `accent-foreground` | `accent` | 4.5 | 1.4.3 |
| `destructive-foreground` | `destructive` | 4.5 | 1.4.3 |
| `border` | `background` | 3.0 | 1.4.11 |
| `input` | `background` | 3.0 | 1.4.11 |
| `ring` | `background` | 3.0 | 1.4.11 |
| `ring` | `card` | 3.0 | 1.4.11 |
| `ring` | `primary` | 3.0 | 1.4.11 |
| `popover-foreground` | `popover` | 4.5 | 1.4.3 |
| `sidebar-foreground` | `sidebar` | 4.5 | 1.4.3 |
| `sidebar-primary-foreground` | `sidebar-primary` | 4.5 | 1.4.3 |
| `sidebar-accent-foreground` | `sidebar-accent` | 4.5 | 1.4.3 |
| `sidebar-border` | `sidebar` | 3.0 | 1.4.11 |
| `sidebar-ring` | `sidebar` | 3.0 | 1.4.11 |
| `ring` | `sidebar` | 3.0 | 1.4.11 |
| `ring` | `sidebar-primary` | 3.0 | 1.4.11 |
| `foreground` | `status-success-tint` | 4.5 | 1.4.3 |
| `foreground` | `status-warning-tint` | 4.5 | 1.4.3 |
| `foreground` | `status-info-tint` | 4.5 | 1.4.3 |
| `foreground` | `status-danger-tint` | 4.5 | 1.4.3 |
| `status-success-tone` | `status-success-tint` | 3.0 | 1.4.11 |
| `status-warning-tone` | `status-warning-tint` | 3.0 | 1.4.11 |
| `status-info-tone` | `status-info-tint` | 3.0 | 1.4.11 |
| `status-danger-tone` | `status-danger-tint` | 3.0 | 1.4.11 |
| `status-success-tone` | `background` | 3.0 | 1.4.11 |
| `status-warning-tone` | `background` | 3.0 | 1.4.11 |
| `status-info-tone` | `background` | 3.0 | 1.4.11 |
| `status-danger-tone` | `background` | 3.0 | 1.4.11 |
| `status-success-tone` | `card` | 3.0 | 1.4.11 |
| `status-warning-tone` | `card` | 3.0 | 1.4.11 |
| `status-info-tone` | `card` | 3.0 | 1.4.11 |
| `status-danger-tone` | `card` | 3.0 | 1.4.11 |

Two rows deserve their reason stated, because a reviewer will ask. **`ring` on `sidebar` and on
`sidebar-primary`** are there because the focus outline is a single global `@layer base` rule
using `--color-ring`, so it is drawn on the sidebar surface and on the black active pill and
must be visible on both — which is issue 14's focus criterion, made measurable. **The four
`foreground` on `*-tint` rows** are what make the badge label legal; without them the tints
would satisfy the "every token is in a pairing" rule through the tone rows alone while nothing
checked the text that actually sits on them.

## The file shape — what issue 11 writes

Values shown as `#......` are issue 11's to choose, subject to the table above. Everything else
is fixed by this record.

```css
@font-face {
  font-family: "Manrope";
  src: url("./fonts/Manrope-Variable.woff2") format("woff2-variations");
  font-weight: 400 700;
  font-display: swap;
  font-style: normal;
}

@source "./components";
@source "./lib";

@theme {
  /* Surfaces, neutrals, sidebar — shadcn's vocabulary. Do not rename: generated
     components consume these names and every `shadcn add` expects them. */
  --color-background: #......;
  /* ... the 27 shadcn-vocabulary tokens from the list above ... */

  /* Status hues (ADR-0013). A `-tone` is a dot, an icon, or a chart series and has
     no foreground partner because nothing may be written on it. Record 013. */
  --color-status-success-tint: #......;
  --color-status-success-tone: #......;
  /* ... the other six ... */

  --font-sans: "Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;

  /* Target size. Values from WCAG 2.2 SC 2.5.8 (AA) and SC 2.5.5 (AAA).
     --tap-size selects between them by density; see the base layer below. */
  --min-target-size: 24px;
  --min-touch-size: 44px;
  --tap-size: var(--min-target-size);

  /* Focus indicator. Values from WCAG 2.2 SC 2.4.13, adopted above the AA floor. */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

@utility tap-target {
  min-inline-size: var(--tap-size);
  min-block-size: var(--tap-size);
}

@layer base {
  /* Compact is the base scale and is Tailwind's own. Touch rescales it by 1.25,
     which is what puts stock `h-9` at 45px — over the 44px floor. Record 013.
     Line heights are unitless ratios in Tailwind's default theme, so overriding
     the font size alone scales the leading with it. */
  [data-density="touch"] {
    --spacing: 0.3125rem;
    --tap-size: var(--min-touch-size);
    --text-xs: 0.875rem;
    --text-sm: 1rem;
    --text-base: 1.125rem;
    --text-lg: 1.25rem;
    --text-xl: 1.5rem;
    --text-2xl: 1.75rem;
  }

  :root {
    font-variant-numeric: tabular-nums;
  }

  :focus-visible {
    outline: var(--focus-ring-width) solid var(--color-ring);
    outline-offset: var(--focus-ring-offset);
  }
}
```

**The density block must be inside `@layer base`.** Tailwind's entry stylesheet declares
`@layer theme, base, components, utilities;` and `@theme`'s output lands in `theme`, so a rule
in `base` wins over it regardless of specificity. Outside any layer it would also work today by
source order, but that is an accident and this is not.

**Radius does not vary by density**, and it needs no new names — the reference's pill and
generous card radius are values on Tailwind's existing `--radius-*` namespace, and `rounded-full`
is built in. A pill is a pill at any density; scaling radius with density would make the same
component read as a different component in the two applications, which is the drift
`packages/ui` exists to prevent.

## The contract an application root satisfies

Four clauses. An implementer should be able to write this without asking a second question.

1. **The `<html>` element carries `data-density`.** `apps/pos/index.html` gets
   `<html lang="en" data-density="touch">`; `apps/backoffice/index.html` gets
   `<html lang="en" data-density="compact">`. Both are explicit even though a missing attribute
   falls back to compact, because an attribute you can grep for is a mechanism and a default you
   rely on is a silent failure. `apps/landing` inherits `compact` in area 11.
2. **It is `<html>`, never a shell element.** Radix portals mount into `document.body`.
3. **No component in `packages/ui` reads the attribute, branches on it, or takes a `density`
   prop.** Components carry one class string and the tokens resolve underneath them. A `density`
   prop on a shared part is a breach of this record, not an implementation detail.
4. **Anything tappable carries `tap-target`.** In touch density a control shorter than `h-9`
   (40px at `h-8`, the `sm` button) is below the 44px floor, so `tap-target` is what makes it
   conform — it is not decoration on top of a large-enough control.

**One assertion, in issue 15**, appended to each application's existing
`tests/design-values.test.ts` from issue 12: read `index.html`, assert it contains
`data-density="touch"` / `"compact"`. Five lines per app. It exists because this is the one
failure the whole gate cannot otherwise see — happy-dom computes no layout, axe's
`color-contrast` rule is disabled in a virtual DOM (record 007), and the contrast test reads
only `--color-*`. **Nothing else in this repository would notice `apps/pos` rendering compact.**

**Stated plainly so nobody claims otherwise in a build report:** the render tests mount into a
document with no `data-density`, so every existing test exercises the compact scale. Touch is
verified by reading tokens and by the assertion above, not by seeing it. Issue 14 was already
told to say this; it is true of issue 15 as well.

## The options, ranked

### Question 1 — how the second density is activated

| Rank | Option | User ×2 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **`data-density` on `<html>`, overriding theme variables in `@layer base`** | 5 (10) | 4 | 4 (8) | 4 (8) | 5 (10) | **40** |
| 2 | Separate imported theme blocks per application | 4 (8) | 3 | 3 (6) | 3 (6) | 3 (6) | **29** |
| 3 | Defer — one density, `apps/pos` renders compact | 1 (2) | 2 | 5 (10) | 5 (10) | 1 (2) | **26** |
| 4 | A pair of `@utility` scales selected per component | 3 (6) | 3 | 2 (4) | 2 (4) | 3 (6) | **23** |

**1. The attribute — chosen.** It is the only option under which a shared component needs no
knowledge of its host, which is the half of the question the other three cannot answer at all.
Every claim it rests on was read from the source that owns it: the `calc(var(--spacing) * n)`
emission from Tailwind's padding documentation, the unitless line-height ratios from Tailwind's
own `theme.css`, the layer order from its `index.css`, the portal-to-`body` behaviour from the
`sheet` already in this repository. It scores 4 rather than 5 on engineering cost for one honest
reason: rescaling `--spacing` rescales *everything* derived from it, icon `size-4` included, and
that is a broad brush whose output nobody has looked at yet on a real screen. It scores 4 on
reversibility because backing it out means editing every part that assumed it — bounded by the
part count, not the screen count.

**2. Separate theme blocks per application.** A `theme-compact.css` and a `theme-touch.css`,
each application importing one. This genuinely works — the applications compile different values
for the same utility — and it was the closest competitor. It loses on three things. It destroys
record 007's "byte-for-byte identical two lines in both applications" property, which is what
that record's "no app-specific configuration" criterion actually cashes out to. It gives the
contrast test two files to read where it now reads one, or one file it reads while another goes
unchecked — the same flat-map trap ADR-0013 flags for dark mode, arriving early by a different
door. And two files drift: the day someone adds a token to one and not the other, the failure is
a missing colour in one application only.

**3. Defer.** Scored because it must be, and 10 of its 26 points are the reversibility inflation
every do-nothing option gets for free — left visible here rather than tuned away, as records 002,
004, 006 and 007 each did. It fails on the user hat outright: `apps/pos` is a counter tablet and
compact means 36px controls under a thumb at speed, which is the mis-tap that rings up the wrong
item on a real customer's bill. ADR-0013 also names the two densities as decided.

**4. A pair of `@utility` scales per component.** `pad-touch`/`pad-compact`, `text-touch-sm`, and
so on, applied by hand. Every component carries both sets, every new component is two decisions
instead of none, and — decisively — a shared `Button` still has no way to pick. It would need a
prop, the prop would need threading from an application root through every intermediate
component, and the first component that forgets it fails silently. It is the most work and the
least reliable, which is why it ranks below doing nothing.

### Question 2 — the token names

| Rank | Option | User ×2 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **`accent` keeps shadcn's meaning; status hues take a `status-` prefix** | 5 (10) | 4 | 5 (10) | 4 (8) | 5 (10) | **42** |
| 2 | `accent` becomes the status hue; hover surface renamed | 5 (10) | 3 | 1 (2) | 2 (4) | 4 (8) | **27** |
| 3 | A DeanPOS-prefixed vocabulary mapped onto shadcn's via `@theme inline` | 4 (8) | 3 | 2 (4) | 3 (6) | 2 (4) | **25** |

**1. `status-` prefix — chosen.** Zero edits to anything generated, now or ever, and the prefix
does real work beyond avoiding the collision: it is what separates `destructive` the action from
`status-danger` the state, and the `-tint`/`-tone` suffixes encode the "never under text" rule in
a shape the contrast test can enforce rather than a comment somebody skips. It costs nothing but
longer class names.

**2. Rename the hover surface.** ADR-0013 uses the word "accent" and this option honours the
word, which is the only argument for it — and words in an ADR are not class strings. Every
`shadcn add` in eleven areas would need its `hover:bg-accent hover:text-accent-foreground`
rewritten by hand, and issue 13's entire premise is that a pulled component is committed
unmodified so that issue 14's diff *is* the design system. This option makes that impossible on
the first pull. Its engineering score of 1 is the decisive number.

**3. A parallel DeanPOS vocabulary.** `--color-ds-surface` and friends, with `@theme inline`
mapping shadcn's names onto them. It is what a greenfield design system would do, and it is
wrong here for a mechanical reason: the contrast test reads `--color-*: #rrggbb` out of the CSS
by regex, and an indirection layer puts the real values in variables the regex does not see —
green suite, unchecked palette. Record 007 deleted exactly this indirection when it landed from
`shadcn init`, for exactly this reason.

## How to turn it back

Three layers, and they do not cost the same. Written against the tree as it stands, before
issues 11–15 have run.

**Layer 1 — the density values (1.25, the six type steps). Free, permanently.** One `@layer base`
block in `theme.css`. Change a number, reload. Nothing else in the repository encodes them.

**Layer 2 — the density mechanism. Cheap now, and the cost is bounded by parts, not screens.**

1. Write a superseding record; flip this one's `Status:` to `overturned` with the date and
   reason; update both lines in `LOG.md`.
2. Count first. `rg -l 'tap-target' apps packages` is the real number. Today it is **four call
   sites** — `packages/ui/src/components/sheet.tsx:72`, `apps/pos/src/components/ErrorState.tsx:15`,
   `apps/backoffice/src/components/ErrorState.tsx:15`, and
   `apps/backoffice/src/components/AppShell.tsx:24` (the first three currently read `target-min`
   or `touch-min` and are renamed by issue 11 or 14). After issue 14 it is roughly twelve parts.
   After eleven areas it is every interactive element in the product.
3. Remove the `[data-density="touch"]` block and `--tap-size` from `theme.css`; restore
   `@utility target-min` / `touch-min` if reverting to record 007's shape; remove the attribute
   from two `index.html` files and the one assertion from each application's
   `design-values.test.ts`.
4. Re-run `vp check; vp run -r check; vp run -r test`.

**What voids that estimate:** any component that has grown a `density` prop, or any application
code that reads `document.documentElement.dataset.density`. Clause 3 of the contract exists to
keep both greppable — `rg -n 'dataset.density|density=' apps packages` should return nothing.

**Layer 3 — the token names. Free today, and not free for long.** This is record 007's asymmetry
restated, and it is why the question was routed rather than guessed. Right now **no screen in
DeanPOS consumes any of these thirty-five names** — the reversal is one file plus a pairing array.
The moment issue 14 lands they are in twelve components; after area 4 they are in class strings
across thirty screens, with no type system to catch a miss, and a rename becomes a repository-wide
find-and-replace verified by eye. The `status-` prefix is the part most likely to be regretted
and it is also the cheapest to unpick, because it appears in no generated file — `rg -n
'status-(success|warning|info|danger)-(tint|tone)' apps packages` finds every occurrence, and
they are all hand-written.

**What is not touched by any layer:** no migration, no schema, no handler, no contract, no
manifest, and no dependency. This record adds nothing to any `package.json`.

## What would make this decision wrong

- **The registry has moved to component classes, and issue 13 will hit it.** The current
  `bases/radix/ui/button.tsx` and `sidebar.tsx` in shadcn's repository no longer carry full
  utility strings — they carry short `cn-button-variant-default` / `cn-sidebar-menu-button`
  classes backed by a stylesheet. The `button.tsx` and `sheet.tsx` on disk here, pulled under
  record 007, carry full utility strings. **This record's token names survive either shape** —
  the component CSS still consumes `--color-*` — but issue 14's re-skin becomes "edit an injected
  stylesheet" rather than "edit class strings", and issue 13's vanilla-baseline diff will look
  nothing like what its author expected. Flagged here so it is found before a lane is spent on it,
  not decided here.
- **The injected sidebar CSS may reference bare `var(--sidebar-border)`.** shadcn declares
  `--sidebar-*` at `:root` and maps them to `--color-sidebar-*` through `@theme inline`; record 007
  deleted that indirection and this record keeps it deleted, because the contrast test's regex
  cannot see through it. If the generated component stylesheet references the *unprefixed* names
  directly, those `var()`s resolve to nothing and borders vanish silently. The fix is issue 14's
  and it is a rewrite of the references, not a second set of tokens. **Do not re-add the
  unprefixed aliases** — that is two names for one value and the test would only check one.
- **A regenerated `button.tsx` uses `text-white` instead of `text-destructive-foreground`.**
  shadcn's current variable list no longer includes `--destructive-foreground`; ours does, and the
  vendored file uses it. Keep the token. If a pull replaces the class, restore it in issue 14 —
  otherwise the assertion still passes while the rendered label bypasses the palette.
- **`#35CCA6` is used verbatim as `status-success-tone`.** It measures 2.03:1 on white and the
  contrast test will say so. If someone "fixes" that by deleting the pairing rather than darkening
  the value, this record's conformance claim is void.
- **A `-tone` token acquires a `-foreground` partner.** That is the shape of somebody having put a
  label on an accent. The grep is above.
- **Rescaling `--spacing` produces something ugly rather than something bigger.** This is the
  weakest point in the record and I am not claiming otherwise: 1.25× is derived from the 44px
  floor, but no one has seen a Card, a Badge and a Table rendered at it, because — as issue 14
  says plainly — no screen in this repository renders all three. **Re-check trigger: issue 15, the
  first real consumer in both applications.** If the touch scale looks wrong there, the fix is
  Layer 1 above and costs one number.
- **`--spacing` stops being a runtime `var()` reference in a future Tailwind.** The whole mechanism
  rests on it. Symptom: the touch application renders at compact spacing while the type scale
  still changes. Re-check at any Tailwind minor that touches the spacing scale, and at Tailwind 5,
  which record 007 already names as its own re-check trigger.
- **Someone adds `data-density` to a shell `<div>` "so tests can set it".** Portalled surfaces
  then render at the wrong scale and nothing fails. Clause 2 of the contract is the guard.

## Evidence

**Repository, read 2026-08-02:**

- `.scratch/foundation/issues/11-token-layer-palette-manrope-densities.md` — both questions
  verbatim, the three candidate density shapes, the two named traps (the `accent` collision, and
  the "every declared token needs a pairing" behaviour), and the "values are yours, names and
  roles are not" precedent.
- `.scratch/foundation/issues/13-pull-the-shadcn-parts.md` — the seven parts pulled, the
  "`shadcn add` must not alter the palette" criterion, and the requirement that the generated files
  are not edited. `.../14-reskin-the-shared-parts.md` — the badge as "pale tint plus saturated dot
  plus dark text", the black active pill, "both densities applied to every part", the focus opt-out
  to strip, and the instruction to report that densities were not looked at.
  `.../15-reskin-both-app-shells.md` — the first real consumer in two applications, and the
  standing obligation that issue 05's Tailwind wiring was never verified in a committed app.
  `.../12-styling-standard-and-raw-value-guard.md` — `apps/<app>/tests/design-values.test.ts`, the
  file the density assertion is appended to, and the `./test-seam` export precedent.
- `docs/adr/0013-visual-design-system-and-palette-roles.md` — the measured ratios (white on
  `#35CCA6` 2.03:1, `#1E1E1E` on `#E14A77` 4.32:1, `#000000` on `#E14A77` 5.45:1), `#1E1E1E` as the
  action colour, the four-hue tile row, destructive at ≈`#C0264F` as "the brand pink's darker
  sibling", "one system with two scales, not two design systems", the 8px grid, `tnum`, and the
  flat-map warning about dark mode.
- `.scratch/decisions/007-shared-ui-dependency-set.md` — the binding constraints this record works
  inside: no `presets` array, the shared `theme.css` reached by two identical relative imports,
  six-digit sRGB hex only and why, `--min-target-size` / `--min-touch-size` with their W3C
  provenance, the `@layer base` `:focus-visible` rule, the instruction to delete the generated
  `@theme inline` / `:root` indirection, and the token-names-are-not-cheaply-reversible asymmetry.
  Its `touch-min` / `target-min` call-site instruction is the one line this record supersedes.
- `.scratch/decisions/009-terminal-shell-chrome-states.md` lines 191–192 — the same instruction,
  amended the same way.
- `packages/ui/src/theme.css` and `packages/ui/tests/contrast.test.ts` as they stand — the
  seventeen current tokens, the fourteen current pairings, the
  `/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g` regex (which the `status-` names satisfy, since
  they are lower-case and hyphenated), and the `untested` assertion this record's list extends.
- `packages/ui/src/components/button.tsx` lines 12–17 — `hover:bg-accent
  hover:text-accent-foreground` on `outline` and `ghost`, and `text-destructive-foreground` on
  `destructive`. **This is what settles question 2**: the collision is already on disk, in a file
  regenerated by a tool. `packages/ui/src/components/sheet.tsx` line 72 — the `target-min` call
  site, and `SheetPortal` / `SheetPrimitive.Portal`, which is the portal-to-`body` behaviour clause
  2 of the contract exists for.
- `apps/pos/index.html`, `apps/backoffice/index.html` — `<html lang="en">` with no other
  attributes; the two lines that change. `apps/{pos,backoffice}/src/styles.css` — the two
  byte-identical import lines option 2 would have broken.
- `rg` for `target-min|touch-min` across the repository — four live call sites, listed in the
  reversal section. `rg` for `data-density` — **no match anywhere**, so this record introduces the
  attribute rather than ratifying one.

**External, primary sources, accessed 2026-08-02.**

- <https://tailwindcss.com/docs/padding> — the quick-reference row stating `p-<number>` compiles to
  `padding: calc(var(--spacing) * <number>)`, and the customisation section showing the whole
  spacing scale driven by a single `--spacing` theme variable. **This is the load-bearing fact of
  the density mechanism**, and it is quoted from the page rather than inferred.
- <https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/packages/tailwindcss/theme.css>
  — `--spacing: 0.25rem`; the `--text-*` scale with line heights written as unitless ratios
  (`--text-sm--line-height: calc(1.25 / 0.875)`), **which is why the touch block overrides only the
  font sizes**; the `--radius-xs … --radius-4xl` namespace; and
  `--default-font-family: --theme(--font-sans, initial)`, which is why the font token is
  `--font-sans` and not `--font-manrope`.
- <https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/packages/tailwindcss/index.css>
  — `@layer theme, base, components, utilities;`, with `theme.css` into `theme` and
  `preflight.css` into `base`. **This is why the density block sits in `@layer base` and wins
  deterministically rather than by source order.**
- <https://tailwindcss.com/docs/theme> — "Theme variables are also required to be defined
  top-level and not nested under other selectors or media queries", which is why the density
  override cannot live in `@theme`; "All of your theme variables are turned into regular CSS
  variables when you compile your CSS"; and the `@theme inline` section, whose own wording — the
  utility "will use the theme variable *value* instead of referencing the actual theme variable" —
  confirms that a non-`inline` utility *references* the variable.
- <https://ui.shadcn.com/docs/theming> — the complete default variable list, which is the source of
  the twenty-seven shadcn-vocabulary names kept here: `background`, `foreground`, `card`,
  `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`,
  `chart-1…5`, and the eight `sidebar*` names, with `sidebar-primary` documented as
  "high-emphasis actions inside the sidebar" and `sidebar-accent` as "hover and selected states
  inside the sidebar" — which is exactly issue 14's black active pill and its resting hover.
- <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/radix/ui/sidebar.tsx>
  — read for the token names it consumes (`bg-sidebar`, `text-sidebar-foreground`,
  `bg-sidebar-accent`, `text-sidebar-accent-foreground` in class strings, the rest behind
  `cn-sidebar-*`), and the source of the "registry has moved to component classes" finding above.
- <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/radix/ui/button.tsx>
  — now emitting `cn-button-variant-default` rather than the utility strings the vendored copy in
  this repository carries. Same finding, second file.
- <https://www.w3.org/TR/WCAG22/#non-text-contrast> (SC 1.4.11, AA, 3:1) and
  <https://www.w3.org/TR/WCAG22/#contrast-minimum> (SC 1.4.3, AA, 4.5:1) — the two thresholds in
  the pairing table. <https://www.w3.org/TR/WCAG22/#target-size-enhanced> (SC 2.5.5, AAA, 44px) —
  the number the 1.25 factor is derived from, carried forward from record 007 rather than
  re-derived.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No first-party Tailwind documentation of overriding theme variables in a scoped selector to
  produce a second scale.** The behaviour follows necessarily from the two documented facts above
  (utilities reference the variable; theme variables become ordinary CSS variables), and shadcn's
  own `.dark` class is the same technique applied to colour — but Tailwind does not write the
  pattern down, and I am not claiming it does. **It was not verified by running it**, which is the
  same gap record 007 recorded for `@utility` inside an imported file and issue 15 still carries.
  Symptom if wrong, and the fallback, are both in *What would make this decision wrong*.
- **One documentation fetch answered "no" to the `calc(var(--spacing) * n)` question while quoting
  text that says yes.** Recorded because it is why the claim was re-checked against the padding
  page and the default theme source rather than accepted, and because a future reader re-verifying
  from `/docs/theme` alone may reach the same wrong answer.
- **No `ui.shadcn.com` page enumerates which components consume which sidebar variables.** The
  eight `sidebar*` tokens are declared on the strength of shadcn's own variable list rather than on
  a per-component audit, deliberately: a missing one resolves to nothing and fails silently, and
  eight declarations plus five pairings is cheaper than that failure.
- **Nothing in `.scratch/decisions/` addresses density, the `accent` collision, or a status
  palette.** Searched all twelve records for `density`, `accent`, `status`, `tint`, and `Manrope`
  before deciding. **No duplicate, no orphan.**
