import { oc } from "@orpc/contract";
import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});

export const storeOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.date(),
});

export const provisionTenantInputSchema = z.object({
  tenantName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export const provisionTenantOutputSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
});

// The only place a procedure's shape is declared. PRD "Contract".
export const contract = {
  ping: oc.input(z.void()).output(pingOutputSchema),
  // The wrong-tenant probe helper's demonstration procedure (issue 01,
  // tenant-isolation-spine): addressing another Tenant's Store id must read
  // as not-found, never that Tenant's row.
  store: {
    get: oc.input(z.object({ id: z.string() })).output(storeOutputSchema.nullable()),
  },
  // Platform-admin only (issue 02) — `null` for any tenant-scoped or
  // unauthenticated caller, the same not-found shape store.get uses.
  platformAdmin: {
    provisionTenant: oc
      .input(provisionTenantInputSchema)
      .output(provisionTenantOutputSchema.nullable()),
  },
};
