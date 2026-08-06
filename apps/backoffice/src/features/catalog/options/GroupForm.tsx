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
  useUpdateModifierGroupMutation,
} from "./__common/queries.ts";
import { type ModifierGroupOutput, SELECTION_RULE_LABEL } from "./helpers.ts";

export function GroupForm({
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
      selectionRule:
        group?.selectionRule ?? ("required-one" as ModifierGroupOutput["selectionRule"]),
      maximum: group?.maximum?.toString() ?? "",
      defaultModifierId: group?.defaultModifierId ?? "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const maximumRaw = value.maximum.trim();
      const maximum =
        value.selectionRule === "many" ? (maximumRaw === "" ? null : Number(maximumRaw)) : null;
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
      {group && group.linkedToCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          Linked to {group.linkedToCount} {group.linkedToCount === 1 ? "variant" : "variants"}
        </p>
      ) : null}
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
              onValueChange={(v) => field.handleChange(v as ModifierGroupOutput["selectionRule"])}
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
