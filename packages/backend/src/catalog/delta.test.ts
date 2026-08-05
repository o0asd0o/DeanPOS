import fc from "fast-check";
import type { Centavos, Delta, Millicentavos, PerMille } from "schemas/src/money.ts";
import { applyDelta, roundLineTotal } from "schemas/src/money.ts";
import { describe, expect, it } from "vite-plus/test";

import {
  ABSOLUTE_DELTA_MAX_CENTAVOS,
  MULTIPLIER_PER_MILLE_MAX,
  MULTIPLIER_PER_MILLE_MIN,
  deltaFromStored,
  deltaToStored,
  rateStringToPerMille,
  validateDeltaConfig,
} from "./delta.ts";

describe("validateDeltaConfig — absolute", () => {
  it("accepts the inclusive ±100_000 centavos bounds", () => {
    expect(validateDeltaConfig({ kind: "absolute", amountCentavos: ABSOLUTE_DELTA_MAX_CENTAVOS }).ok).toBe(
      true,
    );
    expect(
      validateDeltaConfig({ kind: "absolute", amountCentavos: -ABSOLUTE_DELTA_MAX_CENTAVOS }).ok,
    ).toBe(true);
    expect(validateDeltaConfig({ kind: "absolute", amountCentavos: 0 }).ok).toBe(true);
  });

  it("rejects outside ±100_000 and non-integers", () => {
    expect(
      validateDeltaConfig({ kind: "absolute", amountCentavos: ABSOLUTE_DELTA_MAX_CENTAVOS + 1 }),
    ).toEqual({ ok: false, error: "absolute-out-of-bounds" });
    expect(
      validateDeltaConfig({ kind: "absolute", amountCentavos: -ABSOLUTE_DELTA_MAX_CENTAVOS - 1 }),
    ).toEqual({ ok: false, error: "absolute-out-of-bounds" });
    expect(validateDeltaConfig({ kind: "absolute", amountCentavos: 1.5 })).toEqual({
      ok: false,
      error: "absolute-out-of-bounds",
    });
  });
});

describe("validateDeltaConfig — multiplier per-mille", () => {
  it("rejects 0, negative, and 10001; accepts 1 and 10000", () => {
    expect(validateDeltaConfig({ kind: "multiplier", perMille: 0 })).toEqual({
      ok: false,
      error: "multiplier-out-of-bounds",
    });
    expect(validateDeltaConfig({ kind: "multiplier", perMille: -1 })).toEqual({
      ok: false,
      error: "multiplier-out-of-bounds",
    });
    expect(validateDeltaConfig({ kind: "multiplier", perMille: 10_001 })).toEqual({
      ok: false,
      error: "multiplier-out-of-bounds",
    });
    expect(validateDeltaConfig({ kind: "multiplier", perMille: MULTIPLIER_PER_MILLE_MIN }).ok).toBe(
      true,
    );
    expect(validateDeltaConfig({ kind: "multiplier", perMille: MULTIPLIER_PER_MILLE_MAX }).ok).toBe(
      true,
    );
    expect(validateDeltaConfig({ kind: "multiplier", perMille: 500 }).ok).toBe(true);
  });

  it("rejects a non-integer per-mille", () => {
    expect(validateDeltaConfig({ kind: "multiplier", perMille: 500.5 })).toEqual({
      ok: false,
      error: "multiplier-out-of-bounds",
    });
  });
});

describe("rateStringToPerMille — three decimal places max", () => {
  it("maps known rates without floats", () => {
    expect(rateStringToPerMille("0.5")).toEqual({ ok: true, perMille: 500 });
    expect(rateStringToPerMille("1.25")).toEqual({ ok: true, perMille: 1250 });
    expect(rateStringToPerMille("1")).toEqual({ ok: true, perMille: 1000 });
    expect(rateStringToPerMille("1.234")).toEqual({ ok: true, perMille: 1234 });
  });

  it("rejects more than three fractional digits rather than truncating", () => {
    expect(rateStringToPerMille("1.2345")).toEqual({ ok: false, error: "multiplier-too-precise" });
    expect(rateStringToPerMille("0.5001")).toEqual({ ok: false, error: "multiplier-too-precise" });
  });

  it("rejects negatives", () => {
    expect(rateStringToPerMille("-0.5")).toEqual({ ok: false, error: "multiplier-out-of-bounds" });
  });
});

describe("validateDeltaConfig property — pure against foundation money", () => {
  it("every accepted absolute Delta round-trips through storage and applyDelta stays integer Millicentavos", () => {
    fc.assert(
      fc.property(fc.integer({ min: -ABSOLUTE_DELTA_MAX_CENTAVOS, max: ABSOLUTE_DELTA_MAX_CENTAVOS }), (amount) => {
        const configured = validateDeltaConfig({ kind: "absolute", amountCentavos: amount });
        expect(configured.ok).toBe(true);
        if (!configured.ok) return;

        const stored = deltaToStored(configured.delta);
        expect(stored.kind).toBe("absolute");
        expect(Number.isInteger(stored.value)).toBe(true);

        const restored = deltaFromStored(stored.kind, stored.value);
        expect(restored.ok).toBe(true);
        if (!restored.ok) return;
        expect(restored.delta).toEqual(configured.delta);

        const price = 12_100 as Centavos;
        const millicentavos = applyDelta(price, restored.delta);
        expect(Number.isInteger(millicentavos)).toBe(true);
        // Do not round at the modifier — only at line total.
        const rounded = roundLineTotal(millicentavos as Millicentavos);
        expect(Number.isInteger(rounded)).toBe(true);
      }),
    );
  });

  it("every accepted multiplier per-mille applies exactly as Centavos × per-mille scale without float", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MULTIPLIER_PER_MILLE_MIN, max: MULTIPLIER_PER_MILLE_MAX }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (perMille, priceValue) => {
          const configured = validateDeltaConfig({ kind: "multiplier", perMille });
          expect(configured.ok).toBe(true);
          if (!configured.ok) return;

          const price = priceValue as Centavos;
          const result = applyDelta(price, configured.delta as Delta);
          // applyDelta for multiplier: ((perMille - 1000) * price) + price*1000 = perMille * price
          // in millicentavos contribution form — result is integer.
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBe((perMille * price) as Millicentavos);
        },
      ),
    );
  });

  it("bounds are sharp: just outside the accepted ranges always fail", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: ABSOLUTE_DELTA_MAX_CENTAVOS + 1, max: ABSOLUTE_DELTA_MAX_CENTAVOS + 10_000 }),
          fc.integer({ min: -ABSOLUTE_DELTA_MAX_CENTAVOS - 10_000, max: -ABSOLUTE_DELTA_MAX_CENTAVOS - 1 }),
        ),
        (amount) => {
          expect(validateDeltaConfig({ kind: "absolute", amountCentavos: amount }).ok).toBe(false);
        },
      ),
    );

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.integer({ min: -10_000, max: -1 }),
          fc.integer({ min: MULTIPLIER_PER_MILLE_MAX + 1, max: MULTIPLIER_PER_MILLE_MAX + 10_000 }),
        ),
        (perMille) => {
          expect(validateDeltaConfig({ kind: "multiplier", perMille }).ok).toBe(false);
        },
      ),
    );
  });

  it("accepted deltas never introduce a float on the wire shape (stored value is int)", () => {
    const deltaArb = fc.oneof(
      fc.integer({ min: -ABSOLUTE_DELTA_MAX_CENTAVOS, max: ABSOLUTE_DELTA_MAX_CENTAVOS }).map(
        (amountCentavos): Delta => ({ kind: "absolute", amountCentavos: amountCentavos as Centavos }),
      ),
      fc
        .integer({ min: MULTIPLIER_PER_MILLE_MIN, max: MULTIPLIER_PER_MILLE_MAX })
        .map((perMille): Delta => ({ kind: "multiplier", perMille: perMille as PerMille })),
    );

    fc.assert(
      fc.property(deltaArb, (delta) => {
        const stored = deltaToStored(delta);
        expect(Number.isInteger(stored.value)).toBe(true);
        expect(typeof stored.value).toBe("number");
        expect(Number.isFinite(stored.value)).toBe(true);
      }),
    );
  });
});
