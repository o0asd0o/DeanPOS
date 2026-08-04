import type { DatabaseInstance } from "../../../db/client.ts";

export const insertPaymentMethodPaymentDetails = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    paymentMethodId: string;
    storeId: string | null;
    accountName: string | null;
    accountNumber: string | null;
    image: { bytes: Buffer; mime: string; sha256: string; byteLength: number } | null;
  },
) =>
  db
    .insertInto("PaymentMethodPaymentDetails")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      payment_method_id: values.paymentMethodId,
      store_id: values.storeId,
      account_name: values.accountName,
      account_number: values.accountNumber,
      image_bytes: values.image?.bytes ?? null,
      image_mime: values.image?.mime ?? null,
      image_sha256: values.image?.sha256 ?? null,
      image_byte_length: values.image?.byteLength ?? null,
    })
    .execute();
