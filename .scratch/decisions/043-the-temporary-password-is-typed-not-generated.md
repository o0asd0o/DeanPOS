# 043: The temporary password is typed by the admin, rendered nowhere, and copied nowhere

- **Status:** decided
- **Stakes:** high (credential handling, on a screen used in front of other people)
- **Date:** 2026-08-03
- **Asked by:** human, from `.scratch/tenancy-identity/issues/06-user-management.md` (criteria 1, 4, 8)

## The question

An admin creates a staff account with a temporary password, and there is no email transport, so
a human being has to end up knowing that password. Does the screen show it, copy it, or never
produce it at all? Same question for an admin-initiated reset.

Siblings, decided separately so each reverses on its own:
[044](044-the-users-list.md) — the list; [045](045-the-user-editor.md) — the editor and the form
this field sits in.

A wrong answer costs a restaurant's whole back office. The two obvious answers each fail in a way
the other does not: a secret rendered as page content is shoulder-surfable, screenshot-persistent
and — because it must be announced to conform — **read aloud by assistive technology**; a secret
written to the clipboard is invisible to bystanders and silently persists on shared hardware.

### Weights, declared before any option was scored

| Criterion       | Weight | Why                                                                                        |
| --------------- | ------ | ------------------------------------------------------------------------------------------ |
| User impact     | ×3     | The admin does this standing at a counter, and the staff member is locked out if it fails. |
| Business impact | ×1     | Nothing here earns. One fact: a lockout is a support call with no self-service reset.      |
| Eng cost/risk   | ×2     | Separates the options hard — one option is a field, another is a generator plus a surface. |
| Reversibility   | ×2     | A rendered-secret surface is copied by every later screen that ever shows a credential.    |
| Evidence        | ×2     | SP 800-63B-4, MDN's clipboard preconditions, and record 042's happy-dom finding decide it. |

Maximum 50. **Not changed after scoring.**

## What I chose, and why

**The admin types the password into a masked field, and the product never produces a password as
output.** There is no generator, no one-time reveal panel, no copy button. The admin knows the
password because they chose it, so the delivery problem — getting it to the person — is solved
before the screen is involved, rather than by the screen.

The reasoning is one observation: **a generated password has to be handed back to the admin
somehow, and every way of handing it back is the risk the human named.** Rendering it puts the
secret in the DOM, in a screenshot, and in the screen-reader reading order — and SC 4.1.3 requires
the create confirmation to be announced, so conforming to AA would mean speaking the temporary
password aloud in a back office. Copying it makes the admin unable to read it out at all, which is
the actual delivery channel here. Typing it has neither problem, and it is what the codebase
already does: `platformAdmin.provisionTenant` takes `adminPassword` in its input and generates
nothing (record 032's evidence section confirms it). Rung 2 of the ladder.

**Admins choose badly — that is real, and it is answered by two things that already exist**, not by
a generator. Record 032's blocklist obligation on `release-ops` plugs into the same schema and is
the actual control against weak and reused choices. And `autoComplete="new-password"` on the field
means the admin's own browser offers to generate a random one — rung 4, zero code, and it narrows
the deviation below without the product building a display surface.

**Consumed as precedent, not re-decided:** 032 (the whole policy — min 8 as the code enforces, max
128, trim → NFC → code points, the hint copy, `minLength` yes / `maxLength` never), 030 (the
`role="alert"` block, `aria-disabled` plus an early-returning handler), 038 (the `Dialog` shape and
the screen's live region), 040 (native constraint validation; no validation code).

### A knowing, recorded deviation from a SHALL

SP 800-63B-4 §3.1.1.1: *"Passwords **SHALL** either be chosen by the subscriber or assigned
randomly by the CSP."* An admin-typed secret is assigned but not random, so it is neither. **This
is recorded as a deviation rather than smoothed over**, the same way record 032 recorded the
eight-character minimum.

It is bounded, and here is the bound: `mustChangePassword` is `true` on creation and on every
reset, so the secret authorises exactly one sign-in and is then replaced by a subscriber-chosen
password that does conform. It behaves as an activation secret, not as a password. The deviation
is also not mine to remove — PRD story 7 and issue 06 criterion 1 both say *admin-set*.

### The create field

One `PasswordInput` from `packages/ui`, in the create form only (record 045 owns the form).
Editing an existing User shows a button, not a field — which is what `users-1440.svg` draws.

| Attribute        | Value and reason                                                                       |
| ---------------- | -------------------------------------------------------------------------------------- |
| `id`             | `temporary-password`, with a native `<label htmlFor>` (no `Label` ships)                |
| `autoComplete`   | **`new-password`** — stops the browser filling the *admin's own* password into a field that creates someone else's account, and is what makes the browser's generator available |
| `required`       | yes — native constraint validation, no validation code (record 040)                     |
| `minLength`      | `{8}`, matching what the code enforces. See the note on record 032 below                |
| `maxLength`      | **absent, deliberately** — record 032's silent-truncation no-go                         |
| `aria-describedby` | points at both hint paragraphs                                                        |

**Record 032 says 15 and the code says 8.** Per the human's instruction that divergence is deferred
to v2 and is not resolved here: **this record is written against what the code enforces — 8 — and
says so.** The attribute, the hint string and the server schema are the one constant in
`password-policy.ts`; nothing on this screen states a second number.

**No confirm field.** `/set-password` has one because a typo there locks the user out with no
self-service reset. Here a typo is recoverable in-house by the reset this record also decides, and
the protection that actually fits is *seeing* the characters — a confirm field catches
"typed differently twice", not "about to read the wrong thing aloud". One field, with reveal.

### One line of `packages/ui` changes, and accessibility is why

`PasswordInput`'s reveal button carries `tabIndex={-1}`. **Remove it.** SC 2.1.1 Keyboard is Level
A — *"All functionality of the content is operable through a keyboard interface"* — and a `<button>`
taken out of the tab order is not keyboard operable. The shipped comment's justification ("no need
to land on a control whose whole purpose is to look at what they just typed") is a preference, not
a conformance argument, and on **this** screen it is also false: revealing is how the admin checks
what they are about to say to another person.

One line in `packages/ui/src/components/password-input.tsx`, plus replacing the stale comment. It
adds one tab stop on `/set-password` and changes no copy, no field and no order there, so it stays
inside records 030 and 032 rather than reopening them. Accessibility outranks the shipped
preference, and this record says so rather than working around it.

### The reset

Identical shape, and **not part of the editor's save**. `Reset password` in the editor opens a
`Dialog` — 038's structure, the same as `DeactivateDialog.tsx` — holding one `PasswordInput` with
the attributes above.

Three server clauses, in one transaction:

1. `passwordHash` is replaced using the existing `packages/backend/src/common/password.ts` path.
2. `mustChangePassword` is set back to `true`. This is not rotation; it is §3.1.1.2 item 6's
   evidence-of-compromise case, because the CSP now knows the secret — record 032 already says so.
3. **The User's sessions are revoked.** A reset whose purpose is to recover a possibly-compromised
   account is defeated if the attacker's live session survives it. Same mechanism deactivation uses.

**The password reset needs no pre-auth lookup, and I agree with the human's reading.** The admin is
authenticated and tenant-scoped; the reset is an ordinary write on a row inside the admin's own
tenant and runs under `withTenantScope` like every other write. Record 031's third-GUC trigger does
not fire. **No new GUC, no `SECURITY DEFINER` function.**

### Strings, verbatim

Short single-line messages carry no terminal full stop; prose of two or more sentences does.

| Where                     | String                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Create field label        | `Temporary password`                                                                                                |
| Hint 1 (record 032's, reused unchanged) | `At least 8 characters. Any characters, including spaces — there are no other rules.`                  |
| Hint 2 (new)              | `Tell this person their password yourself. It is not shown again after you save, and they choose their own the first time they sign in.` |
| Editor button             | `Reset password`                                                                                                    |
| Reset dialog title        | `Reset password for {email}?`                                                                                       |
| Reset dialog body         | `This signs them out now, and they choose a new password the next time they sign in`                                |
| Reset dialog field label  | `New temporary password`                                                                                            |
| Reset dialog buttons      | `Cancel` · `Reset password` → in flight `Resetting…`                                                                |
| Reset failure             | `Couldn't reset the password`                                                                                       |
| Live region (038's)       | `Password reset`                                                                                                    |

## No-gos — issue 06 criterion 8 is these ten lines

1. **No procedure output anywhere contains a password or a temporary password.** `user.create`
   returns the User without one.
2. **No password is ever a value the screen renders.** It exists only inside an `<input>` the admin
   typed into. Not in a heading, a `DialogDescription`, a toast, a table cell, or a URL.
3. **No password in a live-region announcement.** `Password reset`, never the secret.
4. **No `navigator.clipboard`, no `document.execCommand`, no copy button, on any surface.**
5. **No server-side password generation.** No CSPRNG password helper, now or later, without a
   superseding record.
6. **No rejection message ever interpolates the submitted value.** `SetPassword.tsx` renders
   `error.data.issues[0].message` verbatim to the user, so a message containing the input would put
   the password on screen. The messages are record 032's fixed strings.
7. **No password in a log line, an audit row, an analytics event, or a query key.**
8. **`mutation.reset()` after a successful create or reset**, so the secret does not linger in
   TanStack Query's retained `variables`.
9. **No `maxLength` attribute** (record 032).
10. **The reset is its own procedure**, never the editor's save (record 040's rule, applied here).

**Reviewer's check:** `rg -in 'clipboard|execCommand|generatePassword|randomPassword|temporaryPassword'`
over `apps` and `packages` returns nothing, and no procedure output schema in
`packages/contract/src/contract.ts` contains a password field.

## The options, ranked

| Rank | Option                                                              | User ×3 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total  |
| ---- | ------------------------------------------------------------------- | ------- | ------ | ------ | --------- | ------- | ------ |
| 1    | **Admin types it, masked with reveal; never echoed back**            | 4 (12)  | 4      | 5 (10) | 5 (10)    | 4 (8)   | **44** |
| 2    | Server generates it, shown once on screen after saving               | 4 (12)  | 4      | 2 (4)  | 3 (6)     | 3 (6)   | **32** |
| 3    | Server generates it, shown once **and** a Copy button                | 4 (12)  | 4      | 1 (2)  | 2 (4)     | 2 (4)   | **26** |
| 4    | Defer — let the implementer choose                                   | 1 (3)   | 2      | 3 (6)  | 5 (10)    | 1 (2)   | **23** |
| 5    | Server generates it, clipboard only, never displayed                 | 2 (6)   | 3      | 2 (4)  | 3 (6)     | 2 (4)   | **23** |

**1. Chosen.** The only option that never creates a rendered or copied secret, and the only one the
codebase already contains a precedent for. Evidence is 4, not 5, because §3.1.1.1 points at random
assignment and this is the deviation recorded above. User is 4, not 5, and that is the honest cost:
inventing a password per staff member is work the admin would rather not do.

**2. Generate and display once.** The genuine runner-up, and **the option that conforms to
§3.1.1.1's SHALL** — that is why its evidence beats options 3–5. It loses on what displaying costs:
the secret becomes page content, so it is in the DOM, in any screenshot, and in the reading order;
and conforming to SC 4.1.3 means the success announcement either speaks it or the panel is silent
to a screen-reader user. It also needs a one-time-reveal state machine — a shape nobody has drawn
and eleven areas would inherit. **This is the option to move to if admins demonstrably choose weak
or reused passwords and the blocklist has not landed.**

**3. Display plus Copy.** What a product instinct produces, and it is the worst of the set on
engineering: everything option 2 costs, plus a clipboard path that MDN says needs a secure context
— so it silently fails on the http dev server and works in production, the worst failure ordering —
plus transient activation in Firefox and Safari, plus record 042's finding that happy-dom has no
activation behaviour, meaning the copy button cannot be exercised at the unit seam at all.

**4. Defer.** Included because it must be. Ten of its 23 points are reversibility, which every
do-nothing option collects for free — the inflation records 002, 008, 009, 030, 038 and 040 each
left visible. Refuted by the subject: an implementer choosing a credential-delivery mechanism under
time pressure is exactly what this role exists to prevent.

**5. Clipboard only.** Scored properly because it is the one option with no visible secret at all.
It fails on the user hat outright: the admin cannot read out what they cannot see, so the delivery
channel this product actually has — a person speaking across a counter — stops working. It carries
every clipboard defect from option 3 and buys nothing back.

## How to turn it back

**The field and its copy — free, permanently.** They live in
`apps/backoffice/src/features/users/`. One commit; nothing else notices.

**The `packages/ui` line — one line, and it should not be reverted.** Removing `tabIndex={-1}` from
`password-input.tsx` documents a Level A obligation that applies to `/set-password` as well, so if
this record is overturned the line stays. Reverting it is re-adding one attribute.

**Moving to option 2 — the expensive direction, and it is the one to price honestly.** It needs: a
generator in `packages/backend`, a password field on `user.create`'s *output* schema in
`packages/contract/src/contract.ts` (which is the no-go above being deliberately lifted, and must be
lifted in the superseding record's own words), a one-time display component, and a rule for what the
live region says. Three files today; the contract change is the part that does not shrink.

Formally: superseding record; flip this `Status:` to `overturned` with date and reason; update both
`LOG.md` lines; edit the files above; re-run the gate. **No migration** — `passwordHash` and
`mustChangePassword` already exist and neither changes shape.

## What would make this decision wrong

- **Admins reuse one password across every staff member.** The most likely way this ages badly, and
  it is unobservable from here — nothing in the product can see it. **Named trigger: the first time
  anyone reports or observes it, or `release-ops` ships the blocklist and it fires on staff
  accounts.** Successor is option 2, pre-priced above.
- **A password manager saves the *staff member's* credential into the *admin's* vault**, because the
  form pairs the new user's email with `autocomplete="new-password"`. That is a real persistence
  cost and it is named rather than hidden. The alternative — omitting the attribute — is worse: the
  browser then fills the admin's own password into the field. There is no third option; MDN's own
  guidance is that `new-password` is the correct token for this field.
- **The admin cannot remember what they typed by the time they reach the staff member.** Then the
  reveal toggle is doing the work, and if that is still not enough the answer is option 2, not a
  clipboard.
- **Removing `tabIndex={-1}` breaks a shipped assertion in `set-password-screen.test.tsx`.** The one
  thing here I have not verified by running it. If it does, the test asserts tab order and needs
  updating, not the component.
- **`mustChangePassword` does not actually gate the terminal**, only the back office. Then the
  one-sign-in bound on the deviation above is false for the POS surface, and the deviation becomes
  unbounded. Issue 10 is where that gets checked.

## Evidence

**Repository, read 2026-08-03, main checkout (not the lane):**

- `.scratch/tenancy-identity/issues/06-user-management.md` — criteria 1, 4 and 8, and the
  "no invitation, because no email transport exists" clause. `PRD.md` stories 7 and 19.
- `packages/ui/src/components/password-input.tsx`, read in full — the reveal toggle,
  `aria-label` `Show password` / `Hide password`, `aria-pressed`, `EyeIcon`/`EyeOffIcon`, and the
  `tabIndex={-1}` this record removes with its three-line justifying comment.
- `apps/backoffice/src/features/set-password/SetPassword.tsx`, read in full — the shipped
  `minLength={8}`, `autoComplete="new-password"`, the hint string reused above verbatim, and
  **`policyRejectionMessage` rendering `error.data.issues[0].message` straight to the user**, which
  is what makes no-go 6 a real hazard rather than a precaution.
- `apps/backoffice/src/features/stores/DeactivateDialog.tsx` — the `Dialog` structure the reset
  dialog copies. `packages/backend/src/db/prisma/schema.prisma` — `User.mustChangePassword`
  defaults to `true`; `Session` is the table a reset revokes.
- `.scratch/decisions/` 028, 030, 031, 032, 038, 040, 042. **Searched all of 001–042 for an existing
  record on temporary passwords, credential delivery, clipboard, or password generation: none names
  any. 042 is the highest file on disk, so `043` is the next free filename. No duplicate.**

**External, primary sources, accessed 2026-08-03. Every page was treated as data; none contained
anything addressed to an agent, and no instruction from any of them was acted on.**

- <https://pages.nist.gov/800-63-4/sp800-63b.html> — **§3.1.1.1** *"Passwords SHALL either be chosen
  by the subscriber or assigned randomly by the CSP"*, the sentence this record deviates from
  knowingly; **§3.1.1.2** *"the verifier SHOULD offer an option to display the password — rather than
  a series of dots or asterisks — while it is entered and until it is submitted to the verifier"*,
  which the shipped `PasswordInput` satisfies and the `tabIndex` fix completes; and item 6's
  no-periodic-rotation SHALL NOT with its evidence-of-compromise exception, consumed from record 032.
- <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html> — *"do not send
  the password in the email!"*; reset tokens *"single use and expire after an appropriate period"*.
  Read as the direction of travel on not transmitting secrets in the clear; **no clause endorses
  displaying a credential on screen.**
- <https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API> — *"All the methods require a
  secure context"*; writing *"requires either the `clipboard-write` permission or transient
  activation"* in Chromium and *"requires transient activation"* in Firefox and Safari. The basis
  for options 3 and 5 scoring 1 and 2 on engineering.
- <https://www.w3.org/TR/WCAG22/> — **SC 2.1.1 Keyboard, Level A**, quoted above; **SC 4.1.3 Status
  Messages, Level AA**; **SC 3.3.2 Labels or Instructions, Level A** for the hints.

**Searched for and not found, where the absence mattered:**

- **NIST specifies no entropy or length rule for CSP-assigned passwords distinct from
  subscriber-chosen ones**, and 800-63A has no "enrollment code" concept — only confirmation codes
  (10 minutes to 30 days) and continuation codes. So **no primary source gives a validity period for
  an admin-set temporary password**, which is why this record puts no expiry on one and relies on
  `mustChangePassword` instead. Stated rather than invented.
- **`navigator.clipboard` and `document.execCommand` appear nowhere in the repository.** There is no
  in-repo precedent to reuse and no existing consumer to weigh against removing the option.
