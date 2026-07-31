# Workforce

- **Status:** ready-for-agent
- **Area:** 12 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `tenancy-identity`
- **Blocks:** nothing

> **A `Shift` is rostered work. A `DrawerSession` is cash.** They are different records with
> different lifecycles and **v1 does not link them**. See `CONTEXT.md`, and the rename record
> in `.scratch/APP-PLAN.md`.

## Problem Statement

A manager can create Users, give them roles, and assign them to Stores. What they cannot do
is say **who is working on Tuesday**.

Today that lives in a group chat or a photograph of a whiteboard. The consequences are
ordinary and constant: two cashiers turn up for the same morning, nobody is rostered for a
Saturday evening, a new hire does not know when to come in, and a manager rebuilds next
week's plan from scratch every week because last week's is in a message thread.

DeanPOS already holds the two things a roster needs — the people and the outlets — which
makes this the cheapest place to solve it and an odd omission to leave standing.

It is also an omission that was **undeclared** until it was raised, which is worse than a
decided absence: an undeclared gap becomes a scope argument, and a declared one does not.

## Solution

A **Shift** is one scheduled block of work: a Store, a start, an end, and a User — or nobody,
for a shift that still needs covering. A **Roster** is a Store's Shifts over a period, which a
manager builds as a draft and then **publishes** to make it visible to staff.

The system checks what a person cannot reliably check: a User rostered to two overlapping
Shifts, a User rostered at a Store they are not assigned to, a Shift with no one on it. Those
are warnings on a draft and blockers on publish, because a manager mid-build should not be
nagged, and a published roster with a double-booking is a real problem on a real morning.

Copying last week is a first-class action, because that is how rosters are actually made.

Staff see their own schedule in the back-office and nothing else. There is no notification of
any kind — DeanPOS has no email or SMS transport, by decision, and publishing means visible,
not delivered.

## User Stories

**Building a roster**

1. As a manager, I want to create a Shift with a Store, a date, a start, and an end, so that a block of work exists.
2. As a manager, I want to assign a User to a Shift, so that somebody is responsible for it.
3. As a manager, I want to leave a Shift unassigned, so that I can lay out the week's coverage before deciding who works it.
4. As a manager, I want to see the week laid out per Store, so that gaps and overlaps are visible rather than deduced.
5. As a manager, I want to edit a Shift's times, so that a change of plan is one edit.
6. As a manager, I want to reassign a Shift to a different User, so that a swap does not require deleting and recreating it.
7. As a manager, I want to delete a Shift, so that a cancelled block disappears.
8. As a manager, I want to copy a previous week's roster into a new week, so that I am not rebuilding the same pattern every week.
9. As a manager, I want to duplicate a single Shift across several days, so that a recurring pattern is quick to lay out.
10. As a manager, I want to add a note to a Shift, so that "opening — collect the delivery" travels with it.
11. As a manager, I want to work on a roster as a draft, so that a half-built week is not visible to staff.

**Checks**

12. As a manager, I want to be warned when a User is rostered to two overlapping Shifts, so that a double-booking is caught before it happens.
13. As a manager, I want overlap checks to span Stores, so that somebody rostered at two outlets at once is caught.
14. As a manager, I want to be prevented from rostering a User at a Store they are not assigned to, so that the roster matches who can actually work there.
15. As a manager, I want to be warned about unassigned Shifts before publishing, so that a gap is a decision rather than an oversight.
16. As a manager, I want warnings while drafting and blocks on publishing, so that I am not interrupted mid-build but cannot publish something broken.
17. As a manager, I want to be prevented from rostering a deactivated User, so that a departed employee cannot appear on next week's roster.

**Publishing**

18. As a manager, I want to publish a Roster for a period, so that staff can see it.
19. As a manager, I want an unpublished Roster to be invisible to staff, so that drafts are private.
20. As a manager, I want to change a published Shift, so that a real-world change is reflected.
21. As a manager, I want a change to a published Shift to be recorded, so that "it was changed after I saw it" is answerable.
22. As a manager, I want to see which periods are published and which are still drafts, so that I know what staff are looking at.
23. As a manager, I want to unpublish a period, so that a roster published in error can be withdrawn.

**Seeing your own schedule**

24. As a cashier, I want to see my upcoming Shifts, so that I know when I am working.
25. As a cashier, I want to see the Store and times for each Shift, so that I turn up in the right place.
26. As a cashier, I want to see any note on my Shift, so that I know what is expected.
27. As a cashier, I want to see only my own schedule, so that my colleagues' hours are not my business.
28. As a cashier, I want to see my schedule on my phone, so that I can check it without going in.
29. As a cashier, I want times shown in my own timezone, so that there is nothing to work out.

**Oversight**

30. As an owner, I want to see the roster across all my Stores, so that I can see coverage for the business.
31. As a manager, I want to see rostered hours per person for a period, so that the roster's shape is visible before the week starts.
32. As a manager, I want to see only my assigned Stores, so that scope matches my responsibility.
33. As a tenant admin, I want another Tenant to be unable to see my roster, so that my staffing is private.

## Implementation Decisions

**Model.** A `Shift` belongs to a Tenant and a Store, and carries a start, an end, an optional
`User`, an optional note, and a published flag. There is no separate Roster table — a Roster
is a Store and a date range, and publishing sets the flag on the Shifts within it. Adding a
Roster entity would create a second thing to keep consistent with the first.

**Times are stored as instants and displayed in the Tenant's timezone**, reusing the timezone
established in `reporting`. A Shift crossing midnight is ordinary for a food business and is
represented by its start and end, not by a date plus a duration.

**Draft versus published.** A Shift is created unpublished. Publishing applies to a Store and
a date range and flips every Shift in it. Unpublished Shifts are invisible to `cashier` role
users; managers and admins see everything for their scope.

**Warnings on draft, blocks on publish.** The distinction is the design of the area:

| Check | Draft | Publish |
| --- | --- | --- |
| User overlaps another Shift (any Store) | Warn | Block |
| User not assigned to the Store | Block | Block |
| User is deactivated | Block | Block |
| Shift unassigned | Warn | Warn, with explicit confirmation |

Overlap detection spans Stores, because the failure is a person being in two places, not a
Store being double-booked. It is computed server-side; a client-side check is a convenience
and never the enforcement.

**Copy-week** takes a source Store and week and a target week, and creates unpublished copies
with assignments preserved where the User is still active and still assigned to the Store, and
left unassigned where they are not. Copying never publishes, and it never silently rosters
somebody who no longer works there.

**Change tracking on published Shifts.** Editing a published Shift records what changed, when,
and by whom, appended rather than overwritten. This is a small audit trail, not a full history
system: enough to answer "this changed after I looked at it", which is the question staff
actually ask.

**Permissions.** `admin` covers the Tenant; `manager` covers their assigned Stores; `cashier`
sees their own published Shifts and nothing else — no colleague's schedule, no Store coverage
view, no hours summary. This mirrors `reporting`'s cashier scope and is enforced server-side.

**Back-office only.** The terminal is a till, not a staff portal, and adding a roster view to
the POS would put a second purpose on a screen whose entire design goal is speed. The
back-office is responsive to phone width, which is how a cashier will actually check.

**No notifications of any kind.** No email, no SMS, no push. DeanPOS has no transport for any
of them, by decision. **Publish means visible, not delivered**, and the UI must say so plainly
rather than implying staff have been told.

**No link to `DrawerSession`.** A cashier opens a DrawerSession because they are at a till, not
because a Shift says they should be. Linking the two — enforcing that a DrawerSession falls
within a rostered Shift, or deriving hours worked from sessions — is a later decision with its
own record. Building it in now would recreate the exact conflation the rename resolved.

**Migrations** are forward-only expand/contract (ADR-0006), with `tenant_id`, RLS enabled and
forced, in the creating migration (ADR-0002).

## Testing Decisions

**What makes a good test here.** Assert what a manager can and cannot publish, and what a
cashier can and cannot see. The interesting behaviour is the check matrix and the visibility
boundary; the CRUD is unremarkable and needs proportionate coverage, not exhaustive coverage.

**Seam.** The in-process seam from `foundation`. **No new seam**, nothing offline, no browser
seam.

**Prior art.** Actors and the wrong-tenant probe helper from `tenancy-identity`; the timezone
handling and its boundary tests from `reporting`.

**Through the seam.**

- Create, edit, reassign, and delete a Shift; an unassigned Shift is valid.
- Overlapping Shifts for one User warn on draft and block on publish, **including across two
  Stores**.
- A User not assigned to the Store is blocked at both draft and publish.
- A deactivated User cannot be assigned, and deactivating a User with future published Shifts
  surfaces them rather than silently leaving them rostered.
- Publishing flips exactly the Shifts in the Store and range, and no others.
- Unpublishing withdraws visibility from cashiers.
- A cashier sees only their own published Shifts — asserted on the **response payload**, since
  a colleague's schedule leaking through a list procedure is the likely failure.
- A cashier cannot reach the coverage view or the hours summary.
- A manager cannot see or edit a Store they are not assigned to.
- Copy-week preserves assignments for still-eligible Users, unassigns the rest, produces
  unpublished Shifts, and publishes nothing.
- Editing a published Shift records the change with actor and timestamp; editing a draft does
  not.
- Wrong-tenant probes on every procedure.

**Timezone and boundary tests**, reusing `reporting`'s approach: a Shift crossing midnight; a
Shift at a business-day boundary; a Tenant in a different timezone shifting every displayed
time consistently; a week boundary in copy-week.

**Property-tested.** Overlap detection: for any generated set of Shifts, the pairs reported as
overlapping are exactly the pairs that share a User and intersect in time — including
touching-but-not-overlapping boundaries, where an end equal to the next start is not an
overlap.

**Deliberately not tested.** Anything about hours actually worked, since none is recorded.
Notification delivery, since there is none.

## Security Criteria

1. **Wrong-tenant probes on every procedure**, including reading a single Shift by id.
2. **Store scope is authorised server-side.** A manager naming an unassigned Store is refused,
   not given an empty list.
3. **A cashier's list procedure returns only their own Shifts**, filtered in the query and
   asserted on the payload. Filtering in the UI is a leak.
4. **Unpublished Shifts are invisible to cashiers at the procedure level**, not merely hidden
   in the interface.
5. **Staff schedules are personal data.** They are covered by `hardening`'s tenant export and
   purge paths, and appear in the schema-enumeration test there.
6. **Untrusted input:** dates, times, ranges, ids, notes. Ranges are bounded so a copy-week or
   a list cannot request an unbounded span; notes are length-bounded and never rendered as
   HTML.
7. **Change records are append-only.**
8. **Never logged:** notes and staff names. Log Shift id, Store, actor, and outcome.

## Out of Scope

Declared non-goals, carried from `.scratch/APP-PLAN.md`. **This area rosters intent; it does
not observe reality.**

- Time and attendance — clock-in, clock-out, hours actually worked. **Deferred, trigger:** the
  first tenant who asks DeanPOS to tell them who actually turned up. This is the most likely
  next request and it is a real area, not an increment.
- Payroll in any form: wage rates, computed pay, overtime, night differential, holiday pay,
  statutory deductions, commission, tips.
- Leave, absence, sickness, and time-off requests.
- Staff availability declarations and preferences.
- Shift swap and cover requests between staff.
- Labour cost, labour-versus-sales percentage, and scheduling optimisation.
- Employee profile data beyond what access control already needs — contracts, ID documents,
  emergency contacts.
- Performance measurement per staff member beyond the sales already attributed to them.
- Notifications of a published or changed roster. No transport exists.
- Linking a Shift to a DrawerSession, and deriving anything from that link.
- Compliance with statutory scheduling or rest-period rules.
- Roster templates as a stored entity — copy-week covers the real need without one.

## Further Notes

- **The vocabulary is the risk in this area.** Everyone will say "shift" for both things. The
  glossary is explicit, the rename is recorded, and an issue or a column that reuses `Shift`
  for a cash session should be stopped at review.
- **Warn on draft, block on publish** is the whole ergonomic design. A tool that nags during a
  half-finished build gets abandoned; one that lets a double-booking reach a Monday morning is
  worse than a whiteboard.
- **Copy-week is the feature that decides whether this gets used.** Rosters are made by
  editing last week. A tool that requires building each week from nothing will lose to the
  group chat.
- **Publish means visible, not delivered.** The UI must not imply staff have been notified,
  because they have not been, and a manager who believes otherwise will be short-staffed on a
  Saturday.
- **This is last in the build order and blocks nothing.** If it slips, it slips — which is the
  correct thing to slip, and it is why it sits here.
- Attendance will be asked for almost immediately after this ships. When it is, it is a new
  area with its own record, and specifically not an extra timestamp bolted onto `Shift`.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31, the workforce gap
raised and closed on the same date, and ADR-0002 and ADR-0006. Reuses the in-process seam and
`reporting`'s timezone handling; adds no seam._
