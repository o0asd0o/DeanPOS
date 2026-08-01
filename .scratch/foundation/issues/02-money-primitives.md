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
