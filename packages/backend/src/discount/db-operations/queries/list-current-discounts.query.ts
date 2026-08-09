import { sql } from "../../../db/client.ts";
import type { Selectable } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { Discount } from "../../../db/prisma/generated/types.ts";

export const listCurrentDiscounts = async (db: DatabaseInstance) => {
  const result = await sql<Discount>`
    SELECT DISTINCT ON (discount_id) * FROM "Discount"
    ORDER BY discount_id, effective_from DESC, created_at DESC
  `.execute(db);
  return result.rows as unknown as Selectable<Discount>[];
};
