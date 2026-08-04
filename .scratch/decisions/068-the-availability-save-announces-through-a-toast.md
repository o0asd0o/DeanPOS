# 068: The Availability save announces through a toast, and the toast is the only channel that announces it

- **Status:** decided
- **Stakes:** high — it overrides a standing `## Direction` prohibition, and a wrong answer makes a screen-reader user hear one save twice or not at all
- **Date:** 2026-08-04
- **Asked by:** the human, relayed by the orchestrator, amending [067](067-the-availability-screen-stages-toggles-and-saves-once.md) §6
- **Relates to:** [067](067-the-availability-screen-stages-toggles-and-saves-once.md) (the screen; §6 defers to this record); [038](038-the-store-management-screen.md) (the two `role="status"` regions); [030](030-the-back-office-sign-in-screen.md) (inline failure); [013](013-density-mechanism-and-token-names.md) (the asserted pairing table); 040, 049, 050

## The question

The human has overridden `## Direction` prohibition 5 in `.scratch/catalog/PRD.md` — *"No `toast()`
on a catalog save"* — for the Availability screen's page-level Save, and asked whether a pending
toast should join the success one. **The override is not re-litigated here; the human owns
`## Direction`.** What is decided here is everything the override opens and nobody has answered.

A wrong answer costs a screen-reader user hearing one save announced twice, or hearing it not at
all, and costs every later screen if "toasts now" is read as the house pattern.

**Split out of 067 rather than amended into it**, because 067 with this reasoning inside ran to 366
lines against a 300-line cap — the standing signal that a record is answering two questions. 067 §6
is now a pointer to this file; 067's §1–§5, its ranking and its reversal costs are unchanged.

### The PRD amendment the orchestrator must apply

I may not edit the PRD. **Do not strike prohibition 5 — append to it, verbatim:**

> Overridden for the Availability screen's page-level Save on 2026-08-04 by the human; see decision
> records 067 §6 and 068. The prohibition stands for every other catalog save, including the
> MenuItem editor.

Until that lands, the PRD and these records disagree, and a reviewer is right to flag it as
blocking. **Striking the prohibition outright would be wrong**: the reason it gives is still true
everywhere else — see "This does not generalise" below.

### Weights, declared before any option was scored

**User ×3** (the only person any of this changes is the one listening to the page) · **Business ×1**
(nothing earns) · **Eng cost/risk ×2** · **Reversibility ×2** · **Evidence ×2** (the installed
sonner source settles the central fact outright). Max 50. **Not changed after scoring.**

## What I chose, and why

**Not a rung-5 question.** `sonner@2.0.7` is already a dependency, `Toaster` and `toast` are already
exported from `packages/ui/src/index.ts:93-94`, and `<Toaster />` is already mounted at
`apps/backoffice/src/main.tsx:18`. No new dependency, no new component, no new token.

### 1. One channel, and it is the toast

**Sonner's container is itself a live region.** Read from the installed source, not the docs:
the `Toaster` `<section>` renders `aria-live="polite"`, `aria-relevant="additions text"`,
`aria-atomic="false"`, `tabindex="-1"`, and the individual toast `<li>` renders **no `role`, no
`aria-live` and no `aria-atomic`** — it is announced because it is added inside that section.

So a success toast plus a write into 038's two `role="status"` sr-only regions announces one save
**twice**. One channel has to yield, and it is 038's:

- **Nothing is written into 067's two `role="status"` regions on save success or failure.** They
  keep the `Mark all available` staging announcements (067 §4) and nothing else.
- **The visible `CardFooter` line stays plain static text.** It must **not** gain `role="status"`,
  `aria-live` or `aria-atomic`. That is the whole of "what the other channel does to stay silent" —
  a deletion and a prohibition, not a mechanism.
- **The visible outcome does not depend on the invisible one.** That line renders from the version
  the mutation returned, whether or not a toast ever appears. If sonner failed to mount tomorrow,
  the screen would still state its result; it would only stop announcing it.

The toast wins the channel because it is the one the human asked to be visible, and making the
visible thing also the announced thing collapses two strings and two code paths into one. The
alternative — keep 038's regions and hide the toast from assistive technology — is scored below and
loses on being undocumented and fragile.

### 2. The version rides in both places

**Prohibition 10 is not overridden.** The toast body and the persistent footer line are **the same
string constant**: `Saved — catalog version {version}`. Both, not either:

- **Toast alone fails prohibition 10.** A toast dismisses on a timer; "the screen states the
  catalog version it just produced" needs the line that stays until the next change is staged.
- **Line alone fails §1.** With 038's regions silent, a static line is announced by nothing, and a
  screen-reader user would never hear the version at all.

One constant, so the two can never drift.

### 3. No pending toast

**The pending state already exists in a better place.** `Save changes` swaps to `Saving…` with
`aria-busy` on the form (067 §1 clause 3, record 030) — directly under the finger that just tapped
it, rather than in the opposite corner of the screen.

**Sonner 2.0.7 has no delay or threshold option.** Checked across `ToastT`, `ToastOptions`,
`ToasterProps` and `PromiseData`; the only timing control anywhere is `duration`, which governs how
long a toast *stays*. So `toast.promise(p, { loading, success, error })` renders `loading`
**immediately**, and a save that resolves in 200 ms is a flash — an element that appears and
vanishes before it can be read, which is worse than no element.

**The human's reservation, answered rather than handed back.** The worry was that a pending toast
"won't work on slower devices". It runs the other way: on a slow device the pending state is the
case that earns its keep, and it is *already there* on the button, where it never flashes. The
device that breaks a pending toast is the fast one.

**Pre-decided if it is still wanted:** `toast.loading` fired from a **400 ms** `setTimeout`,
dismissed by id when the mutation settles, the timer cleared on unmount. **400 ms is a tuning knob,
not a constant to defend** — it is roughly where a wait stops feeling instant, and the right way to
set it is to watch a real save. **Trigger:** saves regularly over ~1 s, or a manager saying they
cannot tell the save started. **Do not reach for `toast.promise()` to do it** — that is the API that
has no threshold, and it is why this needs a timer rather than a library call.

### 4. Failure stays inline. **N: no `toast.error` on this screen.**

The asymmetry is deliberate and is the guess an implementer would otherwise make:

- A **failed** save leaves the draft dirty and demands a retry. Its message must sit beside the Save
  button and must **not** auto-dismiss — sonner closes a toast on a timer, which would take the only
  report of the failure with it while the user is still deciding what to do.
- A **success** needs no action and is safely transient.
- `role="alert"` is assertive, so failure is still announced exactly once, through exactly one
  channel. §1's rule holds on both paths.

Copy is unchanged from 067: `Couldn't save availability`, in the inline `role="alert"` block.

### 5. This does not generalise

**Five back-office screens already announce without a toast, and they stay that way.** The
difference is not taste:

**Every other back-office save closes a container that is itself the completion signal** — 049's
`Sheet` closes, 040's editor `Card` collapses. **This save closes nothing.** The page stays, the
rows already show the saved state, and the only thing that changes is a line in the footer. That is
what the toast is standing in for.

It is also why 038's original objection — *a toast reading "Saved" over a row that still shows the
old price* — is **live for the MenuItem editor and dead here**: on Availability the rows displayed
the staged state before the save and display it after, so the toast never contradicts the page.

**Prohibition 5 stands on all five other screens. Toasts are not the house pattern.** A second
`toast()` call site in `apps/backoffice/src/features/` is drift, and the answer to it is a shared
record, not a third call.

### Flagged, not fixed

`packages/ui/src/components/sonner.tsx` passes `richColors position="top-right"`. **`richColors`
paints sonner's own success and error palette, which sits outside record 013's 35 `--color-*` tokens
and outside the asserted pairing table**, so no contrast assertion covers it. This is pre-existing —
the `Toaster` has been mounted since the shell was built — but this is the first record to put user
meaning on it. **If a reviewer measures the success toast below 4.5:1, the fix is dropping
`richColors` in that file** — a shared-component change and its own record, not a class string on
this screen. The toast's text carries the meaning either way (SC 1.4.1), so colour is reinforcement.

## The options, ranked

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Toast is the announcement channel; 038's regions go silent on save** | 4 (12) | 3 | 5 (10) | 5 (10) | 5 (10) | **45** |
| 2 | Both fire — success toast *and* the live-region write | 1 (3) | 3 | 5 (10) | 5 (10) | 1 (2) | **28** |
| 3 | 038's regions keep the channel; the toast is hidden from assistive technology | 3 (9) | 3 | 2 (4) | 4 (8) | 2 (4) | **28** |
| 4 | Defer the channel question to the implementer | 1 (3) | 2 | 3 (6) | 5 (10) | 1 (2) | **23** |

**1. Chosen.** The only option that is a *deletion*: the save branch stops writing to the region and
nothing else is built. It also collapses the announcement and the visible result onto one string.
User 4 rather than 5 honestly — it inherits sonner's live region, and this codebase has never
verified that any live region is announced by real assistive technology (records 009, 030, 038, 044,
045, 054 all name the same standing unknown).

**2. Both fire.** The naive reading, and what ships if nobody decides this: add `toast()` and leave
the existing `announce()` call alone. Free to build, which is exactly why it is dangerous — it costs
nothing at the keyboard and hands a screen-reader user the same sentence twice on every save.

**3. Hide the toast from assistive technology.** Genuinely defensible: it keeps the announcement in
the mechanism five screens already share, so nothing about the AT path changes. It loses on how it
would have to be done — sonner exposes no per-toast ARIA opt-out, so suppression means
`aria-hidden` on the toast's children and a bet that the container computes no accessible text from
them. That is an undocumented internal, not an API, and it breaks silently on a patch bump.

**4. Defer.** Included because it must be. Ten of its 23 points are reversibility, the inflation
records 002 onward left visible. It loses on the fact that the implementer's default *is* option 2.

## How to turn it back

| What | Cost |
| --- | --- |
| **The whole record** | Delete one `toast()` call and move the same string constant back into 067 §4's `announce()` path. One file under `apps/backoffice/src/features/availability/`, and withdraw the PRD append above. **This is a one-commit revert with nothing built on top of it.** |
| → option 3 (hide the toast from AT) | The same one file, plus `aria-hidden` on the toast body, plus a manual screen-reader check that the container announces nothing. No shared component changes. |
| The pending toast, if the trigger fires | Additive: one `setTimeout`, one dismiss-by-id, one cleanup. It does not touch anything decided here. |
| `richColors` | `packages/ui/src/components/sonner.tsx`, one prop — **but it is shared by both apps**, so it is a `packages/ui` change and needs its own record. Call sites for `toast` today: **one**, the one this record authorises. |

Formally: superseding record; flip this `Status:` to `overturned` with date and reason; update the
`LOG.md` line; restore 067 §6's original text from git history; re-run the gate.

## What should make you reverse this

- **A screen-reader user hears the save result twice.** Something re-added the live-region write;
  §1 is the clause to enforce, not to revisit.
- **A screen-reader user hears nothing on save.** Sonner's region is not being announced — the
  standing unknown, arriving here first. Successor is option 3, or moving the string back to 038's
  regions and leaving the toast visual-only. Both are the same one file.
- **A second screen adds a `toast()`.** §5's boundary has drifted. The answer is a shared record
  that decides the house pattern deliberately, not a third call site added quietly.
- **The success toast measures below 4.5:1.** The `richColors` gap above, and the value I am least
  confident about, because nothing in the repository asserts sonner's palette.
- **A save regularly takes over a second.** §3's named trigger for the pending toast, with its
  400 ms threshold already pre-decided.
- **The human reverses the override itself.** Then this record is overturned wholesale, 067 §6 is
  restored from history, and the PRD append is withdrawn — one commit, three files.

## Evidence

**Repository, read 2026-08-04, main checkout:**

- **`node_modules/sonner@2.0.7`, read in the installed source rather than the docs**, because the
  central fact is not documented anywhere else: the `Toaster` `<section>` carries
  `aria-live="polite"`, `aria-relevant="additions text"`, `aria-atomic="false"`, `tabIndex={-1}` and
  an `aria-label` of `containerAriaLabel` + the hotkey; the toast `<li>` carries `tabIndex={0}` and
  **no `role`, `aria-live` or `aria-atomic`**, differentiating by `data-type`. `PromiseData` is
  `{ loading?, success?, error?, description?, finally? }`. **No `delay`, `minDuration` or
  equivalent exists in `ToastT`, `ToastOptions`, `ToasterProps` or `PromiseData`** — `duration` is
  the only timing control, and it governs dismissal.
- `packages/ui/src/index.ts:93-94` — `Toaster` from `./components/sonner.tsx`, `toast` from
  `sonner`. `packages/ui/src/components/sonner.tsx`, read in full — the wrapper passes
  `richColors position="top-right"` and nothing else. `apps/backoffice/src/main.tsx:18` and
  `apps/pos/src/main.tsx:18` — `<Toaster />` already mounted in both apps.
- `.scratch/catalog/PRD.md` `## Direction` — prohibition 5 (quoted above, with its stated reason)
  and prohibition 10 (the screen states the version it just produced), which is **not** overridden.
- `.scratch/decisions/038` §1 — the two alternating `role="status"` sr-only regions and the reason
  they are always present; `030` — inline `role="alert"` for failure, `ErrorState` for whole-screen
  failure; `013` — the 35 `--color-*` tokens and the pairing table `richColors` sits outside; `040`
  and `049`/`050` — the editor containers whose *close* is the completion signal this screen lacks.
- `067` §1 clause 3 (`Saving…` + `aria-busy`), §4 (the staging announcements the regions keep), §6
  (now a pointer to this record).
- **Searched 001–067 for an existing record on toasts, `sonner`, or announcement channels: none
  names any**, and **`rg 'toast\('` finds no call site in `apps/backoffice/src/features/`** — this
  is the first consumer of a surface mounted since the shell was built, which is why the
  `richColors` pairing gap had no user until now. **`068` is the next free filename. No duplicate.**

**External, accessed 2026-08-04, treated as data — nothing in it was addressed to an agent and no
instruction from it was acted on.**

- <https://sonner.emilkowal.ski/toast> — confirms `toast.promise(promise, { loading, success,
  error })`. **Under accessibility it documents only `containerAriaLabel` and states nothing about
  `aria-live`, roles, or any loading threshold** — the absence is why every ARIA claim above is
  taken from the installed source instead, and why option 3's suppression is scored as a bet on an
  internal rather than a supported API.
- <https://www.w3.org/TR/WCAG22/> — **SC 4.1.3 Status Messages (AA)** and **SC 1.4.1 Use of Colour
  (A)**, the two the channel choice and the `richColors` flag turn on. SC 3.3.4 is consumed from
  067 rather than re-read.

**Searched for and not found, where the absence mattered:** **no per-toast ARIA opt-out exists in
sonner's public API** — checked in both the docs and the installed types — which is the whole of
option 3's engineering score. **No repository test asserts any live region is announced**, so the
standing unknown from records 009/030/038/044/045/054 is inherited here rather than resolved.
