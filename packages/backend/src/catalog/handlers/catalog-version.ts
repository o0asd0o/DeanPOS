import { catalogReadInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { catalogVersion } from "../db-operations/queries/catalog-version.query.ts";

export const inputSchema = catalogReadInputSchema;
type Input = z.infer<typeof inputSchema>;

// Hash only — payload never leaves the DB (record 070).
export const handler: Handler<Input, { version: string }> = async ({
  ctx,
  input,
}) => {
  const tenantId =
    ctx.kind === "tenant"
      ? ctx.principal.tenantId
      : ctx.kind === "device"
        ? ctx.device.tenantId
        : null;
  if (!tenantId) return { version: "0".repeat(64) };

  const version = await withTenantScope(ctx.db, tenantId, (db) =>
    catalogVersion(db, tenantId, input.storeId),
  );
  return { version };
};
