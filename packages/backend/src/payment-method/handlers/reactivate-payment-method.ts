import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertPaymentMethodAudit } from "../db-operations/commands/insert-payment-method-audit.command.ts";
import { setPaymentMethodActive } from "../db-operations/commands/set-payment-method-active.command.ts";
import { getPaymentMethodAvailabilityStoreIds } from "../db-operations/queries/get-payment-method-availability-store-ids.query.ts";
import { toPaymentMethodOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });

type PaymentMethodOutput = ReturnType<typeof toPaymentMethodOutput>;

// `admin` only. Not confirmed on the client (record 038 §4) — it restores an
// affordance and destroys nothing. `cash` is always active, so this never
// has anything to do for it, but is refused server-side for consistency.
export const handler: Handler<{ id: string }, PaymentMethodOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const result = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const existing = await scopedDb
      .selectFrom("PaymentMethod")
      .selectAll()
      .where("id", "=", input.id)
      .forUpdate()
      .executeTakeFirst();
    if (!existing || existing.kind === "cash") return null;

    const method = await setPaymentMethodActive(scopedDb, input.id, true);
    if (!method) return null;

    if (!existing.active) {
      await insertPaymentMethodAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        paymentMethodId: input.id,
        storeId: null,
        field: "active",
        oldValue: String(false),
        newValue: String(true),
      });
    }

    const storeIds = await getPaymentMethodAvailabilityStoreIds(scopedDb, input.id);
    return toPaymentMethodOutput(method, storeIds);
  });

  return result;
};
