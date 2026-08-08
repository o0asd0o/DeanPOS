import { oc } from "@orpc/contract";
import { provisionTenantInputSchema, provisionTenantOutputSchema } from "./schemas.ts";

export const platformAdminContract = {
  provisionTenant: oc
    .input(provisionTenantInputSchema)
    .output(provisionTenantOutputSchema.nullable()),
};
