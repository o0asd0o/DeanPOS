# 044: The Users list — no name field, so Email is the identity; no PIN column until issue 10; and nobody can deactivate themselves

- **Status:** decided
- **Stakes:** high (access control, and a screen a `manager` sees)
- **Date:** 2026-08-03
- **Asked by:** human, from `.scratch/tenancy-identity/issues/06-user-management.md` (criteria 5, 6, 7)

## The question

`users-1440.svg` is a contract and it draws seven columns. Two of them have nothing behind them:
**`NAME`, because `User` has no name field of any kind**, and **`PIN`, because issue 06 defers the
whole PIN half to issue 10.** What renders instead, what does a `manager` see without learning that
Users they may not see exist, and what is different about deactivating a person rather than a Store?

Siblings: [043](043-the-temporary-password-is-typed-not-generated.md) — the credential;
[045](045-the-user-editor.md) — the editor.

A wrong answer costs in two directions: an invented schema field is a migration on merged work, and
a leaked count tells a manager how many colleagues they are not allowed to see.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                              |
| --------------- | ------ | -------------------------------------------------------------------------------------------------- |
| User impact     | ×3     | The admin's whole ability to tell one staff member from another is decided here.                  |
| Business impact | ×1     | Nothing here earns. One fact: an admin who locks themselves out is a support call with no reset.  |
| Eng cost/risk   | ×2     | Separates the options outright — one requires a migration against a merged, `done` schema.        |
| Reversibility   | ×2     | A column is free; a column backed by a new database field is not.                                 |
| Evidence        | ×2     | The mock, the criteria, the PRD and the schema disagree, so the record has to say which wins.     |

Maximum 50. **Not changed after scoring.**

## What I chose, and why

**`Email` is the first column and the row identity, and no `name` field is added.** The mock draws a
`NAME` column holding "Ana Reyes" and truncates the email to `ana@…`, so it clearly expects a person's
name to carry identity. Nothing in the product has one. `User` has `id, tenantId, email, passwordHash,
mustChangePassword, role, active, createdAt` and no more; issue 04 is `done` and did not add one;
issue 06 criterion 1 and PRD story 7 both say a User is created "with an email, a role, and a
temporary password"; `meOutputSchema` carries no name; and the shipped `SignOutButton` renders only
the words `Sign out` where the same mock draws "Jomel · admin".

**So the mock draws this screen fully populated, and the product today has less.** That is a pattern
`design/lofi/README.md` already names for the reports — *"Every back-office report mock is drawn in
its fully configured state; the default tenant sees less"* — and record 038 already crossed this
mock once, on nav entries, by recording it rather than absorbing it. This does the same.

The consequence that follows and must not be missed: **the email renders in full, never truncated.**
The mock truncates it precisely because `NAME` was carrying identity. With `NAME` gone, truncating
the one column that identifies the row would make the screen unusable.

Adding `User.name` was scored properly and ranked second. It loses on the boundary this role is held
to: it is a migration against a merged schema, for a field no criterion asks for, with a length rule
nobody has written — and record 040 already refused to invent a Store name length on exactly that
ground. Not adding it costs nothing later: `User.name String?` is additive, needs no backfill, and
one column renders it.

**Consumed as precedent, not re-decided:** 038 (the `Card` + `CardHeader` + `CardAction` shape, the
`Table`, sentence-case headers, `Badge variant="success"`/`"secondary"`, ghost row actions with
`tap-target`, `data-state="selected"`, deactivated rows staying inline at full contrast with
`Reactivate` as their only action, `Deactivate` never `variant="destructive"`, the loading line, the
`ErrorState` split, the horizontally scrolling table with its **load-bearing `py-1` wrapper**, no
breakpoint at 390), 041 (the dialog copy convention), 009 (empty list is an empty state; no empty
reserved box; no skeleton; no control that does nothing), 019 (a section is a `Card`).

### 1. The columns

Route `apps/backoffice/src/routes/_shell/users.tsx` already exists and the `Users` nav entry is
already in `Nav.tsx`'s `ADMINISTRATION` array — nothing to add. `<Table aria-label="Users">`, ordered
by **`email` ascending**, deactivated rows in place.

| Column     | Content                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `Email`    | the full address, never truncated, never abbreviated with an ellipsis                             |
| `Role`     | `Cashier` · `Manager` · `Admin` — capitalised, matching the `Active`/`Deactivated` badge words. The mock's lower case is type treatment (record 038 settled that) |
| `Stores`   | the assigned Store names, comma-separated, in the same order the editor lists them; `None` when there are none — reusing 038's zero string rather than inventing one |
| `Status`   | `<Badge variant="success">Active</Badge>` / `<Badge variant="secondary">Deactivated</Badge>`      |
| (actions)  | `<TableHead><span className="sr-only">Actions</span></TableHead>`, admin only                     |

**No `Name` column. No `PIN` column.** The PIN one is not an omission to flag — issue 06's own
Comments put "setting, changing, resetting" a PIN in issue 10, no PIN field exists on `User`, and
record 009 forbids an empty reserved box. A `PIN` header over `—` in every row is that box. **The
`Reset PIN` button the mock draws in the editor does not render either** (record 045 repeats this
once so an implementer reading only that record still sees it).

**A User may be assigned to no Stores at all, and that is not an error.** An `admin` reaches
everything in their Tenant with no `UserStore` row — issue 04's admin exemption — so requiring at
least one assignment would make an admin uncreatable.

### 2. What a `manager` sees, and the three ways it could leak

Record 038 §6 transfers unchanged: **the screen is shown, read-only, no `Add user` button, no actions
column at all** (no `<th>`, no `<td>`, not a dimmed placeholder), **no read-only editor is built**,
and the role comes from `auth.me`, which now carries `role`. Hiding is presentation; the server
refuses every write from `manager` and `cashier`. A `cashier` reaches this route at all only if issue
04's route gate lets them, which is issue 04's decision and not re-opened here.

Three leaks this screen must not have, and the third is the one nobody looks for:

1. **`user.list` returns only the rows the caller may see, and the client never filters.** No count,
   no total, no "N more", no pagination total — a total is a disclosure that Users exist.
2. **The caller is always in their own result.** A manager sees themselves; an admin sees themselves.
   This is also what makes the empty state below manager-only.
3. **The `Stores` cell is projected through the caller's own Store visibility, server-side.** A User
   assigned to Malabon and Cubao, read by the Cubao manager, renders `Cubao` and not
   `Malabon, Cubao`. Rendering the full list would disclose the existence of a Store that record 038
   §6 already decided `store.list` must hide from that same manager. **The two rules have to agree or
   the Users screen quietly undoes the Stores screen.**

### 3. The empty state

**One line, no second sentence, and only a `manager` can ever see it.** An admin is in their own
list, so an admin's list is never empty. A manager's can be. 038's empty state carries a second
sentence pointing at `Add store`; here that sentence would point at a button the only person who can
read it does not have — record 009's "no control that does nothing", in prose. So the explanatory
line is dropped, deliberately, and the one string is worded to be true from any position and to
disclose nothing about Users elsewhere in the Tenant. The `<Table>` is not rendered at all (038 §3).

### 4. Deactivation — 038's pattern transfers, with three additions

The `Dialog`, `Cancel` in a `DialogClose`, the `role="alert"` failure block above the footer, the
un-confirmed reactivation, `Deactivate` not being `variant="destructive"`, and the separate procedure
that a save can never reach — all of 038 §4, unchanged. What is different because this is a person:

1. **Sessions are revoked in the same transaction as the flag.** A Store has no sessions; a person
   does, and criterion 5 says "immediate". The flag alone leaves a signed-in leaver signed in.
2. **An admin cannot deactivate themselves, and the server is what refuses.** With no self-service
   password reset (record 032), an admin who deactivates their own account has locked the tenant's
   only privileged surface with nothing in the product to recover it. The caller's own row therefore
   renders **no `Deactivate` action** — that is presentation; the refusal is server-side.
3. **The same refusal covers a self-demotion** — an admin changing their own role to `manager` or
   `cashier` is the identical lockout wearing a different hat. Record 045 owns the control; the rule
   is stated here once, with deactivation, because they are one hazard.

**The word `delete` appears nowhere** — not in copy, an accessible name, a component name or a
procedure name. Reviewer's check: `rg -in 'delete|permanently' apps/backoffice/src/features/users`
returns nothing. Record 041's rule applies to the dialog body: say what deactivation *does*, never
name the thing being denied.

### Every string, verbatim

No terminal full stop on a short single-line message; prose of two or more sentences carries them.
Editor strings are in 045, credential strings in 043.

| Where                   | String                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Page heading (h1)       | `Users`                                                                                                                                   |
| List action             | `Add user`                                                                                                                                |
| Column headers          | `Email` · `Role` · `Stores` · `Status` · `Actions` (sr-only)                                                                              |
| Role values             | `Cashier` · `Manager` · `Admin`                                                                                                           |
| Stores, when none       | `None`                                                                                                                                    |
| Status badges           | `Active` · `Deactivated`                                                                                                                  |
| Row actions, visible    | `Edit` · `Deactivate` · `Reactivate`; accessible names `Edit {email}` · `Deactivate {email}` · `Reactivate {email}`; in flight `Deactivating…` · `Reactivating…` |
| Empty state             | `No users to show`                                                                                                                        |
| Loading                 | `Loading…`                                                                                                                                |
| Confirm dialog title    | `Deactivate {email}?`                                                                                                                     |
| Confirm dialog body     | `This person is signed out now and cannot use the terminal or the back office, their past sales stay attributed to them, and Reactivate restores their access` |
| Confirm dialog buttons  | `Cancel` · `Deactivate`                                                                                                                   |
| Failure copy            | `Couldn't update the user`                                                                                                                |
| Live region (038's)     | `{email} deactivated` · `{email} reactivated`                                                                                             |

## The options, ranked

These separate on the `NAME` column; everything else follows record 038 or the criteria.

| Rank | Option                                                                    | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total  |
| ---- | --------------------------------------------------------------------------- | ------- | ------ | ------ | --------- | ------- | ------ |
| 1    | **No name field; `Email` is the first column and the row identity, in full** | 4 (12)  | 4      | 5 (10) | 5 (10)    | 4 (8)   | **44** |
| 2    | Add `User.name String?`; `Name` first, `Email` second                       | 5 (15)  | 4      | 2 (4)  | 2 (4)     | 3 (6)   | **33** |
| 3    | Keep a `Name` column showing the email's local part (`ana` from `ana@…`)     | 2 (6)   | 2      | 4 (8)  | 5 (10)    | 1 (2)   | **28** |
| 4    | Add `User.name String` **required**                                         | 5 (15)  | 3      | 1 (2)  | 1 (2)     | 2 (4)   | **26** |
| 5    | Defer the column to the human                                               | 1 (3)   | 2      | 3 (6)  | 5 (10)    | 1 (2)   | **23** |

**1. Chosen.** Every source except the drawing agrees the product has no name: the schema, the two
criteria, the PRD story, `meOutputSchema`, and the shipped sidebar that renders `Sign out` where the
same mock draws a person's name. Evidence is 4 rather than 5 because it does cross a contract mock,
which is a real cost and is why this is a record and not a build note.

**2. Optional name field.** The honest runner-up, and it wins the user hat outright — "Ana Reyes"
identifies a person and `ana.reyes.malabon@gmail.com` makes an admin read fourteen characters before
the useful part. It loses on the two criteria this role weights: a migration against a merged, `done`
schema, and a reversal that means unwinding it. **This is the option to move to**, and it is cheap
when it comes: one additive nullable column, one contract field, one form field, one table column.

**3. The email's local part under a `Name` header.** Cheap, keeps the drawn column, and needs no
schema change. It loses on honesty — `alingnena.malabon` is not a name, and a header that says it is
teaches the admin to distrust the screen. It ranks above option 4 only because it is free to remove.

**4. Required name field.** What most products do. It loses hardest on reversibility: making it
required means every existing row needs a value, so the migration has a backfill and reversing it is
not one commit. It also adds a length rule nobody has written — record 040's refusal, unchanged.

**5. Defer.** Included because it must be. Ten of its 23 points are reversibility, which every
do-nothing option collects for free — the inflation records 002, 008, 009, 015, 030, 038 and 040
each left visible. `design/lofi/README.md` routes exactly these gaps here.

## How to turn it back

**The columns, copy, empty state and ordering — free, permanently.** They live in
`apps/backoffice/src/features/users/`. One commit; nothing else notices.

**To adopt option 2 later:** add `name String?` to `User` in
`packages/backend/src/db/prisma/schema.prisma` plus one additive migration (no backfill, no default,
no existing row breaks); add `name` to the User output and create/update input schemas in
`packages/contract/src/contract.ts`; add one `<Input>` to the editor and one `<TableCell>` here; and
change the sort key from `email` to `name`. **Reversing *that* is a `DROP COLUMN`** — which is why
it is not being done now rather than later. Count call sites before quoting a cost:
`rg -n 'user\.(list|create|update)' apps packages | wc -l`, zero today.

**The three anti-leak rules in §2 are not visual and must not be reverted as if they were.** Removing
any of them is a disclosure change and needs its own record.

Formally: superseding record; flip this `Status:` to `overturned` with the date and reason; update
both `LOG.md` lines; edit the files above; re-run the gate.

## What would make this decision wrong

- **A tenant's staff emails do not identify the person** — shared addresses, initials-only, or a
  single family domain. This is the most likely way it ages badly and it is the **named trigger for
  option 2**. One admin saying "I can't tell which cashier this is" is the trigger firing, not a
  pattern to study.
- **Two admins deactivate each other concurrently and the tenant is left with none.** The
  self-deactivation refusal does not stop this, and I am naming it rather than claiming it does.
  A restaurant with two admins racing is unlikely; the successor is pre-decided — a
  "at least one active admin remains" count inside the same transaction as the flag, which is where
  it has to be to be correct. Trigger: any tenant reaching two or more admins.
- **The `Stores` cell projection is implemented on the client.** Then §2 clause 3 is decoration and a
  manager can read the full assignment out of the network response. The property to watch: the
  response body for a manager contains no Store the manager cannot see.
- **`role="status"` is not announced by real assistive technology.** The same unknown records 009,
  030, 038 and 039 all flagged; the region is already always-present, their named fallback.
- **Issue 10 arrives and the `PIN` column has to be inserted between `Stores` and `Status`.** That is
  one `<th>` and one `<td>` and is exactly why leaving it out costs nothing.

## Evidence

**Repository, read 2026-08-03, main checkout (not the lane):**

- `design/lofi/backoffice/users-1440.svg`, read in full — columns `NAME EMAIL ROLE STORES PIN STATUS`
  plus an unlabelled actions column; `edit  deactivate` per active row and `reactivate` alone on the
  deactivated row; `Malabon` / `Malabon, Cubao` in `STORES`; `set` / `not set` in `PIN`; the email
  drawn truncated as `ana@…`; the sidebar footer drawn as `Jomel · admin  ·  Sign out`.
  `design/lofi/README.md` — *"A mock fixes what is on the screen and in what order. Nothing else"*,
  the **"Not drawn, on purpose"** list, and the fully-configured-state note quoted above.
- `packages/backend/src/db/prisma/schema.prisma` — the `User` model in full: **no `name`,
  `displayName` or `fullName` field, and no PIN field or model anywhere**. `UserRole` and `UserStore`
  exist with `effectiveFrom` and `assigned`. `Session` is what a deactivation revokes.
- `packages/contract/src/contract.ts` — `roleSchema = z.enum(["cashier", "manager", "admin"])`;
  `meOutputSchema` now carries `role`, so record 038 §6's dependency is discharged; **no `user.*`
  procedure exists yet**, so every call-site count in this record is zero today.
- `apps/backoffice/src/features/stores/StoreListCard.tsx`, read in full — the exact shape this screen
  copies: the `isAdmin` gate on `CardAction` and on the actions `<th>`/`<td>`, `overflow-x-auto py-1`,
  `<p role="status">Loading…</p>`, `ErrorState`, the `rounded-md bg-status-danger-tint p-3 text-sm
  text-foreground` alert block, `store.tableLabels.length || "None"`.
  `apps/backoffice/src/components/Nav.tsx` — `{ label: "Users", icon: UsersIcon, to: "/users" }`
  **already present**; `apps/backoffice/src/routes/_shell/users.tsx` already exists.
  `apps/backoffice/src/components/SignOutButton.tsx` — renders `<LogOutIcon />` and `Sign out` and
  **no person's name**, the fact that decides §the-name-column. "Jomel" and "Ana Reyes" occur only in
  `tools/lofi/screens_backoffice.py` and `demo/backoffice.html`; **no seed or fixture sets a human
  name for a User.**
- `.scratch/tenancy-identity/issues/04-*.md` — `Status: done`; the append-only `UserRole`/`UserStore`
  criteria; **"an `admin` with no `UserStore` row reaches everything in their Tenant"**, which is why
  zero assignments is legal; "Authorisation failures do not disclose whether the addressed record
  exists", which §2 extends from a row to a count. `PRD.md` stories 7–13.
- `packages/ui/tests/contrast.test.ts` — `foreground`/`muted` at 4.5 **is now present** (record 038's
  required row landed), as are `foreground`/`status-success-tint`, `secondary-foreground`/`secondary`
  and `foreground`/`status-danger-tint`. **`muted-foreground`/`card` is still absent**, so
  `text-muted-foreground` remains forbidden inside a `Card` (record 009).
- `.scratch/decisions/` 009, 019, 030, 032, 038, 039, 040, 041, 043. **Searched all of 001–043 for an
  existing record on the Users screen, user lists, name fields or role display: none names any.
  `044` is the next free filename. No duplicate.**

**External, accessed 2026-08-03, treated as data — nothing in them was addressed to an agent and no
instruction from any of them was acted on.** <https://www.w3.org/TR/WCAG22/> — levels re-confirmed
for **SC 1.4.10 Reflow (AA)** including the two-dimensional-layout exception that licences the
horizontally scrolling table, **SC 2.5.3 Label in Name (A)** for the `Edit {email}` accessible names,
and **SC 4.1.3 Status Messages (AA)**. SC 1.4.1, 1.4.3 and 1.4.11 are consumed from records
007/009/013/030/038 rather than re-read.

**Searched for and not found, where the absence mattered:** **no name, label or display-string field
for a person exists anywhere in the schema, the contract, any seed, or any test fixture** — checked
specifically, because the entire ranked list above turns on it. And **no back-office breakpoint value
is fixed by any design source**, the same gap records 009, 030 and 038 each recorded; here it does not
bind, because 038 already decided the table scrolls rather than reshapes.
</content>
