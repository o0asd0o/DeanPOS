import { parseCentavos, type ParseCentavosResult } from "schemas/src/money.ts";

// Mirrors catalog output schemas in packages/contract. Zod is not a BO dependency.
export type CategoryOutput = {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
};

export type MenuItemOutput = CategoryOutput & {
  categoryId: string;
  priceCentavos: number;
};

export type VariantOutput = {
  id: string;
  tenantId: string;
  menuItemId: string;
  name: string;
  priceCentavos: number;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
};

// Backend reorder is neighbour-swap only; drag maps to N sequential swaps.
export const reorderSteps = (
  fromIndex: number,
  toIndex: number,
): { direction: "up" | "down"; steps: number } | null => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return null;
  return {
    direction: toIndex > fromIndex ? "down" : "up",
    steps: Math.abs(toIndex - fromIndex),
  };
};

export { centavosToEditorString, formatCentavos } from "@/lib/money.ts";

// Stated bounds for scenario 14: strip ₱ and thousands commas, then parseCentavos.
// `₱1,200.00` → accept 120000; `120.505` / `1e3` → reject (invalid-format).
export function parsePriceInput(raw: string): ParseCentavosResult {
  const stripped = raw
    .trim()
    .replace(/^₱\s*/u, "")
    .replace(/,/g, "");
  return parseCentavos(stripped);
}
