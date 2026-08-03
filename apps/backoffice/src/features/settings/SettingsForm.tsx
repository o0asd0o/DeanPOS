import { useForm } from "@tanstack/react-form";
import { TENANT_TIMEZONES } from "schemas/src/timezones.ts";
import type { TenantTimezone } from "schemas/src/timezones.ts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui";

import { centavosToPesosString, pesosStringToCentavos } from "./helpers.ts";
import type { TenantSettingsOutput } from "./helpers.ts";

// One form, one Save, for all five settings (record 046 §"Three smaller
// calls"). `TanStack Form` owns back-office forms (record 037).
export function SettingsForm({
  settings,
  saving,
  failed,
  moneyError,
  onMoneyError,
  onSave,
  announcement,
}: {
  settings: TenantSettingsOutput;
  saving: boolean;
  failed: boolean;
  moneyError: string | null;
  onMoneyError: (message: string | null) => void;
  onSave: (values: TenantSettingsOutput) => Promise<void>;
  announcement: string;
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

  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <h1 className="text-lg font-bold">Settings — sales</h1>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Sales settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (saving) return;
              void form.handleSubmit();
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

            <fieldset className="flex flex-col gap-2">
              <legend className="font-bold">VAT</legend>
              <form.Field name="vatEnabled">
                {(field) => (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="vat-enabled"
                      checked={field.state.value}
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
              <p className="text-foreground">
                A price is always what the customer pays. VAT is never added — where enabled it is
                backed out of the recorded total for receipts and reports.
              </p>
              <p className="text-foreground">
                Turning this on affects sales from now on. Last month stays as last month was sold.
              </p>
            </fieldset>

            <div className="flex flex-col gap-2">
              <h2 className="font-bold">Drawer sessions</h2>
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

            <Button type="submit" aria-disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>

            {moneyError && (
              <div
                role="alert"
                className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
              >
                {moneyError}
              </div>
            )}
            {failed && !moneyError && (
              <div
                role="alert"
                className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
              >
                Couldn&rsquo;t save settings
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
