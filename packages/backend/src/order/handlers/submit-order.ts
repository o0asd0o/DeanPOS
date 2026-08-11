import type { catalogReadOutputSchema, submitOrderOutputSchema } from "contract/src/contract.ts";
import { submitOrderInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { selectCatalogRead } from "../../catalog/db-operations/queries/catalog-version.query.ts";
import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertOrder } from "../db-operations/commands/insert-order.command.ts";
import { insertOrderLines } from "../db-operations/commands/insert-order-lines.command.ts";
import { insertPayment } from "../db-operations/commands/insert-payment.command.ts";
import { getCashPaymentMethod } from "../db-operations/queries/get-cash-payment-method.query.ts";
import { getOrderById } from "../db-operations/queries/get-order-by-id.query.ts";
import { isValidSubmittedLine } from "../helpers.ts";

export const inputSchema = submitOrderInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof submitOrderOutputSchema>;
type Catalog = z.infer<typeof catalogReadOutputSchema>;

function logOutcome(
  device: { storeId: string; deviceId: string; assignedUserId: string | null },
  orderId: string,
  outcome: "created" | "duplicate" | "refused",
) {
  console.info("order.submit", {
    orderId,
    storeId: device.storeId,
    deviceId: device.deviceId,
    actor: device.assignedUserId ?? "device",
    outcome,
  });
}

export const handler: Handler<Input, Output> = async ({ ctx, input }) => {
  const deviceContext = deviceCtx(ctx);
  if (!deviceContext) return { ok: false };

  const { device } = deviceContext;
  const result = await withTenantScope(ctx.db, device.tenantId, async (db) => {
    if (input.amountTenderedCentavos < input.totalCentavos) {
      return { output: { ok: false } as const, outcome: "refused" as const };
    }
    const summedTotal = input.lines.reduce((total, line) => total + line.lineTotalCentavos, 0);
    if (!Number.isSafeInteger(summedTotal) || summedTotal !== input.totalCentavos) {
      return { output: { ok: false } as const, outcome: "refused" as const };
    }

    const [{ content }, cashMethod] = await Promise.all([
      selectCatalogRead(db, device.storeId),
      getCashPaymentMethod(db),
    ]);
    if (!cashMethod) return { output: { ok: false } as const, outcome: "refused" as const };
    const catalog = content as Omit<Catalog, "version">;
    const valid = input.lines.every((line) => {
      const item = catalog.menuItems.find((candidate) => candidate.id === line.menuItemId);
      return item ? isValidSubmittedLine(line, item) : false;
    });
    if (!valid) return { output: { ok: false } as const, outcome: "refused" as const };

    const changeCentavos = input.amountTenderedCentavos - input.totalCentavos;
    const created = await insertOrder(db, {
      id: input.id,
      tenantId: device.tenantId,
      storeId: device.storeId,
      deviceId: device.deviceId,
      totalCentavos: input.totalCentavos,
    });
    if (!created) {
      const existing = await getOrderById(db, input.id);
      return existing
        ? {
            output: {
              ok: true,
              orderId: existing.id,
              changeCentavos: existing.change_centavos,
            } as const,
            outcome: "duplicate" as const,
          }
        : { output: { ok: false } as const, outcome: "refused" as const };
    }

    await insertOrderLines(db, {
      tenantId: device.tenantId,
      orderId: input.id,
      lines: input.lines,
    });
    await insertPayment(db, {
      tenantId: device.tenantId,
      orderId: input.id,
      paymentMethodId: cashMethod.id,
      amountTenderedCentavos: input.amountTenderedCentavos,
      changeCentavos,
    });
    return {
      output: { ok: true, orderId: input.id, changeCentavos } as const,
      outcome: "created" as const,
    };
  });

  logOutcome(device, input.id, result.outcome);
  return result.output;
};
