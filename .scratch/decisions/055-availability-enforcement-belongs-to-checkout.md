# 055: Per-Store availability is enforced by `checkout`, not by issue 08 — the join as built is the server truth it enforces against

- **Status:** decided
- **Stakes:** high — a money-semantics criterion is being moved out of the issue that states it, and the obligation is lost if the note is not written
- **Date:** 2026-08-03
- **Asked by:** the orchestrator, for `.scratch/tenancy-identity/issues/08-payment-methods.md` (criterion 4), raised blocking by a second-model review
- **Relates to:** [054](054-payment-method-availability-and-its-audit.md) (the join's polarity, `cash`, admin-only); issue 07's "Obligation carried forward to `checkout`" precedent

## The question

Issue 08 says a caller at a Store where a method is unavailable "cannot name it", and the same
issue says applying a method to a sale belongs to `checkout`. Nothing in issue 08 accepts a
payment method against a sale, so there is nothing here to refuse. Does the refusal get built
now, or is it `checkout`'s, and does anything have to be added so `checkout` is not left
reading an `admin`-only list?

**Weights, declared before scoring:** User ×1 · Business ×1 · Eng cost/risk ×2 ·
Reversibility ×2 · Evidence ×2. Max 40. The user hat is weighted down honestly: **no caller
exists today** — `apps/pos` is a ping route and an app shell, with no sale flow — so no option
changes what anyone sees this month. The question is what gets built speculatively and what
gets lost. Not changed after scoring.

## What I chose, and why

**`checkout`.** The refusal site is the procedure that puts a method on a sale, and that
procedure does not exist. Building a Store-scoped read now means guessing three things
`checkout` will decide for itself — whether the Store comes from a parameter or from the
cashier's Store membership, whether inactive methods are returned, and whether `cash` is
synthesised into the list — and a guess with no caller is rewritten, not reused.

**Nothing is added to issue 08's backend.** The write side of criterion 4 is already enforced
server-side and is not in dispute: `update` refuses a `cash` id before it refuses anything else,
create/update are `admin`-gated, and the composite `(tenant_id, store_id)` foreign key makes an
availability row for another tenant's Store unwritable. That half stays in issue 08 and keeps
its wrong-tenant probe.

**The join as built is sufficient server truth** — `PaymentMethod.kind`, `PaymentMethod.active`
and a positive `PaymentMethodAvailability` row per `(method, Store)` pair, all RLS-confined.
`checkout` queries it directly; it must never read `paymentMethod.list`, which is `admin`-only,
tenant-wide and unfiltered by Store. What issue 08 owes `checkout` is not a procedure, it is the
predicate written down — because record 054 gave `cash` **no join rows at all**, so a plain
`INNER JOIN` on availability refuses cash at every Store and configures a till that cannot sell.
That is exactly the hazard the partial unique index exists to prevent, arriving through the back
door, and it is the one thing an implementer must not get wrong.

The `admin`-only list does not hurt anyone today — there is no cashier screen to starve. It
starts hurting the day `checkout` ships, which is the same day the obligation below comes due.

## The options, ranked

| Rank | Option | User ×1 | Bus ×1 | Eng ×2 | Revers ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Carry to `checkout`; split criterion 4; write the obligation and the predicate** | 3 | 4 | 5 (10) | 5 (10) | 5 (10) | **37** |
| 2 | Add a shared `isAvailableAtStore` predicate helper now, no procedure | 3 | 3 | 4 (8) | 4 (8) | 3 (6) | **28** |
| 3 | Leave criterion 4 as written, unproven | 1 | 1 | 3 (6) | 5 (10) | 2 (4) | **22** |
| 4 | Build a Store-scoped, cashier-readable list procedure now | 3 | 2 | 2 (4) | 3 (6) | 2 (4) | **19** |

**1. Chosen.** Costs one criterion edit and one paragraph, invents nothing, and the issue's own
Comments already say applying a method to a sale is `checkout`'s. Issue 07 set the precedent for
exactly this transfer and it worked.

**2. The helper.** The genuinely close runner-up, and the reason is the `cash` trap: a predicate
placed in `packages/backend/src/payment-method/` now cannot be got wrong later. It loses because
a function with zero callers is a guess about its own signature (does it take a transaction? one
method or a set?) and is as likely to be rewritten as re-used — and the trap is preserved just as
well by writing the predicate into the obligation, where whoever scopes `checkout` reads it.

**3. Leave it.** Reversibility 5 and nothing else. An acceptance criterion nothing can satisfy
blocks the issue permanently and trains the next reviewer to wave criteria through.

**4. The Store-scoped procedure.** Loses on all three weighted criteria at once. It re-opens
record 054's `admin`-only call (smaller call 1) without the consumer that would tell us the
shape, and 054 already pre-priced that reversal as needing 038 §6's read-only treatment **plus**
044 §2 clause 3's Store projection — neither of which this issue would build.

## The obligation `checkout` inherits, and the trap in it

A method `M` may be named on a sale at Store `S` **iff**: `M.active` is true **and**
(`M.kind = 'cash'` **or** a `PaymentMethodAvailability` row exists with
`payment_method_id = M.id` and `store_id = S`) — all under the caller's tenant scope.

The `cash` disjunct is not optional and is not a convenience. `cash` holds no availability rows
by design (record 054), so omitting it refuses cash everywhere.

## How to turn it back

| What | Cost |
| --- | --- |
| The criterion split and the Comments note | Revert two blocks of text in `.scratch/tenancy-identity/issues/08-payment-methods.md`. One commit. |
| Option 2, the helper | One new file under `packages/backend/src/payment-method/`, one test. Additive at any time. |
| Option 4, the Store-scoped procedure | One `contract.ts` entry, one handler, one route, tests — plus record 054's smaller call 1 reversal if it is cashier-readable. **Call sites today: zero** (`paymentMethod.` appears in four files, all back office or tests). The number only grows. |

Nothing is built on top of this decision, because its whole content is that nothing is built.

## What should make you reverse this

- **`checkout`'s issue is drafted without the obligation paragraph reaching it.** The single
  failure mode of this decision: a criterion moved and then lost. Whoever scopes `checkout`
  must be able to point at the predicate above in that issue's text.
- **`apps/pos` gains a sale flow before `checkout` is scoped.** Then the cashier read path is
  needed and option 4 is due, with record 054 smaller call 1 reversed in the same pass.
- **A second area needs the same predicate before `checkout` ships** — `drawer-sessions` or
  reporting reaching for "is this method offered here". Two callers is the trigger for option 2.

## Evidence

**Worktree `.worktrees/08-payment-methods`, read 2026-08-03:**

- `packages/contract/src/contract.ts` lines 111–231 — `paymentMethod.{list,create,update,deactivate,reactivate}`. **No input anywhere accepts a method against a sale**; `storeIds` on create/update is the admin write side.
- `packages/backend/src/payment-method/handlers/list-payment-methods.ts` — `hasAtLeastRole(role, "admin")`, empty array otherwise, every method for the tenant, **no Store filter**. `update-payment-method.ts:49` — `if (!existing || existing.kind === "cash") return null`, under `forUpdate()`.
- `packages/backend/src/db/prisma/schema.prisma` — `PaymentMethodAvailability` with `@@unique([paymentMethodId, storeId])` and composite FKs to `(tenantId, id)` on both `PaymentMethod` and `Store`; the model comment confirms `cash` holds no rows.
- `apps/pos/src/**` — 12 source files: shell, error/not-found states, a `ping` feature, router. **No sale flow, no method consumer.** `rg 'paymentMethod\.'` across the worktree returns four files, all `apps/api` routes/tests, the back-office query module, and record 054.
- `.scratch/tenancy-identity/issues/07-tenant-settings.md` lines 74–78 — the "Obligation carried forward to `checkout`" wording this copies.

**Searched for and not found:** no `checkout` issue, PRD or directory exists anywhere under
`.scratch/` — so the obligation has no file to be written into yet, which is precisely why it
must live in issue 08's Comments. No external source was consulted: this is a scope boundary
inside one repository's own documents, and citing general literature on it would be padding.
