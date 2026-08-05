import type { DatabaseInstance } from "../../../db/client.ts";

export const updateMenuItemPrice = (db: DatabaseInstance, id: string, priceCentavos: number) =>
  db
    .updateTable("MenuItem")
    .set({ price_centavos: priceCentavos })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
