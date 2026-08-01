# 003: Every Delta on a line is measured against the item's own price, and only one can be a multiplier

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-01
- **Asked by:** `.scratch/foundation/issues/02-money-primitives.md` (routed by the orchestrator)

## The question

When a cashier rings up one item with several price adjustments on it — a half
portion, an extra egg, a large-size upcharge — how do those adjustments combine
into one price?

Two answers are possible. Either each adjustment is measured against the item's
own menu price and the results are added together, or each adjustment is applied
to the running total left by the one before it. They give different money as soon
as two of the adjustments are percentages, and a wrong answer here is a wrong
price on a receipt, repeated on every sale, in four different parts of the
product.

## What I chose, and why

**The rule was already written down, and it is the first answer.** This record's
main job is to find it, say so, and close the one hole it leaves.

The `checkout` specification — the area that owns the sale line — states the
per-line arithmetic as a list that begins *"Variant price **+** Modifier and
Add-on Deltas"*. That is addition against the item's own price, not a chain. The
`catalog` specification and the `foundation` specification both say the same
thing from the other side, in the same words: *"`Centavos × per-mille` **is**
`Millicentavos`"* — an item's price multiplied by a rate lands, with no division
and no rounding, at the working scale the product computes in. That sentence is
only true when the rate is applied to the item's price. Apply a second rate to
the result and you are multiplying two rates together, which lands a thousand
times too high and has to be divided back down — and that division leaves a
remainder, which means rounding, in the middle of a calculation ADR-0005 says is
rounded exactly once and only at the end.

So: **each adjustment is computed against the item's unmodified price, and the
contributions are added.** A percentage scales the menu price; a flat amount adds
itself; neither sees the other's result. The order the cashier taps them in
cannot change the total. Nothing divides, nothing rounds, and the invariant the
`foundation` specification states — *any sequence of Deltas yields an exact
integer with no rounding at any step* — holds exactly as written. **It does not
need to be weakened.** The implementation already in the lane is correct and I am
not asking for it to change.

That leaves one genuine hole, and it is the reason this record is not just a
citation. Adding contributions is obviously right when there is one percentage
and any number of flat amounts — the product's own worked example, a half adobo
at ₱120 with ₱15 of extra rice, comes to ₱75.00 under this rule and under any
sensible alternative. It stops being obviously right the moment **two**
percentages land on the same line. Half price and ten percent off, added, come to
₱140 on a ₱100 item — more than the item costs. Nobody means that.

**So I am forbidding that situation rather than choosing an answer for it.** At
most one percentage adjustment may reach one sale line. `catalog` refuses to save
a menu that could produce two; `checkout` refuses a sale that carries two. This
is not a hedge, and it is worth being precise about why it is the strong answer
rather than the timid one:

- **It costs the product nothing real.** The two comparable products this project
  benchmarks against do not offer percentage adjustments on an item *at all* —
  Square's help centre says a modifier's price is a flat amount, positive or
  negative, and Loyverse puts percentages in Discounts and keeps modifier options
  priced. DeanPOS is already more permissive than both. Allowing one percentage
  per line is more than either competitor, and it covers the case the percentage
  exists for: the half portion.
- **It cannot be reached by the discount that inspired the worry.** A staff or
  senior discount in this product is a `Discount`, not a Delta (ADR-0010) — a
  separate, typed, person-applied thing that `checkout` subtracts on its own line
  of the arithmetic, after the Deltas and before the single rounding. It was never
  going to stack with a half portion through this path.
- **It makes the decision genuinely free to reverse.** While at most one
  percentage is on a line, adding contributions and chaining them produce
  *bit-for-bit the same number*. There is no sale this product can ring up on
  which the two rules disagree. So if a tenant one day needs stacked percentages,
  switching the rule re-prices nothing that has already been sold — and that
  matters enormously, because ADR-0005 makes a paid Order permanently uneditable.
  Without this guard, a later switch would leave the sales ledger holding lines
  computed under two different rules, with nothing to distinguish them. That is
  not a reversal; it is a permanent fork in the books.

The one thing to be honest about: this forbids a menu a manager could reasonably
want to build — "half portion" and "no rice, ten percent off" on the same dish.
They will have to express the second as a flat amount instead. That is a smaller
loss than a total nobody can explain, and the trigger for revisiting it is written
below.

### Weights used for the ranking

Declared before any option was scored. Four criteria at ×2 and one at ×1, and the
reason for the odd one out is that it genuinely does not separate the candidates:
every option here is a handful of lines in one pure module, so engineering cost is
nearly identical across them and weighting it equally would let noise decide a
money question. Everything else is load-bearing — this is a figure a customer is
shown and an owner's margin, and four later areas compute on top of it.

| Criterion | Weight |
| --- | --- |
| User impact | ×2 |
| Business impact | ×2 |
| Engineering cost and risk | ×1 |
| Reversibility | ×2 |
| Evidence strength | ×2 |

Maximum possible total: 45. Weights were **not** changed after scoring.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk | Reversibility | Evidence | Total |
| ---- | ------ | ---- | -------- | ------------- | ------------- | -------- | ----- |
| 1 | **Contributions against the base, + at most one multiplier per line** | 5 | 5 | 4 | 5 | 5 | **44** |
| 2 | Contributions against the base, unconstrained (as built) | 3 | 3 | 5 | 3 | 5 | **33** |
| 3 | Defer Delta application out of `foundation` into `catalog`/`checkout` | 3 | 3 | 2 | 4 | 2 | **26** |
| 4 | Chained fold at a wider fixed-point scale | 4 | 3 | 2 | 2 | 2 | **24** |
| 5 | Chained fold with a rounding step between Deltas | 2 | 2 | 5 | 4 | 1 | **23** |
| 6 | Decide nothing; route to the human | 1 | 1 | 5 | 5 | 1 | **21** |

**1. Contributions against the base, plus a one-multiplier-per-line guard —
chosen.** The arithmetic is what both owning specifications already state and what
is already built, so the rule itself is zero work; the guard is one bounded check
in each of two later areas. It scores 5 on reversibility for a specific reason,
not optimism: while the guard holds, switching to the other rule changes no figure
any sale has ever produced, so the reversal is a one-file edit with no historical
consequence. Evidence is 5 because three internal documents state the rule in the
same words, the product's canonical worked example pins it to ₱75.00, and the two
comparison products do not even offer the feature the guard restricts.

**2. Contributions against the base, unconstrained — what is in the lane today.**
Identical arithmetic, and correct for every scenario in every specification. It
ranks second only because it leaves the two-percentage case reachable, where it
produces a number nobody means and does so silently. Its reversibility is 3 rather
than 5 entirely because of that: once one tenant configures two percentages and
sells under this rule, ADR-0005 forbids re-pricing those Orders, so any later
change to the rule splits the ledger permanently. The gap between options 1 and 2
is one validation function, and it is the whole value of this record.

**3. Defer Delta application to `catalog`/`checkout`.** Rejected on the
specifications' own terms rather than on taste. Issue 02's acceptance criteria
require Delta application in `packages/schemas` and state that *"no other workspace
implements rounding, VAT, or Delta application"*; the `catalog` PRD says
`catalog` and `checkout` *"must not both implement the arithmetic."* Deferring
either duplicates the arithmetic in two areas or moves it into one that the other
cannot import. It also removes the shared primitive the terminal needs to compute
totals offline. Ranked third because it is at least coherent, unlike 4 and 5.

**4. Chained fold at a wider fixed-point scale.** The honest version of the
intuitive answer: keep chaining, and widen the number type so the division never
happens. It genuinely reads better for stacked percentages, which is why it scores
4 on user impact. It loses on everything else. The scale grows by a factor of a
thousand per percentage, so there is no fixed type that works — it means `bigint`
or an unbounded scale, and `Millicentavos` is not a local detail: it is named in
ADR-0005, in three PRDs, in the glossary, and it will be a database column type
and a wire format. Changing it after `catalog` has migrations is precisely the
"unwind a merged migration" case, which is why reversibility is 2. It also
contradicts the `Centavos × per-mille` **is** `Millicentavos` sentence that three
documents share.

**5. Chained fold with a rounding step between Deltas.** The cheapest code and the
worst answer. It contradicts ADR-0005 directly — rounding happens once per stored
figure, and a modified price is not a stored figure — and issue 02 spells out the
exact damage with a number: ₱121.00 at half price rounds once to ₱60.50 and twice
to ₱60.00. Listed because someone will propose it as the obvious fix the first
time the fold's remainder is noticed; it is here so that they find it already
rejected, with the reason.

**6. Decide nothing; route to the human.** Considered and rejected, and its score
is inflated in the way any do-nothing option's is — 15 of its 21 points come from
the two criteria that doing nothing trivially maximises. It fails because the
premise is false: this is not an unrecorded pricing policy. `checkout` states the
composition, `catalog` and `foundation` corroborate it, and ADR-0010 already
decided that percentage reductions are Discounts rather than Deltas. Escalating
would be asking the human to re-read a document they already wrote. The one part
that *is* new — the one-multiplier guard — has a written-down, affordable reversal
path, which is exactly the test for whether it is mine.

## What the fixer does

Exact, so that nothing here is re-decided downstream. All of it is in the
`foundation-02-money-primitives` lane.

**1. `applyDeltas` and `applyDelta` stay in `packages/schemas/src/money.ts`.** No
move, no deferral, no second implementation anywhere.

**2. Do not change `deltaContribution` or `applyDeltas`.** The arithmetic is
correct. This record ratifies it.

**3. Replace the doc comment on `applyDeltas` with text that states the rule and
its precondition**, because the rule is now a contract and not an implementation
detail:

```ts
/**
 * Applies a sequence of Deltas to `price`. **Every Delta is computed against the same
 * unmodified `price` and the contributions are summed** — a `multiplier` scales the base
 * price, an `absolute` adds a flat amount, and neither sees the other's result. This is
 * `checkout`'s stated per-line rule ("Variant price + Modifier and Add-on Deltas"), and it
 * is what makes `Centavos × per-mille` **be** `Millicentavos`: every step is exact integer
 * multiplication and addition, nothing divides, and nothing rounds until the OrderLine
 * total (ADR-0005).
 *
 * Composition is therefore **order-independent**. A chained fold — each Delta applied to
 * the running total — is deliberately not what this does: a second multiplier in a fold
 * lands at 10^6 scale and needs a division by 1000 whose remainder would round
 * mid-sequence, which ADR-0005 forbids.
 *
 * **Precondition, enforced upstream and not here:** at most one `multiplier` Delta may
 * reach one OrderLine. `catalog` rejects the configuration; `checkout` rejects the
 * submission. While that holds, this rule and a multiplier-first fold agree exactly.
 * See `.scratch/decisions/003-delta-composition.md`.
 */
```

**4. Add three tests to `packages/schemas/tests/money.test.ts`.** Keep every
existing test — issue 02's acceptance criteria are unchanged and still met. These
are additions, and the property invariant in the PRD is **not** amended.

- **Order-independence**, which is the observable signature of the rule and fails
  against any fold:

```ts
it("composes order-independently: every Delta is measured against the same base price", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.array(deltaArb, { maxLength: 8 }),
      (priceValue, deltas) => {
        const price = priceValue as Centavos;
        expect(applyDeltas(price, [...deltas].reverse())).toBe(applyDeltas(price, deltas));
      },
    ),
  );
});
```

- **Equivalence with a multiplier-first fold while at most one multiplier is
  present.** This is the test that proves the reversal below is free; if it ever
  fails, the reversal estimate in this record is void:

```ts
it("with at most one multiplier, equals the multiplier applied to the base plus the absolutes", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.integer({ min: 1, max: 10_000 }),
      fc.array(fc.integer({ min: -100_000, max: 100_000 }), { maxLength: 8 }),
      (priceValue, perMille, absolutes) => {
        const price = priceValue as Centavos;
        const deltas: Delta[] = [
          { kind: "multiplier", perMille: perMille as PerMille },
          ...absolutes.map(
            (amountCentavos): Delta => ({
              kind: "absolute",
              amountCentavos: amountCentavos as Centavos,
            }),
          ),
        ];
        const fold = price * perMille + absolutes.reduce((sum, a) => sum + a * 1000, 0);
        expect(applyDeltas(price, deltas)).toBe(fold as Millicentavos);
      },
    ),
  );
});
```

- **The product's canonical line, as a named example** — `checkout`'s "ringing up
  a half-adobo with extra rice produces ₱75":

```ts
it("prices the canonical half-adobo with extra rice at ₱75.00", () => {
  const adobo = 12_000 as Centavos;
  const half: Delta = { kind: "multiplier", perMille: 500 as PerMille };
  const extraRice: Delta = { kind: "absolute", amountCentavos: 1_500 as Centavos };

  const line = applyDeltas(adobo, [half, extraRice]);

  expect(line).toBe(7_500_000 as Millicentavos);
  expect(roundLineTotal(line)).toBe(7_500 as Centavos);
});
```

**5. Nothing else in this lane changes.** No manifest edit, no new dependency, no
change to `Millicentavos`, `roundLineTotal`, `vatBackout`, or `parseCentavos`.

### Forward obligations — not this lane, recorded here so they are not re-decided

**`catalog` (area 3), added to its existing Delta-bounds validator** — the one that
already re-runs on every write that can invalidate bounds:

> Across a Variant's linked ModifierGroups and Add-ons, the maximum number of
> `multiplier` Deltas selectable *at the same time* must not exceed one. Counted
> as: a `required-one` or `optional-one` group contributes 1 if it holds any
> multiplier Modifier and 0 otherwise; a `many` group contributes the number of
> multiplier Modifiers it holds, capped at its maximum; a linked Add-on carrying a
> multiplier contributes its maximum quantity, defaulting to 1. Reject the write
> if the sum exceeds one.

The counting rule matters and the naive version is wrong: a *Whole ×1.0 / Half
×0.5* group holds **two** multipliers but can only ever yield one, so "at most one
multiplier anywhere on a Variant" would reject the canonical carinderia menu. Test
it with exactly that fixture.

**`checkout` (area 4), in the server-side composition re-validation it already
performs** (Security Criterion 4): reject a submitted OrderLine carrying more than
one `multiplier` Delta. This one line is the actual guarantee — the `catalog` check
exists so a manager is told at configuration time rather than a cashier at the
till.

**Adjacent, and deliberately not decided here:** because contributions are summed,
several individually-valid negative Deltas can compose to a negative line total
(₱120 base, ×0.5 and −₱70 each pass `catalog`'s per-Delta check; together they
reach −₱10). `catalog`'s bound is written per-Delta-against-base and does not catch
it. `checkout` already owns the answer — its property test requires a line total to
be a non-negative integer number of centavos — so this is a gap in where the check
runs, not an open question about the rule. It is a separate decision if anyone
disagrees with that placement.

## How to turn it back

The reversal has two halves that cost very different amounts, and the second one
is only cheap while the first is in place. That relationship is the point of the
decision.

**Reversing the guard (at most one multiplier per line) — cheap, always.**

1. Delete the selectable-multiplier count from `catalog`'s Delta-bounds validator
   and its test.
2. Delete the one-line rejection from `checkout`'s composition re-validation and
   its test.
3. No stored data changes, no migration, nothing re-prices.

**Reversing the arithmetic (contributions → chained fold) — cheap only while the
guard holds.**

1. Write a superseding record; flip this one's `Status:` to `overturned` with the
   date and reason; update both lines in `LOG.md`.
2. Edit `deltaContribution` and `applyDeltas` in
   `packages/schemas/src/money.ts` — **one function pair, one file**. Rewrite the
   three tests added above in `packages/schemas/tests/money.test.ts`.
3. Count the real call sites first: `rg -n 'applyDeltas?\(' --glob '!**/node_modules/**'`.
   Today that is 1 source file and 1 test file. It stays small by design —
   `catalog` calls it only to validate bounds, `checkout` calls it once on the
   line-total path, and **`drawer-sessions` and `reporting` never call it at all**:
   they read `Centavos` figures already stored on OrderLines and Refunds, so they
   are downstream of this decision without depending on its shape. This is why the
   reversal does not scale with the number of areas built on top.
4. **Amend `.scratch/foundation/PRD.md`, `.scratch/checkout/PRD.md`, and
   `.scratch/catalog/PRD.md`** — a fold cannot honour "no rounding at any step"
   without a wider scale, so the invariant, the per-line formula, and the
   `Centavos × per-mille` **is** `Millicentavos` sentence all become false and must
   be rewritten together. Change ADR-0005 too if the wider scale means
   `Millicentavos` is no longer the working type.
5. If step 4 means a wider type: `Millicentavos` is a wire-format and column type
   by then. That is a migration in `catalog` and `checkout` and it is the
   expensive part — count the merged migrations before promising it.

**What makes step 2 free versus ruinous.** While at most one multiplier can reach a
line, the two rules produce bit-for-bit identical results, so no Order ever sold
would have been priced differently and the ledger stays internally consistent.
Remove the guard, let a tenant configure two multipliers, sell under it — and then
switch. ADR-0005 makes a paid Order permanently uneditable, so those sales keep
their old prices forever while new ones use the new rule, with **no field
distinguishing them**. `reporting` would then aggregate two pricing regimes as one.
That is not a reversal and no amount of code fixes it afterwards. **Do not remove
the guard as a convenience; removing it is itself the decision to fork the ledger,
and it needs its own record.**

## What would make this decision wrong

- **A tenant genuinely needs two percentages on one dish and the flat-amount
  workaround does not express it.** That is the trigger to reopen — with a real
  menu in hand rather than the hypothetical, and while no sale has yet been rung
  under two-multiplier configuration, which the guard guarantees.
- **Anyone proposes modelling a `percent` Discount as a Delta.** That would put two
  multipliers on a line through the back door, and it contradicts ADR-0010, which
  made Discounts a separate typed thing precisely so this could not happen. If it
  is ever proposed, this record is the reason to refuse it.
- **The half-adobo-with-extra-rice line stops producing ₱75.00.** That example is
  in `checkout`'s required tests and in `foundation`'s PRD. If it moves, the rule
  moved with it and something re-decided this quietly.
- **The single-multiplier fold-equivalence property starts failing.** Everything in
  "How to turn it back" rests on it; a failure there voids the reversal estimate
  before it voids anything else.

## Evidence

Accessed 2026-08-01.

Repository — the documents that already answer the question:

- `.scratch/checkout/PRD.md` lines 325–330 — the per-line arithmetic, in order:
  *"Variant price / + Modifier and Add-on Deltas / − line-scoped Discount / ×
  quantity / ROUND ONCE, half-up."* This is the sentence that decides it, and
  `checkout` is the area that owns the OrderLine.
- `.scratch/catalog/PRD.md` lines 145–148 — *"Composition is defined here, applied
  in `checkout` … The two must not both implement the arithmetic."* Lines 150–154 —
  *"`Centavos × per-mille` **is** `Millicentavos`"*, with no division at all.
- `.scratch/foundation/PRD.md` lines 238–260 — the same identity, plus the
  half-adobo worked example (`₱120.00 → ×0.5 → 6000000 mc → ₱60.00`) and the
  ₱121.00 case showing two roundings landing on the wrong ₱60.50 → ₱60.00.
  Line 321 — the invariant, *"applying any sequence of Deltas yields an exact
  `Millicentavos` integer with no rounding at any step."* **It holds under the
  chosen rule and is not amended.**
- `.scratch/checkout/PRD.md` lines 548–552 — *"ringing up a half-adobo with extra
  rice produces ₱75 on screen and ₱75 in the row"* — the example that pins
  multipliers to the base rather than to a running total.
- `docs/adr/0005-money-and-order-immutability.md` lines 25–35 (Money, with both
  amendments) — rounding once per stored figure, exactly three rounded figures,
  intermediates exact `Millicentavos`, floats prohibited in every layer. Line 50 —
  `paid` is irreversible, which is what makes an un-guarded rule change a fork
  rather than a reversal. Lines 39–41 — a Delta is carried by a Modifier or an
  Add-on, and by nothing else.
- `.scratch/catalog/PRD.md` lines 210–215 (ADR-0010's boundary) — a Discount
  *"carries no stacking logic of its own"* and is a separate typed entity, not a
  Delta. This is what removes the stacked-discount scenario from this question
  entirely.
- `.scratch/foundation/issues/02-money-primitives.md` lines 64–76 — the acceptance
  criteria the added tests must not break, including *"no other workspace
  implements … Delta application."*
- `CONTEXT.md` lines 27–28 — the glossary entries for **Delta** and
  **Millicentavos**, consistent with the above.
- `.worktrees/foundation-02-money-primitives/packages/schemas/src/money.ts`
  lines 105–132 — the implementation under review. `deltaContribution` returns
  `(perMille − 1000) × price` for a multiplier, which summed onto `price × 1000`
  gives exactly `price × perMille`. Ratified unchanged.
- `.worktrees/foundation-02-money-primitives/packages/schemas/tests/money.test.ts`
  lines 143–156 — the existing sequence property asserts only integrality, which is
  why it does not pin the composition rule and why the three tests above are added.
- `.scratch/decisions/002-property-testing-for-money.md` — `fast-check` is already
  decided and available; the added properties introduce no new dependency.

External, primary sources — checked because the guard restricts a product
capability and the question was whether that capability is normal:

- <https://squareup.com/help/us/en/article/5119-create-and-manage-item-modifiers> —
  Square's official help centre. A modifier's price field takes a fixed amount,
  positive or negative; there is no percentage or multiplier option.
- <https://help.loyverse.com/help/how-set-and-apply-modifiers> and
  <https://help.loyverse.com/help/how-create-and-configure-discounts> — Loyverse,
  the product this project's `checkout` PRD benchmarks against by section number.
  Modifier options carry prices; percentages appear under **Discounts**
  (0.01%–100%), not modifiers.
- <https://loyverse.town/topic/5626-> — a Loyverse user asking for percentage
  price adjustment, i.e. the feature is absent and requested. Cited as corroborating
  colour only; a forum post is not authority and I am not treating it as one.

**Searched for and not found, where the absence mattered:**

- **No document anywhere in the repository states a chained-fold rule, or any
  ordering rule among Deltas.** The explorer swept `docs/adr/`, `docs/`,
  `.scratch/`, and `CONTEXT.md` for composition and ordering language. The only
  explicit statement is `checkout`'s per-line list. This absence is what made the
  implementer's choice necessary and what makes this record's job citation rather
  than invention.
- **No existing decision record covers Delta composition.** `001` is the database
  engine, `002` is the property-testing library. Nothing is being re-decided.
- <https://community.squareup.com/t5/Using-Square/Percentage-Multiplier-Modifier/m-p/121086>
  — a search result asserting Square staff confirmed modifiers cannot multiply an
  item's price. **I could not read it**: the thread is archived behind an OAuth
  login. I am recording that rather than quoting a claim I did not verify; the
  official help article above establishes the same fact from a source that owns it.
- Loyverse's API reference (<https://developer.loyverse.com/docs/>) would have
  given the modifier price field's *type* as first-party schema, which is stronger
  than help-centre prose. The page renders client-side and returned no content.
  The help-centre articles are what I actually established the claim on.
