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
  `Centavos`, applied exactly once per stored figure.
- **`vatBackout(total, ratePercent)`** — pure on **both** arguments. No global rate, no
  default, no `12` in the implementation. VAT is a Tenant setting, off by default, with a rate
  captured per Order (ADR-0010); a function closing over a constant cannot express a non-VAT
  tenant and cannot re-render a receipt from before the rate changed.
- **`Delta`** — discriminated on `absolute` versus `multiplier`, with application logic.
  **Applying a Delta returns `Millicentavos`** (an integer at 1000× scale), not `Centavos`.
  A multiplier on an integer-centavo price produces a fraction, and `catalog` requires that
  fraction to survive composition unrounded so ADR-0005's *round once, at the OrderLine total*
  is literally true. Millicentavos keeps it exact and keeps floats out.

Worked example, and a required test case: `₱121.00 → 12100 centavos → ×0.5 → 6050000
millicentavos → rounds once → ₱60.50`. Two roundings would land on `₱60.00`.

## Acceptance criteria

- [ ] `Centavos` is a branded integer type; a float cannot be constructed as one.
- [ ] Decimal-string construction is total — invalid input returns a result, never throws.
- [ ] `roundLineTotal` is half-up and is the only rounding function in the repository.
- [ ] `vatBackout` takes the rate as an argument; the literal `12` appears nowhere in the
      implementation, and no module-level rate constant exists.
- [ ] Applying a `Delta` returns `Millicentavos`; it does **not** return `Centavos`.
- [ ] **Property tests, not examples alone:** rounding is idempotent and never drifts more
      than a centavo from the unrounded value · `vatBackout` composed with VAT application
      returns the original · any sequence of Deltas yields an exact `Millicentavos` integer
      with no rounding at any step · rounding that sequence once at the end never differs from
      the exact value by more than half a centavo.
- [ ] The `₱121.00 × 0.5 = ₱60.50` case is asserted explicitly.
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
