import type { DatabaseTransaction } from "../../../db/client.ts";

export const insertOrder = (
  db: DatabaseTransaction,
  values: {
    id: string;
    tenantId: string;
    storeId: string;
    deviceId: string;
    deviceSequence: number;
    orderNumber: string;
    totalCentavos: number;
  },
) =>
  db
    .insertInto("Order")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      store_id: values.storeId,
      device_id: values.deviceId,
      device_sequence: values.deviceSequence,
      order_number: values.orderNumber,
      drawer_session_id: null,
      status: "paid",
      total_centavos: values.totalCentavos,
    })
    .onConflict((conflict) => conflict.doNothing())
    .returning("id")
    .executeTakeFirst();
