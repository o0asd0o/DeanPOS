import { sql } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Single expression for catalog.read + catalog.version (records 069/070).
// menuItems stays empty until Variants (issue 02) can mark sellable items.
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
        'menuItems', '[]'::jsonb
      ) as content
    )
    select encode(sha256(convert_to(content::jsonb::text, 'UTF8')), 'hex') as version from payload
  `.execute(db);
  return result.rows[0]!.version;
};
