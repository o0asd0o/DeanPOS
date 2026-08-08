import { timezoneSchema } from "schemas/src/timezones.ts";
import { z } from "zod";

// Issue 07, record 046 §2: these five columns, integer centavos (ADR-0005),
// integer VAT percent (record 046 §1). A setting governs sales made from now
// on — nothing here reads a current value to interpret a past one.
export const tenantSettingsOutputSchema = z.object({
  timezone: timezoneSchema,
  vatEnabled: z.boolean(),
  vatRatePercent: z.number().int(),
  varianceToleranceCentavos: z.number().int(),
  cashMovementOverrideThresholdCentavos: z.number().int(),
});

export const tenantSettingsUpdateInputSchema = z.object({
  timezone: timezoneSchema,
  vatEnabled: z.boolean(),
  vatRatePercent: z.number().int().min(0),
  varianceToleranceCentavos: z.number().int().min(0),
  cashMovementOverrideThresholdCentavos: z.number().int().min(0),
});
