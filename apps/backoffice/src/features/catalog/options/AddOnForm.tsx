import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button, Input, useSubmitGate } from "ui";
import { SheetForm } from "@/components/SheetForm.tsx";
import { useCreateAddOnMutation, useUpdateAddOnMutation } from "./__common/queries.ts";
import { DeltaField } from "./DeltaField.tsx";
import {
  absoluteToEditorString,
  parseAbsoluteDeltaInput,
  parseMultiplierRateInput,
  perMilleToEditorString,
  type AddOnOutput,
  type DeltaOutput,
} from "./helpers.ts";

export function AddOnForm({
  addOn,
  onSaved,
  onCancel,
}: {
  addOn: AddOnOutput | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateAddOnMutation();
  const update = useUpdateAddOnMutation();
  const saving = create.isPending || update.isPending;
  const [error, setError] = useState<string | null>(null);
  const initialDelta: DeltaOutput = addOn?.delta ?? { kind: "absolute", amountCentavos: 0 };
  const form = useForm({
    defaultValues: {
      name: addOn?.name ?? "",
      kind: initialDelta.kind,
      value:
        initialDelta.kind === "absolute"
          ? absoluteToEditorString(initialDelta.amountCentavos)
          : perMilleToEditorString(initialDelta.perMille),
      maximum: addOn?.maximum?.toString() ?? "",
    },
    onSubmit: async ({ value }) => {
      const maximum = value.maximum.trim() === "" ? null : Number(value.maximum);
      if (maximum !== null && (!Number.isInteger(maximum) || maximum <= 0)) {
        setError("Maximum must be a whole number greater than zero.");
        return;
      }
      const delta =
        value.kind === "absolute"
          ? parseAbsoluteDeltaInput(value.value)
          : parseMultiplierRateInput(value.value);
      if (!delta.ok) {
        setError("Enter a valid price adjustment.");
        return;
      }
      const payloadDelta =
        value.kind === "absolute"
          ? {
              kind: "absolute" as const,
              amountCentavos: (delta as ReturnType<typeof parseAbsoluteDeltaInput> & { ok: true })
                .value,
            }
          : {
              kind: "multiplier" as const,
              perMille: (delta as ReturnType<typeof parseMultiplierRateInput> & { ok: true })
                .perMille,
            };
      const payload = {
        name: value.name,
        delta: payloadDelta,
        maximum,
      };
      const saved = addOn
        ? await update.mutateAsync({ id: addOn.id, ...payload })
        : await create.mutateAsync(payload);
      if (!saved) {
        setError("Couldn't save the add-on.");
        return;
      }
      onSaved(addOn ? "Saved" : "Add-on created");
    },
  });
  const gate = useSubmitGate(form, { busy: saving });
  return (
    <SheetForm
      title={addOn ? `Edit ${addOn.name}` : "New add-on"}
      busy={saving}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={gate.blocked}>
            <CheckIcon />
            Save
          </Button>
        </>
      }
    >
      {error ? (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
          {error}
        </div>
      ) : null}
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-on-name">Name</label>
            <Input
              id="add-on-name"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.values.kind, state.values.value] as const}>
        {([kind, value]) => (
          <DeltaField
            kind={kind}
            value={value}
            onKindChange={(next) => form.setFieldValue("kind", next)}
            onValueChange={(next) => form.setFieldValue("value", next)}
          />
        )}
      </form.Subscribe>
      <form.Field name="maximum">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-on-maximum">Maximum quantity (optional)</label>
            <Input
              id="add-on-maximum"
              inputMode="numeric"
              placeholder="Unlimited"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
    </SheetForm>
  );
}
