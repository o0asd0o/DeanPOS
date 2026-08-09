import { describe, expect, it } from "vitest";

import {
  catalogAddOnCreateInputSchema,
  catalogReadMenuItemSchema,
} from "./schemas.ts";

describe("catalog add-on contract", () => {
  it("accepts a bounded add-on and exposes item add-ons in the terminal payload", () => {
    expect(
      catalogAddOnCreateInputSchema.parse({
        name: "Extra rice",
        delta: { kind: "absolute", amountCentavos: 1500 },
        maximum: 2,
      }),
    ).toMatchObject({ maximum: 2 });

    expect(
      catalogReadMenuItemSchema.safeParse({
        id: "item-1",
        tenantId: "tenant-1",
        categoryId: "category-1",
        name: "Rice meal",
        priceCentavos: 12_000,
        sortOrder: 0,
        modifierGroups: [],
        addOns: [
          {
            id: "addon-1",
            name: "Extra rice",
            delta: { kind: "absolute", amountCentavos: 1500 },
            maximum: 2,
            sortOrder: 0,
          },
        ],
        variants: [],
      }).success,
    ).toBe(true);
  });

  it("rejects zero maximum quantity", () => {
    expect(
      catalogAddOnCreateInputSchema.safeParse({
        name: "Extra rice",
        delta: { kind: "absolute", amountCentavos: 1500 },
        maximum: 0,
      }).success,
    ).toBe(false);
  });
});
