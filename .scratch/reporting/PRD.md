# Reporting

- **Status:** ready-for-agent
- **Area:** 7 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `tenancy-identity`, `catalog`, `checkout`, `offline-sync`, `drawer-sessions`
- **Blocks:** nothing

## Problem Statement

DeanPOS now holds every sale, every reversal, and every counted drawer — and offers no way
to look at any of it. An owner can see the day's takings only by opening a terminal and
remembering, which is not a system, it is a habit.

Three things make this harder than adding up a column:

**"Today" is not a calendar day.** A carinderia that closes at 11pm and one that runs to
2am do not share a definition of a day, and neither of them means midnight-to-midnight in
UTC. Get the timezone or the boundary wrong and every figure is quietly incorrect in a way
nobody notices until it is compared against the drawer.

**The past changes.** A terminal that was offline for two days replays on Tuesday, and
Sunday's total moves. Any report that presents itself as final is lying, and any report
that silently absorbs late arrivals hides the fact that a sync problem existed.

**The open planning question lands here.** Every Order carries two timestamps — when the
Device says it happened, and when the server received it (ADR-0003). Which one a report
uses was deliberately left to this area, and it must be answered once, stated plainly, and
applied consistently, because the two disagree by exactly the length of the last outage.

## Solution

A small set of reports that answer the questions an owner actually asks — what did we take,
who took it, what did we sell, what went back out, and did the drawer agree — scoped by
Store and by period, with a CSV export for anything the screen cannot hold.

**Nine reports, one `Reports` section.** Sales reporting is not a separate area of the
back-office from "reports"; the sales reports *are* the Reports section. `foundation`'s
sidebar carries one `Reports` entry, which becomes a group with these children:

| Report | Answers |
| --- | --- |
| **Summary** | What did we take? The KPI strip, the charts, and a row per day. Also the back-office landing page. |
| **Orders** | Which sales made up that number? A browsable, filterable list of every Order, with drill-in detail. |
| **By item** | What sold? Per Variant, with a Modifier and Add-on breakdown. |
| **By category** | What is the shape of the menu's performance? |
| **By cashier** | Who took the money? |
| **By payment method** | Cash versus everything else. Exists only when the Tenant has more than `cash`. |
| **Discounts & overrides** | What came off the price, by whom, and with whose approval. |
| **Refunds** | What money went back out, for what, and who approved it. Voids are counted beside it — a cancelled sale and a returned one are different events. |
| **Drawer sessions** | Did the drawer agree? Owned by `drawer-sessions`; listed here because this is where a manager looks for it. |

**The customer receipt is a drill leaf of Orders, not a tenth nav entry.** Any Order opens
its receipt exactly as the customer saw it, printable and exportable, rendered on demand from
the Order itself (ADR-0012 — nothing is archived, there is no bucket, and the Order's identity
*is* the receipt's). A separate `Receipts` page would be the Orders list under a second name,
with the same rows, the same filters, and the same search — and a customer holding a receipt is
answered by searching the Order number, which the Orders list already does (story 50).

**Orders is the spine.** Every aggregate above drills into it with its filters pre-applied.
A figure a person cannot get behind is a figure they will not trust, and "₱12,340 on
Tuesday" with no route to the 87 Orders underneath is unauditable by construction.

The definitional decisions are made once and stated everywhere they apply:

- **A sale happened when the Device says it happened.** Device time is the business truth;
  server receipt time is retained and used to show sync lag and to flag implausible clock
  skew. A two-day outage therefore lands its sales on the days they occurred, not on the
  day they arrived.
- **A day starts when the Store says it starts**, in the Tenant's timezone, defaulting to
  Asia/Manila and 00:00.
- **Every report is computed live and says "as of"**, and flags any period containing a
  DrawerSession closed with entries still pending. A figure that can still move says so.
- **Every report reads the configuration captured on the Order, never the Tenant's current
  settings** (ADR-0010). A tenant that registers for VAT in March gets VAT figures from
  March; February stays as February was sold. The same holds for a renamed PaymentMethod
  and an edited Discount.
- **VAT, Discounts, and PaymentMethods are optional and off by default.** A report does not
  render a VAT column for a non-VAT tenant, does not render a discount section for a tenant
  with no Discounts configured, and does not render *By payment method* at all for a
  cash-only tenant. An empty column is a question the owner has to answer; an absent one is
  not.

Reports are ordinary queries over the existing tables. No precomputation, no materialised
views, no reporting database — MVP volumes do not need them and each one is a cache that
can be wrong.

## User Stories

**Daily takings**

1. As an owner, I want the day's total sales for a Store, so that I know what we took.
2. As an owner, I want to see the split between cash and card-recorded payments, so that I know what should be in the drawer versus what went through a card machine.
3. As an owner, I want the VAT included in the day's sales broken out, so that the figure is usable for tax without recomputing it.
4. As an owner, I want the number of Orders and the average Order value, so that a quiet day and a cheap day are distinguishable.
5. As an owner, I want a single day compared with the same weekday a week earlier, and a week or month compared with the period immediately before it, so that context is a fair comparison rather than a bare number.
6. As an owner, I want to choose a date range, so that I can look at a week or a month.
7. As an owner, I want figures for all my Stores together and each one separately, so that I can see the business and the outlet.
8. As an owner, I want a day to start when my store's day starts, so that late-night sales land on the right day.
9. As an owner, I want all times shown in my Tenant's timezone, so that nothing needs mental arithmetic. There is no per-User timezone.

**Sessions and people**

10. As a manager, I want a report per DrawerSession showing float, expected, counted, and Variance, so that I can review a session's cash.
11. As an owner, I want Variances listed across sessions with the approving manager and reason, so that I can spot a pattern.
12. As an owner, I want takings by cashier, so that I know who was running the DrawerSession when the numbers move.
13. As an owner, I want cash movements listed with their reasons, so that a payout can be traced.
14. As a manager, I want to see which DrawerSessions are still open, so that I notice one left open overnight.
15. As a cashier, I want to see a summary of my own completed session, so that I can check my own work.
16. As a cashier, I want to be unable to see the expected total for a session I have not yet counted, so that the blind count is not defeated through a report.

**What sold**

17. As an owner, I want the best-selling Variants for a period, so that I know what to prepare.
18. As an owner, I want sales grouped by Category, so that I can see the shape of the menu's performance.
19. As an owner, I want quantity sold and revenue per Variant, so that a cheap high-volume item and an expensive rare one are both visible.
20. As an owner, I want Add-on take-up, so that I know whether extras are worth offering.
21. As an owner, I want sales by hour of day, so that I can staff the counter sensibly.

**What went back out**

22. As an owner, I want all voids for a period with their reasons and approvers, so that cancellations are visible.
23. As an owner, I want all refunds for a period with their reasons and approvers, so that money leaving is accounted for.
24. As an owner, I want all manual price overrides for a period with the original and overridden prices, so that discounting is measurable.
25. As an owner, I want voids, refunds, and overrides summarised per cashier and per approving manager, so that a pattern involving two people is visible.
26. As an owner, I want net sales after refunds as well as gross, so that I am not misled by either figure alone.

**Trust in the numbers**

27. As an owner, I want each report to say when it was computed, so that I know how current it is.
28. As an owner, I want to be told when a period contains terminals that had not finished syncing, so that I know a figure may still move.
29. As an owner, I want to see if any terminal's clock was implausibly wrong, so that I can distinguish a data problem from a business one.
30. As an owner, I want a sale that arrived late to appear on the day it happened, so that history is not rewritten by connectivity.
31. As an owner, I want to be able to see the sync lag on a period, so that "we were offline" is visible in the data.

**Charts**

32. As an owner, I want sales by hour shown as a bar chart, so that the busy stretches are obvious at a glance rather than read off a table.
33. As an owner, I want sales by day across a range shown as a bar chart, so that a week's shape is visible in one look.
34. As an owner, I want a small trend line on the daily-total tile, so that today has context without opening a second report.
35. As an owner, I want every chart to have the same numbers available as a table, so that I can read the exact figure when the picture is not enough.
36. As an owner using a screen reader, I want a chart's data to be reachable as text, so that the visual is an addition rather than the only way in.
37. As an owner, I want charts to render legibly on my phone, so that the back-office is usable away from a desk.

**Export and access**

38. As an owner, I want to export any report as CSV, so that I can hand it to a bookkeeper.
39. As an owner, I want exports to contain the same figures as the screen, so that there is one version of the truth.
40. As a manager, I want to see reports only for my assigned Stores, so that scope matches my responsibility.
41. As a cashier, I want to be unable to see Store-wide financial reports, so that access matches my role.
42. As a tenant admin, I want another Tenant to be unable to see any of my figures, so that my revenue is private.
43. As an owner, I want reports to be readable on my phone, so that I can check the day without going to the office.

**The Orders list**

44. As an owner, I want a list of every Order in a period, so that a total is something I can get behind rather than something I have to believe.
45. As an owner, I want to click any figure in any report and land on the Orders that produced it, so that I never have to reconstruct a filter by hand.
46. As an owner, I want to open one Order and see exactly what was sold — every line, its Modifiers, its Add-ons, and its price — so that I can answer a customer's question about a specific purchase.
47. As an owner, I want each Order to show its cashier, Device, DrawerSession, payment method, and the time it happened, so that a single sale is fully attributable.
48. As an owner, I want to filter the list to sales, refunds, or voids, so that I can look at one kind of event at a time.
49. As an owner, I want to filter by cashier, Device, DrawerSession, and payment method, so that I can narrow a question without exporting.
50. As an owner, I want to search for an Order by its **Order number**, so that a customer holding a receipt can be answered in one step. ("Reference" in this PRD always means a Discount's SC/PWD reference, which is personal data and is never a search key.)
51. As an owner, I want a voided or refunded Order to be visibly marked in the list along with who approved it, so that reversals are not something I have to go looking for.
52. As an owner, I want to export the Orders list one row per Order, so that I have a transaction register.
53. As an owner, I want to export the Orders list one row per OrderLine, so that my bookkeeper gets item-level detail without me building it.
53a. As an owner, I want the ticket label and the fulfilment tag shown on an Order and available as filters, so that "how much of last month was delivery" is answerable (ADR-0011).

**Refunds**

53b. As an owner, I want every Refund in a period listed with its amount, its reason, the approving manager, and the original sale, so that money going back out is as visible as money coming in.
53c. As an owner, I want a partial refund to show which lines were returned, so that a one-dish refund is not indistinguishable from a whole-order one.
53d. As an owner, I want refunds totalled for the period and shown against the period's Net, so that I can see what proportion of takings came back.
53e. As an owner, I want a Refund attributed to the day of the **original sale** in the waterfall, and listed on the day it was **taken** in this report, so that neither question is distorted by the other. Both dates are shown on every row.
53f. As an owner, I want Voids counted beside refunds but never mixed into them, so that a sale that was cancelled and a sale that was returned stay different events.
53g. As an owner, I want to click any Refund and land on the original Order, so that I can see what was actually sold.

**The customer receipt**

53h. As an owner, I want to open any Order's receipt exactly as the customer received it, so that I can answer a question about a specific purchase without reconstructing it.
53i. As an owner, I want to reprint or export that receipt, so that a customer who lost theirs is served.
53j. As an owner, I want a receipt from last year to render exactly as it did then — old prices, old names, the VAT rate in force at the time, and the payment method as it was called — so that a reprint is a record and not a re-interpretation.
53k. As an owner, I want a reprint marked as a reprint and recorded nowhere as a financial event, so that reprinting never touches a total.
53l. As an owner, I want a voided or refunded Order's receipt to show that it was reversed, so that a reprint cannot be passed off as a live sale.
53m. As an owner, I want to filter receipts by the person who rang them up, so that I can pull one employee's sales for a day without reading every row.
53n. As an owner, I want that filter to catch sales rung by a manager as well as by a cashier, so that "everything Boy sold" is not silently missing the sales he took himself.
53o. As an owner, I want the filter to survive opening a receipt and coming back, so that checking twelve of someone's sales is twelve taps and not twelve re-filters.
53p. As an owner, I want to filter refunds by who **took the original sale** as well as by who approved the refund, so that "sales rung by X that later came back" is one question and not two reports.

**Payment methods, discounts, and VAT — when they exist**

54. As an owner, I want sales broken down by payment method, so that I can reconcile my GCash balance and my card settlements separately from the drawer.
55. As an owner, I want only cash to count towards what should be in the drawer, so that a GCash sale does not make my till look short.
56. As an owner with no payment methods beyond cash, I want no payment-method report at all, so that the back-office does not show me a report with one row.
57. As an owner, I want every Discount applied in a period listed by name with its total, so that I know what my prices actually did.
58. As an owner, I want statutory discounts separated from manual price overrides, so that honouring a senior citizen discount is not filed as somebody changing a price.
59. As an owner, I want a discount that required a reference to show that reference, so that a claimed exemption is evidenced.
60. As a VAT-registered owner, I want VAT backed out of every total that carries it, and VAT-exempt sales to report zero rather than being silently omitted, so that the figure I hand over is correct.
61. As an owner who is not VAT-registered, I want no VAT column anywhere, so that I am not shown a number that does not apply to me and might imply a registration I do not have.

**Slicing a period**

62. As an owner, I want to look at a range of days but only a window of hours within each, so that I can compare the lunch rush across a month.
63. As an owner, I want a long range to chart itself by week or month rather than by day, so that a year is a readable picture instead of 365 bars.
64. As an owner, I want each headline figure to show how it compares with the previous equal-length period, so that a number arrives with its context attached.
65. As an owner, I want to click a headline figure and chart that figure over the period, so that I can see when it moved.

## Implementation Decisions

**Device time is the business truth. This closes the open question from the planning
session.** An Order's Device timestamp determines which business day, hour, and period it
falls in. The server receipt timestamp is retained and used for two things only: showing
sync lag, and detecting implausible clock skew.

The reasoning: the alternative — server receipt time — files a two-day outage's sales on
the day of reconnection, which makes both days wrong and makes them wrong in a way that
looks like a business event rather than a technical one. Device time can be wrong; that is
detectable and reportable. Server time is *reliably* wrong about when a sale happened,
which is worse.

**Clock skew is surfaced here and measured elsewhere.** `offline-sync` owns the replay
endpoint and stores three timestamps on every entry: the Device's claimed time, the server's
receipt time, and how long it sat in the Outbox. **This area derives skew from those stored
columns at query time.** An earlier draft specified replay-time recording here, which is
area 5's behaviour to own, not this one's to dictate. Skew beyond a threshold flags the Device and any
report covering its sales. A flagged report still renders — it warns, it does not refuse.

**Business day and timezone.** The Tenant carries a timezone, defaulting to `Asia/Manila`.
Each Store carries a business-day start time, defaulting to `00:00`. A "day" runs from that
local time to the same time next day. Every boundary in every report uses this, and every
displayed time is rendered in the Tenant's timezone. UTC appears nowhere in the UI.

**Reports are live queries.** No materialised views, no summary tables, no scheduled
aggregation, no reporting replica. Indexes on the columns reports filter and group by,
and nothing more. If a query becomes slow with real data, that is a measurement that
justifies a change — not a reason to build a cache first. Any future precomputation must
handle late-arriving rows, which is precisely the complexity being avoided here.

**The Summary report's spine is a waterfall, and it is anchored to figures that actually
exist as stored data.** An earlier draft defined `Gross` as "the sum of recorded OrderLine
totals **before any reduction**". That is self-contradictory: per `checkout`, the recorded
OrderLine total is already *after* the line-scoped Discount and after a manual override, so
subtracting the Discounts and Overrides tiles from it subtracted them a second time. The
identity could not hold on any Order carrying either.

The corrected waterfall separates **derived** figures from **stored** ones and subtracts
each reduction exactly once:

```
  List value          derived   Σ line composition at catalog prices, before any
                                line Discount and before any override
− Line discounts      derived   Σ (list − recorded) on lines carrying a Discount
− Overrides           derived   Σ (original − overridden) on lines carrying one
= Gross               STORED    Σ recorded OrderLine totals
− Order discounts     STORED    Σ the rounded Order-scoped Discount amounts
= Net                 STORED    Σ Order totals
− Refunds                       attributed to the original sale's day
= Net after refunds

  Voids                         EXCLUDED from every figure above.
                                Reported beside it as a count and a value.
```

**Derived figures are computed in exact `Millicentavos` from the composition captured on
each OrderLine, and rounded for display only.** They add no stored figure and therefore no
rounding site — ADR-0005's "exactly two rounded figures" governs what is *stored on an
Order*, and is unaffected.

**Voids are excluded rather than subtracted.** A voided Order is cancelled, not reduced.
Including it in Gross and subtracting it again would make every figure above depend on which
of two conventions a query happened to use. They are counted and valued beside the
waterfall, because an owner does want to see them.

**The Refunds report reads the same records the waterfall already subtracts, and shows two
dates on every row.** A Refund is attributed to **the original sale's business day** in the
Summary waterfall — that is where the revenue it reverses was counted — and is **listed on the
day it was taken** in this report, because "what went out of the drawer today" is the question
this report answers. Showing both dates on every row is what stops the two figures looking like
a bug. Voids are counted beside refunds and never summed into them.

A partial refund lists the returned OrderLines; a whole-order refund says so rather than
listing every line as if each were chosen. Every row links to the original Order, and from
there to its receipt.

**Filtering by employee means filtering by the User who took the sale, and that is not the
same as filtering by Role.** Managers ring sales too — on a quiet afternoon, most of them —
so a filter built over `Role = cashier` returns a confidently incomplete answer to "everything
Boy sold today". The filter is over the **User attributed to the Order**, whatever their Role,
and it is offered on the Orders list, the receipt view reached from it, and the Refunds report
(where it is a *second* filter beside the approving manager — who rang the sale and who
authorised the refund are different people and different questions).

`employee` is the word the request used; **`User` is the canonical term** and the surface
labels it by the person, not by the Role. Role gating is unchanged: a `cashier` cannot reach
these reports at all, so this filter never becomes a way for one cashier to read another's
takings.

The filter **persists through the drill into a receipt and back**, along with every other
filter. A filter set that resets on the back button turns twelve checks into twelve
re-filters, which is how a report stops being used.

**The receipt is rendered from the Order, and the template is shared with the terminal**
(ADR-0012). Nothing is stored: no PDF, no image, no object storage, no receipt number sequence
— the Order's identity is the receipt's. Re-rendering a sale from last year reproduces it
exactly because every input was captured on the Order at sale time: recorded prices, Variant
and Modifier names as they were, the VAT enablement and rate in force, the Discount name and
reference, and the PaymentMethod name as it was called.

The coupling this creates is real and is the price of the decision: the terminal and the back
office must render the same sale the same way, so the template lives in one place and is tested
on one worked example carrying a Discount, a VAT-exempt line, and a non-cash tender. A reprint
is marked as a reprint, writes no record, and moves no total. A receipt for a voided or
refunded Order shows that it was reversed.

**Each tile carries a comparison, and the comparator depends on the period.** A single day
compares against **the same weekday one week earlier**; every other period compares against
the immediately preceding equal-length period. For a food business a Saturday and a Tuesday
are not comparable, which is what story 5 asks for; for a week or a month the preceding
period is the right baseline. One rule, stated once, both halves tested.

`VAT` appears only for a VAT-enabled Tenant, and the discount tiles only where discounts
exist — so the strip is **up to eight tiles in a fixed order, several of them conditional**,
not a fixed seven. **Gross profit and margin do not appear** — DeanPOS knows prices, not
costs, and a margin computed from a missing cost is worse than no column.

Selecting a tile charts *that* figure over the period. This is a series change on the
existing period chart, not a fourth chart.

**The Orders list is a report, and it is the drill target for every other report.** One row
per Order: local time, Order number, cashier, Device, payment method, line count, gross, discount if
any, total, and state. Filters: period, Store, type (`sale` \| `refund` \| `void`),
cashier, Device, DrawerSession, and payment method. Selecting a row shows the full Order —
every OrderLine with its Modifiers, Add-ons, recorded price, and any manual override, plus
the Payment, the Discount and its reference, the VAT figure if any, and the approving User
on anything reversed.

**Every aggregate links into it with filters pre-applied.** A day in the Summary table, a
Variant in *By item*, a cashier in *By cashier*, a method in *By payment method* — each is
a link that lands on the Orders list already narrowed. Building the aggregates without this
ships eight dead ends.

**Reversals are visible in the list, not discovered by opening rows.** A voided or refunded
Order carries its state and its approver in the row itself.

**Nothing is cancelled from the back-office.** ADR-0005 holds: a paid Order is immutable and
is reversed only by a Void or a Refund taken at the terminal, each with a reason and an
approver. A comparable product offers back-office cancellation for mistaken and test sales,
which makes a row disappear from every figure. DeanPOS does not, because gross-versus-net
plus a reason on every reversal is a strictly more honest record than a vanished row, and
because "cancel" and "refund" would immediately become two names for the same act.

**Two export shapes for Orders**, following the same split the market expects: one row per
Order (a transaction register) and one row per OrderLine (item-level detail, with the
Modifiers, Add-ons, discount, and VAT applied to that line). The second is the one a
bookkeeper actually asks for. Both come from the same query as the screen.

**Optional features produce conditional reports, not empty ones.**

- No VAT → no VAT tile, no VAT column, no VAT rows in any export.
- No Discounts ever applied → the discount tiles vanish and the report **renames itself
  *Overrides***, because manual overrides exist for every tenant and story 24 must still be
  satisfiable. The report is suppressed only when there are neither discounts nor overrides
  in the period. An earlier draft said overrides "still report" without naming a surface,
  which left them unreachable for the default tenant — the likeliest tenant there is.
- Only `cash` configured → no *By payment method* report and no method column in the Orders
  list.

The condition is **"has this Tenant ever recorded one"**, not "is it enabled now" — turning
VAT off in June must not hide January's VAT.

**Modifier and Add-on take-up live inside *By item*, not in their own reports.** A Variant
row expands to show its Modifier split and its Add-on attach rate. For this product that is
a prep-quantity decision — how much to cook whole versus half — not analytics, and it does
not deserve a nav entry of its own.

**Time-of-day window.** Every report accepts an optional start and end time applied *within
each day* of the range, in the Store's local time. "The last 30 days, 11:00–14:00" is the
lunch rush across a month, and it is one extra predicate. Off by default; the whole day is
the default window.

**Chart bucketing is automatic, not a control.** Range ≤ 31 days buckets daily; ≤ 26 weeks
buckets weekly; longer buckets monthly. A bucket selector is four more states to design,
test, and explain in exchange for a choice the range already implies.

**No per-table column customisation, and no saved views.** A fixed, considered column set
per report plus CSV export covers the need. Column-picker UI is state to persist, migrate,
and get wrong at phone width. **Deferred, trigger:** a tenant who names the column they
cannot get to, twice.

**The back-office landing page is the Summary report scoped to today.** An owner opening
the back-office on a phone at 9pm wants one number, not a menu. There is no separate
dashboard screen and no dashboard-only widgets — the landing page *is* a report, with the
same query, the same access rules, and the same metadata block.

**Every report carries metadata**: computed-at, the period in local terms, the Store scope,
and two flags — *contains sessions closed with pending sync* and *contains Devices with
flagged clock skew*. This metadata is part of the report contract and appears in exports
too, not only on screen.

**Reversals are attributed to the original sale's day.** A refund on Tuesday of a Monday
sale reduces Monday's net and appears in Tuesday's refund activity. Both views exist
because both questions get asked; the reports name which they are showing rather than
picking one and hoping.

**Money.** All arithmetic uses `foundation`'s integer-centavo primitives. Percentages and
averages are computed for display only and never round-trip into stored figures.

**VAT is conditional and per-Order** (ADR-0010). Where an Order was recorded with VAT
enabled, the rate captured *on that Order* is backed out of its total — never added, and
never taken from the Tenant's current setting. Where it was recorded without VAT, there is
no VAT figure and no zero to display. A period spanning a tenant's VAT registration
therefore contains both kinds of Order, sums correctly, and says so in the metadata block.

**A VAT-exempt Discount removes VAT from the sale it applied to**, which is the whole point
of typing it (the Senior Citizen / PWD case). The exempt portion is reported separately
from ordinary VATable sales, because that split is exactly what the figure is for.

**Access.** `admin` sees the Tenant; `manager` sees their assigned Stores; `cashier` sees
only their own completed DrawerSession summary. **The blind-count rule from
`drawer-sessions` extends here:** no report may expose the expected total of a session the
requesting cashier has not yet counted. This is the most likely accidental leak in the
area, because a session report is an obvious thing to reuse.

**Charts, and only these three.** Reports are primarily tables; charts exist where a shape
is faster to read than a column of numbers.

1. Sales by hour of day — bar chart.
2. **The period chart** — bar chart of the selected KPI tile's figure across the range,
   bucketed automatically by day, week, or month per the rule above. One chart, whose
   series and bucket both change; not one chart per metric.
3. A sparkline on the daily-total tile, showing the preceding days for context.

Nothing else gets a chart in v1. Rendering uses **shadcn's chart components (Recharts)**,
which is **a new runtime dependency this area owns and adds to `packages/ui`** —
`foundation`'s scope for that package is "Tailwind preset, tokens, shadcn primitives" and
carries no charting library, so an earlier claim that this was "not a new dependency
decision" was wrong. It is —
already in the stack via `packages/ui`, so this is not a new dependency decision and needs
no ADR. It lands in `apps/backoffice` only, which never runs offline, so bundle weight is a
minor concern rather than a design constraint.

**Every chart is an addition to a table, never a replacement.** The same figures are
present as rows on the same screen, and the chart carries an accessible text alternative so
a screen-reader user reaches the data rather than an empty graphic. WCAG 2.2 AA applies:
the chart must not rely on colour alone to distinguish anything, and it must remain legible
at phone width. A chart that is the only route to a number is a defect, not a design choice.

**Export.** CSV, generated server-side from the same query that produced the screen, so the
two cannot diverge. Exports are Store-scoped like everything else and the act of exporting
is recorded.

**Delivery.** Back-office only. The terminal shows a running summary, a session summary at
close, and its own session history (`drawer-sessions`) — nothing aggregated. A sale screen
is not a dashboard.

**Visual reference.** `ORC2_DESIGN="lofi"`. Mocks are committed:
`backoffice/reports-summary-{1440,390}`, `backoffice/reports-orders-1440`,
`backoffice/reports-by-item-1440`, `backoffice/reports-refunds-1440`,
`backoffice/receipt-1440`, and **`backoffice/drawer-sessions-1440`, which belongs
to this area** — `drawer-sessions` writes the rows and owns the terminal's live view; the
cross-day, cross-Store table is a report. **Four of the nine reports are not drawn** — *By
category*, *By cashier*, *By payment method*, and *Discounts & overrides* share the
filter-strip-plus-table shape of `reports-by-item-1440` and are that mock's translation.
An implementer must flag them as translated in the build report rather than treat them as
drawn. Every mock shows the fully-configured tenant; the default tenant sees fewer columns
and one fewer report.

## Testing Decisions

**What makes a good test here.** Seed known Orders, sessions, and reversals, then assert
the exact figures a person would read. Every test in this area is an arithmetic and
boundary test; none of them should touch how a query is written.

The boundary cases are the whole area: a sale one second before the business-day start, one
second after, one during a DST-free but non-UTC offset, one replayed three days late, one
from a Device with a badly wrong clock, and one refunded in a later period.

**Seam.** The in-process seam from `foundation`. No new seam, and no browser seam — nothing
here is offline.

**Prior art.** The catalog fixture from `catalog`, the actors from `tenancy-identity`, the
wrong-tenant probe helper, and `drawer-sessions`' session fixtures. Reporting tests need a
richer seeded history than earlier areas; that seed builder is a deliverable and should be
expressed in business terms (*a Tuesday with two sessions, one refund, and a late-replayed
sale*), not as raw row inserts.

**Through the seam, at minimum.**

- Daily total, order count, and average match hand-computed figures for a seeded day.
- Cash and card-recorded splits are separated correctly, and card never affects drawer
  expectations.
- VAT backed out of a VAT-inclusive total, in exact centavos, for totals that do not divide
  evenly.
- A sale at 23:59 local with a 00:00 business-day start falls on that day; the same sale
  with a 02:00 start falls on the previous one.
- All rendered times are in the Tenant's timezone; a Tenant configured to another timezone
  shifts every boundary consistently.
- A sale replayed three days late appears on the day it occurred, not the day it arrived,
  and the period is flagged as having contained pending sync.
- A Device with implausible clock skew flags its Device and every report covering it,
  without preventing the report.
- A refund of a prior-period sale reduces that period's net and appears in the current
  period's activity, and both reports say which they are showing.
- Voids, refunds, and manual overrides each list the acting and approving Users.
- A manager sees only assigned Stores; a cashier cannot reach any Store-wide report.
- **A cashier cannot obtain the expected total of an uncounted session through any report
  procedure** — asserted on the response payload, not on the rendering.
- CSV export contains exactly the figures the screen query returned, including the metadata
  block.
- Wrong-tenant probes on every procedure, including export.
- Each charted report renders its table of the same figures, and the chart's accessible text
  alternative contains those figures — asserted through the accessibility tree, not by
  reading SVG.

**The optional features, which double the surface.** Every report is tested against **two
tenants** — one with VAT, Discounts, and extra PaymentMethods; one with none of them. A
suite that only exercises the configured tenant leaves the default product untested.

- A VAT-disabled tenant's reports and exports contain no VAT figure and no VAT column —
  asserted on the payload, not on the rendering.
- A period spanning the moment a tenant enabled VAT sums both kinds of Order correctly, and
  the VAT figure covers only the Orders recorded with it.
- Changing the Tenant's VAT rate does not change any already-recorded Order's VAT figure.
- A VAT-exempt Discount removes VAT from its sale. **Exempt Net + VATable Net = Net**,
  partitioning Orders by whether they carried a VAT-exempt Discount. An earlier draft
  asserted the portions sum to *gross*, which no definition of "portion" satisfies once the
  statutory computation has stripped VAT before discounting.
- **Tile deltas:** a single-day period compares against the same weekday one week earlier; a
  week and a month each compare against the immediately preceding equal-length period.
  Asserted per case.
- Discounts report by name with their totals; renaming a Discount does not rewrite the name
  on a past Order.
- A Discount requiring a reference reports that reference.
- Typed Discounts and manual overrides are reported in separate figures and never
  double-counted in the waterfall.
- Sales group by PaymentMethod using the **name captured on the Payment**; renaming or
  deleting a method leaves history intact.
- Only `cash` contributes to drawer expectations; every other method is excluded.
- A cash-only tenant gets no *By payment method* report — the procedure declines rather
  than returning a single row.

**Refunds and receipts.**

- A Refund taken **the day after** the sale appears on the sale's day in the Summary
  waterfall and on the day it was taken in the Refunds report — **one seeded refund, both
  assertions**, because this is the pair a reader will otherwise report as a bug.
- Refund totals for a period equal the waterfall's `Refunds` figure for the same Stores and
  the same original-sale attribution.
- A partial refund reports exactly the returned lines; a whole-order refund is marked as one.
- **Filtering by the User who took the sale returns manager-rung sales too** — seed a sale
  rung by a `manager` and assert it appears when filtering to that person. A filter built over
  Role instead of over the attributed User fails this and is the reason it is written down.
- The employee filter is asserted on the Orders list, on the Refunds report, and through the
  drill into a receipt and back — **the filter set survives the round trip**.
- **Voids never appear in any refund figure**, and refunds never appear in the void count.
- A receipt rendered from an Order **years later reproduces the sale exactly** — assert it
  against a seeded Order whose Variant has since been renamed, whose price has since changed,
  whose Discount has since been deleted, whose PaymentMethod has since been renamed, and whose
  Tenant has since turned VAT on. Every one of those must be invisible in the reprint. This
  single test is what ADR-0012 is buying, so it is not optional.
- The terminal's receipt and the back office's receipt for the same Order render the same
  figures and the same lines — the shared template asserted at both ends, on the worked
  example carrying a Discount, a VAT-exempt line, and a non-cash tender.
- A reprint writes no row and changes no total: assert the period's figures are identical
  before and after one.
- A voided or refunded Order's receipt is marked as reversed.
- An open **Ticket** appears in no report, no total, and no export — a draft is not a sale
  (ADR-0011). Seeded alongside a real sale so the assertion cannot pass vacuously.

**The Orders list and drill-down.**

- Each filter — type, cashier, Device, DrawerSession, payment method, **fulfilment tag** —
  returns exactly the seeded Orders and no others.
- **The sum of Order totals in the list equals the Summary's NET for the same filters**,
  with voided Orders excluded from both. This is the assertion that makes drill-down
  trustworthy and it is the one to write first. It is stated against Net, not Gross, because
  an Order's total is post-discount — an earlier draft asserted it against Gross, which could
  never pass for any tenant that had ever applied one.
- A per-Order **gross** column exists in the list and in the line-level export, so Gross is
  reconcilable too: summing it over the same filters equals Summary Gross.
- **A voided Order appears in the list and in no figure.** Asserted both ways.
- Every drill link from every aggregate lands on a filter set whose total equals the figure
  that was clicked — asserted for a day, a Variant, a cashier, and a payment method.
- An Order's detail payload contains its lines, Modifiers, Add-ons, recorded prices, manual
  overrides, Discount, reference, Payment, VAT if any, and the approver on anything
  reversed.
- Voided and refunded Orders carry their state and approver in the **list** payload, not
  only in the detail.
- Export one-row-per-Order and one-row-per-OrderLine both match the screen query; the
  line-level export's line totals sum to the Order-level export's totals.
- There is no procedure that cancels, deletes, or edits an Order from the back-office —
  asserted as an absence over the contract, alongside `hardening`'s sweep.

**Slicing.**

- A time-of-day window of 11:00–14:00 over a 30-day range includes only Orders inside that
  local window on each day, and excludes one seeded at 10:59 and one at 14:01.
- The window composes with the business-day start, including for a Store whose day starts
  at 02:00.
- Bucketing selects daily / weekly / monthly at the 31-day and 26-week thresholds, tested at
  the boundary on both sides.
- Each KPI tile's delta compares against the immediately preceding equal-length period, not
  the same period last year.

**Charts are not tested visually.** No pixel comparison and no snapshot of rendered SVG —
both break on a library update while proving nothing about correctness. What is tested is
that the chart receives the same data the table shows, and that the data is reachable
without sight.

**Property-tested.** For any generated set of Orders, discounts, and reversals:

- the sum of per-Store totals equals the all-Stores total;
- **the waterfall identity, which is the Summary report's entire claim**, in two halves so
  that a failure names which half broke:
  `list − lineDiscounts − overrides = gross` (derived side) and
  `gross − orderDiscounts = net` (stored side), then `net − refunds = netAfterRefunds`.
  Voided Orders contribute to none of them;
- the sum of per-hour buckets equals the day total, and the sum of chart buckets equals the
  period total at every bucketing level;
- **the sum of per-payment-method totals equals Net** — not net-after-refunds. Refunds and
  voids carry no PaymentMethod (`checkout` records reason and approver only), and a
  cross-period refund would need a back-dated method attribution no data model defines. This
  is the strongest identity the data supports, so it is the one asserted;
- the sum of Order totals in the list equals Net, and the sum of the list's per-Order gross column equals Gross, for any filter set;
- and every figure is an exact integer number of centavos with no accumulated rounding
  drift, with VAT enabled and with VAT disabled.

**Deliberately not tested here.** Query performance. It is not a criterion at MVP volumes
and a performance test written now would be measuring a fixture, not a workload.

## Security Criteria

1. **Wrong-tenant probes on every procedure, including CSV export.** An export is the
   easiest way to remove a lot of somebody else's data at once.
2. **Store scope is authorised, not filtered client-side.** A manager naming a Store they
   are not assigned to is refused, not quietly given an empty result that a future change
   might widen.
3. **Role gating:** `cashier` reaches only their own completed session summary. Every other
   report refuses them server-side.
4. **The blind-count rule holds through reports.** No procedure returns the expected total
   of a session the caller has not counted. This is the cross-area leak to guard.
5. **Exports are authorised identically to the screen** and are recorded — actor, Tenant,
   Store scope, period, and time.
6. **Untrusted input:** date ranges, Store ids, grouping keys, and pagination. Ranges are
   bounded to prevent an unbounded scan being used as a denial-of-service; grouping keys
   come from an allowlist and are never interpolated into SQL.
7. **No dynamic SQL construction from client input.** Kysely's builder only.
8. **Never logged:** report payloads and export contents. Log actor, scope, period, and row
   count.
9. **Error messages do not confirm the existence of another Tenant's Store or session.**
10. **The Orders list is the richest payload in the product** — every sale, every price,
    every actor, in one response. It carries the same wrong-tenant, Store-scope, and role
    checks as everything else, and it is the first place to probe, not the last.
11. **An Order id is guessable-shaped** (a client-generated UUID from ADR-0003). Reading an
    Order by id is authorised against Tenant and Store, never trusted from the id alone.
12. **Discount references are personal data.** A Senior Citizen or PWD ID number identifies a
    real person and is not the tenant's to publish. It is visible in the Orders list and in
    exports because a claimed exemption has to be evidenced, but it is **never logged**, and
    it is covered by `hardening`'s export and deletion procedures. **The rendered receipt
    carries it too** (ADR-0012), so the receipt view and its export are authorised exactly as
    the Orders list is — and because nothing is archived, there is no second store of it to
    protect, expire, or delete.
12a. **A ticket label is free text a cashier typed, and it may be a customer's name.** It is
    shown in the Orders list, exported, and **never logged** (ADR-0011). It is not a search
    key and it is not a filter value offered as an autocomplete over other people's labels.
13. **Pagination on the Orders list is mandatory and server-enforced.** An unbounded date
    range on the busiest report is the cheapest denial-of-service in the product.
14. **The absence of a back-office cancel/edit/delete procedure is asserted**, not merely
    intended. A future contribution adding one must fail a test.

## Out of Scope

- Accounting integration, e-invoicing, fiscal printers, and BIR-mandated readings or
  journals. Declared non-goals — DeanPOS produces business reports, not statutory ones, and
  nothing here should be described to a tenant as tax compliance.
- Scheduled or emailed reports. No email transport exists.
- Dashboards on the terminal. The sale screen is not a reporting surface.
- Forecasting, trends beyond a like-for-like comparison, and any analytics beyond
  descriptive figures.
- Inventory, cost of goods, margin, and profitability — DeanPOS knows prices, not costs.
- Labour cost and hours. No attendance data exists, by decision.
- Customer analytics. No customer records exist, by decision.
- Materialised views, summary tables, a reporting replica, or any precomputation.
- PDF generation. CSV only.
- **Cancelling, deleting, or editing an Order from the back-office.** ADR-0005 — reversal is
  a Void or a Refund at the terminal, with a reason and an approver. A comparable product
  offers back-office cancellation; this is a decision against it, not an omission.
- Per-table column customisation and saved report views. **Deferred, trigger:** a tenant who
  names the missing column twice.
- A standalone modifier report or add-on report. Both are breakdowns inside *By item*.
- A per-Variant or per-Category VAT-exempt flag. VAT is a Tenant-level setting (ADR-0010);
  mixed VATable and exempt goods within one tenant are not supported.
- A separate mobile dashboard application. The back-office is responsive and its landing
  page is the Summary report.
- Charting anything about a Discount or a payment method. They report as tables.
- Any chart beyond the three named above — no pie charts, no stacked breakdowns, no
  multi-series comparisons, no charted dashboard landing page. **Deferred, trigger:** a
  tenant or a demo where the three named charts plus tables demonstrably do not land.
- Interactive charts — drill-down, brushing, zoom, tooltip-driven filtering. The charts are
  read-only pictures of the table beside them.
- Alerting on a report figure crossing a threshold. Area 8 owns alerting.

## Further Notes

- **The timestamp decision is the one to get right and then never revisit casually.** Device
  time for when it happened; server time for sync lag and skew detection. Written here, in
  `CONTEXT.md`, and in every report's own description.
- **A report that cannot change is a report that is lying.** Late replay is normal in this
  product; the metadata block is what keeps the figures honest, and it belongs in exports
  as much as on screen.
- **Timezone bugs are silent.** Nothing crashes, the numbers are just wrong by a few hours
  at the boundaries. The boundary tests are the point of this area's test suite.
- **Do not precompute.** The temptation will arrive with the first slightly slow query;
  measure it against real data first. A summary table that must be corrected when a
  three-day-old sale arrives is far more expensive than an index.
- **The blind count can be defeated from here without anyone intending it.** A session
  report is the obvious thing to reuse at close, and reusing it would ship the expected
  total to the terminal before the count.
- Reports are the first thing a prospective tenant is shown in a demo. That is not an
  argument for building more of them, but it is an argument for the ones that exist being
  correct at the boundaries.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0003,
ADR-0005. Closes the planning session's open question on device-versus-server timestamps.
Reuses the in-process seam; adds none._
