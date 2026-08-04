import { sql } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Single expression for catalog.read + catalog.version (records 069/070).
// menuItems include sellable rows with active Variants only.
export const catalogVersion = async (db: DatabaseInstance, tenantId: string, storeId: string) => {
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
        'menuItems', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', m."id",
            'tenantId', m."tenant_id",
            'categoryId', m."category_id",
            'name', m."name",
            'sortOrder', m."sort_order",
            'variants', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', v."id",
                'name', v."name",
                'priceCentavos', v."price_centavos",
                'sortOrder', v."sort_order"
              ) order by v."sort_order", v."id")
              from "Variant" v
              where v."menu_item_id" = m."id"
                and v."tenant_id" = m."tenant_id"
                and v."archived_at" is null
            ), '[]'::jsonb)
          ) order by c."sort_order", m."sort_order", m."id")
          from "MenuItem" m
          inner join "Category" c
            on c."id" = m."category_id" and c."tenant_id" = m."tenant_id"
          where m."archived_at" is null
            and c."archived_at" is null
            and exists (
              select 1 from "Variant" v
              where v."menu_item_id" = m."id"
                and v."tenant_id" = m."tenant_id"
                and v."archived_at" is null
            )
        ), '[]'::jsonb)
      ) as content
    )
    select encode(sha256(convert_to(content::jsonb::text, 'UTF8')), 'hex') as version from payload
  `.execute(db);
  return result.rows[0]!.version;
};
