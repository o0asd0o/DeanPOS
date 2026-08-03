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
Read it before starting — it carries the reasoning, the verified router API, and the costs this
issue is knowingly accepting. Do not re-litigate the choices here; if one looks wrong, say so and
stop rather than deviating.

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

### 2. A cashier never enters the shell

The same `beforeLoad`, one line earlier: a `cashier` is refused from `_shell` outright and
redirected to `/pin`. **Not a filtered shell — no shell.**

A cashier's legitimate back-office business is one field long. Refusing at the frame deletes the
per-screen cashier case across nine remaining areas instead of answering it repeatedly, and
collapses the shell to two roles — which is why every `minRole` below is `manager` or `admin`.

### 3. PIN self-service moves to `/pin`

`features/pin/PinDialog.tsx` is **deleted**. Its form body becomes `features/pin/SetPin.tsx`,
rendered by `routes/_gate/pin.tsx` — `SetPassword`'s shape, one field, `AuthLayout`'s frame.

`/pin` guards on session only, so **any authenticated role** reaches it: admins and managers
unlock tills too. Its `beforeLoad` is `set-password.tsx`'s, with the must-change check the right
way round — not authenticated → `/login`; `mustChangePassword` → `/set-password`, that flow
finishes first.

The `UserMenu` item stays where record 048 put it and becomes a `Link to="/pin"`; the dialog
state and import go with it. **One self-service surface, not two** — keeping the dialog for
manager/admin would leave two copies of the same field, validation and mutation to keep in step,
against record 058's own one-write-one-procedure principle.

On success the page confirms in place. A **Back** link renders for `manager`-or-above only: a
cashier clicking one would bounce off `_shell` straight back to `/pin`, and a link that returns
you to where you already are is worse than no link.

`_gate.tsx`'s comment saying `/login` and `/set-password` are its only two screens is now wrong;
amend it with the file.

**This is required to keep issue 10 true, not an improvement on it.** Issue 10's criterion that a
User sets their own PIN is today satisfied only through a shell that a cashier will no longer
enter. Parts 2 and 3 ship together or neither ships.

### 4. The `minRole` values

Mechanical, so it cannot be argued case by case: **a route declares the minimum role its handlers
already refuse below; a route with no handler declares `admin`.**

| `minRole` | Routes |
| --- | --- |
| `manager` | `/`, `/stores`, `/employees`, `/reports/discounts-overrides` |
| `admin` | `/devices`, `/payment-methods`, and the 13 placeholders — `/catalog`, `/add-ons`, `/discounts`, `/availability`, `/roster`, `/quarantine`, and the eight `/reports/*` |
| — | `_shell` itself declares nothing; it is the frame, not a screen |

Those four `manager` routes are exactly the ones with shipped, tested, Store-scoped manager
behaviour (`list-stores.ts:15`, `list-users.ts:19`, `list-overrides.ts:20`). Everything else is
`admin` because no code has yet decided what a manager may see there.

**Known cost, accepted deliberately: a manager's sidebar drops from 19 entries to 4, and Reports
is not among them.** Do not "fix" this by lowering Reports. Record 063 §4 binds each future
Reports issue to lower its own route in the same commit that ships the Store-scoped handler
behind it, and not before.

### 5. The nav filters from the same fact

`NavItem` gains `minRole`; `NavGroup` drops items above the caller's role, and a group with no
surviving items does not render.

This is **presentation, not enforcement** (record 046 §4) — the router refuses whether or not the
sidebar is honest. But a sidebar advertising screens that 404 is a bug, and two hand-written lists
of the same fact drift, so one test holds them equal.

## Acceptance criteria

- [ ] A `cashier` session on **any** `_shell` path is refused and lands on `/pin`.
- [ ] `/pin` renders and saves a PIN for `cashier`, `manager` and `admin` alike; a `cashier` sees
      no Back link, `manager`/`admin` do.
- [ ] `/pin` redirects to `/login` with no session and to `/set-password` when
      `mustChangePassword` is set.
- [ ] A `manager` session gets `NotFoundState` on `/payment-methods`, `/devices`, and every
      placeholder; and renders `/`, `/stores`, `/employees`, `/reports/discounts-overrides`.
- [ ] **The default itself is asserted, not just the declarations**: a route with its
      `staticData` removed is refused for `admin`. Demonstrated and reverted.
- [ ] Every route under `_shell/` declares a `minRole` matching the table in §4.
- [ ] `devices.tsx` and `reports/discounts-overrides.tsx` carry no `beforeLoad` of their own.
- [ ] The sidebar's visible entries equal the caller's reachable routes, for `manager` and for
      `admin`, held by a test asserting every `NAV_GROUPS` item's `minRole` equals its route's
      `staticData.minRole` and that the route exists.
- [ ] `PinDialog.tsx` no longer exists; `user.setPin` still has exactly one caller.
- [ ] **No handler guard is removed anywhere** — every `hasAtLeastRole` call site is unchanged,
      and the contract, the handlers and the database are untouched.
- [ ] The automated accessibility check passes on `/pin`.

## Depends on

- 10 — PIN unlock and the hash-sync payload (`PinDialog`, `user.setPin`)

Touches surfaces shipped by 05 (Stores), 06 (Users), 08 (Payment methods), 09 (Devices) and
12 (Overrides), but depends on none of them beyond their being merged — all are `done`.

## Relevant files

- `apps/backoffice/src/routes/_shell.tsx` — parts 1 and 2 both live in this one `beforeLoad`
- all 20 route files under `apps/backoffice/src/routes/_shell/` — one `staticData` line each
- `apps/backoffice/src/routes/_gate.tsx` — the stale two-screens comment
- `apps/backoffice/src/routes/_gate/set-password.tsx` — the pattern `/pin` copies
- `apps/backoffice/src/routes/_gate/pin.tsx` — new
- `apps/backoffice/src/features/pin/PinDialog.tsx` → `features/pin/SetPin.tsx`
- `apps/backoffice/src/components/UserMenu.tsx` — dialog trigger becomes a `Link`
- `apps/backoffice/src/components/helpers.ts` — `NAV_GROUPS` gains `minRole`
- `apps/backoffice/src/components/NavGroup.tsx` — the filter
- `apps/backoffice/src/router.tsx:19` — `defaultNotFoundComponent`, already wired; read, do not edit

## Constraints

- **No new dependency.** `@testing-library/user-event` is refused (record 042); `happy-dom`
  implements no activation behaviour, so dispatch a real `MouseEvent` for clicks.
- Server-side refusal is the enforcement; hiding a nav entry is presentation, never enforcement
  (record 046 §4).
- Migrations purely additive — this issue needs none at all; a drop, rename or backfill escalates
  to a human.
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

_Decided by [record 063](../../decisions/063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md);
[record 058](../../decisions/058-pin-management-is-a-back-office-action.md) amended in three
places to match and stays `decided`. Not sliced from the PRD — this closes a gap 058 left open
when it decided PIN self-service belonged in the back office without deciding what a cashier sees
once inside._

_Sequencing: independent of issue 13 (test-only, different files). **Conflicts with the unmerged
`issue-14-payment-method-payment-details` branch** at `apps/backoffice/src/routes/_shell/payment-methods.tsx`
— a one-line `staticData` addition, trivial either way, but land one before starting the other._
