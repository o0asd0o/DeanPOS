// Configuration-time Delta bounds for Modifier / Add-on editors.
// Application returns Millicentavos and must NOT round here — fraction survives
// composition exactly; checkout's roundLineTotal collapses scale once at the
// OrderLine total (ADR-0005). An earlier foundation draft asserted the opposite.
import type { Centavos, Delta, PerMille } from "schemas/src/money.ts";

/** Inclusive absolute bound in centavos (±₱1,000.00). */
export const ABSOLUTE_DELTA_MAX_CENTAVOS = 100_000;

/** Multiplier per-mille: exclusive lower bound (0 is rejected). */
export const MULTIPLIER_PER_MILLE_MIN = 1;

/** Multiplier per-mille: inclusive upper bound (×10.000). */
export const MULTIPLIER_PER_MILLE_MAX = 10_000;

export type DeltaConfigError =
  | "absolute-out-of-bounds"
  | "multiplier-out-of-bounds"
  | "multiplier-too-precise"
  | "invalid-kind";

export type DeltaConfigResult =
  | { readonly ok: true; readonly delta: Delta }
  | { readonly ok: false; readonly error: DeltaConfigError };

export type AbsoluteDeltaInput = {
  readonly kind: "absolute";
  /** Integer centavos — never a float. */
  readonly amountCentavos: number;
};

export type MultiplierDeltaInput = {
  readonly kind: "multiplier";
  /**
   * Integer per-mille rate: ×0.5 → 500, ×1.25 → 1250.
   * Prefer this over a decimal rate string when the wire already carries per-mille.
   */
  readonly perMille: number;
};

export type MultiplierRateStringInput = {
  readonly kind: "multiplier";
  /**
   * Human rate string such as "0.5" or "1.25". More than three fractional
   * digits is rejected, never truncated (issue 03).
   */
  readonly rate: string;
};

export type DeltaConfigInput =
  | AbsoluteDeltaInput
  | MultiplierDeltaInput
  | MultiplierRateStringInput;

const RATE_STRING = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Parse a decimal rate string into per-mille without floats.
 * "0.5" → 500, "1.25" → 1250, "1.234" → 1234.
 * More than three fractional digits → too-precise.
 */
export function rateStringToPerMille(
  rate: string,
): { ok: true; perMille: number } | { ok: false; error: DeltaConfigError } {
  const match = RATE_STRING.exec(rate.trim());
  if (!match) {
    return { ok: false, error: "multiplier-out-of-bounds" };
  }
  const [, sign, whole, fraction = ""] = match;
  if (sign === "-") {
    return { ok: false, error: "multiplier-out-of-bounds" };
  }
  if (fraction.length > 3) {
    return { ok: false, error: "multiplier-too-precise" };
  }
  const padded = fraction.padEnd(3, "0");
  const perMille = Number(`${whole}${padded}`);
  if (!Number.isSafeInteger(perMille)) {
    return { ok: false, error: "multiplier-out-of-bounds" };
  }
  return { ok: true, perMille };
}

export function validateDeltaConfig(input: DeltaConfigInput): DeltaConfigResult {
  if (input.kind === "absolute") {
    const amount = input.amountCentavos;
    if (!Number.isInteger(amount)) {
      return { ok: false, error: "absolute-out-of-bounds" };
    }
    if (amount < -ABSOLUTE_DELTA_MAX_CENTAVOS || amount > ABSOLUTE_DELTA_MAX_CENTAVOS) {
      return { ok: false, error: "absolute-out-of-bounds" };
    }
    return {
      ok: true,
      delta: { kind: "absolute", amountCentavos: amount as Centavos },
    };
  }

  if (input.kind !== "multiplier") {
    return { ok: false, error: "invalid-kind" };
  }

  let perMille: number;
  if ("rate" in input) {
    const parsed = rateStringToPerMille(input.rate);
    if (!parsed.ok) return parsed;
    perMille = parsed.perMille;
  } else {
    perMille = input.perMille;
    if (!Number.isInteger(perMille)) {
      return { ok: false, error: "multiplier-out-of-bounds" };
    }
  }

  // 0, negative, and >10000 rejected; 10000 (×10) accepted.
  if (perMille < MULTIPLIER_PER_MILLE_MIN || perMille > MULTIPLIER_PER_MILLE_MAX) {
    return { ok: false, error: "multiplier-out-of-bounds" };
  }

  return {
    ok: true,
    delta: { kind: "multiplier", perMille: perMille as PerMille },
  };
}

/** Stored columns → domain Delta. Kind is the stored discriminator, never inferred. */
export function deltaFromStored(kind: "absolute" | "multiplier", value: number): DeltaConfigResult {
  if (kind === "absolute") {
    return validateDeltaConfig({ kind: "absolute", amountCentavos: value });
  }
  if (kind === "multiplier") {
    return validateDeltaConfig({ kind: "multiplier", perMille: value });
  }
  return { ok: false, error: "invalid-kind" };
}

export function deltaToStored(delta: Delta): { kind: "absolute" | "multiplier"; value: number } {
  if (delta.kind === "absolute") {
    return { kind: "absolute", value: delta.amountCentavos };
  }
  return { kind: "multiplier", value: delta.perMille };
}
