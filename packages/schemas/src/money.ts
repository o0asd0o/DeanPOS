/**
 * Money primitives for DeanPOS. Currency is PHP only (ADR-0005). Every value here is an
 * exact integer — no floating-point arithmetic anywhere in this module.
 */

/** An exact integer count of centavos (₱1 = 100 Centavos). */
export type Centavos = number & { readonly __brand: "Centavos" };

/**
 * An exact integer count of thousandths of a centavo (Centavos × 1000). The scale a
 * multiplier `Delta` lands in, so applying it never needs to divide or round.
 */
export type Millicentavos = number & { readonly __brand: "Millicentavos" };

const MILLICENTAVOS_PER_CENTAVO = 1000;

export type ParseCentavosError = "invalid-format";

export type ParseCentavosResult =
  | { readonly ok: true; readonly value: Centavos }
  | { readonly ok: false; readonly error: ParseCentavosError };

const DECIMAL_STRING = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a decimal peso string ("121.00", "10.5", "385") into `Centavos`. Total: invalid
 * input returns an error result rather than throwing.
 */
export function parseCentavos(input: string): ParseCentavosResult {
  const match = DECIMAL_STRING.exec(input.trim());
  if (!match) {
    return { ok: false, error: "invalid-format" };
  }

  const [, sign, whole, fraction = ""] = match;
  const paddedFraction = fraction.padEnd(2, "0");
  const magnitude = Number(`${whole}${paddedFraction}`);
  if (!Number.isSafeInteger(magnitude)) {
    return { ok: false, error: "invalid-format" };
  }

  const value = sign === "-" ? -magnitude : magnitude;
  return { ok: true, value: value as Centavos };
}

export function centavosToMillicentavos(centavos: Centavos): Millicentavos {
  return (centavos * MILLICENTAVOS_PER_CENTAVO) as Millicentavos;
}

/**
 * Integer division of `numerator` by `denominator`, rounded half-up, with the rounding
 * done via remainder comparison rather than float division — exact for any pair of safe
 * integers.
 */
function divideRoundHalfUp(numerator: number, denominator: number): number {
  const remainder = ((numerator % denominator) + denominator) % denominator;
  const quotient = (numerator - remainder) / denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

/**
 * Rounds a `Millicentavos` amount to the nearest `Centavos`, half-up. The only rounding
 * function in the repository (ADR-0005) — every stored money figure collapses its scale
 * exactly once, through this function.
 */
export function roundLineTotal(amount: Millicentavos): Centavos {
  return divideRoundHalfUp(amount, MILLICENTAVOS_PER_CENTAVO) as Centavos;
}

export interface VatBackout {
  readonly base: Millicentavos;
  readonly vat: Millicentavos;
}

/**
 * Backs a VAT-inclusive `total` out into its exclusive `base` and the `vat` amount, given
 * `ratePercent` (e.g. `12` for 12%). Pure on both arguments — VAT is a Tenant setting
 * captured per Order (ADR-0010), so no rate may be baked in here.
 *
 * `base` is rounded half-up to the nearest millicentavo; `vat` is then `total - base`, so
 * the pair sums back to `total` exactly, by construction.
 */
export function vatBackout(total: Millicentavos, ratePercent: number): VatBackout {
  const base = divideRoundHalfUp(total * 100, 100 + ratePercent) as Millicentavos;
  const vat = (total - base) as Millicentavos;
  return { base, vat };
}

/** An integer per-mille rate: `×0.5` is `500`, `×1.25` is `1250`. Never a fractional number. */
export type PerMille = number & { readonly __brand: "PerMille" };

/**
 * A Modifier or Add-on's price adjustment (ADR-0005). `absolute` is a flat ± centavos
 * amount; `multiplier` is an integer per-mille rate, never a JS fractional number.
 */
export type Delta =
  | { readonly kind: "absolute"; readonly amountCentavos: Centavos }
  | { readonly kind: "multiplier"; readonly perMille: PerMille };

/**
 * This Delta's contribution to a line, relative to the unmodified price expressed in
 * Millicentavos (`price * 1000`). Zero for a no-op multiplier (`perMille` 1000); the flat
 * amount for `absolute`. Exact integer arithmetic only — no division.
 */
function deltaContribution(price: Centavos, delta: Delta): Millicentavos {
  if (delta.kind === "absolute") {
    return (delta.amountCentavos * MILLICENTAVOS_PER_CENTAVO) as Millicentavos;
  }
  return ((delta.perMille - MILLICENTAVOS_PER_CENTAVO) * price) as Millicentavos;
}

/**
 * Applies a single `Delta` to `price`, returning the resulting `Millicentavos` — never
 * `Centavos`. A multiplier Delta on a Centavos price does not itself yield a Centavos: the
 * fraction must survive composition unrounded (`roundLineTotal` collapses it exactly once,
 * at the OrderLine total).
 */
export function applyDelta(price: Centavos, delta: Delta): Millicentavos {
  return applyDeltas(price, [delta]);
}

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
export function applyDeltas(price: Centavos, deltas: readonly Delta[]): Millicentavos {
  return deltas.reduce<Millicentavos>(
    (total, delta) => (total + deltaContribution(price, delta)) as Millicentavos,
    centavosToMillicentavos(price),
  );
}
