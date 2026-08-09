# 067: Availability toggles stage a draft and one Save commits them together — and the screen makes unsaved work impossible to walk away from quietly

- **Status:** decided
- **Stakes:** high — it fires record 054 Q3's own escape clause, and the save shape is a contract later screens copy
- **Date:** 2026-08-04
- **Amended:** 2026-08-04 — §6 replaced; `## Direction` prohibition 5 overridden for this screen. See Amendments.
- **Asked by:** the human, at the `## Direction` checkpoint on `.scratch/catalog/PRD.md` ("Collisions to route, not resolve here", first bullet)
- **Relates to:** [054](054-payment-method-availability-and-its-audit.md) §Q3 (the refusal this is the named successor to); [040](040-the-store-editor.md); [038](038-the-store-management-screen.md); [077](077-availability-covers-menu-items-and-variants.md); 009, 013, 030, 041, 045, 055

## Amendments

**Amendment 1 — 2026-08-04, the human, relayed by the orchestrator.** `## Direction` prohibition 5
(*"No `toast()` on a catalog save"*) is overridden **for this screen's page-level Save only**. §6 is
replaced by a pointer to **[068](068-the-availability-save-announces-through-a-toast.md)**, which
carries the decision in full and **holds the exact text the orchestrator must append to the PRD**.
§1–§5, the ranking and the reversal costs are unchanged. It is a separate record because this one
ran to 366 lines with the reasoning inside it, against a 300-line cap — the standing signal that a
record is answering two questions. Until the PRD append lands, the PRD and these records disagree
and a reviewer is right to flag it as blocking.

## The question

`design/lofi/backoffice/availability-1440.svg` draws an `[ ON | OFF ]` control in every row. Record
054 §Q3 refused exactly that control and ranked this staged variant **third of four (28/50)**. The
human has chosen the staged variant. This record settles the six things that opens: the unsaved-work
hazard, the control, the procedure's input shape, `Mark all available`, what a Store change does to
a draft, and how a save is announced. A wrong answer costs a manager mid-service believing "Munggo
is off" when the till still sells it — or a per-tap write that leaves half a service's availability
set when a phone drops signal.

**This is a triggered escape hatch, not an overrule of 054**, whose runner-up analysis names inline
switches *"the option to move to if admins toggle far more often than they rename or add"* and two
conditions: *"the successor needs an idempotent per-pair procedure and its own record."* This is
that record and §3 is that procedure. Of 054's two reasons, **audit atomicity does not transfer**
(catalog availability writes no audit rows, so no uncorrectable artefact exists) while
**one-form-one-Save and the dirty-cell hazard both do** — and §1 pays for the hazard.

### Weights, declared before any option was scored

**User ×3** (a manager mid-service, no support line; the lost-work hazard is a *user* harm) ·
**Business ×1** (a dish shown available that is not is a promise broken at the counter) · **Eng
×2** · **Reversibility ×2** (the screen is free forever; the input shape is a contract) ·
**Evidence ×2**. Max 50. **Not changed after scoring.**

## What I chose, and why

**A tick-box in every row changes nothing on the server. It changes a draft held in the page. One
`Save` at the bottom of the card sends every changed `(variant, store)` pair in one transaction,
and the screen then states the catalog version it just produced.**

The reason to accept the hazard 054 named is that this screen exists to be the fast path — story
34, *"mark it available again in one tap"*. The reason it is safe to accept is that the hazard is
answerable with three cheap, shipped things: a Save bar that **only exists while there is unsaved
work**, rows that **mark themselves as changed**, and a **guard on leaving the screen**. Record 040
refused a discard prompt on a `Sheet`, where closing the sheet bounded the dirty state; this is a
full page whose twenty-two-link sidebar is always one click away, so the containment 040 relied on
is absent and its refusal does not reach here.

**SC 3.3.4 Error Prevention (Legal, Financial, Data), AA**, is engaged on its own terms — this
*"modif[ies] … user-controlled data in data storage systems"* — and met by condition 3, *"a
mechanism is available for reviewing, confirming, and correcting information before the final
submission"*: the marked rows are the review, the Save is the confirmation.

**No new dependency, component, token or colour** — every value below is a shipped class, an
asserted pairing, an already-installed API, or a string.

### 1. The unsaved-work hazard

1. **The Save bar is a `CardFooter` rendered only when the draft is non-empty**, never otherwise
   (009's "render nothing where nothing is true"; 040's refusal of an empty reserved box).
   **Its presence is the primary signal** — no state exists in which the screen looks idle while
   holding changes.
2. It is **`sticky bottom-0` with `bg-card`**, on screen at every scroll position — the direct
   answer to 054's sentence, in two utility classes. It sits **outside** the `overflow-x-auto py-1`
   table wrapper, so 038 §5's focus-ring clearance is untouched.
3. It reads the count, then the button: `{n} unsaved change` / `{n} unsaved changes`, then
   `Save changes` → `Saving…`. **No `Discard` button** — toggling back already undoes a change, and
   a discard control is a second destructive path nobody drew.
4. **A changed row marks itself twice, so colour is never the only signal (SC 1.4.1):**
   `data-state="selected"` on the `TableRow` (`Table`'s shipped affordance; `foreground`/`muted`
   asserted at 4.5 by 038) **and** the word `Unsaved` in the availability cell.
5. **Leaving the route while the draft is non-empty is blocked** by
   `useBlocker({ shouldBlockFn: () => draft.size > 0, withResolver: true })` from
   `@tanstack/react-router`, returning `{ proceed, reset, status }`, driving the shipped `Dialog` —
   038's `SignOutButton` structure, 041's copy rule. **`enableBeforeUnload` is bound to the same
   predicate**, covering tab-close and reload with one option rather than a hand-rolled listener.
   That is not the `beforeunload` handler 040 would have refused: it is one argument on a hook
   already needed for the case that actually matters, the sidebar.
6. **Paging and searching do not navigate** (both are React state, not URL state), so the guard
   never fires spuriously. **Changing the Store does navigate**, on purpose; see §5.

### 2. The control

`packages/ui` exports **no `Switch` and no `Checkbox`** (confirmed against `index.ts`). Rung 4:

- **A native `<input type="checkbox">`**, `className="size-4 accent-primary"`, inside a
  `<label className="tap-target …">` — `AvailabilityField.tsx` and `StoresField.tsx` verbatim.
- **`aria-label={`${variantName} at ${storeName}`}`** — e.g. `Adobo at Malabon`. The name states
  **which item and which store**, exactly as 054 §Q3 conceded a switch could (*"a name like
  `GCash at Malabon`"*).
- **No `role="switch"`.** It exists nowhere in the repository, and it would announce `on`/`off` for
  a value that has not been written yet — a tick-box awaiting a Save is honestly a checkbox.
  Refused on semantics, not on cost.
- The mock's `On`/`Off` word is kept as a **`<span aria-hidden="true">`** beside the box: `checked`
  already exposes that fact, so announcing it twice is noise, and hiding it leaves the accessible
  name free to be the item and the store (SC 2.5.3 is not engaged by a state indicator).
- No per-cell pending or error state exists, because no cell makes a request.

### 3. The procedure

**Input is the set of changed pairs with their target state — never a diff the server reconstructs,
and never the whole visible page:**

```
availability.set({ storeId, changes: [{ variantId, available: boolean }, …] })
```

- **Idempotent per pair, which is 054's condition.** `available` is an **absolute target**, not a
  flip, so re-sending an identical payload changes nothing and returns the same version — and that
  holds under either join polarity.
- **`changes` carries only pairs the manager actually touched.** Sending every visible row would
  let a stale page overwrite a colleague's concurrent change to a row this manager never looked at.
  **This is the no-go an implementer must not get wrong.**
- **Stale view: last writer wins per pair; the procedure is not conditioned on the client's
  before-state and there is no version check on the input.** A pair not in the payload is not
  written. Optimistic concurrency has no caller yet (scenario 2) and is not settled here.
- **One transaction. Every changed pair moves or none does** — 040 §3, and the half of 054 that
  does transfer.
- **`storeId` is authorised, not merely validated** (PRD security criterion 4). A refusal fails the
  whole save, **writes nothing and keeps the draft**, so the work is not lost by the refusal.
- The response **returns the new catalog version**, which §6 renders — an availability write is a
  catalog write and moves the version, which the PRD asserts as its own test.
- **Not decided here, deliberately:** the join's polarity (a row meaning available, as 054 chose
  for payment methods, versus a row meaning sold-out) and what a new Store or Variant defaults to
  (PRD scenario 17). The input shape above is correct under either, which is why it can be fixed
  now. **That is a schema question and goes back to the orchestrator as its own record.**

### 4. `Mark all available`

- **It stages. It never writes.** Nothing reaches the server except through `Save changes`.
- **Its scope is every row the current search matches, across every page** — not the current page.
  With an empty search that is the whole store, the morning case story 34 names; with a search typed
  it is what the manager is looking at. A page-scoped version would do a tenth of what its label says.
- It stages **only rows that are currently unavailable**, so the Save bar's count stays truthful.
- **No confirmation dialog** (staging is reversible, and the Save is already SC 3.3.4's confirmation)
  and **never disabled** (030): tapping it when nothing changes stages nothing and announces
  `Everything is already available at {store}`.
- Visible label is the mock's `Mark all available`; accessible name `Mark all available at {store}`
  contains it (SC 2.5.3). **`Mark all unavailable` is not built** — nobody drew it (009).

### 5. Changing the Store

**The selected Store is a route search param — `/availability?store={id}` — so changing the
`<Select>` is a navigation, and §1 clause 5's guard already covers it.** One mechanism answers three
things: the draft can never be silently dropped by a Store change (the case most likely to lose
work), the screen becomes linkable, and PRD scenario 8 — *a tab left open on the wrong Store* —
stops being invisible.

**A draft never spans two Stores** — the dialog's outcomes are proceed (draft discarded, new Store
loads) or reset (stay, draft intact), and there is no third state. The `<Select>` lists **only the
Stores the caller may act on**, from the server, and the client never filters (038 §6, 044 §2
clause 3); if an assignment is revoked mid-session (scenario 20), §3 refuses and keeps the draft.

### 6. Announcement on save — replaced by Amendment 1

**A success `toast()` fires when the save resolves, and it is the only channel that announces it.**
Sonner's own container is an `aria-live` region, so **nothing is written into 038's two
`role="status"` regions on save** (they keep §4's staging announcements), and **the visible
`CardFooter` line stays plain static text — no `role="status"`, no `aria-live`, no `aria-atomic`**.
**Prohibition 10 is not overridden:** the toast body and that line carry the same string constant,
because a toast dismisses on a timer and the version has to stay on the screen. **N: no
`toast.error`** — failure stays inline (030).

The reasoning, the pending-toast decision, the failure asymmetry, why this authorises exactly one
screen, and the PRD text the orchestrator must append are all in
**[068](068-the-availability-save-announces-through-a-toast.md)**, which this section defers to and
does not restate.

### Every string, verbatim

Short messages carry **no terminal full stop**; prose of two or more sentences does. Anything not
listed — the `Availability` h1, the `Store` select label, the `Search variants` field — transfers
from 038/040/054 by substituting "variant" for "store".

| Where | String |
| --- | --- |
| Page description | `What this store can sell right now. Turning something off here stops the till offering it, at this store only.` |
| Column headers | `Variant` · `Menu item` · `Price` · `Available at {store}` |
| Toolbar action | `Mark all available`; accessible name `Mark all available at {store}` |
| Row control | accessible name `{variant} at {store}`; visible, `aria-hidden` `On` / `Off` |
| Changed row | `Unsaved` |
| Save bar | `{n} unsaved change` / `{n} unsaved changes`; `Save changes` → `Saving…` |
| **Success toast, and the `CardFooter` line — one constant, both places** | `Saved — catalog version {version}` |
| Save failure, inline `role="alert"`, **never a toast** | `Couldn't save availability` |
| Live regions (§4 only) | `{n} changes ready to save` · `Everything is already available at {store}` |
| Leave dialog | title `Leave without saving?`; body `{n} changes have not been saved. Leaving this screen discards them, and nothing at the till changes.`; buttons `Stay` · `Leave without saving` |
| Empty state | `Nothing to sell yet` then `Availability follows the catalog. Add a menu item with at least one variant, and it appears here.` |

The version's format is the read model's and is **not** invented here — the screen prints whatever the procedure returns.

## The options, ranked

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Inline tick-box staging a draft, one page-level Save (the human's choice)** | 4 (12) | 4 | 3 (6) | 3 (6) | 4 (8) | **36** |
| 2 | Availability edited in a `SheetForm`, 054's shape copied wholesale | 2 (6) | 3 | 5 (10) | 5 (10) | 3 (6) | **35** |
| 3 | Inline switch writing on tap (the mock, literally) | 5 (15) | 3 | 2 (4) | 2 (4) | 4 (8) | **34** |
| 4 | Defer | 1 (3) | 2 | 3 (6) | 5 (10) | 1 (2) | **23** |

**The top three are within two points and I will not pretend otherwise.** The scoring does not
separate them; the human's call does, and it lands on the highest anyway.

**1. Chosen.** Wins on evidence and business: the control is drawn, and 054 pre-authorised this
successor by name and conditions, both of which §3 meets. It concedes the user point to option 3
honestly — a Save step is a Save step — and buys back atomicity, no per-cell pending state, and one
version bump per save instead of one per tap. Reversibility 3 because §3's input shape is a contract.

**2. 054's shape copied wholesale.** Cheapest by a distance and unbeatable on reversal —
`AvailabilityField.tsx` already exists. It loses on the only axis this screen exists for: "open the
item, find the store, untick, save" is exactly the interaction the `Availability` leaf was routed to
avoid. **The option to move to**, and *cheaper later than now* — §3's procedure serves it unchanged.

**3. Write on tap.** The best interaction here and the mock's literal reading: nothing is ever
unsaved, so §1 evaporates. It loses on what a counter actually is — a phone on a flaky connection —
where twelve taps are twelve independent writes with twelve failure points, each needing a per-cell
pending and error state, and each moving the catalog version. **The option to move to** if managers
report the Save step as friction and the connection proves reliable.

**4. Defer.** Moot — the human has decided — and included because the process requires it. Ten of its 23 points are reversibility, the inflation records 002 onward left visible.

## How to turn it back

| What | Cost |
| --- | --- |
| Every string, the `Unsaved` marker, the sticky class, `Mark all`'s scope, the empty state | One commit under `apps/backoffice/src/features/availability/`. Free, permanently. |
| **The toast (§6, Amendment 1)** | Delete one `toast()` call; move the same constant back into 038's live region. One file, and the PRD amendment above is withdrawn with it. **Free — this is the cheapest thing in the record to reverse.** |
| The leave guard (§1 clause 5) · the Store as a search param (§5) | The guard: delete one `useBlocker` call and one dialog component; nothing else reads them. The search param: one route file plus the `<Select>`'s handler — **but the guard's coverage of the Store change goes with it**, so reverting it without a replacement re-opens the silent-loss case. |
| → option 2, the sheet · → option 3, write on tap | Option 2: the draft is already keyed by `(variantId, storeId)`, so the control swaps in one file and **§3's procedure is unchanged**. Option 3: the UI is one file; the expensive half is the contract, where `changes` collapses to a single pair and every cell gains a pending and an error state. |
| **§3's input shape** | The contract entry, the handler, and every later screen that copied it. **Count first: `rg -n 'availability\.' apps packages \| wc -l` — zero today.** No `catalog.*` or `availability` procedure and no `Variant` model exists, so this record is written entirely ahead of its code and every number here is measured against zero. That is the cheapest this reversal will ever be. |

Formally: superseding record; flip `Status:` to `overturned`; update both `LOG.md` lines; edit the
files above; re-run the gate. No migration, no stored-data change.

## What should make you reverse this

- **A manager reports losing toggles.** The named failure of this shape, and 040's own revisit
  trigger on a different screen. If §1's defences did not catch it, the successor is option 3.
- **A manager reports the Save step as friction mid-service.** Option 3's trigger, and the most
  likely way this ages badly.
- **A screen-reader user hears the save result twice, or not at all** — 068's triggers, not this
  record's; §6 is one file either way.
- **The sticky Save bar occludes a focused row's control at the bottom of the viewport.** The value
  I am least confident about — nothing in `apps/` renders a sticky element over a scrolling table.
  **Fallback pre-decided:** drop `sticky bottom-0`. One class; everything else in §1 holds.
- **`Mark all available` stages two hundred changes and the save times out.** Then §4's scope is
  right and the *transport* is wrong: chunk inside one server transaction, do not shrink the button.
- **The polarity question (§3, last clause) is answered as "a row means available".** A new Store
  then sells nothing until someone visits this screen — 054's named cost, which is fail-safe for a
  tender and the *unsafe* direction for a menu.
## Evidence

**Repository, read 2026-08-04, main checkout:**

- `.scratch/catalog/PRD.md` — the first routed collision (quoted above), prohibitions 5 and 10,
  stories 31–34, security criteria 3 and 4, scenarios 7/8/17/20, the version rule.
- `design/lofi/backoffice/availability-1440.svg`, read in full — Store `<Select>`, `Search
  variants…`, `Mark all available` top-right, columns `VARIANT · MENU ITEM · PRICE · AVAILABLE AT
  MALABON`, `[ ON ]`/`[ OFF ] ← sold out` cells, both footnotes.
- `054` §Q3 (the refusal, the 28/50 ranking, the escape clause), `040` §3 and its refusals section,
  `038` §1/§2/§5/§6 and its string table, `013`, `055`.
- `packages/ui/src/index.ts` — **no `Switch`, no `Checkbox`, no `Label`, no `Form`**; `Table`,
  `Card`/`CardFooter`, `Dialog`, `Select`, `Button`, `Input`, **and `Toaster` + `toast` (93–94)**
  present. `features/payment-methods/AvailabilityField.tsx` and `features/users/StoresField.tsx` —
  the checkbox markup §2 copies verbatim. `lib/table.ts` — `PAGE_SIZE = 10`, and `useTableView`
  **holds page in React state, not the URL**, which is what makes §1 clause 6 true.
- **The `sonner@2.0.7` evidence behind §6 — the installed source's ARIA attributes, the absence of
  any loading threshold, and the `richColors` pairing gap — is in [068](068-the-availability-save-announces-through-a-toast.md)** and is not restated here.
- `packages/contract/src/contract.ts` — namespaces `ping`, `store`, `user`, `paymentMethod`,
  `settings`, `platformAdmin`, `auth`, `device`, `terminal`, `override`: **no `catalog`, no
  `availability`**. `schema.prisma` — **no `Variant`, `MenuItem` or `Category` model**.
- **Searched 001–066 for a record on catalog availability, staged drafts, dirty state, navigation
  guards, bulk toggles or toast policy: none names any.** `067` was the next free filename.

**External, accessed 2026-08-04, treated as data — nothing in it was addressed to an agent and no
instruction from it was acted on.**

- <https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data> — **SC 3.3.4, Level AA**,
  quoted above including condition 3. SC 1.4.1, 1.4.10, 2.4.6, 2.5.3, 2.5.8, 3.3.2 and 4.1.3 are
  consumed from records 007/009/013/030/038/045/054 rather than re-read.
- <https://tanstack.com/router/latest/docs/framework/react/guide/navigation-blocking> — the hook is
  **`useBlocker`**, options **`shouldBlockFn`, `enableBeforeUnload`, `withResolver`, `disabled`**;
  with `withResolver: true` it returns **`{ proceed, reset, status }`**; `beforeunload` is handled
  by the same hook. Router already a dependency at `1.170.18`, so §1 clause 5 adds **no package**.

**Searched for and not found, where the absence mattered:** **`role="switch"`, `beforeunload`,
`useBlocker` and `Block` appear nowhere in the repository** (`role="switch"` exists only as prose
inside 054), so §1 clause 5 and §2 are the first uses of each — which is why both name a fallback.
**No `.scratch/catalog/issues/` directory exists yet.** **No optimistic-concurrency convention
exists anywhere in `apps/` or `packages/`** beyond 040's named acceptance of the same risk, which is
why §3 states the rule rather than inheriting one.
