import { sql } from "../../../db/client.ts";
import type { Selectable } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { Discount } from "../../../db/prisma/generated/types.ts";

export const getCurrentDiscount = async (db: DatabaseInstance, discountId: string) => {
  const result = await sql<Discount>`
    SELECT d.* FROM "Discount" d
    JOIN (
      SELECT id FROM "Discount"
      WHERE discount_id = ${discountId}
      ORDER BY effective_from DESC, created_at DESC
      LIMIT 1
    ) current ON current.id = d.id
  `.execute(db);
  return result.rows[0] as unknown as Selectable<Discount> | undefined;
};
