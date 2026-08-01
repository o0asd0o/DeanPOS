# 009: The terminal shell's chrome — what renders when there is no tenant, no cashier, no network, and no data yet

- **Status:** decided
- **Stakes:** medium
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/06-terminal-shell-and-test-seam.md`, screen-issue triage question 3; issue 07 consumes it unchanged)

## The question

`.orc2/ORCHESTRATOR.md` requires every screen issue to answer four questions before it
is built. Issue 06 answers three: the reference is `design/lofi/pos/sale-grid-1280.svg`
and `sale-grid-390.svg`, values come from `packages/ui`, and both a wide and a narrow
width are drawn.

The fourth is unanswered: **the interaction states the mock does not draw.** The issue
names one — a legible error state when the API cannot be reached — and says nothing
about hover, focus, disabled, loading, or empty.

There is a second gap folded into the same question, and it is the one most likely to be
fudged. The mock's top bar draws `DeanPOS · Malabon · Counter 2`, an `OFFLINE · 3 queued`
indicator, and `Ana (cashier) · Lock`. **None of those have data behind them in
`foundation`.** There is no tenancy, no offline sync, and no authentication.

What a wrong answer costs: an implementer who fills those with plausible placeholders
ships a shell that lies, and eleven areas of screens are then built on top of a top bar
whose contents nobody chose. A wrong answer to the state questions is cheaper per screen
but wider — the landmark structure and the live-region pattern decided here are copied by
every screen in the product.

**Scope: the shell chrome only** — the top bar, the layout frame, and the position of the
regions. The cart, the item grid, the category rail, the search field and every control
inside them are `checkout`'s work, and **this record decides none of their states.**

## What I chose, and why

**One principle, applied six times: render what is true, render nothing where nothing is
true, and never let a state be a shape nobody drew.**

### The three top-bar slots — one renders, two do not exist yet

The mock's top bar has three slots in a fixed order. `foundation` has data for one of
them, so one of them renders.

| Slot | Mock draws | `foundation` renders | Filled by |
| --- | --- | --- | --- |
| start | `DeanPOS · Malabon · Counter 2` | the literal text `DeanPOS`, and nothing else | area 2 `tenancy-identity` appends ` · <Store> · <Terminal>` to the same node |
| centre | `OFFLINE · 3 queued` | **no element at all** | area 5 `offline-sync` |
| end | `Ana (cashier) · Lock` | **no element at all** | area 2 `tenancy-identity` |

`DeanPOS` is true today. `Malabon` and `Counter 2` are not, and `Ana (cashier)` is not.
A `Lock` control that locks nothing is a control that lies to a cashier who presses it;
an `OFFLINE` or `ONLINE` pill is a claim about a sync queue that does not exist. So those
two slots render no DOM node — **not a dimmed placeholder, not an empty reserved box.**

The header is a single flex row with `justify-between`. With one child it left-aligns;
with three it distributes them across the bar, which is the mock's arrangement at both
widths. So the later areas add a child and nothing moves that matters — the layout rule
carries the mock's order, and the *slots themselves* do not need to exist as empty nodes
to prove it.

**An empty reserved box was the tempting middle answer and it loses on both hats.** To a
cashier it reads as a broken screen at exactly the moment the shell is trying to prove it
is not broken; to a reviewer it is indistinguishable from the placeholder-data answer,
because both put something on screen that means nothing.

### Focus — already decided, confirmed, plus three things the decided rule does not give

Record 007 puts a 2px `--color-ring` outline at 2px offset in `theme.css`'s
`@layer base { :focus-visible }`. It covers every focusable element in both applications
with no per-component opt-in, so it covers the chrome. **Not re-decided.**

Three constraints do have to be added, because the rule is necessary and not sufficient:

- **Focus order is DOM order.** No positive `tabindex` anywhere in the chrome of either
  application. The only permitted `tabindex` is `-1` on `<main>`, and only as a skip-link
  target.
- **The ring must not be clipped.** A 2px outline at 2px offset needs four pixels of room
  outside the element's border box. No `overflow-hidden` on the header or on any region
  container of the layout frame. This is the concrete way the decided focus indicator
  silently stops being visible, and it would present as an accessibility failure that
  `theme.css` looks innocent of.
- **Focus is never removed and never restyled per component.** `rg -n 'outline-none|outline:\s*none|focus:ring' apps`
  returns nothing. One treatment, one place.

### Hover — the chrome has none, and the terminal may never depend on one

`foundation`'s chrome has exactly one interactive element: the error state's `Try again`
button. Its hover treatment is `packages/ui`'s `Button` variant classes, **unmodified**.
No hover treatment is added at the chrome level, and no non-interactive chrome element —
the top bar's text above all — changes on hover.

One standing rule, inherited by eleven areas, and it is the real content of this section:
**no information and no affordance in `apps/pos` may be reachable only by hover.** The
terminal is operated with a thumb on a touch screen where hover does not exist. Where a
later area wants a hover-revealed detail, it must also be reachable by keyboard focus and
by tap, and the moment anything appears on hover, WCAG 2.2 SC 1.4.13 *Content on Hover or
Focus* (Level AA) applies — dismissable, hoverable, persistent.

### Disabled — the chrome has none, and `Try again` is never disabled

While a retry is in flight the button **stays enabled and stays focusable**; the status
region carries `aria-busy="true"`. Repeated presses are harmless because TanStack Query
deduplicates in-flight fetches for the same key — an already-installed dependency covers
it, so no guard code exists to get wrong.

The reason to prefer this over the reflex `disabled={isFetching}`: a `disabled` button
leaves the tab order, so a keyboard user loses both the control and any explanation of
why it went away, at exactly the moment something has already gone wrong.

The standing rule: **prefer an enabled control with a legible reason over a silently
disabled one.** Where a later area genuinely must disable, it uses the native `disabled`
attribute with `packages/ui`'s `Button` treatment unmodified, and may rely on WCAG 2.2 SC
1.4.3's explicit exemption for inactive user-interface components — so no new token and no
contrast exception is needed for a disabled control, and nobody should invent one.

### Loading — the state that matters most, and it is one line of text

The ping route fetches through TanStack Query, so there is a real pending state on first
paint. Two decisions:

**The frame, the header, and `<main>` render on the first paint, before any data.** Only
the region bound to the query has a pending state. This is the rule that makes "never a
blank screen" true in the loading case as well as the error case — "blank until resolved"
is the same failure the error criterion already rejects in its sibling.

**Pending renders one line of text**, inside `<main>`:

```tsx
<p role="status">Loading…</p>
```

`role="status"` is an implicit polite live region, so the transition out of pending is
announced to a screen-reader user without stealing focus.

**Not a skeleton and not a spinner**, and the reason is not taste.
`design/lofi/README.md` lists loading and skeleton states under "Not drawn, on purpose";
record 007 deliberately did not ship a `skeleton` primitive; and a skeleton is a *shape* —
building one means inventing the proportions of a screen nobody has drawn, on the densest
screen in the product, which `checkout` then has to either honour or contradict.

**No artificial timing.** No minimum display duration, no delay before showing, no fade.
Every one of those is a number with no source.

Exactly one of {pending, error, content} is inside `<main>` at any time.

### Empty — the chrome has none, and the case that looks empty is an error

**The shell chrome has no empty state and `foundation` must not build one.**

The one case that reads like empty: the ping query succeeds and returns no row. That is
**not** an empty state — the row is a migration invariant seeded by issue 03 — so it
renders **the error block below**, not a friendly "nothing here yet" message. A cheerful
empty state over a broken migration is a bug wearing a feature's clothes, and it is the
specific mistake this paragraph exists to prevent.

The standing rule for eleven areas: **an empty list is an empty state; a missing singleton
is an error.**

### Error — the state the issue names, made exact enough to check

Triggered by any of three things: the query rejects, the query resolves with no row, or a
route throws. All three render the same component, so the router's
`defaultErrorComponent` and the query's error branch are one thing and an unexpected
throw is not a blank screen either.

It renders inside `<main>`, replacing the pending line. **The header and the layout frame
stay painted** — that is what makes "never a blank screen" a property rather than a claim.

```tsx
<div role="alert">
  <p>Can't reach the server.</p>
  <p>Check the connection and try again.</p>
  <Button onClick={() => refetch()}>Try again</Button>
</div>
```

Five things about it are decided and not open:

- **`role="alert"`** on the container, so its insertion is announced.
- **Nothing technical is shown.** No status code, no URL, no server-supplied message, no
  stack trace. This is not polish — issue 04's opaque-error criterion and the PRD's
  security criterion 8 make leaking server error text a review finding, and the shell is
  the last place it can leak.
- **Colour carries no meaning here.** The text is `--color-foreground` on
  `--color-background`, which `packages/ui`'s contrast test already asserts at 4.5:1. It
  is deliberately **not** `--color-destructive` on `--color-background`: that pair is not
  in record 007's asserted pairing table, so using it would put an unverified contrast
  ratio on a user-visible message. The meaning is in the sentence, which is also what SC
  1.4.1 *Use of Color* asks for.
- **The `Try again` button** is `packages/ui`'s `Button` at its default variant, whose
  `primary`/`primary-foreground` pair *is* asserted. It carries `touch-min` in `apps/pos`
  and `target-min` in `apps/backoffice`, per record 007.
- **It is identical in both layouts** — same region, same copy, same control. Full width
  at 390; in the same centre content region at 1280.

A fourth surface, decided here so it is not invented: the router's
`defaultNotFoundComponent` renders `<div role="alert">` containing
`That page doesn't exist.` and a `<Link to="/">` labelled `Back to the start`.

**The four sentences of copy are replaceable without a new record** — they are the
smallest true sentences I could write, and a human may swap them at the checkpoint. What
is **not** replaceable without a record: the roles, the region, the presence of a retry
control, the ban on technical detail, and the colour rule.

### The two layouts, and where the boundary is

**Tablet landscape and phone are selected by a CSS media query — Tailwind's default `md:`
variant, 768px.** Not JavaScript: a JS breakpoint means a first-paint flash and a width
the seam test would have to fake. Not a container query: the frame's container *is* the
viewport. `md` is a Tailwind default, so no value is invented, and 768 sits unambiguously
between the two drawn widths.

- **Below `md`** — one column: `<header>`, then `<main>` filling the remaining height and
  scrolling, then a bottom region. The bottom region **renders no element in
  `foundation`**; the mock's `3 items · ₱310 / PAY` bar is the cart summary and belongs to
  `checkout`.
- **At `md` and above** — `<header>`, then a row of three regions in the mock's order: a
  left rail, a centre content region, a right panel. **Only the centre region renders in
  `foundation`**; the left rail is the category list and the right panel is the cart, both
  `checkout`'s.
- `<main>` **is** the centre content region at both widths, so a later area adds siblings
  rather than restructuring the landmark.
- **A region with no content renders no element**, not an empty bordered box — the same
  rule as the top-bar slots, for the same reason.

**No state differs between the two layouts.** Hover, focus, disabled, loading, empty and
error are identical at 390 and at 1280. That is stated explicitly because it is the
question an implementer would otherwise ask twice.

### Landmarks and the document, because axe will check them and they are easy to forget

- `<html lang="en">` — SC 3.1.1 (Level A); axe rule `html-has-lang`.
- `<title>DeanPOS</title>` in `apps/pos`, `DeanPOS Back office` in `apps/backoffice` —
  SC 2.4.2 (Level A); axe rule `document-title`. Per-route titles belong to later areas.
- `<meta name="viewport" content="width=device-width, initial-scale=1" />` — **and no
  `maximum-scale`, no `user-scalable=no`**. SC 1.4.4 *Resize Text* (Level AA); axe rule
  `meta-viewport`. This is a real trap on a touch-first terminal, where locking zoom is
  the obvious-feeling thing to do.
- Exactly one `<header>` and one `<main id="main-content">` per page. No `<footer>` in
  `apps/pos`. `apps/backoffice` adds exactly one `<nav aria-label="Primary">`.
- No `role` attribute duplicating a native landmark's semantics.
- **No skip link in `apps/pos`.** Nothing repeats before `<main>` — the header holds one
  text node — so SC 2.4.1 *Bypass Blocks* is satisfied by the `<main>` landmark, which is
  also what axe's `bypass` rule accepts. A skip link that skips one word is noise for the
  user it exists to help.
- **`apps/backoffice` does get one**, in issue 07, because its sidebar nav *is* a repeated
  block preceding the content: a first-in-DOM `<a href="#main-content">Skip to content</a>`
  using Tailwind's built-in `sr-only` and `focus:not-sr-only` utilities, with
  `tabindex="-1"` on `<main>` so the target actually receives focus. No new token, no new
  primitive.

### Motion

**None in the chrome.** No transition and no animation on the frame, the header, or any
of the three state changes. `design/lofi/README.md` puts "Anything about motion" under
"Not drawn, on purpose", so a duration or an easing curve would be invented outright.
Radix's own animations inside `Sheet` are untouched and stay.

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×3 | Unlike records 006 and 008 there is no invisible infrastructure here at all. Every line of this decision is something a cashier sees or fails to see. |
| Business impact | ×1 | Nothing here costs or earns. The one business fact is that a shell showing a store name nobody configured erodes the operator's trust in everything else it says. |
| Engineering cost and risk | ×1 | Every option is a handful of JSX. Cost genuinely does not separate them, and weighting it as though it did would be dishonest. |
| Reversibility | ×2 | The visible half is a one-file edit forever. The landmark structure and the live-region pattern are copied by eleven areas, and that half is not cheap — the reversal section is explicit about which is which. |
| Evidence strength | ×2 | The only sources are the mock, WCAG's normative text, and record 007. A state invented against none of the three is the exact failure this record exists to prevent. |

Maximum possible total: 45.

## The options, ranked

| Rank | Option | User ×3 | Business ×1 | Eng cost/risk ×1 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Render only what has data; every state is text in `<main>`; absent regions render no element** | 5 (15) | 5 | 5 | 4 (8) | 5 (10) | **43** |
| 2 | Omit the top bar entirely until area 2 has data for it | 3 (9) | 3 | 5 | 3 (6) | 3 (6) | **29** |
| 3 | Reserve all three slots with placeholder or dimmed text (`Store —`, `Not signed in`, a disabled `Lock`) | 2 (6) | 2 | 4 | 4 (8) | 2 (4) | **24** |
| 4 | Add a `skeleton` primitive and reserve empty boxes for undrawn regions | 3 (9) | 3 | 2 | 3 (6) | 2 (4) | **24** |
| 5 | Defer — let the implementer choose per state | 1 (3) | 2 | 3 | 5 (10) | 1 (2) | **20** |

Options 3 and 4 tied at 24 and were **broken toward the more reversible option**, per
process: placeholder text is a string edit, whereas a `skeleton` primitive is a new
component in `packages/ui` that record 007 deliberately excluded and that later areas
would start consuming.

**1. Render only what has data — chosen.** It is the only option where every element on
screen is backed by something true, and the only one where each state's treatment traces
to a source that already exists: `role="status"` and `role="alert"` from ARIA, the target
sizes and focus ring from record 007, `md:` from Tailwind's defaults, the "not drawn on
purpose" list from `design/lofi/README.md`, and the asserted contrast pairs from
`packages/ui/tests/contrast.test.ts`. It scores 4 rather than 5 on reversibility for the
reason the reversal section gives — the visible half is free and the structural half is
not.

**2. Omit the top bar entirely.** Genuinely worth scoring, and it is the purest form of
"render only what is true": if two thirds of the bar has no data, perhaps none of it
should exist yet. It loses because the mock's top bar is **structure**, and structure is
the one thing a lo-fi mock does bind. Removing the banner landmark also removes the shell's
only landmark other than `<main>`, which weakens the accessibility skeleton eleven areas
inherit — and area 2 would then have to introduce the banner, decide its layout, and
retrofit it above every screen built in between. Its reversibility score of 3 is that
retrofit.

**3. Placeholder or dimmed text in all three slots.** The option an implementer left alone
would most likely produce, which is exactly why it had to be scored. It reads well in a
screenshot and fails on the product: `Not signed in` is a claim about an authentication
system that does not exist, a dimmed `Lock` is a control that does nothing, and a cashier
who presses it learns the shell cannot be trusted. It also fails the evidence test — every
one of those strings would be invented here, and eleven areas would inherit them as though
they had been chosen.

**4. Skeletons and reserved boxes.** Ranked fourth rather than dismissed because it is the
conventional answer and it does produce a shell that never visibly jumps. It fails on
three separate facts: `design/lofi/README.md` puts loading and skeleton states under "Not
drawn, on purpose"; record 007 excluded the `skeleton` primitive with a stated reason; and
a skeleton is a shape, so building one means inventing the proportions of the densest
screen in the product before `checkout` has designed it. It also carries the highest
engineering cost in the list, for the least evidence.

**5. Defer.** Included because it must be, and 10 of its 20 points come from
reversibility, which any do-nothing option maximises trivially — the same inflation
records 002, 006, 007 and 008 each left visible rather than tuned away. It fails on the
process: `.orc2/ORCHESTRATOR.md` routes exactly this question here rather than to the
implementer, and deferring means issue 06 invents an answer under time pressure that issue
07 then copies and eleven areas inherit.

## What the implementer does

Unambiguous, so nothing here is re-decided in review. **This is the instruction for issue
06; issue 07 applies the same rules to `apps/backoffice` and adds only the skip link and
the `<nav aria-label="Primary">` noted above.**

**Renders:**

1. `<html lang="en">`, `<title>DeanPOS</title>`, viewport meta with no scale lock.
2. One `<header>` containing exactly one child: the text `DeanPOS`. Flex row,
   `justify-between`. No other slot renders.
3. The layout frame: single column below `md`, three regions in a row at `md` and above,
   with only the centre region rendering. `<main id="main-content">` is that centre region
   at both widths.
4. Inside `<main>`, exactly one of:
   - pending → `<p role="status">Loading…</p>`
   - error → the `role="alert"` block above, with the retry `Button`
   - success → the ping feature
5. `defaultErrorComponent` and `defaultNotFoundComponent` on the router, as above.

**Does not render, in `foundation`:** a store name, a terminal name, a cashier name, a
`Lock` control, a connectivity or queue indicator, a bottom cart bar, a category rail, a
cart panel, a skeleton, a spinner, an empty box for any of them, or any transition.

**What a QA agent checks, without measuring the SVG:**

- `document.querySelectorAll("header").length === 1` and its `textContent.trim() === "DeanPOS"`.
- `document.querySelectorAll("main").length === 1`; `main` has `id="main-content"`.
- `rg -n 'Malabon|Counter 2|Ana |OFFLINE|queued|Lock' apps/pos/src` returns nothing.
- `rg -n 'outline-none|outline:\s*none|focus:ring' apps` returns nothing.
- `rg -n 'tabindex="[1-9]|tabIndex={[1-9]' apps` returns nothing.
- `rg -n 'matchMedia|innerWidth|useMediaQuery' apps/pos/src` returns nothing — the two
  layouts are CSS, not JavaScript.
- `rg -n 'overflow-hidden' apps/pos/src` returns nothing on the header or a frame region.
- `rg -n 'user-scalable|maximum-scale' apps` returns nothing.
- `rg -n 'transition-|animate-' apps/pos/src` returns nothing.
- A test that forces the API unreachable through the seam asserts: a `role="alert"` node
  exists, the `<header>` is still present, a control named `Try again` is present **and
  not disabled**, and the alert's text matches no leak pattern (no digits that look like a
  status code, no `http`, no `Error:`).
- `expectNoAxeViolations(container)` passes in the pending state, the error state, and the
  success state — three calls, not one.

### No-gos

- **No fake data of any kind in the chrome.** No placeholder store, terminal, or user
  name; no `ONLINE`/`OFFLINE` state; no queue count.
- **No control that does nothing.** If it renders, pressing it does something real.
- **No empty reserved box** for a region or slot that has no content.
- **No skeleton, no spinner, no shimmer** anywhere in `foundation`.
- **No new colour, size, spacing or radius value.** Everything comes from `theme.css`;
  the layout boundary is Tailwind's `md`.
- **No colour pair on a user-visible message that is not in record 007's asserted
  pairing table.**
- **No technical detail in any user-visible error.**
- **No JavaScript width detection** for the two layouts.
- **No motion in the chrome.**
- **No third `packages/ui` primitive.** Everything above is `Button`, native elements, and
  Tailwind utilities. If that turns out to be false, issue 06 says to report it rather than
  quietly add one — and it would mean issue 05 mis-scoped, not that this record is wrong.

## How to turn it back

Two halves with very different costs.

**The visible half — free, permanently.**

Changing what the top bar renders, the four sentences of copy, the pending line, the
error block's arrangement, or the `md` boundary is an edit to two files:
`apps/pos/src/components/AppShell.tsx` (the frame and the header — moved out of
`routes/__root.tsx` by record 010, which forbids JSX in any route file) and the shared state
component under `apps/pos/src/components/`. The seam test re-proves accessibility on the same run.
This does not get more expensive with time, because later areas add siblings to these
regions rather than reimplementing them.

To reverse formally:

1. Write a superseding record; flip this record's `Status:` to `overturned` with the date
   and reason; update both lines in `LOG.md`.
2. Edit the two files above in `apps/pos`, and their two counterparts in
   `apps/backoffice`.
3. Re-run the gate. Nothing else changes — no manifest, no token, no migration, no
   contract.

**The structural half — cheap now, and it grows.**

Three things are copied rather than imported, and reversing them means touching every
screen built since:

- the landmark contract (`<header>` / `<main id="main-content">` / one `<nav>`),
- the live-region pattern (`role="status"` for pending, `role="alert"` for error, exactly
  one of pending/error/content in `<main>`),
- the standing rules (nothing hover-only, prefer enabled over disabled, an empty list is
  empty and a missing singleton is an error).

Count before quoting a cost: `rg -l 'role="status"|role="alert"' apps` and
`rg -l '<main' apps`. Today that is two files per application. After eleven areas it is
one per screen with its own state, which is most of them.

**Named re-check trigger:** the first screen issue in `checkout` that needs a state this
record did not anticipate — a partial-failure state, a stale-data state, or an
optimistically-updated one. That is the moment to re-read this record rather than extend
it by precedent, because by then the copying has started.

## What would make this decision wrong

- **A cashier or an operator reports the top bar looks broken or unfinished.** That is the
  observation that would move this to option 3, and it is the single most likely way this
  record turns out wrong. It is a copy change in one file.
- **`md` (768px) is the wrong boundary for a real device.** The two drawn widths are 390
  and 1280 and they do not tell me where a 900-pixel tablet in portrait should land. This
  is the value in this record I am least confident about, and it is a Tailwind default
  rather than a measured choice. **Re-check when the first real tablet is tested**; the fix
  is one variant prefix, or a `@custom-variant` in `theme.css` if a project-specific
  boundary is ever justified by a device rather than by taste.
- **`role="status"` on content present at first paint is not announced by real assistive
  technology.** Live regions announce *changes*, and the pending line is initial content.
  The transition *out* of pending is announced, which is the part that matters, but if
  testing with a real screen reader shows the initial state is missed, the fix is an
  always-present empty live region rather than a conditional one — a change to one
  component, not to this record's principle.
- **The error copy is wrong for the audience.** It is written in plain English for a
  cashier in Malabon; the product may want Taglish, or a shorter sentence. Explicitly
  replaceable, explicitly not a re-decision.
- **`checkout` finds that "an empty list is an empty state, a missing singleton is an
  error" does not hold** for something real — a Store legitimately configured with no menu
  items, say. That is an empty *list*, so the rule holds; but if a genuine counter-example
  appears, it belongs in a superseding record rather than in a quiet exception.
- **The `<main>`-is-the-centre-region choice constrains `checkout` badly.** If the sale
  screen's primary content turns out to be the cart rather than the grid, the landmark
  moves and every screen built in between moves with it. Flagged now because it is the one
  structural choice here that `checkout` could genuinely disagree with.

## Evidence

**Repository, read 2026-08-02:**

- `.scratch/foundation/issues/06-terminal-shell-and-test-seam.md` — the shell-chrome-only
  scope quoted verbatim, the error criterion, the WCAG 2.2 AA criterion, the two-layouts
  requirement, the no-service-worker rule, and the instruction to report rather than
  quietly add a third `packages/ui` primitive.
  `.../07-backoffice-shell.md` — the nav skeleton, the `Reports` group, and the requirement
  to consume issue 06's shell decisions unchanged.
- `design/lofi/pos/sale-grid-1280.svg` — read in full, including the notes under the
  frame. The top bar's three slots and their order; "Cart is a persistent right column at
  this width — not a sheet"; the category rail, the tile grid, the cart panel, all of which
  this record assigns to `checkout`.
  `design/lofi/pos/sale-grid-390.svg` — the same three top-bar slots at 390; "Cart becomes
  a bottom sheet — same lines, same order, different container"; "PAY stays reachable
  one-handed at the bottom" — the bottom bar that `foundation` does not render.
- `design/lofi/README.md` — "A mock fixes what is on the screen and in what order. Nothing
  else"; and the **"Not drawn, on purpose"** list, which names *loading and skeleton
  states*, *every error state except the few drawn as dashed strips*, *focus, hover,
  disabled and pressed treatments*, and *anything about motion*. Four of this record's six
  sections answer an item on that list.
- `.orc2/ORCHESTRATOR.md` — the four screen-triage questions, of which this record answers
  the third; "Anything unanswered is an open question, and it goes to the `decider`";
  "QA judges a lo-fi build on structure, order, presence, state coverage, and
  accessibility — never on spacing or proportion". `.orc2/config.env` —
  `ORC2_A11Y="WCAG 2.2 AA"`, `ORC2_DESIGN="lofi"`.
- `.scratch/foundation/PRD.md` — stories 34, 36 and 37; "two layouts, not one breakpoint";
  "Both meet WCAG 2.2 AA at the shell level: landmark structure, keyboard focus order,
  visible focus indicators, and contrast"; security criterion 8 and the opaque-error
  requirement behind the no-technical-detail rule.
- `.scratch/decisions/007-shared-ui-dependency-set.md` — the `:focus-visible` rule this
  record confirms rather than re-decides; `--min-touch-size: 44px` for `apps/pos` and
  `--min-target-size: 24px` elsewhere; the **asserted pairing table**, which is what rules
  out `--color-destructive` on `--color-background` for the error text; the deliberate
  exclusion of `skeleton`, `toast` and `alert` with stated reasons; and the finding that
  axe cannot evaluate contrast in a virtual DOM.
  `.../008-frontend-application-dependency-set.md` — the axe call, the `retry: false`
  QueryClient that makes the error state reachable in a test, and the router's
  `defaultErrorComponent` hook this record renders into.
- `packages/ui/src/theme.css` — read directly. The seventeen colour tokens, the two size
  tokens, `--focus-ring-width: 2px` / `--focus-ring-offset: 2px`, `--color-ring: #000000`,
  and the `@layer base { :focus-visible }` rule. `packages/ui/src/index.ts` — the exported
  surface is `Button`, the eight `Sheet` parts, and `cn`; **nothing else exists to build
  chrome from**, which is why every treatment above is a native element plus a Tailwind
  utility.
- `.scratch/reporting/PRD.md` (via record 007) — `foundation`'s sidebar carries `Reports`
  as one entry, which is why issue 07's nav is structure only.
- `.scratch/decisions/` searched for an existing record on shell chrome, interaction
  states, layouts, or top-bar content before deciding: 001–008, none names any of them.
  Record 007 decides the *focus indicator* and is cited rather than re-decided. **No
  duplicate.**

**External, primary sources, accessed 2026-08-02.** W3C WCAG 2.2 Recommendation:

- <https://www.w3.org/TR/WCAG22/#bypass-blocks> — SC 2.4.1, Level A: "A mechanism is
  available to bypass blocks of content that are repeated on multiple Web pages." The
  basis for no skip link in `apps/pos` and a skip link in `apps/backoffice`.
- <https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus> — SC 1.4.13, **Level AA**:
  dismissable, hoverable, persistent. The basis for the nothing-hover-only rule.
- <https://www.w3.org/TR/WCAG22/#contrast-minimum> — SC 1.4.3, Level AA, and its explicit
  exception: "Text or images of text that are part of an inactive user interface component
  … have no contrast requirement." The basis for not inventing a disabled-state token.
- <https://www.w3.org/TR/WCAG22/#use-of-color> — SC 1.4.1, Level A: colour is not used "as
  the only visual means of conveying information". The basis for the error message
  carrying its meaning in the sentence.
- <https://www.w3.org/TR/WCAG22/#resize-text> — SC 1.4.4, Level AA. The basis for banning
  `user-scalable=no` and `maximum-scale` in the viewport meta.
- <https://www.w3.org/TR/WCAG22/#language-of-page> — SC 3.1.1, Level A (`lang`).
  <https://www.w3.org/TR/WCAG22/#page-titled> — SC 2.4.2, Level A (`<title>`).
- <https://www.w3.org/TR/WCAG22/#focus-visible> — SC 2.4.7, Level AA, and
  <https://www.w3.org/TR/WCAG22/#target-size-minimum> — SC 2.5.8, Level AA. Both already
  discharged by record 007's tokens; cited here only to confirm the chrome inherits them.
- <https://www.w3.org/TR/wai-aria-1.2/#status> and <https://www.w3.org/TR/wai-aria-1.2/#alert>
  — `status` has an implicit `aria-live="polite"`; `alert` has an implicit
  `aria-live="assertive"` and is for "important, and usually time-sensitive, information".
  The basis for the two roles and for which state gets which.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No design source anywhere in the repository fixes a breakpoint value.** The mocks are
  drawn at 390, 1280, 1440 and nothing between; `design/lofi/README.md` explicitly says not
  to measure them; `theme.css` declares no breakpoint token. `md` is therefore Tailwind's
  default and is labelled as such rather than presented as a derived number. This is the
  weakest-evidence item in the record and it is scored honestly, not padded.
- **No prior art for shell chrome exists in this repository.** `apps/pos` currently holds
  a placeholder `src/index.ts` and one test; `packages/ui` exports two primitives. There
  is no nearest existing screen to take a treatment from, which `design/lofi/README.md`
  would otherwise have pointed at — so every value above traces to a token, a Tailwind
  default, or a W3C document, and none to taste.
- **No guidance was found, first-party or otherwise, on whether a `role="status"` element
  present at first paint is announced.** The behaviour is assistive-technology dependent
  and the specification does not settle it. Recorded as an unknown with a named fallback
  rather than as a finding.
