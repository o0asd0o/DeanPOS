import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useSubmitGate,
} from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";

import {
  useCreateModifierGroupMutation,
  useCreateModifierMutation,
  useUpdateModifierGroupMutation,
  useUpdateModifierMutation,
} from "./__common/queries.ts";
import { DeltaField, type DeltaKind } from "./DeltaField.tsx";
import {
  absoluteToEditorString,
  type ModifierGroupOutput,
  type ModifierOutput,
  parseAbsoluteDeltaInput,
  parseMultiplierRateInput,
  perMilleToEditorString,
  SELECTION_RULE_LABEL,
} from "./helpers.ts";

type EditorMode =
  | { kind: "group"; group: ModifierGroupOutput | null }
  | { kind: "modifier"; group: ModifierGroupOutput; modifier: ModifierOutput | null };

export function ModifierGroupEditor({
  mode,
  onSaved,
  onCancel,
}: {
  mode: EditorMode;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  if (mode.kind === "group") {
    return <GroupForm group={mode.group} onSaved={onSaved} onCancel={onCancel} />;
  }
  return (
    <ModifierForm
      group={mode.group}
      modifier={mode.modifier}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function GroupForm({
  group,
  onSaved,
  onCancel,
}: {
  group: ModifierGroupOutput | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const createGroup = useCreateModifierGroupMutation();
  const updateGroup = useUpdateModifierGroupMutation();
  const saving = createGroup.isPending || updateGroup.isPending;
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: group?.name ?? "",
      selectionRule: group?.selectionRule ?? ("required-one" as ModifierGroupOutput["selectionRule"]),
      maximum: group?.maximum?.toString() ?? "",
      defaultModifierId: group?.defaultModifierId ?? "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const maximumRaw = value.maximum.trim();
      const maximum =
        value.selectionRule === "many"
          ? maximumRaw === ""
            ? null
            : Number(maximumRaw)
          : null;
      if (value.selectionRule === "many" && maximum !== null) {
        if (!Number.isInteger(maximum) || maximum <= 0) {
          setFormError("Maximum must be a whole number greater than zero.");
          return;
        }
      }

      const saved = group
        ? await updateGroup.mutateAsync({
            id: group.id,
            name: value.name,
            selectionRule: value.selectionRule,
            maximum,
            defaultModifierId: value.defaultModifierId === "" ? null : value.defaultModifierId,
          })
        : await createGroup.mutateAsync({
            name: value.name,
            selectionRule: value.selectionRule,
            maximum,
          });

      if (!saved) {
        setFormError("Couldn't save the modifier group.");
        return;
      }
      onSaved(group ? "Saved" : "Group created");
    },
  });

  const gate = useSubmitGate(form, { busy: saving });

  return (
    <SheetForm
      title={group ? `Edit ${group.name}` : "New modifier group"}
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
            <label htmlFor="group-name">Name</label>
            <Input
              id="group-name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </form.Field>
      <form.Field name="selectionRule">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="group-rule">Selection rule</label>
            <Select
              value={field.state.value}
              onValueChange={(v) =>
                field.handleChange(v as ModifierGroupOutput["selectionRule"])
              }
            >
              <SelectTrigger id="group-rule" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SELECTION_RULE_LABEL) as ModifierGroupOutput["selectionRule"][]).map(
                  (rule) => (
                    <SelectItem key={rule} value={rule}>
                      {SELECTION_RULE_LABEL[rule]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(s) => s.values.selectionRule}>
        {(selectionRule) =>
          selectionRule === "many" ? (
            <form.Field name="maximum">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="group-max">Maximum (optional)</label>
                  <Input
                    id="group-max"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Unlimited"
                  />
                </div>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
      {group && group.modifiers.filter((m) => !m.archivedAt).length > 0 ? (
        <form.Field name="defaultModifierId">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="group-default">Default modifier (optional)</label>
              <Select
                value={field.state.value || "__none__"}
                onValueChange={(v) => field.handleChange(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="group-default" className="w-full">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No default</SelectItem>
                  {group.modifiers
                    .filter((m) => !m.archivedAt)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      ) : null}
    </SheetForm>
  );
}

function ModifierForm({
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
