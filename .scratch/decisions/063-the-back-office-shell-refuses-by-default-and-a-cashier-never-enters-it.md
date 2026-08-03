# 063: The back-office shell refuses by default — every `_shell` route declares its minimum role, a `cashier` never enters the shell at all, and PIN self-service moves to a standalone `/pin` page

- **Status:** decided
- **Stakes:** **high** — an authorisation default inherited by every back-office screen in nine remaining areas, and the surface that decides whether a cashier can set their first PIN.
- **Date:** 2026-08-04
- **Asked by:** the human, from the back-office authorisation handoff following record 058
- **Relates to:** [058](058-pin-management-is-a-back-office-action.md) (two clauses superseded; stays `decided`), [046](046-how-tenant-settings-are-stored-and-audited.md) §4 (its enforcement/presentation split is the load-bearing rule here), [062](062-the-wrong-tenant-probe-coverage-guard.md) (same failure shape, and the reason a *mechanism* is required rather than fourteen edits), [030](030-the-session-guard-and-the-must-change-redirect.md) (`_shell`'s existing guard), [060](060-the-override-is-verified-on-the-terminal-and-consumed-by-a-second-insert-only-table.md) Q5, [056](056-the-device-principal-its-token-and-its-two-screens.md), [044](044-the-users-list.md) §2, [038](038-payment-methods-and-stores.md) §6, [010](010-the-word-layout-in-the-routes-layer.md), [009](009-the-error-and-empty-states.md)

## The question

Record 058 put PIN self-service in the account menu deliberately un-role-gated, so a cashier can
set their own PIN. It verified the premise it needed — a cashier can sign in — and stopped there.
It never decided **what a cashier should see once inside**, and neither has anything else.

The back office is allow-by-default. Every screen is gated on its own or not at all, and three of
the gates that exist were added because a reviewer noticed. What is each role's back-office
surface, where does PIN self-service live, and what happens to a route that declares nothing?

**Weights, declared before any option was scored.** **User ×2** (a stranded cashier, and the
disclosure that lands the day Reports ships) · **Business ×1** · **Eng cost/risk ×3** (whatever is
chosen is inherited by every back-office screen across nine remaining areas — the same
multiplier 062 used, for the same reason) · **Reversibility ×2** · **Evidence ×3** (this turns on
what the installed router actually exposes and on what the handlers actually enforce, both
checkable here). Maximum **55**. **Not changed after scoring.**

## Already established, not re-litigated

- **A cashier can complete back-office sign-in today.** `sign-in.ts` gates on active User,
  password, and *presence* of a role — never on which role. Confirmed by the human, 2026-08-04.
  Record 058's premise holds; PIN self-service works today.
- **046 §4:** server-side refusal is the enforcement. Hiding a nav entry is presentation and is
  never enforcement. Everything below obeys this; nothing below removes a handler guard.
- **058:** no server procedure compares a submitted PIN against a stored hash, and `currentPin`
  does not exist. Untouched here, and `pin-no-logging-grep.test.ts` keeps it that way.
- **Migrations are additive.** Nothing in this record touches the database at all.

## What today actually exposes, verified rather than assumed

`_shell.tsx` carries the session guard and the must-change-password redirect and **no role gate**.
`NAV_GROUPS` (`apps/backoffice/src/components/helpers.ts:26`) is a static list of **19 entries in
three groups, filtered for nobody** — Settings is not in it at all, being a `UserMenu` dialog item
gated by `role === "admin"`. So every signed-in principal, cashier included, is advertised all 19.

Behind those 19 entries, for a `cashier`:

| Surface | What happens today | Why |
| --- | --- | --- |
| `/devices` | redirect to `/` | route `beforeLoad`, added in issue 09 after review |
| `/reports/discounts-overrides` | redirect to `/` | route `beforeLoad` (record 060 Q5) |
| `/stores` | renders, **empty list** | `list-stores.ts:15` refuses below `manager` |
| `/employees` | renders, **empty list** | `list-users.ts:19` refuses below `manager` |
| `/payment-methods` | renders, **empty list** | all five handlers require `admin` |
| `/` | renders `Ping` | tenant-neutral |
| **13 others** | render `Placeholder` | **nothing is built yet** |

**No cashier leak exists today, and that is entirely luck.** Two screens are gated, three are
saved by handlers that already refuse below `manager`, and thirteen are saved by not existing.
The eight Reports entries — takings, per-cashier performance, discounts, refunds — are in that
last column. **The exposure is bounded by unbuilt screens, which is not a control.** This is a
live authorisation defect being treated as one, not a design tidy-up.

## What I chose, and why

### 1. The shell refuses by default, and the declaration lives on the route

`_shell`'s `beforeLoad` reads the destination leaf's declared minimum role and refuses when it is
absent or higher than the caller's. **A route that declares nothing is refused** — for everyone,
including `admin`, so the omission surfaces the first time the author loads their own screen
rather than eight areas later when a reviewer happens to look.

The declaration is TanStack Router's own `staticData`, not a new invention:

```ts
export const Route = createFileRoute("/_shell/stores")({
  staticData: { minRole: "manager" },
  component: Stores,
});
```

**Verified present in the installed build**, to 062's standard, since the whole mechanism rests
on it. `@tanstack/react-router@1.170.18` resolves `@tanstack/router-core@1.171.15`, where
`BeforeLoadContextOptions extends ContextOptions`, which carries `matches: Array<MakeRouteMatchUnion>`
(`route.d.ts:274`); every `RouteMatch` carries `staticData` (`Matches.d.ts:73`); `router.js:952`
copies `route.options.staticData || {}` onto each match; and `load-matches.js:247` passes
`inner.matches` — the full match array for the **pending** location, children included — into
each `beforeLoad`. A parent therefore sees its children's declarations before any of them runs.
This is vendor API in the installed version, not an internal reached around.

**Refusal is `throw notFound()`, not a redirect.** Three reasons. It cannot loop, where
`redirect({ to: "/" })` loops the day `/` itself is the undeclared route — the worst failure mode
a guard can have, because an infinite bounce reads as a hung app rather than a missing
declaration. It reuses what exists: `router.tsx:19` already wires `defaultNotFoundComponent:
NotFoundState`, so there is nothing to build. And it says the same thing to "this needs `admin`"
and "this declares nothing", which is the correct disclosure posture — a caller learns their own
role's surface and never the shape of anyone else's. `devices.tsx` and
`reports/discounts-overrides.tsx` lose their hand-rolled redirects and become two `staticData`
lines; the behaviour change there (404 instead of a bounce to `/`) is deliberate and is the whole
point of having one rule.

### 2. A `cashier` is refused from `_shell` entirely, before any per-route check

Not "sees a filtered shell" — **never enters it.** The same `beforeLoad`, one line earlier.

A cashier's legitimate back-office business is one field long: set my PIN. Giving them the shell
to do it means a sidebar to filter, an index page to justify, and nineteen — soon more — screens
that must each keep refusing them correctly, forever, across nine areas. Refusing at the frame
deletes that entire class of question instead of answering it repeatedly. It also collapses the
shell's authorisation model from three roles to two, which is why the `staticData` values below
are only ever `manager` or `admin`.

`set-password` already established the pattern this follows exactly: a standalone page under
`_gate`, no sidebar, no nav, reached while holding a valid session.

### 3. PIN self-service becomes `/pin` under `_gate`, and it is the only such surface

`PinDialog.tsx` is deleted. Its form body moves to `features/pin/SetPin.tsx`, rendered by
`routes/_gate/pin.tsx` — `SetPassword`'s shape, one field, `AuthLayout`'s frame. The `UserMenu`
item stays where record 048 put it and becomes a `Link to="/pin"` instead of a dialog trigger.

**One surface, not two.** Keeping the dialog for manager/admin and adding a page for cashiers
would leave two copies of the same field, the same validation and the same mutation to keep in
step — and 058's own principle is one write, one procedure. This is a net deletion.

`/pin` guards on session and `mustChangePassword` only — **any authenticated role**, because
admins and managers unlock tills too. Its `beforeLoad` is `set-password.tsx`'s, minus the
must-change check inverted:

- not authenticated → `/login`
- `mustChangePassword` → `/set-password` (that flow finishes first)

A cashier signing in is redirected here by `_shell` and this is their whole back office. On
success they see the confirmation in place. Manager and admin get a **Back** link, rendered only
for `manager`-or-above — a cashier clicking a Back link would bounce off `_shell` straight back
to `/pin`, and a link that returns you to where you are is worse than no link.

`_gate.tsx`'s comment saying `/login` and `/set-password` are its only two screens is now wrong
and is amended with the file.

### 4. `minRole` mirrors what the handler already enforces — placeholders start closed

The rule is mechanical, so it cannot be argued case by case: **a route declares the minimum role
its handlers already refuse below. A route with no handler declares `admin`.**

| `minRole` | Routes |
| --- | --- |
| `manager` | `/`, `/stores`, `/employees`, `/reports/discounts-overrides` |
| `admin` | `/devices`, `/payment-methods`, and the **13 placeholders** — `/catalog`, `/add-ons`, `/discounts`, `/availability`, `/roster`, `/quarantine`, and the eight `/reports/*` |
| — | `_shell` itself declares nothing; it is the frame, not a screen |

Those four `manager` routes are precisely the ones with shipped, tested, Store-scoped manager
behaviour. Everything else is `admin` because **no code anywhere has yet decided what a manager
may see there**, and inventing that answer inside a guard is how the current mess was made.

**The cost, stated plainly: a manager's sidebar drops from 19 entries to 4, and Reports is not
among them.** That is very likely wrong as product — a manager running a store needs their daily
takings. It is deliberately not fixed here. Each Reports issue lowers its own route to `manager`
in the same commit that ships the Store-scoped handler behind it, and that pairing is the
constraint this record puts on those issues: **a Reports route may not be lowered to `manager`
until its handler scopes to the caller's assigned Stores**, exactly as `list-overrides.ts`
already does. Starting closed and lowering with evidence is reversible in one line. Starting open
is what produced this record.

### 5. The nav filters from the same fact, and a test holds them equal

`NavItem` gains `minRole`; `NavGroup` drops items above the caller's role and a group with no
surviving items does not render. This is presentation — 046 §4 — and it is not the enforcement;
the router refuses whether or not the sidebar is honest.

But a sidebar advertising screens that 404 is a bug, and two hand-written lists of the same fact
drift. So one test asserts, for every `NAV_GROUPS` entry, that its `minRole` equals the
`staticData.minRole` of the route it points at, and that the route exists. Ten lines, and it is
062's shape at one-thirtieth the size: the machine holds the pair together instead of a reviewer.

## The options, ranked

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Deny-by-default in `_shell`; cashier refused from the shell; PIN self-service moves to `/pin`** | 5 (10) | 4 | 5 (15) | 4 (8) | 5 (15) | **52** |
| 2 | Deny-by-default in `_shell`, cashier stays in a role-filtered shell, PIN stays a dialog | 3 (6) | 3 | 4 (12) | 4 (8) | 4 (12) | **41** |
| 3 | Keep allow-by-default; add the 14 missing guards, filter the nav, add a coverage test | 3 (6) | 3 | 2 (6) | 5 (10) | 3 (9) | **34** |
| 4 | Router untouched; rely on handler refusals and scope Reports when it ships | 2 (4) | 2 | 3 (9) | 5 (10) | 2 (6) | **31** |
| 5 | Defer to the implementer of the first Reports issue | 1 (2) | 1 | 2 (6) | 5 (10) | 1 (3) | **22** |

**2 — cashier stays in the shell.** The honest runner-up, and it fixes the defect. It loses on
engineering cost: it keeps a third role inside the shell forever, so every future screen and
every nav group carries a cashier case that exists only to render nothing. It also keeps two PIN
surfaces. What it buys is a promoted cashier needing no re-plumbing — real, and cheap to reverse
into if it ever matters.

**3 — fourteen guards plus a coverage test.** The smallest diff, and the closest to 062's
literal shape. It loses because a coverage test can only assert a guard is *present*; 062 spent
half its length on exactly that limitation and moved the teeth into the helper. Here the teeth
can live in the frame instead, which is strictly better than testing that fourteen authors
remembered.

**4 — server-side only.** Defensible on the letter of 046 §4, and it is the only option needing
no front-end change. It loses on user impact: a sidebar of nineteen entries that mostly 404 or
render empty is not an authorisation model, it is an unusable screen, and it leaves the cashier's
first-PIN path routed through a shell built for people who are not them.

**5 — defer.** Ten of its 22 points are the reversibility every do-nothing option collects free.
The whole premise of this record is that per-issue judgement has already failed at this, in this
repo, three times out of five.

## What changes in issue 10's shipped surfaces

Record 058 shipped correctly against the shell as it stood. Three of its artefacts move:

| Artefact | Change |
| --- | --- |
| `features/pin/PinDialog.tsx` | **Deleted.** Form body becomes `features/pin/SetPin.tsx` |
| `routes/_gate/pin.tsx` | **New.** `SetPassword`'s guard shape; any authenticated role |
| `components/UserMenu.tsx` | PIN item becomes a `Link to="/pin"`; `PinDialog` import and its `useState` go |
| `features/users/ResetPinDialog.tsx` | **Unchanged.** `/employees` is `manager`+, the button is `isAdmin`-gated, `resetPin` is admin-only |
| `user.setPin` / `user.resetPin` | **Unchanged.** No contract edit, no handler edit, no migration |
| `pin-no-logging-grep.test.ts` | **Unchanged**, and still binding |

**This is required to keep issue 10 true, not an improvement on it.** Issue 10's criterion that a
User sets their own PIN is today satisfied only through a shell that, after this record, a
cashier does not enter. Refusing the cashier from `_shell` without moving the surface would
strand exactly the person the criterion is about — the failure 058 named as its least-confident
assumption. The two halves ship together or neither ships.

## Amendments to record 058 — it stays `decided`

Two clauses are superseded; the decision itself is untouched.

1. **"The flows live in the back office"** — still true, and the reasoning (only the back office
   has a password session; a Device token proves store, never person) is untouched. **Superseded:
   the parenthetical "a `cashier` can already sign in to the back office (no role gate,
   verified), so everyone who needs the surface reaches it."** A cashier still signs in and still
   reaches the surface, but reaches `/pin` under `_gate`, not a shell screen.

2. **"Self-service is a `DropdownMenuItem` in `UserMenu` opening a controlled `Dialog` —
   `SettingsDialog`'s exact shape."** Superseded by §3 above: a `DropdownMenuItem` wrapping a
   `Link` to a `_gate` page, `SetPassword`'s shape. 048's placement of the item is unaffected.

3. **A clause is added to 058's "What should make you reverse this."** Its second trigger — *"a
   role gate is added to back-office sign-in, or a cashier exists without a back-office account.
   Then first-use PIN setting dies silently"* — **has half-fired.** No gate was added to
   *sign-in*; one was added to the *shell*. The trigger was answered by relocating the surface
   rather than by leaving it stranded, so 058's conclusion survives intact. **The trigger stays
   armed for its other half**: a role gate on `auth.signIn` itself would still kill first-use PIN
   setting, and this record does not protect against that either.

`user.setPin`'s row in 058's per-procedure table — *cookie / tenant session, **any role***, acting
on `ctx.principal.userId`, no `id` field — is **reaffirmed, not amended**. It is what makes a
cashier's `/pin` work without a second procedure.

## What this deliberately does not decide

- **Whether a manager should see Reports.** §4 says why, and names the pairing that decides it.
- **A minimum-role declaration for *procedures*.** Every handler keeps its own `hasAtLeastRole`
  and this record removes none of them. Whether the server should have its own mechanical
  coverage guard is 062's neighbourhood and belongs with issue 13's rule 11, not here.
- **Anything about `apps/pos`.** Device-token only; no cookie path; untouched.
- **Whether a cashier should have a back-office account at all.** They do, they need one to set a
  PIN, and this record only decides what it reaches.

## How to turn it back

| What | Cost |
| --- | --- |
| **Let cashiers into the shell again** | Delete one line from `_shell`'s `beforeLoad`. The `staticData` declarations stay valid; add `minRole: "cashier"` to whatever they should see |
| **Restore allow-by-default** | Delete the `staticData` lookup from `_shell` (~10 lines). The declarations become inert prose; `devices.tsx` and `reports/discounts-overrides.tsx` need their redirects back, from this commit's parent |
| **Restore `PinDialog`** | One commit under `features/pin/` and `UserMenu.tsx`; the file is recoverable from this commit's parent. **No contract, handler or migration change either way** |
| Lower one route | One word in one `staticData`, plus the matching `NAV_GROUPS` entry, or the equality test fails |
| Formally | Superseding record; flip this `Status:` to `overturned` with date and reason; update `LOG.md`; re-run the gate. **No migration anywhere** |

## What should make you reverse this

- **The router's `staticData` on a parent's `matches` stops being reliable.** The mechanism's one
  external dependency. A major `@tanstack/react-router` upgrade is the moment to re-verify the
  four citations in §1; if it breaks, option 3 is the successor — per-route guards plus a
  coverage test — not a return to allow-by-default.
- **Managers routinely need screens the four-route surface does not cover**, and issues start
  lowering `minRole` without shipping the scoping behind it. That is the pairing in §4 failing,
  and it means the declaration has become a formality.
- **A cashier acquires legitimate back-office business beyond their PIN** — a timesheet, a
  roster view, their own sales. Successor is option 2, and it is cheap: one line out of the
  shell guard.
- **A role gate is added to `auth.signIn` itself.** 058's trigger, still armed, still unprotected.
- **`notFound()` on refusal turns out to hide a real bug from developers** — a screen that
  silently 404s for everyone because its author forgot the declaration is exactly the intended
  behaviour, but if it reads as "the route is broken" rather than "the route is undeclared", the
  fix is a dev-only message in the refusal, not a change to the default.

## Evidence

**Read 2026-08-04, on `main` at `2fa6ea0`:**

- `apps/backoffice/src/routes/_shell.tsx` in full — session guard and must-change redirect,
  **no role check of any kind**. `routes/_gate.tsx` and `routes/_gate/set-password.tsx` — the
  standalone-page pattern `/pin` copies. `routes/__root.tsx` — no component, per record 010.
- All 20 route files under `routes/_shell/` — **two carry a `beforeLoad`** (`devices.tsx:9`,
  `reports/discounts-overrides.tsx:9`); the other 18 carry none. **13 render `Placeholder`.**
- `apps/backoffice/src/components/helpers.ts:26–58` — `NAV_GROUPS`, 19 entries, three groups,
  **no role field and no filtering**; `Nav.tsx` maps it unconditionally. Settings is absent from
  it entirely — `UserMenu.tsx:78` gates it on `role === "admin"` as a dialog item.
- `apps/backoffice/src/router.tsx:19` — `defaultNotFoundComponent: NotFoundState` **already
  wired**, so §1's refusal builds nothing.
- Handler-side truth for the `minRole` table: `list-stores.ts:15` and `list-users.ts:19`
  (`hasAtLeastRole(role, "manager")`, empty array never an error);
  `list-overrides.ts:20` (`manager`, Store-scoped at :24); all five under
  `payment-method/handlers/` (`hasAtLeastRole(role, "admin")`); `common/authorize.ts:5`
  (`cashier: 0, manager: 1, admin: 2`).
- `packages/backend/src/auth/handlers/sign-in.ts` — refuses on inactive User, wrong password, or
  **absent** role; never on which role. `auth/handlers/me.ts` — `role` is on every authenticated
  payload, so both guards can read it with no contract change.
- `user/handlers/set-pin.ts` — `ctx.principal.userId`, any role, `{ pin }` only. Unchanged by
  this record, and the reason `/pin` needs no new procedure.
- **Router API, installed build:** `@tanstack/react-router@1.170.18` →
  `@tanstack/router-core@1.171.15`. `route.d.ts:274` (`matches` on `ContextOptions`, which
  `BeforeLoadContextOptions` extends at :299), `Matches.d.ts:73` (`staticData` on `RouteMatch`),
  `router.js:952` (`staticData: route.options.staticData || {}`), `load-matches.js:247`
  (`matches: inner.matches` into the `beforeLoad` context).
- Records **058** in full, **046** §4, **062**, **060** Q5, **056**, **044** §2, **038** §6,
  **030**, **010**, **009**. `.scratch/decisions/` listed directly: **062 is the highest number
  and is taken; 063 is free.** Nothing existing decides the shell's authorisation default, the
  per-role back-office surface, or where PIN self-service lives — 058 decided *that* it lives in
  the back office and explicitly left *where inside* open.

**External: none, and deliberately.** Deny-by-default authorisation is settled practice, not a
contested question, and the only genuinely uncertain input — whether this router exposes a
child's `staticData` to a parent's `beforeLoad` — is answered by the installed package's own
source above rather than by documentation that may describe a different version.

## Pass criteria for the issue that implements this

- A `cashier` session on any `_shell` path is refused and lands on `/pin`; `/pin` renders and
  saves for `cashier`, `manager` and `admin` alike.
- A `manager` session gets `NotFoundState` on `/payment-methods` and on every placeholder;
  renders `/`, `/stores`, `/employees`, `/reports/discounts-overrides`.
- **A route with `staticData` removed is refused for `admin`** — the default itself is asserted,
  not just the declarations.
- Sidebar entry count matches reachable routes per role, held by the equality test in §5.
- Automated accessibility check passes on `/pin`; clicks dispatch a real `MouseEvent`
  (`happy-dom` implements no activation behaviour, record 042 — `user-event` stays refused).
- Gate, flag before the task specifier, reporting `0/10 cache hit`:
  `vp run -w codegen` · `vp check` · `vp run --no-cache -r check` · `vp run --no-cache -r test`.
  Baseline **589** tests on `main`.
