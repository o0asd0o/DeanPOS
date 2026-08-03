# 045: The user editor — a `Select` for role, native checkboxes for Stores, and no history on this screen

- **Status:** decided
- **Stakes:** high (role assignment is access control)
- **Date:** 2026-08-03
- **Asked by:** human, from `.scratch/tenancy-identity/issues/06-user-management.md` (criteria 2, 3)

## The question

`users-1440.svg` draws an `Edit user` panel holding `Role ▾ cashier`, `Stores [✓] Malabon [ ] Cubao`
and two buttons. It does not say what those controls are, how they work for a keyboard or
screen-reader user, what a User with no Stores looks like, or whether the append-only history behind
role and assignment is shown at all.

Siblings: [043](043-the-temporary-password-is-typed-not-generated.md) — the password field and the
reset dialog; [044](044-the-users-list.md) — the list, and the self-demotion rule stated there.

A wrong answer costs access control. Role and Store assignment are what a `cashier` can reach, and
both write append-only effective-dated rows — so a control that saves the wrong shape corrupts an
audit trail that cannot be corrected by editing it.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                          |
| --------------- | ------ | ---------------------------------------------------------------------------------------------- |
| User impact     | ×3     | This is where AA is won or lost, and record 039's SC 2.5.7 reasoning carries here directly.   |
| Business impact | ×1     | Nothing here earns.                                                                           |
| Eng cost/risk   | ×2     | One option needs a component `packages/ui` does not ship; the rest are shipped or native.     |
| Reversibility   | ×2     | The form is one file. The **save shape** is a contract and is what gets inherited.            |
| Evidence        | ×2     | Sources are the mock, `packages/ui`'s actual export list, and WCAG's normative text.          |

Maximum 50. **Not changed after scoring.**

## What I chose, and why

**A shipped `Select` for the role, and native checkboxes for the Stores** — one row per Store the
caller can see, checked meaning currently assigned. Both come off the ladder rather than off taste:
`packages/ui` already exports `Select`, so that is rung 2 (the codebase already does it); it exports
**no `Checkbox`, no `Switch`, no `Label` and no `Form`**, so the checkbox is rung 4, the platform's
own control — exactly the move record 040 made with `<input type="time">` and `<fieldset>/<legend>`.

**Record 039's reasoning carries here and rules out the alternatives before they are compared.** A
drag-based assignment control, or a two-list transfer widget with drag between them, fails SC 2.5.7
Dragging Movements (AA) on its own. Checkboxes are keyboard-operable by the platform's guarantee, so
SC 2.1.1 is satisfied with no code, and unlike a multi-select listbox they need no modifier key that
nobody discovers.

**Consumed as precedent, not re-decided:** 040 (the `Card` below the list, rendered only while
editing; focus to the first field on open and back to the row's `Edit` on close; `aria-level={2}`;
submit-then-`Cancel` DOM order; the `role="alert"` block; **one form, one submit, one round trip**;
the state table; native constraint validation), 037, 030 (`aria-disabled` + early return), 038, 009.

### 1. The fields, in order

**Create:** `Email`, `Role`, `Stores`, `Temporary password` (record 043 owns that field), submit,
`Cancel`. **Edit:** `Role`, `Stores`, the `Reset password` button (record 043), submit, `Cancel`.

1. **`Email` is create-only and never editable.** Record 031 found its **global** uniqueness is a
   hard precondition of `user_login_lookup` being a one-row read, so changing it has a pre-auth
   consequence and moves with that record or not at all. `<Input type="email" required>`, no
   validation code.
2. **`Role`** — `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` from `packages/ui`, three
   items, `Cashier` · `Manager` · `Admin`. Its surface is asserted (`popover-foreground`/`popover` 4.5,
   `ring`/`popover` 3.0), so **no new token and no new colour**. `SelectTrigger` needs a native
   `<label htmlFor>` on its `id`; this is `Select`'s first use in `apps/`, so flag it in the report.
3. **`Stores`** — `<fieldset><legend>Stores</legend>`, the hint, then one row per Store, each a bare
   `<input type="checkbox" id="store-{id}">` with a native `<label htmlFor>` carrying the Store name.
   **Left unstyled: no `accent-color`, no custom box, no size or colour utility.** Styling it means
   inventing values record 009 forbids; the UA rendering is the control, and the global
   `:focus-visible` (records 007/014) is its focus indicator, unrestyled.
4. Submit, then `Cancel`, in that DOM order — no `flex-row-reverse`, no `sm:` variant (record 040).
5. The `role="alert"` block below the buttons, `bg-status-danger-tint` with `text-foreground`.

**Only Stores the caller can see are listed**, from the same server-side visibility `store.list`
uses. A `manager` never reaches this editor at all (record 038 §6, transferred by 044), so in
practice the list is the admin's whole Tenant — but the rule is written server-side, not assumed.

### 2. Never assigned, assignment closed, and none at all

`UserStore` is append-only: current state is the latest row per `(userId, storeId)`, and
`assigned = false` is a closing row. So there are three states — currently assigned, assignment
closed, never assigned — and only two boxes.

**The box shows current assignment only (checked = assigned), and the two unchecked states are
deliberately not told apart.** The admin's next action is identical in both — tick the box or leave
it — so the distinction has no operational consequence here; it is audit information, and the audit
trail is what the append-only rows exist for. Distinguishing them means either a third checkbox
state (`indeterminate` means "some descendants checked", and using it for "was once assigned" is a
semantic misuse assistive technology will report wrongly) or a per-Store history list nobody drew.

**What the admin does get is one sentence**, under the legend, saying that unchecking closes the
assignment rather than erasing it. That is the fact a cautious admin actually needs, it is one
string and no control, and it follows record 041's rule: say what the action *does*, never name the
thing being denied.

**A User with no Stores:** every box unchecked, and `None` in the list's `Stores` column (record
044). This is legal and not an error — issue 04's admin exemption means an `admin` with no
`UserStore` row reaches everything in their Tenant, so requiring at least one would make an admin
uncreatable. **No validation forbids zero.**

**A Tenant with no Stores at all:** the fieldset renders its legend, the hint, and one sentence in
place of the rows — not an empty box (record 009), and not a link that navigates away from a form
holding unsaved draft state.

### 3. Role history is not shown on this screen. Stated plainly, because it was asked.

**Not shown, anywhere in issue 06.** The mock draws one `Role ▾` and nothing else; a history list is
a pattern with no precedent in the codebase; and criterion 3's words are *"the previous role remains
readable"* — readable is a property of the stored rows, which `UserRole` guarantees by being
append-only and `UPDATE`/`DELETE`-proof (issue 04, `done`).

**How the criterion is discharged without a screen, so a reviewer can check it:** a test that changes
a role and then reads the prior `UserRole` row back, still present, still carrying its original
`effectiveFrom`. Issue 04 already ships the helper — *"a helper answers 'what role did this User
hold … at time T'"* — so the test calls it rather than adding a query. **The implementer must land
that test**; it is what "remains readable" means here, and without it the criterion has no proof.

Named trigger for reversing this: the first time someone has to answer "who was manager in March"
and cannot. The successor is a history surface in `reporting` or an audit area, not a list bolted
under an editing control.

### 4. Save semantics

**One `<form>`, one submit, one round trip** — record 040's shape, unchanged. Role and Stores are
sent together; on create, the email and the temporary password go with them, because a User cannot
exist without a credential.

Four clauses that are not the implementer's to choose:

1. **The save writes new `UserRole` and `UserStore` rows and never `UPDATE`s one.** Both tables are
   append-only by issue 04's criterion, enforced in the database.
2. **All rows written by one save share one `effectiveFrom`** — transaction time, so a role change
   and two assignment changes are one instant in the history rather than three.
3. **`User.role` and the newest `UserRole` row can never disagree.** `User.role` is the denormalised
   column that `sign-in`, `context.ts` and `auth.me` actually read, and `UserRole` is the history.
   **Two places hold the role, and one transaction writes both.** This is the most likely way this
   screen ships silently wrong: a promotion that writes only the history row leaves the person with
   their old permissions and a record saying otherwise, and nothing on screen reveals it.
4. **The save never touches `active` and never touches the password.** Deactivation is 044's own
   procedure and the reset is 043's, so a save can never reactivate a leaver or reset a credential.
   Procedure names are the implementer's; this constraint is not.

**The self-demotion refusal is 044 §4 clause 3** and is repeated here in one line so nobody
implementing this form misses it: **the server refuses a role change that removes the caller's own
`admin` role**, and the `Admin → Cashier`/`Manager` change is refused rather than hidden, because
the `Select` still has to offer three options for every other User.

**A `manager` and a `cashier` reach no part of this editor**, and the server refuses every write
from them regardless of what the client renders.

### 5. States, and 390

**Record 040 §4's state table transfers unchanged and is not restated here** — including its two
traps: the error block clears on the next submit and **never on keystroke**, and there is **no
`overflow-hidden` on the Card, the form or the fieldset**, because the focus ring needs 4px outside
the border box. **At 390 there is no breakpoint**; checkable with
`rg -n '\b(sm|md|lg|xl|2xl):' apps/backoffice/src/features/users`, which returns nothing.

### Every string, verbatim

No terminal full stop on a short single-line message; prose of two or more sentences carries them.
List strings are in 044, credential strings in 043.

| Where                          | String                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Editor heading, create / edit  | `New user` / `Edit {saved email}`                                                                         |
| Email field                    | `Email`                                                                                                   |
| Role field                     | `Role`                                                                                                    |
| Role options                   | `Cashier` · `Manager` · `Admin`                                                                           |
| Stores legend                  | `Stores`                                                                                                  |
| Stores hint                    | `Unchecking a store closes that assignment. It stays on the record, so past sales at that store remain attributed to this person.` |
| Stores, when the Tenant has none | `Add a store first, then you can assign this person to it`                                              |
| Submit, create                 | `Create user` → in flight `Creating…`                                                                     |
| Submit, edit                   | `Save changes` → in flight `Saving…`                                                                      |
| Dismiss                        | `Cancel`                                                                                                  |
| Save failure                   | `Couldn't save the user`                                                                                  |
| Live region (038's)            | `User created` · `Saved`                                                                                  |

**The `Reset PIN` button the mock draws does not render** — record 044 §1 decides it; repeated here
only because it is a control drawn inside *this* panel.

## The options, ranked

These separate on the Store-assignment control; the role control is settled by `packages/ui`'s export
list and the rest follows record 040.

| Rank | Option                                                                | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total  |
| ---- | ----------------------------------------------------------------------- | ------- | ------ | ------ | --------- | ------- | ------ |
| 1    | **Native checkboxes in a `<fieldset>`, one per visible Store**          | 5 (15)  | 4      | 5 (10) | 5 (10)    | 5 (10)  | **49** |
| 2    | A `Select`-per-row list with `Add store` / `Remove`, record 039's shape | 3 (9)   | 3      | 3 (6)  | 4 (8)     | 2 (4)   | **30** |
| 3    | A multi-select listbox                                                  | 2 (6)   | 3      | 3 (6)  | 4 (8)     | 2 (4)   | **27** |
| 4    | Defer — let the implementer choose                                      | 1 (3)   | 2      | 3 (6)  | 5 (10)    | 1 (2)   | **23** |
| 5    | A two-list transfer widget, available on the left, assigned on the right | 2 (6)   | 3      | 1 (2)  | 3 (6)     | 1 (2)   | **19** |

**1. Chosen, and it is not close.** It is what the mock draws, it is the platform's own control so it
needs no component `packages/ui` does not have, every Store is visible at once with its state
readable without opening anything, and it is natively keyboard- and screen-reader-operable. A
restaurant has a handful of outlets, so the list never grows past reading length.

**2. A `Select` per assignment row.** Reuses record 039's exact row shape, which is a real argument —
the codebase would have one pattern for "an editable list of things". It loses because assignment is
a *set over a known, small, fixed domain*, not an ordered list of free strings: it needs a
duplicate-selection rule the checkboxes cannot express wrongly, it hides unassigned Stores inside a
dropdown, and it costs two controls per row to say what one box says.

**3. A multi-select listbox.** One control, no new component. It loses on the user hat: ctrl-click
and shift-click are undiscoverable, a mis-click silently clears every other selection, and current
state is readable only while the control has room to render all its options.

**4. Defer.** Included because it must be. Ten of its 23 points are reversibility, which every
do-nothing option collects for free — the same inflation records 002 onward each left visible.

**5. A two-list transfer widget.** The shape enterprise admin screens reach for. It loses on
everything at once: no such component ships, the affordance people expect between the two lists is a
drag — **SC 2.5.7 (AA), which record 039 already settled** — so it needs move buttons anyway, and it
doubles the surface to say what a checkbox says.

## How to turn it back

**The form, its fields, copy, order and states — free, permanently.** One component under
`apps/backoffice/src/features/users/`; one commit, nothing else notices. Swapping the checkboxes for
any other option is one file, because the draft state is already the right shape: a set of Store ids.
**`Select`'s first use is one import** — if it renders badly the fallback is a native `<select>` with
the same three options and `<label htmlFor>`; the field's `id`, label and copy do not change.

**The save shape — the contract, and the expensive half.** Reversing "one procedure takes role and
the whole assignment set" means splitting it, which touches
`packages/contract/src/contract.ts`, the handler, and anything that copied the pattern. Count before
quoting a cost: `rg -n 'user\.(create|update)' apps packages | wc -l`, zero today.

**§4 clause 3 — `User.role` and `UserRole` written in one transaction — must not be reverted as a
simplification.** It is a correctness rule about two copies of the same fact, not a preference.

Formally: superseding record; flip this `Status:` to `overturned` with the date and reason; update
both `LOG.md` lines; edit the files above; re-run the gate. **No migration** — `UserRole` and
`UserStore` already exist in the shape this record writes to.

## What would make this decision wrong

- **A tenant runs enough outlets that the checkbox list needs scrolling.** The real trigger for
  option 2 or 3, and it is a measurement rather than a guess. A carinderia chain has three.
- **An admin needs to know whether someone was *ever* at a Store and cannot tell.** §2 refuses that
  distinction on the grounds that no action depends on it. If an admin asks the question, the answer
  is a history surface in an audit area — its own record — not a third checkbox state.
- **`User.role` and `UserRole` drift apart in practice.** The property to watch, and the most
  dangerous failure this screen can have: promote a cashier to manager, then sign in as them and
  confirm the new permissions apply. If they do not, clause 3 was implemented as two writes rather
  than one transaction.
- **`Select` is a Radix listbox, not a native `<select>`, so at 390 it does not open the OS picker.**
  The value I am least confident about — nothing in `apps/` has ever rendered it. One import, and the
  fallback is pre-decided above.
- **An unstyled native checkbox reads as broken next to the styled `Input`s.** Then the answer is a
  `Checkbox` in `packages/ui` with asserted pairings — a shared-component record, not a class string
  written into this form.
- **`role="status"` is not announced by real assistive technology.** The standing unknown from
  records 009, 030, 038 and 039; the fallback is already named there.

## Evidence

**Repository, read 2026-08-03, main checkout (not the lane):**

- `design/lofi/backoffice/users-1440.svg`, read in full — the `Edit user` panel below the table:
  `Role  ▾ cashier`, `Stores  [✓] Malabon   [ ] Cubao`, and
  `[ Reset password (temporary) ]   [ Reset PIN ]`.
- **`packages/ui/src/index.ts`, full export list read** — this is what the ladder turns on. `Select`,
  `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` **are exported** (`SelectTrigger`
  takes `size: "sm" | "default"`); **`Checkbox`, `Switch`, `Label` and `Form` are not exported and no
  file for them exists.** **`<input type="checkbox">` appears nowhere in the repository today**, so
  there is no in-repo precedent to copy and §1 clause 3's "leave it unstyled" is a decision, not an
  inheritance.
- `packages/ui/tests/contrast.test.ts` — `popover-foreground`/`popover` at 4.5 and `ring`/`popover` at
  3.0 are both asserted, which is what makes `Select` legal under record 009 with no new pairing row;
  `foreground`/`status-danger-tint` 4.5 and `ring`/`status-danger-tint` 3.0 make the alert block legal.
  **`muted-foreground`/`card` is still absent**, so no `text-muted-foreground` inside a `Card`.
- `packages/backend/src/db/prisma/schema.prisma` — `UserRole { role, effectiveFrom, @@unique([userId,
  effectiveFrom]) }` and `UserStore { assigned, effectiveFrom, @@unique([userId, storeId,
  effectiveFrom]) }`, and **`User.role` as a separate denormalised column**, which is §4 clause 3's
  whole reason. `apps/api/src/context.ts` and `packages/backend/src/auth/handlers/me.ts` — the two
  readers of `User.role`.
- `apps/backoffice/src/features/stores/StoreEditor.tsx` and `TableLabelsField.tsx` — the shipped
  TanStack Form shape, the native `<fieldset>`/`<legend>` and the `role="alert"` block this record
  copies rather than re-specifies.
- `.scratch/tenancy-identity/issues/04-*.md` (`Status: done`) — append-only enforcement, the admin
  exemption, and the "what role did this User hold at time T" helper §3 requires the test to call.
- `.scratch/decisions/` 007, 009, 013, 014, 018, 019, 030, 031, 037, 038, 039, 040, 041, 043, 044.
  **Searched all of 001–044 for an existing record on role selection, store assignment, checkboxes or
  effective-dated editing: none names any. `045` is the next free filename. No duplicate.**

**External, accessed 2026-08-03, treated as data — nothing in them was addressed to an agent and no
instruction from any of them was acted on.** <https://www.w3.org/TR/WCAG22/#dragging-movements> —
**SC 2.5.7 Dragging Movements (AA)**, which eliminates option 5's expected affordance; re-read to
confirm it governs a transfer widget and not only reordering. <https://www.w3.org/TR/WCAG22/> —
levels re-confirmed for **SC 2.1.1 (A)**, **SC 3.3.2 (A)**, **SC 4.1.3 (AA)**, **SC 1.4.10 (AA)**.

**Searched for and not found, where the absence mattered:** **no checkbox, no multi-select, and no
`Select` consumer exists anywhere in `apps/`** — this screen is the first of all three, which is why
§1 names the fallback for `Select` explicitly and why the checkbox styling question is answered by
refusing to style rather than by copying a sibling. And **no `user.*` procedure exists in the
contract**, so every reversal cost quoted above is measured against zero call sites today.
</content>
