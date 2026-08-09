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

// Seed suggestions on the Name field, not a fixed enum
// (record 054 §"Smaller calls" 5) — nothing downstream branches on these.
export const PAYMENT_METHOD_NAME_PRESETS = ["Card", "GCash", "Maya", "Bank transfer"];

export type Store = { id: string; name: string };

// The Store names a method is actually offered at — the active ones it holds
// a join row for. `cash` is offered everywhere and holds no rows (record 054
// §"Smaller calls" 3).
export function availableStores(method: PaymentMethodOutput, stores: Store[]): Store[] {
  if (method.kind === "cash") return stores;
  const assigned = new Set(method.storeIds);
  return stores.filter((store) => assigned.has(store.id));
}

// What the Available at column already computes, named: whether a cashier can
// take money with this method anywhere. `nostores` is the one the lifecycle
// badge hides — active, and reaching no till at all.
export type PaymentMethodReach = "live" | "nostores" | "deactivated";

export function paymentMethodReach(
  method: PaymentMethodOutput,
  stores: Store[],
): PaymentMethodReach {
  if (!method.active) return "deactivated";
  return availableStores(method, stores).length > 0 ? "live" : "nostores";
}

// Search covers what a reader would type looking for a method: its own name,
// the kind, and the Stores it is offered at.
export function matchesSearch(method: PaymentMethodOutput, stores: Store[], term: string): boolean {
  if (term === "") return true;
  const haystack = [
    method.name,
    method.kind === "cash" ? "cash" : "recorded",
    ...availableStores(method, stores).map((store) => store.name),
  ];
  return haystack.some((value) => value.toLowerCase().includes(term));
}
