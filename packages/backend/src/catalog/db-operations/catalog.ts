import { sql } from "../../db/client.ts";
import type { DatabaseTransaction } from "../../db/client.ts";

export const listCategories = (db: DatabaseTransaction) =>
  db.selectFrom("Category").selectAll().orderBy("sort_order").orderBy("id").execute();

export const listMenuItems = (db: DatabaseTransaction) =>
  db
    .selectFrom("MenuItem")
    .selectAll()
    .orderBy("category_id")
    .orderBy("sort_order")
    .orderBy("id")
    .execute();

export const nextCategorySortOrder = async (db: DatabaseTransaction) => {
  const result = await sql<{ sortOrder: number }>`
    select coalesce(max("sort_order"), -1) + 1 as "sortOrder" from "Category"
    where "archived_at" is null
  `.execute(db);
  return result.rows[0]!.sortOrder;
};

export const nextMenuItemSortOrder = async (db: DatabaseTransaction, categoryId: string) => {
  const result = await sql<{ sortOrder: number }>`
    select coalesce(max("sort_order"), -1) + 1 as "sortOrder" from "MenuItem"
    where "category_id" = ${categoryId} and "archived_at" is null
  `.execute(db);
  return result.rows[0]!.sortOrder;
};

export const catalogVersion = async (
  db: DatabaseTransaction,
  tenantId: string,
  storeId: string,
) => {
  const result = await sql<{ version: string }>`
    with payload as (
      select jsonb_build_object(
        'tenantId', ${sql<string>`${tenantId}::text`},
        'storeId', ${sql<string>`${storeId}::text`},
        'categories', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c."id", 'tenantId', c."tenant_id", 'name', c."name", 'sortOrder', c."sort_order"
          ) order by c."sort_order", c."id")
          from "Category" c where c."archived_at" is null
        ), '[]'::jsonb),
        'menuItems', '[]'::jsonb
      ) as content
    )
    select encode(sha256(convert_to(content::jsonb::text, 'UTF8')), 'hex') as version from payload
  `.execute(db);
  return result.rows[0]!.version;
};
