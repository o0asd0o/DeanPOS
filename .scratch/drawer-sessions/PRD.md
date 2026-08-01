# Drawer sessions

- **Status:** ready-for-agent
- **Area:** 6 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `tenancy-identity`, `catalog`, `checkout`, `offline-sync`
- **Blocks:** `reporting`

> **`DrawerSession` is about cash, not labour.** A rostered block of work is a `Shift` and
> lives in area 12. The two are not linked in v1. See `CONTEXT.md`.

## Problem Statement

DeanPOS records sales but has no idea what is in the drawer. That leaves the one question
every owner asks at the end of a day unanswerable: **did the cash we hold match the cash we
took?**

Without it:

- There is no starting balance, so "we're short ₱300" cannot be distinguished from "nobody
  put a float in this morning".
- Sales are attributed to a Device and a cashier but not to a countable period, so a
  discrepancy cannot be narrowed to a person or a stretch of hours.
- Every petty-cash purchase — the runner sent out for change or ice — looks identical to
  theft, so managers learn to ignore variance entirely, which defeats the point of
  measuring it.
- `reporting` has nothing to aggregate by except calendar days, which is not how a counter
  actually works.

`checkout` deliberately shipped Orders with a **nullable** DrawerSession reference,
recorded as a forward dependency. This area is where that gets filled in and tightened.

## Solution

A **DrawerSession** is one cashier's accountable period on one Device: opened with a
declared **Float**, holding every Order taken on that Device until it is closed, and closed
with a physical **Cash count** that produces a **Variance**.

Expected cash is computed, not typed: `Float + cash taken − cash refunded + cash in − cash
out`. Cash movements — a payout for supplies, a top-up of change — are recorded with a
reason, so that legitimate movement stops masquerading as loss.

The count is **blind**: the cashier enters what they counted before seeing what was
expected. A count made while looking at the target is not a count.

A Variance beyond the Tenant's threshold requires a manager **Override** with a reason,
using the mechanism from `tenancy-identity`. Everything works offline, because closing up
during an outage is exactly when it is needed, and the close travels through the Outbox
like any other record.

## User Stories

**Opening**

1. As a cashier, I want to open a DrawerSession when I start at a terminal, so that everything I take is attributed to me.
2. As a cashier, I want to declare the Float in the drawer when I open, so that the expected total starts from a known number.
3. As a cashier, I want to enter the Float by denomination, so that counting notes and coins is quick and less error-prone.
4. As a cashier, I want to be stopped from selling until a DrawerSession is open, so that no sale is unattributed.
5. As a cashier, I want to open a DrawerSession with no network, so that an outage does not delay opening the store.
6. As a manager, I want only one DrawerSession open per Device at a time, so that two people cannot be accountable for one drawer.
7. As a manager, I want to see who has an open DrawerSession at my Store, so that I know which terminals are live.

**During the session**

8. As a cashier, I want every sale I take to belong to my DrawerSession automatically, so that attribution is not something I can forget.
9. As a cashier, I want to record cash taken out of the drawer with a reason, so that money spent on supplies is not counted as missing.
10. As a cashier, I want to record cash put into the drawer with a reason, so that a change top-up does not show as an overage.
11. As a manager, I want cash movements to require my approval above a threshold, so that large withdrawals are not a cashier's decision alone.
12. As a cashier, I want to see how many sales I have taken this session, so that I have a sense of the day without seeing the expected total.
13. As a cashier, I want card-recorded payments to be excluded from expected cash, so that the drawer maths is about cash only.
14. As a manager, I want refunds paid in cash to reduce expected cash, so that the drawer reconciles after a return.

**Closing**

15. As a cashier, I want to count the drawer and enter the total at close, so that the session can be reconciled.
16. As a cashier, I want to enter the count by denomination, so that counting is structured and a miscount is easier to spot.
17. As a cashier, I want to enter my count **before** seeing the expected figure, so that the count is honest.
18. As a manager, I want to see expected, counted, and the Variance after the count is submitted, so that I can act on a real number.
19. As a cashier, I want a Variance within the tolerance to close without ceremony, so that a peso either way does not need a manager.
20. As a manager, I want a Variance beyond the tolerance to require my PIN and a reason, so that a real discrepancy is acknowledged by a person.
21. As a tenant admin, I want to set the Variance tolerance for my Tenant, so that a busy store and a quiet one are not held to the same figure. **Admin-only**, per `tenancy-identity`, which owns every Tenant setting.
22. As a cashier, I want to close with no network, so that an outage does not prevent ending the day.
23. As a cashier, I want to be warned at close if sales are still waiting to sync, so that I do not walk away from a terminal holding unrecorded money.
23a. As a cashier, I want to be **stopped** — not warned — from closing while Tickets are still open on this terminal, so that I never count a drawer against orders I have not collected for (ADR-0011).
23b. As a cashier, I want the close screen to list those open Tickets so I can pay or discard each one, so that being blocked comes with the way out.
24. As a manager, I want a closed DrawerSession to be final, so that figures cannot be quietly adjusted afterwards.
25. As a manager, I want to add a note to a closed DrawerSession, so that context can be captured without altering the numbers.

**Handover**

26. As a cashier, I want to hand the terminal to a colleague by closing my session and letting them open theirs, so that accountability transfers cleanly.
27. As a cashier, I want to lock the terminal without closing my DrawerSession, so that stepping away is not the same as ending my accountability.
28. As a manager, I want to close a DrawerSession on behalf of a cashier who has left, so that an abandoned session does not block the terminal.

**Oversight**

29. As a manager, I want to see the DrawerSessions currently **open** at my Store, so that I know which terminals are live and whether one was left open overnight. Cross-day and cross-Store history is `reporting`.
30. As a tenant admin, I want every Variance beyond tolerance to name the approving manager and the reason, so that a discrepancy is attributable. This area **records** it; `reporting` is where it is listed across sessions.
31. As a tenant admin, I want each cash movement stored with its reason and approver, so that a payout can be traced. Listing them across a period is `reporting`.
32. As a manager, I want a DrawerSession that was closed offline to be identifiable, so that I know the figures arrived late.
33. As a tenant admin, I want a terminal's computed expected total disagreeing with the server's to flag that session, so that a sync problem cannot hide inside a variance.
34. As a tenant admin, I want another Tenant to be unable to see my DrawerSessions, so that my takings are private.

**Reading a session from the terminal**

35. As a manager, I want to see the open DrawerSession's figures at any point during the session, so that I know where the drawer stands at 3pm without closing it.
36. As a manager, I want that running summary to include expected cash, so that I can spot a problem before the count rather than after.
37. As a cashier, I want the running summary to show me what I have sold but not what should be in the drawer, so that the blind count survives a screen that exists to be looked at. Expected cash is `manager` and `admin` only.
38. As a cashier, I want the running summary to work with no network, so that a mid-session check is not an online-only feature on an offline-first terminal.
39. As a cashier, I want to see the DrawerSessions previously closed on this terminal, so that yesterday's close is answerable without opening the back-office.
40. As a cashier, I want a session whose close has not yet reached the server to be marked as such in that history, so that "did it go through" is a thing I can see rather than assume.
41. As a cashier, I want to reopen the summary of my own closed session, so that I can check my own work after the fact.
42. As a manager, I want non-cash payment methods shown separately in the running summary, so that a busy GCash day does not read as a cash shortfall in the making.

## Implementation Decisions

**Model.** A `DrawerSession` belongs to a Tenant, a Store, a Device, and the User who
opened it. It has an opened-at, a Float, an optional opening denomination breakdown, and —
once closed — a closed-at, the closing User, a Cash count, an optional closing denomination
breakdown, the computed expected total, the Variance, and the Override if one was required.

**At most one open DrawerSession per Device**, enforced by a partial unique index rather
than by an application check, so a race cannot produce two.

**Every Order requires an open DrawerSession.** The terminal refuses to sell without one,
and the server rejects an Order that does not name one.

**Filling in the nullable reference from `checkout`** follows ADR-0006 expand/contract:

1. Backfill existing Orders by synthesising one reconstruction DrawerSession per (Device,
   **business day** — the Store's configured start time in the Tenant's timezone, not a UTC
   calendar day), flagged as reconstructed and with no Float, no count, and no Variance —
   they are attribution, not reconciliation, and must never be presented as a real
   reconciled session.
2. Only then tighten the column to `NOT NULL`, in a later release.

If no Orders exist yet when this area is built, step 1 is a no-op — but the migration is
written anyway, because whether production has data is not something the implementer can
assume.

**Expected cash** = `Float + cash settled − cash refunds + cash in − cash out`, where
**cash settled means the Order total paid in cash, not the amount tendered**. The glossary
defines a Payment as an amount *tendered*, and `checkout` records tendered and change
separately — so `tendered` would overcount the drawer by the change handed back on every
non-exact sale. `settled = tendered − change`.
**Only the `cash` PaymentMethod counts** (ADR-0010). Every other configured method — Card,
GCash, Maya, Bank transfer — is a recorded tender that DeanPOS never touched and that is
not in the drawer, so it is excluded entirely. This must be written against the method's
kind, not against a list of names, or the first tenant who adds a method breaks the drawer.
All arithmetic uses `foundation`'s integer-centavo primitives.

**Cash movements are in scope**, as a minimal `CashMovement` record: direction, amount,
reason, actor, timestamp, and an Override above a Tenant-configured threshold.

**This adds a fifth action to ADR-0005's Override set**, which fixed it at four: void,
refund, manual line price override, and out-of-tolerance DrawerSession close. Recorded here
as a deliberate widening, in the same breath as `CashMovement` itself — a cash payout that
any cashier can make unsupervised is the gap this closes.

**The movement threshold is a Tenant setting** in integer centavos, `admin`-only and
audited, exactly like the Variance tolerance. `tenancy-identity` owns it and its settings
table carries it; a threshold with no owner and no default is a control nobody configured. This is a
deliberate addition to the planned area boundary: without it, every legitimate payout
appears as a shortfall, managers stop trusting Variance, and the entire area's value
evaporates. It is not petty cash management — no categories, no budgets, no receipts.

**Blind count — what is actually enforceable, and what is not.** An earlier draft said the
expected total is "not derivable from anything on screen". That is false and it contradicted
this PRD's own offline design: the terminal computes expected locally from the Float and the
Orders it holds, because an offline close cannot work any other way. The raw material is on
the Device by necessity. A criterion that forbids what the architecture requires teaches an
implementer to ignore criteria.

The control is therefore split into a hard half and a soft half, and both are stated:

| | |
| --- | --- |
| **Server-withheld — hard, tested** | No server payload contains the expected total for a User not authorised to see it. Asserted on the response body. This is a review finding if broken. |
| **App-withheld — soft, by necessity** | The on-device figure is computed but not rendered before the count is submitted. A determined cashier with developer tools can reach it. |

**The residual risk is named rather than denied:** a cashier who can open a debugger on an
enrolled tablet can compute expected cash before counting. The mitigations are Device
enrolment, PIN unlock, and the fact that the Variance is attributable to a person — not the
pretence that the number is absent. Removing the residual risk means giving up the offline
close, which is a worse trade.

**Running summary — the open session, read mid-session.** A terminal screen showing the
current DrawerSession's figures: opened-at, opening User, Float, order count, sales by
PaymentMethod, refunds, cash movements, and — **only for a User authorised to see it** —
expected cash. Elsewhere in the trade this is an X-report; the glossary calls it a *running
summary*, and the closed one a *session summary*.

**Who may see expected cash: `manager` and `admin`. A `cashier` never may.** This is the
Role, not a grantable per-User permission — DeanPOS has no per-User permissions and
introducing one for a single flag would make it the only one in the product
(`tenancy-identity`: the authorisation model is Role plus Store membership, and nothing
else).

The same rule governs the close-time reveal, the running summary, and every report — one
rule, three surfaces. A cashier sees everything on the sales side and no expected figure,
and **the payload they receive does not contain one**. Adding a second concept for the same
secret is how a control gets widened by accident.

**The running summary is computed on the Device from the Orders it holds**, like expected
cash at close, so it works offline. It is a view, not a record: reading it writes nothing,
does not close anything, and does not mark the session in any way.

**Session history on the terminal.** A list of DrawerSessions previously closed on *this
Device*, most recent first, each showing opened-at, closed-at, the Users, and its sync
state — a session whose close is still in the Outbox is marked pending, using
`offline-sync`'s existing vocabulary. Tapping one shows its session summary, subject to the
same right: a cashier sees their own sessions' summaries and, without the right, without
the expected figure.

Scoped to the Device and to a bounded recent window. A terminal is not a reporting surface,
and the back-office owns cross-Device and cross-period questions (`reporting`).

**Non-cash PaymentMethods appear in both summaries, separated from cash and excluded from
expected cash** (ADR-0010). Showing a GCash total next to a cash total is what stops a
cashier reading a big sales day as a drawer that ought to be fuller than it is.

**Variance and tolerance.** `Variance = counted − expected`; negative is short, positive is
over. The tolerance is a Tenant setting in **integer centavos**, defaulting to zero — a
tenant that wants slack opts into it. **`tenancy-identity` owns it and it is admin-only**;
an earlier draft here said manager-or-above, which contradicted the owning PRD. Beyond tolerance, a manager Override with a reason is required to
close, via `tenancy-identity`'s mechanism; this area consumes it and must not build a
second one.

**Open Tickets block a close; unsynced sales only warn** (ADR-0011). The two look similar
and are opposites. An unsynced sale is money that *was* collected and will reach the server —
warning is right, because refusing to close would strand a cashier at the end of a shift over
a network problem they cannot fix. An open Ticket is an order that was **never paid for**:
closing over it means counting a drawer against a sale that has not happened, and the cart
then belongs to whoever opens the terminal next. So the close is refused until each open
Ticket is paid or discarded, and the close screen lists them with both actions (stories 23a,
23b). Discarding writes nothing — a draft the server never saw cannot be Voided. The count of
open Tickets comes from `checkout`, which owns them.

**A closed DrawerSession is immutable**, consistent with ADR-0005's treatment of paid
Orders. Corrections are notes appended by a manager, never edits to Float, count, expected,
or Variance. There is no reopen.

**Offline.** Open, sell, record movements, and close all work with no network. The
terminal computes expected from the Orders it holds locally.

**This area extends the Outbox with three new entry kinds** — `session_open`,
`session_close`, and `cash_movement` — and their ordering rules, which `offline-sync`'s
schema (`order | void | refund`) does not carry. Declaring them here is the extension;
`offline-sync` owns the transport and this area owns these kinds.

```
session_open   BEFORE every Order it contains — the server rejects an Order naming
               a session it has never seen, so an open that arrived late would
               reject the whole session's sales
cash_movement  after its session's open, in creation order
session_close  AFTER every Order and movement it contains
```

An earlier draft said the open and close are "ordered after the Orders they contain", which
is right for the close and backwards for the open. **An Order arriving after its session's
close has already landed is accepted and flags the session for review** — it is real money
and must not be rejected, but it means the close was computed without it, which is exactly
the server-versus-terminal mismatch below.

On arrival the server **recomputes expected from its own rows**. If the server's figure
differs from the terminal's, the session is flagged for review and both figures are kept —
this is the signal that something did not sync, and it must not be silently absorbed into
the Variance. Neither figure is discarded.

**Closing with unsynced entries is allowed and warned about.** Refusing to close would
strand a cashier at the end of a DrawerSession during an outage, which is worse. The warning is
explicit and the session is marked as closed-with-pending-sync.

**Manager close-on-behalf.** A manager may close another User's session with their own
PIN; the session records both the opening and the closing User.

**Lock is not close.** Locking the terminal (`tenancy-identity`) leaves the DrawerSession
open. Only an explicit close ends accountability.

**Visual reference.** `ORC2_DESIGN="lofi"`. Mocks are committed:
`pos/drawer-open-1280`, `pos/drawer-close-{1280,390}`, `pos/running-summary-1280`,
`pos/session-history-1280`. **`backoffice/drawer-sessions-1440` belongs to `reporting`** —
this area writes the rows and exposes the live open-session view; the cross-day, cross-Store
table is a report. The running summary's two
right-hand panels are **the same screen for two people** — with and without the right to
see expected cash — not a two-panel layout.

**No link to `Shift`.** A rostered Shift and a DrawerSession are separate lifecycles in v1.
Linking them is a later decision with its own record, not an assumption to build in now.

## Testing Decisions

**What makes a good test here.** Assert the numbers a manager would check and the actions
the system refuses. `expect(computeExpected).toHaveBeenCalled()` proves nothing; opening
with a ₱1,000 float, taking two cash sales and one cash refund, paying out ₱200, counting
₱1,850, and asserting a Variance of −₱50 proves the whole area.

**Seams.** Both existing ones; no new seam.

- **In-process seam** for everything that is arithmetic and rules: expected-cash
  computation, tolerance behaviour, the one-open-session constraint, Override requirement,
  immutability of a closed session, backfill and the reconstruction sessions, server-side
  recomputation and the mismatch flag.
- **Browser seam** (Vitest browser mode, Playwright provider, from `offline-sync`) for the
  offline close only — it is part of the money path this seam exists for.

**Prior art.** The catalog fixture from `catalog`, the actors and Override helper from
`tenancy-identity`, the wrong-tenant probe helper, and `offline-sync`'s Outbox harness.

**Through the in-process seam, at minimum.**

- Expected cash across every contributing movement, including a cash refund and both
  directions of cash movement.
- A tenant-configured non-cash PaymentMethod does not affect expected cash — asserted with a
  method added *after* the session opened, so the exclusion cannot be a hard-coded name list.
- A second open attempt on the same Device fails, including two concurrent attempts —
  the constraint must be the database's, not a read-then-write check.
- Selling with no open DrawerSession is refused by the server, not merely hidden in the UI.
- A Variance within tolerance closes without an Override; beyond tolerance it is refused
  without one and accepted with one.
- The expected total is absent from every payload the terminal receives before the count is
  submitted — asserted on the response body, not on the rendering.
- A closed session rejects every mutation; a note can be appended.
- A manager closes another cashier's session and both Users are recorded.
- Backfill produces exactly one reconstruction session per Device per day, flagged as such,
  and the tightening migration succeeds afterwards.
- Server recomputation disagreeing with the terminal's figure flags the session and
  preserves both numbers.
- Wrong-tenant and wrong-Store probes on every procedure.

**The running summary and session history.**

- The running summary's sales, refunds, and movement figures match the session's Orders.
- **A User without the expected-cash right receives no expected figure in the running
  summary payload** — asserted on the response body. This is the same assertion as the
  blind count and it is the reason this screen is a risk.
- A User with the right receives it.
- Reading the running summary changes nothing: the session is unmodified afterwards, still
  open, and unmarked.
- Non-cash method totals appear in the summary and are excluded from expected cash.
- Session history lists only sessions from the requesting Device, most recent first, bounded.
- A session whose close is still queued is marked pending in the history.
- A cashier cannot read another cashier's session summary through the history; a manager can.

**Through the browser seam.**

- Open a session offline, take sales offline, record a cash movement, close offline with a
  count, then reconnect: the open, the Orders, the movement, and the close all land once
  and in that order, and the server's Variance matches the terminal's.
- Close offline while entries are pending: the warning appears and the session is marked
  closed-with-pending-sync.

**Property-tested.** For any generated sequence of cash payments, cash refunds, and
movements, expected cash equals the float plus the signed sum, in exact centavos, with no
rounding drift — and the server's recomputation always equals the terminal's when every
entry has synced.

**Deliberately not tested here.** Aggregate reporting across sessions — `reporting`.
Alerting on a session that never closes — `observability`. Rostering — area 12.

## Security Criteria

1. **Wrong-tenant and wrong-Store probes on every procedure**, including reading a
   DrawerSession by id.
2. **The Device token establishes Store and Device**; a request may not name a different
   Device's session.
3. **A cashier may only open a session on a Device at a Store they are assigned to.**
   Membership is authorised server-side, not inferred from the request.
4. **The expected total is server-withheld before the count is submitted.** Shipping it and
   hiding it in the UI defeats the control and is a finding.
5. **Variance Overrides are authorised server-side**, single-use, bound to that close, and
   re-verified on replay if created offline.
6. **Cash movement Overrides follow the same rule** above the configured threshold.
7. **A closed DrawerSession is append-only.** Any `UPDATE` to its financial fields is a
   review finding.
8. **The tolerance is a Tenant setting, `admin`-only, and audited** (`tenancy-identity`
   owns it) — otherwise the control can be widened to hide a shortfall. The same holds for
   the cash-movement Override threshold.
8a. **Expected cash is `manager` and `admin` only, on every surface** — close-time reveal,
   running summary, session history, and every `reporting` procedure. One rule, four
   surfaces, no per-User permission.
9. **Terminal-computed figures are claims.** The server recomputes from its own rows and
   never accepts the terminal's expected total as authoritative.
10. **Untrusted input:** float, count, denomination breakdowns, movement amounts and
    reasons, every id. Amounts parse to `Centavos` or are rejected; denominations must sum
    to the stated total.
11. **Never logged:** counts, floats, and totals in full payloads. Log session id, Store,
    Device, actor, and outcome.
12. **The running summary is the second route to the expected total**, and therefore the
    second place the blind count can be defeated. It is gated by the *same* right as the
    close-time reveal, and the expected figure is omitted from the payload — not hidden in
    the UI — for anyone without it.
13. **Session history is Device-scoped server-side.** A Device token may not read another
    Device's sessions, and a cashier may not read another cashier's summary through it.

## Out of Scope

- Rostering, schedules, hours worked, attendance. Area 12 and, for attendance, a declared
  non-goal.
- Bank deposits, safe drops to a back-office safe, and end-of-day banking. **Deferred,
  trigger:** the first tenant who asks where the money goes after the drawer is counted.
- Petty cash management beyond a movement with a reason — no categories, budgets, receipts,
  or reconciliation of spend.
- Multi-drawer or multi-till per Device. One Device, one drawer.
- Tips and tip pooling. Non-goal.
- Aggregate reports across sessions, stores, or periods. Area 7. The terminal shows *this
  Device's* sessions; every cross-Device, cross-Store, or cross-period question is
  `reporting`.
- Printing a running or session summary. No receipt printer exists — declared hardware
  non-goal. **Deferred, trigger:** the same trigger as printed receipts.
- Alerting on a session left open overnight. Area 8 — the state is exposed here, watched
  there.
- Linking a DrawerSession to a rostered Shift. A later decision with its own record.
- Automatic close at end of day. A session ends because a person counted the drawer; a
  timer cannot count.

## Further Notes

- **Cash movements are the difference between a variance figure people act on and one they
  ignore.** They were not in the original area sketch and are here on purpose.
- **Blind count is the whole control.** If the expected number reaches the device before
  the count, the feature is decorative.
- **The server-versus-terminal expected mismatch is a sync alarm wearing a finance
  costume.** Do not let it be absorbed into Variance — a missing sale and a missing note
  are different problems with different responses.
- **Reconstruction sessions must be visibly not-real.** A backfilled session with no float
  and no count that renders like a genuine reconciled one will be quoted back as evidence
  by somebody, eventually.
- **Tolerance defaults to zero.** A tenant that wants slack should have to say so; a
  default of "a bit of loss is fine" is not a default anyone should inherit silently.
- The word to keep saying is **DrawerSession**. When a manager says "shift", they mean the
  roster. The glossary is explicit and this area is the one most likely to drift.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0005,
ADR-0006, ADR-0007. Reuses both seams; adds none. `CashMovement` is a deliberate widening
of the planned area boundary, justified above._
