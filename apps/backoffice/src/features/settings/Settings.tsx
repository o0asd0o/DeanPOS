import { useState } from "react";

import { useSettingsQuery, useUpdateSettingsMutation } from "./__common/queries.ts";
import { SettingsForm } from "./SettingsForm.tsx";

// The Sales settings screen (issue 07, record 046): one form, one Save, for
// all five Tenant settings — record 040's shape, no list above it since
// there is exactly one row per Tenant. Payment methods (same mock) are
// issue 08, not built here.
export function Settings() {
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const [announcement, setAnnouncement] = useState("");
  const [moneyError, setMoneyError] = useState<string | null>(null);

  if (settingsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-lg font-bold">Settings — sales</h1>
        <p>Loading…</p>
      </div>
    );
  }

  const settings = settingsQuery.data;
  if (settingsQuery.isError || !settings) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-lg font-bold">Settings — sales</h1>
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t load settings
        </div>
      </div>
    );
  }

  return (
    <SettingsForm
      key={JSON.stringify(settings)}
      settings={settings}
      saving={updateSettings.isPending}
      failed={updateSettings.isError}
      moneyError={moneyError}
      onMoneyError={setMoneyError}
      onSave={async (values) => {
        const saved = await updateSettings.mutateAsync(values);
        if (!saved) return;
        setAnnouncement("Saved");
      }}
      announcement={announcement}
    />
  );
}
