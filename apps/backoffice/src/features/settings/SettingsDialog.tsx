import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";

import { useSettingsQuery, useUpdateSettingsMutation } from "./__common/queries.ts";
import { SettingsForm } from "./SettingsForm.tsx";

// The Sales settings dialog (record 046): one form, one Save, for all five
// Tenant settings. A dialog rather than a screen — there is exactly one row
// per Tenant, and nothing to list. The read starts when it opens.
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settingsQuery = useSettingsQuery(open);
  const updateSettings = useUpdateSettingsMutation();
  const [announcement, setAnnouncement] = useState("");
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const settings = settingsQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scrollbar-slim max-h-dvh max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sales settings</DialogTitle>
          <DialogDescription>
            VAT, timezone, and the drawer-session thresholds this business runs on.
          </DialogDescription>
        </DialogHeader>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {settingsQuery.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        ) : settingsQuery.isError || !settings ? (
          <ErrorState
            onRetry={() => void settingsQuery.refetch()}
            isFetching={settingsQuery.isFetching}
          />
        ) : (
          <SettingsForm
            key={JSON.stringify(settings)}
            settings={settings}
            saving={updateSettings.isPending}
            failed={updateSettings.isError || saveFailed}
            moneyError={moneyError}
            onMoneyError={setMoneyError}
            onSave={async (values) => {
              setSaveFailed(false);
              try {
                const saved = await updateSettings.mutateAsync(values);
                if (!saved) {
                  // A refusal server-side (e.g. demoted/deactivated
                  // mid-session) resolves `null` rather than rejecting —
                  // treated the same as a thrown error.
                  setSaveFailed(true);
                  return;
                }
                setAnnouncement("Saved");
              } catch {
                // isError is already set on the mutation; swallow so it doesn't
                // also surface as an unhandled promise rejection.
                setSaveFailed(true);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
