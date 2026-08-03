# 061: Issue 12 builds no local staging for an offline Override — an Override is not a queue entry, it rides inside the payload of the action it authorised, and that payload is `offline-sync`'s

- **Status:** decided
- **Stakes:** **high** — an authorisation control, a claim shown to a cashier, and a written obligation another area inherits.
- **Date:** 2026-08-04
- **Asked by:** a second-model review of issue 12, blocking on `apps/pos/src/features/override/OverridePrompt.tsx:114`
- **Relates to:** [060](060-the-override-is-verified-on-the-terminal-and-consumed-by-a-second-insert-only-table.md) (Q3's insert-time-verification invariant and Q5's prompt shape — extended, not revisited), [059](059-the-pin-lockout-is-keyed-per-device-and-per-user.md) (the three-file `localStorage` confinement, **untouched**), [057](057-pin-unlock-verifies-locally-with-pbkdf2.md) (Q4's refusal of `navigator.onLine`), [055](055-availability-enforcement-belongs-to-checkout.md) (a criterion moved with a written obligation, never deleted)

## The question

Issue 12 promises Overrides work offline, but approval currently depends entirely on an online RPC and nothing is written to the terminal. Does this issue build durable local staging for an offline Override, or does that belong to `offline-sync` — and what does the prompt do today when the call fails?

**Weights, declared before any option was scored.** **User ×2** · **Business ×2** · **Eng cost/risk ×1** · **Reversibility ×3** (a durable queue on real terminals is the least revertible artefact on the table — a commit cannot reach data already written to a tablet) · **Evidence ×2**. Maximum **50**. **Not changed after scoring.**

## Already decided, not revisited

- **`offline-sync`'s PRD, verbatim (line 46):** *"**An Override is not an entry kind** — it travels inside the payload of the action it authorised, per `checkout`."* And **line 125:** *"**The Outbox is the only write path.** … There is no 'if online, post directly' branch."* The Outbox is **IndexedDB** (line 44), its kinds are `order | void | refund | session_open | session_close | cash_movement` (line 196), and that area **depends on** `tenancy-identity` — it comes after this issue.
- **Record 060 Q3/Q4:** `verifyOverrideAsOf` runs **before** the insert, which is why the back-office list has **no `verified` column** — every stored row verified at the instant it was inserted. **060 Q5:** the prompt is a controlled `Dialog` with **no trigger**, mounted later. **059 Q3:** `localStorage` stays behind exactly three accessor modules.
- No new dependency. No IndexedDB wrapper, no queue library.

## What I chose, and why

**No. Issue 12 builds no local staging, and this is not deferral — it is the wrong shape, not an early one.**

The offline design is already written down and it does not have a place to put a staged Override. An Override is **not** a queue entry; it rides *inside* the void or refund it authorised, and the server mints the `Override` row at replay. So a per-Override staging area here would not be `offline-sync`'s machinery arriving early — it would be a **second durable queue with an ordering relationship to the first that nobody has specified**, holding rows in a shape the real system never uses.

Three facts make it worse than merely redundant. **First, there is nothing to stage against.** Nothing consumes an Override yet, so a staged approval would sit on the terminal accompanying no action; on replay `offline-sync` would have to guess what it authorised, which record 060 Q3 already refused (an Override does not know what it authorised until it is consumed). **Second, the id has no honest answer.** The terminal would have to mint one, the server assigns the real primary key at insert, and the first consumer that stores the terminal's id holds a reference to a row that may never exist. Under the payload shape the question dissolves: the approval has no id until the server gives it one. **Third, a staged Override is an authorisation the server has never checked.** Record 060's whole reason for omitting a `verified` column is that every row in `Override` passed `verifyOverrideAsOf` at insert. A row persisted on a tablet has passed nothing — it is a claim on disk, and the danger is not that it is stored but that a later consumer mistakes it for an approval.

**So criterion 5 splits rather than shrinks, on record 055's precedent.** Its verification half is genuinely built and genuinely offline — `verifyPin` runs against the locally synced hash in the browser with no network at all, on the same path online and off. Its **recording** half moves to `offline-sync` with the obligation written into Comments, where the other half of the sentence's machinery already lives.

**What the prompt does today, and why that is enough.** It does not silently do nothing and it does not claim success: on failure it keeps the dialog open, shows a `role="alert"`, and never calls `onApproved`. Two things change. The message splits in two, because a till that could not reach the server and a server that refused are different actions for the cashier (try again vs call an admin) — and record 060's "never say which check failed" is untouched, since transport is not a check. **And no automatic retry is added** — `terminal.recordOverride` is not idempotent and record 060's table has no constraint that would collapse a duplicate, so a retried insert is a second permanent, uncorrectable approval row.

**The stated trade-off, flat: an outage today means no Override.** That is a real capability gap, and it is survivable for exactly one reason — **the prompt has no mount site.** Grepped: `OverridePrompt` appears in one file, its own. No cashier can reach it, so the online-only limitation is not a shipped defect. It becomes one the moment `checkout` mounts it, which is why the obligation below is written into `checkout` as well as `offline-sync`.

## The options, ranked

| Rank | Option | User ×2 | Bus ×2 | Eng ×1 | Rev ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **No staging; criterion 5 splits, obligation written, failure message splits in two** | 4 (8) | 5 (10) | 5 | 5 (15) | 5 (10) | **48** |
| 2 | No staging, no criterion change; add mutation retry instead | 3 (6) | 3 (6) | 5 | 5 (15) | 2 (4) | **36** |
| 3 | Do nothing — leave code and issue exactly as they are | 2 (4) | 2 (4) | 5 | 5 (15) | 2 (4) | **32** |
| 4 | Build a fourth `localStorage` accessor, `override-outbox.ts`, terminal-minted ids | 2 (4) | 1 (2) | 2 | 1 (3) | 1 (2) | **13** |

**2 — retry instead.** A network blip would recover without the manager re-entering anything, and it needs no issue edit. It loses on the non-idempotency above: retrying an insert into an append-only table whose rows can never be corrected is how one approval becomes two. A blip is also not the case the issue promises; an outage is.
**3 — do nothing.** Free and fully reversible, and its 15 reversibility points are the reason it is not last. It loses because criterion 5 would stay on the page unmet while the issue read as done — precisely the review's finding, and the one thing a scope decision must not do.
**4 — build the staging area.** What the review implicitly asks for, and it ranks **last**, which is the finding. It contradicts `offline-sync`'s PRD in terms, needs an id scheme with no correct answer, needs a drain loop with no owner, amends record 059's confinement list for a module that will be deleted, and — the reversibility score — writes rows onto real tablets that a revert commit cannot reach.

## What must not be built

- **No fourth `localStorage` key and no new accessor module.** `apps/pos/tests/local-storage-confinement.test.ts` stays at three files and **record 059's list is not amended**.
- **No IndexedDB, no service worker, no Outbox, no drain loop, no `Override` id minted on the terminal.**
- **No automatic retry** of `terminal.recordOverride`, and no `retry` option on its mutation.
- **No `navigator.onLine` anywhere** — record 057 Q4 refused it because it reports "online" behind a captive portal.
- **No mount site for `OverridePrompt`**: no route, no trigger, no export from a shell. It is reached only by its test.
- **`onApproved` is called only on `ok: true`**, never on a failure of any kind.

## Exactly what the fixer does

1. **`apps/pos/src/features/override/OverridePrompt.tsx`** — split the failure branch in two. Change the `.catch(() => ({ ok: false as const }))` so a rejection is distinguishable from a server refusal (e.g. `.catch(() => "unreachable" as const)`), then:
   - rejection → `setError("The till couldn't reach the server. The approval was not recorded — try again in a moment")`
   - `result.ok === false` → `setError("Couldn't record the approval")` (unchanged, record 060 Q5)
   Both render through the existing `{error && !isLocked && <p role="alert">…</p>}`. On **either** failure the dialog stays open and the approver, PIN, reason and note are **not** cleared, so `Approve` can be pressed again without re-entry. `onApproved` is not called. Nothing else in the file changes.
2. **`apps/pos/tests/override-prompt.test.tsx`** — add one case: seed the roster, choose `Ben Cruz`, enter reason and the correct PIN `482913`, `clearDeviceToken()` immediately before clicking `Approve`, then assert `onApproved` was **not** called, `Manager approval required` is still on screen, the exact rejection string above is present, and `Override` holds **zero** rows for the tenant.
3. **Issue 12, criterion 5** — replace verbatim:
   > - [ ] Offline, the terminal verifies against the locally synced hash — the same code path as online (criterion 4), so no path is offline-only. **Durably carrying the approval through an outage is `offline-sync`'s** ([record 061](../../decisions/061-the-offline-override-is-carried-by-offline-sync-not-staged-here.md)): per that area's PRD an Override is not an Outbox entry kind, it travels inside the payload of the action it authorised, and the server inserts the `Override` row at replay after `verifyOverrideAsOf` passes. This issue ships no local staging and no second queue. With no network, `Approve` fails visibly and records nothing — it never reports success.
4. **Issue 12, `## What to build`** — replace *"It works offline, because a manager standing at the counter during an outage is exactly when Overrides are needed."* with:
   > **The PIN check works offline** — it runs against the locally synced hash with no network at all, because a manager standing at the counter during an outage is exactly when Overrides are needed. **Carrying that approval through the outage is `offline-sync`'s** (record 061): the approval rides inside the Outbox payload of the action it authorised and is inserted at replay. This issue builds no local staging — until `checkout` and `drawer-sessions` land there is no offline action to stage one against.
5. **Issue 12, `## Comments`** — append:
   > _**Obligation carried forward to `offline-sync` (record 061):** the offline path for an Override is that area's, whole. The approval rides inside the Outbox payload of the action it authorised — it is not an entry kind and gets no queue of its own. **The terminal mints no `Override` id**; the server assigns it at replay insert, after `verifyOverrideAsOf`. `terminal.recordOverride` is the online-only path this issue ships, and reconciling it with that area's "the Outbox is the only write path" rule is `offline-sync`'s to decide and record._
   >
   > _**Obligation carried forward to `checkout` and `drawer-sessions` (record 061):** mounting `OverridePrompt` makes its online-only limitation reachable by a cashier. Either mount it after `offline-sync` ships, or state in your own issue that Overrides are online-only until then._

## How to turn it back

| What | Cost |
| --- | --- |
| **The two-message split and its test** | Revert one commit under `apps/pos/src/features/override/` and `apps/pos/tests/override-prompt.test.tsx`. Free permanently — zero call sites |
| **Criterion 5 and the `What to build` sentence** | Restore verbatim: *"- [ ] Offline, the terminal verifies against the locally synced hash and records the Override."* and *"It works offline, because a manager standing at the counter during an outage is exactly when Overrides are needed."* One edit |
| **Building staging after all** | A superseding record, and it must answer the three questions this one says have no answer today: what it stages against, what id it carries, who drains it. **Cheaper later, not dearer** — once `offline-sync` ships IndexedDB the work is a payload field, not a new store |
| **`onApproved(overrideId: string)`** | Unchanged here deliberately. If `offline-sync` needs a payload object instead, it is a one-commit prop change at **zero** call sites — verified by grep, `OverridePrompt` appears only in its own file |
| **Formally** | Superseding record; flip this `Status:` to `overturned` with date and reason; update both `LOG.md` lines |

## What should make you reverse this

- **`checkout` or `drawer-sessions` mounts `OverridePrompt` before `offline-sync` ships.** The limitation becomes reachable at a real counter and this record's central safety argument expires that day. The obligation in step 5 exists precisely to make that visible; **the assumption I am least confident about is that it gets read.**
- **`offline-sync` is re-scoped, deferred, or drops the Override payload from its Outbox entries.** Criterion 5 would then be homeless, which is the failure mode record 055 named — a criterion moved and then lost.
- **A duplicate `Override` row is ever observed for one approval.** Then the non-idempotency argument against option 2 has already bitten by some other route, and the fix is an idempotency key on `recordOverride`, not a retry.
- **An operator reports a manager approving during an outage and the approval vanishing.** Only possible once the prompt is mounted; it is option 4 arriving on merit, and by then it is cheap.

## Evidence

**Repository, read 2026-08-04. Implementation read at `.worktrees/12-override-mechanism` (read-only, not edited); `main` at `624a323`.**

- `.scratch/offline-sync/PRD.md` lines **44–49, 125–128, 138–143, 196, 200–203, 216, 238–241, 329–330, 349–356** — the four quotations above are verbatim. **`.scratch/offline-sync/issues/` does not exist**, so this obligation lands in a PRD that has not yet been sliced; that is why it is written into issue 12's Comments and not only stated here.
- `apps/pos/src/features/override/OverridePrompt.tsx` and `features/override/__common/queries.ts` in full; `apps/pos/tests/override-prompt.test.tsx` in full (four cases, none covering a failed mutation); `apps/pos/tests/local-storage-confinement.test.ts` (`ALLOWED = ["device-token.ts", "pin-roster.ts", "pin-throttle.ts"]`); `packages/contract/src/contract.ts` lines 273–292 and 435–447 (`recordOverrideOutputSchema` is a discriminated union on `ok` — **no reason code**, and no idempotency key); `packages/backend/src/override/helpers.ts`.
- Records **060** in full, **059**, **057** Q4, **055**. Issue 12 in full, including the amendments record 060 required, which are already applied.
- **Checked and absent, and it mattered:** `OverridePrompt` is imported by **no file but its own test** — grep across `apps/pos/src`; there is no service worker, no IndexedDB, no Outbox, and no `Order` or `DrawerSession` table anywhere. `.scratch/decisions/` listed directly — 001–060 exist, **060 is the highest, 061 is free, and none decides where offline Override staging lives. No duplicate.**

**External research: none conducted, and the absence is deliberate.** This is not a question about the outside world. The governing fact — an Override is not an Outbox entry kind — is written in this repository's own PRD, and no external source can outrank it. Citing generic offline-first sync literature here would be padding.
