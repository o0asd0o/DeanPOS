export type DraftLine = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  variantId: string;
  variantName: string;
  unitPriceCentavos: number;
};

export type Draft = {
  id: string;
  lines: DraftLine[];
  totalCentavos: number;
};

const DRAFT_KEY = "deanpos.sale.draft";

export const createDraft = (): Draft => ({ id: crypto.randomUUID(), lines: [], totalCentavos: 0 });

export const addOptionlessLine = (draft: Draft, line: Omit<DraftLine, "id">): Draft => {
  const nextLine = { ...line, id: crypto.randomUUID() };
  return {
    ...draft,
    lines: [...draft.lines, nextLine],
    totalCentavos: draft.totalCentavos + line.unitPriceCentavos,
  };
};

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
