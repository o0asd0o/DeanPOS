import { z } from "zod";

// `HH:mm`, 24-hour, 00:00-23:59 (record 040 §2): enforced here, not just
// accepted as any non-empty string, and backed by a DB check constraint
// since the schema alone is not the authority.
const businessDayStartSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:mm, 00:00-23:59");

export const storeOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  businessDayStart: businessDayStartSchema,
  // Ordered; duplicates permitted (issue 05, ADR-0011).
  tableLabels: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.date(),
});

// Shared by store.create and store.update — the editor always saves name,
// business-day start and the whole label array together (record 040 §3).
export const storeFieldsInputSchema = z.object({
  name: z.string().min(1),
  businessDayStart: businessDayStartSchema,
  tableLabels: z.array(z.string()),
});

export const storeCreateInputSchema = storeFieldsInputSchema;
export const storeUpdateInputSchema = storeFieldsInputSchema.extend({ id: z.string() });
export const storeIdInputSchema = z.object({ id: z.string() });
