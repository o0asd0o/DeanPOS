// Mirrors `paymentMethodOutputSchema` in packages/contract/src/contract.ts.
// Not inferred from the zod schema — `zod` is not a dependency of this app,
// and duplicating this one shape is cheaper than adding it.
export type PaymentMethodOutput = {
  id: string;
  tenantId: string;
  name: string;
  kind: "cash" | "recorded";
  active: boolean;
  createdAt: Date;
  storeIds: string[];
};

// Seed suggestions on the Name field's `<datalist>`, not a fixed enum
// (record 054 §"Smaller calls" 5) — nothing downstream branches on these.
export const PAYMENT_METHOD_NAME_PRESETS = ["Card", "GCash", "Maya", "Bank transfer"];

// `Available at` collapses a Store set into one column (record 054 Q2): the
// available Store names comma-separated, `All stores`, or `None`.
export function availableAtLabel(
  storeIds: string[],
  stores: { id: string; name: string }[],
): string {
  if (storeIds.length === 0) return "None";
  const assigned = new Set(storeIds);
  const activeStoreIds = stores.map((store) => store.id);
  if (activeStoreIds.length > 0 && activeStoreIds.every((id) => assigned.has(id)))
    return "All stores";
  const names = stores.filter((store) => assigned.has(store.id)).map((store) => store.name);
  return names.length > 0 ? names.join(", ") : "None";
}
