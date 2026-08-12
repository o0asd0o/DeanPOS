export type DiscountOutput = {
  id: string;
  discountId: string;
  tenantId: string;
  name: string;
  type: "percent" | "amount";
  scope: "order" | "line";
  value: number | null;
  requiresOverride: boolean;
  vatExempt: boolean;
  requiresReference: boolean;
  referenceLabel: string | null;
  archivedAt: Date | null;
  effectiveFrom: Date;
  createdAt: Date;
  storeIds: string[];
};

export type DiscountStatus = "all" | "active" | "archived";

export const matchesSearch = (discount: DiscountOutput, query: string): boolean => {
  const term = query.trim().toLowerCase();
  return term === "" || discount.name.toLowerCase().includes(term);
};

export const statusOf = (discount: DiscountOutput): Exclude<DiscountStatus, "all"> =>
  discount.archivedAt ? "archived" : "active";

export const formatValue = (discount: DiscountOutput): string => {
  if (discount.value === null) return "Prompt at sale";
  return discount.type === "percent"
    ? `${discount.value / 100}%`
    : `₱${(discount.value / 100).toFixed(2)}`;
};
