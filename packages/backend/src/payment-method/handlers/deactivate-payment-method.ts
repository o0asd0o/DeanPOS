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

// `admin` only. Never hard-deletes. `cash` cannot be deactivated — the till
// can never be configured into a state where nothing can be sold (issue 08
// acceptance criteria) — refused server-side, not only hidden.
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

    const method = await setPaymentMethodActive(scopedDb, input.id, false);
    if (!method) return null;

    if (existing.active) {
      await insertPaymentMethodAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        paymentMethodId: input.id,
        storeId: null,
        field: "active",
        oldValue: String(true),
        newValue: String(false),
      });
    }

    const storeIds = await getPaymentMethodAvailabilityStoreIds(scopedDb, input.id);
    return toPaymentMethodOutput(method, storeIds);
  });

  return result;
};
