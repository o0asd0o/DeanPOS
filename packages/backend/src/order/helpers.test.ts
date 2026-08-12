import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import { computeDiscountedLineTotal, computeOrderDiscountAmount } from "./helpers.ts";

describe("computeOrderDiscountAmount", () => {
  it("rounds percent discounts half-up once and never lets a discount exceed its subtotal", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_147_483_647 }),
        fc.integer({ min: 0, max: 10_000 }),
        (subtotalCentavos, perTenThousand) => {
          const discountCentavos = computeOrderDiscountAmount(subtotalCentavos, {
            type: "percent",
            value: perTenThousand,
          });

          expect(discountCentavos).toBe(
            Math.floor((subtotalCentavos * perTenThousand + 5_000) / 10_000),
          );
          expect(subtotalCentavos - discountCentavos).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it("uses an amount discount as its stored figure only when it cannot exceed the subtotal", () => {
    expect(computeOrderDiscountAmount(1_000, { type: "amount", value: 1_000 })).toBe(1_000);
    expect(computeOrderDiscountAmount(999, { type: "amount", value: 1_000 })).toBe(1_000);
  });
});

describe("computeDiscountedLineTotal", () => {
  it("discounts the unrounded millicentavo amount before the line's only half-up rounding", () => {
    expect(computeDiscountedLineTotal(100_500, 1, 2_000)).toBe(80);
  });

  it("applies quantity before the one stored-figure rounding", () => {
    expect(computeDiscountedLineTotal(100_500, 3, 2_000)).toBe(241);
  });

  it("property: rounds only the discounted line total and the Order-scoped Discount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (exactUnit, quantity, lineRate, orderRate) => {
          const lineDenominator = 10_000_000n;
          const expectedLine = Number(
            (BigInt(exactUnit) * BigInt(quantity) * BigInt(10_000 - lineRate) +
              lineDenominator / 2n) /
              lineDenominator,
          );
          const lineTotal = computeDiscountedLineTotal(exactUnit, quantity, lineRate);
          const orderDiscount = computeOrderDiscountAmount(lineTotal, {
            type: "percent",
            value: orderRate,
          });
          const orderTotal = lineTotal - orderDiscount;

          expect(lineTotal).toBe(expectedLine);
          expect(orderTotal).toBe(lineTotal - Math.floor((lineTotal * orderRate + 5_000) / 10_000));
          expect(Number.isInteger(lineTotal)).toBe(true);
          expect(Number.isInteger(orderTotal)).toBe(true);
        },
      ),
    );
  });
});
