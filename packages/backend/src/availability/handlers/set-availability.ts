import { availabilitySetInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole, canAccessStore } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope, sql } from "../../db/client.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import { catalogVersion } from "../../catalog/db-operations/queries/catalog-version.query.ts";

type Input = z.infer<typeof availabilitySetInputSchema>;
export const handler: Handler<Input, { version: string } | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  if (!hasAtLeastRole(ctx.principal.role, "admin")) return null;
  const { tenantId, userId, role } = ctx.principal;
  return withTenantScope(ctx.db, tenantId, async (db) => {
    if (
      !(await getStore(db, input.storeId)) ||
      !(await canAccessStore(db, userId, role, input.storeId))
    )
      return null;
    const variantsOff = input.changes
      .filter((c) => c.target.kind === "variant" && !c.available)
      .map((c) => c.target.id);
    const variantsOn = input.changes
      .filter((c) => c.target.kind === "variant" && c.available)
      .map((c) => c.target.id);
    const itemsOff = input.changes
      .filter((c) => c.target.kind === "menuItem" && !c.available)
      .map((c) => c.target.id);
    const itemsOn = input.changes
      .filter((c) => c.target.kind === "menuItem" && c.available)
      .map((c) => c.target.id);
    if (variantsOn.length)
      await db
        .deleteFrom("VariantUnavailability")
        .where("store_id", "=", input.storeId)
        .where("variant_id", "in", variantsOn)
        .execute();
    if (variantsOff.length)
      await db
        .insertInto("VariantUnavailability")
        .columns(["id", "tenant_id", "variant_id", "store_id"])
        .expression(
          db
            .selectFrom("Variant")
            .select(({ ref }) => [
              sql<string>`gen_random_uuid()::text`.as("id"),
              sql<string>`${tenantId}`.as("tenant_id"),
              ref("Variant.id").as("variant_id"),
              sql<string>`${input.storeId}`.as("store_id"),
            ])
            .where("Variant.id", "in", variantsOff),
        )
        .onConflict((oc) => oc.columns(["variant_id", "store_id"]).doNothing())
        .execute();
    if (itemsOn.length)
      await db
        .deleteFrom("MenuItemUnavailability")
        .where("store_id", "=", input.storeId)
        .where("menu_item_id", "in", itemsOn)
        .execute();
    if (itemsOff.length)
      await db
        .insertInto("MenuItemUnavailability")
        .columns(["id", "tenant_id", "menu_item_id", "store_id"])
        .expression(
          db
            .selectFrom("MenuItem")
            .select(({ ref }) => [
              sql<string>`gen_random_uuid()::text`.as("id"),
              sql<string>`${tenantId}`.as("tenant_id"),
              ref("MenuItem.id").as("menu_item_id"),
              sql<string>`${input.storeId}`.as("store_id"),
            ])
            .where("MenuItem.id", "in", itemsOff),
        )
        .onConflict((oc) => oc.columns(["menu_item_id", "store_id"]).doNothing())
        .execute();
    return { version: await catalogVersion(db, tenantId, input.storeId) };
  });
};
