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
      await sql`delete from "VariantUnavailability" where store_id = ${input.storeId} and variant_id in (${sql.join(variantsOn)})`.execute(
        db,
      );
    if (variantsOff.length)
      await sql`insert into "VariantUnavailability" (id, tenant_id, variant_id, store_id) select gen_random_uuid()::text, ${tenantId}, v.id, ${input.storeId} from "Variant" v where v.id in (${sql.join(variantsOff)}) on conflict (variant_id, store_id) do nothing`.execute(
        db,
      );
    if (itemsOn.length)
      await sql`delete from "MenuItemUnavailability" where store_id = ${input.storeId} and menu_item_id in (${sql.join(itemsOn)})`.execute(
        db,
      );
    if (itemsOff.length)
      await sql`insert into "MenuItemUnavailability" (id, tenant_id, menu_item_id, store_id) select gen_random_uuid()::text, ${tenantId}, m.id, ${input.storeId} from "MenuItem" m where m.id in (${sql.join(itemsOff)}) on conflict (menu_item_id, store_id) do nothing`.execute(
        db,
      );
    return { version: await catalogVersion(db, tenantId, input.storeId) };
  });
};
