import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import {
  addLine,
  canAddOn,
  composeLine,
  createDraft,
  defaultModifierIds,
  hasRequiredModifiers,
  removeLine,
  setLineDiscount,
  updateLine,
} from "@/features/sale/draft-store.ts";
import type { SaleAddOn, SaleModifier, SaleModifierGroup } from "@/features/sale/types.ts";

const modifier: SaleModifier = {
  id: "regular",
  name: "Regular",
  delta: { kind: "absolute", amountCentavos: 50 },
};
const group: SaleModifierGroup = {
  id: "size",
  name: "Size",
  selectionRule: "required-one",
  maximum: 1,
  defaultModifierId: "regular",
  modifiers: [modifier],
};
const rice: SaleAddOn = {
  id: "rice",
  name: "Extra rice",
  delta: { kind: "absolute", amountCentavos: 125 },
  maximum: 2,
};
const base = {
  menuItemId: "adobo",
  menuItemName: "Adobo",
  variantId: "half",
  variantName: "Half",
  unitPriceCentavos: 8_000,
};

describe("sale line composition", () => {
  it("preselects defaults, requires required groups, and caps repeated add-ons", () => {
    const ids = defaultModifierIds([group]);
    expect(ids).toEqual(["regular"]);
    expect(hasRequiredModifiers([group], ids)).toBe(true);
    expect(hasRequiredModifiers([group], [])).toBe(false);
    expect(canAddOn(rice, ["rice", "rice"])).toBe(false);
    expect(canAddOn(rice, ["rice"])).toBe(true);
  });

  it("keeps three identical items in one line and removes it", () => {
    let draft = createDraft();
    draft = addLine(draft, composeLine({ ...base, quantity: 1 }, [], []));
    draft = addLine(draft, composeLine({ ...base, quantity: 1 }, [], []));
    draft = addLine(draft, composeLine({ ...base, quantity: 1 }, [], []));
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]?.quantity).toBe(3);
    draft = removeLine(draft, draft.lines[0]!.id);
    expect(draft.lines).toHaveLength(0);
  });

  it("edits quantity and composition as distinct mutations while retaining identity", () => {
    const original = addLine(createDraft(), {
      ...composeLine({ ...base, quantity: 1 }, [modifier], []),
    });
    const lineId = original.lines[0]!.id;
    const quantityChanged = updateLine(
      original,
      lineId,
      { ...base, quantity: 3, modifierIds: ["regular"] },
      [modifier],
      [],
    );
    expect(quantityChanged.lines[0]).toMatchObject({
      id: lineId,
      quantity: 3,
      totalCentavos: 24_150,
    });
    const compositionChanged = updateLine(
      quantityChanged,
      lineId,
      { ...base, quantity: 3, modifierIds: [], addOnIds: ["rice", "rice"] },
      [],
      [rice],
    );
    expect(compositionChanged.lines[0]).toMatchObject({
      id: lineId,
      quantity: 3,
      totalCentavos: 24_750,
    });
    expect(compositionChanged.totalCentavos).toBe(24_750);
  });

  it("rounds the half-adobo plus extra rice once at the line total", () => {
    const line = composeLine({ ...base, quantity: 1, addOnIds: ["rice"] }, [], [rice]);
    expect(line.totalCentavos).toBe(8_125);
    expect(Number.isInteger(line.totalCentavos)).toBe(true);
  });

  it("does not round the unit before multiplying the line", () => {
    const line = composeLine(
      { ...base, unitPriceCentavos: 1, quantity: 3, addOnIds: ["half"] },
      [],
      [{ id: "half", name: "Half", delta: { kind: "multiplier", perMille: 1_500 }, maximum: null }],
    );
    expect(line.totalCentavos).toBe(5);
  });

  it("applies a percent line Discount before the line's single rounding", () => {
    const line = composeLine(
      { ...base, unitPriceCentavos: 201, quantity: 1, addOnIds: ["half"] },
      [],
      [{ id: "half", name: "Half", delta: { kind: "multiplier", perMille: 500 }, maximum: null }],
      { id: "senior", name: "Senior discount", type: "percent", scope: "line", value: 2_000 },
    );

    expect(line.totalCentavos).toBe(80);
    expect(line.lineDiscountId).toBe("senior");
  });

  it("applies a line Discount locally without changing another OrderLine", () => {
    let draft = createDraft();
    draft = addLine(
      draft,
      composeLine(
        { ...base, unitPriceCentavos: 201, addOnIds: ["half"] },
        [],
        [
          {
            id: "half",
            name: "Half",
            delta: { kind: "multiplier", perMille: 500 },
            maximum: null,
          },
        ],
      ),
    );
    draft = addLine(
      draft,
      composeLine({ ...base, menuItemId: "munggo", menuItemName: "Munggo" }, [], []),
    );
    const firstLineId = draft.lines[0]!.id;

    const discounted = setLineDiscount(draft, firstLineId, "senior", {
      categories: [],
      menuItems: [
        {
          id: "adobo",
          categoryId: "food",
          name: "Adobo",
          priceCentavos: 201,
          available: true,
          variants: [],
          modifierGroups: [],
          addOns: [
            {
              id: "half",
              name: "Half",
              delta: { kind: "multiplier", perMille: 500 },
              maximum: null,
            },
          ],
        },
        {
          id: "munggo",
          categoryId: "food",
          name: "Munggo",
          priceCentavos: 8_000,
          available: true,
          variants: [],
          modifierGroups: [],
          addOns: [],
        },
      ],
      paymentMethods: [],
      discounts: [
        { id: "senior", name: "Senior discount", type: "percent", scope: "line", value: 2_000 },
      ],
    });

    expect(discounted.lines.map((line) => line.totalCentavos)).toEqual([80, 8_000]);
    expect(discounted.totalCentavos).toBe(8_080);
  });

  it("property: generated non-negative integer prices and deltas produce non-negative centavos", () => {
    fc.assert(
      fc.property(fc.nat({ max: 100_000 }), fc.nat({ max: 10 }), (price, quantity) => {
        const line = composeLine(
          { ...base, unitPriceCentavos: price, quantity: quantity + 1 },
          [],
          [],
        );
        return Number.isInteger(line.totalCentavos) && line.totalCentavos >= 0;
      }),
    );
  });
});
