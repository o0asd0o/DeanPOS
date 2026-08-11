import {
  applyDeltas,
  roundLineTotal,
  type Centavos,
  type Delta,
  type Millicentavos,
} from "schemas/src/money.ts";

type Snapshot = {
  id: string;
  deltaKind: "absolute" | "multiplier";
  deltaValue: number;
};

type SubmittedLine = {
  menuItemId: string;
  variantId: string | null;
  unitPriceCentavos: number;
  quantity: number;
  lineTotalCentavos: number;
  modifiers: Snapshot[];
  addOns: Snapshot[];
};

type CatalogModifier = { id: string };
type CatalogModifierGroup = {
  selectionRule: "required-one" | "optional-one" | "many";
  maximum: number | null;
  modifiers: CatalogModifier[];
};
type CatalogAddOn = { id: string; maximum: number | null };
type CatalogItem = {
  id: string;
  available: boolean;
  variants: { id: string; available: boolean }[];
  modifierGroups: CatalogModifierGroup[];
  addOns: CatalogAddOn[];
};

const toDelta = (snapshot: Snapshot): Delta =>
  snapshot.deltaKind === "absolute"
    ? { kind: "absolute", amountCentavos: snapshot.deltaValue as Centavos }
    : { kind: "multiplier", perMille: snapshot.deltaValue as never };

export function isValidSubmittedLine(line: SubmittedLine, item: CatalogItem): boolean {
  if (item.id !== line.menuItemId || !item.available) return false;
  if (
    line.variantId !== null &&
    !item.variants.some((variant) => variant.id === line.variantId && variant.available)
  ) {
    return false;
  }

  const linkedModifierIds = new Set(
    item.modifierGroups.flatMap((group) => group.modifiers.map((modifier) => modifier.id)),
  );
  if (line.modifiers.some((modifier) => !linkedModifierIds.has(modifier.id))) return false;

  for (const group of item.modifierGroups) {
    const ids = new Set(group.modifiers.map((modifier) => modifier.id));
    const selected = line.modifiers.filter((modifier) => ids.has(modifier.id)).length;
    if (group.selectionRule === "required-one" && selected !== 1) return false;
    if (group.selectionRule === "optional-one" && selected > 1) return false;
    if (group.selectionRule === "many" && group.maximum !== null && selected > group.maximum) {
      return false;
    }
  }

  const addOnsById = new Map(item.addOns.map((addOn) => [addOn.id, addOn]));
  for (const addOn of line.addOns) {
    if (!addOnsById.has(addOn.id)) return false;
  }
  for (const addOn of item.addOns) {
    const selected = line.addOns.filter((snapshot) => snapshot.id === addOn.id).length;
    if (addOn.maximum !== null && selected > addOn.maximum) return false;
  }

  const exactUnit = applyDeltas(
    line.unitPriceCentavos as Centavos,
    [...line.modifiers, ...line.addOns].map(toDelta),
  );
  const computedTotal = roundLineTotal((exactUnit * line.quantity) as Millicentavos);
  return computedTotal === line.lineTotalCentavos;
}
