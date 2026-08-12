import type { catalogReadOutputSchema, submitOrderOutputSchema } from "contract/src/contract.ts";
import { receiptSchema, submitOrderInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { selectCatalogRead } from "../../catalog/db-operations/queries/catalog-version.query.ts";
import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getPinRoster } from "../../device/db-operations/queries/get-pin-roster.query.ts";
import { getTenantSettings } from "../../tenant-settings/db-operations/queries/get-tenant-settings.query.ts";
import { insertOrder } from "../db-operations/commands/insert-order.command.ts";
import { insertOrderLines } from "../db-operations/commands/insert-order-lines.command.ts";
import { insertPayment } from "../db-operations/commands/insert-payment.command.ts";
import { getPaymentMethodForStore } from "../db-operations/queries/get-payment-method-for-store.query.ts";
import { getReceiptById } from "../db-operations/queries/get-receipt-by-id.query.ts";
import { computeOrderDiscountAmount, isValidSubmittedLine } from "../helpers.ts";

export const inputSchema = submitOrderInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof submitOrderOutputSchema>;
type Catalog = z.infer<typeof catalogReadOutputSchema>;

function logOutcome(
  device: { storeId: string; deviceId: string },
  orderId: string,
  actorUserId: string | null,
  outcome: "created" | "duplicate" | "refused",
) {
  console.info("order.submit", {
    orderId,
    storeId: device.storeId,
    deviceId: device.deviceId,
    actor: actorUserId ?? "device",
    outcome,
  });
}

export const handler: Handler<Input, Output> = async ({ ctx, input }) => {
  const deviceContext = deviceCtx(ctx);
  if (!deviceContext) return { ok: false };

  const { device } = deviceContext;
  const result = await withTenantScope(ctx.db, device.tenantId, async (db) => {
    const existingReceipt = await getReceiptById(db, { id: input.id, storeId: device.storeId });
    if (existingReceipt) {
      return {
        output: { ok: true, receipt: receiptSchema.parse(existingReceipt) } as const,
        actorUserId: existingReceipt.cashierUserId,
        outcome: "duplicate" as const,
      };
    }
    const expectedOrderNumber = `${device.code}-${String(input.deviceSequence).padStart(4, "0")}`;
    if (input.orderNumber !== expectedOrderNumber) {
      return { output: { ok: false } as const, actorUserId: null, outcome: "refused" as const };
    }
    if (input.amountTenderedCentavos < input.totalCentavos) {
      return { output: { ok: false } as const, actorUserId: null, outcome: "refused" as const };
    }
    const subtotalCentavos = input.lines.reduce((total, line) => total + line.lineTotalCentavos, 0);
    if (!Number.isSafeInteger(subtotalCentavos)) {
      return { output: { ok: false } as const, actorUserId: null, outcome: "refused" as const };
    }

    const [{ content }, paymentMethod, roster, tenant] = await Promise.all([
      selectCatalogRead(db, device.storeId),
      getPaymentMethodForStore(db, {
        paymentMethodId: input.paymentMethodId,
        storeId: device.storeId,
      }),
      getPinRoster(db, device.storeId, device.assignedUserId),
      getTenantSettings(db, device.tenantId),
    ]);
    const cashier = roster.find((user) => user.userId === input.cashierUserId);
    if (!paymentMethod || !cashier || !tenant) {
      return { output: { ok: false } as const, actorUserId: null, outcome: "refused" as const };
    }
    if (paymentMethod.kind === "recorded" && input.amountTenderedCentavos !== input.totalCentavos) {
      return {
        output: { ok: false } as const,
        actorUserId: cashier.userId,
        outcome: "refused" as const,
      };
    }
    const catalog = content as Omit<Catalog, "version">;
    const selectedDiscount = input.discountId
      ? catalog.discounts.find(
          (discount) =>
            discount.id === input.discountId &&
            discount.scope === "order" &&
            discount.value !== null,
        )
      : null;
    if (
      (input.discountId !== null && !selectedDiscount) ||
      (!input.discountId && catalog.discounts.length === 0 ? false : false)
    ) {
      return {
        output: { ok: false } as const,
        actorUserId: cashier.userId,
        outcome: "refused" as const,
      };
    }
    const discountAmountCentavos = selectedDiscount
      ? computeOrderDiscountAmount(subtotalCentavos, {
          type: selectedDiscount.type,
          value: selectedDiscount.value!,
        })
      : 0;
    if (
      discountAmountCentavos > subtotalCentavos ||
      input.totalCentavos !== subtotalCentavos - discountAmountCentavos
    ) {
      return {
        output: { ok: false } as const,
        actorUserId: cashier.userId,
        outcome: "refused" as const,
      };
    }
    const lineDiscounts = input.lines.map((line) => {
      const discountId = line.discountIds[0];
      if (!discountId) return null;
      return (
        catalog.discounts.find(
          (discount) =>
            discount.id === discountId &&
            discount.scope === "line" &&
            discount.type === "percent" &&
            discount.value !== null,
        ) ?? null
      );
    });
    const valid = input.lines.every((line, index) => {
      if (line.discountIds.length > 0 && !lineDiscounts[index]) return false;
      const item = catalog.menuItems.find((candidate) => candidate.id === line.menuItemId);
      const discount = lineDiscounts[index];
      return item && (!discount || discount.type === "percent")
        ? isValidSubmittedLine(line, item, discount ? { value: discount.value! } : null)
        : false;
    });
    if (!valid) {
      return {
        output: { ok: false } as const,
        actorUserId: cashier.userId,
        outcome: "refused" as const,
      };
    }

    const changeCentavos =
      paymentMethod.kind === "cash" ? input.amountTenderedCentavos - input.totalCentavos : 0;
    const created = await insertOrder(db, {
      id: input.id,
      tenantId: device.tenantId,
      storeId: device.storeId,
      deviceId: device.deviceId,
      deviceSequence: input.deviceSequence,
      orderNumber: input.orderNumber,
      cashierUserId: cashier.userId,
      cashierName: cashier.displayName,
      totalCentavos: input.totalCentavos,
      vatEnabled: tenant.vat_enabled,
      vatRatePercent: tenant.vat_enabled ? tenant.vat_rate_percent : null,
      discount: selectedDiscount
        ? {
            id: selectedDiscount.id,
            name: selectedDiscount.name,
            type: selectedDiscount.type,
            value: selectedDiscount.value!,
            scope: selectedDiscount.scope,
            vatExempt: selectedDiscount.vatExempt,
            amountCentavos: discountAmountCentavos,
          }
        : null,
    });
    if (!created) {
      const existing = await getReceiptById(db, { id: input.id, storeId: device.storeId });
      return existing
        ? {
            output: { ok: true, receipt: receiptSchema.parse(existing) } as const,
            actorUserId: existing.cashierUserId,
            outcome: "duplicate" as const,
          }
        : {
            output: { ok: false } as const,
            actorUserId: cashier.userId,
            outcome: "refused" as const,
          };
    }

    await insertOrderLines(db, {
      tenantId: device.tenantId,
      orderId: input.id,
      lines: input.lines.map((line, index) => {
        const discount = lineDiscounts[index];
        return {
          ...line,
          discount: discount
            ? {
                id: discount.id,
                name: discount.name,
                type: "percent" as const,
                value: discount.value!,
              }
            : null,
        };
      }),
    });
    await insertPayment(db, {
      tenantId: device.tenantId,
      orderId: input.id,
      paymentMethodId: paymentMethod.id,
      paymentMethodKind: paymentMethod.kind,
      paymentMethodName: paymentMethod.name,
      amountTenderedCentavos: input.amountTenderedCentavos,
      changeCentavos,
    });
    const receipt = await getReceiptById(db, { id: input.id, storeId: device.storeId });
    if (!receipt) throw new Error("Created Order receipt projection is unavailable");
    return {
      output: { ok: true, receipt: receiptSchema.parse(receipt) } as const,
      actorUserId: receipt.cashierUserId,
      outcome: "created" as const,
    };
  });

  logOutcome(device, input.id, result.actorUserId, result.outcome);
  return result.output;
};
