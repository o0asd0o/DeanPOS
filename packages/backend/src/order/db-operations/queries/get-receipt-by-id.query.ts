import type { DatabaseTransaction } from "../../../db/client.ts";

export async function getReceiptById(
  db: DatabaseTransaction,
  values: { id: string; storeId: string },
) {
  const order = await db
    .selectFrom("Order as order")
    .innerJoin("Device as device", (join) =>
      join
        .onRef("device.tenant_id", "=", "order.tenant_id")
        .onRef("device.id", "=", "order.device_id"),
    )
    .innerJoin("Payment as payment", (join) =>
      join
        .onRef("payment.tenant_id", "=", "order.tenant_id")
        .onRef("payment.order_id", "=", "order.id"),
    )
    .select([
      "order.id as order_id",
      "order.order_number",
      "order.cashier_user_id",
      "order.cashier_name",
      "order.total_centavos",
      "order.vat_enabled",
      "order.vat_rate_percent",
      "order.discount_name",
      "order.discount_amount_centavos",
      "device.code as device_code",
      "device.name as device_name",
      "payment.amount_tendered_centavos",
      "payment.change_centavos",
      "payment.payment_method_id",
      "payment.method as method_kind",
      "payment.method_name",
    ])
    .where("order.id", "=", values.id)
    .where("order.store_id", "=", values.storeId)
    .executeTakeFirst();
  if (!order) return null;

  const lines = await db
    .selectFrom("OrderLine")
    .select([
      "menu_item_name",
      "variant_name",
      "unit_price_centavos",
      "quantity",
      "line_total_centavos",
      "modifier_snapshot",
      "addon_snapshot",
    ])
    .where("order_id", "=", values.id)
    .orderBy("sort_order")
    .execute();

  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    deviceCode: order.device_code,
    deviceName: order.device_name,
    cashierUserId: order.cashier_user_id,
    cashierName: order.cashier_name,
    paymentMethodId: order.payment_method_id,
    paymentMethodName: order.method_name,
    paymentMethodKind: order.method_kind as "cash" | "recorded",
    totalCentavos: order.total_centavos,
    vatRatePercent: order.vat_enabled ? order.vat_rate_percent : null,
    amountTenderedCentavos: order.amount_tendered_centavos,
    changeCentavos: order.change_centavos,
    discount:
      order.discount_name === null || order.discount_amount_centavos === null
        ? null
        : { name: order.discount_name, amountCentavos: order.discount_amount_centavos },
    lines: lines.map((line) => ({
      menuItemName: line.menu_item_name,
      variantName: line.variant_name,
      unitPriceCentavos: line.unit_price_centavos,
      quantity: line.quantity,
      lineTotalCentavos: line.line_total_centavos,
      modifiers: line.modifier_snapshot,
      addOns: line.addon_snapshot,
    })),
  };
}
