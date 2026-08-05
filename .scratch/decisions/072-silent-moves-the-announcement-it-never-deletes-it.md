# 072: `meta: { silent: true }` moves a mutation's announcement to another channel — it never deletes one

- **Status:** decided
- **Stakes:** high — it amends a project-wide code standard, and the failure mode it governs is a user being told nothing when a save fails
- **Date:** 2026-08-05
- **Asked by:** code review on catalog issue 03 (Options), flagged as a possible rule 10 breach
- **Relates to:** [068](068-the-availability-save-announces-through-a-toast.md) §1 (one outcome, one channel — the mechanism this record generalises); [038](038-the-store-management-screen.md) (the `role="status"` region); [030](030-the-back-office-sign-in-screen.md) (inline `role="alert"` for failure); [067](067-the-availability-screen-stages-toggles-and-saves-once.md)

## The question

`packages/ui/src/lib/query-client.ts` added `meta: { silent: true }` so the Options screen could
announce through an invisible live region instead of a toast. Code standard rule 10 says of mutation
toasts that "there is **no opt-out** — silence is the defect this exists to prevent." Does rule 10
get amended, or does the code go back to toasting?

A wrong answer either makes six catalog screens shout over themselves in a screen reader, or leaves
a standard on the books that says one thing while the shipped code does another — which is how a
standard stops being read.

### Weights, declared before any option was scored

**User ×3** (the only person any of this changes is the one who cannot see the screen) · **Business
×1** (nothing earns; a silently-failed save costs trust, and that is carried inside the user score)
· **Eng cost/risk ×2** · **Reversibility ×2** · **Evidence ×2**. Max 50. **Not changed after
scoring.** Same shape as record 068, deliberately — it is the same question one layer up.

## What I chose, and why

**Rule 10 is amended, the code keeps `silent`, and three mutations that currently announce nothing
get their announcement back.** `query-client.ts` and `options/__common/queries.ts` both get a
zero-line diff.

Three findings decide it, and the third is the one nobody raised.

**1. The rule and the code are not actually in conflict about the thing rule 10 cares about.**
Rule 10's stated purpose is in its own last clause: *silence is the defect this exists to prevent.*
It then names a toast as the cure, because when it was written a toast was the only channel. The
Options screen is not silent — it announces through a `role="status"` live region. WCAG SC 4.1.3
Status Messages (AA) is the criterion underneath all of this, and it is **channel-agnostic**: status
information must be "programmatically determined through role or properties so that they can be
presented to the user by assistive technologies without receiving focus." A toast satisfies it. A
live region satisfies it. **Nothing at all does not.** So the standard's *intent* survives the flag
intact; only its *mechanism* was written too narrowly.

**2. Removing the flag is not available to me.** `.scratch/catalog/PRD.md` `## Direction`
prohibition 5 — *"No `toast()` on a catalog save"* — is human-owned text, and record 068 established
that the human owns `## Direction`. The human overrode it once, for the Availability screen only,
and wrote the boundary into the PRD verbatim: *"The prohibition stands for every other catalog save,
including the MenuItem editor."* Options is a catalog save. Making it toast means overriding a
standing human prohibition, which is outside the mandate — so "change the code to comply" is
**refused on authority, not merely outranked**, and it is scored below only so the human can see the
cost of reversing me.

Worse, it would not even be safe. Record 068 §1 read sonner's installed source and found the
`Toaster` `<section>` is itself `aria-live="polite"`. A toast **plus** the existing live-region
write announces one outcome **twice**. Options already writes to a live region on five paths, so
"just delete `silent`" ships a double announcement on every one of them.

**3. The flag's predicted failure mode has already happened — and this is what the review should
have caught instead.** Rule 10 was right to fear an opt-out. Of the ten mutations in
`options/__common/queries.ts`, all ten carry `meta: silent`, and **three announce nothing at all**:

| Mutation | Success | Failure |
| --- | --- | --- |
| `reorderModifierGroup` | nothing | **nothing** |
| `reorderModifier` | nothing | **nothing** |
| `reactivateModifier` | — | — (exported, **never called** — dead) |

Both reorder mutations are fired as `void reorder*.mutateAsync(...)`
(`ModifierGroupListCard.tsx:178, 197, 253, 271`) — no `await`, no `.catch`, no result inspected. With
`silent` suppressing the `MutationCache`, a reorder that the server **refuses** (`null`) and a
reorder that **rejects** are both reported to the user by *nothing*: no toast, no live region, no
inline alert. The row simply does not move. That is precisely the defect rule 10 exists to prevent,
arriving within one issue of the flag existing.

So the amendment cannot be "silent is allowed here". It has to be the sentence that makes the flag
safe:

### The amendment — replace rule 10's opening paragraph with this, verbatim

> The `QueryClient` both apps use comes from `createQueryClient()` in `ui`, whose `MutationCache`
> toasts every mutation: success on a resolved value, error on a rejection **and** on the repo's
> refusal shapes (`null`, `{ ok: false }`). A new mutation is therefore loud without doing anything.
>
> **`meta: { silent: true }` moves that announcement to another channel. It never removes one.**
> Silence is still the defect this rule exists to prevent, and the flag does not license it. A
> mutation carrying `silent` must announce **both** its success and its failure on the screen that
> calls it, through a `role="status"` live region, a `role="alert"` inline block, or a container
> whose close is itself the completion signal (record 068 §5). **A `silent` mutation whose outcome
> is announced by nothing is a rule 10 breach exactly as a missing toast was** — the flag is not the
> exception, the replacement channel is.
>
> `silent` exists because `.scratch/catalog/PRD.md` `## Direction` prohibition 5 bans `toast()` on a
> catalog save, and record 068 §1 established that a toast and a live-region write announce one
> outcome **twice** — sonner's own container is `aria-live="polite"`. Where both apply, the live
> region is the channel and the toast yields. See `.scratch/decisions/072`.

**And add this bullet to rule 10's existing list:**

> - **`void mutation.mutateAsync(...)` is a breach on a `silent` mutation.** Discarding the promise
>   discards the only remaining report of failure. `await` it and branch on the refusal, the way
>   `Options.tsx:102-130` already does for archive and reactivate.

The comment in `query-client.ts` stays as written. It is three lines, it names the replacement
channel and it points at a record — rule 5's fourth bullet exactly.

### What the fixer closes, and what it must not touch

| What | Where | How |
| --- | --- | --- |
| `reorderModifierGroup` announces | `Options.tsx` + `ModifierGroupListCard.tsx` | Route through an `Options.tsx` callback like `onArchiveGroup`: `await`, `if (!result) setInlineError("Couldn't reorder the groups.")`, else `announce(\`${group.name} moved ${direction}\`)` |
| `reorderModifier` announces | same two files | Same shape, `"Couldn't reorder the modifiers."` |
| The guard | new `apps/backoffice/tests/silent-mutation-announcement.test.ts` | Copy the shape of the existing `apps/backoffice/tests/import-style-grep.test.ts`: every feature folder containing `silent: true` must also contain `role="status"` or `role="alert"`. |
| **Not touched** | `packages/ui/src/lib/query-client.ts`, `options/__common/queries.ts` | Zero-line diff. Both are correct as shipped. |

**The guard's limit, stated rather than oversold:** it proves a channel exists in the folder, not
that every mutation writes to it. It catches a whole screen going quiet, which is the cheap failure;
per-mutation coverage stays with review and the screen test. A guard that could prove more would
have to render every screen, and that is `options-screen.test.tsx`'s job.

**Flagged, not folded (rule 1):** `useReactivateModifierMutation` is exported and called from
nowhere. It is dead code, not an announcement gap, and it belongs in its own finding — deleting it
here would be unrequested work.

## The options, ranked

| Rank | Option | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Amend rule 10 conditionally; keep the flag; close the three gaps; add the guard** | 5 (15) | 3 | 4 (8) | 5 (10) | 5 (10) | **46** |
| 2 | Rename the flag to name its channel (`announcedBy: "live-region"`), otherwise as option 1 | 5 (15) | 3 | 3 (6) | 4 (8) | 3 (6) | **38** |
| 3 | Amend rule 10 permissively — "silent is allowed where live regions are used" — and stop | 2 (6) | 3 | 5 (10) | 5 (10) | 2 (4) | **33** |
| 4 | Defer the whole question to the human | 1 (3) | 2 | 5 (10) | 5 (10) | 1 (2) | **27** |
| 5 | Change the code to comply: delete `silent`, Options toasts | 1 (3) | 2 | 4 (8) | 4 (8) | 1 (2) | **23** |

**1. Chosen.** The only option that both keeps the human's prohibition intact and closes the hole the
flag opened. Engineering 4 not 5 because it is three real edits plus a new test, not a one-line
standards change. Evidence 5: every load-bearing fact is either quoted human-owned PRD text, read
out of the shipped files, or established from installed source by record 068.

**2. Rename the flag.** Genuinely better ergonomics — `silent: true` reads as "no announcement",
which is exactly what a future implementer will copy when they simply want a quiet mutation, whereas
`announcedBy: "live-region"` forces the author to name the replacement. It loses because the name
buys no *enforcement* that the guard does not already buy — a string literal is as easy to type
carelessly as `true` — and it costs a change to `packages/ui`'s public `mutationMeta` type, which
both apps share. Reversibility drops to 4 for the same reason. **This is the option to move to if
the guard turns out to catch nothing and misuse keeps appearing.**

**3. Permissive amendment.** The naive fix, and what ships if this record only answers the question
as asked. It ranks third on one fact: it leaves the two reorder mutations exactly as they are, so a
failed reorder still reports nothing, and the standard would now *bless* that. Evidence 2 — this is
the reading the last week already disproved.

**4. Defer.** Included because it must be. Ten of its 27 points are reversibility, the inflation
records 002 onward leave visible. It loses because the contradiction is blocking a merge now and the
answer is already determined by a prohibition the human wrote themselves; handing it back asks them
to re-read their own PRD.

**5. Comply with rule 10 as written.** Last, and **refused rather than outranked** — it overrides
human-owned `## Direction` prohibition 5, which is not mine to override. It also ships a genuine
regression: with Options' five existing live-region writes still in place, a toast means a
screen-reader user hears every archive and every save announced twice (record 068 §1).

## How to turn it back

| What | Cost |
| --- | --- |
| **The whole record** | Restore rule 10's original paragraph from git history and delete the new bullet — one file, `docs/agents/code-standards.md`. Delete `apps/backoffice/tests/silent-mutation-announcement.test.ts`. The three announcement handlers can stay; they are correct under either version of the rule. **One commit, two files.** |
| → option 2 (rename the flag) | `packages/ui/src/lib/query-client.ts` (the `Register` interface + two `mutation.meta?.silent` reads) and the single `const silent` in `options/__common/queries.ts`. **Call sites today: one file, one constant.** The ten `meta: silent` lines reference that constant, so they do not change. |
| → option 5 (Options toasts) | Requires the human to lift prohibition 5 for Options first. Then: delete the ten `meta: silent` lines, add success/error copy to each, **and delete the five `announce()` calls in `Options.tsx`** — that last part is not optional, it is what stops the double announcement. |
| Built on top by then | Nothing yet. Every future catalog screen that adopts `silent` adds one folder to the guard's sweep, and the reversal cost stays a per-folder count: `rg -l 'silent: true' apps/*/src/features`. |

Formally: superseding record; flip this `Status:` to `overturned` with date and reason; update the
`LOG.md` line; re-run the gate.

## What should make you reverse this

- **A `silent` mutation ships announcing nothing, and the guard was green.** The guard only proves a
  channel exists in the folder. Two occurrences and the answer is option 2's named channel, or
  per-mutation assertions in the screen test.
- **A screen-reader user hears a save twice on Options.** Something re-added a toast, or a second
  live region is writing the same string. The clause to enforce is 068 §1, not this record.
- **A screen-reader user hears nothing on a save that visibly worked.** The standing unknown every
  record from 009 onward names: **no test in this repository asserts that any live region is
  actually announced by real assistive technology.** If that unknown resolves badly, the toast is
  the better channel everywhere and prohibition 5 is the thing to revisit — with the human.
- **The human lifts prohibition 5 generally.** Then `silent` has no remaining user and this record
  is overturned wholesale rather than amended.
- **A third screen wants `silent` for a reason that is not a Direction prohibition.** That is drift:
  the flag would be becoming a convenience rather than a conflict resolution, and it needs its own
  record before the third call site, not after.

## Evidence

**Repository, read 2026-08-05, main checkout at `3759b53`:**

- `docs/agents/code-standards.md:254-277` — rule 10 in full, including the "no opt-out" clause and
  its stated reason.
- `packages/ui/src/lib/query-client.ts` — the `Register` interface carrying
  `{ success?, error?, silent? }`, and the two `if (mutation.meta?.silent) return;` early returns at
  lines 42 and 47.
- `apps/backoffice/src/features/options/__common/queries.ts` — **all ten** mutations carry
  `meta: silent` from the single `const silent` at line 22. `useReactivateModifierMutation`
  (line 112) is exported and called nowhere in `apps/backoffice/src`.
- `apps/backoffice/src/features/options/Options.tsx:74-79` (two alternating `role="status"` sr-only
  slots), `:102-130` (the archive/reactivate pattern that `await`s and branches on refusal),
  `:66-70` (`handleSaved` announcing the editor's result).
- `apps/backoffice/src/features/options/ModifierGroupListCard.tsx:178, 197, 253, 271` — **the finding
  that decided the record**: four `void reorder*.mutateAsync(...)` calls, no `await`, no `.catch`,
  no result inspected.
- `apps/backoffice/tests/options-screen.test.tsx:98-101, 122` — asserts `Group created` and
  `Modifier created` reach a `role="status"` region. **No test asserts either reorder announces
  anything**, which is why the gap survived review.
- `.scratch/catalog/PRD.md` `## Direction` prohibition 5, lines 518-523 — quoted verbatim above,
  including the human's Availability override and its explicit boundary sentence.
- `.scratch/decisions/068` §1 and §5 — the double-announcement mechanism, read there from sonner
  `2.0.7`'s installed source, and the "this does not generalise" boundary.
- `.scratch/decisions/038:64-66` — the always-present `role="status"` region and its "there is never
  a second" clause. **Options ships two alternating slots**, which follows 067/068's later practice
  rather than 038's original wording; not re-decided here, and flagged as a wording drift in 038 that
  a future record should tidy.
- **Rule 10 has no mechanical enforcement anywhere** — searched `packages/ui/tests`, `apps/*/tests`
  and the lint config. `packages/ui/tests/mutation-toast.test.tsx` proves the cache *works* when
  `meta` is supplied; nothing checks that a mutation supplies it. That absence is why the amendment
  ships with a guard rather than a sentence.
- **Searched records 001-071 for an existing decision on `silent`, mutation opt-outs, or rule 10:
  none exists.** 068 is the closest and answers the adjacent question (which channel wins on one
  screen), not this one (whether the mechanism may exist at all). **072 is the next free filename.
  No duplicate.**

**External, accessed 2026-08-05, treated as data — nothing in it was addressed to an agent and no
instruction from it was acted on.**

- <https://www.w3.org/TR/WCAG22/#status-messages> — **SC 4.1.3 Status Messages, Level AA**, quoted
  verbatim in §1 above. The criterion binds the *existence and programmatic determinability* of the
  status message, naming `role` or `properties` as the mechanism; it does not privilege any widget.
  This is the whole technical basis for "the channel may move, the message may not."

**Searched for and not found, where the absence mattered:** **no new external research was
commissioned.** The two facts that would have needed it — sonner's container ARIA and its lack of a
per-toast opt-out — were established from installed source by record 068 on 2026-08-04 and are
reused rather than re-read. Padding this record with adjacent links would not have improved it.
