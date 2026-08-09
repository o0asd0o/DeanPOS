import type { DatabaseInstance } from "../../../db/client.ts";

export const insertDiscount = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    discountId: string;
    name: string;
    type: string;
    scope: string;
    value: number | null;
    requiresOverride: boolean;
    vatExempt: boolean;
    requiresReference: boolean;
    referenceLabel: string | null;
    archivedAt: Date | null;
    effectiveFrom: Date;
  },
) =>
  db
    .insertInto("Discount")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      discount_id: values.discountId,
      name: values.name,
      type: values.type,
      scope: values.scope,
      value: values.value,
      requires_override: values.requiresOverride,
      vat_exempt: values.vatExempt,
      requires_reference: values.requiresReference,
      reference_label: values.referenceLabel,
      archived_at: values.archivedAt,
      effective_from: values.effectiveFrom,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
