# 02 — Money primitives in `packages/schemas`

**Status:** ready-for-agent

## What to build

The arithmetic every money figure in DeanPOS is made of, as pure functions with no I/O, in
the one package both the server and the terminal can import. Four areas — `catalog`,
`checkout`, `drawer-sessions`, `reporting` — each independently need this, and four
reimplementations of a rounding rule is four different totals.

They live in `packages/schemas` and not in `packages/backend` because `apps/pos` computes
totals offline and must produce the same number the server would, and `packages/backend` is
server-only by ADR-0008.

What lands:

- **`Centavos`** — a branded integer. Construction from a decimal string is validated and
  total: it returns a result, never throws past a boundary, and never yields a float.
- **`roundLineTotal`** — round-half-up. The single place a fractional scale collapses to
  `Centavos`, applied exactly once per stored figure. There are **three** such figures in the
  product — the OrderLine total, the Order-scoped Discount amount, and the Refund amount — so
  the name describes the function's rule, not a single call site.
- **`vatBackout(total, ratePercent)`** — pure on **both** arguments. No global rate, no
  default, no `12` in the implementation. VAT is a Tenant setting, off by default, with a rate
  captured per Order (ADR-0010); a function closing over a constant cannot express a non-VAT
  tenant and cannot re-render a receipt from before the rate changed.

  **It takes and returns `Millicentavos`, and returns the pair `{ base, vat }`.** Two callers
  need it at that scale: `checkout` backs VAT out of an Order total for the receipt, and the
  VAT-exempt Discount path strips VAT *first* and then discounts the exclusive base as a
  millicentavo intermediate. `base` is rounded half-up **to the nearest millicentavo** because
  division by `(1 + rate)` is not generally exact, and `vat` is then `total − base`, so the
  pair always sums back to the input with no drift. Worked case from `checkout`: ₱385.00 at
  12% → `base` 34375000 mc (₱343.75).
- **`Delta`** — discriminated on `absolute` versus `multiplier`, with application logic.
  **Applying a Delta returns `Millicentavos`** (an integer at 1000× scale), not `Centavos`.
  A multiplier on an integer-centavo price produces a fraction, and `catalog` requires that
  fraction to survive composition unrounded so ADR-0005's *round once, at the OrderLine total*
  is literally true. Millicentavos keeps it exact and keeps floats out.

  **A `multiplier` is an integer per-mille rate, not a JS number.** `×0.5` is `500`, `×1.25`
  is `1250`, and `catalog`'s bound of `0 < m ≤ 10` is `0 < m ≤ 10000`. This is the encoding
  that makes Delta application exact with no division at all — `Centavos × per-mille` **is**
  `Millicentavos` — and it is required by ADR-0005, which prohibits floats in every layer
  including the wire format and IndexedDB. A rate needing more than three decimal places is
  rejected at configuration time rather than silently truncated.

Worked example, and a required test case: `₱121.00 → 12100 centavos → multiplier 500
(per-mille) → 6050000 millicentavos → rounds once → ₱60.50`. Two roundings would land on
`₱60.00`.

## Acceptance criteria

- [ ] `Centavos` is a branded integer type; a float cannot be constructed as one.
- [ ] Decimal-string construction is total — invalid input returns a result, never throws.
- [ ] `roundLineTotal` is half-up and is the only rounding function in the repository.
- [ ] `vatBackout` takes the rate as an argument; the literal `12` appears nowhere in the
      implementation, and no module-level rate constant exists.
- [ ] `vatBackout` takes and returns `Millicentavos` and returns `{ base, vat }`, with
      `base + vat === total` for every input — exact by construction, not by luck.
- [ ] A `multiplier` is carried as an integer per-mille rate; no `number` with a fractional
      part exists in the `Delta` type or on any path that applies one.
- [ ] Applying a `Delta` returns `Millicentavos`; it does **not** return `Centavos`.
- [ ] **Property tests, not examples alone:** rounding is idempotent and never drifts more
      than a centavo from the unrounded value · `vatBackout`'s two components sum exactly to
      the input for every total and rate, and re-applying the rate to `base` lands within one
      millicentavo of the input · any sequence of Deltas yields an exact `Millicentavos`
      integer with no rounding at any step · rounding that sequence once at the end never
      differs from the exact value by more than half a centavo.
- [ ] Both worked cases are asserted explicitly: `₱121.00 × per-mille 500 = ₱60.50`, and
      `₱385.00 at 12% → base ₱343.75` (`checkout`'s VAT-exempt example).
- [ ] No floating-point arithmetic anywhere in the module (ADR-0005).
- [ ] No other workspace implements rounding, VAT, or Delta application. A second `round` is
      a review finding.

## Depends on

- 01 — Monorepo skeleton and the gate

## Relevant files

- `packages/schemas/**`

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 41–45). The property deliberately NOT
asserted: that a `multiplier` Delta on a `Centavos` yields a `Centavos`. It does not._

_ADR-0008's layout line lists money primitives under `packages/backend/src/common/`. The PRD
supersedes that — the terminal computes totals offline and cannot import a server-only
package — and ADR-0008 was amended accordingly on 2026-08-01. `packages/schemas` is correct;
this note exists so a Standards reviewer does not raise it as a finding._

## Comments

**Implemented in `packages/schemas/src/money.ts`**, tested in
`packages/schemas/tests/money.test.ts`, branch `foundation-02-money-primitives`, commits
`a766bf4` and `aa91d4c` (a follow-up fixup from self-review, see below).

**Public API settled on:**

- `Centavos` and `Millicentavos` — branded `number` types (`number & { readonly __brand: ... }`),
  not `bigint`. Chosen because both stay well within `Number.isSafeInteger` range for any
  realistic peso amount, and a plain integer serializes to JSON/the wire without the
  `bigint`-specific handling a contract package would otherwise need. Per
  `.scratch/decisions/002-property-testing-for-money.md`, this choice is what fixed the
  property-test generators to `fc.integer` rather than `fc.bigInt` — later areas (`catalog`,
  `checkout`, `drawer-sessions`, `reporting`) should follow the same encoding.
- `parseCentavos(input: string): { ok: true; value: Centavos } | { ok: false; error: "invalid-format" }`
  — the total decimal-string constructor. Accepts an optional leading `-`, 0–2 fractional
  digits (padded), rejects anything else including out-of-safe-integer magnitudes.
- `centavosToMillicentavos(centavos: Centavos): Millicentavos` — exact `×1000` scale
  conversion, no rounding. Used to seed a running total and in the idempotency property test.
- `roundLineTotal(amount: Millicentavos): Centavos` — the sole half-up rounding function,
  via an integer-remainder technique (`divideRoundHalfUp`, unexported) rather than float
  division, so it stays exact for any pair of safe integers.
- `vatBackout(total: Millicentavos, ratePercent: number): { base: Millicentavos; vat: Millicentavos }`
  — pure on both arguments, no literal `12`, no module-level rate constant. `base` uses the
  same half-up integer-remainder technique against `total * 100` and `100 + ratePercent`;
  `vat` is `total - base`.
- `PerMille` — a branded integer type for the per-mille multiplier rate, matching the
  `Centavos`/`Millicentavos` brand pattern so a fractional JS number can't silently occupy
  that field.
- `Delta` — `{ kind: "absolute"; amountCentavos: Centavos } | { kind: "multiplier"; perMille: PerMille }`.
- `applyDelta(price: Centavos, delta: Delta): Millicentavos` and
  `applyDeltas(price: Centavos, deltas: readonly Delta[]): Millicentavos` — both return
  `Millicentavos`, never `Centavos`. `applyDelta` is `applyDeltas` with a one-element array.

**A design decision beyond the issue's literal text, flagged here rather than silently
assumed:** the issue specifies `applyDelta`'s single-delta behaviour precisely (matching
both worked examples) but does not specify how *multiple* Deltas on one line combine. A
naive fold that reapplies a `multiplier` Delta to an already-scaled running `Millicentavos`
total requires a division that is provably *not* always exact for two or more chained
`multiplier` Deltas (verified by hand: two chained ⅓-ish per-mille rates leave a
non-integer remainder) — that would contradict "any sequence of Deltas yields an exact
Millicentavos integer with no rounding at any step." I implemented `applyDeltas` instead as
a sum of each Delta's contribution computed independently against the same unmodified base
`price`: an `absolute` Delta contributes `amountCentavos × 1000`; a `multiplier` Delta
contributes `(perMille − 1000) × price`. This is provably exact for any sequence of any
length or composition (pure integer multiplication and addition, no division at all), and
it reduces to exactly the worked examples for the single-delta case. Later areas (`catalog`)
own the actual business rule for how an OrderLine's modifiers compose into its total; if
that rule turns out to require true multiplicative chaining rather than additive
composition, this function's internals — not its `Millicentavos`-in/`Millicentavos`-out
signature — would need to change.

**Property tests (fast-check 4.9.0, dev-only, per decision record 002):**

- `roundLineTotal` is idempotent, and never drifts more than a centavo (1000 mc) from the
  unrounded value.
- `vatBackout`'s `base + vat === total` exactly, for every `total` and `ratePercent`
  generated; re-applying the rate to `base` lands within one millicentavo of `total`.
- Any sequence of up to 8 generated Deltas (mixed `absolute`/`multiplier`) applied via
  `applyDeltas` yields an exact integer `Millicentavos` (`Number.isInteger`).
- Rounding that sequence once at the end (`roundLineTotal`) never differs from the exact
  value by more than half a centavo (500 mc).

Both worked examples from the issue are asserted as named examples: `₱121.00 × 500‰ →
6,050,000 mc → ₱60.50`, and `₱385.00 at 12% → base 34,375,000 mc (₱343.75)`.

**Gate result observed** (run in the required order, from a fresh `vp install`):

```
vp check          → pass (format, lint, types)
vp run -r check   → pass, all 10 workspaces
vp run -r test    → pass, all 10 workspaces (packages/schemas: 17 tests, 2 files)
```

**Self-check:** ran `/code-review` (Standards + Spec axes, both against `main`). Standards
axis found no hard violations; one judgement-call smell (Duplicated Code — the `deltaArb`
fast-check arbitrary was copy-pasted between the two Delta-sequence property tests). I
fixed that by hoisting it to a single module-level `const` (commit `aa91d4c`) and re-ran
the full gate, which stayed green. Spec axis found no missing, partial, or wrongly-implemented
acceptance criteria, and no scope creep; it flagged one ambiguous (not missing) item — the
issue's prose mentions rejecting a multiplier rate needing more than three decimal places
"at configuration time," but issue 02 never assigns ownership of that guard and `PerMille`
here is a brand only, with no constructor. I left this alone rather than inventing an
unrequested validator: constructing/validating tenant-entered rates reads as `catalog`'s
job (where the configuration UI and its input boundary live), not this primitives package's.

**Nothing else noticed but not folded in.**
