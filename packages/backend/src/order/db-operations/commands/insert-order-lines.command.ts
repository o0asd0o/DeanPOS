import { randomUUID } from "node:crypto";

import type { DatabaseTransaction } from "../../../db/client.ts";

type Snapshot = {
  id: string;
  name: string;
  deltaKind: "absolute" | "multiplier";
  deltaValue: number;
};

type Line = {
  menuItemId: string;
  menuItemName: string;
  variantId: string | null;
  variantName: string;
  unitPriceCentavos: number;
  quantity: number;
  lineTotalCentavos: number;
  modifiers: Snapshot[];
  addOns: Snapshot[];
  discount: { id: string; name: string; type: "percent"; value: number } | null;
};

export const insertOrderLines = (
  db: DatabaseTransaction,
  values: { tenantId: string; orderId: string; lines: Line[] },
) =>
  db
    .insertInto("OrderLine")
    .values(
      values.lines.map((line, sortOrder) => ({
        id: randomUUID(),
        tenant_id: values.tenantId,
        order_id: values.orderId,
        menu_item_id: line.menuItemId,
        menu_item_name: line.menuItemName,
        variant_id: line.variantId,
        variant_name: line.variantName,
        unit_price_centavos: line.unitPriceCentavos,
        quantity: line.quantity,
        line_total_centavos: line.lineTotalCentavos,
        discount_id: line.discount?.id ?? null,
        discount_name: line.discount?.name ?? null,
        discount_type: line.discount?.type ?? null,
        discount_value: line.discount?.value ?? null,
        modifier_snapshot: JSON.stringify(line.modifiers),
        addon_snapshot: JSON.stringify(line.addOns),
        sort_order: sortOrder,
      })),
    )
    .execute();
