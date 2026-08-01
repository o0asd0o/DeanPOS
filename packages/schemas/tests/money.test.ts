import { describe, expect, it } from "vite-plus/test";
import fc from "fast-check";

import type { Centavos, Delta, Millicentavos, PerMille } from "../src/money.ts";
import {
  applyDelta,
  applyDeltas,
  centavosToMillicentavos,
  parseCentavos,
  roundLineTotal,
  vatBackout,
} from "../src/money.ts";

describe("parseCentavos", () => {
  it("parses a two-decimal peso string into centavos", () => {
    const result = parseCentavos("121.00");

    expect(result).toEqual({ ok: true, value: 12100 });
  });

  it("parses a whole-peso string with no decimal point", () => {
    const result = parseCentavos("385");

    expect(result).toEqual({ ok: true, value: 38500 });
  });

  it("pads a single fractional digit", () => {
    const result = parseCentavos("10.5");

    expect(result).toEqual({ ok: true, value: 1050 });
  });

  it("rejects a string with more than two decimal digits", () => {
    const result = parseCentavos("10.505");

    expect(result).toEqual({ ok: false, error: "invalid-format" });
  });

  it("rejects a non-numeric string", () => {
    const result = parseCentavos("abc");

    expect(result).toEqual({ ok: false, error: "invalid-format" });
  });

  it("rejects an empty string", () => {
    const result = parseCentavos("");

    expect(result).toEqual({ ok: false, error: "invalid-format" });
  });
});

describe("roundLineTotal", () => {
  it("rounds a tie up, half-up", () => {
    expect(roundLineTotal(1500 as Millicentavos)).toBe(2 as Centavos);
  });

  it("rounds down below the half-way point", () => {
    expect(roundLineTotal(1499 as Millicentavos)).toBe(1 as Centavos);
  });

  it("is idempotent: re-rounding an already-rounded value changes nothing", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000_000, max: 100_000_000 }), (mc) => {
        const once = roundLineTotal(mc as Millicentavos);
        const twice = roundLineTotal(centavosToMillicentavos(once));
        expect(twice).toBe(once);
      }),
    );
  });

  it("never drifts more than a centavo from the unrounded value", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000_000, max: 100_000_000 }), (mc) => {
        const rounded = roundLineTotal(mc as Millicentavos);
        const drift = Math.abs(rounded * 1000 - mc);
        expect(drift).toBeLessThanOrEqual(1000);
      }),
    );
  });
});

describe("vatBackout", () => {
  it("backs 12% out of ₱385.00, checkout's VAT-exempt worked example", () => {
    const total = 38_500_000 as Millicentavos;

    const { base, vat } = vatBackout(total, 12);

    expect(base).toBe(34_375_000 as Millicentavos);
    expect(vat).toBe(4_125_000 as Millicentavos);
  });

  it("sums base and vat back to the input exactly, for every total and rate", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 100 }),
        (total, ratePercent) => {
          const { base, vat } = vatBackout(total as Millicentavos, ratePercent);
          expect(base + vat).toBe(total);
        },
      ),
    );
  });

  it("re-applying the rate to base lands within one millicentavo of the input", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 100 }),
        (total, ratePercent) => {
          const { base } = vatBackout(total as Millicentavos, ratePercent);
          const reapplied = base * (100 + ratePercent);
          const drift = Math.abs(reapplied - total * 100);
          expect(drift).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});

const deltaArb = fc.oneof(
  fc
    .integer({ min: -100_000, max: 100_000 })
    .map(
      (amountCentavos): Delta => ({ kind: "absolute", amountCentavos: amountCentavos as Centavos }),
    ),
  fc
    .integer({ min: 1, max: 10_000 })
    .map((perMille): Delta => ({ kind: "multiplier", perMille: perMille as PerMille })),
);

describe("applyDelta", () => {
  it("applies a per-mille multiplier, rounding once at the end (₱121.00 × 500‰)", () => {
    const price = 12_100 as Centavos;
    const delta: Delta = { kind: "multiplier", perMille: 500 as PerMille };

    const result = applyDelta(price, delta);

    expect(result).toBe(6_050_000 as Millicentavos);
    expect(roundLineTotal(result)).toBe(6_050 as Centavos);
  });

  it("any sequence of Deltas yields an exact Millicentavos integer with no rounding at any step", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(deltaArb, { maxLength: 8 }),
        (priceValue, deltas) => {
          const price = priceValue as Centavos;
          const result = applyDeltas(price, deltas);

          expect(Number.isInteger(result)).toBe(true);
        },
      ),
    );
  });

  it("rounding that sequence once at the end never differs from the exact value by more than half a centavo", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(deltaArb, { maxLength: 8 }),
        (priceValue, deltas) => {
          const price = priceValue as Centavos;
          const exact = applyDeltas(price, deltas);
          const rounded = roundLineTotal(exact);

          const drift = Math.abs(rounded * 1000 - exact);
          expect(drift).toBeLessThanOrEqual(500);
        },
      ),
    );
  });

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

  it("prices the canonical half-adobo with extra rice at ₱75.00", () => {
    const adobo = 12_000 as Centavos;
    const half: Delta = { kind: "multiplier", perMille: 500 as PerMille };
    const extraRice: Delta = { kind: "absolute", amountCentavos: 1_500 as Centavos };

    const line = applyDeltas(adobo, [half, extraRice]);

    expect(line).toBe(7_500_000 as Millicentavos);
    expect(roundLineTotal(line)).toBe(7_500 as Centavos);
  });
});
