import { describe, expect, it } from "vite-plus/test";

import { submitOrderInputSchema } from "./schemas.ts";

const id = "10000000-0000-4000-8000-000000000001";

const validInput = {
  id,
  lines: [
    {
      menuItemId: "10000000-0000-4000-8000-000000000002",
      menuItemName: "Adobo",
      variantId: "10000000-0000-4000-8000-000000000003",
      variantName: "Whole",
      unitPriceCentavos: 12_000,
      quantity: 2,
      lineTotalCentavos: 25_500,
      modifiers: [
        {
          id: "10000000-0000-4000-8000-000000000004",
          name: "Spicy",
          deltaKind: "absolute" as const,
          deltaValue: 0,
        },
      ],
      addOns: [
        {
          id: "10000000-0000-4000-8000-000000000005",
          name: "Extra rice",
          deltaKind: "absolute" as const,
          deltaValue: 750,
        },
      ],
    },
  ],
  totalCentavos: 25_500,
  amountTenderedCentavos: 30_000,
};

describe("submitOrderInputSchema", () => {
  it("accepts a bounded integer cash order with sale-time snapshots", () => {
    expect(submitOrderInputSchema.safeParse(validInput).success).toBe(true);
  });

  it.each([
    ["non-UUID order id", { ...validInput, id: "order-1" }],
    ["zero quantity", { ...validInput, lines: [{ ...validInput.lines[0], quantity: 0 }] }],
    ["fractional quantity", { ...validInput, lines: [{ ...validInput.lines[0], quantity: 1.5 }] }],
    ["negative tender", { ...validInput, amountTenderedCentavos: -1 }],
    ["fractional tender", { ...validInput, amountTenderedCentavos: 25_500.5 }],
    ["unsafe centavos", { ...validInput, totalCentavos: 2_147_483_648 }],
    ["empty lines", { ...validInput, lines: [] }],
  ])("rejects %s", (_label, input) => {
    expect(submitOrderInputSchema.safeParse(input).success).toBe(false);
  });
});
