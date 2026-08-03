import type { DatabaseInstance } from "../../../db/client.ts";

// All five settings move together — the editor is one form, one Save
// (record 046 §"Three smaller calls"). The tenant_settings_update RLS
// policy confines this to the caller's own row.
export const updateTenantSettings = (
  db: DatabaseInstance,
  tenantId: string,
  values: {
    timezone: string;
    vatEnabled: boolean;
    vatRatePercent: number;
    varianceToleranceCentavos: number;
    cashMovementOverrideThresholdCentavos: number;
  },
) =>
  db
    .updateTable("Tenant")
    .set({
      timezone: values.timezone,
      vat_enabled: values.vatEnabled,
      vat_rate_percent: values.vatRatePercent,
      variance_tolerance_centavos: values.varianceToleranceCentavos,
      cash_movement_override_threshold_centavos: values.cashMovementOverrideThresholdCentavos,
    })
    .where("id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
