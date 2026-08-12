import { describe, expect, it } from "vite-plus/test";

import { buildSubmitOrderInput } from "@/features/payment/use-submit-order.ts";

describe("buildSubmitOrderInput", () => {
  it("resolves repeated sale-time option snapshots from the Draft and SaleCatalog", () => {
    const modifierId = "10000000-0000-4000-8000-000000000004";
    const addOnId = "10000000-0000-4000-8000-000000000005";
    const draft = {
      id: "10000000-0000-4000-8000-000000000001",
      orderDeviceId: "device-a",
      deviceSequence: 421,
      orderNumber: "C2-0421",
      discountId: null,
      lines: [
        {
          id: "draft-line",
          menuItemId: "10000000-0000-4000-8000-000000000002",
          menuItemName: "Adobo",
          variantId: "10000000-0000-4000-8000-000000000003",
          variantName: "Whole",
          unitPriceCentavos: 12_000,
          quantity: 2,
          modifierIds: [modifierId],
          addOnIds: [addOnId, addOnId],
          totalCentavos: 27_000,
        },
      ],
      totalCentavos: 27_000,
    };
    const catalog = {
      categories: [{ id: "food", name: "Food" }],
      menuItems: [
        {
          id: draft.lines[0].menuItemId,
          categoryId: "food",
          name: "Adobo",
          priceCentavos: 12_000,
          available: true,
          variants: [
            {
              id: draft.lines[0].variantId,
              name: "Whole",
              priceCentavos: 12_000,
              available: true,
            },
          ],
          modifierGroups: [
            {
              id: "group",
              name: "Heat",
              selectionRule: "required-one" as const,
              maximum: 1,
              defaultModifierId: modifierId,
              modifiers: [
                {
                  id: modifierId,
                  name: "Spicy",
                  delta: { kind: "absolute" as const, amountCentavos: 0 },
                },
              ],
            },
          ],
          addOns: [
            {
              id: addOnId,
              name: "Extra rice",
              delta: { kind: "absolute" as const, amountCentavos: 750 },
              maximum: 2,
            },
          ],
        },
      ],
      paymentMethods: [
        {
          id: "10000000-0000-4000-8000-000000000007",
          name: "Cash",
          kind: "cash" as const,
        },
      ],
    };

    expect(
      buildSubmitOrderInput(
        draft,
        catalog,
        "10000000-0000-4000-8000-000000000007",
        30_000,
        "10000000-0000-4000-8000-000000000006",
      ),
    ).toEqual({
      id: draft.id,
      paymentMethodId: "10000000-0000-4000-8000-000000000007",
      cashierUserId: "10000000-0000-4000-8000-000000000006",
      deviceSequence: 421,
      orderNumber: "C2-0421",
      discountId: null,
      lines: [
        {
          menuItemId: draft.lines[0].menuItemId,
          menuItemName: "Adobo",
          variantId: draft.lines[0].variantId,
          variantName: "Whole",
          unitPriceCentavos: 12_000,
          quantity: 2,
          lineTotalCentavos: 27_000,
          modifiers: [{ id: modifierId, name: "Spicy", deltaKind: "absolute", deltaValue: 0 }],
          addOns: [
            { id: addOnId, name: "Extra rice", deltaKind: "absolute", deltaValue: 750 },
            { id: addOnId, name: "Extra rice", deltaKind: "absolute", deltaValue: 750 },
          ],
        },
      ],
      totalCentavos: 27_000,
      amountTenderedCentavos: 30_000,
    });
  });

  it("submits the selected Discount id and its discounted Order total", () => {
    const discountId = "10000000-0000-4000-8000-000000000008";
    const draft = {
      id: "10000000-0000-4000-8000-000000000001",
      deviceSequence: 422,
      orderNumber: "C2-0422",
      discountId,
      lines: [
        {
          id: "draft-line",
          menuItemId: "10000000-0000-4000-8000-000000000002",
          menuItemName: "Adobo",
          variantId: null,
          variantName: "",
          unitPriceCentavos: 27_000,
          quantity: 1,
          modifierIds: [],
          addOnIds: [],
          totalCentavos: 27_000,
        },
      ],
      totalCentavos: 27_000,
    };
    const input = buildSubmitOrderInput(
      draft,
      {
        categories: [],
        menuItems: [
          {
            id: draft.lines[0].menuItemId,
            categoryId: "food",
            name: "Adobo",
            priceCentavos: 27_000,
            available: true,
            variants: [],
            modifierGroups: [],
            addOns: [],
          },
        ],
        paymentMethods: [
          {
            id: "10000000-0000-4000-8000-000000000007",
            name: "Cash",
            kind: "cash",
          },
        ],
        discounts: [
          {
            id: discountId,
            name: "Senior Discount",
            type: "percent",
            scope: "order",
            value: 2_200,
          },
        ],
      },
      "10000000-0000-4000-8000-000000000007",
      21_060,
      "10000000-0000-4000-8000-000000000006",
    );

    expect(input.discountId).toBe(discountId);
    expect(input.totalCentavos).toBe(21_060);
    expect(input.amountTenderedCentavos).toBe(21_060);
  });
});
