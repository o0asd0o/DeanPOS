import {
  applyDeltas,
  roundLineTotal,
  type Centavos,
  type Delta,
} from "../../../../../packages/schemas/src/money.ts";

import type { SaleAddOn, SaleDelta, SaleModifier, SaleModifierGroup } from "./types.ts";

export type DraftLineInput = {
  menuItemId: string;
  menuItemName: string;
  variantId: string | null;
  variantName: string;
  unitPriceCentavos: number;
  quantity?: number;
  modifierIds?: string[];
  addOnIds?: string[];
};
export type DraftLine = DraftLineInput & {
  id: string;
  quantity: number;
  modifierIds: string[];
  addOnIds: string[];
  totalCentavos: number;
};
export type Draft = { id: string; lines: DraftLine[]; totalCentavos: number };

const DRAFT_KEY = "deanpos.sale.draft";
const toMoneyDelta = (delta: SaleDelta): Delta =>
  delta.kind === "absolute"
    ? { kind: "absolute", amountCentavos: delta.amountCentavos as Centavos }
    : { kind: "multiplier", perMille: delta.perMille as never };

export const composeLine = (
  line: DraftLineInput,
  modifiers: readonly SaleModifier[],
  addOns: readonly SaleAddOn[],
): Omit<DraftLine, "id"> => {
  const deltas = [
    ...modifiers.filter((m) => line.modifierIds?.includes(m.id)).map((m) => m.delta),
    ...addOns.flatMap((a) => (line.addOnIds ?? []).filter((id) => id === a.id).map(() => a.delta)),
  ];
  const quantity = line.quantity ?? 1;
  const exactUnit = applyDeltas(line.unitPriceCentavos as Centavos, deltas.map(toMoneyDelta));
  const totalCentavos = roundLineTotal((exactUnit * quantity) as never);
  if (!Number.isInteger(quantity) || quantity < 1 || totalCentavos < 0)
    throw new Error("Invalid draft line");
  return {
    ...line,
    quantity,
    modifierIds: line.modifierIds ?? [],
    addOnIds: line.addOnIds ?? [],
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
      JSON.stringify(entry.addOnIds) === JSON.stringify(line.addOnIds),
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
): Draft => {
  const updated = { ...composeLine(input, modifiers, addOns), id: lineId };
  const lines = draft.lines.map((line) => (line.id === lineId ? updated : line));
  return {
    ...draft,
    lines,
    totalCentavos: lines.reduce((sum, line) => sum + line.totalCentavos, 0),
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
