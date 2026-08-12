import {
  applyDeltas,
  roundDiscountedLineTotal,
  roundLineTotal,
  type Centavos,
  type Delta,
} from "../../../../../packages/schemas/src/money.ts";

import type {
  SaleAddOn,
  SaleCatalog,
  SaleDelta,
  SaleDiscount,
  SaleModifier,
  SaleModifierGroup,
} from "./types.ts";

export type DraftLineInput = {
  menuItemId: string;
  menuItemName: string;
  variantId: string | null;
  variantName: string;
  unitPriceCentavos: number;
  quantity?: number;
  modifierIds?: string[];
  addOnIds?: string[];
  lineDiscountId?: string | null;
};
export type DraftLine = DraftLineInput & {
  id: string;
  quantity: number;
  modifierIds: string[];
  addOnIds: string[];
  totalCentavos: number;
};
export type Draft = {
  id: string;
  lines: DraftLine[];
  totalCentavos: number;
  discountId?: string | null;
  orderDeviceId?: string;
  deviceSequence?: number;
  orderNumber?: string;
};

const DRAFT_KEY = "deanpos.sale.draft";
const toMoneyDelta = (delta: SaleDelta): Delta =>
  delta.kind === "absolute"
    ? { kind: "absolute", amountCentavos: delta.amountCentavos as Centavos }
    : { kind: "multiplier", perMille: delta.perMille as never };

export const composeLine = (
  line: DraftLineInput,
  modifiers: readonly SaleModifier[],
  addOns: readonly SaleAddOn[],
  lineDiscount?: SaleDiscount | null,
): Omit<DraftLine, "id"> => {
  const deltas = [
    ...modifiers.filter((m) => line.modifierIds?.includes(m.id)).map((m) => m.delta),
    ...addOns.flatMap((a) => (line.addOnIds ?? []).filter((id) => id === a.id).map(() => a.delta)),
  ];
  const quantity = line.quantity ?? 1;
  const exactUnit = applyDeltas(line.unitPriceCentavos as Centavos, deltas.map(toMoneyDelta));
  const totalCentavos = lineDiscount
    ? roundDiscountedLineTotal(exactUnit, quantity, lineDiscount.value!)
    : roundLineTotal((exactUnit * quantity) as never);
  if (!Number.isInteger(quantity) || quantity < 1 || totalCentavos < 0)
    throw new Error("Invalid draft line");
  return {
    ...line,
    quantity,
    modifierIds: line.modifierIds ?? [],
    addOnIds: line.addOnIds ?? [],
    lineDiscountId: lineDiscount?.id ?? null,
    totalCentavos,
  };
};

export const createDraft = (): Draft => ({ id: crypto.randomUUID(), lines: [], totalCentavos: 0 });
export const addLine = (draft: Draft, line: Omit<DraftLine, "id">): Draft => {
  const existing = draft.lines.find(
    (entry) =>
      entry.menuItemId === line.menuItemId &&
      entry.variantId === line.variantId &&
      JSON.stringify(entry.modifierIds) === JSON.stringify(line.modifierIds) &&
      JSON.stringify(entry.addOnIds) === JSON.stringify(line.addOnIds) &&
      entry.lineDiscountId === line.lineDiscountId,
  );
  if (existing) {
    const lines = draft.lines.map((entry) =>
      entry.id === existing.id
        ? {
            ...entry,
            quantity: entry.quantity + line.quantity,
            totalCentavos: entry.totalCentavos + line.totalCentavos,
          }
        : entry,
    );
    return { ...draft, lines, totalCentavos: draft.totalCentavos + line.totalCentavos };
  }
  const nextLine = { ...line, id: crypto.randomUUID() };
  return {
    ...draft,
    lines: [...draft.lines, nextLine],
    totalCentavos: draft.totalCentavos + line.totalCentavos,
  };
};
export const addOptionlessLine = (
  draft: Draft,
  line: Omit<DraftLineInput, "quantity" | "modifierIds" | "addOnIds">,
): Draft => addLine(draft, composeLine(line, [], []));
export const updateLine = (
  draft: Draft,
  lineId: string,
  input: DraftLineInput,
  modifiers: readonly SaleModifier[],
  addOns: readonly SaleAddOn[],
  discounts: readonly SaleDiscount[] = [],
): Draft => {
  const lineDiscount = input.lineDiscountId
    ? discounts.find(
        (discount) =>
          discount.id === input.lineDiscountId &&
          discount.scope === "line" &&
          discount.type === "percent" &&
          discount.value !== null,
      )
    : null;
  if (input.lineDiscountId && !lineDiscount) throw new Error("Invalid line Discount");
  const updated = { ...composeLine(input, modifiers, addOns, lineDiscount), id: lineId };
  const lines = draft.lines.map((line) => (line.id === lineId ? updated : line));
  return {
    ...draft,
    lines,
    totalCentavos: lines.reduce((sum, line) => sum + line.totalCentavos, 0),
  };
};
export const setLineDiscount = (
  draft: Draft,
  lineId: string,
  discountId: string | null,
  catalog: SaleCatalog,
): Draft => {
  const line = draft.lines.find((entry) => entry.id === lineId);
  if (!line) throw new Error("Draft line not found");
  const item = catalog.menuItems.find((entry) => entry.id === line.menuItemId);
  if (!item) throw new Error("The order contains an item that is no longer available.");
  const discount = discountId
    ? (catalog.discounts ?? []).find(
        (entry) =>
          entry.id === discountId &&
          entry.scope === "line" &&
          entry.type === "percent" &&
          entry.value !== null,
      )
    : null;
  if (discountId && !discount) throw new Error("Invalid line Discount");
  const updated = {
    ...composeLine(
      { ...line, lineDiscountId: discountId },
      item.modifierGroups.flatMap((group) => group.modifiers),
      item.addOns,
      discount,
    ),
    id: line.id,
  };
  const lines = draft.lines.map((entry) => (entry.id === lineId ? updated : entry));
  return {
    ...draft,
    lines,
    totalCentavos: lines.reduce((sum, entry) => sum + entry.totalCentavos, 0),
  };
};
export const removeLine = (draft: Draft, lineId: string): Draft => {
  const lines = draft.lines.filter((line) => line.id !== lineId);
  return {
    ...draft,
    lines,
    totalCentavos: lines.reduce((sum, line) => sum + line.totalCentavos, 0),
  };
};
export const defaultModifierIds = (groups: readonly SaleModifierGroup[]): string[] =>
  groups.flatMap((group) =>
    group.defaultModifierId && group.modifiers.some((m) => m.id === group.defaultModifierId)
      ? [group.defaultModifierId]
      : [],
  );
export const hasRequiredModifiers = (
  groups: readonly SaleModifierGroup[],
  ids: readonly string[],
) =>
  groups.every(
    (group) =>
      group.selectionRule !== "required-one" ||
      ids.some((id) => group.modifiers.some((m) => m.id === id)),
  );
export const canAddOn = (addOn: SaleAddOn, ids: readonly string[]) =>
  addOn.maximum === null || ids.filter((id) => id === addOn.id).length < addOn.maximum;
export const writeDraft = (draft: Draft): void =>
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
export const readDraft = (): Draft | null => {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
};
export const clearDraft = (): void => localStorage.removeItem(DRAFT_KEY);
