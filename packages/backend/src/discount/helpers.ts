import type { Selectable } from "kysely";
import type { Discount } from "../db/prisma/generated/types.ts";

export const toDiscountOutput = (row: Selectable<Discount>) => ({
  id: row.id,
  discountId: row.discount_id,
  tenantId: row.tenant_id,
  name: row.name,
  type: row.type as "percent" | "amount",
  scope: row.scope as "order" | "line",
  value: row.value,
  requiresOverride: row.requires_override,
  vatExempt: row.vat_exempt,
  requiresReference: row.requires_reference,
  referenceLabel: row.reference_label,
  archivedAt: row.archived_at,
  effectiveFrom: row.effective_from,
  createdAt: row.created_at,
});

export const toDiscountReadShape = (row: Selectable<Discount>) => ({
  id: row.id,
  name: row.name,
  type: row.type as "percent" | "amount",
  scope: row.scope as "order" | "line",
  value: row.value,
  requiresOverride: row.requires_override,
  vatExempt: row.vat_exempt,
  requiresReference: row.requires_reference,
  referenceLabel: row.reference_label,
});
