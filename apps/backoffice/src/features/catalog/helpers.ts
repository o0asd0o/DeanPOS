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
