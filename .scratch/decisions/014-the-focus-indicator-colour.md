# 014: The focus ring is the black action colour, because the outline is never drawn on the button

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from the second-model review of
  `.scratch/foundation/issues/11-token-layer-palette-manrope-densities.md`, which flagged the
  contradiction BLOCKING)

## The question

Issue 11's acceptance criterion says the focus ring is `#1E1E1E`, the black action colour.
Record 013's pairing table says `ring` must contrast 3:1 against `primary`, which is also
`#1E1E1E`. Both cannot be true, and the implementer resolved it silently by inventing a
compromise grey, `#7a7a7a`. What is DeanPOS's focus indicator?

**What a wrong answer costs.** Every interactive element in eleven areas inherits one
`:focus-visible` rule in one shared file. A weak indicator is not a bug anyone reports — it is a
keyboard user who cannot tell where they are, on the one control (`PAY`) where being wrong costs a
customer money. This is the project's committed WCAG 2.2 AA surface, not a preference.

### Weights, declared before any option was scored

Identical to records 007 and 013, deliberately: same file, same consumers, same asymmetry. **Not
changed after ranking.**

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×2 | This *is* the ring a keyboard user navigates by. Not infrastructure. |
| Business impact | ×1 | Every option is free. Nothing separates them commercially. |
| Engineering cost and risk | ×2 | Whether the answer survives seven more `shadcn add` pulls and a 35-token list two issues are told to preserve. |
| Reversibility | ×2 | Cheap today, and the token *values* are the one layer record 007 called free permanently. |
| Evidence strength | ×2 | The whole contradiction rests on where an outline is painted and what SC 2.4.13 actually measures. Both were read from the specifications rather than assumed. |

Maximum total: 45.

**Checked `.scratch/decisions/` before deciding:** records 001–013 exist, `014` is free, and no
record answers this question. Record 007 put the rule in `theme.css` and set its two size tokens;
record 009 confirmed it and added three constraints; record 013 wrote the pairing table this record
corrects. **No duplicate, no orphan.**

## What I chose, and why

**`--color-ring` becomes `#1e1e1e`. Issue 11's acceptance criterion is right and is not amended.
The shipped `#7a7a7a` is wrong and must change. Record 013's pairing table is what was wrong, and
this record supersedes five of its rows.**

The whole contradiction comes from one unexamined assumption: that the focus ring is painted **on**
the button. It is not, and this is a fact about CSS rather than a judgement call.

The rule record 007 decided, and which is on disk today, is:

```css
:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-ring);   /* 2px */
  outline-offset: var(--focus-ring-offset);                    /* 2px */
}
```

The CSS UI specification says a positive `outline-offset` means "the outline is outset from the
border edge by that amount", and that an outline "is drawn 'over' a box … doesn't influence the
position or size of the box". So the pixels the indicator occupies are a 2-pixel band beginning
2 pixels **outside** the black button — on the page ground, the card, or the sidebar. **They are
never `primary` pixels.** Asking `ring` to contrast 3:1 with `primary` measures a geometry that
does not occur.

That is confirmed by what WCAG actually requires. SC 2.4.13, whose AAA figures record 007 adopted,
reads: an area of the indicator "has a contrast ratio of at least 3:1 between **the same pixels in
the focused and unfocused states**". I checked specifically whether the final Recommendation still
carries an "adjacent contrast" clause — an earlier draft did — and **it does not**. The comparison
is the band against *itself before focus*, which is the surface underneath. So the pairings that
matter are `ring` against every **surface**, and they are the ones this record asserts.

With that settled, the two candidate colours are not close:

| `--color-ring` | vs page ground | vs card / sidebar | vs hover surface `accent` | worst surface |
| --- | --- | --- | --- | --- |
| `#7a7a7a` (shipped) | 4.10:1 | 4.29:1 | 3.37:1 | **3.37:1** |
| `#1e1e1e` (chosen) | 15.95:1 | 16.68:1 | 13.07:1 | **13.07:1** |

The black ring's *worst* surface is nearly four times the grey's *best* one. And the grey has a
second problem the ratios hide: `--color-border` and `--color-input` are `#8a8a8a`, which is
**1.25:1** away from `#7a7a7a`. A user focusing a text field would see a second line appear in
almost exactly the colour of the field's own resting border. That is a conforming indicator you can
still miss, which is the outcome the whole `@layer base` rule exists to prevent.

**So this is not a case of the reference losing to accessibility.** The orchestrator reserves that
collision, and the choice of a replacement colour, for the human. There is no collision here: read
correctly, WCAG and the reference agree, and `#1E1E1E` is ADR-0013's own recorded action colour
(`docs/adr/0013…:58` — "**`#1E1E1E` is the action colour.** Primary buttons, active nav, focus
ring"), not a colour I picked. **No new colour is introduced by this record and none is needed.**

**Why not the two-tone treatment**, which is the standard answer to this shape of problem. Its
stated purpose, in GOV.UK's own words and in the W3C technique, is that a light line and a dark line
together guarantee one of them contrasts with **any** background — the problem being an indicator
drawn on a ground the author does not control. DeanPOS controls every ground: the palette is light
only (ADR-0013 defers dark mode), and the mocks contain no dark panel — `#fafafa` canvas, `#ffffff`
content, `#f7f7f7` panels, `#eeeeee` header. A second tone would buy insurance against a surface
that does not exist, at the price of a 36th token in a 35-token list that issues 13 and 14 are
explicitly told to preserve and that `contrast.test.ts` transcribes by name. It is the right answer
the day a dark surface ships, and that is written into the re-check triggers below.

**`--color-sidebar-ring` moves to `#1e1e1e` with it.** Nothing consumes it today — the global rule
uses `--color-ring` alone — but it exists so that a future `shadcn add sidebar` finds it, and when
something does consume it, it must draw the same indicator. One focus colour in the product.

### The three things that now hold the decision up, and must be written into the file

Dropping the `ring`/`primary` assertion removes a guard, so these replace it. Each is a real way the
indicator could silently stop working.

1. **`--focus-ring-offset` must stay at least 1px.** At `0` the black outline is painted flush
   against the black button and disappears into it. The offset stopped being cosmetic the moment
   the ring became the action colour. A comment in `theme.css` says so, pointing here.
2. **No two `primary`-filled focusable elements may touch.** The indicator claims
   `offset + width` = **4px** outside the border box; inside a smaller gap it is painted over a
   black neighbour. Compact `gap-1` is exactly 4px and clears it; a zero-gap segmented control of
   black fills does not. None exists today.
3. **Record 009's two existing constraints are load-bearing, not advisory** — no `overflow-hidden`
   clipping the ring (`.scratch/decisions/009…:78–81`), and `rg -n 'outline-none|outline:\s*none|focus:ring' apps packages`
   returns nothing. Issue 14 already owns stripping the opt-out from the seven pulled parts; that
   instruction is unchanged and is now the thing that keeps this record true.

## The answers, in the order asked

**1. `--color-ring: #1e1e1e`, and `--color-sidebar-ring: #1e1e1e`. The token set does not change.**
Thirty-five tokens, same names, same order. No token is added, renamed or removed, so the
`requiredTokens` assertion in `contrast.test.ts` is untouched and issues 13 and 14 preserve exactly
what they were already told to preserve.

**2. Issue 11's acceptance criterion is NOT amended. Not one word.** It is a faithful transcription
of ADR-0013 line 58, and both are correct. The shipped value is wrong and changes. What is amended
is **record 013's pairing table** — see below — plus two *stale claims* in issue 11's own prose,
which are not criteria and must be corrected when the lane reopens:

- the `Status:` line's "`ring`/`primary` confirmed at 3.88:1, up from the old palette's 3.13:1";
- the implementation note "`border`/`input` `#8a8a8a`, `ring` `#7a7a7a` — chosen by solving for a
  grey that clears 3:1 against both the near-white surfaces and the near-black `primary`
  simultaneously", and the measured-ratios paragraph quoting 4.10 / 4.29 / **3.88**.

**3. The `:focus-visible` rule.** The CSS is **unchanged from what record 007 decided and what is on
disk** — only the token value moves. Three lines of `theme.css` change in total:

```css
@theme {
  /* … */
  --color-ring: #1e1e1e;
  /* … */
  --color-sidebar-ring: #1e1e1e;
  /* … */

  /* Focus indicator. Values from WCAG 2.2 SC 2.4.13, adopted above the AA floor.
     The offset is load-bearing: at 0 the ring is painted flush against the black
     action fill and vanishes. Record 014. */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

@layer base {
  /* … */

  :focus-visible {
    outline: var(--focus-ring-width) solid var(--color-ring);
    outline-offset: var(--focus-ring-offset);
  }
}
```

No `box-shadow`, no second ring, no `ring-offset` token, no per-component focus class anywhere. The
indicator stays a single opaque outline, as record 007 required.

**4. The pairings `contrast.test.ts` must assert.** The rule, stated so the next implementer does
not have to re-derive it:

> **`ring` is asserted at 3:1 against every token that can be the ground *beneath* a focused
> element's outline. It is never asserted against the fill of the focused element itself** —
> `primary`, `sidebar-primary`, `destructive`, and the four `-tone`s — because `outline-offset`
> guarantees the indicator is not painted on those pixels.

Delete these five rows:

```ts
["ring", "background", 3.0, "1.4.11"],
["ring", "card", 3.0, "1.4.11"],
["ring", "primary", 3.0, "1.4.11"],
["ring", "sidebar", 3.0, "1.4.11"],
["ring", "sidebar-primary", 3.0, "1.4.11"],
```

Add these twelve in their place:

```ts
["ring", "background", 3.0, "1.4.11"],
["ring", "card", 3.0, "1.4.11"],
["ring", "popover", 3.0, "1.4.11"],
["ring", "secondary", 3.0, "1.4.11"],
["ring", "muted", 3.0, "1.4.11"],
["ring", "accent", 3.0, "1.4.11"],
["ring", "sidebar", 3.0, "1.4.11"],
["ring", "sidebar-accent", 3.0, "1.4.11"],
["ring", "status-success-tint", 3.0, "1.4.11"],
["ring", "status-warning-tint", 3.0, "1.4.11"],
["ring", "status-info-tint", 3.0, "1.4.11"],
["ring", "status-danger-tint", 3.0, "1.4.11"],
```

`secondary`, `muted` and `accent` are in the list because they are the quiet-fill and hover grounds
under rows and menu items, which is exactly where a focused element sits. The four tints are there
because a focusable badge or a tinted table row is a shape area 7 will draw.

`["sidebar-ring", "sidebar", 3.0, "1.4.11"]` stays as it is, and now measures 16.68:1.

**The pairing count goes from 38 to 45, and the suite from 41 assertions to 48.** Every one of the
35 tokens is still covered: `primary` by `primary-foreground`/`primary`, `sidebar-primary` by
`sidebar-primary-foreground`/`sidebar-primary`, so removing the two ring rows breaks nothing.

Measured ratios for the twelve, against a 3:1 floor — computed with the same formulas the test
implements, and the fixer should let the test confirm them rather than transcribe them:

| Surface | Value | `#1e1e1e` on it |
| --- | --- | --- |
| `background` | `#fafaf7` | 15.95:1 |
| `card` / `popover` / `sidebar` | `#ffffff` | 16.68:1 |
| `muted` | `#f0f0ed` | 14.60:1 |
| `secondary` | `#eaeae6` | 13.83:1 |
| `accent` / `sidebar-accent` | `#e4e4df` | **13.07:1** (worst) |
| `status-warning-tint` | `#fcefd9` | 14.68:1 |
| `status-success-tint` | `#e1f5ec` | 14.67:1 |
| `status-info-tint` | `#e1edfb` | 14.06:1 |
| `status-danger-tint` | `#fbe6ec` | 14.00:1 |

## Was "one grey that clears 3:1 everywhere" right, or merely the thing that passes?

Merely the thing that passes, and the question deserves a direct answer because it was asked
directly.

The grey was derived by solving a constraint — clear 3:1 against near-white *and* near-black at once
— and that constraint is real only if the ring can land on the near-black. It cannot. So the grey is
the optimum of the wrong problem: it spends contrast against every surface the ring is actually
drawn on, in order to buy contrast against a surface it is never drawn on. The 3.88:1 figure in
issue 11 is not a margin, it is a toll paid for nothing.

The tell is that it lands within 1.25:1 of `border`/`input`. An indicator derived from the palette's
*meaning* rather than from a solver would never have arrived somewhere indistinguishable from a
resting border, and it is the one number in the shipped work that should have prompted the question
before the review did.

**This is not a close call.** The evidence separates the top two options by a factor of four on the
only measurement WCAG actually asks for. Where I am less certain is the two-tone option, and I have
scored and explained it honestly rather than dismissed it — it becomes correct the moment a dark
surface enters the palette.

## The options, ranked

| Rank | Option | User ×2 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **`--color-ring: #1e1e1e`; correct the pairing table to surfaces only** | 5 (10) | 4 | 5 (10) | 5 (10) | 5 (10) | **44** |
| 2 | Keep the shipped `#7a7a7a`; amend issue 11's criterion | 2 (4) | 3 | 5 (10) | 5 (10) | 2 (4) | **31** |
| 3 | Two-tone: black outline plus a white inner ring on a 36th token | 5 (10) | 3 | 2 (4) | 3 (6) | 4 (8) | **31** |
| 4 | Defer — leave the contradiction to whichever of issues 13–15 hits it | 1 (2) | 2 | 4 (8) | 5 (10) | 1 (2) | **24** |

**1. The action colour — chosen.** Every load-bearing claim was read from the source that owns it:
the outline geometry from CSS UI Level 4, the "same pixels in the focused and unfocused states"
comparison from the WCAG 2.2 Recommendation itself, the absence of the adjacent-contrast clause
checked specifically because an earlier draft carried it, and the action colour from ADR-0013's own
line. It costs three token characters and a pairing array, adds no token, adds no CSS mechanism,
and leaves nothing for a future `shadcn add` to collide with. Reversibility is 5 because record 007
already established token *values* as the one permanently free layer — this is one hex and one
commit, forever.

**2. Keep the grey.** It conforms. That is a real argument and it is why this option ranks above
the two-tone rather than below it: the code on `main` is not broken, and doing nothing costs
nothing. It loses on the user hat — 3.37:1 at its worst, and 1.25:1 from the resting border colour,
which is a focus indicator a hurried cashier can miss — and on evidence, because its justification
is a pairing that the outline geometry makes unreachable and it contradicts the ADR the issue was
transcribing. It ties on points with option 3 and takes the higher rank on the tie-break, which is
reversibility.

**3. Two-tone.** `outline: 2px solid #1e1e1e; outline-offset: 2px; box-shadow: 0 0 0 2px #ffffff`,
with a `--color-ring-inset` token. Genuinely more robust, well-precedented, and the answer this
record would give for a product with dark surfaces. It loses here on engineering cost: a 36th token
breaks the "exactly 35, preserve it verbatim" contract three documents now carry, a `box-shadow` is
a second mechanism `shadcn add` can inject into and conflict with, and the white inner ring solves
"the ground might be dark" in a palette where no ground is dark. Reversibility 3 rather than 5
because unwinding it means editing the assertion list, the pairing table and the rule, after two
issues have been told to preserve 36 names.

**4. Defer.** Scored because it must be, and 10 of its 24 points are the reversibility inflation
every do-nothing option gets free — left visible rather than tuned away, as records 002, 004, 006,
007 and 013 each did. It fails on the facts: seven more components arrive in issues 13–15 shipping
their own `focus-visible:ring-[3px]`, and issue 14's criterion "visible against both the card
surface and the black action fill" is unanswerable without this ruling. Deferring hands one
accessibility commitment to seven separate components to guess at.

## How to turn it back

**One commit, and it stays one commit.** This is record 007's Layer 2 — token values — which that
record called free permanently, and nothing here changes that.

1. Write a superseding record; flip this one's `Status:` to `overturned` with the date and reason;
   update both lines in `LOG.md`.
2. Edit two lines in `packages/ui/src/theme.css`: `--color-ring` and `--color-sidebar-ring`. No
   other CSS moves — the `:focus-visible` rule is byte-identical before and after this decision.
3. Edit `packages/ui/tests/contrast.test.ts`: restore the five original `ring` rows and delete the
   twelve. `requiredTokens` is not touched in either direction.
4. Re-run `vp check; vp run -r check; vp run -r test`.

**Nothing is built on top of this that also needs touching.** No component carries a focus class —
that is the point of the `@layer base` rule and record 009's grep proves it — so the reversal
touches **two files and zero call sites**, today and after eleven areas. `rg -n 'color-ring|focus-ring' apps packages`
is the real number, and it returns six lines, all in `theme.css`.

**What voids that estimate:** a component acquiring its own `focus-visible:` treatment, or a second
focus mechanism (`box-shadow`, `border-ring`) landing from a `shadcn add` and being kept. Record
009's grep is the guard and issue 14 already owns enforcing it.

**If this record is overturned in favour of the two-tone**, the reversal is larger by exactly one
token: `--color-ring-inset` added to `theme.css`, to `requiredTokens`, to the pairing table, and to
the "preserve this set" instruction in issues 13 and 14.

## What would make this decision wrong

- **`--focus-ring-offset` is set to `0`,** by someone tightening the ring or by a `shadcn` injection.
  The black outline is then painted flush against the black button and is invisible on the single
  most important control in the product, while `contrast.test.ts` stays green — the test reads
  colours, not geometry. **This is the most likely way this record quietly stops being true**, and
  the comment in `theme.css` exists for it.
- **A dark surface enters the palette.** Dark mode is the obvious one, and ADR-0013 defers it as "a
  later addition of values rather than a refactor" — which is exactly what `--color-ring` in a dark
  set would be. But a single dark *panel* in light mode would do it too, and that is the sneakier
  case because nothing about it looks like a mode change. **Re-check trigger: the first dark ground
  in the palette or the mocks.** The successor is pre-decided — it is option 3 in the table above,
  and the reason it was scored rather than dismissed.
- **Two `primary`-filled focusable elements end up touching**, in a segmented control, a number pad,
  or a button group with no gap. The ring of one is then painted over the black fill of the other on
  the shared edge. Constraint 2 above is the rule; there is no automated guard, and I am not
  pretending otherwise.
- **A component keeps or regains its own focus treatment.** Issue 05 closed on exactly this and
  issue 14 is told to strip it from seven more parts. If one survives, it draws a translucent
  3-pixel ring instead of this outline and the record's conformance claim does not describe what
  renders.
- **An ancestor with `overflow: hidden` clips the ring.** Record 009 already banned it in the chrome;
  the ban now protects a decision as well as a layout.
- **`outline` stops following `border-radius`.** Current browsers round the outline to the element's
  radius; I could not confirm this from a normative source and am not claiming it. If it regressed,
  a pill button would get a rectangular ring — ugly, still conformant, not a reason to reopen.
- **Someone "fixes" a future failing `ring` pairing by deleting the row** rather than changing the
  surface. That is the same failure mode record 013 named for `#35CCA6`, and it voids the
  conformance claim silently.

Explicitly **not** a reason this is wrong: `--color-ring`, `--color-primary` and `--color-foreground`
now share the value `#1e1e1e`. Tokens are named for their job, and three jobs may share a value —
`card` and `popover` already do. Dark mode will separate them or not, per token, which is the whole
reason ADR-0013 named them by job.

## Evidence

**Repository, read 2026-08-02:**

- `.scratch/foundation/issues/11-token-layer-palette-manrope-densities.md` — criterion at lines
  85–86 (`#1E1E1E` … focus ring), the criterion at 114–116 ("the focus indicator stays a token and
  stays an opaque outline"), the `Status:` line's 3.88:1 claim, and the implementation note at
  158–159 recording *how* the grey was derived: "chosen by solving for a grey that clears 3:1
  against both the near-white surfaces and the near-black `primary` simultaneously". **That sentence
  is the defect** — it names the constraint that does not apply.
- `.scratch/decisions/013-density-mechanism-and-token-names.md` lines 274–276, 283–284, and the
  justification at 302–305: "**`ring` on `sidebar` and on `sidebar-primary`** are there because the
  focus outline … is drawn on the sidebar surface and on the black active pill and must be visible
  on both". The second half of that sentence is the assumption this record corrects; the first half
  is kept.
- `.scratch/decisions/007-shared-ui-dependency-set.md` lines 204–221 and 465–470 — the
  `:focus-visible` rule, `:focus-visible` over `:focus`, the two token values, and the reasoning for
  adopting SC 2.4.13's AAA figures because AA's "visible" is not testable. **Not re-decided here.**
- `.scratch/decisions/009-terminal-shell-chrome-states.md` lines 67–83 — focus confirmed rather than
  re-decided, plus the three constraints, of which two ("the ring must not be clipped", "focus is
  never removed and never restyled per component", with its grep) are now load-bearing for this
  record.
- `docs/adr/0013-visual-design-system-and-palette-roles.md` line 58 — "**`#1E1E1E` is the action
  colour.** Primary buttons, active nav, focus ring." **This is what settles the question**: issue
  11 was transcribing the ADR, not inventing a criterion, so amending the issue would have put it
  out of step with the ADR. Also lines 82–88, light mode only, dark deferred.
- `packages/ui/src/theme.css` as it stands — all 35 values, `--color-ring: #7a7a7a` at line 33,
  `--color-sidebar-ring: #7a7a7a` at 41, `--color-border`/`--color-input: #8a8a8a` at 31–32 (the
  1.25:1 neighbour), and the `:focus-visible` rule at 93–96.
- `packages/ui/tests/contrast.test.ts` — the 38-row pairing array, the `requiredTokens` list, the
  `untested` assertion at 141–145 that makes token coverage mandatory, and the
  `/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g` regex the new values satisfy unchanged.
- `.scratch/foundation/issues/05-ui-tokens-and-primitives.md` lines 73–80 — the blocking finding:
  `button.tsx` opted out with `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`,
  "so `theme.css`'s `:focus-visible` outline never won"; resolved by deleting all four classes.
- `.scratch/foundation/issues/14-reskin-the-shared-parts.md` lines 72–80 — the opt-out strip is
  "not optional", and the criterion "visible against both the card surface and the black action
  fill", which this record makes answerable. `.../13-pull-the-shadcn-parts.md` lines 74–81 — the
  opt-out is deliberately left in place there and handed forward.
- `design/lofi/README.md` line 7 — "A mock fixes what is on the screen and in what order. Nothing
  else"; and the surfaces actually drawn across `pos/sale-grid-1280.svg`,
  `backoffice/login-1440.svg`, `pos/drawer-close-1280.svg`: `#fafafa` canvas, `#ffffff` content,
  `#f7f7f7` panels, `#eeeeee` header, `#cccccc` controls. **No dark ground anywhere**, which is what
  rules out the two-tone today.
- `.orc2/ORCHESTRATOR.md` lines 234–237 — "the reference loses, and a human picks the replacement.
  The `decider` may rule that the reference loses and must say so in a record; it may not choose the
  colour." **Not triggered**: the reference does not lose here, and the value chosen is ADR-0013's
  own recorded action colour, not a new one.
- `rg -n '7a7a7a|focus-ring|color-ring'` across the repository, excluding markdown — **six lines,
  all in `packages/ui/src/theme.css`.** That is the reversal cost, measured rather than estimated.
  `rg` for `outline-none|focus-visible:` under `packages/ui/src/components`, `apps/pos/src`,
  `apps/backoffice/src` — one `aria-invalid:ring-destructive/20` in `button.tsx:8` (an invalid-state
  ring, **not** a focus opt-out, and out of scope for this record) and one skip-link `focus:` block
  in `AppShell.tsx:14` (positioning utilities, no outline suppression). Nothing opts out today.

**External, primary sources, accessed 2026-08-02.**

- <https://www.w3.org/TR/WCAG22/#focus-appearance> — SC 2.4.13, Level AAA, quoted in full: an area
  of the indicator "is at least as large as the area of a 2 CSS pixel thick perimeter of the
  unfocused component or sub-component, and has a contrast ratio of at least 3:1 between **the same
  pixels in the focused and unfocused states**", with two exceptions. **The final Recommendation
  contains no adjacent-contrast requirement** — checked specifically, because an earlier working
  draft did and because that clause, had it survived, would have argued for the grey.
- <https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html> — offsetting an indicator from
  the component "is not required" but "can help make indicators more visible"; and that an indicator
  *inset* within the component must be thicker than 2px to meet the size requirement — which is a
  second reason not to move to an inset ring.
- <https://drafts.csswg.org/css-ui/#outline-offset> — "If the computed value of `outline-offset` is
  anything other than 0, then the outline is outset from the border edge by that amount", and "The
  outline created with the outline properties is drawn 'over' a box … doesn't influence the position
  or size of the box". **This is the load-bearing fact of this record**, and it is quoted rather than
  inferred. <https://developer.mozilla.org/en-US/docs/Web/CSS/outline-offset> — "An outline is a line
  that is drawn around an element, **outside the border edge**."
- <https://www.w3.org/TR/WCAG22/#non-text-contrast> (SC 1.4.11, AA, 3:1) — the threshold on every
  pairing row this record adds, carried forward from records 007 and 013 rather than re-derived.
- <https://design-system.service.gov.uk/get-started/focus-states/> — "The yellow has a high contrast
  with dark backgrounds and the thick black border has a high contrast against light backgrounds."
  The two-tone precedent, and the statement of the problem it solves — a ground the author does not
  control. <https://www.oidaisdes.org/blog/two-color-focus-indicator/> — the same rationale stated
  as "at least one of the two colors is guaranteed to meet 3:1 contrast with any solid background
  colour". Both are **arguments for option 3**, recorded as such rather than filtered out.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **shadcn/ui's current `button.tsx` and `input.tsx` focus classes could not be read from the
  registry raw URLs** — the components have moved to `cn-*` classes backed by a stylesheet, which is
  the finding record 013 already flagged for issue 13. So I could not confirm from first-party source
  whether upstream's filled button uses an outline the same colour as its fill. **The precedent was
  not needed** — the geometry and SC 2.4.13's wording settle it — and no secondary write-up is cited
  in its place. Recorded because a reader trying to re-verify from those URLs will hit the same wall.
- **No normative statement that `outline` follows `border-radius`.** MDN does not say so and the CSS
  UI draft does not require it. Listed under what would make this wrong; it affects appearance, not
  contrast.
- **Nothing in `.scratch/decisions/` decides a focus *colour*.** Records 007 and 009 decide the
  mechanism, the width and the offset; record 013 decides the token name and the pairings. Searched
  all thirteen for `focus`, `ring`, `outline` and `2.4.13` before deciding. **No duplicate, no
  orphan.**
