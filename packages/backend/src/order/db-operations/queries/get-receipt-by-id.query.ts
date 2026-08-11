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
      "order.total_centavos",
      "device.code as device_code",
      "device.name as device_name",
      "payment.amount_tendered_centavos",
      "payment.change_centavos",
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
    totalCentavos: order.total_centavos,
    amountTenderedCentavos: order.amount_tendered_centavos,
    changeCentavos: order.change_centavos,
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
