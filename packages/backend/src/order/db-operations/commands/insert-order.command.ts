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
    cashierUserId: string;
    cashierName: string;
    totalCentavos: number;
    vatEnabled: boolean;
    vatRatePercent: number | null;
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
      cashier_user_id: values.cashierUserId,
      cashier_name: values.cashierName,
      drawer_session_id: null,
      status: "paid",
      total_centavos: values.totalCentavos,
      vat_enabled: values.vatEnabled,
      vat_rate_percent: values.vatRatePercent,
    })
    .onConflict((conflict) => conflict.doNothing())
    .returning("id")
    .executeTakeFirst();
