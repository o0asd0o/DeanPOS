# 030: The back-office sign-in screen — the states nobody drew, the one error sentence, and no breakpoint at all

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md`; `design/lofi/README.md` sends the undrawn half of every screen here)

## The question

`design/lofi/backoffice/login-1440.svg` draws a card with a title, two labelled
fields, a button, and an error strip. It draws nothing about what any of those look
like when focused, hovered, disabled, pressed, or waiting for the server; nothing
about where the forced password change lands; and nothing at any width below 1440.

Three questions, one screen, one record:

1. Every interaction state the mock does not draw, **including in-flight**.
2. The error state — the exact sentence, where it renders, and the forced-password-change path.
3. What the screen does at 1024, 768 and 390.

What a wrong answer costs. The error sentence is a **security control**: acceptance
criterion 5 says a failure must be indistinguishable between an unknown email and a
wrong password, so any treatment that varies by cause — a different message, a red
border on one field, focus moving to `Email` — hands an attacker a staff directory.
The in-flight answer costs money in a second way: record 028 sets scrypt at
`N=2^17`, which is 128 MiB per verification, so a double-submit is 256 MiB and two
sessions. And this is the **first authenticated screen**; the route shape decided
here is inherited by every screen in eleven areas.

**Out of scope, and refused — see the refusals section:** the password policy
(minimum length, composition, breach checking), rate limiting or lockout, and any
new colour value.

### Weights, declared before any option was scored

| Criterion                 | Weight | Why                                                                                                                                                                                             |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User impact               | ×3     | This is the first screen a real user meets, and one of its elements is a sentence they read and act on.                                                                                         |
| Business impact           | ×1     | Nothing here earns. The one business fact: PRD story 15 has a manager signing in from a phone, and there is no self-service password reset in v1, so a lockout costs a phone call to the admin. |
| Engineering cost and risk | ×2     | Unlike record 009, cost genuinely separates the options — one of them renames eighteen route files.                                                                                             |
| Reversibility             | ×2     | The two feature files are free forever. The route split and the one-sentence error rule are inherited, and that half is not free.                                                               |
| Evidence strength         | ×2     | The sources are the mock, WCAG 2.2's normative text, and records 009/010/013/014/019/024/025. A state invented against none of the three is the failure this record exists to prevent.          |

Maximum possible total: 50. **Not changed after scoring.**

## What I chose, and why

**Sign-in is not a back-office screen with the nav switched off. It is a different
kind of page, and the mock says so by drawing no sidebar.** Everything else follows.

### Records I am consuming as precedent, not re-deciding

| Record    | What I take from it                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 007 / 014 | The focus indicator: a 2px `--color-ring` (`#1e1e1e`) outline at 2px offset, in `theme.css`'s `@layer base { :focus-visible }`. It already covers every field and button on this screen. **Not re-decided, not overridden, not restyled per component.**                                                                                                                                                                                                                              |
| 009       | The landmark contract; `role="alert"` for errors and `role="status"` for pending; **prefer an enabled control with a legible reason over a silently disabled one**; no fake data; no empty reserved box; no skeleton, no spinner, no shimmer; no artificial timing; no technical detail in a user-visible error; **no colour pair on a user-visible message that is not asserted in `contrast.test.ts`**; the viewport meta with no scale lock; `<title>DeanPOS Back office</title>`. |
| 010       | No JSX in any route file. Every `component` is a bare imported identifier. A layout route that only guards or only groups **omits `component` entirely**.                                                                                                                                                                                                                                                                                                                             |
| 013       | `apps/backoffice` is compact density. `tap-target` reads `--tap-size`, which is `--min-target-size: 24px` here. **No component branches on density and no screen switches it.**                                                                                                                                                                                                                                                                                                       |
| 019       | The card on this screen is `Card` from `packages/ui`. Not a hand-rolled `rounded-lg border p-4`. Where the tokens are silent, `inspo/` decides, not a generic pattern.                                                                                                                                                                                                                                                                                                                |
| 024 / 025 | `Card` has no border and no shadow. The page ground is `--color-background` `#f4f5f6`, the card is `#ffffff`, and that 1.11:1 surface step **is** the card's entire edge. This is what lets a centred card read as a card on this screen with nothing drawn around it.                                                                                                                                                                                                                |
| 020       | `Placeholder` and the eighteen thin file routes exist and are what get moved.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 023       | `scrollbar-slim` is set once at the shell root and inherits.                                                                                                                                                                                                                                                                                                                                                                                                                          |

No new token, no new `packages/ui` component, no new dependency, no new colour.

### 1. Where the screen lives — a second layout, because the mock draws no sidebar

The mock draws the page ground and a centred card. **No sidebar, no wordmark bar, no
nav, no `☰`.** That is structure, and structure is the one thing a lo-fi mock does
bind. It is also correct on its own terms: rendering the navigation to someone who
has not signed in is a false affordance, and it publishes the product's whole
information architecture to an unauthenticated visitor.

`apps/backoffice/src/routes/__root.tsx` currently sets `component: AppShell`, so
every route gets the sidebar. The fix is the pattern record 010 already named — it
quotes the codebase ADR-0009 was adapted from, where "the one pathless layout route
is a guard plus `component: Protected`":

```
routes/__root.tsx      no `component` at all  (record 010: the router renders <Outlet/>)
routes/_shell.tsx      component: AppShell    (unchanged file, moved reference)
routes/_shell/…        the eighteen existing routes, renamed, contents unchanged
routes/_gate.tsx       component: AuthLayout  (new, ~6 lines)
routes/_gate/login.tsx
routes/_gate/set-password.tsx
```

`_shell` and `_gate` are deliberately named for the **frame**, not for an auth state,
because `/set-password` is reached _while holding a valid session_.

The eighteen renames are `git mv` with no content edit — record 008's `tsr generate`
runs at the front of the gate and rewrites the generated tree, and the route-id
string in each `createFileRoute(...)` is what the generator maintains. The renames
are not overhead: `_shell.tsx` is the **one** place the session guard and the
must-change redirect live, which is what makes criterion 6 — "before any other
procedure succeeds" — true on the client in one file instead of eighteen. _The
contents of that guard are issue 03's implementation and this record does not design
them._

`AuthLayout` is the whole of the layout answer:

```tsx
<div className="flex min-h-dvh justify-center bg-background p-4 text-foreground">
  <div className="my-auto w-full max-w-md">
    <Outlet />
  </div>
</div>
```

`min-h-dvh` not `h-dvh`, and `my-auto` on the child rather than `justify-center` on
the parent — with `align-items: center` an overflowing card has its top clipped and
unscrollable, which is precisely what happens on a phone in landscape. This is the
one place on the screen where the obvious utility is the wrong one.

**No skip link on these two routes.** Nothing repeats before `<main>`, so SC 2.4.1 is
satisfied by the `<main>` landmark — record 009's own reasoning for `apps/pos`,
applied unchanged. `AppShell`'s skip link stays where it is and is not duplicated.

**No `<header>` on these two routes.** The page has no banner; record 021 put the
wordmark in the sidebar and there is no sidebar here. Exactly one
`<main id="main-content">`, and the card is inside it.

### 2. Structure and order — bound by the mock, restated so it is not re-read

Top to bottom inside one `Card`, and in this order:

1. `CardTitle` — **`DeanPOS back-office`**, carrying `role="heading" aria-level={1}`.
2. `<label htmlFor="email">` — **`Email`** — above the field, never a placeholder.
3. The email `Input`.
4. `<label htmlFor="password">` — **`Password`**.
5. The password `Input`.
6. The submit `Button`, **full width** (`w-full`), accessible name **`Sign in`**.
7. The error block — **only when there is an error**, and nothing when there is not.

Three notes on that list, because each is a decision:

- `role="heading" aria-level={1}` is a props pass-through onto `CardTitle`'s `<div>`.
  `CardTitle` has no `asChild`, and `<h1>` may not contain a `<div>`. This gives the
  page a level-1 heading with a **zero-line diff to `packages/ui`**, preserving record
  013's regeneratable-baseline property.
- The mock writes `SIGN IN`. **The accessible name is `Sign in`**, sentence case, with
  no `uppercase` utility. Casing is type treatment, which the mock's own subtitle says
  comes from tokens, and an all-caps accessible name is read letter-by-letter by some
  screen readers.
- **No `placeholder` attribute on either field.** A placeholder as a label is the
  classic SC 3.3.2 failure, and the mock draws the labels separately anyway.

### 3. The interaction states

**Focus.** Record 007/014's rule, unmodified. `Input` ships _no_ focus classes of its
own — checked in `packages/ui/src/components/input.tsx` — so the global outline is the
entire indicator, and `ring` on `card` is asserted at 3:1 in `contrast.test.ts`.
Record 009's three supporting constraints apply here verbatim: focus order is DOM
order with no positive `tabindex`; **no `overflow-hidden` on the card, the layout
wrapper, or the form**, because the ring needs four pixels outside the border box;
and focus is never removed or restyled per component.

**Hover.** `Button`'s shipped `hover:bg-primary/90`, unmodified. **The two inputs get
no hover treatment** — a text field's affordance is its border and the text cursor,
and there is nothing to reveal. Record 009's standing rule that nothing may be
reachable only by hover holds and is not engaged by anything on this screen.

**Pressed.** **None, deliberately.** `packages/ui`'s `Button` ships no `active:`
class, the mock draws no pressed state, and inventing one means inventing a value.
No `active:` utility appears in app code. The feedback for a press is the label
change described below, which arrives within a frame.

**Disabled.** **The submit button is never disabled for validation.** No
`disabled={!email || !password}`. That is record 009's standing rule applied: a
disabled submit leaves the tab order and gives the user no explanation, and here the
explanation already exists for free — see the native-validation paragraph. The two
inputs are never disabled at any point.

**Loading, on mount.** There is none. The screen fetches nothing, so it paints on the
first render. No skeleton, no spinner, no pending line.

**In flight — the state that matters, and the one place this record diverges from 009.**

Record 009 left `Try again` enabled because TanStack Query deduplicates in-flight
fetches for the same query key. **That reasoning does not transfer.** Sign-in is a
mutation, mutations are not deduplicated, and each duplicate submission costs a 128 MiB
scrypt verification (record 028) and creates a second session row. So something must
stop the double-submit — but `disabled` is still the wrong tool, for 009's reason.

While the sign-in request is in flight:

- The submit button's label becomes **`Signing in…`**. That is the entire loading
  affordance — **no spinner, no skeleton, no shimmer**, per record 009 and per
  `design/lofi/README.md`'s "not drawn, on purpose" list.
- The button carries **`aria-disabled="true"`** and **keeps its native `disabled`
  attribute unset**, so it stays focusable and stays in the tab order. Its appearance
  does not change beyond the label; no `aria-disabled:` utility is added, because
  `Button`'s treatment is not modified per screen.
- **The submit handler returns early while a sign-in is already pending.** That, not
  the ARIA attribute, is what actually prevents the second POST. A control whose
  disabled state is only advertised and not enforced is the bug this sentence exists
  to prevent.
- The `<form>` carries **`aria-busy="true"`**.
- **The form does not disable and focus does not move.** Yanking focus out of the
  password field mid-request is worse than anything it would prevent, and a
  `<fieldset disabled>` does exactly that.
- **No artificial timing.** No minimum display duration for `Signing in…`, no delay,
  no fade, no width lock on the button.

**Native validation does the empty and malformed cases, and no client code does.**
Both fields are `required`; the email field is `type="email"`. That is rung 4 of the
ladder — the browser's own constraint validation blocks submission, focuses the first
offending field and shows a localized message, with **zero validation code and zero
invented copy**. It is not an enumeration channel because it runs before any request.
The two error mechanisms never fire together: native validation prevents the submit
that would produce a server error. If review finds the native bubbles unacceptable,
the successor is `noValidate` plus custom messages in the same error block — that is a
copy decision and needs a record, not a keyboard.

**Autofill and paste are not optional — they are the AA conformance argument.**

> "A cognitive function test (such as remembering a password or solving a puzzle) is
> not required for any step in an authentication process unless that step provides at
> least one of the following: Alternative, Mechanism, Object Recognition, Personal
> Content." — SC 3.3.8, **Level AA**

W3C's Understanding document says plainly that "Remembering a site-specific password
is a cognitive function test", and names the Mechanism this screen relies on: "support
for password entry by password managers to reduce memory need, and copy and paste to
reduce the cognitive burden of re-typing" — warning that if password managers "are
actively blocked from filling in the fields … the page would fail this criterion".

So, as hard no-gos on both screens:

- `autocomplete="username"` on the email field, `autocomplete="current-password"` on
  the password field (also SC 1.3.5, Level AA).
- **No `onPaste`, `onCopy`, `onDrop` or `onContextMenu` handler on any password
  field. No `autocomplete="off"`. No splitting a password across several inputs. No
  CAPTCHA.** Each of these is an AA failure on its own.
- Reviewer's check: `rg -n 'onPaste|onCopy|autocomplete="off"|autoComplete="off"' apps/backoffice/src` returns nothing.

### 4. The error state

**The copy is the mock's, verbatim, and it is the only sentence a failed sign-in ever
produces:**

```
Email or password is incorrect
```

No trailing full stop — that is what the mock writes, and copy written into a mock is
the one thing the mock binds. Unlike record 009's four sentences, **this one is not
freely replaceable**: it is a security control, and any replacement must still be a
single sentence naming both credentials without distinguishing them.

**Where.** Inside the card, **below the submit button**, full card width — the mock's
position and order. Not a toast, not above the form, not beside a field.

**One message, for every one of these causes:**

- the email matches no User;
- the email matches a User and the password is wrong;
- the User is disabled, deleted, or belongs to no active Tenant;
- any future lockout or rate-limit refusal.

That last one is written down now because it is the way this property gets broken
later: a `Too many attempts, try again in 5 minutes` message is an oracle that tells
an attacker the email exists. Whatever shape rate limiting eventually takes, it does
not get its own sign-in message without a superseding record.

**And these treatments are forbidden, because each of them re-creates the channel the
message closes:**

- **No `aria-invalid` on either input on a sign-in failure**, and no red border on
  either. `aria-invalid` means "the value in _this_ field is invalid", which is
  exactly the claim we are refusing to make. The error is form-level.
- **Focus does not move.** It stays on the submit button, where the user left it.
  `role="alert"` announces the message without stealing focus — that is what the role
  is for — and, crucially, nothing about the focus behaviour varies by cause.
- **No client-side email check of any kind.** No `/check-email` call, no async
  validation on blur, no "we don't recognise that address" hint. This defeats criterion
  5 outright regardless of how carefully the server equalises its own timing.
- **No client-side timing.** No debounce and no delay on the submit path. Criterion 5's
  timing half is the server's to hold; the client's job is not to add variance.

**Markup, roles and colour:**

```tsx
<div
  role="alert"
  className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
>
  Email or password is incorrect
</div>
```

- **`role="alert"`**, record 009's precedent for errors, and correct here: the node is
  inserted in response to a user action, which is the case `alert` announces reliably.
  It satisfies SC 4.1.3 Status Messages (AA).
- **Rendered only when there is an error.** No empty reserved box — record 009's rule.
- **`text-foreground` on `bg-status-danger-tint`.** This pair is asserted at 4.5:1 in
  `packages/ui/tests/contrast.test.ts`, and `ring` on `status-danger-tint` is asserted
  at 3:1 so the focus ring survives if a control ever lands inside. This is record
  009's colour rule _applied_, not overridden: 009 chose plain `foreground` on
  `background` because `destructive`/`background` was unasserted, and record 013 later
  added the `-tint` surfaces for exactly this use. **`status-danger-tone` is not used
  as text**: `status-danger-tone` on `card` is asserted only at the 3:1 non-text
  threshold, so using it for a sentence would put an unguaranteed ratio on
  user-visible text.
- The meaning is in the sentence, so SC 1.4.1 is satisfied and the tint is
  reinforcement only.
- **No technical detail, ever** — no status code, no URL, no server-supplied string.

**The standing rule this sets for areas 2–12:** an **inline form error** is a
`role="alert"` block on `--color-status-danger-tint` with `--color-foreground` text; a
**whole-screen failure state** stays record 009's plain `ErrorState`. Two treatments,
two situations, and neither is a matter of taste.

**When the message clears:** it is set when the response arrives and cleared when the
next submit begins. **Not on keystroke** — clearing it as the user types removes the
message while a screen-reader user is still reading it.

**A network failure is not a sign-in failure.** The client renders
`Email or password is incorrect` **only** for the sign-in procedure's defined
authentication-failure error. A network error, a 5xx, or an unexpected shape renders
record 009's existing `ErrorState` — `Can't reach the server.` — because telling
someone their password is wrong when the server is down is a false statement. The
server's side of this is that unknown-email and wrong-password must return the
**identical error code, shape and status**; if they do not, no front-end treatment can
repair it.

### 5. The forced password change — its own route, not this screen

Criterion 6: a User holding a temporary password must set a new one before anything
else. **It lands on `/set-password`, a separate route under the same `_gate` layout —
the same centred card, the same page, no sidebar.**

Three reasons, in order of weight:

- **Refresh.** If it were an internal state of the sign-in card, reloading the browser
  drops the user back on an empty sign-in form while holding a valid must-change
  session — a dead end they cannot reason about. A route survives a reload.
- **"Before anything else" is a routing property.** The gate is a `beforeLoad` on
  `_shell.tsx`: a must-change session redirects to `/set-password`. One place,
  eighteen routes covered, and every route a later area adds is covered by
  construction. An inline swap covers only the screen it is on.
- **A modal is the worst of the three.** It renders the nav and the back-office behind
  it — the exact thing criterion 6 forbids — and it leaks by Escape and click-outside.

`/set-password` redirects to `/` when the flag is not set, so it is never a route with
nothing to do.

**What is on it** — undrawn, so it is derived from the login mock as the nearest
existing screen, in this order:

1. Heading: **`Set a new password`**
2. One sentence: **`Your password was set by an administrator. Choose a new one to continue.`**
3. `<label>` **`New password`** + password input, `autocomplete="new-password"`
4. `<label>` **`Confirm new password`** + password input, `autocomplete="new-password"`
5. Full-width submit: **`Save and continue`** — in flight, **`Saving…`**, with the same
   `aria-disabled` + early-return treatment as sign-in
6. The same `role="alert"` error block, same position, same colours

Two decisions inside that list:

- **No "current password" field.** The user proved it at sign-in seconds ago.
  Re-entering it is the shape SC 3.3.7 Redundant Entry (Level A) discourages, and it
  buys nothing.
- **There _is_ a confirm field**, and it earns its place on a specific fact: the PRD
  says there is **no self-service password reset in v1**, so a single mistyped password
  in a field with no reveal control costs a phone call to an administrator. Its
  mismatch message is **`The two passwords do not match`**, in the same block — and
  here `aria-invalid="true"` **is** set, on the confirm field only, because this is the
  one error on either screen where we honestly know which field is wrong and there is
  no enumeration concern.

On success both screens navigate to `/`. Neither screen adds a per-route `<title>`;
record 009 assigns per-route titles to later areas.

### 6. Below 1440 — there is no breakpoint, and that is the decision

**At 1024, at 768 and at 390 the screen is identical to 1440.** Not "responsive" —
_unchanged_. It is a single centred column whose only width rule is a maximum, so it
reflows on its own and there is nothing to switch.

- Card: `w-full max-w-md`. `max-w-md` is Tailwind's `--container-md` step, chosen as
  the container step nearest a comfortable single-column form — **not measured off the
  SVG**, which record 016's guard would reject as a raw value anyway.
- At 390: the layout wrapper's `p-4` leaves the card ~358px wide and `max-w-md` never
  binds. Same order, same components, **no horizontal scroll and nothing hidden**.
- Between 390 and 1440 there is no intermediate state to get wrong, which is the
  entire point: `design/lofi/README.md` lists these widths as undrawn, and the honest
  translation of "one centred card" is one centred card.
- **No `hidden`/`block` variant pairs, no `sm:`/`md:`/`lg:` utilities at all** on
  either screen or on `AuthLayout`.
- **Density does not change.** `apps/backoffice` is compact (record 013), and login
  stays compact even though a manager may open it on a phone. A per-screen density
  switch is a new mechanism and record 013's clause 3 forbids components branching on
  it. The controls already clear the bar without one: `Button` is `h-9` (36px) and
  `Input` is `h-9` with `tap-target`, against SC 2.5.8's 24px AA minimum.
- The viewport meta with no `maximum-scale` and no `user-scalable=no` is already in
  place from record 009 and is confirmed, not re-decided — it is what makes SC 1.4.4
  hold when someone zooms this form on a phone.

**Checkable property:** `rg -n '\b(sm|md|lg|xl|2xl):' apps/backoffice/src/features/signin apps/backoffice/src/components/AuthLayout.tsx` returns nothing.

## What I refused, and why

- **The password policy** — minimum length, composition rules, breach checking. It is
  a security control with no evidence base anywhere in this repository, issue 03 has
  no criterion for it, and it is outside the three questions asked. **The client
  performs no password-strength validation at all**; the confirm-match check is the
  only client-side rule on `/set-password`, the server is the single authority, and its
  rejection renders as one form-level message in the existing error block whose copy
  arrives with the policy. The implementer flags this in the build report rather than
  inventing a number.
- **Rate limiting and lockout.** Same reasons, plus the enumeration trap named above.
- **Any new colour.** Everything on both screens is an existing `--color-*` token in an
  already-asserted pairing. Had the mock required a pair that is not asserted, WCAG
  would have won and **the replacement colour would have been the human's to choose,
  not mine** — that situation did not arise.

## The options, ranked

| Rank | Option                                                                                                                                                          | User ×3 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- | ---------------- | ---------------- | ----------- | ------ |
| 1    | **Bare `_gate` layout outside the shell; states from shipped tokens and components; mock's copy verbatim; forced change as its own gated route; no breakpoint** | 5 (15)  | 5           | 4 (8)            | 4 (8)            | 5 (10)      | **46** |
| 2    | Bare layout, but the forced change is an inline swap on the sign-in card                                                                                        | 3 (9)   | 4           | 5 (10)           | 3 (6)            | 3 (6)       | **35** |
| 3    | Add `Alert`, `Label` and `Form` primitives to `packages/ui` and build it "properly"                                                                             | 4 (12)  | 3           | 2 (4)            | 2 (4)            | 2 (4)       | **27** |
| 4    | Minimum diff — login inside the existing `AppShell`, plus a `md:` breakpoint for a distinct narrow layout                                                       | 1 (3)   | 3           | 5 (10)           | 4 (8)            | 1 (2)       | **26** |
| 5    | Defer — let the implementer choose each state                                                                                                                   | 1 (3)   | 2           | 3 (6)            | 5 (10)           | 1 (2)       | **23** |

**1. Bare `_gate` layout — chosen.** It is the only option in which every element on
screen traces to something that already exists: the copy to the mock, the error colours
to an asserted pairing in `contrast.test.ts`, the focus ring to record 014, the roles to
ARIA, the paste and autofill rules to SC 3.3.8's normative text, and the layout to a
maximum width plus `margin: auto`. It scores 4 rather than 5 on engineering cost purely
for the eighteen renames, and 4 rather than 5 on reversibility for the reason the
reversal section gives.

**2. Inline swap for the forced change.** Genuinely cheaper — no second route, no
`beforeLoad` redirect, and it keeps the whole flow in one component. It loses on the
refresh case, which is not hypothetical: a must-change user who reloads sees an empty
sign-in form while holding a valid session and has no way to understand why. It also
puts the "before anything else" guarantee in the sign-in component rather than in the
layout route, so every screen a later area adds has to be trusted rather than covered.
This is the option to move to if the redirect proves awkward, and it is a small change.

**3. Add `Alert`, `Label` and `Form` primitives.** Scored properly rather than dismissed,
because it is what a component-library instinct produces and it would give a genuinely
better form story by area 4 or 5. It loses on the ladder: a native `<label htmlFor>` is
rung 3, the error block is a `div` with a role and two utilities, and `Form` would pull
in resolver plumbing for a form with two fields. It also spends record 013's
regeneratable-baseline property on a screen that does not need it, and three new
primitives arriving with the first form become the pattern eleven areas copy before
anyone has seen a second form.

**4. Minimum diff — login inside `AppShell`, with a narrow breakpoint.** The cheapest
possible build and the one an implementer under time pressure produces. It fails on the
one thing the mock actually binds — the mock draws no sidebar — and it publishes the
product's navigation to anyone who loads the URL. The breakpoint half fails on evidence:
`design/lofi/README.md` says these widths are undrawn, so a distinct narrow layout is a
shape invented here and inherited. It scores 1 on evidence for that reason.

**5. Defer.** Included because it must be, and 10 of its 23 points come from
reversibility, which every do-nothing option maximises trivially — the same inflation
records 002, 007, 008, 009 and 015 each left visible rather than tuned away. It fails on
the process: `design/lofi/README.md` routes exactly these gaps here, and deferring means
the error sentence — a security control — gets written at a keyboard under time
pressure.

## How to turn it back

Three parts, with honestly different costs.

**The visible half — free, permanently.** The states, the copy, the colours, the widths
and the ordering are three files: `apps/backoffice/src/components/AuthLayout.tsx` and
the two feature components under `apps/backoffice/src/features/signin/`. Changing any of
them is one commit and no other file notices. This does not get more expensive with
time.

**The route split — cheap today, and it grows with the number of screens.** Reversing
`_shell`/`_gate` means moving however many routes exist back to `routes/` and restoring
`component: AppShell` on `__root.tsx`. Today that is eighteen renames plus two files.
After eleven areas it is every back-office route. Count before quoting a cost:
`rg -l 'createFileRoute' apps/backoffice/src/routes | wc -l`. Note the asymmetry — the
split gets _cheaper to keep_ (every new screen just lands in `_shell/`) and dearer to
undo, which is why it is decided now rather than at area 4.

**The one-sentence error rule — a decision, not a file.** Reversing it means a
superseding record, because it is criterion 5's front-end half. `rg -n 'Email or password is incorrect' apps` locates every copy, which today is one.

To reverse formally: write a superseding record; flip this record's `Status:` to
`overturned` with the date and reason; update both lines in `LOG.md`; edit the files
above; re-run the gate. No migration, no contract, no token, no manifest, no lockfile.

## What would make this decision wrong

- **The server cannot return one identical error for unknown-email and wrong-password.**
  If the contract forces distinguishable failures, this record's central rule is
  unenforceable from the front end and criterion 5 is the one that has to change. This
  is the most likely way it turns out incomplete, and the answer is a contract change,
  not a copy change.
- **`aria-disabled` plus an early-returning handler is not enough to stop the double
  POST in practice.** The property to watch is two session rows from one user's one
  frustrated double-click. If it happens, the successor is pre-decided: native
  `disabled` on the submit for the duration of the flight, accepting 009's tab-order
  cost, because two scrypt verifications at 128 MiB each is the larger harm.
- **The native validation bubbles read badly in review.** Successor pre-decided above:
  `noValidate` plus custom messages in the existing error block. That is a copy
  decision and needs a record.
- **`max-w-md` is the value here I am least confident about.** It is a container step,
  not a measurement, and nobody has seen this card at 1440 next to the reference. The
  fix is one utility, in one file. **Re-check trigger: the first time anyone looks at
  this screen on a real 1440 display.**
- **A manager on a phone finds compact density cramped for a password field.** That
  would be the first real argument for a density decision that varies by screen rather
  than by app, and it belongs in a superseding record against record 013 — not in a
  `data-density` attribute quietly added to this route.
- **The tinted error block conflicts visually with record 009's plain `ErrorState`.**
  Both can appear in the same application. If a human dislikes the two treatments, the
  cheap resolution is to move `ErrorState` onto the tint too — one file per app, no
  token change, and both pairs are already asserted.
- **`role="alert"` on an inserted node is not announced by real assistive technology.**
  Same unknown record 009 flagged for `role="status"`, and the same fallback: an
  always-present empty live region rather than a conditional one. That is a change to
  one component, not to this record's principle.

## Evidence

**Repository, read 2026-08-02 (all absolute under the main checkout):**

- `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md` — acceptance
  criteria 5 and 6 quoted verbatim; the visual reference line; the note that
  self-service reset is out of scope for v1.
- `.scratch/tenancy-identity/PRD.md` — stories 14–20, in particular story 15 (a manager
  signing in from a phone) and story 20 (no enumeration); "Password reset is
  admin-initiated. A tenant admin sets a temporary password that must be changed on next
  sign-in. There is no email-based self-service reset in v1."
- `design/lofi/backoffice/login-1440.svg` — read in full including the three notes under
  the frame: "One message for unknown email and wrong password — no account
  enumeration"; "No self-service password reset in v1; an admin sets a temporary
  password"; "This is the desk. Cashiers unlock the terminal with a PIN instead." The
  drawn strings `DeanPOS back-office`, `Email`, `Password`, `SIGN IN`, and
  `Email or password is incorrect`. **No sidebar, no nav and no top bar are drawn** —
  the fact the route split rests on.
- `design/lofi/README.md` — "A mock fixes what is on the screen and in what order.
  Nothing else"; the "Not drawn, on purpose" list naming loading and skeleton states,
  error states, focus/hover/disabled/pressed treatments, the back-office between 390 and
  1440, and motion; and the back-office width table, which draws 390 only for reports
  summary and roster.
- `.claude/skills/lofi-to-code/SKILL.md` — the two-column table (copy "where written in"
  is bound; interaction states and undrawn widths are not); "a single column that keeps
  the mock's order is the correct default"; the two exceptions an implementer may decide
  alone, neither of which covers anything in this record.
- `packages/ui/src/components/input.tsx` — read in full. **It ships no focus classes**,
  which is why the global `:focus-visible` rule is the entire indicator; it already
  carries `tap-target`, `h-9`, `border-input`, `placeholder:text-muted-foreground`,
  `disabled:*` and `aria-invalid:border-destructive`.
- `packages/ui/src/components/button.tsx` — the base class carries
  `disabled:pointer-events-none disabled:opacity-50` and `transition-all`, and **no
  `active:` class**, which is why no pressed treatment exists to consume.
  `packages/ui/src/components/card.tsx` — `rounded-2xl bg-card py-6`, **no border and no
  shadow** (records 024/025), and `CardTitle` is a `<div>` with no `asChild`.
- `packages/ui/tests/contrast.test.ts` — the full 45-row pairing table. Load-bearing
  rows: `foreground`/`status-danger-tint` at 4.5, `ring`/`status-danger-tint` at 3.0,
  `foreground`/`card` at 4.5, `ring`/`card` at 3.0. **Absent, and checked specifically:**
  `destructive`/`card` and `destructive`/`background`. `status-danger-tone`/`card` is
  present only at the 3.0 non-text threshold.
- `packages/ui/src/theme.css` — `--color-ring: #1e1e1e`, `--focus-ring-width: 2px`,
  `--focus-ring-offset: 2px`, `--color-background: #f4f5f6`, `--color-card: #ffffff`,
  `--color-status-danger-tint: #fbe6ec`; the `tap-target` and `scrollbar-slim`
  utilities. `packages/ui/src/index.ts` — **no `Label`, no `Form`, no `Alert` is
  exported**, which is what sends the labels to native `<label>` and the error block to a
  `div` with a role.
- `apps/backoffice/src/components/AppShell.tsx`, `src/routes/__root.tsx`, the eighteen
  route files, `src/components/ErrorState.tsx`, `src/features/placeholder/Placeholder.tsx`
  — read in full; the skip link and `scrollbar-slim` placement; **no login, sign-in or
  auth route exists today.**
- `.scratch/decisions/` — 007, 009, 010, 013, 014, 016, 019, 020, 021, 023, 024, 025,
  026 read or read via `LOG.md`. **Searched for an existing record on the sign-in screen,
  form states, inline error treatment, or back-office breakpoints before deciding: none
  of 001–029 names any of them. `030` is the next free filename. No duplicate.**

**External, primary sources, accessed 2026-08-02:**

- <https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html>
  and <https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum> — SC 3.3.8,
  **Level AA**, normative text quoted in full above; the definition of a cognitive
  function test; "Remembering a site-specific password is a cognitive function test";
  the Mechanism exception naming password managers and copy-and-paste; and the warning
  that actively blocking them fails the criterion. **This is the strongest external
  input in the record and it is what makes the paste and autofill rules no-gos rather
  than preferences.**
- <https://www.w3.org/TR/WCAG22/> — conformance levels confirmed for SC 3.3.1 Error
  Identification (A), SC 3.3.2 Labels or Instructions (A), SC 3.3.3 Error Suggestion
  (AA), SC 3.3.7 Redundant Entry (A), SC 4.1.3 Status Messages (AA), SC 1.3.5 Identify
  Input Purpose (AA). SC 1.4.1 Use of Color (A), SC 1.4.4 Resize Text (AA), SC 2.4.1
  Bypass Blocks (A) and SC 2.5.8 Target Size (Minimum) (AA) are consumed from record 009
  rather than re-read.
- <https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing> —
  the pathless layout convention: an underscore-prefixed file (`_pathlessLayout.tsx`)
  contributes no URL segment, with children either in a matching directory or in
  dot-notation filenames. **Noted honestly: this page did not confirm that a route
  omitting `component` renders an `<Outlet />` automatically.** That fact is record 010's,
  where it was verified and is already load-bearing, and it is consumed here rather than
  re-established — with record 010's own re-check trigger (any router major bump) still
  the right one.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and
no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No password policy exists anywhere in the repository** — not in the PRD, not in
  issue 03, not in ADR-0008, not in records 027–029. This is why the policy is refused
  above rather than derived. An absent policy is a real input: it means any number
  written into this screen would have been invented here and inherited as though chosen.
- **No breakpoint value is fixed by any design source**, the same gap record 009 recorded.
  Here it is not a weakness, because the chosen answer needs no breakpoint at all.
- **No existing form, `<input>` or `<label>` renders anywhere in `apps/` today.** There is
  no nearest existing screen to copy a form treatment from, which is why every value above
  traces to a token, a shipped component's own class string, or a W3C document — and none
  to taste.
