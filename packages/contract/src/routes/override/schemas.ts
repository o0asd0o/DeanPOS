import { z } from "zod";

export const overrideActionTypeSchema = z.enum([
  "void_paid_order",
  "refund",
  "line_price_override",
  "drawer_variance",
]);

export const overrideOutputSchema = z.object({
  id: z.string(),
  approvedAt: z.date(),
  storeId: z.string(),
  storeName: z.string(),
  actionType: overrideActionTypeSchema,
  approverName: z.string(),
  reason: z.string(),
  note: z.string().nullable(),
  deviceId: z.string(),
  deviceName: z.string(),
});
