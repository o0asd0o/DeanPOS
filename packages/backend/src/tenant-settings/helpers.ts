import type { Selectable } from "kysely";
import type { TenantTimezone } from "schemas/src/timezones.ts";

import type { Tenant } from "../db/prisma/generated/types.ts";

export type TenantSettingsOutput = {
  timezone: TenantTimezone;
  vatEnabled: boolean;
  vatRatePercent: number;
  varianceToleranceCentavos: number;
  cashMovementOverrideThresholdCentavos: number;
};

// Physical `@map`ped columns to the contract's camelCase shape (issue 01's
// convention). `timezone` is narrowed here without a DB CHECK; the
// contract's `timezoneSchema` re-validates on the way out.
export const toTenantSettingsOutput = (tenant: Selectable<Tenant>): TenantSettingsOutput => ({
  timezone: tenant.timezone as TenantTimezone,
  vatEnabled: tenant.vat_enabled,
  vatRatePercent: tenant.vat_rate_percent,
  varianceToleranceCentavos: tenant.variance_tolerance_centavos,
  cashMovementOverrideThresholdCentavos: tenant.cash_movement_override_threshold_centavos,
});

export type SettingChange = { setting: string; oldValue: string; newValue: string };

// Text, always — the setting name says the type, and every one of the five
// is a scalar (record 046 §3). Only entries that actually changed are
// returned: a save changing three settings writes three audit rows, not
// five (issue 07 criterion 4).
export const diffTenantSettings = (
  before: TenantSettingsOutput,
  after: TenantSettingsOutput,
): SettingChange[] => {
  const changes: SettingChange[] = [];
  for (const setting of Object.keys(before) as (keyof TenantSettingsOutput)[]) {
    if (before[setting] !== after[setting]) {
      changes.push({
        setting,
        oldValue: String(before[setting]),
        newValue: String(after[setting]),
      });
    }
  }
  return changes;
};
