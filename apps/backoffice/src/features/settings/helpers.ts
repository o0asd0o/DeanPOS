import { parseCentavos } from "schemas/src/money.ts";
import type { TenantTimezone } from "schemas/src/timezones.ts";

export type TenantSettingsOutput = {
  timezone: TenantTimezone;
  vatEnabled: boolean;
  vatRatePercent: number;
  varianceToleranceCentavos: number;
  cashMovementOverrideThresholdCentavos: number;
};

// Integer centavos to a "0.00" pesos string, by integer arithmetic only —
// no float division ever touches a money value (ADR-0005).
export function centavosToPesosString(centavos: number): string {
  const whole = Math.trunc(centavos / 100);
  const fraction = Math.abs(centavos % 100)
    .toString()
    .padStart(2, "0");
  return `${whole}.${fraction}`;
}

// The reverse: a "0.00"-shaped string to exact integer centavos, via the
// one shared parser (ADR-0005) — never `parseFloat`. `null` on anything that
// doesn't parse, so the caller can refuse the save instead of guessing.
export function pesosStringToCentavos(value: string): number | null {
  const result = parseCentavos(value);
  return result.ok ? result.value : null;
}
