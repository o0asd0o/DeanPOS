# 060: The Override PIN is verified on the terminal on **both** paths — criterion 4 gives, record 058 stands — and "consumed" is one row in a second insert-only table, so the append-only rule is never bent

- **Status:** decided
- **Stakes:** **high** — a credential path (Q1), an authorisation-replay path (Q2/Q4), two append-only tables whose rows can never be corrected, a claim shown to a cashier, and the control that stands between a cashier and a free void.
- **Date:** 2026-08-04
- **Asked by:** the human, for `.scratch/tenancy-identity/issues/12-override-mechanism-and-re-verification.md` (Q1–Q5)
- **Relates to:** [058](058-pin-management-is-a-back-office-action.md) (**upheld, not superseded** — the reasoning is extended to Override), [057](057-pin-unlock-verifies-locally-with-pbkdf2.md) (Q1's arithmetic decides Q1 here; Q3's roster gains one field; Q6's grep allow-list gains one path), [059](059-the-pin-lockout-is-keyed-per-device-and-per-user.md) (throttle reused whole), [056](056-the-device-principal-its-token-and-its-two-screens.md) (Device principal, structural authorisation, single-use-by-index), [054](054-payment-method-availability-and-its-audit.md)/[046](046-how-tenant-settings-are-stored-and-audited.md) §3 (audit-table discipline), [055](055-availability-enforcement-belongs-to-checkout.md) (the no-consumer posture), [009](009-terminal-shell-chrome-states.md), [020](020-nav-entries-become-links-onto-placeholder-routes.md)

## The questions

Five. **Q1** criterion 4 requires a server-side PIN comparison that 058 forbids and a grep test blocks. **Q2** what "consumed" is, with nothing to consume it. **Q3** an append-only table that Q2 must write to twice. **Q4** the as-of-time re-verification, fed a timestamp an attacker controls. **Q5** two screens, one drawn and one not. A wrong answer either hands a cashier a free void or hands an attacker an unmetered manager-credential oracle.

**Weights, declared before any option was scored.** **User ×2** · **Business ×2** (this is a theft control; a forgeable or replayable Override is money out of the drawer) · **Eng cost/risk ×1** (everything here is small code — the cost is in the shape, not the lines) · **Reversibility ×3** (every artefact is either an append-only row that can *never* be corrected or a wire field `offline-sync` will read) · **Evidence ×2**. Maximum **50**. **Not changed after scoring.**

## Already decided, not revisited

- **057 Q1, the arithmetic:** 4–6 digits is 1,110,000 candidates; a synced roster grinds in **~75 s** on one rented GPU. *"No KDF saves this PIN."* **058:** no server procedure compares a submitted PIN against a stored hash, asserted by `apps/api/tests/pin-no-logging-grep.test.ts`.
- **ADR-0007, verbatim:** a PIN is *"a **second factor to Device possession**, never a standalone credential"*; *"Manager Overrides are PIN entry by manager User"*. **Revocation is the mitigation.** **ADR-0005:** the four Override-requiring actions are fixed and not extendable here; money is integer centavos.
- **042** no new dependency · **no new token, nothing new in `packages/ui`** (057 Q4) · `localStorage` confined to three files (059 Q3) · one form, one Save (040/045/046/054).

## Q1 — Option (a). The terminal verifies, on both paths. Criterion 4 is amended; 058 is **not** superseded.

**The deciding fact is that a server-side PIN check would buy exactly nothing, and I can show it.** To call the endpoint at all you need a Device token. The token lives in `localStorage` on the tablet (056) **beside the synced roster of PIN hashes** (057). So any attacker who can reach a server-side Override endpoint already holds every manager hash for that Store and grinds them in ~75 s — then submits the *real* PIN, which passes. A server-side comparison stops no attacker who can invoke it, and in exchange it creates the one thing 058 deleted: an unmetered guessing oracle against the weakest secret in the product, reachable from any network position, which 059's on-device throttle cannot touch. **That is not a trade, it is a cost with no benefit.** So there is one verification path and it runs on every Override at either connectivity — 057 Q1's rule inherited whole, because an online-first path with an offline fallback is a production path the tests rarely execute.

**What the server actually trusts, and none of it is the PIN.** (1) **The Device token** — 256-bit, hashed at rest, revocable, fixing `tenant_id`, `store_id` and `device_id`, with no input field carrying any of the three (056/057 Q3's structural lock). (2) **`verifyOverrideAsOf` (Q4), run before the row is inserted**: the terminal *names* an approver, the server decides from its own effective-dated history whether that person was `manager`-or-above and a member of that Store at the stated time — so **a compromised terminal cannot mint an Override for a cashier, a stranger, or a manager who was not at that Store then.** (3) **The append-only row and the review list**: a manager who never approved anything can see a row bearing their name. **The residual, named: a terminal whose `localStorage` an attacker holds can mint an Override for a genuine, correctly-scoped manager. Nothing here stops that and nothing could** — it is the residual ADR-0007 already accepted for unlock itself. Saying otherwise would be theatre.

**The grep assertion is kept unchanged and gains nothing.** No server file imports `verifyPin`. **One line changes in 057 Q6's second assertion:** the `pinHash` / `pin_hash` identifier allow-list gains `apps/pos/src/features/override/**` alongside `features/unlock/**`. `apps/pos/tests/local-storage-confinement.test.ts` (059) stays at three files — **the Override feature adds no storage key.**

| Rank | Option | User ×2 | Bus ×2 | Eng ×1 | Rev ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **(a) Terminal verifies both paths; server authorises by Device token + as-of role/membership** | 5 (10) | 4 (8) | 5 | 5 (15) | 5 (10) | **48** |
| 2 | Defer to the human | 1 (2) | 1 (2) | 3 | 5 (15) | 1 (2) | **23** |
| 3 | (b) Supersede 058 in part — server verifies the PIN online | 3 (6) | 2 (4) | 2 | 2 (6) | 1 (2) | **20** |
| 4 | Both: terminal verifies, server re-verifies the PIN when reachable | 2 (4) | 2 (4) | 1 | 2 (6) | 1 (2) | **17** |

**2 — defer.** Fifteen of its 23 points are the reversibility every do-nothing option collects free. That it still outranks option 3 *is* the finding.
**3 — supersede 058.** The literal reading of criterion 4, and the honest runner-up on paper. It loses on the arithmetic above, and it would need a superseding record, a narrowed grep rule, *and* a new server-side throttle (a second one, since 059's is on-device) to defend an oracle that protects nothing.
**4 — both.** Every cost of option 3 plus a branch that only executes when the network is up, which is 028's *"a production path a test never executes"* inverted.

**Exact replacement for acceptance criterion 4:**

> - [ ] The PIN is verified **on the terminal**, against the locally synced hash, on **both** the online and the offline path — one path, exercised on every Override ([record 057](../../decisions/057-pin-unlock-verifies-locally-with-pbkdf2.md) Q1, [058](../../decisions/058-pin-management-is-a-back-office-action.md), [060](../../decisions/060-the-override-is-verified-on-the-terminal-and-consumed-by-a-second-insert-only-table.md)). **No server procedure compares a PIN against a stored hash.** The approver is *chosen by id*, not identified by their PIN: only Users the synced roster marks `canApproveOverride` are offered, and the server independently refuses to record an Override whose named approver was not `manager`-or-above **and** a member of that Store **at the stated time**. A `cashier` therefore cannot authorise, whether or not their PIN is correct.

**The roster gains one boolean, not a role.** `pinRosterUserSchema` gains `canApproveOverride: z.boolean()`, computed server-side as `hasAtLeastRole(getRoleAsOf(user, now).role, "manager")` — membership is already applied when the list is built (057 Q3), so every eligible entry is by construction someone who may approve at this Device. **057's refusal of a `role` field stands in its strongest form.** A cached roster written before this field exists reads `undefined`; **`?? false` — fail closed**, so a terminal on a pre-upgrade roster offers nobody until it syncs once.

## Q2 — Consumption is an INSERT into a second table, and it is a command, never a procedure

**`OverrideConsumption`, one row per consumed Override, `UNIQUE ("tenant_id", "override_id")`.** Double-use is impossible because a unique index cannot admit the second row — PostgreSQL, verbatim: *"If a conflicting row has been inserted by an as-yet-uncommitted transaction, the would-be inserter must wait to see if that transaction commits. If it rolls back then there is no conflict. If it commits without deleting the conflicting row again, there is a uniqueness violation."* **The index is the control.** `ON CONFLICT ("tenant_id","override_id") DO NOTHING` merely turns the violation into a zero-row result; a plain `INSERT` catching SQLSTATE `23505` is equivalent. **Note honestly: PostgreSQL states its atomicity guarantee only for `ON CONFLICT DO UPDATE`, not for `DO NOTHING` — which is why this record rests the guarantee on the index and not on the clause.**

**There is no read-then-write window at all, because consumption is one statement:** `INSERT INTO "OverrideConsumption" (…) SELECT … FROM "Override" o WHERE o."tenant_id"=$t AND o."id"=$o AND o."action_type"=$a AND o."store_id"=$s ON CONFLICT ("tenant_id","override_id") DO NOTHING`. Zero rows affected is the refusal, for every cause — unknown Override, wrong action type, wrong Store, already consumed. One refusal, no reason code: the consumer refuses its action either way.

**And it is deliberately not a contract procedure.** `consumeOverride(trx, { tenantId, overrideId, actionType, storeId, subjectKind, subjectId }): Promise<boolean>` lives at `packages/backend/src/override/db-operations/commands/consume-override.command.ts` and **takes a transaction**. Consumption must commit atomically with the action it authorises; across an RPC boundary a crash either burns an approval or voids an Order with no consumed approval. **An `override.consume` procedure would be actively wrong, not merely premature.** It is tested directly (`apps/api/tests/override-consumption.test.ts`), the way 057 pinned `pin.ts`.

**The concurrency test is not negotiable and "close enough" is refused:** two genuinely concurrent transactions on **two separate connections**, both calling `consumeOverride` for the same Override, with the first holding its transaction open until the second has issued its statement. Assert exactly one `true`, one `false`, and **exactly one row** in `OverrideConsumption`. A sequential loop does not test this and does not count. 056 already required this shape for enrolment codes; copy it.

| Rank | Option | User ×2 | Bus ×2 | Eng ×1 | Rev ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Second insert-only table, unique `(tenant_id, override_id)`, consumed by a command inside the consumer's transaction** | 4 (8) | 5 (10) | 5 | 4 (12) | 5 (10) | **45** |
| 2 | Nullable `consumed_at` on `Override`, `UPDATE … WHERE consumed_at IS NULL` (056's enrolment-code shape) | 4 (8) | 4 (8) | 5 | 2 (6) | 3 (6) | **33** |
| 3 | Defer consumption entirely to `checkout` | 1 (2) | 1 (2) | 5 | 5 (15) | 2 (4) | **28** |
| 4 | A `status` column and a state machine | 3 (6) | 3 (6) | 2 | 1 (3) | 2 (4) | **21** |
| 5 | Build an `override.consume` contract procedure now | 2 (4) | 1 (2) | 3 | 2 (6) | 1 (2) | **17** |

**2 — `UPDATE … WHERE consumed_at IS NULL`.** The honest runner-up, it is 056's shipped single-use pattern, and it is race-free. It loses on one structural fact: it needs `GRANT UPDATE` on `Override`, and a grant is table-wide — the reason, the approver and the timestamp all become editable to satisfy one nullable column. Criterion 1 asks for the opposite.
**3 — defer.** Fifteen of its 28 points are free reversibility. It loses because criterion 3 is ratified and the double-use rule is the whole security value of an Override; leaving it to `checkout` means it is designed at a keyboard, twice, differently.
**4 — state machine.** Same `GRANT UPDATE` problem as 2, plus a vocabulary nobody needs at two states.
**5 — a procedure now.** Refused on correctness, not on prematurity: see the atomicity argument above.

## Q3 — Two tables, both insert-only. The append-only rule is never bent, because nothing is ever updated.

**The reconciliation, in one sentence: the write after insert goes to a different row in a different table, which is itself insert-only.** Both tables get `REVOKE ALL` then `GRANT SELECT, INSERT`, and `FOR SELECT` + `FOR INSERT` policies only — `UPDATE` and `DELETE` are denied at the policy layer *and* ungranted. **Copy the RLS block from the shipped `20260803010000_tenant_settings` migration verbatim** (054's instruction), not 046's prose. Migration `20260804100000_overrides`. `Override` carries `@@unique([tenantId, id])` in Prisma or `OverrideConsumption`'s composite FK cannot be built — the trap 054 and 056 both hit.

| `Override` | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` PK | |
| `tenant_id` | `TEXT NOT NULL` | FK → `Tenant(id)` |
| `store_id` | `TEXT NOT NULL` | composite FK `(tenant_id, store_id)` → `Store` |
| `device_id` | `TEXT NOT NULL` | composite FK → `Device`. **NOT NULL: the Device token is the one thing the server authenticated** |
| `approver_user_id` | `TEXT NOT NULL` | composite FK → `User` |
| `action_type` | `TEXT NOT NULL` | `CHECK IN ('void_paid_order','refund','line_price_override','drawer_variance')` — ADR-0005's fixed four. **A fifth is an ADR amendment, not a migration** |
| `reason` | `TEXT NOT NULL` | `CHECK (btrim("reason") <> '' AND length("reason") <= 200)` |
| `note` | `TEXT` | `CHECK ("note" IS NULL OR (btrim("note") <> '' AND length("note") <= 500))` |
| `approved_at` | `TIMESTAMP(3) NOT NULL` | **the terminal's claim.** `CHECK ("approved_at" <= "created_at" + INTERVAL '5 minutes')` |
| `created_at` | `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` | **the server's clock.** Both are kept: their gap is the only forensic tell an offline row leaves |

Plus `CREATE INDEX "Override_tenant_id_idx"`. **No second index.** Overrides are rare rows; add `(tenant_id, store_id, approved_at)` when a tenant's list is measurably slow — named trigger, one additive migration.

| `OverrideConsumption` | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` PK | |
| `tenant_id` | `TEXT NOT NULL` | FK → `Tenant(id)` |
| `override_id` | `TEXT NOT NULL` | composite FK `(tenant_id, override_id)` → `Override`; `UNIQUE ("tenant_id","override_id")` — **this is criterion 3** |
| `order_id` | `TEXT` | **no FK today** |
| `drawer_session_id` | `TEXT` | **no FK today** |
| `created_at` | `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` | |

`CHECK ((("order_id" IS NULL)::int + ("drawer_session_id" IS NULL)::int) = 1)` — exactly one subject, 056's `DeviceAudit` shape reused rather than a polymorphic `subject_type`/`subject_id` pair, which 056 already refused as *"a composite key smuggled into a text column"* on a table whose rows can never be corrected. **The id of the authorised record moved off `Override` onto `OverrideConsumption`, and that is criterion 1's one amendment** — an Override does not know what it authorised until it is consumed, and `Order` and `DrawerSession` **do not exist**, so no FK is buildable today. That the two columns are unconstrained is stated, not discovered; the agreement between `Override.action_type` and which column is set is enforced in `consumeOverride`, because a `CHECK` cannot read another row.

| Rank | Option (subject shape) | User ×2 | Bus ×2 | Eng ×1 | Rev ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Two nullable subject columns, exactly-one `CHECK`, FKs added by the consuming issue** | 5 (10) | 5 (10) | 4 | 4 (12) | 5 (10) | **46** |
| 2 | One `subject_type` + `subject_id`, no FK ever | 4 (8) | 3 (6) | 5 | 1 (3) | 2 (4) | **26** |
| 3 | `subject_id` nullable on `Override`, filled on consumption | 3 (6) | 2 (4) | 3 | 1 (3) | 1 (2) | **18** |

**2 — polymorphic.** One column, no `CHECK`, and it is what an implementer reaches for. It loses because the FK can then never be added, so a consumption row pointing at a deleted or foreign Order is permanently uncorrectable. **3 — on `Override`.** Reopens the `GRANT UPDATE` problem Q2 just closed.

## Q4 — `verifyOverrideAsOf`, a server helper with two callers and no contract procedure

**`packages/backend/src/override/helpers.ts`, exact signature:** `verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: Date })` → `Promise<{ ok: true } | { ok: false; reason: "unknown-user" | "no-role-history" | "role-too-low" | "not-assigned-to-store" | "time-out-of-bounds" }>`.

**Principal: none — it is not exposed.** Its callers are `terminal.recordOverride` (Device token, at insert) and **`offline-sync`'s replay endpoint** (at replay). A contract procedure is refused for Q2's reason: a replay must run this inside its own transaction, not across an RPC, and a procedure with no caller guesses the consumer's shape (055). **Criterion 7 is tested directly** — `apps/api/tests/override-reverification.test.ts` seeds `UserRole` / `UserStore` history and calls the helper, no seam.

**How it reads issue 04's history — reuse, no second resolver.** `getRoleAsOf(db, userId, asOf)` and `getAssignedStoreIdsAsOf(db, userId, asOf)`, both from `packages/backend/src/access/db-operations/queries/`. `ok` iff `hasAtLeastRole(role, "manager")` **and** (`role === "admin"` **or** `storeId ∈ getAssignedStoreIdsAsOf(...)`) — **exactly 057 Q3's roster predicate**, so the terminal's offer and the server's answer cannot drift.

**When the stated time predates any history: refused, `"no-role-history"`.** `getRoleAsOf` returns `undefined` and `getAssignedStoreIdsAsOf` returns `[]`; both are read as *not a manager then*. **This fails closed and that is deliberate** — an Override stamped before the approver's first role row is precisely what a clock rolled backwards produces.

**Yes, the stated time is bounded, and mostly against server-held facts rather than an invented constant.** **Lower: `approvedAt >= Device.created_at`** — an Override cannot predate the enrolment of the terminal that produced it (confirm the column name against `20260803140000_devices`; use whichever records enrolment). **Upper: `approvedAt <= serverNow + OVERRIDE_CLOCK_SKEW_MS` (5 min), and the database enforces it too** via `CHECK ("approved_at" <= "created_at" + INTERVAL '5 minutes')`. **History is read at `min(approvedAt, serverNow)`**, so a tablet five minutes fast cannot cash in a promotion that has not happened. Five minutes is judgement, not a citation: the smallest allowance that survives an NTP-less Android tablet, where refusing outright would close a till over clock drift. Backdating is the attacker's useful direction — a future stamp buys nothing, since `getRoleAsOf` at a future time returns today's row.

| Rank | Option | User ×2 | Bus ×2 | Eng ×1 | Rev ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Server helper, bounded time, evaluated at `min(claim, now)`, fails closed with no history** | 5 (10) | 5 (10) | 4 | 4 (12) | 5 (10) | **46** |
| 2 | A contract procedure `override.reverify` | 3 (6) | 3 (6) | 3 | 3 (9) | 2 (4) | **28** |
| 3 | Same helper, but trust `approvedAt` unbounded | 2 (4) | 1 (2) | 5 | 4 (12) | 1 (2) | **25** |
| 4 | Ignore the claim; evaluate at server time | 1 (2) | 1 (2) | 5 | 4 (12) | 1 (2) | **23** |

**2 — a procedure.** Testable through the seam and reachable by the back office later. It loses on having no caller that could use it correctly today. **3 — unbounded.** Free to build and it hands an offline terminal an arbitrary point in history to shop for. **4 — server time only.** Cheapest, and it answers criterion 7 wrongly by construction: it retroactively invalidates Monday's legitimate approval when the manager is demoted on Tuesday, the exact failure the criterion names.

**Obligation for `offline-sync`, to go verbatim into issue 12's Comments** (see below): it must call `verifyOverrideAsOf` inside the same transaction as the replay, and **on `ok: false` write no `Override` row at all** and quarantine the Order. That invariant is what lets the back-office list omit a "verified" column: **every row in `Override` passed re-verification at the instant it was inserted.**

## Q5 — Both screens are the shipped pattern; the only thing invented is a picker the mock omits

**POS — `apps/pos/src/features/override/OverridePrompt.tsx`, a controlled `Dialog` with no trigger** (`open` / `onOpenChange` / `action` / `subject` / `onApproved(overrideId)`), mounted later by `checkout` and `drawer-sessions`, tested by rendering it open — the same posture Q2 takes.

**One extraction, and it is the reason the two screens cannot drift: `apps/pos/src/components/PinPad.tsx`.** Lifted **verbatim** out of `Unlock.tsx` — the masked `<Input type="password" inputMode="none" autoComplete="off" spellCheck={false} className="text-center text-2xl tracking-widest">`, the `grid-cols-3` twelve-cell grid, `formatClock`, the lock strip, the single `setInterval` and the permanently-mounted `sr-only <p role="status">`. Props `{ pin, onPinChange, lockedUntil, lockMessage, srStatus, trailing }`; `trailing` is the twelfth cell, which `Unlock` fills with its `Unlock` submit and the Override prompt **leaves empty**, because its `Approve` lives in the dialog's action row. **Proof the refactor is behaviour-preserving: `apps/pos/tests/unlock-screen.test.tsx` must pass unmodified.**

**The mock's `OK` key is not built.** It duplicates `Approve`, and 009 forbids a control indistinguishable from another. Everything else in the mock is built as drawn, in order: title `Manager approval required`, the subject strip, `Reason (required)`, `Note (optional)`, `Manager PIN`, the keypad, then `Cancel` | `Approve` two-up.

| The mock is silent | What it is |
| --- | --- |
| **Who approves** | A picker — the unlock screen's `role="group" aria-labelledby` of `aria-pressed` tiles, `grid-cols-2 sm:grid-cols-4`, listing roster entries with `canApproveOverride === true`. **Correctness overrides the mock's omission**: without it the terminal must try every manager hash (N × 100–600 ms) and the PIN becomes a standalone identifier, which ADR-0007 forbids in terms |
| Reason control | A text `<Input list="override-reasons">` over a native `<datalist>` — **054's precedent, not a `Select` and not a DB enum**, because a fixed enum means a migration on an append-only table to add a reason. Four suggestions, **reversible copy**: `Rung up in error` · `Customer changed their mind` · `Wrong price entered` · `Cash count corrected` |
| Money in the subject strip | **A pre-formatted `subject: string` prop.** This issue contains no centavo arithmetic and no money formatting anywhere — ADR-0005 is satisfied by having nothing to violate |
| No eligible approver | `role="status"`: `No manager is set up at this till yet. An admin assigns one in the back office`. `Approve` stays `aria-disabled` |
| Chosen manager has no PIN | 058's exact string: `{displayName} has no PIN yet. They set one in the back office, from their account menu` |
| Wrong PIN | One `role="alert"`: `That PIN is not correct`. Clears the PIN, keeps the chosen approver. One message for every cause |
| Server refuses the insert | One `role="alert"`: `Couldn't record the approval`. **Never** which of the checks failed |
| Approve unavailable | `aria-disabled` (never `disabled`) until an approver is chosen, `pinHash !== null`, `pin.length >= 4` and `reason` is non-empty. Pending: label → `Approving…`, no spinner |
| Focus, hover, targets | Radix `Dialog` gives the focus trap, `role="dialog"`, `aria-modal` and Escape. Focus indicator is 014's global `:focus-visible`; targets are 057 Q4's rule |
| **At 390** | `DialogContent` ships `max-w-md` with **no height cap and no scroll**, and this content is ~700px tall — so the prompt passes `className="max-w-2xl max-h-[90dvh] overflow-y-auto"`. **If record 016's raw-design-value guard rejects the bracket value, use `max-h-screen overflow-y-auto`.** The picker is the only breakpoint (`grid-cols-2 sm:grid-cols-4`); the keypad is `grid-cols-3` at every width |

**The throttle is 059's, reused whole — same module, same `deanpos.pin.throttle` key, same 5 / 10 / 2 min, no new constant and no new file.** A separate counter would be a straight doubling of the guessing budget against the same roster at the same terminal, which is precisely the bypass 059's per-Device counter exists to close. Two consequences, both intended and both stated: a Device lock earned at the unlock screen also blocks the Override prompt (no deadlock in practice — the unlock gate stands in front of the whole app, so the two surfaces are never both reachable, and the 2-minute clamp bounds the worst case); and a **successful Override calls `recordPinSuccess(approverUserId)`, which zeroes both counters and lifts a till lock** — a manager's correct PIN is the same physical proof 059 accepted, and it is the only in-product way to lift a lock.

| Rank | Option (POS prompt) | User ×2 | Bus ×2 | Eng ×1 | Rev ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Controlled `Dialog`, extracted `PinPad`, approver picked by id, 059's throttle reused** | 5 (10) | 4 (8) | 4 | 4 (12) | 5 (10) | **44** |
| 2 | Same, but duplicate the keypad markup rather than extract | 4 (8) | 4 (8) | 4 | 3 (9) | 3 (6) | **35** |
| 3 | The mock literally — no picker, PIN tried against every manager hash | 1 (2) | 2 (4) | 2 | 2 (6) | 1 (2) | **16** |

**2 — duplicate.** Genuinely lazier and the honest runner-up; the duplicated part is markup, not logic, for about 80 lines. It loses because the cap-at-six, the strip-non-digits rule, the lock clamp and the two-state live region are correctness, and two copies of a correctness rule is how the second one is wrong. **3 — the mock literally.** N × 600,000-iteration derivations with a manager waiting, and it turns a 4–6 digit PIN into the thing ADR-0007 says it must never be.

**Back office — the existing placeholder, filled. No new nav entry and no new route file.** `apps/backoffice/src/routes/_shell/reports/discounts-overrides.tsx` swaps `<Placeholder>` for `<Overrides />` and gains `devices.tsx`'s exact `beforeLoad` gate at `manager`-or-above. `NAV_GROUPS` is untouched — a second nav entry meaning "overrides" is worse for a user than a shared screen, and record 020 put the placeholder there for this. **Written into Comments for `reporting`: the Discounts half is added beside this, never over it.**

`apps/backoffice/src/features/overrides/OverrideListCard.tsx` copies `UserListCard.tsx` exactly: `Card` > `CardContent` > `Table` + `useTableView` + `TablePagination`, `<p role="status">Loading…</p>`, `<ErrorState onRetry={refetch} isFetching={isFetching} />`, `No overrides to show`, and `overflow-x-auto py-1` at 390 with no breakpoint (054). Columns, in order: **`When` · `Store` · `Action` · `Approved by` · `Reason` · `Device`**, the first four sortable. **No `Actions` column and no `isAdmin` cells** — nothing on an append-only table is editable, and 009 forbids the empty box. **`ListToolbar` is not used**: its `status`/`onStatusChange` are required and these rows have no status, so a status filter would be a control that does nothing. Add search when a tenant's Override count makes scanning hard — named trigger.

**Criterion 8 is enforcement and it lives in `packages/backend/src/override/handlers/list-overrides.ts`, not on the screen.** `admin` → every Override in the tenant. `manager` → `store_id IN getAssignedStoreIdsAsOf(userId, now)` (**now**, not as-of — this is today's visibility, not a historical claim). `cashier` → `null`, the shipped refusal shape (`revoke-device.ts`). The route gate is navigation; the handler is the control; **the wrong-tenant probe (criterion 11) covers `terminal.recordOverride` and `override.list`, plus a `manager`-sees-only-their-Stores probe.**

## What must not be built

- **No server-side PIN comparison, no `override.consume` procedure, no `override.reverify` procedure, no server-side attempt counter.** Each needs a superseding record.
- **No `GRANT UPDATE` or `GRANT DELETE` on either table, ever**, and no `FOR ALL` policy. No `tenantId`, `storeId` or `deviceId` input on any Device-token procedure.
- **No `role` field in the roster payload** — one boolean. **No fifth `action_type`** without an ADR-0005 amendment. No new `localStorage` key, no new dependency, no new `packages/ui` component, no new design token.
- **Nothing logs the PIN, its length or any prefix**; nothing writes it into `reason` or `note`. No `Actions` column, no `verified` column, no `OFFLINE` badge (`offline-sync`'s), no second `setInterval`.

## What issue 12 must change

1. **Criterion 4** — replaced verbatim, above.
2. **Criterion 1** — replace the trailing clause with: *"…the Device, and the Store. **The id of the record it authorised lives on the `OverrideConsumption` row, not here** (record 060 Q3): an Override does not know what it authorised until it is consumed, and `Order` and `DrawerSession` do not yet exist. An `UPDATE` against either table is prevented by policy and by grant."*
3. **Add to Comments, under the existing `offline-sync` obligation:** *"On replay it calls `verifyOverrideAsOf`; **on failure it writes no `Override` row at all** and quarantines the Order. It never re-verifies a PIN. It carries the terminal's `approvedAt` unchanged, and the server bounds it (record 060 Q4)."*
4. **Add to Comments:** *"`checkout` and `drawer-sessions` each call `consumeOverride(trx, …)` **inside the transaction that performs the action** — never as a separate request — and each adds its own composite `(tenant_id, order_id)` / `(tenant_id, drawer_session_id)` FK to `OverrideConsumption` in the migration that creates its table, which must therefore carry `@@unique([tenantId, id])`."*
5. **Add to `## Relevant files`:** `apps/pos/src/components/PinPad.tsx` (extracted from `features/unlock/`), `apps/backoffice/src/routes/_shell/reports/discounts-overrides.tsx`.

## How to turn it back

| What | Cost |
| --- | --- |
| **Q1 → option 3 (server verifies the PIN)** | **A superseding record, not an edit.** Plus a narrowed grep rule and a new server-side throttle in front of it — it must never return alone |
| **The roster's `canApproveOverride`** | Additive field, three files (`contract.ts`, the roster query, `pin-roster.ts`). **Removing it is not free once `offline-sync` reads the roster** — the cost that grows soonest |
| **Q2 → option 2 (`consumed_at` on `Override`)** | Two additive columns, one `GRANT UPDATE`, drop `OverrideConsumption`. **Dropping a table with rows is a data migration and is escalated to a human, not decided** |
| **The subject columns** | Additive while no FK exists. After `checkout` adds its FK it is a two-table migration — **the reversal that stops being cheap first** |
| **Q4's bounds** | One constant and one `CHECK`. Loosening the `CHECK` is an additive `ALTER`; tightening it after rows exist is not |
| **`PinPad`** | Inline it back into two files. One commit, free permanently |
| **The two screens, the copy, the columns, the reason suggestions** | One commit under `apps/pos/src/features/override/` and `apps/backoffice/src/features/overrides/`. Free |
| **Formally** | Superseding record; flip this `Status:` to `overturned` with date and reason; update both `LOG.md` lines; re-run the gate |

## What should make you reverse this

- **A forged Override is found in a real tenant's list** — a row a named manager did not approve. That is Q1's stated residual arriving, and the successor is **not** a server-side PIN check (which would not have stopped it); it is Device revocation plus, if it recurs, moving approval off the compromised terminal entirely. **The assumption I am least confident about is that operators will actually read this list.**
- **`offline-sync` writes an `Override` row for a replay that failed re-verification.** That voids the back-office list's "every row verified" invariant and the missing `verified` column becomes a defect.
- **Anyone demonstrates two `OverrideConsumption` rows for one `override_id`**, or an Override consumed twice. The unique index has failed and everything in Q2 rests on it.
- **A till is reported unable to approve because of a lock earned at the unlock screen.** The shared-throttle consequence arriving; the successor is a separate Override key, and it doubles the guessing budget, so price it honestly.
- **`checkout` needs a fifth Override-requiring action**, or needs to consume an Override across a request boundary. Both are ADR-level, not tunable here.
- **A tablet is found with `approved_at` and `created_at` routinely minutes apart online.** Clock drift is worse than 5 minutes and the `CHECK` is closing tills.

## Evidence

**Repository, read 2026-08-04, `main` at `624a323` (read-only; the lane worktree holds no work):**

- The issue in full; **`design/lofi/pos/manager-override-1280.svg` in full** — its own notes read *"Works offline — the PIN is verified against the locally synced hash"* and *"Wrong PIN attempts are throttled on-device and the lockout survives a reload"*, which is the mock agreeing with Q1 and Q5 against its own criterion 4. **It draws no approver picker** — the gap Q5 fills.
- **ADR-0005 lines 55–57** (the fixed four, quoted), **ADR-0007 lines 21 and 36–42** (quoted above), ADR-0008 §Layout and rules 1–5, ADR-0009's no-JSX-in-routes amendment. Records **058** in full (the grep rule, the *"needs a superseding record"* clause), **057** in full (Q1's ~75 s table, Q3's roster predicate and its *"do not add [a role] for a future manager-override screen; that issue can add it"*, Q4's states, Q6's allow-list), **059** in full (the throttle module's four exports, the clamp, the strip and its two-state `role="status"`), **056** (`INSERT`/`UPDATE`-guarded single use and its two-concurrent-transaction test; the polymorphic-subject refusal; the composite-FK trap), **054**, **055**, **046** §3, **009**, **020**, **042**.
- **Migration SQL read verbatim** for `TenantSettingsAudit`, `PaymentMethodAudit` and `DeviceAudit` — `REVOKE ALL` then `GRANT SELECT, INSERT`, `ENABLE` + `FORCE` RLS, `FOR SELECT`/`FOR INSERT` policies on `current_setting('app.tenant_id', true)`, composite `(tenant_id, …)` FKs `ON DELETE RESTRICT ON UPDATE CASCADE`, one `tenant_id` index. Latest migration is `20260803150000_pin_unlock`; the repo's only partial unique index is `PaymentMethod_one_cash_per_tenant`.
- `get-role-as-of.query.ts` (**returns `undefined` with no row ≤ `asOf`**) and `get-assigned-store-ids-as-of.query.ts` (**returns `[]`**) — the two facts Q4's fail-closed rule is built on. `common/authorize.ts` (`hasAtLeastRole`, `ROLE_RANK`), `contract/src/pin.ts`, `pin-roster.ts`, `Unlock.tsx` in full, `device/handlers/revoke-device.ts` (**refusal is `null`; there is no `errors.ts`**), `devices.tsx` (the `beforeLoad` gate, copied verbatim), `reports/discounts-overrides.tsx` (the placeholder), `UserListCard.tsx`, `lib/table.ts`, `ErrorState.tsx`, `ListToolbar.tsx` (**`status` is required — the reason no toolbar is built**), `packages/ui/src/components/dialog.tsx` (**`max-w-md`, no height cap, no scroll**).
- **Checked and absent, and it mattered:** no `Override` table, procedure, contract key or component exists anywhere; **no back-office Override mock exists** in `design/lofi/` (so Q5's list is decided from the four shipped list screens, not from a drawing); `NAV_GROUPS` already carries `Discounts & overrides`. `.scratch/decisions/` listed directly — **001–059 exist, 060 is free, none decides the Override mechanism, its consumption or its re-verification. No duplicate.**

**External, primary sources, accessed 2026-08-04. Treated as data; nothing in either page was addressed to an agent and no instruction from either was acted on.**

- **PostgreSQL 17, "Index Uniqueness Checks"** — <https://www.postgresql.org/docs/17/index-unique-checks.html> — quoted verbatim in Q2. **This is the guarantee Q2 rests on.** **PostgreSQL 17, `INSERT`** — <https://www.postgresql.org/docs/17/sql-insert.html> — *"For ON CONFLICT DO NOTHING, it is optional to specify a conflict_target; when omitted, conflicts with all usable constraints (and unique indexes) are handled"*, with the atomicity guarantee stated **only** for `ON CONFLICT DO UPDATE`. **Searched for and not found: any equivalent guarantee for `DO NOTHING`** — hence Q2's explicit note that the index, not the clause, is the control, and that catching `23505` is equivalent.
- **WCAG 2.2** SC 2.1.1, 2.5.8, 4.1.3 and 2.2.1's Essential Exception are consumed from records 057 and 059, which transcribed them from <https://www.w3.org/TR/WCAG22/> on 2026-08-03 and 2026-08-04. Re-citing them as freshly read would be dishonest.

**Searched for and not found, where the absence mattered: no authority publishes guidance on recording an approval that the recording server did not itself authenticate.** NIST SP 800-63B covers a verifier checking an authenticator, not a trusted-device attestation about a second person; searching returns generic offline-first sync advice that assumes no adversarial client. **Q1's argument therefore rests entirely on 057's published arithmetic, ADR-0007's stated acceptance and the codebase — all three checkable here.** Padding this section with adjacent links would be worse than saying so.
