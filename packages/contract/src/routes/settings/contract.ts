import { oc } from "@orpc/contract";
import { tenantSettingsOutputSchema, tenantSettingsUpdateInputSchema } from "./schemas.ts";
import { z } from "zod";

// `admin`-only, tenant-wide financial controls (issue 07). `null` for any
// non-admin or unauthenticated caller — the same not-found shape store.get
// uses; `manager`/`cashier` never see this screen at all.
export const settingsContract = {
  get: oc.input(z.void()).output(tenantSettingsOutputSchema.nullable()),
  update: oc.input(tenantSettingsUpdateInputSchema).output(tenantSettingsOutputSchema.nullable()),
};
