# 032: The password policy — fifteen characters and no other rule, because that is what the edition record 028 already cites actually says

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (delegated back from `.scratch/decisions/030-the-back-office-sign-in-screen.md`, which refused it; originally `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md`)

**Amended 2026-08-03** (this record, by the human directly): **`PASSWORD_MIN_LENGTH`
is 8, not 15.** This is option 3 of the ranked list — the successor this record
pre-decided and priced at one constant — taken by direct instruction rather than by
the named re-check trigger firing. Everything else stands unchanged: no composition
rules, max 128, trim → NFC → code points, one module, no minimum at sign-in, no
rotation, and the PIN still inherits nothing.

It is a **knowing, recorded deviation from a SHALL** — SP 800-63B-4 §3.1.1.2 item 1
allows eight only for passwords used as part of multi-factor authentication, and
this product has no second factor. The deviation is logged the same way the
deferred breach screening is, and it stays live until MFA lands or the minimum is
raised. Raising it is still the expensive direction this record describes: every
account created at 8 is grandfathered or force-changed, and a superseding record
plus `mustChangePassword` is the mechanism. The two copy strings move with the
constant — the hint reads `At least 8 characters`, the rejection reads
`Password must be at least 8 characters` — and the native `minLength` on both
inputs follows.

## The question

Sign-in is merged and live, and there is no password policy anywhere in the
product. `auth.setPassword` accepts any non-empty string; platform-admin
provisioning accepts any string of eight characters or more. What rule does the
server apply when somebody sets a password, and what does it say when it refuses?

A wrong answer costs in two directions and they pull against each other. Too weak
and the one thing standing between a stranger and a restaurant's whole back office
is a guessable string. Too strong and — because there is **no self-service
password reset in v1** — every forgotten password is a phone call to a platform
administrator, and a locked-out owner is a churned customer.

**The human's direction, which I was asked to test rather than adopt:** NIST
SP 800-63B — an eight-character minimum, no composition rules, no forced
rotation, and breached-password screening deferred to the `release-ops` area.

### Weights, declared before any option was scored

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×3 | The number is typed by a human being, from memory or from a manager, on a product with no self-service reset. Every point of friction here has a support cost with a face on it. |
| Business impact | ×1 | Nothing here earns. The only business fact is the one above wearing a different hat: administrator call volume. |
| Engineering cost and risk | ×1 | Every option is the same constant in the same two schemas. Manufacturing a spread would be dishonest. |
| Reversibility | ×2 | Scored explicitly because the two directions are **not symmetric**, and that asymmetry turns out to decide half the question. See the reversal section. |
| Evidence strength | ×3 | The whole question is "what does the standard actually say", the leading candidate is a number from a superseded edition, and record 028 already cites the current one. This is where the question lives. |

Maximum possible total: 50. **Not changed after scoring.**

## What I chose, and why

**Fifteen characters minimum, not eight. Everything else in the human's direction
is adopted unchanged.**

I disagree with the human on exactly one number, and it is the headline one. Here
is why, and it is not a matter of taste.

### The eight-character minimum is the withdrawn edition's number

Record 028 already cites **SP 800-63B revision 4**, and record 031 anchors the
session lifetimes to it. That is the edition in force, and its first normative
requirement on passwords reads, verbatim:

> "Verifiers and CSPs **SHALL** require passwords that are used as a
> single-factor authentication mechanism to be a minimum of 15 characters in
> length. Verifiers and CSPs **MAY** allow passwords that are only used as part
> of multi-factor authentication processes to be shorter but **SHALL** require
> them to be a minimum of eight characters in length."
> — SP 800-63B-4 §3.1.1.2, item 1

Eight is not the standard's minimum. It is the concession the standard makes to
systems that have a **second factor**, and issue 03's own Comments say
"Multi-factor authentication … out of scope for v1". DeanPOS back-office sign-in
is single-factor by its own written scope, so the eight-character allowance is the
one clause of the document this product cannot claim.

Adopting a standard by name and then taking the number it explicitly reserves for
the case you do not have is adopting the label without the substance. That is the
whole of my disagreement, and it is a disagreement with the number, not with the
direction — the human's instinct to go to NIST was right, and the number is the
one that was revised.

OWASP's Authentication Cheat Sheet says the same thing from the other side and
gets it right in one sentence: *"If MFA is enabled passwords shorter than 8
characters are considered to be weak. If MFA is not enabled passwords shorter
than 15 characters are considered to be weak."* Two independent sources, the same
split, on the same axis. There is no third reading.

### Fifteen with no rules is easier for a human than eight with rules

This is the argument that makes 15 survive the user hat rather than merely the
security one, and it is the reason NIST made the trade in the first place.

The policy **removes** every composition requirement. No uppercase, no digit, no
symbol, no "must not contain your name". Spaces are allowed. So the thing a user
has to produce is not fifteen characters of line noise, it is a short phrase —
`two eggs and toast`, `blue door on maple`. That is materially easier to type and
to remember than `Xk9$mp!2`, which is eight characters and a composition rule and
is the thing people write on a sticky note.

Record 030 already made password managers and paste **mandatory** rather than
optional, on WCAG 2.2 SC 3.3.8's normative text. So the population that finds 15
hardest is already the population the screen is built to serve with autofill.

### The strict direction is the reversible direction

If this ships at 15 and somebody later decides 12 is right, one constant changes
and **not one existing account is affected** — every password already stored
satisfies any lower number. One commit, no migration, nobody notified.

If it ships at 8 and somebody later decides 15 is right, every account created in
between is either grandfathered at a length the policy now calls insufficient, or
force-changed — and the policy's own rule 6 says a forced change is for *evidence
of compromise*, which "we changed our minds" is not. That is the expensive
direction, and it is the one an eight-character floor commits us to.

Reversibility is not a tie-breaker on this record. It is a first-class reason.

### The rule set, exactly, and where it runs

**One module, `packages/backend/src/auth/password-policy.ts`**, sibling of the
existing `session-policy.ts`. It exports the constants, one normalisation
function, and one zod schema. Nothing else in the repository states a password
rule.

```
PASSWORD_MIN_LENGTH = 15      // code points, after trimming and NFC
PASSWORD_MAX_LENGTH = 128
```

**The order of operations, which is load-bearing and easy to get backwards:**

1. **Trim** leading and trailing whitespace.
2. **Normalise** to Unicode NFC.
3. **Count code points** — `[...password].length`, never `password.length`.
4. Compare against the minimum and the maximum.
5. **Encode UTF-8 explicitly** before it reaches scrypt.

Each step, with its reason:

- **Trim.** NIST permits it in as many words — *"Verifiers MAY make limited
  allowances for mistyping (e.g., removing leading and trailing whitespace
  characters before verification …) if the password remains at least the required
  minimum length after such processing"* — and the condition is satisfied because
  the length check runs *after* the trim. We take the allowance for one specific
  reason: with no self-service reset, a password set with an invisible trailing
  space and then typed without it is an unrecoverable lockout caused by a
  character nobody can see. **Interior spaces are preserved** — passphrases are
  the point.
- **NFC**, per §3.1.1.2: *"the verifier SHOULD apply the normalization process for
  stabilized strings using the Normalization Form Canonical Composition (NFC) …
  This process is applied before hashing the byte string that represents the
  password."* scrypt hashes bytes, and `é` composed and `é` decomposed are
  different byte strings for the same visible character. Without this, a password
  set on one keyboard cannot be typed on another.
- **Code points, not UTF-16 units.** §3.1.1.2 item 4: *"Each Unicode code point
  **SHALL** be counted as a single character when evaluating password length."*
  JavaScript's `.length` counts UTF-16 code units, so `"😀".length` is 2 where
  the standard says 1. `[...s].length` iterates code points and is correct. This
  is a one-character difference in the source and a conformance failure if it is
  wrong.
- **`Buffer.from(normalized, "utf8")` into scrypt.** Node's `crypto.scrypt`
  accepts a string, and no documentation this record could find states which
  encoding it applies. Passing a Buffer removes the question. It is a no-op for
  every ASCII password, which is all that exists in the repository's fixtures
  today.

**The absolute rule that binds all five steps: normalisation is one function,
called from both the set-password path and the sign-in path, and they can never
diverge.** A password normalised at set time and not at verify time is a silent,
total lockout for every non-ASCII user. This is the single most dangerous line in
this record and it gets a no-go below.

**Where the rules run.** The server is the sole authority, exactly as record 030
established, and that is not overturned. The schema lives in `packages/schemas`
so the contract can import it, and it is applied at **both** places a password is
created:

- `auth.setPassword` — `newPassword` moves from `z.string().min(1)` to the policy
  schema.
- `platformAdmin.provisionTenant` — `adminPassword` moves from `z.string().min(8)`
  to the same schema. **This is merged code carrying a number that contradicts
  this record**, and it is the first thing to fix.

**And at neither place a password is *verified*.** `auth.signIn`'s `password`
keeps `min(1)` and gains `.max(128)` to bound the request, and it gains the trim
and NFC transform so the bytes match — **but never the minimum**. A policy check
at sign-in would reject an existing account's password without letting them in to
change it, and would be a branch on the one path record 033 spends a whole record
protecting. Sign-in validates nothing about strength, forever.

### Maximum length: 128

NIST's floor is *"SHOULD permit a maximum password length of at least 64
characters"*. Twice the floor, for a reason that costs nothing: scrypt's work is
set by `N` and `r`, not by the length of the input — the password enters one
PBKDF2-HMAC-SHA256 pass and never again — so a generous maximum is free, and item
9 of §3.1.1.2 says the verifier *"SHALL verify the entire submitted password (e.g.,
not truncate it)"*. Sixty-four would be the least generous conforming value; 128
leaves room for a password manager configured above the floor.

**This is the number in this record I am least confident about**, because I could
not verify from a primary source what the largest password any common manager
generates actually is. It is a bound on absurd input rather than a derived
constant, it is one line to change, and no stored password depends on it.

### The failure copy, verbatim

Record 030 fixed the *sign-in* failure sentence as a security control that may not
be replaced. **`/set-password` is a different surface and the opposite rule
applies**: there is no enumeration concern — the user is already authenticated and
is talking about their own password — and §3.1.1.2 requires the reason be given:
*"the CSP **SHALL** require the subscriber to select a different secret and
**SHALL** provide the reason for rejection"*, and separately *"Verifiers **SHALL**
offer guidance to the subscriber to help the subscriber choose a strong
password."*

**A hint, rendered always, not only on error**, between the `New password` label
and its input, with `aria-describedby` pointing the input at it (SC 3.3.2 Labels
or Instructions, Level A):

```
At least 15 characters. Any characters, including spaces — there are no other rules.
```

The second half of that sentence is doing real work: users assume a composition
rule exists and waste effort satisfying one that is not there. Colour is
`text-sm text-foreground` on the card, which record 030 confirmed is asserted at
4.5:1 in `contrast.test.ts`. **Not `text-muted-foreground`** — this record did not
verify that `muted-foreground`/`card` is in the pairing table, and record 009's
rule is that an unasserted pair does not carry user-visible text.

**The rejection messages**, rendered in record 030's existing `role="alert"` block
in its existing position, one at a time, **with no terminal full stop** — matching
the mock's `Email or password is incorrect` and record 030's own
`The two passwords do not match`, which is the punctuation convention on this
screen:

```
Password must be at least 15 characters
Password must be 128 characters or fewer
The two passwords do not match                              (record 030, unchanged)
This password has appeared in a data breach — choose a different one   (release-ops, not yet live)
```

The block renders exactly one message. The client's match check runs first; a
server message replaces whatever is there.

**One native attribute, and this narrows record 030 rather than contradicting
it.** `minLength={15}` goes on both password inputs on `/set-password`. Record 030
said "the client performs no password-strength validation at all"; I am narrowing
that to **no password-strength *code***, on 030's own precedent — it used native
`required` and `type="email"` and called that "zero validation code and zero
invented copy". `minLength` is the same rung: the browser blocks the submit and
shows its own localised message.

It is safe to add because it **cannot disagree with the server**. The attribute
counts UTF-16 code units and the server counts code points, and no code point is
fewer than one UTF-16 unit — so any password the server would accept has at least
15 units and passes the attribute. The client can never block something the server
would allow. The reverse is possible (fifteen emoji pass the attribute and fail on
the server) and lands in the error block, which is correct.

**`maxLength` is deliberately not added.** Browsers truncate a paste or an
autofill to `maxlength` silently, and a password manager's fill being cut to 128
characters would store a password the user can never reproduce — in a product with
no self-service reset. The maximum is enforced server-side only, where it produces
a visible sentence. This asymmetry is not an oversight.

**Nothing else on either screen changes.** No reveal toggle — see the follow-up
below. No strength meter. No new component, token or colour.

### No rotation, and what that does *not* mean

§3.1.1.2 item 6: *"Verifiers and CSPs **SHALL NOT** require subscribers to change
passwords periodically. However, verifiers **SHALL** force a change if there is
evidence that the authenticator has been compromised."*

So: no password expiry, no `passwordChangedAt` column, no reminder, no job.
Adopted as written.

**The existing `mustChangePassword` flag is not rotation and is not affected.** It
fires when an administrator sets a temporary password — the CSP knows that secret,
so the subscriber changing it is exactly the compromise case the second sentence
mandates. Issue 06's admin-initiated reset is the same shape. Written down because
a reader will otherwise think this record deleted issue 03's criterion 6.

### The PIN is not covered by this policy, and here is the boundary

**Explicitly: none of the above applies to issue 10's PIN.** A 4–6 digit PIN
cannot satisfy a 15-character minimum and is not meant to.

The reason is not "PINs are special", it is that the standard's minimum is scoped
to *"passwords that are used as a single-factor authentication mechanism"*, and
issue 10's own governing sentence says the opposite of that: **"A PIN is a second
factor to Device possession, never a credential on its own."** A PIN reachable
only from an enrolled, unrevoked Device is not a single-factor authenticator, and
the eight-character multi-factor floor does not fit a numeric secret either.

So policy follows record 028's split exactly: **same primitive, different
parameters, different file — and now also different policy, in that file.** The
PIN's security is bought by **throttling, not by length**, which is why issue 11
exists and why record 033 leaves the Device-side half to it.

**The concrete obligation that falls out, for issue 11:** a 4-digit PIN has
10,000 combinations, so NIST's ceiling of 100 consecutive attempts already gives a
1-in-100 chance of a blind guess succeeding. Issue 11's Device-side budget must be
far below that ceiling, not at it. This record does not pick issue 11's number —
that is issue 11's record — but it fixes the constraint the number must satisfy.

**Separately, and this is record 028's decision being reported rather than mine:**
issue 10's second acceptance criterion still says *"PIN hashing uses
`Bun.password` argon2id"*. Record 028 made that a no-go and added a grep test that
fails any `Bun.` member access in backend source, so issue 10 as written cannot
pass its own gate. **The human must amend issue 10's criterion the same way record
028 had issue 02's amended.** Suggested wording is in the hand-back below.

### What `release-ops` inherits, stated as an obligation

`.scratch/release-ops/` exists — area 10 of 12 — so this deferral has a real
address. **Deferring the blocklist is a knowing deviation from a SHALL**, and it
is recorded as one rather than smoothed over:

> "When processing a request to establish or change a password, verifiers
> **SHALL** compare the prospective secret against a blocklist that contains
> known commonly used, expected, or compromised passwords. The entire password
> **SHALL** be subject to comparison, not substrings or words that might be
> contained therein."

It is deferred because it needs a data source that does not exist in this
repository, and choosing a data source is a **dependency-or-provider decision that
needs its own record** — not something a lane invents. The obligation, in five
clauses, each trackable:

1. **A blocklist is screened at `set-password` and at provisioning. Never at
   sign-in.** Sign-in verifies; it does not judge.
2. **It runs with no credentials and no third-party call on the request path.** A
   live API lookup makes every future test depend on someone's account and puts an
   outbound network hop inside a password change. Prefer a table in PostgreSQL —
   the engine is already here, an index on a hash column is rung 4 of the ladder,
   and local development can seed a small list.
3. **The data source is its own decision record**, scored as a provider choice:
   what data lives there, the migration path off it, and whether it runs offline.
4. **The rejection copy is already named above** and does not get re-invented.
5. **Until it ships, the throttle is doing the blocklist's job**, and NIST says
   so: *"Since the blocklist is used to defend against brute-force attacks and
   unsuccessful attempts are rate-limited, the blocklist SHOULD be of sufficient
   size to prevent subscribers from choosing passwords that attackers are likely
   to guess before reaching the attempt limit."* Record 033 sets that attempt
   limit. **The two records are load-bearing for each other and neither is
   complete alone** — that is worth carrying to the human as one sentence.

## The options, ranked

| Rank | Option | User ×3 | Business ×1 | Eng cost/risk ×1 | Reversibility ×2 | Evidence ×3 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **SP 800-63B-4 as written for a single-factor system: 15 minimum, 128 maximum, no composition, no rotation, trim + NFC + code points, blocklist deferred to `release-ops`** | 3 (9) | 3 | 4 | 5 (10) | 5 (15) | **41** |
| 2 | 15 advisory, 8 enforced — warn below fifteen, refuse below eight | 4 (12) | 4 | 2 | 3 (6) | 3 (9) | **33** |
| 3 | The human's direction as given: 8 minimum, everything else identical | 4 (12) | 4 | 4 | 2 (4) | 2 (6) | **30** |
| 4 | Defer a second time | 1 (3) | 2 | 3 | 5 (10) | 1 (3) | **21** |

**1 — SP 800-63B-4 as written. Chosen.** Evidence 5 because every clause traces to
a quoted normative sentence in the edition this repository already cites, with
OWASP agreeing independently on the one number that matters. Reversibility 5 for
the reason given above: there is no migration, no stored state encodes the policy —
a hash is policy-blind — and the direction this option makes cheap is the
direction anyone would actually want to move. User 3 rather than 4 is the honest
cost: fifteen characters is more to type than eight, and no amount of arguing about
passphrases makes that untrue. Engineering 4 rather than 5 because it edits merged
code and the shared contract.

**2 — Fifteen advisory, eight enforced.** Ranked second and it is a real product
pattern, not padding: it gets most of the security benefit from the people who
read the warning while never blocking anyone. It loses on two things. A warning
nobody must act on is a policy that is not one, and the population that ignores it
is exactly the population it exists for. And mechanically it needs a **non-blocking
warning treatment on a screen that has none** — record 030 specified `role="alert"`
for errors and nothing else — so building it means inventing a visual pattern with
no precedent in the codebase, which is explicitly not mine to invent. Engineering 2
is that. If the human wants this shape, the warning treatment is the part that has
to come back to them.

**3 — The human's direction, eight characters.** Scored properly rather than
dismissed, because it is what was asked for and it wins outright on the two things
this product feels most: it is easier to type and it generates fewer support calls.
It loses on evidence — 2, because the sentence it rests on is the current
standard's *multi-factor* allowance and this system has no second factor — and on
reversibility, 2, because it is the option that makes the likely future move
expensive. **This is the option to go back to if fifteen characters produces real
lockouts**, and going back is one constant.

**4 — Defer a second time.** Included because it must be. Ten of its 21 points come
from reversibility, which every do-nothing option maximises trivially — the same
inflation records 002, 007, 008, 015, 028 and 030 each left visible rather than
tuning away. It is refuted by the state of the tree: `set-password` accepts a
one-character password on a live authentication path today, record 030 already
deferred this once, and the human has now delegated it. Deferring again means the
number gets written by an implementer under time pressure, which is precisely what
record 030 refused it to prevent.

**Is it close?** Between 1 and 3, closer than eleven points suggests on the user
axis and not close at all on the other two. Strip the evidence weighting entirely
and it is 26 to 24 — the user and business hats genuinely prefer eight. What
decides it is that the standard the human named does not say eight for this system,
and that being wrong at fifteen is cheap while being wrong at eight is not.

## What must change

### Merged code — yes, and it is the answer to the human's explicit question

| File | Change |
| --- | --- |
| `packages/backend/src/auth/password-policy.ts` | **New.** The two constants, `normalizePassword`, and the zod schema. |
| `packages/schemas/` | The shared `passwordSchema` lives here so `contract` can import it. |
| `packages/contract/src/contract.ts` | `setPasswordInputSchema.newPassword` and `provisionTenantInputSchema.adminPassword` take the policy schema. `signInInputSchema.password` keeps `min(1)`, gains `.max(128)` and the trim + NFC transform, and **never** the minimum. |
| `packages/backend/src/auth/handlers/set-password.ts` | `inputSchema` follows the contract. The stale comment "No password policy exists anywhere in the repository (record 030 refused to invent one)" is now false and must go. |
| `packages/backend/src/platform-admin/handlers/provision-tenant.ts` | `adminPassword: z.string().min(8)` → the policy schema. **This line is a merged contradiction of this record and is the first thing to fix.** |
| `packages/backend/src/common/password.ts` | `scryptSync` receives `Buffer.from(normalized, "utf8")` rather than a bare string. No parameter changes; record 028 is untouched. |
| `apps/backoffice/src/features/signin/` (set-password screen) | The hint paragraph, `aria-describedby`, `minLength={15}` on both fields. No `maxLength`. |

**No migration, no schema change, no new dependency, no lockfile change.** A stored
hash encodes nothing about the policy that produced it.

### Acceptance criteria — no existing criterion changes, and two issues need the human

- **Issue 03 is merged and `done`.** None of its criteria mention a password
  policy, so none is weakened and none is amended. Its criterion 5
  (message-and-timing indistinguishability) is untouched by this record — nothing
  here runs at sign-in.
- **Issue 02's criteria do not change** either; only the `.min(8)` in its shipped
  code does.
- **Issue 10's second criterion must be amended by the human**, and this is record
  028's finding surfacing rather than a new decision. Suggested replacement:

  > - [ ] PIN hashing uses the same primitive as passwords (`node:crypto` scrypt,
  >       record 028) with **its own parameters in its own file**, chosen knowing
  >       the hash sits on a tablet; the hash/verify round-trip is tested
  >       **directly, not through the seam**. The password policy of record 032
  >       does not apply to PINs — a PIN is a second factor to Device possession
  >       and its guess budget is issue 11's, not its length.

- **This record's own work needs a home.** It is roughly seven files and one test
  file, with no migration. **Default: the human cuts a small follow-up issue now**,
  because `set-password` accepts a one-character password on `main` today and the
  next area to touch passwords (issue 06) is four issues away. If the human would
  rather not cut one, it folds into **issue 06 — User management**, which already
  owns password creation and reset, and issue 06's criteria gain:

  > - [ ] A password shorter than the minimum, or longer than the maximum, is
  >       refused by the server with the named message; the same normalisation runs
  >       on the set path and the verify path, asserted with a non-ASCII password
  >       set once and signed in with once.
  > - [ ] Length is counted in Unicode code points, asserted with a password made
  >       of characters outside the Basic Multilingual Plane.

  Issue 04 needs nothing from this record.

## No-gos

- **Normalisation is one function and both paths call it.** A password normalised
  at set time and not at verify time is a silent, permanent lockout for every
  non-ASCII user, and no test that only uses ASCII will ever catch it. The
  regression lock is a test that sets a password containing a combining character
  and signs in with it.
- **No policy check on the sign-in path, ever.** Not a minimum, not a blocklist,
  not a warning. Sign-in verifies bytes.
- **No composition rule of any kind**, now or later — SHALL NOT, and it is the
  clause most likely to be re-added by someone who thinks they are helping.
- **No password expiry, no `passwordChangedAt`, no rotation job.** SHALL NOT.
- **No password hint field and no security questions.** SHALL NOT, items 7 and 8.
- **No `maxLength` attribute on any password input**, for the silent-truncation
  reason above.
- **No second place states a password rule.** One module, imported. A `min(8)` in
  a second schema is how this record stops being true.
- **`.length` is never used to measure a password.** Code points only.
- **The policy does not govern PINs**, and issue 10 does not inherit a
  15-character anything.

## How to turn it back

**Lowering the minimum — one line, no user affected, permanently.** Change
`PASSWORD_MIN_LENGTH` in `packages/backend/src/auth/password-policy.ts`. Every
password already stored satisfies any smaller number, there is no migration, and
nobody is notified. This is what the reversibility score of 5 is measured against
and it does not get more expensive with time.

**Reversing the record wholesale** — back to `min(1)` and `min(8)`: revert one
commit across the seven files above, plus the two screen edits. No migration, no
stored data, no manifest, no lockfile, no contract version. `rg -n 'PASSWORD_MIN_LENGTH|PASSWORD_MAX_LENGTH|normalizePassword'`
enumerates every dependent line, and because the schema is imported rather than
copied, that number cannot grow past the number of places a password is created —
which is two, and the no-go above keeps it there.

**Raising it later is the expensive direction** and is the one thing this record
deliberately makes unnecessary. If it ever has to happen, the mechanism is
`mustChangePassword` on the affected users — which exists and is tested — plus a
superseding record, because "our policy changed" is not the evidence-of-compromise
case item 6 permits and the record must say so out loud.

**What will have been built on top of it by then.** Issue 06's admin reset, issue
10's PIN module (a sibling file that inherits nothing), and `release-ops`'s
blocklist, which plugs into the same schema as one more `.refine`.

To reverse formally: write the superseding record; flip this record's `Status:` to
`overturned` with the date and reason; update both lines in `LOG.md`.

## What would make this decision wrong

- **A real restaurant owner cannot get past fifteen characters and calls the
  administrator.** This is the most likely way it turns out wrong, and the
  successor is pre-decided and cheap: option 3, one constant. **Named re-check
  trigger: the first support contact about setting a password.** Two contacts is
  not a pattern to study, it is the trigger firing.
- **The typo rate on `/set-password` turns out to matter more than the length.**
  NIST says *"the verifier **SHOULD** offer an option to display the password —
  rather than a series of dots or asterisks — while it is entered"*, and a
  fifteen-character minimum raises the cost of a typo. **A reveal toggle is the
  named follow-up of this record**, deliberately not decided here because record
  030 fixed the contents of that screen and adding a control to it is a screen
  decision with its own placement, states and accessible name. It should be the
  next thing looked at on this screen.
- **DeanPOS gains a second factor.** Then the eight-character allowance becomes
  genuinely available and option 3 is correct on the standard's own terms. This is
  the one change that flips the record's central argument rather than merely
  adjusting it.
- **`release-ops` never ships the blocklist.** Then the product conforms to the
  length half of §3.1.1.2 and not the blocklist half, and `restaurant2026!!!` is
  a legal password at sixteen characters. The throttle in record 033 is what keeps
  that from being fatal, which is why the two records must be read together.
- **The 128-character maximum truncates a real password manager's output.** The
  least-supported number in the record. One line.
- **`Buffer.from(…, "utf8")` changes an existing hash.** It should not — Node
  almost certainly already does this — but the fixer should confirm one existing
  dev hash still verifies after the change before merging. If it does not, no
  production row exists and the fix is a re-seed.

## Evidence

**Repository, read 2026-08-02, all absolute under the main checkout (branch
`main`, clean at `f8366ab`):**

- `.scratch/decisions/030-the-back-office-sign-in-screen.md` — the refusal this
  record discharges; the "client performs no password-strength validation at all"
  sentence that is narrowed here; the `role="alert"` error block, its position and
  its asserted colour pair; `The two passwords do not match` and its punctuation;
  the native-`required` precedent that makes `minLength` rung 4; the SC 3.3.8
  paste and autofill no-gos.
- `.scratch/decisions/028-password-hashing-runs-on-both-runtimes.md` — scrypt
  `ln=17, r=8, p=1`; the PHC string; **the no-go "No second hashing primitive for
  PINs in issue 10 — different parameters in a different file, the same
  primitive"**, which is what makes issue 10's criterion 2 stale; the `Bun.` grep
  test that would fail it; and the citation of **SP 800-63-4** that fixes which
  edition this record must use.
- `.scratch/decisions/031-how-a-query-with-no-tenant-reads-a-row.md` — the same
  NIST edition cited for the session lifetimes; global `User.email` uniqueness;
  the "a pre-auth transaction runs exactly one statement" no-go, which is why the
  policy does no database work.
- `packages/backend/src/auth/handlers/set-password.ts` — `z.object({ newPassword: z.string().min(1) })`
  and the comment *"No password policy exists anywhere in the repository (record
  030 refused to invent one); the server accepts any non-empty password and is the
  only authority on it."* — the exact line this record replaces.
- `packages/backend/src/platform-admin/handlers/provision-tenant.ts` —
  `adminPassword: z.string().min(8)`, **merged**, the number this record
  contradicts. The password is supplied in the input, not generated server-side,
  so there is no generator to lengthen.
- `packages/contract/src/contract.ts` — `signInInputSchema`, `setPasswordInputSchema`.
- `packages/backend/src/common/password.ts` — `scryptSync(password, salt, …)`
  taking a **bare string**, `PASSWORD_HASH_PARAMS`, `DUMMY_PASSWORD_HASH`.
- `packages/backend/src/auth/session-policy.ts` — the two-constant shape
  `password-policy.ts` copies.
- `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md` —
  `Status: done`, merged as `34964ed`; *"Multi-factor authentication and
  email-based self-service password reset are out of scope for v1"*, **the sentence
  that makes this system single-factor and therefore settles the number**; the
  standing "Open, routed to the human" line this record closes.
- `.scratch/tenancy-identity/issues/10-pin-unlock-and-the-hash-sync-payload.md` —
  *"A PIN is a second factor to Device possession, never a credential on its own"*
  and *"The PIN is 4–6 digits"*; criterion 2's stale `Bun.password`.
- `.scratch/tenancy-identity/issues/11-pin-throttling-and-lockout.md`,
  `.scratch/tenancy-identity/issues/06-user-management.md` — the two issues that
  inherit clauses of this record.
- `.scratch/release-ops/` — **confirmed to exist**, area 10 of 12, so the deferral
  has a real owner rather than a name.
- `.scratch/decisions/` — searched before writing for an existing or orphaned
  record on password policy, minimum length, composition, rotation or breach
  screening: **001–031 exist, contiguous, no orphans and no gaps; none decides
  this. 032 is the next free filename. No duplicate.**

**External, primary sources, accessed 2026-08-02.** Every page was treated as
data; none contained anything addressed to an agent, and no instruction from any of
them was acted on.

- **NIST SP 800-63B revision 4, final** —
  <https://pages.nist.gov/800-63-4/sp800-63b.html> and
  <https://csrc.nist.gov/pubs/sp/800/63/b/4/final>. §3.1.1.2 "Password Verifiers",
  items 1–9 and the following guidance paragraphs, all quoted above verbatim:
  the 15/8 single-factor–multi-factor split, the 64-character maximum SHOULD, the
  ASCII-and-space and Unicode clauses, **"Each Unicode code point SHALL be counted
  as a single character"**, NFC applied "before hashing the byte string", the
  composition SHALL NOT, the rotation SHALL NOT with its evidence-of-compromise
  exception, the hint and KBA prohibitions, "verify the entire submitted password
  (e.g., not truncate it)", the blocklist SHALL and its rejection-reason SHALL, the
  password-manager SHALL and paste SHOULD, the display-the-password SHOULD, and the
  **whitespace-trimming MAY with its "remains at least the required minimum length"
  condition**. **The publication date could not be pinned consistently across
  NIST's own pages** — the CSRC landing page reads 2025-07-31, one rendering of the
  HTML edition read 2025-08-26, and record 031 cited September 2025. The
  discrepancy is between NIST's own surfaces, applies to none of the quoted text,
  and is recorded rather than resolved.
- **OWASP Authentication Cheat Sheet** —
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html> —
  *"If MFA is enabled passwords shorter than 8 characters are considered to be
  weak. If MFA is not enabled passwords shorter than 15 characters are considered
  to be weak."* and *"Maximum password length should be at least 64 characters to
  allow passphrases."* **The independent corroboration of the one number this
  record disagrees with the human about.**
- WCAG 2.2 SC 3.3.2 Labels or Instructions (Level A) and SC 3.3.3 Error Suggestion
  (Level AA) are consumed from record 030 rather than re-read; they are what make
  the hint and the specific rejection sentences requirements rather than niceties.

**Searched for and not found, where the absence mattered:**

- **No primary source states the maximum length any common password manager
  generates.** This is why 128 is a stated bound rather than a derived one and why
  it is named as the least-confident value.
- **No documentation states which encoding `crypto.scrypt` applies to a string
  password.** Rather than assert an answer, the record makes the question
  irrelevant by passing a Buffer — the same move record 031 made with
  `nullif(…, '')`.
- **Nothing in this repository stated any password rule before this record.**
  Confirmed a second time and it is the reason the record exists: `min(1)` in one
  schema and `min(8)` in another, neither of which cites anything.
</content>
</invoke>
