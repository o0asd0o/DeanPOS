# 15 — Back-office authorisation for non-admin roles

**Status:** ready-for-agent

## What to build

The back office is allow-by-default. `_shell.tsx` carries the session guard and the
must-change-password redirect and **no role check**; `NAV_GROUPS` is a static 19-entry list
filtered for nobody. A cashier signs in — `sign-in.ts` gates on active User, password, and the
*presence* of a role, never on which one — and is advertised every screen in the product.

Nothing leaks today, and only by luck: two routes carry a hand-rolled `beforeLoad`, three are
saved by handlers that already refuse below `manager`, and **thirteen are placeholders**. The
eight Reports entries in that last group are takings, per-cashier performance, discounts and
refunds. **The exposure is bounded by screens not existing yet, which is not a control.** Treat
this as a live authorisation defect.

**Everything below is decided by
[record 063](../../decisions/063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md).**
Read it before starting — **including Amendment 1 at the top, which reverses that record's §2 and
revises §3 and §4.** This issue is written against the amended record; where the record's body and
its Amendment 1 disagree, Amendment 1 wins. It carries the reasoning, the verified router API, and
the costs this issue is knowingly accepting. Do not re-litigate the choices here; if one looks
wrong, say so and stop rather than deviating.

### 1. The shell refuses by default

`_shell`'s `beforeLoad` reads the destination leaf's declared minimum role from TanStack Router's
own `staticData` and refuses when it is **absent** or higher than the caller's:

```ts
export const Route = createFileRoute("/_shell/stores")({
  staticData: { minRole: "manager" },
  component: Stores,
});
```

A route that declares nothing is refused **for everyone, including `admin`** — that is the point.
The omission surfaces the first time its author loads their own screen, not eight areas later.

**Refusal is `throw notFound()`, never a redirect.** A redirect to `/` loops the day `/` is the
undeclared route, and an infinite bounce reads as a hung app rather than a missing declaration.
`router.tsx:19` already wires `defaultNotFoundComponent: NotFoundState`, so there is nothing to
build. The same refusal covers "declares nothing" and "needs a higher role", so a caller learns
their own surface and never the shape of anyone else's.

The API this rests on is **verified present in the installed build** — `@tanstack/react-router@1.170.18`
→ `@tanstack/router-core@1.171.15`: `matches` on `ContextOptions` (`route.d.ts:274`, which
`BeforeLoadContextOptions` extends at :299), `staticData` on every `RouteMatch` (`Matches.d.ts:73`),
copied at `router.js:952`, and the **pending** location's full match array — children included —
passed into each `beforeLoad` at `load-matches.js:247`.

`devices.tsx` and `reports/discounts-overrides.tsx` lose their hand-rolled redirects and become
one `staticData` line each. Their behaviour changes from a bounce to `/` into a not-found; that is
deliberate, and is the whole point of having one rule.

### 2. A cashier enters the shell, behind a filtered nav

The shell's `beforeLoad` has **one** check — the `minRole` comparison from §1. There is no
separate cashier line. A cashier signing in lands on `/`, sees an **empty sidebar** — no
`NAV_GROUPS` entry survives their role — and reaches `/account` from the `UserMenu`. Every other
`_shell` path is `notFound()` to them by the same rule that governs a manager on `/devices`.

**Record 063's body argues the opposite and its Amendment 1 reverses it** — the PRD's per-role
per-surface table (`PRD.md:311`) already grants a cashier their own published Shifts and their own
session summaries, so their surface was never one page, and three standalone `_gate` pages with no
nav is worse than a shell because nothing lets them move between the pages.

### 3. `/account` — one screen, three sections

`features/pin/PinDialog.tsx` is **deleted** and becomes a section of a new `/account` screen at
`minRole: "cashier"`. Profile, PIN and (later) password are the same errand and are one screen,
not three, and `/account` is where the `UserMenu` items point.

**In scope now — two sections:**

- **Profile, read-only.** The signed-in User's own name, email, role, and assigned Stores.
  **Nobody else's, ever** (PRD story 13: a cashier *"cannot see or change anything about other
  Users"*). Source it from `auth.me`, not from `user.list` — `list-users.ts:19` refuses below
  `manager` and would return an empty array here anyway.
- **PIN.** `PinDialog`'s form body, unchanged: one field, `user.setPin`, no `currentPin`.

**`auth.me` gains `firstName` and `lastName`.** `User` has carried `first_name`/`last_name` since
record 053 but `meOutputSchema` (`contract.ts:341`) exposes neither, which is why
`components/helpers.ts` still splits an email to guess a display name. Adding the two fields feeds
the profile section and **clears the standing `ponytail:` marker at `components/helpers.ts:71`,
which asks for exactly this** — delete the marker and the derivation with it. Assigned Stores come
from `getAssignedStoreIdsAsOf` for the caller's own `userId`; no new procedure.

The `UserMenu` PIN item becomes a `Link to="/account"`; the dialog state and import go with it.
`_gate` is not touched at all — no `/pin` route is created, and its two-screens comment stays true.

**Out of scope, and must not be smuggled in: the password section.** `auth.setPassword`
(`packages/backend/src/auth/handlers/set-password.ts:20`) deliberately refuses unless
`mustChangePassword` is set. Self-service change needs a `currentPassword` field and its own
record — **issue 16.** Leave the section out entirely rather than stubbing it.

**This keeps issue 10 true rather than improving on it.** Issue 10's criterion that a User sets
their own PIN survives the move; deleting `PinDialog` without landing `/account` would strand it.

### 4. The `minRole` values

Mechanical, so it cannot be argued case by case: **a route declares the minimum role its handlers
already refuse below; a route with no handler declares `admin`.**

| `minRole` | Routes |
| --- | --- |
| `cashier` | `/`, `/account` |
| `manager` | `/stores`, `/employees`, `/reports/discounts-overrides` |
| `admin` | `/devices`, `/payment-methods`, and the 11 remaining placeholders |
| — | `_shell` itself declares nothing; it is the frame, not a screen |

The three `manager` routes are exactly the ones with shipped, tested, Store-scoped manager
behaviour (`list-stores.ts:15`, `list-users.ts:19`, `list-overrides.ts:20`).

**`/roster` and `/reports/drawer-sessions` stay `admin` in this issue — do not lower them.** Both
are placeholders owned by later areas, so the rule applies unchanged. Their destination is
`cashier`, self-scoped, fixed by PRD:311, and record 063's Amendment 1 records it so those areas
need not rediscover it. The constraint travelling with the second one: **expected cash is
`manager` and `admin` only** (PRD:316 — *"that right **is** the Role"*), so a cashier's own session
summary shows counted cash and never expected. That is a handler shape, and a route lowered to
`cashier` without it is a defect.

**Known cost, accepted deliberately: a manager's sidebar drops from 19 entries to 3, and Reports
is not among them.** Do not "fix" this by lowering Reports. Record 063 §4 binds each future
Reports issue to lower its own route in the same commit that ships the Store-scoped handler behind
it, and not before.

### 5. The nav filters from the same fact

`NavItem` gains `minRole`; `NavGroup` drops items above the caller's role, and a group with no
surviving items does not render. `/account` is reached from the `UserMenu`, not the sidebar, so it
takes no `NAV_GROUPS` entry — a cashier's sidebar is **empty**, and the Reports and Operations
groups do not render for them at all.

This is **presentation, not enforcement** (record 046 §4) — the router refuses whether or not the
sidebar is honest. But a sidebar advertising screens that 404 is a bug, and two hand-written lists
of the same fact drift, so one test holds them equal.
## Acceptance criteria

- [ ] A `cashier` session renders `/` and `/account`, and gets `NotFoundState` on **every other**
      `_shell` path, placeholders included.
- [ ] A `cashier`'s sidebar renders no `NAV_GROUPS` entry and no empty group heading.
- [ ] `/account` renders and saves a PIN for `cashier`, `manager` and `admin` alike.
- [ ] `/account`'s profile section shows the signed-in User's own first name, last name, email,
      role and assigned Stores — **and no other User's, at any role**.
- [ ] `auth.me` carries `firstName` and `lastName`; `components/helpers.ts` no longer derives a
      display name from the email, and its `ponytail:` marker is deleted with the derivation.
- [ ] A `manager` session gets `NotFoundState` on `/payment-methods`, `/devices`, and every
      placeholder; renders `/`, `/account`, `/stores`, `/employees`,
      `/reports/discounts-overrides`.
- [ ] **The default itself is asserted, not just the declarations**: a route with its
      `staticData` removed is refused for `admin`. Demonstrated and reverted.
- [ ] Every route under `_shell/` declares a `minRole` matching the table in §4, `/roster` and
      `/reports/drawer-sessions` included and still at `admin`.
- [ ] `devices.tsx` and `reports/discounts-overrides.tsx` carry no `beforeLoad` of their own.
- [ ] The sidebar's visible entries equal the caller's reachable routes — for `cashier`,
      `manager` and `admin` — held by a test asserting every `NAV_GROUPS` item's `minRole` equals
      its route's `staticData.minRole` and that the route exists.
- [ ] `PinDialog.tsx` no longer exists; `user.setPin` still has exactly one caller.
- [ ] `_gate` is unchanged: no `/pin` route, and no edit to `_gate.tsx`.
- [ ] **No handler guard is removed anywhere** — every `hasAtLeastRole` call site is unchanged,
      and the handlers and the database are untouched. The one contract change is `firstName`
      and `lastName` on `meOutputSchema`; there is no other, and no migration.
- [ ] The automated accessibility check passes on `/account`.
- [ ] **Not built here, and not stubbed:** the password section of `/account` (issue 16), and any
      lowering of `/roster` or `/reports/drawer-sessions`.

## Depends on

- 10 — PIN unlock and the hash-sync payload (`PinDialog`, `user.setPin`)

Touches surfaces shipped by 05 (Stores), 06 (Users), 08 (Payment methods), 09 (Devices) and
12 (Overrides), but depends on none of them beyond their being merged — all are `done`.

**Issue 16 (self-service password change) depends on this**, not the reverse: it adds a third
section to the `/account` screen this issue builds.

## Relevant files

- `apps/backoffice/src/routes/_shell.tsx` — §1's `minRole` check, the only guard added
- all 20 route files under `apps/backoffice/src/routes/_shell/` — one `staticData` line each
- `apps/backoffice/src/routes/_shell/account.tsx` — new
- `apps/backoffice/src/features/pin/PinDialog.tsx` → an `/account` section
- `apps/backoffice/src/components/UserMenu.tsx` — dialog trigger becomes a `Link to="/account"`
- `apps/backoffice/src/components/helpers.ts` — `NAV_GROUPS` gains `minRole`; the email-derived
  display name and its `ponytail:` marker at :71 go
- `apps/backoffice/src/components/NavGroup.tsx` — the filter
- `packages/contract/src/contract.ts:341` — `meOutputSchema` gains `firstName`/`lastName`
- `packages/backend/src/auth/handlers/me.ts` — returns them
- `packages/backend/src/access/db-operations/queries/get-assigned-store-ids-as-of.query.ts` —
  reused for the caller's own Stores; **no new procedure**
- `apps/backoffice/src/router.tsx:19` — `defaultNotFoundComponent`, already wired; read, do not edit
- `apps/backoffice/src/routes/_gate.tsx` and `_gate/` — **read only, unchanged**
## Constraints

- **No new dependency.** `@testing-library/user-event` is refused (record 042); `happy-dom`
  implements no activation behaviour, so dispatch a real `MouseEvent` for clicks.
- Server-side refusal is the enforcement; hiding a nav entry is presentation, never enforcement
  (record 046 §4).
- Migrations purely additive — this issue needs none at all; a drop, rename or backfill escalates
  to a human. `first_name`/`last_name` already exist (record 053); this only exposes them.
- **`auth.setPassword` is not touched.** Its `mustChangePassword` guard
  (`set-password.ts:20`) is deliberate and stays exactly as it is until issue 16's record decides
  `currentPassword`.
- Comments cap at three lines, and never narrate reviews, rounds, or findings.
- WCAG 2.2 AA, asserted by the existing automated accessibility check.
- Record 058 stands: no server procedure compares a PIN against a stored hash, enforced by
  `apps/api/tests/pin-no-logging-grep.test.ts`. Do not reintroduce `currentPin`.

## Gate

`--no-cache` must come **before** the task specifier. `vp run -r test --no-cache` forwards the
flag to vitest, leaves vp's own task cache on, and silently replays a previous verdict. Confirm
the run reports `0/10 cache hit`, not `10/10`.

    vp run -w codegen
    vp check
    vp run --no-cache -r check
    vp run --no-cache -r test

Baseline on `main` is **589 tests**.

## Comments

_Decided by [record 063](../../decisions/063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md)
**as amended** — read Amendment 1 first, it reverses that record's §2.
[Record 058](../../decisions/058-pin-management-is-a-back-office-action.md) is amended in three
places and stays `decided`. Not sliced from the PRD — this closes a gap 058 left open when it
decided PIN self-service belonged in the back office without deciding what a cashier sees once
inside. **The cashier's own surface, however, was never a gap: `PRD.md:311` had already granted
them their own Shifts and session summaries, and record 063 missed it before Amendment 1.**_

_Sequencing: independent of issue 13 (test-only, different files). **Conflicts with the unmerged
`issue-14-payment-method-payment-details` branch** at `apps/backoffice/src/routes/_shell/payment-methods.tsx`
— a one-line `staticData` addition, trivial either way, but land one before starting the other._
