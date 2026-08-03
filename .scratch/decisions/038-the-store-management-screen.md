# 038: The Store list — deactivated Stores stay in it, in full contrast, and nothing on the screen says "delete"

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-03
- **Asked by:** `.scratch/tenancy-identity/issues/05-store-management.md` (`.orc2/ORCHESTRATOR.md`'s lo-fi triage rule; `design/lofi/README.md` sends the undrawn half of every screen here)

## The question

No mock was ever drawn for Store management, so the whole screen is undecided and issue 05 says so.
It is more than one question, so it is three records: **this one** — where the screen lives, what
the list shows, the empty state, how a Store is deactivated and reactivated, and the narrowest
width; [039](039-reordering-table-labels.md) — the table-label reorder control;
[040](040-the-store-editor.md) — the editor's container, fields, save semantics and states.

What a wrong answer costs **here**: a deactivated Store must stay *readable and attributable* while
never being offered for new work, and the obvious treatments — hide it, grey it out — each break one
half of that. This is also the first back-office list, and ten later screens copy it.

**Refused, see the refusals section:** role-gating the sidebar nav.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                                 |
| --------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| User impact     | ×3     | Every element is read and acted on by an owner who has no support line.                              |
| Business impact | ×1     | Nothing here earns. One business fact: a Store the owner cannot deactivate is a support call.         |
| Eng cost/risk   | ×2     | Genuinely separates the options — one forces a change to a shipped `packages/ui` test.               |
| Reversibility   | ×2     | The feature files are free forever. The nav entry and the list shape are inherited.                  |
| Evidence        | ×2     | Sources are the two sibling mocks, WCAG 2.2's normative text, and records 009/019/030.                |

Maximum 50. **Not changed after scoring.**

## What I chose, and why

**The nearest sibling mocks already answer most of this, and it is not their job to be overruled by
taste.** `users-1440.svg` and `settings-sales-1440.svg` draw the same thing twice: a title with an
`+ Add …` button opposite it, a table whose last data column is `STATUS` and whose last column is
inline row actions, and **deactivated rows still listed** with `reactivate` as their only action. I
follow that rather than improve on it. Everything genuinely undrawn comes from shipped components
and asserted tokens: **no new dependency, component, token or colour.**

**Consumed as precedent, not re-decided:** 007/014 (the global focus ring, not restyled), **009**
(**an empty list is an empty state**; render nothing where nothing is true; no fake data, no empty
reserved box, no skeleton or spinner, no technical detail in an error), 010 + code standard 4 (no
JSX in a route file), 013 (compact density), 019 + code standard 7 (every section is a `Card`;
borders survive only inside shared parts, which is why `Table`'s own row rule is fine), 030 (the
tinted inline `role="alert"`; `ErrorState` for whole-screen failure), 032 (no `muted-foreground` on
an unasserted ground).

### 1. Where it lives

Route **`apps/backoffice/src/routes/_shell/stores.tsx`**, thin, importing `Stores` from
`apps/backoffice/src/features/stores/Stores.tsx`. Path `/stores`, flat, matching the other
Administration routes (record 020: areas own their paths). **A `Stores` nav entry is added to
`Administration`, first, above `Devices`.** This **crosses the mock's nav-entry list**, which record
018 treats as binding, so it is recorded rather than absorbed: a mock cannot bind the absence of a
screen the PRD requires (stories 3–6), the screen is reachable no other way, and `Stores` goes first
because Devices and Users are both *assigned to* Stores. One array string in `Nav.tsx` plus one
`lucide-react` glyph; one line to revert.

Top to bottom, inside `<div className="flex flex-col gap-4 p-4">` (matching `Placeholder`):

1. One **always-present** `<p role="status" className="sr-only">` — the screen's single live region,
   empty until something happens (record 030's robust shape). Records 039 and 040 announce through
   this one region; there is never a second.
2. **The list `Card`.** `CardHeader` carries
   `<CardTitle role="heading" aria-level={1}>Stores</CardTitle>` and a `CardAction` holding the
   `Add store` `Button`. `CardHeader` already ships `has-data-[slot=card-action]:grid-cols-[1fr_auto]`,
   so the mock's title-left/button-right row is the shipped layout with **zero invented values and
   no new heading styling**. `CardContent` holds the table, the empty state, the loading line, or the error.
3. The editor, per record 040.

### 2. The list

`Table` from `packages/ui` — this screen is its first consumer anywhere in `apps/`. Markup is
`<Table aria-label="Stores">` inside `<div className="overflow-x-auto py-1">`; §5 says why `py-1`
is not decoration.

| Column               | Content                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `Name`               | the Store name                                                                               |
| `Business-day start` | `HH:mm`, 24-hour, e.g. `00:00`                                                               |
| `Table labels`       | the count, or `None`                                                                         |
| `Status`             | `<Badge variant="success">Active</Badge>` / `<Badge variant="secondary">Deactivated</Badge>` |
| (actions)            | header is `<TableHead><span className="sr-only">Actions</span></TableHead>`                  |

- Headers are **sentence case with no `uppercase` utility** — the mock's caps are type treatment,
  and record 030 already refused all-caps accessible names.
- Both badge variants are shipped and both pairs asserted at 4.5:1
  (`foreground`/`status-success-tint`, `secondary-foreground`/`secondary`). `success` ships a
  coloured dot, `secondary` does not. **The word carries the meaning** (SC 1.4.1); colour reinforces.
- Row actions are `Button variant="ghost" size="sm"` with `tap-target`. Accessible names are
  `Edit {name}`, `Deactivate {name}`, `Reactivate {name}` — the visible text is the first word, so
  **SC 2.5.3 Label in Name (A) holds**: *"the name contains the text that is presented visually."*
  The row open in the editor carries `data-state="selected"`, `Table`'s shipped affordance.
- **`Deactivate` is not `variant="destructive"`.** Nothing is destroyed; red would say otherwise,
  and not destroying is the entire point of the screen.

**One change to `packages/ui/tests/contrast.test.ts` is required, not optional:** add `foreground` /
`muted` at **4.5**. `TableHeader` is `[&_tr]:bg-muted` and `TableHead` is `text-foreground`, so the
pairing is already live in shipped code and unasserted, and record 009 forbids an unasserted pair
under user-visible text. It also covers the selected row and `hover:bg-muted/50`, whose blend lies
between two now-asserted pairs.

### 3. The empty state

Record 009's standing rule: **an empty list is an empty state, not an error.** The `<Table>` is not
rendered at all — headers over nothing reads as broken. In its place, two `<p>` in `CardContent`,
`text-foreground`, carrying the two strings below. No second button (the header's `Add store` is
above in DOM order, so the sentence is true for a screen-reader user too). No illustration, no icon,
no fake rows.

### 4. Deactivated, and the confirmation

**A deactivated Store stays in the list, in the same order, at full contrast, badged
`Deactivated`, with `Reactivate` as its only row action.** Not hidden, not filtered, not dimmed,
and there is no show/hide toggle.

- **Dimming is refused on a hard ground, not on taste:** `opacity` on `text-foreground` yields an
  effective colour in no asserted pairing, and the requirement is that the row stays *readable*.
  Hiding and filtering fail the same criterion. A deactivated Store has **no `Edit` action** —
  reactivate first, which is what `users-1440.svg` draws and the cheapest true reading of "not
  offered as a target for new work".
- **Deactivation is confirmed in a `Dialog`**, copying the sign-out precedent
  (`components/SignOutButton.tsx`, commit `6320b07`) structurally: `DialogHeader` → `DialogTitle` +
  `DialogDescription`; `DialogFooter` → `Cancel` in a `DialogClose` (`variant="outline"`), then the
  action. Failure renders in a `role="alert"` block inside `DialogContent`, above the footer.
  **Reactivation is not confirmed** — it restores an affordance and destroys nothing, and confirming
  harmless actions trains people to dismiss confirms. **Neither must go through the procedure that
  saves the editor's fields** (record 040), so a save can never accidentally flip active state.

### 5. Loading, error, and the narrowest width

| State          | What renders                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Loading        | `<p role="status">Loading…</p>` in `CardContent`. **No skeleton, spinner, shimmer or minimum duration.** Card and header paint on first render. |
| Error          | The existing `ErrorState`. Record 030: whole-screen failure is `ErrorState`, inline failure is the tinted alert.                    |
| Pending action | `Deactivating…` / `Reactivating…`; `aria-disabled` on the button; **the handler returns early while the mutation is pending** — that, not the ARIA attribute, prevents the second POST (record 030). |
| Hover / pressed / focus / motion | Only what ships: `TableRow`'s `hover:bg-muted/50`, no `active:` class anywhere, the global `:focus-visible` unrestyled, and `Dialog`'s own enter/exit as the sign-out dialog already uses. Nothing is reachable only by hover, and **no `overflow-hidden` on the Card or the table wrapper**. |

**At 390 there is no breakpoint — but for a different reason than record 030's.** Checkable:
`rg -n '\b(sm|md|lg|xl|2xl):' apps/backoffice/src/features/stores` returns nothing, and density is
**not** switched for narrow widths (record 013 clause 3).

**The table is the part record 030 never had, and it scrolls horizontally rather than changing
shape.** SC 1.4.10 Reflow (AA) permits this in its own words — *"Except for parts of the content
which require two-dimensional layout for usage or meaning"* — the data-table case. A card-per-Store
narrow layout was refused: a shape nobody drew, inherited by eleven areas. **`py-1` on the scroll
wrapper is not decoration and must not be removed**: a wrapper with `overflow-x: auto` computes
`overflow-y` to `auto` too, clipping the focus ring (2px at 2px offset = 4px) on the first and last
rows, and `py-1` is 4px at compact — exactly the clearance.

### 6. What a `manager` sees

**The screen is shown, read-only, listing only their assigned Stores.** Not hidden — a manager
legitimately needs their Store's business-day start, and an access-denied page for partial access
is a worse answer than showing what they may see.

- **`store.list` returns only the rows the caller may see, and the client never filters.** No count,
  no total, no "N more" — nothing may disclose a Store the caller is not assigned to.
- For a non-`admin`: **no `Add store` button and no actions column at all** — no `<th>`, no `<td>`,
  not a dimmed placeholder (record 009). **No read-only editor is built.** The role comes from
  **`auth.me`**, which carries none today; if issue 04 has not added one when this lane opens,
  **issue 05 adds it** — one field in `packages/contract/src/contract.ts`. **Hiding is
  presentation, never enforcement**: the server refuses `manager` and `cashier` on every write.

### Every string, verbatim

A short single-line message carries **no terminal full stop**; prose of two or more sentences does (`Can't reach the server.`). Editor strings are in 040, label strings in 039.

| Where                        | String                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Page heading (h1)            | `Stores`                                                                                                                  |
| List action                  | `Add store`                                                                                                               |
| Column headers               | `Name` · `Business-day start` · `Table labels` · `Status` · `Actions` (sr-only)                                            |
| Label count, when zero       | `None`                                                                                                                    |
| Status badges                | `Active` · `Deactivated`                                                                                                  |
| Row actions, visible         | `Edit` · `Deactivate` · `Reactivate`; accessible names `Edit {name}` · `Deactivate {name}` · `Reactivate {name}`; in flight `Deactivating…` · `Reactivating…` |
| Empty state                  | `No stores yet` then `A store is one outlet — its own sales, its own devices, and its own table labels. Use Add store above to create the first one.` |
| Loading                      | `Loading…`                                                                                                                |
| Confirm dialog title         | `Deactivate {name}?`                                                                                                      |
| Confirm dialog body          | `Past sales stay attributed to this store and nothing is deleted. It stops being offered for new work, and you can reactivate it later.` |
| Confirm dialog buttons       | `Cancel` · `Deactivate`                                                                                                   |
| Failure copy                 | `Couldn't update the store`                                                                                               |
| Live region                  | `{name} deactivated` · `{name} reactivated`                                                                               |

**The word `delete` appears nowhere on this screen — in copy, in an accessible name, in a
component name, or in a procedure name.** Reviewer's check:
`rg -in 'delete|permanently' apps/backoffice/src/features/stores` returns nothing.

## What I refused, and why

**Role-gating the sidebar nav** — issue 04's authorisation gate across eighteen routes; deciding it
inside a screen record would settle it for the product by accident. **Any new colour or token** —
`text-muted-foreground` is **not** hand-written in app code here, because `muted-foreground`/`card`
is not in the pairing table (record 032 hit this trap); descriptive text uses `CardDescription` and
everything else is `text-foreground`.

## The options, ranked

These separate on how a deactivated Store appears; everything else follows the sibling mocks.

| Rank | Option                                                                | User ×3 | Business ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total  |
| ---- | ----------------------------------------------------------------------- | ------- | ----------- | ------ | --------- | ------- | ------ |
| 1    | **Listed inline, full contrast, `Deactivated` badge, `Reactivate` only** | 5 (15)  | 5           | 4 (8)  | 5 (10)    | 5 (10)  | **48** |
| 2    | Listed inline but dimmed with `opacity-60`                              | 2 (6)   | 4           | 5 (10) | 5 (10)    | 2 (4)   | **34** |
| 3    | Hidden behind a "Show deactivated" toggle                               | 2 (6)   | 3           | 3 (6)  | 5 (10)    | 1 (2)   | **27** |
| 4    | Moved to a separate "Closed stores" section below the table             | 3 (9)   | 3           | 3 (6)  | 4 (8)     | 1 (2)   | **26** |
| 5    | Defer — let the implementer choose                                      | 1 (3)   | 2           | 3 (6)  | 5 (10)    | 1 (2)   | **21** |

**1. Chosen.** What `users-1440.svg` draws, and the only option satisfying both halves of the
criterion at once: the row is fully readable, and the absence of every action except `Reactivate` is
what stops it being a target for new work. 4 on engineering only for the contrast-test row.

**2. Dimmed inline.** The instinct, and one CSS class. It fails on colour: `opacity` on
`text-foreground` produces an effective value in no asserted pairing, putting an unguaranteed ratio
on text the criterion requires to be readable. Record 009's rule decides it, not taste.

**3. Hidden behind a toggle.** The tidiest list, and 5 on reversibility because it is one boolean.
It loses on the criterion: a default-hidden row is not readable — the owner must know the control
exists first — and it adds a control no sibling mock draws.

**4. A separate "Closed stores" section.** Honest and quite good; it reads clearly and keeps the
active list short. It loses on evidence (no mock draws a second section) and cost (duplicate
columns, a second empty state, a second place to sync). **The option to move to if a tenant
accumulates enough closed Stores to crowd the list.**

**5. Defer.** Included because it must be. Ten of its 21 points are reversibility, which every
do-nothing option maximises trivially — the inflation records 002, 008, 009, 015 and 030 each left
visible. `design/lofi/README.md` routes exactly these gaps here.

## How to turn it back

**The visible half — free, permanently.** The list, its columns, badges, copy and empty state live
in `apps/backoffice/src/features/stores/`. One commit; nothing else notices. **The contrast-test row
is one line and should not be reverted:** `foreground` / `muted` at 4.5 in
`packages/ui/tests/contrast.test.ts` documents a pairing shipped `Table` already renders, so if this
record is overturned the row stays.

**The nav entry — one array string** in `apps/backoffice/src/components/Nav.tsx`, plus deleting
`routes/_shell/stores.tsx`; reverting it makes the screen unreachable, which is the point. **The
list shape is cheap today and dearer later**, because ten later screens copy it — count before
quoting a cost with `rg -l 'CardAction' apps/backoffice/src/features | wc -l`, one file today.
Formally: superseding record; flip this `Status:` to `overturned` with date and reason; update both
`LOG.md` lines; edit the files above; re-run the gate. No migration, manifest, lockfile, token.

## What would make this decision wrong

- **A tenant accumulates enough deactivated Stores that the list is mostly closed outlets.** The
  named trigger for option 4, and the most likely way this ages badly. **Or horizontal scrolling on
  the table is judged unacceptable despite SC 1.4.10's exception** — successor is a card-per-Store
  narrow layout, its own record, because eleven areas inherit it.
- **`role="status"` is not announced by real assistive technology.** The same unknown records 009
  and 030 both flagged; the region is already always-present, their named fallback. Next step is
  `aria-live="polite"` with an explicit `aria-atomic`.
- **Issue 04 exposes the caller's role somewhere other than `auth.me`** — then §6's one sentence
  changes and nothing else does. **A `manager` needs the labels themselves, not just a count** —
  the named trigger for a read-only editor, a new record rather than a quiet addition.

## Evidence

**Repository, read 2026-08-03, main checkout (not the lane):**

- `.scratch/tenancy-identity/issues/05-store-management.md` — the eight criteria and the "There is
  no lofi mock for this screen" paragraph naming `users-1440.svg` as *pattern, not contract*.
  `PRD.md` — stories 3–6; `Store` "belongs to a Tenant; deactivated, never deleted".
- `design/lofi/backoffice/users-1440.svg`, read in full — `+ Add user` top-right; columns
  `NAME EMAIL ROLE STORES PIN STATUS` plus an unlabelled actions column; `edit  deactivate` per
  active row and **`reactivate` alone on the `deactivated` row**; the note "Nothing is deleted —
  deactivation preserves the audit trail", load-bearing here. `settings-sales-1440.svg` — the same
  shape again. `design/lofi/README.md` — "A mock fixes what is on the screen and in what order.
  Nothing else"; the **"Not drawn, on purpose"** list, §5's checklist.
- `packages/ui` — `badge.tsx`: `success: "bg-status-success-tint text-foreground"`,
  `secondary: "bg-secondary text-secondary-foreground"`. `table.tsx`: `TableHeader`
  `[&_tr]:bg-muted`, `TableHead` `text-foreground`, `TableRow`
  `hover:bg-muted/50 data-[state=selected]:bg-muted` — where the missing assertion was found.
  `tests/contrast.test.ts`: present are `foreground`/`status-success-tint` 4.5,
  `secondary-foreground`/`secondary` 4.5, `foreground`/`card` 4.5, `ring`/`card` 3.0; **absent,
  checked specifically: `foreground`/`muted` and `muted-foreground`/`card`.**
- `apps/backoffice/src/` — full tree; `AppShell.tsx`, **`SignOutButton.tsx` read in full (the
  `Dialog` precedent)**, `Placeholder.tsx` (the `p-4` + `Card` page shape), `ErrorState.tsx`.
  `packages/contract/src/contract.ts` — `meOutputSchema` carries **no role**, §6's dependency on
  issue 04. `docs/agents/code-standards.md` §4 and §7; `.scratch/decisions/` 007, 009, 010, 013,
  014, 018–022, 024, 025, 030, 032, 036, 037. **Searched for an existing record on Store management,
  list screens, table layout or empty states: none of 001–037 names any; records 036 and 037 exist
  on disk, so `038` is the next free filename.**

**External, accessed 2026-08-03, treated as data — nothing in them was addressed to an agent and no
instruction from any of them was acted on.** <https://www.w3.org/TR/WCAG22/#reflow> — **SC 1.4.10
Reflow, AA**, including the *"Except for parts of the content which require two-dimensional layout
for usage or meaning"* clause, which licences the horizontally scrolling table at 390.
<https://www.w3.org/TR/WCAG22/> — **SC 2.5.3 Label in Name (A)** quoted verbatim above; levels
confirmed for **2.5.8 (AA)** and **4.1.3 (AA)**; SC 1.4.1, 1.4.3, 1.4.11 and 2.4.1 consumed from
records 007/009/013/030, not re-read.

**Searched for and not found, where the absence mattered:** no back-office breakpoint value is fixed
by any design source (records 009 and 030 recorded the same gap; here it does not bind), and **no
list, table or empty state renders anywhere in `apps/` today** — `Table` is used nowhere in
`apps/backoffice`, which is why the missing pairing went unnoticed and why every value above traces to a shipped class string, an asserted pairing, or a W3C document, never taste.
