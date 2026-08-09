import type { Selectable } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { Discount } from "../../../db/prisma/generated/types.ts";

export const getCurrentDiscount = (db: DatabaseInstance, discountId: string) =>
  db
    .selectFrom("Discount")
    .selectAll("Discount")
    .where("discount_id", "=", discountId)
    .orderBy("effective_from", "desc")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst() as Promise<Selectable<Discount> | undefined>;
