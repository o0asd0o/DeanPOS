import type { DatabaseInstance } from "../../../db/client.ts";

export const selectAvailablePaymentMethods = (db: DatabaseInstance, storeId: string) =>
  db
    .selectFrom("PaymentMethod as method")
    .where("method.active", "=", true)
    .where((eb) =>
      eb.or([
        eb("method.kind", "=", "cash"),
        eb.exists(
          eb
            .selectFrom("PaymentMethodAvailability as availability")
            .select("availability.id")
            .whereRef("availability.tenant_id", "=", "method.tenant_id")
            .whereRef("availability.payment_method_id", "=", "method.id")
            .where("availability.store_id", "=", storeId),
        ),
      ]),
    );
