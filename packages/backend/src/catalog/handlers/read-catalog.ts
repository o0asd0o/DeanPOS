import { catalogReadInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { catalogVersion } from "../db-operations/queries/catalog-version.query.ts";
import { listActiveCategories } from "../db-operations/queries/list-active-categories.query.ts";
import { toCategoryOutput } from "../helpers.ts";

export const inputSchema = catalogReadInputSchema;
type Input = z.infer<typeof inputSchema>;
type ReadOutput = {
  categories: ReturnType<typeof toCategoryOutput>[];
  menuItems: [];
  version: string;
};

// Device/tenant read model. menuItems empty until Variants (issue 02).
// Unauthenticated → empty payload + empty-catalog version shape via zero ids.
export const handler: Handler<Input, ReadOutput> = async ({ ctx, input }) => {
  const tenantId =
    ctx.kind === "tenant"
      ? ctx.principal.tenantId
      : ctx.kind === "device"
        ? ctx.device.tenantId
        : null;
  if (!tenantId) {
    return { categories: [], menuItems: [], version: "0".repeat(64) };
  }

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const categories = (await listActiveCategories(db)).map(toCategoryOutput);
    const version = await catalogVersion(db, tenantId, input.storeId);
    return { categories, menuItems: [], version };
  });
};
