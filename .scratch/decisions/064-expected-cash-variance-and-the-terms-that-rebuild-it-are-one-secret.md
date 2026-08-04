# 064: Expected cash, Variance, and the cash-side aggregate are one secret, not three — and the blind count is a friction control, not an information control

- **Status:** decided
- **Stakes:** **high** — a cash-loss control that two areas will implement independently, and a rule that reads as satisfied while leaking.
- **Date:** 2026-08-04
- **Asked by:** the human, from the back-office authorisation thread following record 063
- **Binds:** `drawer-sessions` and `reporting`, neither started. **No code changes here.**
- **Relates to:** [063](063-the-back-office-shell-refuses-by-default-and-a-cashier-never-enters-it.md) (Amendment 1 recorded `/reports/drawer-sessions`' `cashier` destination and deferred this), [046](046-how-tenant-settings-are-stored-and-audited.md) §4 (server refusal is the enforcement), [062](062-the-wrong-tenant-probe-coverage-guard.md) (the house standard for naming what a control cannot do)

## The question

Both PRDs say the same sentence: **expected cash is `manager` and `admin` only, and a cashier
never may see it.** `drawer-sessions/PRD.md:192` adds the part that matters — *"the payload they
receive does not contain one"* — and calls it one rule over three surfaces: the close-time reveal,
the running summary, and every report.

The sentence is not enough to implement. It names a **field**. What it protects is a **value**,
and the value has more than one route to a screen. Two areas will build against that sentence
separately, and a good-faith implementer satisfies it while handing the number over.

**Weights, declared before any option was scored.** **User ×2** (a cashier's own work is
legitimately theirs to check; a surface stripped to nothing fails them) · **Business ×2** (this is
a cash-shrinkage control — the loss is money, not goodwill) · **Eng cost/risk ×2** · **Reversibility ×2**
· **Evidence ×3** (this turns on arithmetic over the PRD's own published formula and field list,
which a human can check line by line here). Maximum **55**. **Not changed after scoring.**

## What the PRDs already fix, and is not reopened

- **`drawer-sessions/PRD.md:38`** — `expected = Float + cash taken − cash refunded + cash in − cash out`.
- **`:192`** — expected cash is the Role, never a per-User permission; the payload does not carry it.
- **`:198`** — *"one rule, three surfaces"*, and *"adding a second concept for the same secret is
  how a control gets widened by accident."* This record is that sentence taken literally.
- **`:207`** — terminal session history is scoped to **that Device** and a bounded window;
  cross-Device and cross-period questions belong to `reporting`.
- **`:290`** — `backoffice/drawer-sessions-1440` belongs to **`reporting`**.
- **`tenancy-identity/PRD.md:311`** — a cashier's back-office column is *their own published Shifts
  and their own session summaries.*

## What I chose, and why

### 1. Variance is expected cash written differently

`Variance = counted − expected`. The cashier **typed** counted. So a surface that withholds
expected and shows Variance has disclosed expected by subtraction, exactly and with no effort.

Nothing in either PRD says this. Story 18 gives expected/counted/Variance to a **manager**; story
19 mentions a cashier's Variance only as *behaviour* — a within-tolerance session closes *"without
ceremony"* — never as something displayed. An implementer reading *"hide expected cash"* ships the
Variance column believing it is a different field, and the review that catches it is the one that
happens to do the algebra.

**So the rule is stated as a value, not a field: no cashier-bound payload contains expected cash,
Variance, or any figure from which either follows.**

### 2. The honest part — the blind count is not an information control, and pretending otherwise is worse

Every term of the expected-cash formula is something **the cashier personally did**. They declared
the Float (stories 2–3). They took each cash sale. They recorded each cash movement with its
reason (stories 9–10). A cashier keeping a tally on paper knows expected before they count, and no
payload rule reaches that.

**What the product controls is the aggregate, and the aggregate is the product's own
contribution.** Summing five terms across a shift is the work; doing it for the cashier and
putting the total on screen converts *possible with diligence* into *one glance*, and it destroys
the one thing the blind count is actually for — that the count is an **independent act** rather
than a number reconciled against a target.

Calling it an information control would be false, and a control described falsely gets trusted
falsely. Named here so no later record has to discover it: **this rule raises effort and preserves
the independence of the count. It does not make expected cash unknowable to the person who
generated every input to it.**

### 3. The running summary as specified defeats the blind count, and story 12 is the fix

`drawer-sessions/PRD.md:186` lists the running summary's fields: *opened-at, opening User, Float,
order count, sales by PaymentMethod, refunds, cash movements*, and expected cash only for someone
entitled to it. **The first list contains every term of the formula.** The cashier-visible payload
therefore reconstructs expected in one addition — not by tracking anything over a shift, but from
a single screen the PRD hands them mid-session.

The PRD contradicts itself here, and the contradiction is inside one story list:

- **Story 12** — *"see **how many sales** I have taken this session … **without seeing the
  expected total**"*. A count.
- **Story 37** — *"show me **what I have sold** but not what should be in the drawer"*, which
  `:186` resolves into values by payment method.

**Resolved on story 12's side.** Story 12 states the constraint and the reason in the same
sentence; story 37 states an intent whose chosen expansion defeats that reason. A count of orders
gives a cashier the *"sense of the day"* story 12 asks for and reconstructs nothing.

### 4. Non-cash totals are safe, and stay

Story 13 excludes card-recorded payments from expected cash. A figure outside the formula cannot
help rebuild it, so **GCash, Card, Maya and bank-transfer totals may be shown to a cashier** — on
the running summary and on their own session summaries alike. This is not a concession; it is the
same value rule applied honestly in the other direction, and story 42's separation of non-cash
methods survives for everyone.

### 5. What a cashier sees

Cash-side terms are withheld **as displayed aggregates**, not pretended to be secrets — §2 says
why. Float appears at open because the cashier types it there; it does not reappear in a summary.

| Shown to a cashier | Withheld from a cashier |
| --- | --- |
| opened-at, closed-at | **expected cash** |
| Device name and code, Store | **Variance** |
| **order count** | cash sales total, cash refunds total |
| non-cash totals by PaymentMethod | cash movements total |
| their own **counted** total, after they submit it | Float, as a summary line |
| sync state of the close (`offline-sync`'s vocabulary) | anything belonging to another User |

Counted is safe alone: without Variance it yields nothing, and the cashier authored it.

### 6. Scope: by Device on the terminal, by User in the back office

Two different questions, and conflating them is the other way this goes wrong.

- **Terminal** — sessions closed on **this Device**, bounded recent window (`:207`). The cashier
  is standing at it; story 39 wants yesterday's close answerable *"without opening the
  back-office"*.
- **Back office** — **their own** sessions, **across Devices**, because a cashier who worked two
  terminals has two sessions and both are theirs (`tenancy-identity/PRD.md:311`). The Device is a
  **column, not a filter.**

### 7. Enforcement is the projection, not the screen

046 §4, unchanged: the server sends a cashier a payload that never contained the withheld figures.
Not a hidden column, not a conditional render, not a `null` where the number was — **absent from
the shape**. `:194`'s two right-hand panels are *"the same screen for two people"*, which is a
rendering consequence of two payloads, never a client-side branch over one.

## The options, ranked

| Rank | Option | User ×2 | Bus ×2 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **One secret: expected, Variance, and the cash-side aggregate; cashier gets counts, non-cash totals, and their own counted figure** | 4 (8) | 5 (10) | 4 (8) | 4 (8) | 5 (15) | **49** |
| 2 | Withhold expected and Variance; keep the cash-side breakdown of `:186` | 5 (10) | 2 (4) | 4 (8) | 4 (8) | 3 (9) | **39** |
| 3 | Withhold expected only — the literal sentence in both PRDs | 5 (10) | 1 (2) | 5 (10) | 4 (8) | 2 (6) | **36** |
| 4 | Withhold every monetary figure from a cashier, counted included | 1 (2) | 5 (10) | 3 (6) | 3 (6) | 2 (6) | **30** |
| 5 | Defer to whichever area implements first | 2 (4) | 1 (2) | 3 (6) | 5 (10) | 1 (3) | **25** |

**2 — expected and Variance only.** The runner-up, and the one most likely to ship by accident,
because it looks thorough. It loses on business: `:186`'s field list is five-fifths of the
formula, so the control is defeated by addition on a screen the PRD puts in front of the cashier
mid-session — which is precisely when the blind count is supposed to be holding.

**3 — the literal sentence.** What both PRDs say today, and what a careful implementer will build.
It leaks twice: once by subtraction (Variance), once by addition (`:186`). Its 36 points are
almost all user value and engineering ease — it is the cheapest option and the one this record
exists to prevent.

**4 — nothing monetary.** Safest-looking, and it breaks the product: stories 15–17 have the
cashier counting the drawer and entering the total, which cannot be done blind to money. It also
takes away the counted figure they authored, which protects nothing.

**5 — defer.** Ten of its 25 points are the reversibility every do-nothing option collects free.
Two areas implementing the same sentence separately, each satisfying it literally, is the
mechanism that produces the leak.

## What this deliberately does not decide

- **Whether the `reporting` back-office screen exists for a cashier at all**, and its window. 063's
  Amendment 1 holds `/reports/drawer-sessions` at `admin` until the area that owns it ships the
  scoping; this record fixes the *shape* of a cashier payload, not the route's arrival.
- **Manager scoping.** A manager's expected-cash right is settled; whether they see it for Stores
  they are not assigned to is `reporting`'s Store-scoping question, unchanged by this.
- **Anything about the Override at close.** Story 20's manager PIN and reason are untouched.

## How to turn it back

| What | Cost |
| --- | --- |
| Show a cashier Variance | One field in one payload — **and it hands over expected**. It must return with expected, or not at all |
| Restore `:186`'s cash-side breakdown for a cashier | One payload projection. Reverses §3 and re-opens the addition |
| Adopt story 37's reading over story 12's | A superseding record; both stories stay in the PRD either way |
| Formally | Superseding record; flip this `Status:` to `overturned` with date and reason; update `LOG.md`. **No migration, no code, nothing built yet** |

## What should make you reverse this

- **A cashier's own work becomes unanswerable to them** — repeated "I can't check my own shift"
  complaints. Successor is option 2 with the cash-side breakdown restored *post-close only*, where
  the blind count is no longer live. This record does not take that route because `:198` fixes one
  rule over three surfaces and splitting it is how a control gets widened by accident, but it is
  the honest first concession if the surface proves too thin.
- **A Variance figure turns out to be needed by a cashier for a legitimate flow** not visible from
  here — an appeal, a dispute. Then it returns *with* expected, openly, and the blind count is
  re-argued rather than quietly holed.
- **`drawer-sessions` resolves story 12 against story 37 in its own record** with reasoning this
  one does not have. That record supersedes §3, and should say so explicitly rather than differ
  silently.
- **Per-User permissions arrive in the product.** Both PRDs currently reason from their absence;
  the whole "it is the Role" argument is rebuilt that day.

## Evidence

**Read 2026-08-04, on `main` at `12505bf`:**

- `.scratch/drawer-sessions/PRD.md` — `:38` the formula; `:42` the blind count; `:186` the running
  summary's field list, **the arithmetic in §3 is over this line**; `:192` the Role rule and
  *"the payload they receive does not contain one"*; `:198` one rule three surfaces; `:203` the
  summary is computed on the Device; `:207` terminal history, Device-scoped, bounded; `:290`
  `backoffice/drawer-sessions-1440` belongs to `reporting`; `:294` two panels, one screen, two
  people. Stories **12** and **37** (the conflict), **13** (non-cash excluded), **2–3** (Float
  declared by the cashier), **9–10** (movements recorded by the cashier), **15–17** (the cashier
  counts and types the total), **18–19** (Variance is a manager's to see), **39–42**.
- `.scratch/tenancy-identity/PRD.md:311` (the cashier's back-office column), `:315–320` (expected
  cash is the Role, one rule four surfaces, no per-User permissions).
- Records **063** and its Amendment 1 (`/reports/drawer-sessions` held at `admin`, destination
  `cashier`, this deferred), **046** §4, **062** (the standard for §2's honesty).
- **Nothing built.** `apps/backoffice/src/routes/_shell/reports/drawer-sessions.tsx` renders
  `Placeholder`; no DrawerSession table, handler, or procedure exists anywhere in `packages/`.
  This record costs one commit and unblocks two areas.
- `.scratch/decisions/` listed directly: **063 is the highest number and is taken; 064 is free.**
  No existing record decides expected-cash disclosure, Variance visibility, or a cashier's session
  payload.

**External: none, and deliberately.** Blind cash counts are ordinary retail practice and the
control is not in dispute; what needed deciding was arithmetic over this product's own published
formula and field list, which is checkable above and would only be obscured by citing general
guidance on till reconciliation.
