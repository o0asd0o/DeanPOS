// Mirrors `overrideOutputSchema` in packages/contract/src/contract.ts. Not
// inferred from the zod schema — `zod` is not a dependency of this app.
export type OverrideOutput = {
  id: string;
  approvedAt: Date;
  storeId: string;
  storeName: string;
  actionType: "void_paid_order" | "refund" | "line_price_override" | "drawer_variance";
  approverName: string;
  reason: string;
  note: string | null;
  deviceId: string;
  deviceName: string;
};

export const ACTION_TYPE_LABEL: Record<OverrideOutput["actionType"], string> = {
  void_paid_order: "Void paid order",
  refund: "Refund",
  line_price_override: "Line price override",
  drawer_variance: "Drawer variance",
};
