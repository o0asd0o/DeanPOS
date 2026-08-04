import { randomUUID } from "node:crypto";

import type { Selectable } from "kysely";

import type { DatabaseInstance } from "../db/client.ts";
import type { PaymentMethodPaymentDetails } from "../db/prisma/generated/types.ts";
import { deletePaymentMethodPaymentDetails } from "./db-operations/commands/delete-payment-method-payment-details.command.ts";
import { insertPaymentMethodAudit } from "./db-operations/commands/insert-payment-method-audit.command.ts";
import { insertPaymentMethodPaymentDetails } from "./db-operations/commands/insert-payment-method-payment-details.command.ts";
import { updatePaymentMethodPaymentDetails } from "./db-operations/commands/update-payment-method-payment-details.command.ts";
import type { ValidatedImage } from "./validate-payment-detail-image.ts";

type ResolvedImage = { bytes: Buffer; mime: string; sha256: string; byteLength: number } | null;

export type PaymentDetailsInput = {
  accountName: string | null;
  accountNumber: string | null;
  // `undefined` leaves the stored image as it is — the client never resends
  // bytes it did not change. `null` clears it; a `ValidatedImage` replaces it.
  image: ValidatedImage | null | undefined;
};

const imageAuditValue = (row: {
  image_sha256: string | null;
  image_mime: string | null;
  image_byte_length: number | null;
}) =>
  row.image_sha256
    ? `sha256=${row.image_sha256};mime=${row.image_mime};bytes=${row.image_byte_length}`
    : "";

const resolvedImageAuditValue = (image: ResolvedImage) =>
  image ? `sha256=${image.sha256};mime=${image.mime};bytes=${image.byteLength}` : "";

// One form, one Save, one transaction (record 054 Q3, carried into record
// 066 Q7): writes the Tenant-default payment-detail row and its audit rows
// as part of the same transaction the caller already opened.
export const savePaymentMethodPaymentDetails = async (
  scopedDb: DatabaseInstance,
  params: {
    tenantId: string;
    actorUserId: string;
    paymentMethodId: string;
    existing: Selectable<PaymentMethodPaymentDetails> | undefined;
    desired: PaymentDetailsInput;
  },
) => {
  const { tenantId, actorUserId, paymentMethodId, existing, desired } = params;

  const finalImage: ResolvedImage =
    desired.image === undefined
      ? existing?.image_bytes
        ? {
            bytes: existing.image_bytes,
            mime: existing.image_mime!,
            sha256: existing.image_sha256!,
            byteLength: existing.image_byte_length!,
          }
        : null
      : desired.image;

  const finalAccountName = desired.accountName;
  const finalAccountNumber = desired.accountNumber;
  const isEmpty = finalAccountName === null && finalAccountNumber === null && finalImage === null;

  const auditRow = (
    field: "accountName" | "accountNumber" | "image",
    oldValue: string,
    newValue: string,
  ) =>
    insertPaymentMethodAudit(scopedDb, {
      id: randomUUID(),
      tenantId,
      actorUserId,
      paymentMethodId,
      storeId: null,
      field,
      oldValue,
      newValue,
    });

  const oldAccountName = existing?.account_name ?? "";
  const oldAccountNumber = existing?.account_number ?? "";
  const oldImage = existing ? imageAuditValue(existing) : "";
  const newAccountName = finalAccountName ?? "";
  const newAccountNumber = finalAccountNumber ?? "";
  const newImage = resolvedImageAuditValue(finalImage);

  if (!existing && isEmpty) return;

  if (existing && isEmpty) {
    await deletePaymentMethodPaymentDetails(scopedDb, existing.id);
  } else if (existing) {
    await updatePaymentMethodPaymentDetails(scopedDb, existing.id, {
      accountName: finalAccountName,
      accountNumber: finalAccountNumber,
      image: finalImage,
    });
  } else {
    await insertPaymentMethodPaymentDetails(scopedDb, {
      id: randomUUID(),
      tenantId,
      paymentMethodId,
      storeId: null,
      accountName: finalAccountName,
      accountNumber: finalAccountNumber,
      image: finalImage,
    });
  }

  if (oldAccountName !== newAccountName)
    await auditRow("accountName", oldAccountName, newAccountName);
  if (oldAccountNumber !== newAccountNumber)
    await auditRow("accountNumber", oldAccountNumber, newAccountNumber);
  if (oldImage !== newImage) await auditRow("image", oldImage, newImage);
};
