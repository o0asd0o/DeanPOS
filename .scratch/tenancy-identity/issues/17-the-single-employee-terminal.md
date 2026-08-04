# 17 — The single-employee terminal

**Status:** done
**Category:** enhancement

## What to build

A Device is either **open to all** — every eligible User at its Store is offered on the unlock
screen, which is what ships today — or **restricted to one employee**, where the unlock screen
offers nobody, names the one assigned User, and asks for their PIN and nothing else.

A manager or admin can still get in. A separate, clearly-labelled control on the restricted
unlock screen opens PIN entry for the `manager`-or-above Users of that Store. That path is
**not** an escape hatch bolted on for convenience: it is the only reason a restricted till is not
a brick when the assigned employee is off sick, has no PIN yet, or was deactivated this morning.

**This is a deliberate scope addition, not a gap being closed.** The PRD carries no story for it,
and neither does any other area's. Story 36 — *"the terminal knows which PINs belong to my Store
only"* — is per-**Store** scoping and shipped as issue 10; this is a level below it. Story 35 is
about locking the till when stepping away, a different question (who may return, not who may ever
enter). `workforce` explicitly refuses to put roster data on the terminal — *"The terminal is a
till, not a staff portal"* (`.scratch/workforce/PRD.md:180`) — so nothing else will deliver this
as a side effect of knowing who is on shift.

Requested by the human, 2026-08-04.

## The shape, and the two places it must not be built

**One nullable column, not a join table.** `Device.assignedUserId` — `NULL` means open to all, so
every Device that exists today keeps its current behaviour with no data migration and no backfill.
The human asked whether this should be a list of allowed Users "for flexibility" and then answered
their own question: the real use case is one account. A list is a join table, a membership editor
and a plural empty state, all to model a case nobody has. **Build the column.** If a genuine
two-person till ever appears, `DeviceUser` is an additive migration away and this issue's UI
becomes its single-row case.

**The restriction is enforced in the sync payload, not in JSX.** `terminal.pinSync` for a
restricted Device returns the assigned User plus the `manager`-or-above Users of that Store —
nobody else. Hiding the other cashiers' buttons while still shipping their names and PIN hashes
into that till's `localStorage` would be theatre:
[record 060](../../decisions/060-the-override-is-verified-on-the-terminal-and-consumed-by-a-second-insert-only-table.md)
settled that anyone who can reach the terminal's storage can read the whole roster and grind it in
~75 s. A restricted till is sold on the promise that it holds one employee's credential; the
payload must make that true.

**`canApproveOverride` is reused as-is. Do not add a role flag.** The roster already marks
`manager`-or-above for
[issue 12](12-override-mechanism-and-re-verification.md), computed from the same effective-dated
resolvers, and it is exactly the set the manager sign-in control needs. A second flag meaning the
same thing is a second thing to keep correct.

**`OverridePrompt` is not touched.** It filters the same roster by `canApproveOverride`, and
because the filtered payload still carries every approver, manager approval keeps working on a
restricted terminal with no change to that component.

**Manager sign-in is a full unlock, not an override-scoped one.** The manager who enters their PIN
through that control becomes the acting User, the same as any unlock. Anything narrower would need
a second notion of "signed in but only for some things", which nothing in the system has and this
issue is not the place to invent.

## Acceptance criteria

- [ ] A Device carries an optional assigned User. Unset is the default and means **open to all** —
      the unlock screen behaves exactly as it does today, and every Device enrolled before this
      issue is unset after the migration.
- [ ] A tenant `admin` sets and clears the restriction per Device from the back office. A
      `manager` cannot — this matches every other Device action (record 056 Q5).
- [ ] Only a User **currently assigned to that Device's Store** may be chosen, refused on the
      server and not merely absent from the picker.
- [ ] The change is written to `DeviceAudit` with the old and new value, like `name` and `revoked`
      before it — including the clearing of a restriction.
- [ ] The synced roster for a restricted Device contains **the assigned User and the
      `manager`-or-above Users of that Store, and no one else**. Asserted on the payload, not on
      the rendered screen: no other cashier's name or PIN hash reaches that terminal.
- [ ] The restricted unlock screen shows **no chooser** — the assigned User's name and the PIN pad
      only.
- [ ] A separate, clearly-labelled control on that screen opens manager/admin PIN entry, and a
      correct PIN there unlocks as that User in full.
- [ ] **That control is present and usable when the assigned User cannot unlock** — no PIN set,
      deactivated, or unassigned from the Store since the last sync. The screen says which of
      those it is; a restricted till is never dead.
- [ ] Clearing the restriction restores the full chooser on the terminal's next sync, with no
      re-enrolment and no manual cache clear.
- [ ] The lockout of [record 059](../../decisions/059-the-pin-lockout-is-keyed-per-device-and-per-user.md)
      is unchanged and still applies on both paths: the per-Device counter and the per-User counter
      behave on the restricted screen and on the manager control exactly as they do on the open one.
- [ ] Nothing logs a PIN entered on either path.
- [ ] WCAG 2.2 AA on the restricted unlock screen and on the back-office dialog, asserted by the
      existing automated accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes — a real one, per
      [issue 13](13-wrong-tenant-probe-coverage-guard.md): it must prove Tenant B's admin succeeds
      for Tenant B, so a handler that refuses everything fails it.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/pin-unlock-1280.svg`
- Image · whole-screen · 390: `design/lofi/pos/pin-unlock-390.svg`

**Scope of the reference: the open-to-all screen only, which is the state these mocks show and
which must not change.** The restricted state is a deliberate deviation from them — the chooser
grid is *removed*, not disabled, and the manager control is new. Take the card, the PIN pad and
the type from the mock; do not look for the restricted variant in it.

The back-office dialog has no mock. Follow the shipped sheet/dialog pattern
([record 049](../../decisions/049-the-editor-is-a-detached-sheet.md),
[050](../../decisions/050-the-sheet-form-shell.md)) as `RenameDialog.tsx` does, and add nothing to
`packages/ui`.

## Depends on

- 09 — Device enrolment and revocation
- 10 — PIN unlock and the hash-sync payload
- 12 — The Override mechanism and its as-of-time re-verification

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` — the
  `Device.assigned_user_id` column, its composite FK, and the `DeviceAudit` `field` CHECK, which
  currently admits only `code_generated`/`name`/`revoked` and must be widened
- `packages/backend/src/device/handlers/**` and `db-operations/**` — the new handler, its command,
  and `get-pin-roster.query.ts`, which grows the filter
- `packages/backend/src/device/handlers/pin-sync.ts` — must pass the Device's assignment through
- `apps/api/src/routes/device.ts`
- `packages/contract/src/contract.ts`
- `apps/backoffice/src/features/devices/**` — the row action and the new dialog
- `apps/pos/src/features/unlock/Unlock.tsx` and `apps/pos/src/lib/pin-roster.ts`

## Comments

_Raised from a conversation with the human, 2026-08-04. Not sliced from `PRD.md` — it has no story
for this, and neither does any other area's PRD._

_**`DeviceAudit`'s CHECK constraints are the trap in this issue.** Record 056 Q1 wrote four of them
(`20260803140000_devices/migration.sql:114-122`), and two block this change. `DeviceAudit_field_check`
admits only `code_generated`/`name`/`revoked`. Worse, `DeviceAudit_name_has_old_value_check` asserts
`(old_value IS NULL) = (field <> 'name')` — it **requires** a NULL old value for every field but
`name`, so the criterion above, which says the previous assignee must be recorded, is refused by the
database. Widen both in the migration that adds the column. Neither shows up until the insert runs._

_**Two things were decided in the conversation rather than left open**, and both are argued above
rather than merely asserted: the single nullable column over a join table, and enforcement in the
sync payload over enforcement in the component. Reverse the first if a second employee is ever
genuinely assigned to one till; reverse the second never — it is the same reasoning record 060
used to refuse a server-side PIN check, applied in the other direction._

_**Open for the human, not blocking:** whether a restricted terminal should also refuse the
manager sign-in control when the operator wants a truly single-credential till. This issue builds
the control unconditionally, because the failure mode without it is a till that cannot be opened
at all on the morning the assigned employee calls in sick. Making it configurable is a second
switch and is not built._

## Implementation notes

Built `Device.assignedUserId` (nullable, no backfill), `device.setAssignedUser` (`admin`-only,
validates the target is active and currently assigned to the Device's Store, refused server-side),
and widened the two named `DeviceAudit` CHECK constraints purely additively — `DeviceAudit_field_check`
gained `'assigned_user'`, and `DeviceAudit_name_has_old_value_check` was replaced with a predicate that
exempts `'name'`/`'assigned_user'` from the null-old-value rule instead of only `'name'`, so every row
either constraint already accepted is still accepted; neither can reject a previously-valid row.

`terminal.pinSync` now carries `assignedUserId` and `assignedUserStatus` (`"deactivated"` |
`"unassigned"` | `null`) alongside the already-filtered `users` array, so the restricted unlock screen
can say why the assigned employee can't unlock even though they're absent from the roster by
construction. `getPinRoster` filters to the assigned User plus `canApproveOverride` entries only when
`assignedUserId` is set; `null` is byte-for-byte the pre-issue behaviour.

`Unlock.tsx` drops the chooser grid in the restricted branch and adds a "Manager sign-in" control
opening `ManagerUnlockDialog.tsx` — a full unlock (`setActingUser`), sharing the same on-device
per-Device/per-User PIN lockout keys as the open screen. `OverridePrompt.tsx` was not touched. The
back office gained `AssignUserDialog.tsx` (a `Restrict`/`Restricted` row action next to Rename/Revoke),
following `RenameDialog.tsx`'s shipped shape; nothing was added to `packages/ui`.

Tests: `apps/api/tests/device.test.ts` (`device.setAssignedUser` — admin-only, store-eligibility
refusal, audit old/new value including the clear-to-`""` sentinel, wrong-tenant probe
`[device.setAssignedUser]`), `apps/api/tests/pin-sync.test.ts` (restricted roster contents, clearing,
both `assignedUserStatus` branches), `apps/pos/tests/unlock-screen.test.tsx` (no-chooser rendering,
manager sign-in unlock, unassigned-employee message — WCAG 2.2 AA checked), and
`apps/backoffice/tests/devices-screen.test.tsx` (restrict/clear round trip through the dialog, WCAG
2.2 AA on the dialog). `apps/api/tests/wrong-tenant-probe-coverage.test.ts` passes.

Gate run exactly as specified: `vp run -w codegen`, `vp check`, `vp run --no-cache -r check` (0/10
cache hit), `vp run --no-cache -r test` (0/10 cache hit, 726 tests green — 713 baseline + 13 new).

---

**Closed 2026-08-04.** Merged to `main`; gate green at **730** tests from an empty database, migration
proven from empty and applied to `DeanPOS_dev`. 1 fix round of the 2 available, plus three
line-deletions the orchestrator applied directly. Reviewed both rounds by a second model — Codex was
rate-limited, so the judgement ran on Opus 5 — final verdict **PASS on both axes**.

**The review caught the defect this issue exists to prevent.** Criterion 5's payload assertion was
**structurally incapable of failing**: `storeA1`'s only active Users were the assignee and two
`manager`-or-above accounts, so the filter removed nobody and the restricted roster was byte-identical
to the open one — *deleting the filter entirely left the test green*, and the next test asserted the
open roster was those same three ids, which is proof the two sets never diverge. A second active
cashier with her own PIN hash is now seeded at that Store, and her id, display name **and hash** are
each asserted absent.

**Two fail-open shapes, the same mistake twice.** `DevicePrincipal.assignedUserId` was optional and
`getPinRoster`'s parameter defaulted to `null`, so *forgetting* either one compiled into "ship the
whole Store's roster, every PIN hash included, to a restricted till". Both are required now, and the
ten `asDevice({...})` literals the optionality existed to spare were updated — which is what makes the
type change bite.

**The migration silently weakened a shipped constraint.** `(old_value IS NULL) = (field <> 'name')`
forced a rename to record the previous name; the first replacement dropped that requirement while a
comment two lines above claimed it had not. Now a `CASE` that keeps `name` requiring a non-null
`old_value`, exempts `assigned_user`, and leaves everything else requiring null — verified row by row,
with a regression test asserting **both** directions on the pre-existing fields.

Also caught: criterion 10 had no assertion at all ("exercised implicitly"), and now proves the two
unlock paths share one Device counter by reading `state.device.failures === 10` after five failures on
each; the assignment dialog stayed mounted across targets, so a stale selection would have assigned a
second Device to the first one's employee; the accessibility check ran before the manager dialog
opened; and the lock copy named the locked User where the open screen deliberately does not.

**Open for the human — a convention that lives only in a `const`.** Clearing a restriction writes
`new_value: ""`, because `DeviceAudit.new_value` is `NOT NULL` per record 056 Q1 and a real NULL is
not representable. Naming it `CLEARED_SENTINEL` improved the code and changed nothing about the data:
**every future reader or exporter of `DeviceAudit` must be told that `""` means cleared.** The
reviewer's judgement, which the orchestrator accepts, is that this is the least-bad option — the
alternative relaxes `NOT NULL` for every audit field to serve one case — but that it belongs in a
decision record rather than a constant in one handler. **Not written; routed to the human.**
