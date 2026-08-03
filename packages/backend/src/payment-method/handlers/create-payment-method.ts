import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertPaymentMethod } from "../db-operations/commands/insert-payment-method.command.ts";
import { insertPaymentMethodAudit } from "../db-operations/commands/insert-payment-method-audit.command.ts";
import { insertPaymentMethodAvailability } from "../db-operations/commands/insert-payment-method-availability.command.ts";
import { toPaymentMethodOutput } from "../helpers.ts";

export const inputSchema = z.object({
  name: z.string().min(1),
  storeIds: z.array(z.string()),
});

type CreatePaymentMethodInput = z.infer<typeof inputSchema>;
type PaymentMethodOutput = ReturnType<typeof toPaymentMethodOutput>;

// `admin` only (issue 08 acceptance criteria). Writes one `created` audit row
// plus one `available` row per Store checked, all sharing one transaction and
// one `created_at` (record 054 Q1) — creating a method available at three
// Stores writes four rows.
export const handler: Handler<CreatePaymentMethodInput, PaymentMethodOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const storeIds = [...new Set(input.storeIds)];

  const method = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const method = await insertPaymentMethod(scopedDb, {
      id: randomUUID(),
      tenantId,
      name: input.name,
    });

    await insertPaymentMethodAudit(scopedDb, {
      id: randomUUID(),
      tenantId,
      actorUserId: userId,
      paymentMethodId: method.id,
      storeId: null,
      field: "created",
      oldValue: null,
      newValue: method.name,
    });

    for (const storeId of storeIds) {
      await insertPaymentMethodAvailability(scopedDb, {
        id: randomUUID(),
        tenantId,
        paymentMethodId: method.id,
        storeId,
      });
      await insertPaymentMethodAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        paymentMethodId: method.id,
        storeId,
        field: "available",
        oldValue: String(false),
        newValue: String(true),
      });
    }

    return method;
  });

  return toPaymentMethodOutput(method, storeIds);
};
