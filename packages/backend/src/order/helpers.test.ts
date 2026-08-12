import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import { computeOrderDiscountAmount } from "./helpers.ts";

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
    expect(
      computeOrderDiscountAmount(1_000, { type: "amount", value: 1_000 }),
    ).toBe(1_000);
    expect(
      computeOrderDiscountAmount(999, { type: "amount", value: 1_000 }),
    ).toBe(1_000);
  });
});
