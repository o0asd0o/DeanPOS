import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertPaymentMethodAudit } from "../db-operations/commands/insert-payment-method-audit.command.ts";
import { insertPaymentMethodAvailability } from "../db-operations/commands/insert-payment-method-availability.command.ts";
import { deletePaymentMethodAvailability } from "../db-operations/commands/delete-payment-method-availability.command.ts";
import { updatePaymentMethodName } from "../db-operations/commands/update-payment-method-name.command.ts";
import { getPaymentMethod } from "../db-operations/queries/get-payment-method.query.ts";
import { getPaymentMethodAvailabilityStoreIds } from "../db-operations/queries/get-payment-method-availability-store-ids.query.ts";
import { getPaymentMethodPaymentDetails } from "../db-operations/queries/get-payment-method-payment-details.query.ts";
import { toPaymentMethodOutput } from "../helpers.ts";
import { savePaymentMethodPaymentDetails } from "../save-payment-method-payment-details.ts";
import { validatePaymentDetailImage } from "../validate-payment-detail-image.ts";

const paymentDetailsInputSchema = z.object({
  accountName: z.string().trim().min(1).nullable(),
  accountNumber: z.string().trim().min(1).nullable(),
  image: z
    .object({ base64: z.string().min(1) })
    .nullable()
    .optional(),
});

export const inputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  storeIds: z.array(z.string()),
  paymentDetails: paymentDetailsInputSchema.optional(),
});

type UpdatePaymentMethodInput = z.infer<typeof inputSchema>;
type PaymentMethodOutput = ReturnType<typeof toPaymentMethodOutput>;

// `admin` only; never touches `active` (record 040 §3). `cash` cannot be
// renamed or have its availability changed (issue 08), refused here too.
export const handler: Handler<UpdatePaymentMethodInput, PaymentMethodOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  // Absent `paymentDetails` leaves the stored set untouched, so the 189
  // existing Tenants' methods stay valid on a save that never sends it.
  const paymentDetails = input.paymentDetails;

  // Validated before anything is written (issue 14 acceptance criterion 6):
  // a rejected image must leave the name and availability unchanged too.
  const validatedImage =
    paymentDetails?.image === undefined
      ? undefined
      : paymentDetails.image === null
        ? null
        : validatePaymentDetailImage(paymentDetails.image.base64);
  if (validatedImage && "error" in validatedImage) return null;

  const desiredStoreIds = new Set(input.storeIds);

  const result = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    // Locked before the diff (record 034's pattern): two concurrent saves on
    // the same method serialise, so the second sees the first's committed
    // row rather than both reading the same pre-image.
    const existing = await scopedDb
      .selectFrom("PaymentMethod")
      .selectAll()
      .where("id", "=", input.id)
      .forUpdate()
      .executeTakeFirst();
    if (!existing || existing.kind === "cash") return null;

    if (existing.name !== input.name) {
      await updatePaymentMethodName(scopedDb, input.id, input.name);
      await insertPaymentMethodAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        paymentMethodId: input.id,
        storeId: null,
        field: "name",
        oldValue: existing.name,
        newValue: input.name,
      });
    }

    const currentStoreIds = new Set(await getPaymentMethodAvailabilityStoreIds(scopedDb, input.id));

    for (const storeId of desiredStoreIds) {
      if (currentStoreIds.has(storeId)) continue;
      await insertPaymentMethodAvailability(scopedDb, {
        id: randomUUID(),
        tenantId,
        paymentMethodId: input.id,
        storeId,
      });
      await insertPaymentMethodAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        paymentMethodId: input.id,
        storeId,
        field: "available",
        oldValue: String(false),
        newValue: String(true),
      });
    }
    for (const storeId of currentStoreIds) {
      if (desiredStoreIds.has(storeId)) continue;
      await deletePaymentMethodAvailability(scopedDb, input.id, storeId);
      await insertPaymentMethodAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        paymentMethodId: input.id,
        storeId,
        field: "available",
        oldValue: String(true),
        newValue: String(false),
      });
    }

    if (paymentDetails) {
      const existingDetails = await getPaymentMethodPaymentDetails(scopedDb, input.id, null);
      await savePaymentMethodPaymentDetails(scopedDb, {
        tenantId,
        actorUserId: userId,
        paymentMethodId: input.id,
        existing: existingDetails,
        desired: {
          accountName: paymentDetails.accountName,
          accountNumber: paymentDetails.accountNumber,
          image: validatedImage,
        },
      });
    }

    return getPaymentMethod(scopedDb, input.id);
  });

  if (!result) return null;
  return toPaymentMethodOutput(result, [...desiredStoreIds]);
};
