# 039: Table labels are reordered by up and down buttons, because a drag is not allowed to be the only way

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-03
- **Asked by:** `.scratch/tenancy-identity/issues/05-store-management.md`, split out of [038](038-the-store-management-screen.md)

## The question

A Store's table labels are an **ordered** list of free strings, empty by default, and issue
05 requires that adding, removing and **reordering** all work, with duplicates permitted.
Nothing is drawn. What is the interaction, and what do a keyboard user and a screen-reader
user actually do?

What a wrong answer costs: this is the project's first reorderable control, and the obvious
implementation — drag and drop — is a **Level AA failure on its own**. It is also the first
control in the repository whose correctness depends on React key identity rather than on
anything visible, so it can ship looking right and be broken for exactly the users the
criterion exists for.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                                                 |
| --------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| User impact     | ×3     | This is where AA is won or lost, and a broken reorder is invisible to the person who built it.                       |
| Business impact | ×1     | Nothing here earns. Table labels are optional and empty by default.                                                  |
| Eng cost/risk   | ×2     | One option adds a dependency with a permanent conformance obligation; the others are a few lines.                    |
| Reversibility   | ×2     | A dependency reaching into a component's props is much harder to remove than two buttons.                            |
| Evidence        | ×2     | SC 2.5.7's normative text and W3C's own worked example decide this outright, so evidence has to carry real weight.   |

Maximum 50. **Not changed after scoring.**

## What I chose, and why

**Two buttons per row, and no drag surface at all.** SC 2.5.7 Dragging Movements is
**Level AA**:

> "Dragging movements can be operated by a single pointer without dragging, unless dragging
> is essential."

Reordering a list is not essential dragging. W3C's Understanding document names the
alternative this record takes, in the same shape:

> "A sortable list of elements may, after tapping or clicking on a list element, provide
> adjacent controls for moving the element up or down in the list by simply tapping or
> clicking on those controls."

So a drag control would need button controls beside it anyway. Having decided the buttons
are mandatory, the drag becomes a second way to do a thing already done — permanent extra
code, permanent extra conformance surface, and a new dependency for a capability the
platform already covers. **The buttons are not the fallback; they are the interaction.**
Buttons are keyboard-operable natively, which satisfies SC 2.1.1 with no code.

### The control

Each row is `[ Input ] [↑] [↓] [×]`. The three are
`Button variant="ghost" size="icon-sm"` with `tap-target`, using `lucide-react`'s
`ChevronUpIcon`, `ChevronDownIcon` and `XIcon` (record 018 fixed the icon set; no second
one). `Add label` below the list is `Button variant="outline"`.

Nine things an implementer must not get wrong:

1. **Rows are keyed by a stable client-side id, never by array index.** With index keys,
   React mutates in place, so focus stays on the *position* instead of the item and the
   button the user just pressed reads as having done nothing. **This is the single most
   likely way this control ships broken, and nothing visible reveals it.**
2. **After a move, focus stays on the button that was pressed**, which now sits in the row's
   new position. That is a consequence of clause 1, not extra code.
3. **Accessible names are positional, not content-based:** `Move label 1 up`,
   `Move label 1 down`, `Remove label 1`, and `aria-label="Table label 1"` on the input.
   1-based. Positional **because duplicates are permitted** — content-based names would be
   ambiguous by design, which is not a defect to fix but a requirement to design around.
4. **The first row's `↑` and the last row's `↓` are natively `disabled`.** The reason is
   inherent to the position and the shipped `disabled:opacity-50` states it visually. This
   is a knowing narrowing of record 009's prefer-an-enabled-control rule, which was written
   about a submit button whose refusal needs explaining; here there is nothing to explain
   and record 017's "no control that does nothing" points the other way.
5. **A single-row list renders both buttons disabled.** It does not hide them — a
   disappearing control on the second row's arrival is worse than a quiet one.
6. **Every move announces**, through record 038's screen-level always-present
   `<p role="status" className="sr-only">`. One region for the whole screen, not a second
   one inside the fieldset. SC 4.1.3 Status Messages is **Level AA**.
7. **`Add label` appends an empty row and moves focus into the new input.** That focus move
   is the entire feedback, so there is **no announcement for add** — one fewer string.
8. **There is no uniqueness check and no duplicate error, ever.** On save, entries that are
   empty or whitespace-only are trimmed away silently and no error is shown, because the
   user has just abandoned a row they added.
9. **No `sm:`/`md:`/`lg:` utility.** At 390 the row is `[input flex-1][32][32][32]`, leaving
   the input roughly 180px inside `CardContent`'s `px-6`. Nothing stacks, nothing hides.

All state is local until `Save changes`; every button here mutates the draft array and makes
no request, which is why none of them has a pending state (record 038 §5).

### Strings, verbatim

No terminal full stop on any of these — record 038's convention.

| Where                       | String                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Group legend                | `Table labels`                                                                             |
| Group hint                  | `Leave this empty if you do not seat customers at numbered tables. The terminal then shows no table control at all.` |
| Row input accessible name   | `Table label {n}`                                                                          |
| Move up / down              | `Move label {n} up` · `Move label {n} down`                                                |
| Remove                      | `Remove label {n}`                                                                         |
| Add                         | `Add label`                                                                                |
| Announced after a move      | `Moved to position {n} of {total}`                                                         |
| Announced after a remove    | `Label removed`                                                                            |

`Remove label {n}` removes a string from a list, not a row from any table. **The word
`delete` still appears nowhere** (record 038).

## The options, ranked

| Rank | Option                                                                        | User ×3 | Business ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total  |
| ---- | ------------------------------------------------------------------------------- | ------- | ----------- | ------ | --------- | ------- | ------ |
| 1    | **Up/down buttons per row, no drag surface**                                    | 5 (15)  | 5           | 5 (10) | 5 (10)    | 5 (10)  | **50** |
| 2    | Buttons **plus** a hand-rolled HTML5 drag surface                               | 4 (12)  | 4           | 2 (4)  | 3 (6)     | 3 (6)   | **32** |
| 3    | `@dnd-kit` with its keyboard sensor                                             | 3 (9)   | 3           | 1 (2)  | 2 (4)     | 2 (4)   | **22** |
| 4    | A numeric "position" input per row                                              | 2 (6)   | 3           | 4 (8)  | 5 (10)    | 2 (4)   | **22** |
| 5    | Defer — no reordering in v1                                                     | 1 (3)   | 1           | 5 (10) | 5 (10)    | 1 (2)   | **26** |

**1. Buttons only — chosen, and it is not close.** It is the one option where every element
traces to a source: the interaction to W3C's own worked example under the criterion that
governs it, the components to `packages/ui`'s shipped `Button` and `Input`, the icons to
record 018's fixed set, and the announcement to record 038's existing live region. It is
also the smallest diff of the five that actually reorder. A perfect 50 is unusual and it is
honest here: nothing about this question trades off against anything.

**2. Buttons plus a hand-rolled drag surface.** The instinct that a mouse user "expects"
drag. It loses on cost with no offsetting gain: the buttons are still mandatory, so the drag
is pure addition — HTML5 drag-and-drop's event model is notoriously awkward, it does not work
on touch without pointer-event fallbacks, and every future change has to keep two code paths
agreeing about order. The gain is comfort for one input method on a screen an owner opens
once a month.

**3. `@dnd-kit`.** Scored properly rather than dismissed, because it is what a
component-library instinct produces and it genuinely does ship a keyboard sensor. It loses
on the ladder before it loses on anything else: rung 6 is only reached when rungs 1–5 fail,
and rung 4 — the platform's own buttons — fully satisfies the requirement including the AA
criterion the library would exist to satisfy. It also breaks issue 05's explicit "no new
third-party dependency". Reversal cost, stated as the ladder requires: its types would reach
the label-editor component and its context provider the fieldset — two files today, but a
dependency added for the *first* reorderable control becomes the answer for every later one,
and that is what makes it expensive rather than the install.

**4. A numeric position input per row.** Cheap, fully keyboard-accessible, and it scores 5 on
reversibility. It loses on user impact: renumbering by hand is a puzzle, moving one item
means editing two numbers, and it invents a validation problem (duplicate and out-of-range
positions) that the buttons simply do not have.

**5. Defer — ship without reordering.** Ranks third on points, entirely on the ten free
reversibility points every do-nothing option collects — the inflation records 002, 008, 009,
015 and 030 each left visible rather than tuned away. It is refuted by the issue: reordering
is an acceptance criterion, not a nice-to-have, and the order is what the terminal renders.

## How to turn it back

One file: the label-editor component under `apps/backoffice/src/features/stores/`. It owns
the buttons, the draft array, the two announcement strings and nothing else; no route, no
contract, no token, no `packages/ui` component and no manifest line knows it exists.

- **To add a drag surface later (option 2 or 3):** the draft array and its stable ids are
  already the right data shape, so a drag layer wraps the existing rows and calls the same
  `move(from, to)`. **Keep the buttons** — removing them re-fails SC 2.5.7.
- **To move to numeric positions (option 4):** replace three buttons with one input in the
  same row. One commit.
- Formally: write a superseding record, flip this `Status:` to `overturned` with the date and
  reason, update both `LOG.md` lines. `rg -l 'Move label' apps/backoffice/src` locates every
  call site; today it is one file, and it stays one file because the control is Store-scoped.

## What would make this decision wrong

- **Focus is lost on a reorder in a real browser.** The property to watch, and the check that
  matters most on this screen: press `Move down` on row 1 three times without touching the
  mouse; focus must land on `Move down` of the row that keeps moving. If it does not, the
  keys are not stable — see clause 1 — and the control is broken for exactly the user SC
  2.5.7 protects.
- **Native `disabled` on the end buttons reads badly in review**, because the tab-stop count
  changes as items move. Successor pre-decided: `aria-disabled` plus an early-returning
  handler, which is record 030's shape and keeps the tab order fixed.
- **`role="status"` is not announced by real assistive technology.** The same unknown records
  009 and 030 both flagged. The region is already always-present, their named fallback; the
  next step is `aria-live="polite"` with an explicit `aria-atomic`.
- **A tenant configures thirty labels and the button list becomes tedious.** That is the real
  trigger for option 2 or 3, and it is a measurement someone can make rather than a guess.
  A carinderia does not have thirty tables.
- **`duplicates are permitted` collides with ADR-0011 — in `checkout`, not here.** ADR-0011
  says a configured label *"holds at most one open Ticket"* and the picker *"does not offer a
  label that is already taken"*, so two identical configured labels are both hidden the moment
  one is taken. **Flagged, not decided here**, and it is not a reason to add the uniqueness
  error clause 8 forbids.

## Evidence

**External, primary sources, accessed 2026-08-03:**

- <https://www.w3.org/TR/WCAG22/#dragging-movements> — **SC 2.5.7 Dragging Movements, Level
  AA**, quoted verbatim above. The strongest input in this record; it is what makes buttons
  the requirement rather than a preference.
- <https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html> — the sortable-list
  example quoted verbatim above, and the statement that a single-pointer alternative "doesn't
  need to be the same component, just functionally equivalent".
- <https://www.w3.org/TR/WCAG22/> — levels confirmed for **SC 2.1.1 Keyboard (A)**, **SC 4.1.3
  Status Messages (AA)**, **SC 2.5.8 Target Size Minimum (AA)**, **SC 2.5.3 Label in Name (A)**.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Repository, read 2026-08-03, main checkout (not the lane):**

- `.scratch/tenancy-identity/issues/05-store-management.md` — the reordering criterion, the
  "duplicates are permitted" clause, and the "no new third-party dependency" constraint.
- `docs/adr/0011-open-tickets-tables-and-fulfilment-tags.md` — "free strings, ordered, empty
  by default"; "A table label has no stored state"; "Occupancy is derived, never stored"; and
  the at-most-one-open-Ticket clause quoted above.
- `.scratch/tenancy-identity/PRD.md` — "Table labels are a Store-scoped ordered list of free
  strings, empty by default"; an empty list means the terminal shows no table control at all.
- `packages/ui/src/components/button.tsx` — the `icon-sm` size and `ghost` variant exist;
  the base string carries `disabled:pointer-events-none disabled:opacity-50` and **no
  `active:` class**, which is why there is no pressed treatment to consume.
  `packages/ui/src/theme.css` — `tap-target` reads `--tap-size` (24px at compact, record 013),
  which `icon-sm` clears.
- `packages/ui/src/index.ts` — **no `Label`, no `Form`, no drag primitive is exported**, which
  is why the group is a native `<fieldset>`/`<legend>` and why option 3 would have meant a new
  dependency rather than a new import.
- `.scratch/decisions/` 009 (roles, prefer-enabled, no invented shapes), 017 (no control that
  does nothing), 018 (`lucide-react` is the icon set; Phosphor is nowhere in the repository),
  030 (`aria-disabled` + early return; the always-present live region), 038 (this screen).
- **Searched `.scratch/decisions/` for an existing record on reordering, drag and drop, or
  list controls before deciding: none of 001–038 names any. `039` is the next free filename.
  No duplicate.**

**Searched for and not found, where the absence mattered:**

- **No reorderable control, drag handler or `draggable` attribute exists anywhere in `apps/`
  or `packages/ui` today** — `rg -n 'draggable|onDragStart|dnd'` returns nothing. There is no
  in-repo precedent to reuse, which is why the interaction is derived from the criterion's own
  worked example rather than from a sibling component.
- **No lofi mock anywhere draws a reorder affordance**, on any surface, at any width. The
  absence is why this record exists rather than a translation note in a build report.
