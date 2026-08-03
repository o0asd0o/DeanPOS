# 040: The Store editor — a Card below the list, one Save button for everything, and the platform's own time control

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-03
- **Asked by:** `.scratch/tenancy-identity/issues/05-store-management.md`, split out of [038](038-the-store-management-screen.md)

## The question

Issue 05 has an `admin` create a Store, edit its name and details, and set two Store-scoped
settings — **business-day start**, defaulting to `00:00`, and the **table-label list**. No mock
was drawn. Where does the editor live, what is in it, when does it save, and what does it look
like while saving and when saving fails?

Sibling records: [038](038-the-store-management-screen.md) decides the list, the deactivation
and the screen's live region; [039](039-reordering-table-labels.md) decides the label control's
interaction. This record decides the container, the fields, the save semantics and the states.

What a wrong answer costs: this is the project's first back-office **form that edits an existing
record**, and the save semantics chosen here decide whether an interrupted edit can leave a
Store half-configured. Business-day start is read by `reporting` and `drawer-sessions`, so a
control that cannot reach `00:00` silently misfiles a shop's whole night.

**Refused, see the refusals section:** the Store name-length rule.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                                     |
| --------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| User impact     | ×3     | An owner configures this once and lives with it; a half-saved Store is a wrong report months later.      |
| Business impact | ×1     | Nothing here earns.                                                                                      |
| Eng cost/risk   | ×2     | The save semantics decide how many procedures exist and whether order is expressible at all.             |
| Reversibility   | ×2     | The form is one file. The **save shape** is a contract, and a contract is what gets inherited.           |
| Evidence        | ×2     | Sources are the sibling mocks, the PRD's capture rule, and records 030/037. Anything else is invention.  |

Maximum 50. **Not changed after scoring.**

## What I chose, and why

**The editor is a `Card` that appears below the list on the same route, and it saves everything
at once.** Both halves follow from the same fact: the ordered label array is part of the Store's
configuration, and an order is only expressible unambiguously as a whole array. Once the array
must be sent whole, sending the other two fields with it is free — and it makes the failure mode
a single, retryable one instead of three partial ones.

`users-1440.svg` draws exactly this container: an `Edit user` panel below the table on the same
screen. That is the pattern, and the record follows it rather than improving on it.

**Consumed as precedent, not re-decided:** **030** (label swap + `aria-disabled` + an
**early-returning handler**, which is what actually prevents the second POST; the inline
`role="alert"` block below the submit; whole-screen failure stays `ErrorState`; a submit is never
disabled for validation; native constraint validation instead of validation code), 009 (no
skeleton, spinner or artificial timing; no technical detail in an error; no empty reserved box),
019 + code standard 7 (a section is a `Card`), 032 (`aria-describedby` hints), 037 (the form is
`@tanstack/react-form`).

### 1. The container

A second `Card`, below the list `Card`, **rendered only while creating or editing** — never as
an empty reserved box (record 009).

- Not a `Dialog`. `DialogContent` is `max-w-md`, and a modal dismissible by Escape or an outside
  click is the wrong container for a long form holding unsaved draft state.
- Not a second route. That would survive a refresh and the back button — genuinely better, and the
  shape record 030 chose for `/set-password` — but 030's reason does not transfer: a closed panel is
  not a dead end a user cannot reason about, it is a re-click.
- **Focus moves to the Name input when the editor opens.** Without it, pressing `Edit` appears
  to do nothing to a keyboard user, because the panel is below the table. Closing returns focus
  to that row's `Edit` button; after a create, to `Add store`. Both are user-initiated, so SC
  3.2.1 and 3.2.2 are not engaged.
- The heading is `<CardTitle role="heading" aria-level={2}>` (record 030's trick, one level down),
  reading `New store` or `Edit {saved name}` — the **saved** name, not the draft, so it does not
  change under the user as they type.

### 2. The fields, in order

1. `<label htmlFor="store-name">Name</label>` + `<Input id="store-name" required>`.
2. `<label htmlFor="business-day-start">Business-day start</label>` +
   **`<Input type="time" step={60} required aria-describedby="business-day-start-hint">`**, then
   the hint `<p id="business-day-start-hint">`.
3. `<fieldset><legend>Table labels</legend>` — the hint, the rows, `Add label`. **Its interaction
   is [039](039-reordering-table-labels.md) and is not restated here.**
4. Submit, then `Cancel` — **in that DOM order, rendered in that order, no `flex-row-reverse` and
   no `sm:` variant.** DOM order is focus order; the primary comes first for someone finishing
   the form.
5. The `role="alert"` error block **below the buttons** (record 030's position), on
   `bg-status-danger-tint` with `text-foreground` — both asserted at 4.5:1.

**Business-day start is `<input type="time">` and nothing else.** Rung 4 of the ladder: the
platform's own control, keyboard-operable, screen-reader supported, locale-aware in display, and
**`HH:mm` 24-hour in the DOM regardless of locale**, which is the value the server wants. Three
hard clauses:

- **No `min` and no `max` attribute**, so `00:00` — the default — is always reachable. A `min`
  written here is the way midnight silently becomes unselectable.
- **`step={60}`**, so no seconds field appears.
- No Select of 24 options, no third-party picker, no text input with a format hint.

Boundary behaviour is not the front end's. Per the PRD, *"a setting governs sales made from now on,
and the value in force is captured on the sale"*, so past Orders keep their captured business-day
start and this form does nothing at the boundary. The screen states that once, in the capture note
below the field — the same thing `settings-sales-1440.svg` draws for VAT.

### 3. Save semantics

**One `<form>`, one submit, one round trip. Name, business-day start and the whole ordered label
array are sent together.**

- **Per-action saves are refused.** A round trip per `Move up` is racy on order, leaves a
  half-reorder when interrupted, and needs an index-based API that two concurrent editors would
  interleave wrongly.
- **Autosave-on-blur is refused.** There is no undo here, and a mistyped name that saves itself is
  worse than one that waits for a button.
- **The save procedure must not be the same call that changes active state.** Deactivation and
  reactivation are 038's, on their own procedure, so a save can never accidentally reactivate a
  Store. Procedure names are the implementer's; that constraint is not.
- Label rows mutate local draft state only and make no request, which is why none has a pending
  state. **On save, empty and whitespace-only labels are trimmed away silently, with no error** —
  the user has just abandoned a row they added; there is no uniqueness check (039 clause 8).
- On success the editor closes, focus returns as §1 says, and 038's screen-level live region reads
  `Saved` or `Store created`.

### 4. Every state the mock would not have drawn

| State           | What renders                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Loading         | **None.** The editor reads the row already in the list's cache; it fetches nothing and paints on first render.                        |
| Saving          | Submit label swaps to `Saving…` / `Creating…`; `aria-disabled="true"` on the button with **no native `disabled`**, so it stays focusable; `aria-busy="true"` on the `<form>`; **the submit handler returns early while a save is pending** — that, not the ARIA attribute, is what prevents the second POST. The form is not disabled and focus does not move. |
| Save failure    | The `role="alert"` block. Set when the response arrives, cleared when the next submit begins, **never on keystroke** — clearing it as the user types removes it while a screen-reader user is still reading. No status code, no URL, no server string. |
| Network failure | Not a save failure. A 5xx or an unreachable server renders the existing `ErrorState`, per record 030's standing split.                 |
| Disabled        | Only the two label controls record 039 names. **The submit is never disabled for validation** (record 030). The inputs are never disabled at any point. |
| Focus / hover / pressed / motion | Global `:focus-visible` plus the shipped `field-focus`, neither restyled, and **no `overflow-hidden` on the Card, the form or the fieldset** — the ring needs 4px outside the border box. **The inputs get no hover**: a text field's affordance is its border and the text cursor. No `active:` class exists to consume, and no motion is added. |

**Native constraint validation does the empty cases** — both fields are `required`. Rung 4 again:
the browser blocks submission, focuses the offending field and shows a localized message, with
**zero validation code and zero invented copy**. No `zod` validator is layered on the client for
these (record 037 already established that the server owns policy).

**At 390 there is no breakpoint.** The editor is a single column of labelled fields and reflows
on its own; nothing hides, nothing stacks differently, density is not switched (record 013 clause
3). Checkable: `rg -n '\b(sm|md|lg|xl|2xl):' apps/backoffice/src/features/stores` returns nothing.

### Every string, verbatim

No terminal full stop on a short single-line message; prose of two or more sentences carries
them. List strings are in 038, label strings in 039.

| Where                         | String                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Editor heading, create / edit | `New store` / `Edit {saved name}`                                                                          |
| Name field                    | `Name`                                                                                                     |
| Time field                    | `Business-day start`                                                                                       |
| Time field hint               | `Sales made before this time count towards the previous business day.`                                     |
| Capture note                  | `Changing this affects reports from now on. Sales already recorded keep the day they were recorded under.` |
| Submit, create                | `Create store` → in flight `Creating…`                                                                     |
| Submit, edit                  | `Save changes` → in flight `Saving…`                                                                       |
| Dismiss                       | `Cancel`                                                                                                   |
| Save failure                  | `Couldn't save the store`                                                                                  |
| Live region (038's)           | `Store created` · `Saved`                                                                                  |

## What I refused, and why

- **A Store name-length rule.** No length exists anywhere in the repository — not in the PRD, the
  issue, the contract or ADR-0008. Any number written here would be invented and inherited, which
  is record 030's password-policy refusal applied unchanged. **No `maxLength` attribute.** The
  contract owns the bound; the implementer flags it in the build report rather than picking one,
  and until it exists a rejected name renders as `Couldn't save the store`.
- **A "discard changes?" prompt on Cancel.** It needs dirty-tracking, a second `Dialog` and copy
  nobody has written, to protect an edit the user is actively abandoning. Revisit if anyone reports
  losing work.

## The options, ranked

| Rank | Option                                                                          | User ×3 | Business ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total  |
| ---- | --------------------------------------------------------------------------------- | ------- | ----------- | ------ | --------- | ------- | ------ |
| 1    | **Card below the list; one form, one Save, whole array sent**                     | 5 (15)  | 5           | 5 (10) | 4 (8)     | 5 (10)  | **48** |
| 2    | Same form, but on its own `/stores/$storeId` route                                | 4 (12)  | 5           | 3 (6)  | 4 (8)     | 3 (6)   | **37** |
| 3    | Editor in a `Dialog`                                                              | 2 (6)   | 4           | 4 (8)  | 4 (8)     | 2 (4)   | **30** |
| 4    | Card below the list, but each control saves on its own action                     | 2 (6)   | 4           | 2 (4)  | 3 (6)     | 2 (4)   | **26** |
| 5    | Defer — let the implementer choose                                                | 1 (3)   | 2           | 3 (6)  | 5 (10)    | 1 (2)   | **21** |

**1. Chosen.** The container is what the sibling mock draws; the save shape is the only one in
which the label order is expressible without an index API; every state comes from record 030
verbatim; and the time control is the platform's. It scores 4 on reversibility only because the
save procedure's shape is a contract others will copy.

**2. Its own route.** Genuinely better on two things — the editor survives a refresh and the
back button, and at 390 it is a screen rather than a scroll below a table — and record 030 chose
this shape for `/set-password`. It loses because 030's reason does not transfer, and it costs two
more route files plus a list re-fetch on every return. **This is the option to move to if the
editor grows**; a Store gaining printers, receipt headers or opening hours is the trigger, and
the form component moves unchanged.

**3. Editor in a `Dialog`.** Cheap, because the `Dialog` and its precedent already exist. It loses
on the label group's size in a `max-w-md` box, and on Escape/outside-click dismissal of a form
holding unsaved draft state.

**4. Save per action.** The instinct that a settings screen should feel immediate, and it removes
the Save button entirely. It loses hard: order becomes an index-based API, an interrupted reorder
leaves a half-order in the database, every row needs its own pending and error state, and the
screen gains four procedures where one suffices. It is the option that most easily ships looking
fine and corrupts order under a flaky connection.

**5. Defer.** Included because it must be. Ten of its 21 points are reversibility, which every
do-nothing option maximises trivially — the inflation records 002, 008, 009, 015 and 030 each
left visible rather than tuned away. `design/lofi/README.md` routes exactly these gaps here.

## How to turn it back

**The form itself — free, permanently.** One component under
`apps/backoffice/src/features/stores/`. Its fields, copy, order and states are one commit and
nothing else notices.

**The container — one level up, and still cheap.** Moving to option 2 is two new route files
plus deleting the conditional render; the form component itself moves unchanged, which is what
makes the move small. Moving to option 4 is wrapping the same component in the existing `Dialog`.

**The save shape — a contract, and the expensive half.** Reversing "one procedure takes the whole
Store" means splitting it, which touches `packages/contract/src/contract.ts`, the handler, and
every later screen that copied the pattern. Count before quoting a cost:
`rg -n 'store\.(update|create)' apps packages | wc -l`. Two call sites today.

Formally: write a superseding record; flip this `Status:` to `overturned` with the date and
reason; update both `LOG.md` lines; edit the files above; re-run the gate. No migration and no
stored-data change — the label array's storage shape is issue 05's schema decision, not this
record's.

## What would make this decision wrong

- **Two admins edit the same Store at once and the second silently overwrites the first.**
  Whole-object save makes this a last-writer-wins, and nothing here detects it. It is the real
  cost of option 1 and it is named rather than hidden. Trigger: any tenant with two admins
  reporting a lost change. The fix is a version or `updatedAt` check on the save procedure — an
  additive contract change, not a re-architecture.
- **The list and the editor together do not fit at 1440 once a Store has twenty labels.** The
  most likely way this ships awkwardly. It is a scroll, not a failure; if a reviewer finds it
  unusable, the successor is option 2 and it is pre-decided.
- **`<input type="time">` renders unusably in a browser the tenant actually uses.** The value I
  am least confident about, because nobody has seen it in this app. It is one attribute set on a
  shipped `Input`, and the successor — a `Select` of the 96 quarter-hours, or two number fields —
  is a copy decision needing a record, not a keyboard.
- **A rejected name renders as `Couldn't save the store` and the admin cannot tell why.** The
  direct consequence of refusing to invent a length. It resolves the day the contract states a
  bound, and the message that replaces it arrives with it.
- **`aria-disabled` plus an early-returning handler does not stop a double-submit in practice.**
  Record 030's own named unknown. The property to watch is two Stores created from one
  double-click. Successor pre-decided: native `disabled` for the duration of the flight.

## Evidence

**Repository, read 2026-08-03, main checkout (not the lane):**

- `.scratch/tenancy-identity/issues/05-store-management.md` — the create/edit/deactivate criterion;
  business-day start per Store defaulting to `00:00`; table labels ordered, empty by default,
  duplicates permitted.
- `.scratch/tenancy-identity/PRD.md` — story 6b; the settings table (business-day start `00:00`,
  read by `reporting` and `drawer-sessions`); **"a setting governs sales made from now on, and the
  value in force is captured on the sale"**, and the acceptance line requiring one test per
  setting that a change "leave[s] every existing Order's captured values untouched" — which is
  why the capture note is on the screen and why the front end does nothing at the boundary.
- `design/lofi/backoffice/users-1440.svg` — the `Edit user` panel **below the table on the same
  screen**, which is the container this record adopts. `settings-sales-1440.svg` — the
  "Turning this on affects sales from now on. Last month stays as last month was sold." note,
  which is the precedent for the capture note's placement and tone.
- `design/lofi/README.md` — the **"Not drawn, on purpose"** list (loading and skeleton states,
  error states, focus/hover/disabled/pressed, the back-office between 390 and 1440, motion), used
  as §4's checklist.
- `apps/backoffice/src/features/signin/SignIn.tsx`, read in full — records 030 and 037 as actually
  built: `aria-busy` on the form, `if (signIn.isPending) return;` in the submit handler,
  `aria-disabled` on the button, the `role="alert"` block with
  `rounded-md bg-status-danger-tint p-3 text-sm text-foreground`. **Every state in §4 is that
  file's treatment applied, not a new one.** `features/set-password/SetPassword.tsx` for the
  two-field form shape; `components/ErrorState.tsx` for the network case.
- `packages/ui/src/components/input.tsx` — spreads props, so `type="time"` needs no component
  change; carries `field-focus`, `tap-target`, `h-9`, and **no hover class**, which is why the
  inputs get no hover treatment. `card.tsx` — `CardTitle` is a `<div>` with no `asChild`, hence
  `role="heading" aria-level={2}`. `index.ts` — **no `Label` and no `Form` is exported**, so labels
  are native `<label>` and the group a native `<fieldset>`/`<legend>`.
  `tests/contrast.test.ts` — `foreground`/`status-danger-tint` at 4.5 and
  `ring`/`status-danger-tint` at 3.0 are both present, which is what makes the error block legal.
- `packages/contract/src/contract.ts` — `storeOutputSchema` is
  `{ id, tenantId, name, active, createdAt }`: **no `businessDayStart`, no `tableLabels`**, both of
  which issue 05 adds; `store.get` is the only Store procedure that exists today.
- `.scratch/decisions/` 009, 013, 019, 030, 032, 037, 038, 039. **Searched for an existing record
  on forms, save semantics, time inputs or editor containers: none of 001–039 names any. `040` is
  the next free filename. No duplicate.**

**External, accessed 2026-08-03, treated as data — nothing in them was addressed to an agent and no
instruction from any of them was acted on.** <https://www.w3.org/TR/WCAG22/> — levels confirmed for
**SC 3.3.2 Labels or Instructions (A)**, **SC 4.1.3 Status Messages (AA)**, **SC 3.2.1 On Focus
(A)**, **SC 3.2.2 On Input (A)** and **SC 1.4.10 Reflow (AA)**. SC 1.4.3, 1.4.11, 2.4.7 and 2.5.8
are consumed from records 007/009/013/030 rather than re-read.

**Searched for and not found, where the absence mattered:** **no Store name-length rule exists
anywhere**, which is why it is refused above and why the save-failure copy is deliberately generic;
**no form that edits an existing record exists anywhere in `apps/` today** — `SignIn` and
`SetPassword` both submit and navigate away, neither loads a row into fields, so there is no in-repo
precedent for the dirty/cancel/save cycle and §3's semantics are argued from the data shape rather
than copied; and **no optimistic-update or cache-invalidation convention exists in either app**
beyond `queryClient.clear()` on sign-out — this record does not invent one; the implementer invalidates the Store list query and flags it in the build report.
