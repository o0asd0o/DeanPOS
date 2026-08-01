// Integer centavos only, no floats. See docs/adr/0005-money-and-order-immutability.md.

/** An exact integer count of centavos (₱1 = 100 Centavos). */
export type Centavos = number & { readonly __brand: "Centavos" };

/** Centavos × 1000 — the scale a multiplier `Delta` lands in, unrounded. */
export type Millicentavos = number & { readonly __brand: "Millicentavos" };

const MILLICENTAVOS_PER_CENTAVO = 1000;

export type ParseCentavosError = "invalid-format";

export type ParseCentavosResult =
  | { readonly ok: true; readonly value: Centavos }
  | { readonly ok: false; readonly error: ParseCentavosError };

const DECIMAL_STRING = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

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

// Rounds half-up via remainder comparison, no float division.
function divideRoundHalfUp(numerator: number, denominator: number): number {
  const remainder = ((numerator % denominator) + denominator) % denominator;
  const quotient = (numerator - remainder) / denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

// The only rounding function in the repository (ADR-0005) — every stored money
// figure collapses its scale exactly once, through this function.
export function roundLineTotal(amount: Millicentavos): Centavos {
  return divideRoundHalfUp(amount, MILLICENTAVOS_PER_CENTAVO) as Centavos;
}

export interface VatBackout {
  readonly base: Millicentavos;
  readonly vat: Millicentavos;
}

// VAT is a Tenant setting captured per Order (ADR-0010); no rate is baked in here.
export function vatBackout(total: Millicentavos, ratePercent: number): VatBackout {
  const base = divideRoundHalfUp(total * 100, 100 + ratePercent) as Millicentavos;
  const vat = (total - base) as Millicentavos;
  return { base, vat };
}

/** An integer per-mille rate: `×0.5` is `500`, `×1.25` is `1250`. Never a fractional number. */
export type PerMille = number & { readonly __brand: "PerMille" };

/** A Modifier or Add-on's price adjustment (ADR-0005). */
export type Delta =
  | { readonly kind: "absolute"; readonly amountCentavos: Centavos }
  | { readonly kind: "multiplier"; readonly perMille: PerMille };

// A Delta's contribution against the unmodified price, in Millicentavos.
function deltaContribution(price: Centavos, delta: Delta): Millicentavos {
  if (delta.kind === "absolute") {
    return (delta.amountCentavos * MILLICENTAVOS_PER_CENTAVO) as Millicentavos;
  }
  return ((delta.perMille - MILLICENTAVOS_PER_CENTAVO) * price) as Millicentavos;
}

export function applyDelta(price: Centavos, delta: Delta): Millicentavos {
  return applyDeltas(price, [delta]);
}

// Every Delta is measured against the same unmodified price and summed, never chained.
// At most one multiplier Delta may reach a line (enforced upstream, not here).
// See .scratch/decisions/003-delta-composition.md.
export function applyDeltas(price: Centavos, deltas: readonly Delta[]): Millicentavos {
  return deltas.reduce<Millicentavos>(
    (total, delta) => (total + deltaContribution(price, delta)) as Millicentavos,
    centavosToMillicentavos(price),
  );
}
