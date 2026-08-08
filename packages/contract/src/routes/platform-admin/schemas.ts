import { z } from "zod";
import { passwordSchema } from "schemas/src/password.ts";

export const provisionTenantInputSchema = z.object({
  tenantName: z.string().min(1),
  adminEmail: z.email(),
  adminPassword: passwordSchema,
});

export const provisionTenantOutputSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
});
