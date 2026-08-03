import { Hint } from "@/components/Hint.tsx";
import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { Button, Input } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";

import { useCreateStoreMutation, useUpdateStoreMutation } from "./__common/queries.ts";
import type { StoreOutput } from "./helpers.ts";
import type { LabelRow } from "./TableLabelsField.tsx";
import { TableLabelsField } from "./TableLabelsField.tsx";

// The Store editor (record 040): a Card below the list, one form, one Save,
// the whole label array sent together — the only shape in which order is
// unambiguous (record 040 §3).
export function StoreEditor({
  store,
  onSaved,
  onCancel,
  onAnnounce,
}: {
  store: StoreOutput | null;
  onSaved: () => void;
  onCancel: () => void;
  onAnnounce: (message: string) => void;
}) {
  const [labelRows, setLabelRows] = useState<LabelRow[]>(
    () => store?.tableLabels.map((value: string) => ({ id: crypto.randomUUID(), value })) ?? [],
  );

  const createStore = useCreateStoreMutation();
  const updateStore = useUpdateStoreMutation();
  const saving = createStore.isPending || updateStore.isPending;
  const failed = createStore.isError || updateStore.isError;

  const form = useForm({
    defaultValues: {
      name: store?.name ?? "",
      businessDayStart: store?.businessDayStart ?? "00:00",
    },
    onSubmit: async ({ value }) => {
      // Empty and whitespace-only labels are trimmed away silently on save,
      // with no error — the user has just abandoned a row they added
      // (record 039 clause 8).
      const tableLabels = labelRows.map((row) => row.value).filter((v) => v.trim() !== "");
      const payload = { name: value.name, businessDayStart: value.businessDayStart, tableLabels };

      const saved = store
        ? await updateStore.mutateAsync({ id: store.id, ...payload })
        : await createStore.mutateAsync(payload);
      if (!saved) return;

      onSaved();
    },
  });

  return (
    <SheetForm
      title={store ? `Edit ${store.name}` : "New store"}
      busy={saving}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={saving}>
            <CheckIcon />
            {store ? (saving ? "Saving…" : "Save changes") : saving ? "Creating…" : "Create store"}
          </Button>
        </>
      }
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="store-name">Name</label>
            <Input
              id="store-name"
              name={field.name}
              placeholder="Downtown"
              required
              autoFocus
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="businessDayStart">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="business-day-start">Business-day start</label>
            <Input
              id="business-day-start"
              name={field.name}
              type="time"
              step={60}
              required
              aria-describedby="business-day-start-hint"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <Hint
              id="business-day-start-hint"
              detail="Changing this affects reports from now on. Sales already recorded keep the day they were recorded under."
            >
              Sales made before this time count towards the previous business day.
            </Hint>
          </div>
        )}
      </form.Field>
      <TableLabelsField rows={labelRows} onChange={setLabelRows} onAnnounce={onAnnounce} />
      {failed && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t save the store
        </div>
      )}
    </SheetForm>
  );
}
