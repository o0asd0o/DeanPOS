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
  sellable: boolean;
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

// One money formatter for every catalog surface (Direction prohibition 9).
// Integer arithmetic only — no float division (ADR-0005). Tabular figures at the call site.
export function formatCentavos(centavos: number): string {
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const fraction = abs % 100;
  const whole = (abs - fraction) / 100;
  const wholeGrouped = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}₱${wholeGrouped}.${fraction.toString().padStart(2, "0")}`;
}

// Editor display string without the peso sign (sign is rendered outside the input).
export function centavosToEditorString(centavos: number): string {
  const abs = Math.abs(centavos);
  const fraction = abs % 100;
  const whole = (abs - fraction) / 100;
  return `${centavos < 0 ? "-" : ""}${whole}.${fraction.toString().padStart(2, "0")}`;
}

// Stated bounds for scenario 14: strip ₱ and thousands commas, then parseCentavos.
// `₱1,200.00` → accept 120000; `120.505` / `1e3` → reject (invalid-format).
export function parsePriceInput(raw: string): ParseCentavosResult {
  const stripped = raw.trim().replace(/^₱\s*/u, "").replace(/,/g, "");
  return parseCentavos(stripped);
}
