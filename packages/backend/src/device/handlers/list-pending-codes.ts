import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listPendingCodes } from "../db-operations/queries/list-pending-codes.query.ts";

type PendingCodeOutput = {
  id: string;
  secret: string;
  name: string;
  code: string;
  storeId: string;
  expiresAt: Date;
};

// `admin` only, like `device.list` — empty array for anyone else. The secret
// is returned: an admin who may generate a code may re-read the one in flight.
export const handler: Handler<void, PendingCodeOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return [];

  const codes = await withTenantScope(ctx.db, tenantId, (scopedDb) => listPendingCodes(scopedDb));
  return codes.map((row) => ({
    id: row.id,
    secret: row.secret,
    name: row.name,
    code: row.code,
    storeId: row.store_id,
    expiresAt: row.expires_at,
  }));
};
