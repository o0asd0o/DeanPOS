import { availabilityListInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole, canAccessStore } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope, sql } from "../../db/client.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import type { PageEnvelope } from "../../common/pagination.ts";

type Input = z.infer<typeof availabilityListInputSchema>;
type Row = {
  kind: "variant" | "menuItem";
  id: string;
  name: string;
  menuItemName: string | null;
  priceCentavos: number;
  available: boolean;
};
type Output = PageEnvelope<Row> & {
  unavailableInScope: { kind: "variant" | "menuItem"; id: string }[];
};
export const handler: Handler<Input, Output> = async ({ ctx, input }) => {
  const empty = {
    items: [],
    count: 0,
    page: 1,
    perPage: input.perPage ?? 10,
    hasNextPage: false,
    hasPrevPage: false,
    unavailableInScope: [],
  };
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.userId ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "admin")
  )
    return empty;
  const { tenantId, userId, role } = ctx.principal;
  return withTenantScope(ctx.db, tenantId, async (db) => {
    if (
      !(await getStore(db, input.storeId)) ||
      !(await canAccessStore(db, userId, role, input.storeId))
    )
      return empty;
    const search = input.search ? `%${input.search.replace(/[\\%_]/g, "\\$&")}%` : null;
    // Conditionally-built so the parameter never appears bare in `is null`,
    // which Postgres cannot type-infer ("could not determine data type of
    // parameter") — same pattern as listMenuItems.
    const searchFilter = search
      ? sql`where name ilike ${search} or "menuItemName" ilike ${search}`
      : sql``;
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 10;
    const offset = (page - 1) * perPage;
    // Order by the CTE's output columns (priceCentavos/menuItemName are the
    // aliased ones), never the raw table columns — the outer select only sees
    // the CTE's names.
    const order =
      input.sort?.key === "price"
        ? "priceCentavos"
        : input.sort?.key === "available"
          ? "available"
          : input.sort?.key === "menuItem"
            ? "menuItemName"
            : "name";
    const direction = input.sort?.direction === "desc" ? "desc" : "asc";
    const rows = await sql<Row>`with rows as (
      select 'menuItem'::text kind, m.id, m.name, null::text "menuItemName", m.price_centavos "priceCentavos", not exists (select 1 from "MenuItemUnavailability" u where u.menu_item_id=m.id and u.store_id=${input.storeId}) available
      from "MenuItem" m join "Category" c on c.id=m.category_id and c.tenant_id=m.tenant_id where m.archived_at is null and c.archived_at is null
      union all
      select 'variant'::text, v.id, v.name, m.name, v.price_centavos, not exists (select 1 from "VariantUnavailability" u where u.variant_id=v.id and u.store_id=${input.storeId})
      from "Variant" v join "MenuItem" m on m.id=v.menu_item_id and m.tenant_id=v.tenant_id join "Category" c on c.id=m.category_id and c.tenant_id=m.tenant_id where v.archived_at is null and m.archived_at is null and c.archived_at is null
    ) select * from rows ${searchFilter} order by ${sql.raw(`"${order}" ${direction}, id asc`)} limit ${perPage + 1} offset ${offset}`.execute(
      db,
    );
    const count = (
      await sql<{
        count: number;
      }>`with rows as (select m.id, m.name, null::text "menuItemName" from "MenuItem" m join "Category" c on c.id=m.category_id and c.tenant_id=m.tenant_id where m.archived_at is null and c.archived_at is null union all select v.id, v.name, m.name from "Variant" v join "MenuItem" m on m.id=v.menu_item_id and m.tenant_id=v.tenant_id join "Category" c on c.id=m.category_id and c.tenant_id=m.tenant_id where v.archived_at is null and m.archived_at is null and c.archived_at is null) select count(*)::int count from rows ${searchFilter}`.execute(
        db,
      )
    ).rows[0]!.count;
    const unavailable = await sql<{
      kind: "variant" | "menuItem";
      id: string;
    }>`select 'variant'::text kind, variant_id id from "VariantUnavailability" where store_id=${input.storeId} union all select 'menuItem'::text, menu_item_id from "MenuItemUnavailability" where store_id=${input.storeId}`.execute(
      db,
    );
    return {
      items: rows.rows.slice(0, perPage),
      count,
      page,
      perPage,
      hasNextPage: rows.rows.length > perPage,
      hasPrevPage: page > 1,
      unavailableInScope: unavailable.rows,
    };
  });
};
