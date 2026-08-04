import { useForm } from "@tanstack/react-form";
import { parseCentavos } from "schemas/src/money.ts";
import { TENANT_TIMEZONES } from "schemas/src/timezones.ts";
import type { TenantTimezone } from "schemas/src/timezones.ts";
import {
  Button,
  DialogFooter,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useSubmitGate,
} from "ui";

import { Hint } from "@/components/Hint.tsx";

export type TenantSettingsOutput = {
  timezone: TenantTimezone;
  vatEnabled: boolean;
  vatRatePercent: number;
  varianceToleranceCentavos: number;
  cashMovementOverrideThresholdCentavos: number;
};

// Integer centavos to a "0.00" pesos string, by integer arithmetic only —
// no float division ever touches a money value (ADR-0005).
function centavosToPesosString(centavos: number): string {
  const fraction = centavos % 100;
  const whole = (centavos - fraction) / 100;
  return `${whole}.${Math.abs(fraction).toString().padStart(2, "0")}`;
}

// The reverse: a "0.00"-shaped string to exact integer centavos, via the
// one shared parser (ADR-0005) — never `parseFloat`. `null` on anything that
// doesn't parse, so the caller can refuse the save instead of guessing.
function pesosStringToCentavos(value: string): number | null {
  const result = parseCentavos(value);
  return result.ok ? result.value : null;
}

// One form, one Save, for all five settings (record 046 §"Three smaller
// calls"). `TanStack Form` owns back-office forms (record 037).
export function SettingsForm({
  settings,
  saving,
  failed,
  moneyError,
  onMoneyError,
  onSave,
}: {
  settings: TenantSettingsOutput;
  saving: boolean;
  failed: boolean;
  moneyError: string | null;
  onMoneyError: (message: string | null) => void;
  onSave: (values: TenantSettingsOutput) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: {
      timezone: settings.timezone,
      vatEnabled: settings.vatEnabled,
      vatRatePercent: settings.vatRatePercent,
      varianceTolerance: centavosToPesosString(settings.varianceToleranceCentavos),
      cashMovementOverrideThreshold: centavosToPesosString(
        settings.cashMovementOverrideThresholdCentavos,
      ),
    },
    onSubmit: async ({ value }) => {
      const varianceToleranceCentavos = pesosStringToCentavos(value.varianceTolerance);
      const cashMovementOverrideThresholdCentavos = pesosStringToCentavos(
        value.cashMovementOverrideThreshold,
      );
      if (varianceToleranceCentavos === null || cashMovementOverrideThresholdCentavos === null) {
        onMoneyError("Enter pesos and centavos, like 0.00");
        return;
      }
      if (varianceToleranceCentavos < 0 || cashMovementOverrideThresholdCentavos < 0) {
        onMoneyError("Amounts cannot be negative");
        return;
      }
      onMoneyError(null);

      await onSave({
        timezone: value.timezone,
        vatEnabled: value.vatEnabled,
        vatRatePercent: value.vatRatePercent,
        varianceToleranceCentavos,
        cashMovementOverrideThresholdCentavos,
      });
    },
  });

  const gate = useSubmitGate(form, { busy: saving });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        gate.submit();
      }}
      aria-busy={saving}
      className="flex flex-col gap-6"
    >
      <form.Field name="timezone">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="tenant-timezone">Timezone</label>
            <Select
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value as TenantTimezone)}
            >
              <SelectTrigger id="tenant-timezone" autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENANT_TIMEZONES.map((timezone) => (
                  <SelectItem key={timezone} value={timezone}>
                    {timezone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold">VAT</legend>
        <form.Field name="vatEnabled">
          {(field) => (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vat-enabled"
                checked={field.state.value}
                aria-describedby="vat-explanation"
                onChange={(event) => field.handleChange(event.target.checked)}
              />
              <label htmlFor="vat-enabled">This business is VAT-registered</label>
            </div>
          )}
        </form.Field>
        <form.Field name="vatRatePercent">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor="vat-rate-percent">Rate (%)</label>
              <Input
                id="vat-rate-percent"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(Number(event.target.value))}
              />
            </div>
          )}
        </form.Field>
        <Hint
          id="vat-explanation"
          detail="Turning this on affects sales from now on. Last month stays as last month was sold."
        >
          A price is always what the customer pays. VAT is never added — where enabled it is backed
          out of the recorded total for receipts and reports.
        </Hint>
      </fieldset>

      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">Drawer sessions</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="varianceTolerance">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="variance-tolerance">Variance tolerance (₱)</label>
                <Input
                  id="variance-tolerance"
                  inputMode="decimal"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="cashMovementOverrideThreshold">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="cash-movement-override-threshold">
                  Cash-movement Override threshold (₱)
                </label>
                <Input
                  id="cash-movement-override-threshold"
                  inputMode="decimal"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>
      </div>

      {moneyError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          {moneyError}
        </div>
      )}
      {failed && !moneyError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t save settings
        </div>
      )}

      <DialogFooter className="border-t pt-4">
        <Button type="submit" aria-disabled={gate.blocked}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
