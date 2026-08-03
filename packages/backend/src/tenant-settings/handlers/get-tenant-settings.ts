import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getTenantSettings } from "../db-operations/queries/get-tenant-settings.query.ts";
import { toTenantSettingsOutput } from "../helpers.ts";

type TenantSettingsOutput = ReturnType<typeof toTenantSettingsOutput>;

// `admin` only — `manager`/`cashier` do not see this screen at all, and a
// read discloses the same financial controls a write would (issue 07,
// record 046 §4). Refused with `null`, the same not-found shape every other
// procedure in this codebase uses.
export const handler: Handler<void, TenantSettingsOutput | null> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const tenant = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    getTenantSettings(scopedDb, tenantId),
  );
  if (!tenant) return null;

  return toTenantSettingsOutput(tenant);
};
