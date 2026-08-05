import type { DatabaseInstance } from "../../../db/client.ts";

export const updateVariantPrice = (db: DatabaseInstance, id: string, priceCentavos: number) =>
  db
    .updateTable("Variant")
    .set({ price_centavos: priceCentavos })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
