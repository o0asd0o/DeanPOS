import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button, Input, useSubmitGate } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";

import { useCreateModifierMutation, useUpdateModifierMutation } from "./__common/queries.ts";
import { DeltaField, type DeltaKind } from "./DeltaField.tsx";
import {
  absoluteToEditorString,
  type ModifierGroupOutput,
  type ModifierOutput,
  parseAbsoluteDeltaInput,
  parseMultiplierRateInput,
  perMilleToEditorString,
} from "./helpers.ts";

export function ModifierForm({
  group,
  modifier,
  onSaved,
  onCancel,
}: {
  group: ModifierGroupOutput;
  modifier: ModifierOutput | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const createModifier = useCreateModifierMutation();
  const updateModifier = useUpdateModifierMutation();
  const saving = createModifier.isPending || updateModifier.isPending;
  const [formError, setFormError] = useState<string | null>(null);
  const [deltaKind, setDeltaKind] = useState<DeltaKind>(modifier?.delta.kind ?? "absolute");
  const [deltaValue, setDeltaValue] = useState(() => {
    if (!modifier) return "";
    return modifier.delta.kind === "absolute"
      ? absoluteToEditorString(modifier.delta.amountCentavos)
      : perMilleToEditorString(modifier.delta.perMille);
  });
  const [deltaError, setDeltaError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: modifier?.name ?? "" },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setDeltaError(null);

      let delta:
        | { kind: "absolute"; amountCentavos: number }
        | { kind: "multiplier"; perMille: number };

      if (deltaKind === "absolute") {
        const parsed = parseAbsoluteDeltaInput(deltaValue);
        if (!parsed.ok) {
          setDeltaError("Enter an amount with up to two decimal places.");
          return;
        }
        if (parsed.value < -100_000 || parsed.value > 100_000) {
          setDeltaError("Amount must be within ±₱1,000.00.");
          return;
        }
        delta = { kind: "absolute", amountCentavos: parsed.value };
      } else {
        const parsed = parseMultiplierRateInput(deltaValue);
        if (!parsed.ok) {
          setDeltaError("Enter a rate with up to three decimal places (e.g. 0.5).");
          return;
        }
        delta = { kind: "multiplier", perMille: parsed.perMille };
      }

      const saved = modifier
        ? await updateModifier.mutateAsync({ id: modifier.id, name: value.name, delta })
        : await createModifier.mutateAsync({ groupId: group.id, name: value.name, delta });

      if (!saved) {
        setFormError("Couldn't save the modifier.");
        return;
      }
      onSaved(modifier ? "Saved" : "Modifier created");
    },
  });

  const gate = useSubmitGate(form, {
    busy: saving,
    dirty: true,
  });

  return (
    <SheetForm
      title={modifier ? `Edit ${modifier.name}` : `New modifier · ${group.name}`}
      busy={saving}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
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
      {formError ? (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
          {formError}
        </div>
      ) : null}
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modifier-name">Name</label>
            <Input
              id="modifier-name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </form.Field>
      <DeltaField
        kind={deltaKind}
        value={deltaValue}
        onKindChange={(k) => {
          setDeltaKind(k);
          setDeltaError(null);
        }}
        onValueChange={(v) => {
          setDeltaValue(v);
          setDeltaError(null);
        }}
        error={deltaError}
      />
    </SheetForm>
  );
}
