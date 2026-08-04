import { catalogReadInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { catalogVersion } from "../db-operations/queries/catalog-version.query.ts";
import { listActiveCategories } from "../db-operations/queries/list-active-categories.query.ts";
import { listActiveVariantsForMenuItem } from "../db-operations/queries/list-active-variants-for-menu-item.query.ts";
import { listSellableMenuItems } from "../db-operations/queries/list-sellable-menu-items.query.ts";
import { toCategoryOutput } from "../helpers.ts";

export const inputSchema = catalogReadInputSchema;
type Input = z.infer<typeof inputSchema>;
type ReadOutput = {
  categories: ReturnType<typeof toCategoryOutput>[];
  menuItems: {
    id: string;
    tenantId: string;
    categoryId: string;
    name: string;
    sortOrder: number;
    variants: {
      id: string;
      name: string;
      priceCentavos: number;
      sortOrder: number;
    }[];
  }[];
  version: string;
};

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
    const sellable = await listSellableMenuItems(db);
    const menuItems = await Promise.all(
      sellable.map(async (item) => {
        const variants = await listActiveVariantsForMenuItem(db, item.id);
        return {
          id: item.id,
          tenantId: item.tenant_id,
          categoryId: item.category_id,
          name: item.name,
          sortOrder: item.sort_order,
          variants: variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            priceCentavos: variant.price_centavos,
            sortOrder: variant.sort_order,
          })),
        };
      }),
    );
    const version = await catalogVersion(db, tenantId, input.storeId);
    return { categories, menuItems, version };
  });
};
