import { randomUUID } from "node:crypto";

import type { DatabaseTransaction } from "../../../db/client.ts";

export const insertPayment = (
  db: DatabaseTransaction,
  values: {
    tenantId: string;
    orderId: string;
    paymentMethodId: string;
    amountTenderedCentavos: number;
    changeCentavos: number;
  },
) =>
  db
    .insertInto("Payment")
    .values({
      id: randomUUID(),
      tenant_id: values.tenantId,
      order_id: values.orderId,
      payment_method_id: values.paymentMethodId,
      method: "cash",
      amount_tendered_centavos: values.amountTenderedCentavos,
      change_centavos: values.changeCentavos,
    })
    .execute();
