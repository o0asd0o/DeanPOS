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
    discount: {
      id: string;
      name: string;
      type: string;
      value: number;
      scope: string;
      vatExempt: boolean;
      amountCentavos: number;
    } | null;
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
      discount_id: values.discount?.id ?? null,
      discount_name: values.discount?.name ?? null,
      discount_type: values.discount?.type ?? null,
      discount_value: values.discount?.value ?? null,
      discount_scope: values.discount?.scope ?? null,
      discount_vat_exempt: values.discount?.vatExempt ?? null,
      discount_amount_centavos: values.discount?.amountCentavos ?? null,
    })
    .onConflict((conflict) => conflict.doNothing())
    .returning("id")
    .executeTakeFirst();
