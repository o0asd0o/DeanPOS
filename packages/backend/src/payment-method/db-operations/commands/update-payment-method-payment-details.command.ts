import type { DatabaseInstance } from "../../../db/client.ts";

export const updatePaymentMethodPaymentDetails = (
  db: DatabaseInstance,
  id: string,
  values: {
    accountName: string | null;
    accountNumber: string | null;
    image: { bytes: Buffer; mime: string; sha256: string; byteLength: number } | null;
  },
) =>
  db
    .updateTable("PaymentMethodPaymentDetails")
    .set({
      account_name: values.accountName,
      account_number: values.accountNumber,
      image_bytes: values.image?.bytes ?? null,
      image_mime: values.image?.mime ?? null,
      image_sha256: values.image?.sha256 ?? null,
      image_byte_length: values.image?.byteLength ?? null,
    })
    .where("id", "=", id)
    .execute();
