# 058: The governing rule binds PIN *authentication*, not PIN *management* — so setting, changing and resetting a PIN are back-office actions, and `currentPin` is deleted rather than throttled

- **Status:** decided
- **Stakes:** **high** — credential management, an `admin`-only access-control path, and the copy a cashier reads when they cannot unlock a till.
- **Date:** 2026-08-04
- **Asked by:** the human, from a second-model review of `.scratch/tenancy-identity/issues/10-pin-unlock-and-the-hash-sync-payload.md`
- **Relates to:** [057](057-pin-unlock-verifies-locally-with-pbkdf2.md) (its Q1 arithmetic decides this; 057 stays `decided`, one string amended), [043](043-the-temporary-password-is-typed-not-generated.md) (no-gos and reset dialog inherited whole), [045](045-the-user-editor.md)/[044](044-the-users-list.md) (one clause of each superseded), [048](048-the-back-office-header.md) (`UserMenu`), [032](032-the-password-policy.md), [042](042-user-event-is-refused-because-happy-dom-has-no-activation-behaviour.md), [063](063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md) (**two clauses below superseded and one reversal trigger updated; this record stays `decided`** — 063 moves self-service out of `_shell` to a standalone `/pin` page, which is what keeps this record's cashier reachable once the shell refuses them)

## The question

Issue 10 says a PIN is *"never a credential on its own"* and that any server path accepting a PIN without a Device token is a defect. It also says a User sets their own PIN and an admin resets a forgotten one *"without a support call"*. Does that rule bind PIN **management**, or only **unlock**? A wrong answer either strands a cashier who cannot set a PIN at all, or opens a password-session path that hands out till access.

**Weights, declared before any option was scored.** **User ×2** (a cashier locked out mid-shift, and today's dead end: no surface sets a PIN at all) · **Business ×1** (the support call the issue names) · **Eng cost/risk ×2** · **Reversibility ×2** (a contract input field and a procedure's auth mode are the sticky artefacts) · **Evidence ×3** (this turns on 057's published arithmetic and on what the codebase already does). Maximum **50**. **Not changed after scoring.**

## Already decided, not revisited

- **057 Q1:** 4–6 digits is 1,110,000 candidates; the synced roster is exhaustible in **~75 s** on one rented GPU. *"No KDF saves this PIN."* What saves it is that a PIN buys nothing without the terminal.
- **057 Q1:** unlock is **always local**, verified in the browser. No server procedure verifies a PIN for unlock.
- **057 §4:** an admin reset **clears the hash to NULL**; no temporary PIN is minted. Question 3 of the brief is already answered and is not reopened here.
- **043's ten no-gos, inherited whole and now covering PINs:** no PIN in any procedure output, log, audit row, live region, URL or query key; `mutation.reset()` after success; no clipboard.

## What I chose, and why

**The rule binds authentication. It does not bind management, and the reason is arithmetic.**

The rule exists so a stolen PIN is worthless without the terminal. Setting a PIN from a back-office session does not break that: the caller proved who they are with a *password*, a strictly stronger secret than the four digits they are writing, and knowing a PIN still gets them nothing until they stand at an enrolled Device — at which point 057 already concedes they can grind the whole roster in a minute and a quarter. **The cookie path adds no capability an attacker with a terminal did not already have.**

The reviewer's `currentPin` finding is right about the oracle, and I am taking it further than it asked. **`currentPin` is deleted, not throttled.** It defends one scenario — a bystander at an unattended back-office browser who must *also* reach a terminal — and pays for it with an unmetered guessing endpoint against the weakest secret in the product. It also invents a pattern this codebase does not have: **nothing in DeanPOS verifies a current secret before replacing it.** Deleting the field means **no server procedure anywhere compares a submitted PIN against a stored hash** — the same structural refusal 057 Q3 used for the sync payload, where the safest check is the one with no field to ask with.

**The flows live in the back office, because that is the only place a password session exists.** `apps/pos` is Device-token only, and a Device token proves *store*, never *person* — so a POS-side setPin would let whoever reaches the till first claim a PIN-less colleague's first PIN. A `cashier` can already sign in to the back office (no role gate, verified), so everyone who needs the surface reaches it, and an admin resets a locked-out cashier from their own desk rather than walking to the till the cashier cannot open.

> **Superseded in part by [063](063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md) (2026-08-04).** The back office is still the right home and the reasoning above is untouched — but *"everyone who needs the surface reaches it"* no longer means *reaches it inside `_shell`*. 063 refuses a `cashier` from the shell entirely and moves self-service to a standalone `/pin` page under `_gate`, beside `/set-password`. Sign-in itself is still un-role-gated, so a cashier still signs in and still reaches the surface.

**Neither surface is a new visual pattern.** Self-service is a `DropdownMenuItem` in `UserMenu` opening a controlled `Dialog` — `SettingsDialog`'s exact shape. The admin reset is the `Reset PIN` button `users-1440.svg` already draws, over 043's reset dialog minus its field. Rung 2, twice.

> **The self-service half is superseded by [063](063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md) (2026-08-04):** the `DropdownMenuItem` stays where 048 put it but wraps a `Link to="/pin"`, and the dialog becomes a page in `AuthLayout` — `SetPassword`'s shape rather than `SettingsDialog`'s. `PinDialog.tsx` is deleted; there is one self-service surface, not two. **The admin reset is unchanged**, and so is every procedure in the table below.

## The options, ranked

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Binds authentication only; cookie-authenticated management, `currentPin` deleted, both UIs in the back office** | 5 (10) | 5 | 5 (10) | 4 (8) | 5 (15) | **48** |
| 2 | Keep as implemented — cookie + `currentPin`, hand the oracle to issue 11 | 4 (8) | 3 | 3 (6) | 4 (8) | 2 (6) | **31** |
| 3 | Both factors: management needs a cookie **and** a Device token | 1 (2) | 2 | 2 (4) | 4 (8) | 2 (6) | **22** |
| 4 | Defer to the implementer | 1 (2) | 1 | 3 (6) | 5 (10) | 1 (3) | **22** |
| 5 | Binds everything: management moves to the POS behind a Device token | 1 (2) | 2 | 2 (4) | 3 (6) | 2 (6) | **20** |

**2 — as implemented.** The honest runner-up and the only option needing no contract edit. It loses on evidence: the oracle is live *today*, issue 11 does not exist, and issue 11's throttle is on-device, so it would not cover a server procedure without inventing a second throttle.

**3 — both factors.** The safest-looking reading, and the one that fails the cashier hardest: a forgotten PIN becomes resettable only at the terminal they are locked out of — the support call the issue's first paragraph refuses — while protecting nothing option 1 leaves open.

**4 — defer.** Ten of its 22 points are the reversibility every do-nothing option collects free. An implementer picking a credential-management auth mode under time pressure is what this role exists to prevent.

**5 — management on the POS.** Last because it is actively unsafe: a Device token names the store, not the person, so first use becomes a land-grab and the server must trust the client for *who*.

## The exact instruction, per procedure

| Procedure | Principal | Input | Behaviour |
| --- | --- | --- | --- |
| `user.setPin` | **cookie / tenant session, any role.** Self-service only — acts on `ctx.principal.userId` | **`{ pin: pinSchema }`. `currentPin` removed** from `userSetPinInputSchema` in `packages/contract/src/contract.ts` and from `inputSchema` in `set-pin.ts`. **Never an `id` field** | Hash and store. Covers first use *and* change. Keep the `ctx.kind !== "tenant"` guard; **delete the `findUserPinHash` + `verifyPin` branch** |
| `user.resetPin` | **cookie / tenant session, `admin` only.** Unchanged | `{ id }` | Clears `pin_hash` to `NULL` (057 §4). Unchanged |
| `terminal.pinSync` | **Device token only.** Unchanged | `z.void()` | Unchanged |
| `user.changePin` | — | — | **Does not exist and must not be created.** One write, one procedure |

**Delete `packages/backend/src/user/db-operations/queries/find-user-pin-hash.query.ts`** once `rg -n 'findUserPinHash' packages apps` shows no other importer.

**The structural assertion that replaces throttling — add to 057 Q6's grep test:** no non-test file under `packages/backend/src` or `apps/api/src` imports `verifyPin`. That is what "no server path authenticates with a PIN" is enforced by, in one line.

**Issue 11.** Nothing here needs a throttle, because no server procedure compares a PIN. Issue 11 still owns on-device throttling, and **these four lines must be written into it when it is drafted:**

> - Throttling is **on-device and nowhere else** — unlock is verified in the browser (057 Q1) and **no server procedure verifies a PIN** (058), so no server-side attempt counter exists or may be added.
> - Keyed per `userId`, **persisted behind the existing accessor-module pattern so it survives a page reload** — an unthrottled reload is the whole bypass.
> - **On-device throttling is not a security boundary and issue 11 must say so.** Whoever holds the tablet can clear it; 057 already concedes the roster is grindable in ~75 s. It exists against a bystander. Revocation is the mitigation (ADR-0007).
> - A server-side attempt counter needs a superseding record — it means a PIN authenticating a request.

## The two surfaces, and every string

**Self-service — `apps/backoffice/src/features/pin/PinDialog.tsx`,** opened from a new `DropdownMenuItem` in `UserMenu.tsx` (label `PIN`, a `lucide-react` icon as its siblings have, between `Settings` and `Sign out`, **not role-gated**). Controlled `open`/`onOpenChange` like `SettingsDialog` — 048's reason holds: a `DialogTrigger` inside a menu item unmounts with the menu. One field: `PasswordInput` (043's reveal), `id="pin"`, native `<label htmlFor="pin">`, `inputMode="numeric"`, `autoComplete="off"`, `required`, `minLength={4}`, `pattern="\d{4,6}"`, **no `maxLength`** (032's silent-truncation no-go). Native constraint validation, no validation code (040). If `PasswordInput` does not forward those attributes, forward them through its existing prop spread — one line, no new prop, no new component.

**Admin reset — the `Reset PIN` button the mock draws**, in the user editor's edit mode beside `Reset password`, opening a confirm `Dialog` with **no field** (the reset clears the hash). Copy `apps/backoffice/src/features/users/DeactivateDialog.tsx`. **Its own procedure, never the editor's save** (045 §4 clause 4).

| Where | String |
| --- | --- |
| Menu item · dialog title · field label | `PIN` · `Set your PIN` · `PIN` |
| Dialog description | `You use this PIN to unlock a till. It is four to six digits, and nobody else is shown it.` |
| Dialog buttons · failure · live region | `Cancel` · `Save PIN` → `Saving…` · `Couldn't save the PIN` · `PIN saved` |
| Reset button · dialog title | `Reset PIN` · `Reset PIN for {email}?` |
| Reset dialog body | `This clears their PIN. They set a new one themselves before they can unlock a till again` |
| Reset buttons · failure · live region | `Cancel` · `Reset PIN` → `Resetting…` · `Couldn't reset the PIN` · `PIN reset` |

**One title for both first use and change.** The back office is deliberately not told whether a User has a PIN — no `hasPin` flag and no `pinHash` on `auth.me` or any back-office payload — and 044's refusal of a `PIN` column stands.

## What must change outside this record

**Issue 10's governing rule** — replace the `## What to build` paragraph beginning *"The rule that governs every line of this issue"* with:

> **The rule that governs every line of this issue:** the Device proves *which tenant and store*; the PIN proves *which person*. **A PIN never authenticates a request.** Any server path that accepts a PIN as proof of identity — with or without a Device token — is a defect, and unlock in particular is refused without a valid, unrevoked Device token. **Setting, changing and resetting a PIN are back-office actions authenticated by the signed-in password session, which is a stronger factor than the PIN it writes; they require no Device token and they verify no PIN** — see [record 058](../../decisions/058-pin-management-is-a-back-office-action.md).

**Issue 10 acceptance criterion 1** — replace with:

> - [ ] A User sets their own PIN, and changes it, from the account menu in the back office; an `admin` resets a forgotten one from the user editor, which clears it so the User sets a new one. The PIN is 4–6 digits, and **no procedure ever verifies a submitted PIN against a stored hash** (record 058).

**Record 057 Q4's "Chosen User has no PIN" string** is now wrong — the terminal cannot set a PIN at any connectivity. Replace it, in `Unlock.tsx` and in 057's table, with:

> `{displayName} has no PIN yet. They set one in the back office, from their account menu`

**One clause of 044 and one of 045 are superseded; both records stay `decided`:** 044 §1's *"The `Reset PIN` button the mock draws in the editor does not render either"* and 045's line 179 repeating it. Their stated reason — *"no PIN field exists on `User`"* — expired when issue 10 added the column.

## How to turn it back

| What | Cost |
| --- | --- |
| **Restore `currentPin`** | One field in `userSetPinInputSchema`, one branch in `set-pin.ts`, one field in `PinDialog.tsx`, restore `find-user-pin-hash.query.ts` from this commit's parent. **Four files, no migration.** It must return *with* a throttle in front of it — restoring the field restores the oracle |
| Move management behind a Device token (options 3, 5) | **Not an edit — a superseding record.** No POS principal proves *which person*; one would have to be designed |
| The two dialogs and the menu item | One commit under `apps/backoffice/src/features/pin/` and `features/users/`. Free, permanently |
| The unlock copy | One string, two places |
| Formally | Superseding record; flip this `Status:` to `overturned` with date and reason; update both `LOG.md` lines; re-run the gate. **No migration anywhere — `pin_hash` is untouched** |

## What should make you reverse this

- **A PIN takeover from an unattended back-office session actually happens.** The residual this record knowingly accepts. Successor is option 2 — `currentPin` restored **together with** issue 11's throttle applied to it, never alone.
- **A role gate is added to back-office sign-in, or a cashier exists without a back-office account.** Then first-use PIN setting dies silently and that cashier can never unlock. **The assumption I am least confident about**: it holds today and nothing in the repo protects it.
  - **Half-fired, and answered — [063](063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md), 2026-08-04.** A role gate was added, but to **`_shell`**, not to `auth.signIn`: a `cashier` is refused from the shell and redirected to `/pin`. 063 relocates the surface in the same change rather than leaving it stranded, so this record's conclusion survives whole. **The other half stays armed**: a role gate on `auth.signIn` itself would still kill first-use PIN setting, and nothing yet protects against it.
- **Any server procedure gains a comparison of a submitted PIN against a stored hash.** That voids the argument rather than tuning it; the grep above catches it.
- **`auth.me` or any back-office payload starts carrying `pinHash` or a PIN-derived field.**
- **The product needs a PIN to authenticate where no Device token is present** — 057 already names this trigger, and it supersedes both records at once.

## Evidence

**Read 2026-08-04 — worktree `.worktrees/10-pin-unlock` (read, not edited) and `main`:**

- `packages/backend/src/user/handlers/set-pin.ts` (the `currentPin` → `findUserPinHash` → `verifyPin` branch deleted here) and `reset-pin.ts` (`hasAtLeastRole(role,"admin")`, clears to NULL, returns `{ ok }` only). `packages/contract/src/contract.ts:329–330, 383`; `apps/api/src/routes/user.ts:34–38`, `routes/device.ts:38–39`, `apps/api/src/app.ts:157–190` — the two auth paths.
- **No production caller of `user.setPin` or `user.resetPin` exists anywhere** — only `apps/api/tests/pin-management.test.ts`. That gap is why criterion 1 is unmet today, and closing it is half this record.
- `apps/pos/src/lib/orpc.ts:10–16` — bearer token, **no cookie path in the POS**. `apps/pos/src/features/unlock/Unlock.tsx:100–104` — the copy replaced above. The POS has three routes: `__root`, `index`, `enrol`.
- `packages/backend/src/auth/handlers/sign-in.ts:33–70` and `apps/backoffice/src/routes/_shell.tsx:8–14` — **no role gate**, so a `cashier` can sign in. Role gating is per-screen only (`devices.tsx:10`; the four `isAdmin` list cards).
- `apps/backoffice/src/components/UserMenu.tsx` in full — the `SettingsDialog` controlled-open pattern and 048's comment on why a `DialogTrigger` in a menu item cannot work; `features/users/DeactivateDialog.tsx` — the confirm shape both dialogs copy.
- Records **057** (Q1's table, §4's NULL-clearing note, Q3's structural refusal, Q6's grep test), **043**, **044** §1, **045** §4 and line 179, **032**, **048**. `.scratch/decisions/` listed directly: **001–057 exist, 058 is free, and none decides PIN management, its principal, or where its flows live. No duplicate.**

**External: none, and that is a finding rather than an omission.** **No authority publishes guidance on whether a second factor's *management* path must itself require the first factor** — NIST SP 800-63B's binding and rebinding text covers authenticators bound to an identity, not a PIN that is inert without the device it is bound to, and searching returns generic MFA-enrolment advice that assumes the factor has standalone value. The argument therefore rests on 057's published arithmetic and on the codebase, both of which a human can check here. Padding this section with adjacent links would be worse than saying so.
