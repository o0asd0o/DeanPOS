import { sql } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { Discount } from "../../../db/prisma/generated/types.ts";

export const findCurrentActiveDiscountByName = async (
  db: DatabaseInstance,
  name: string,
  excludedDiscountId: string,
) => {
  const result = await sql<Discount>`
    SELECT current.*
    FROM (
      SELECT DISTINCT ON (discount_id) *
      FROM "Discount"
      ORDER BY discount_id, effective_from DESC, created_at DESC
    ) current
    WHERE current.name = ${name}
      AND current.archived_at IS NULL
      AND current.discount_id <> ${excludedDiscountId}
    LIMIT 1
  `.execute(db);
  return result.rows[0];
};
