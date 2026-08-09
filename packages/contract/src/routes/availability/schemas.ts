import { z } from "zod";

export const availabilityTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("variant"), id: z.string() }),
  z.object({ kind: z.literal("menuItem"), id: z.string() }),
]);
export const availabilitySetInputSchema = z.object({
  storeId: z.string(),
  changes: z.array(z.object({ target: availabilityTargetSchema, available: z.boolean() })),
});
export const availabilityListInputSchema = z.object({
  storeId: z.string(),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  sort: z
    .object({
      key: z.enum(["name", "menuItem", "price", "available"]),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
});
export const availabilityRowSchema = z.object({
  kind: z.enum(["variant", "menuItem"]),
  id: z.string(),
  name: z.string(),
  menuItemName: z.string().nullable(),
  priceCentavos: z.number().int(),
  available: z.boolean(),
});
export const availabilityPageSchema = z.object({
  items: z.array(availabilityRowSchema),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
  unavailableInScope: z.array(availabilityTargetSchema),
});
