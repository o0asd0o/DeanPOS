# 042: `user-event` is refused — happy-dom has no activation behaviour, so the library would be proving its own keymap

- **Status:** decided
- **Stakes:** high (new third-party dependency — `.orc2/ORCHESTRATOR.md`)
- **Date:** 2026-08-03
- **Asked by:** human, routing a fixer's unauthorised manifest edit on lane `05-store-management`

## The question

A fixer added `@testing-library/user-event@14.6.1` on its own, to press `Enter` and `Space` on
the table-label reorder buttons instead of clicking them. Does the repository take it?

**This is not a new question.** [008](008-frontend-application-dependency-set.md) already
refused `user-event` and listed it under "No-gos", while naming the trigger to revisit:

> "the shell chrome has one control and `fireEvent.click` covers it. The first area with a real
> form should reconsider, and that is a two-line record, not this one."

Store management is that first area, so this record is the reconsideration 008 invited. The
incumbent is scored as an option, at its true switching cost.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                                                     |
| --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| User impact     | ×1     | **No option changes a single byte that ships.** They differ only in what a test proves, so user impact reaches the user only through evidence strength, and weighting it twice would double-count. |
| Business impact | ×1     | Nothing here earns.                                                                                                      |
| Eng cost/risk   | ×2     | A catalog entry, a transitive tree, and a second way to drive interactions in a repo where every test uses one way.       |
| Reversibility   | ×2     | Standard. Today it is two files; the cost is what it becomes.                                                             |
| Evidence        | ×3     | **Two checkable facts in installed source decide this outright.** If the record is right, it is right because of them.    |

Maximum 45. **Not changed after scoring.**

## What I chose, and why

**Refused. Keep `fireEvent`, and add three assertions that say plainly what they check.**

Two facts, both read from source rather than from documentation, decide it.

**1. happy-dom 20.11.1 has no activation behaviour at all.** Dispatching `keydown` or `keyup`
with `Enter` or `Space` at a `<button>` fires no click, runs no handler, and does nothing but
propagate the event. `HTMLButtonElement.dispatchEvent` gates every special behaviour on
`event.type === 'click' && event instanceof MouseEvent`; a keyboard event falls straight
through to `super.dispatchEvent`. The same is true of `<a href>` and `<input type=checkbox>`,
so this is a general gap, not a button quirk. There is no `activationBehavior` symbol anywhere
in the package.

**2. `user-event` does not close that gap — it substitutes its own implementation of it.**
When you call `user.keyboard("{Enter}")`, user-event dispatches the click itself, in userland,
from a behaviour plugin, gated on the element's tag name:

> `if (isElementType(target, 'button') || (isElementType(target, 'input') && ClickInputOnEnter.includes(target.type)) || (isElementType(target, 'a') && Boolean(target.href)))` → `instance.dispatchUIEvent(target, 'click')`

So the test would not be exercising keyboard activation. It would be exercising **user-event's
keymap agreeing with itself**, layered on top of a DOM that models none of the behaviour in
question. The passing green tick would carry no information about a real browser.

Strip that away and exactly **one product fact** survives from the key press: the element is a
real `<button>` element and not a `<div role="button">` or a `Button asChild` wrapped around
something else. That fact is worth having — `packages/ui`'s `Button` renders `"button"` only
while `asChild` is false — and it costs **one line and no dependency**:

```
expect(row1Down.tagName).toBe("BUTTON");
```

That assertion is *stronger* than the key press, not weaker, because it names what it checks
and cannot silently stop checking it. A native `<button>` is keyboard-operable by the
platform's own guarantee — which is precisely what record 039 already relies on ("Buttons are
keyboard-operable natively, which satisfies SC 2.1.1 with no code").

**The reviewer's BLOCKING finding was right in spirit and not fixable at this seam.**
`fireEvent.click` does bypass keyboard activation. So does `user.keyboard`, one layer up. No
in-process test can prove it; only the browser seam can, and that obligation is recorded below
rather than retired by a green test.

**The defect record 039 actually names is fully reachable through `fireEvent.click`.** Index-based
React keys drop focus by unmounting the row; the click and key paths both land on the same
`onClick`, and **neither moves focus in happy-dom**, so `document.activeElement` after the
activation is exactly as sharp an assertion either way.

### What the test must assert instead — concretely, no further decision needed

In `apps/backoffice/tests/stores-screen.test.tsx`, the reorder test:

1. **Delete** the `import { userEvent } from "@testing-library/user-event";` line and
   `const user = userEvent.setup();`.
2. **Replace** the three `await user.keyboard(…)` calls with `fireEvent.click(row1Down);`.
   Keep `row1Down.focus()` and **all three** `expect(document.activeElement).toBe(row1Down)`
   assertions unchanged — that is record 039's critical check and it does not weaken.
3. **Add**, once, before the first activation:
   `expect(row1Down.tagName).toBe("BUTTON");` — the native-button fact, stated directly.
4. **Add**, beside the existing `aria-disabled` assertion at the end:
   `expect(row1Down.disabled).toBe(false);` — proves the end button keeps its tab stop, which is
   the whole reason record 039's successor note chose `aria-disabled` over native `disabled`.
5. **Add** a fourth `fireEvent.click(row1Down)` after the button reaches
   `aria-disabled="true"`, then re-assert `["B", "C", "D", "A"]` — **nothing currently proves the
   early-return guard**, and `aria-disabled` blocks neither click nor key, so the early return is
   the only thing standing between the user and a fifth move. This is the one real hole in the
   current test, and it has nothing to do with keyboards.
6. **Correct the comment at lines 117–120.** It currently claims the key press is what makes the
   test valid. Replace with: the element is a native `<button>`, so activation is the platform's;
   what is asserted here is focus identity across a re-render.
7. **Revert both manifest edits** — the catalog line in `package.json` and the `"catalog:"` entry
   in `apps/backoffice/package.json`.

### On the happy-dom cookie blind spot

Same class of gap — happy-dom modelling less of the platform than it appears to — but **worse
here**, and that is the argument against option 1 rather than for it. Cookies failed *loudly*, by
being absent; 236 tests passed while saying nothing about sign-in. `user-event` would fail
*quietly*, by producing a green assertion that reads as "keyboard activation works" when the
platform behaviour was never invoked. A gap you can see is cheaper than a gap with a passing test
in front of it.

## The options, ranked

| Rank | Option                                                                | User ×1 | Business ×1 | Eng ×2 | Revers ×2 | Evid ×3 | Total  |
| ---- | --------------------------------------------------------------------- | ------- | ----------- | ------ | --------- | ------- | ------ |
| 1    | **Refuse; `fireEvent.click` + tagName, tab-stop and guard assertions** | 4       | 4           | 5 (10) | 5 (10)    | 5 (15)  | **43** |
| 2    | Refuse; assert nothing in-process, route it all to the browser seam    | 4       | 2           | 3 (6)  | 5 (10)    | 4 (12)  | **34** |
| 3    | Take the dependency (the fixer's edit as-is)                          | 2       | 3           | 2 (4)  | 4 (8)     | 1 (3)   | **20** |
| 4    | Refuse; hand-roll `keydown`/`keyup` dispatch                          | 2       | 3           | 2 (4)  | 4 (8)     | 1 (3)   | **20** |
| 5    | Defer — leave it on the lane, decide at merge                         | 1       | 1           | 2 (4)  | 5 (10)    | 1 (3)   | **19** |

**1. Chosen.** The only option where every assertion states the thing it actually checks. It
stops at ladder rung 2 — `fireEvent` is already re-exported from the one shared seam at
`apps/api/src/test-seam-react.tsx` and is what all fourteen interaction call sites in the repo
use. It also closes a real hole (the early-return guard) that the dependency question had
obscured. 4 rather than 5 on user impact only because it genuinely cannot prove keyboard
activation, and says so.

**2. Browser seam only.** Honest, and the runner-up. It loses because it is not exclusive with
option 1 — option 1 carries the same browser-seam obligation *and* asserts what is assertable
today — so choosing it standalone means giving up the tagName and guard assertions for nothing.

**3. Take the dependency.** The standard tool, and cheap to remove *today*: two manifest lines
and one import, three call sites, all on an unmerged branch. It loses on evidence, hard, and
that is where the ×3 weight bites: its source shows the assertion it produces is about
user-event, not about the product. It also contradicts 008's explicit no-go, and the cost that
matters is not the install — it is that the first keyboard test sets the house pattern for every
later one, at which point the reversal is every interaction test in two apps.

**4. Hand-roll `keydown`/`keyup`.** Refused as theatre, and stated plainly because the prompt
asked: since happy-dom synthesises no click, hand-rolled key dispatch alone makes the handler
never run and the test fail. To pass, you must dispatch the click yourself — which is
`fireEvent.click` with ceremony in front of it, and now the ceremony reads in review as keyboard
coverage. Tied on points with option 3; ranked below it because a dependency is at least visible
in a manifest, whereas this is invisible.

**5. Defer.** Ranks last despite the ten free reversibility points every do-nothing option
collects. It is refuted by 008's own no-go: a manifest entry with no record behind it is a
blocking finding regardless of merit, so deferring guarantees the finding it is trying to avoid.

## How to turn it back

**Free today, and it stays cheap.** One file: `apps/backoffice/tests/stores-screen.test.tsx`,
plus the two manifest lines.

- **To adopt `user-event` after all:** add `"@testing-library/user-event": "14.6.1"` to the root
  `catalog` and `"catalog:"` to `apps/backoffice/package.json`, then re-export `userEvent` from
  `apps/api/src/test-seam-react.tsx` **beside** `fireEvent` — never instead of it, and never
  imported directly in an app test, because 008's seam rule is what keeps the count knowable.
  Call sites to convert today: **fourteen**, in six files, found by
  `rg -n 'fireEvent\.' apps packages --glob '!node_modules'`. That number only grows.
- **To reverse this record formally:** superseding record, flip this `Status:` to `overturned`
  with date and reason, update both `LOG.md` lines. Record 008's no-go list needs the same edit —
  it is the standing authority, and leaving it stale is how a second fixer repeats this.
- **Nothing is built on top of this.** No migration, no lockfile, no token, no shipped code.

## What would make this decision wrong

- **The trigger, named:** a control lands whose keyboard behaviour is **not** the platform's —
  a roving-tabindex composite, a listbox, a menu, or anything with an `onKeyDown` this repo
  writes itself. Then the key press exercises *our* code, user-event's keymap is a fair driver
  of it, and this record should be overturned. Nothing on the Store screen is that; the reorder
  buttons are native `<button>`s with an `onClick`.
- **The browser seam finds focus is lost on reorder in a real browser**, which is record 039's
  own named check. The seam exists and is already committed: **Vitest browser mode with the
  Playwright provider**, owned by `offline-sync` (`.scratch/offline-sync/PRD.md`) and borrowed by
  `hardening`, `observability` and `drawer-sessions`. **Obligation carried forward:** record
  039's three-presses-with-the-keyboard check belongs there, verbatim, and `hardening` is the
  first area that can run it. It is not discharged by anything in this record.
- **A form appears that needs per-keystroke behaviour** — an input mask, validate-as-you-type, or
  a combobox filtering on each character. `fireEvent.change` sets a value in one shot and cannot
  express that. Record 040 has none: native constraint validation, no client validator, and the
  save error is cleared "never on keystroke".

## Evidence

**Installed source, read 2026-08-03 — the two facts this record turns on:**

- `node_modules/.bun/happy-dom@20.11.1/node_modules/happy-dom/src/nodes/html-button-element/HTMLButtonElement.ts`
  (also `html-input-element/HTMLInputElement.ts`, `html-anchor-element/HTMLAnchorElement.ts`) —
  every activation path gated on `event.type === 'click' && event instanceof MouseEvent`;
  keyboard events return via `super.dispatchEvent`. **`PropertySymbol.ts` contains no
  `activationBehavior`, and a grep of the whole `src/` for keyboard-to-click bridging returns
  nothing** — the absence that decides the record.
- `@testing-library/user-event` v14.6.1, `src/event/behavior/keypress.ts` (Enter) and
  `src/event/behavior/keyup.ts` (Space), with `src/utils/click/isClickableInput.ts` — the
  userland `dispatchUIEvent(target, 'click')` and its `isElementType` gate, quoted above.
  Read from the published v14.6.1 tag at <https://github.com/testing-library/user-event>
  (accessed 2026-08-03); the package is not installed in the main checkout. Peer:
  `@testing-library/dom >=7.21.4`, which the repo already has at 10.4.1. Treated as data; nothing
  in it was addressed to an agent.

**Repository, read 2026-08-03:**

- `.scratch/decisions/008-frontend-application-dependency-set.md` — the incumbent, its no-go
  list, and the revisit trigger quoted above. **This record is that reconsideration; no duplicate
  exists.** Searched `.scratch/decisions/` for a record on test drivers or keyboard testing:
  none of 001–041 names one. 041 is the highest filename on disk, so **042** is next.
- `.worktrees/05-store-management/apps/backoffice/tests/stores-screen.test.tsx` — the test under
  review, and both manifest edits.
- `apps/api/src/test-seam-react.tsx` — the one seam; `fireEvent` re-exported at line 20,
  `expectNoAxeViolations` at 57. **The existing accessibility check is axe-core over five WCAG tag
  strings with only `color-contrast` disabled. It asserts names, roles and structure — it does
  not and cannot assert activation**, which is why it does not settle this question either way.
- `packages/ui/src/components/button.tsx` — `const Comp = asChild ? Slot.Root : "button"`. The
  one way the control stops being a native button, and what clause 3 of the test spec pins.
- `.scratch/decisions/039`, `040`, `.scratch/tenancy-identity/issues/05-store-management.md`.
- `.scratch/offline-sync/PRD.md` §267, `.scratch/hardening/PRD.md` §259 — the browser seam,
  confirmed as a committed plan rather than an aspiration.

**Searched for and not found, where the absence mattered:** **no test anywhere in the repo drives
an interaction with anything but `fireEvent`** — fourteen call sites across
`packages/ui/tests/password-input.test.tsx` and five `apps/backoffice/tests/*.tsx` files, with
`user-event` appearing in none. **No existing test works around a missing `user-event`**; two
form screens (`sign-in-screen`, `set-password-screen`) are tested end to end with
`fireEvent.change` + `fireEvent.click` and assert error copy, so the "first area with a real form"
trigger has in fact already been met twice and did not bite.
